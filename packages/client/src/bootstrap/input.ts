import { effect } from "@preact/signals";
import type { InputScope } from "../contracts/game-ui.js";
import type { GameHandle } from "../game/create-game.js";
import { dismissTooltip } from "../ui/components/TooltipHost.js";
import type { UiController } from "../ui/controller.js";
import type { CatalogueId } from "../ui/t.js";
import type { FullscreenState } from "./host.js";

export const SHELL_BINDINGS = {
  KeyE: "key.pos.inventory",
  F1: "key.all.hud",
  F2: "key.all.shot",
  F3: "key.all.debug",
  F4: "key.own.tools",
  F11: "key.all.fullscreen",
} as const satisfies Readonly<Record<string, CatalogueId>>;

export function inputScope(state: {
  active: boolean;
  systemBlocked: boolean;
  modal: boolean;
  blocking: boolean;
  field: boolean;
  ready: boolean;
  postcard: boolean;
}): InputScope {
  if (!state.active) return "inactive";
  if (state.systemBlocked) return "blocking-screen";
  if (state.field) return "field";
  if (state.modal) return "modal";
  if (state.blocking) return "blocking-screen";
  return state.ready && !state.postcard ? "world" : "inactive";
}

export function reservedKey(
  event: Pick<KeyboardEvent, "code" | "metaKey" | "altKey" | "ctrlKey">,
  mac: boolean,
  locked: boolean,
): boolean {
  return (
    event.code === "F12" ||
    event.metaKey ||
    event.altKey ||
    (mac && event.code === "F11") ||
    (!mac &&
      !locked &&
      event.ctrlKey &&
      ["KeyW", "KeyT", "KeyN", "KeyQ", "Tab", "PageUp", "PageDown"].includes(
        event.code,
      ))
  );
}

function fieldElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  if (
    target.isContentEditable ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
    return target;
  if (
    target instanceof HTMLInputElement &&
    !["range", "checkbox", "button"].includes(target.type)
  )
    return target;
  return null;
}

/** Sole global keyboard owner; component key handlers retain blocking-screen focus navigation. */
export function bindInput(
  ui: UiController,
  game: GameHandle,
  fullscreen: FullscreenState,
): {
  readonly scope: () => InputScope;
  escape(): boolean;
  dispose(): void;
} {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  let active = document.hasFocus();
  let scope: InputScope = "inactive";
  const systemBlocked = (): boolean =>
    innerWidth < 1024 ||
    innerHeight < 600 ||
    ui.game.value.graphics === "unavailable";
  const synchronize = (): void => {
    const snapshot = ui.game.value;
    const next = inputScope({
      active: active && !document.hidden,
      systemBlocked: systemBlocked(),
      modal: ui.confirmSeed.value !== null,
      blocking: ui.blocking.value !== null,
      field: fieldElement(document.activeElement) !== null,
      ready: snapshot.lifecycle === "ready",
      postcard: snapshot.mode === "postcard",
    });
    if (next === scope) return;
    game.input.blur();
    scope = next;
    game.port.apply({ type: "input-scope", scope });
  };
  const stop = effect(synchronize);
  const resolveEscape = (): boolean => {
    if (dismissTooltip()) return true;
    const field = fieldElement(document.activeElement);
    if (field) {
      const blocking = field.closest<HTMLElement>("[data-blocking]");
      field.blur();
      blocking?.focus();
      synchronize();
      return true;
    }
    if (systemBlocked()) return false;
    if (
      ui.confirmSeed.value !== null ||
      ui.blocking.value ||
      ui.game.value.mode === "postcard" ||
      ui.toolsOpen.value
    )
      return ui.escape();
    if (game.input.cancelDrag()) return true;
    return ui.escape();
  };
  const consume = (event: KeyboardEvent): void => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const down = (event: KeyboardEvent): void => {
    synchronize();
    if (!active || document.hidden) return;
    if (event.defaultPrevented || reservedKey(event, mac, fullscreen.locked()))
      return;
    if (event.code === "Escape") {
      if (event.repeat) {
        consume(event);
        return;
      }
      if (!fullscreen.claimEscape() || resolveEscape()) consume(event);
      return;
    }
    if (scope === "field" || scope === "modal" || systemBlocked()) return;
    if (scope === "blocking-screen") {
      if (
        event.code === "KeyE" &&
        ui.blocking.value === "blocks" &&
        !event.ctrlKey &&
        !event.shiftKey
      ) {
        if (!event.repeat) ui.key("key.pos.inventory");
        consume(event);
      }
      return;
    }
    if (scope !== "world") {
      // A frozen postcard still supports capture and fullscreen; it never drives the body.
      if (
        ui.game.value.mode === "postcard" &&
        ui.game.value.lifecycle === "ready" &&
        (event.code === "F2" || event.code === "F11")
      ) {
        if (!event.repeat) ui.key(SHELL_BINDINGS[event.code]);
        consume(event);
      }
      return;
    }
    const binding = SHELL_BINDINGS[event.code as keyof typeof SHELL_BINDINGS];
    if (binding) {
      if (!event.repeat) ui.key(binding);
      consume(event);
      return;
    }
    // Engine applies the same B1 default prevention and repeat/drop rules to world keys.
    game.input.keydown(event);
    if (!event.defaultPrevented) event.preventDefault();
    event.stopImmediatePropagation();
  };
  const up = (event: KeyboardEvent): void => {
    if (event.code === "Escape") fullscreen.releaseEscape();
    game.input.keyup(event);
  };
  const blur = (): void => {
    active = false;
    fullscreen.releaseEscape();
    game.input.blur();
    synchronize();
  };
  const focus = (): void => {
    active = true;
    synchronize();
  };
  const focusOut = (): void => {
    queueMicrotask(synchronize);
  };
  const pointer = (event: PointerEvent): void => {
    if (!(event.target instanceof Element)) return;
    if (ui.toolsOpen.value && !event.target.closest(".cf-ui"))
      ui.toolsOpen.value = false;
    const field = fieldElement(document.activeElement);
    if (field && event.target !== field) field.blur();
    synchronize();
  };
  window.addEventListener("keydown", down, true);
  window.addEventListener("keyup", up, true);
  window.addEventListener("blur", blur);
  window.addEventListener("focus", focus);
  window.addEventListener("resize", synchronize);
  document.addEventListener("visibilitychange", synchronize);
  document.addEventListener("focusin", synchronize);
  document.addEventListener("focusout", focusOut);
  document.addEventListener("pointerdown", pointer, true);
  return {
    scope: () => scope,
    escape: resolveEscape,
    dispose() {
      stop();
      game.input.blur();
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      window.removeEventListener("resize", synchronize);
      document.removeEventListener("visibilitychange", synchronize);
      document.removeEventListener("focusin", synchronize);
      document.removeEventListener("focusout", focusOut);
      document.removeEventListener("pointerdown", pointer, true);
    },
  };
}
