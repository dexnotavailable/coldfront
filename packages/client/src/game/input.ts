import type {
  FlySpeed,
  HotbarIndex,
  InputScope,
} from "../contracts/game-ui.js";
import { WORLD_BUTTONS, WORLD_CODES } from "./bindings.js";
import { type OverheadCamera, wheelFactor } from "./camera.js";
export interface InputActions {
  readonly camera: OverheadCamera;
  select(index: HotbarIndex): void;
  pick(): void;
  toggleFly(): void;
  speed(delta: number): void;
  keyboardLocked(): boolean;
  windowed(): void;
}
const movement = new Set<string>([
  WORLD_CODES.forward,
  WORLD_CODES.left,
  WORLD_CODES.back,
  WORLD_CODES.right,
]);
const shellKeys = new Set([
  "Escape",
  "KeyE",
  "F1",
  "F2",
  "F3",
  "F4",
  "F11",
  "F12",
]);
export class WorldInput {
  scope: InputScope = "inactive";
  readonly held = new Set<string>();
  readonly buttons = new Set<number>();
  pointer = { x: 0, y: 0, inside: false };
  sprintTap = false;
  private readonly taps = new Map<string, number>();
  private readonly turns = new Map<string, { time: number; yaw: number }>();
  private middle: {
    time: number;
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    moved: boolean;
    drag: boolean;
    pointerId: number;
  } | null = null;
  private readonly abort = new AbortController();
  private readonly mac = /Mac|iPhone|iPad/.test(navigator.platform);
  private hintSent = false;
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly actions: InputActions,
    externalKeyboard = false,
  ) {
    const signal = this.abort.signal;
    if (!externalKeyboard) {
      window.addEventListener("keydown", this.down, { signal });
      window.addEventListener("keyup", this.up, { signal });
      window.addEventListener("blur", this.release, { signal });
    }
    canvas.addEventListener("pointerdown", this.pointerDown, { signal });
    canvas.addEventListener("pointermove", this.pointerMove, { signal });
    canvas.addEventListener("pointerup", this.pointerUp, { signal });
    canvas.addEventListener("pointercancel", this.release, { signal });
    canvas.addEventListener(
      "pointerleave",
      () => {
        this.pointer.inside = false;
      },
      { signal },
    );
    canvas.addEventListener(
      "mousedown",
      (e) => {
        if (e.button === 1) e.preventDefault();
      },
      { signal },
    );
    canvas.addEventListener("contextmenu", (e) => e.preventDefault(), {
      signal,
    });
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (this.scope === "world")
          actions.camera.zoom(wheelFactor(e.deltaY, e.deltaMode));
      },
      { passive: false, signal },
    );
  }
  setScope(scope: InputScope): void {
    if (scope !== this.scope) this.release();
    this.scope = scope;
  }
  keydown(event: KeyboardEvent): void {
    this.down(event);
  }
  keyup(event: KeyboardEvent): void {
    this.up(event);
  }
  cancelDrag(): boolean {
    if (!this.middle) return false;
    this.release();
    this.canvas.style.cursor = "crosshair";
    return true;
  }
  get forward(): number {
    return Number(this.held.has("KeyW")) - Number(this.held.has("KeyS"));
  }
  get right(): number {
    return Number(this.held.has("KeyD")) - Number(this.held.has("KeyA"));
  }
  get turn(): number {
    return (
      Number(this.held.has("ArrowRight")) - Number(this.held.has("ArrowLeft"))
    );
  }
  get tilt(): number {
    return (
      Number(this.held.has("ArrowDown")) - Number(this.held.has("ArrowUp"))
    );
  }
  get sprint(): boolean {
    return (
      this.sprintTap ||
      (this.held.has("ControlLeft") &&
        (this.mac || this.actions.keyboardLocked()))
    );
  }
  private down = (event: KeyboardEvent): void => {
    if (
      this.scope !== "world" ||
      event.defaultPrevented ||
      shellKeys.has(event.code)
    )
      return;
    const browserReserved =
      event.metaKey ||
      event.altKey ||
      (!this.mac &&
        !this.actions.keyboardLocked() &&
        event.ctrlKey &&
        ["KeyW", "KeyT", "KeyN", "KeyQ", "Tab", "PageUp", "PageDown"].includes(
          event.code,
        ));
    if (browserReserved) return;
    event.preventDefault();
    if (event.repeat) return;
    if (
      event.code === "ControlLeft" &&
      !this.mac &&
      !this.actions.keyboardLocked() &&
      !this.hintSent
    ) {
      this.hintSent = true;
      this.actions.windowed();
    }
    const now = performance.now();
    if (movement.has(event.code)) {
      if (now - (this.taps.get(event.code) ?? -Infinity) <= 350)
        this.sprintTap = true;
      this.taps.set(event.code, now);
    }
    if (event.code === "Space") {
      if (now - (this.taps.get("Space") ?? -Infinity) <= 350) {
        this.actions.toggleFly();
        this.taps.delete("Space");
      } else this.taps.set("Space", now);
    }
    if (event.code === "ArrowLeft" || event.code === "ArrowRight")
      this.turns.set(event.code, { time: now, yaw: this.actions.camera.yaw });
    if (/^Digit[1-9]$/.test(event.code))
      this.actions.select((Number(event.code.at(-1)) - 1) as HotbarIndex);
    if (event.code === "BracketLeft") this.actions.speed(-1);
    if (event.code === "BracketRight") this.actions.speed(1);
    this.held.add(event.code);
  };
  private up = (event: KeyboardEvent): void => {
    const turn = this.turns.get(event.code);
    if (this.scope === "world" && turn && performance.now() - turn.time < 200)
      this.actions.camera.tapTurn(
        event.code === "ArrowRight" ? 1 : -1,
        turn.yaw,
      );
    this.turns.delete(event.code);
    this.held.delete(event.code);
    if (
      movement.has(event.code) &&
      ![...movement].some((k) => this.held.has(k))
    )
      this.sprintTap = false;
  };
  private pointerDown = (event: PointerEvent): void => {
    if (this.scope !== "world" || event.button > 2) return;
    event.preventDefault();
    this.canvas.setPointerCapture(event.pointerId);
    this.buttons.add(event.button);
    this.pointerMove(event);
    if (event.button === WORLD_BUTTONS.pick)
      this.middle = {
        time: performance.now(),
        x: event.clientX,
        y: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: false,
        drag: false,
        pointerId: event.pointerId,
      };
  };
  private pointerMove = (event: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer = {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: 1 - ((event.clientY - rect.top) / rect.height) * 2,
      inside: true,
    };
    if (!this.middle) return;
    const m = this.middle;
    m.moved ||= Math.hypot(event.clientX - m.x, event.clientY - m.y) >= 6;
    if (m.moved && performance.now() - m.time >= 120) m.drag = true;
    if (m.drag) {
      this.actions.camera.orbit(
        event.clientX - m.lastX,
        event.clientY - m.lastY,
      );
      this.canvas.style.cursor = "move";
    }
    m.lastX = event.clientX;
    m.lastY = event.clientY;
  };
  private pointerUp = (event: PointerEvent): void => {
    this.buttons.delete(event.button);
    if (event.button === WORLD_BUTTONS.pick && this.middle) {
      if (!this.middle.moved && !this.middle.drag && this.scope === "world")
        this.actions.pick();
      this.middle = null;
      this.canvas.style.cursor = "crosshair";
    }
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId);
  };
  release = (): void => {
    this.held.clear();
    this.buttons.clear();
    this.taps.clear();
    this.turns.clear();
    this.sprintTap = false;
    if (this.middle && this.canvas.hasPointerCapture(this.middle.pointerId))
      this.canvas.releasePointerCapture(this.middle.pointerId);
    this.middle = null;
  };
  dispose(): void {
    this.release();
    this.abort.abort();
  }
}
export const FLY_SPEEDS: readonly FlySpeed[] = [1, 2, 4, 8, 16];
