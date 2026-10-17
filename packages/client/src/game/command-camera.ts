import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import { ease, follow } from "../engine/motion.js";
import { commandTilt, wheelFactor } from "./camera.js";
import { type BlockQuery, fallbackRay, type Point } from "./raycast.js";

/** Catalogue C1. These are camera units, independent of terrain LOD or origin. */
export const COMMAND_CAMERA = Object.freeze({
  fov: 40,
  minDistance: 24,
  maxDistance: 6000,
  worldRadius: 22000,
  clearance: 6,
  panUpSeconds: 0.12,
  panDownSeconds: 0.08,
  zoomSeconds: 0.09,
  groundSeconds: 0.3,
  followSeconds: 0.15,
  clearanceSeconds: 0.07,
});

export interface CameraCursor {
  /** CSS pixels relative to the world canvas, not device pixels. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CameraPose {
  readonly focus: Point;
  readonly position: Point;
  readonly distance: number;
  readonly yaw: number;
  readonly tilt: number;
  readonly cutHeight: number;
}

export interface CommandView {
  readonly focus: Point;
  readonly distance: number;
  readonly yaw: number;
  readonly tiltOffset: number;
  readonly cutHeight: number;
}

export interface CommandEnvironment {
  /** Highest drawn surface: terrain, water, construction, or the cut face. */
  surface(x: number, z: number, cut: number): number;
  /** First drawn hit. Far terrain must participate; never query hidden blocks. */
  raycast?(
    origin: Point,
    direction: Point,
    maxDistance: number,
    cut: number,
  ): Point | null;
  /** Optional fast disc average. Without it, the camera uses 25 disc samples. */
  averagedGround?(x: number, z: number, radius: number, cut: number): number;
  /** Only used on requested jumps/mode entry, never for every Command frame. */
  blocks?: BlockQuery;
}

export interface CommandSettings {
  /** D8 fraction 0..1; 0.4 is the documented 90/120/80 ms default. */
  smoothing: number;
  pan: number;
  zoom: number;
  cursorZoom: boolean;
  invertTilt: boolean;
  edgePan: boolean;
  reducedMotion: boolean;
}

export interface CommandInput {
  /** Screen-relative axes: right and up are positive; diagonals normalize. */
  readonly panX?: number;
  readonly panY?: number;
  readonly fast?: boolean;
  /** Q = -1, E = +1. Pass tapTurn on release if held less than 200 ms. */
  readonly turn?: number;
  /** Zoom out = +1, zoom in = -1. Six notches/second while held. */
  readonly zoom?: number;
  readonly cursor?: CameraCursor;
  readonly fullscreen?: boolean;
  readonly overPanel?: boolean;
  readonly dragging?: boolean;
}

export interface FollowTarget {
  readonly position: Point;
  readonly alive: boolean;
  readonly inCoverage: boolean;
  readonly owned: boolean;
  readonly visible: boolean;
}

export interface CameraTransition {
  readonly kind: "jump" | "mode" | "turn" | "reset";
  readonly style: "glide" | "fade";
  readonly durationMs: number;
  readonly focusDurationMs: number;
  readonly elapsedMs: number;
}

export interface CommandJump {
  readonly distance?: number;
  /** Only bookmarks should supply yaw/tiltOffset/cutHeight. */
  readonly yaw?: number;
  readonly tiltOffset?: number;
  readonly cutHeight?: number;
}

interface Anchor {
  readonly point: Point;
  readonly cursor: CameraCursor;
  readonly limited: boolean;
}

interface TurnAnimation {
  readonly from: number;
  readonly to: number;
  elapsed: number;
}

interface PanSlice {
  readonly seconds: number;
  readonly x: number;
  readonly y: number;
}

const radians = Math.PI / 180;
const tangent = Math.tan((COMMAND_CAMERA.fov * radians) / 2);
const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));
const distanceBetween = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const finitePoint = (point: Point) =>
  Number.isFinite(point.x) &&
  Number.isFinite(point.y) &&
  Number.isFinite(point.z);

function axes(yaw: number, tilt: number) {
  const s = Math.sin(yaw * radians),
    c = Math.cos(yaw * radians),
    st = Math.sin(tilt * radians),
    ct = Math.cos(tilt * radians);
  return {
    forward: { x: s * ct, y: -st, z: -c * ct },
    right: { x: c, y: 0, z: s },
    up: { x: s * st, y: ct, z: -c * st },
  };
}

/** A unit ray in absolute world coordinates; callers may rebase for rendering. */
export function commandScreenRay(
  pose: Pick<CameraPose, "position" | "yaw" | "tilt">,
  cursor: CameraCursor,
): { origin: Point; direction: Point } {
  const { forward, right, up } = axes(pose.yaw, pose.tilt),
    height = Math.max(1, cursor.height),
    width = Math.max(1, cursor.width),
    x = ((2 * cursor.x) / width - 1) * tangent * (width / height),
    y = (1 - (2 * cursor.y) / height) * tangent,
    dx = forward.x + right.x * x + up.x * y,
    dy = forward.y + right.y * x + up.y * y,
    dz = forward.z + right.z * x + up.z * y,
    length = Math.hypot(dx, dy, dz);
  return {
    origin: { ...pose.position },
    direction: { x: dx / length, y: dy / length, z: dz / length },
  };
}

/** Returns null behind the eye; useful to consumers as well as math acceptance. */
export function commandProject(
  pose: Pick<CameraPose, "position" | "yaw" | "tilt">,
  point: Point,
  viewport: Pick<CameraCursor, "width" | "height">,
): { x: number; y: number } | null {
  const { forward, right, up } = axes(pose.yaw, pose.tilt),
    relative = {
      x: point.x - pose.position.x,
      y: point.y - pose.position.y,
      z: point.z - pose.position.z,
    },
    dot = (a: Point) => relative.x * a.x + relative.y * a.y + relative.z * a.z,
    depth = dot(forward);
  if (depth <= 1e-8) return null;
  const scale = Math.max(1, viewport.height) / (2 * tangent * depth);
  return {
    x: viewport.width / 2 + dot(right) * scale,
    y: viewport.height / 2 - dot(up) * scale,
  };
}

/** Pure controller. The input owner supplies seconds and handles focus/capture. */
export class CommandCamera implements CameraPose {
  focus: Point;
  position: Point = { x: 0, y: 0, z: 0 };
  distance: number;
  requestedDistance: number;
  yaw: number;
  tilt = 35;
  tiltOffset: number;
  cutHeight: number;
  readonly fov = COMMAND_CAMERA.fov;
  readonly settings: CommandSettings;
  transition: CameraTransition | null = null;
  private groundY: number;
  /** Absolute focus floor left by clearance; releases at no more than d m/s. */
  private safetyY = -Infinity;
  private clearanceOffset = 0;
  private zoomAnchor: Anchor | null = null;
  private grab: Anchor | null = null;
  private panVelocity = { x: 0, y: 0 };
  private edge = { x: 0, y: 0, seconds: 0 };
  private turning: TurnAnimation | null = null;
  private resetting: { yaw: number; offset: number; elapsed: number } | null =
    null;
  private gliding: { from: Point; to: Point } | null = null;
  private modeTilt: { from: number } | null = null;
  private followed: (() => FollowTarget | null) | null = null;
  private orbitPress: {
    start: CameraCursor;
    last: CameraCursor;
    timeMs: number;
    moved: boolean;
    dragging: boolean;
  } | null = null;

  constructor(
    private readonly environment: CommandEnvironment,
    initial: Partial<CommandView> = {},
    settings: Partial<CommandSettings> = {},
  ) {
    this.focus = { ...(initial.focus ?? { x: 0, y: 0, z: 0 }) };
    this.groundY = this.focus.y;
    this.distance = clamp(
      initial.distance ?? 80,
      COMMAND_CAMERA.minDistance,
      COMMAND_CAMERA.maxDistance,
    );
    this.requestedDistance = this.distance;
    this.yaw = initial.yaw ?? 0;
    this.tiltOffset = initial.tiltOffset ?? 0;
    this.cutHeight = initial.cutHeight ?? Infinity;
    this.settings = {
      smoothing: 0.4,
      pan: 1,
      zoom: 1,
      cursorZoom: true,
      invertTilt: false,
      edgePan: true,
      reducedMotion: false,
      ...settings,
    };
    this.clampFocus();
    this.place(0);
  }

  get isFollowing(): boolean {
    return this.followed !== null;
  }

  get dragging(): boolean {
    return this.grab !== null || this.orbitPress?.dragging === true;
  }

  /** A copy: debug consumers cannot mutate an in-flight anchor or saved view. */
  get anchor(): { point: Point; limited: boolean } | null {
    const anchor = this.grab ?? this.zoomAnchor;
    return anchor
      ? { point: { ...anchor.point }, limited: anchor.limited }
      : null;
  }

  snapshot(): CommandView {
    return {
      focus: { ...this.focus },
      distance: this.distance,
      yaw: this.yaw,
      tiltOffset: this.tiltOffset,
      cutHeight: this.cutHeight,
    };
  }

  /** The ray fallback is bounded even when an adapter returns a stale/hidden hit. */
  groundPoint(cursor: CameraCursor): Point {
    const ray = commandScreenRay(this, cursor),
      limit = 4 * this.distance,
      hit = this.environment.raycast?.(
        ray.origin,
        ray.direction,
        limit,
        this.cutHeight,
      );
    if (
      hit &&
      finitePoint(hit) &&
      hit.y <= this.cutHeight + 1e-6 &&
      distanceBetween(hit, ray.origin) <= limit + 1e-6
    )
      return { ...hit };
    return fallbackRay(ray.origin, ray.direction, this.focus.y, this.distance);
  }

  wheel(delta: number, mode: number, cursor?: CameraCursor): void {
    this.zoom(wheelFactor(delta, mode), cursor);
  }

  /** A browser gesture scale > 1 means fingers spread: zoom in. */
  pinch(scale: number, cursor?: CameraCursor): void {
    if (scale > 0 && Number.isFinite(scale)) this.zoom(1 / scale, cursor);
  }

  zoom(factor: number, cursor?: CameraCursor): void {
    if (!(factor > 0) || !Number.isFinite(factor)) return;
    this.setZoomAnchor(cursor);
    // Sensitivity acts on log travel after the per-event 1.25 cap (C1/B1).
    this.requestedDistance = clamp(
      this.requestedDistance *
        Math.exp(Math.log(clamp(factor, 0.8, 1.25)) * this.settings.zoom),
      COMMAND_CAMERA.minDistance,
      COMMAND_CAMERA.maxDistance,
    );
    if (this.settings.smoothing <= 0) {
      this.distance = this.requestedDistance;
      this.place(0);
    }
  }

  orbit(dx: number, dy: number): void {
    this.turning = null;
    this.resetting = null;
    this.zoomAnchor = null;
    this.yaw -= dx * 0.25;
    const curve = commandTilt(this.distance);
    this.tiltOffset = clamp(
      this.tiltOffset + dy * (this.settings.invertTilt ? 0.2 : -0.2),
      20 - curve,
      89 - curve,
    );
    this.place(0);
  }

  beginOrbit(cursor: CameraCursor, timeMs: number): void {
    this.orbitPress = {
      start: { ...cursor },
      last: { ...cursor },
      timeMs,
      moved: false,
      dragging: false,
    };
  }

  moveOrbit(cursor: CameraCursor, timeMs: number): boolean {
    const press = this.orbitPress;
    if (!press) return false;
    press.moved ||=
      Math.hypot(cursor.x - press.start.x, cursor.y - press.start.y) > 6;
    if (press.moved && timeMs - press.timeMs >= 120) press.dragging = true;
    if (!press.dragging) return false;
    this.orbit(cursor.x - press.last.x, cursor.y - press.last.y);
    press.last = { ...cursor };
    return true;
  }

  /** Release reports a click, never an order: the input/selection owner decides. */
  endOrbit(cursor: CameraCursor, timeMs: number): { click: boolean } {
    const press = this.orbitPress;
    if (!press) return { click: false };
    this.moveOrbit(cursor, timeMs);
    this.orbitPress = null;
    return { click: !press.moved && !press.dragging };
  }

  beginGrab(cursor: CameraCursor): void {
    this.cancelMotion();
    this.followed = null;
    this.grab = {
      point: this.groundPoint(cursor),
      cursor: { ...cursor },
      limited: false,
    };
    this.groundY = this.focus.y;
  }

  moveGrab(cursor: CameraCursor): void {
    if (!this.grab) return;
    this.grab = { ...this.grab, cursor: { ...cursor } };
    this.place(0);
  }

  endGrab(): void {
    this.grab = null;
    this.panVelocity = { x: 0, y: 0 };
  }

  /** Blur, pointercancel, and loss of world key ownership must call this. */
  release(): void {
    this.grab = null;
    this.orbitPress = null;
    this.panVelocity = { x: 0, y: 0 };
    this.edge = { x: 0, y: 0, seconds: 0 };
    this.zoomAnchor = null;
  }

  tapTurn(direction: number, startYaw = this.yaw): void {
    if (!direction) return;
    const units = startYaw / 45,
      to =
        (direction > 0
          ? Math.floor(units + 1e-6) + 1
          : Math.ceil(units - 1e-6) - 1) * 45;
    this.resetting = null;
    this.zoomAnchor = null;
    if (this.settings.reducedMotion) {
      this.yaw = to;
      this.turning = null;
      this.fade("turn");
      this.place(0);
      return;
    }
    this.turning = { from: this.yaw, to, elapsed: 0 };
  }

  resetView(): void {
    this.turning = null;
    this.zoomAnchor = null;
    if (this.settings.reducedMotion) {
      this.yaw = 0;
      this.tiltOffset = 0;
      this.resetting = null;
      this.fade("reset");
      this.place(0);
      return;
    }
    this.resetting = {
      yaw: this.yaw,
      offset: this.tiltOffset,
      elapsed: 0,
    };
  }

  startFollowing(resolve: () => FollowTarget | null): void {
    this.cancelMotion();
    this.followed = resolve;
  }

  stopFollowing(): void {
    this.followed = null;
  }

  /** Minimap dragging moves directly; minimap clicks use jump(). */
  panTo(x: number, z: number): void {
    this.cancelMotion();
    this.followed = null;
    this.focus.x = x;
    this.focus.z = z;
    this.clampFocus();
    this.place(0);
  }

  jump(target: Point, options: CommandJump = {}): CameraTransition {
    const from = { ...this.focus },
      near = distanceBetween(from, target) < 3 * this.distance;
    this.cancelMotion();
    this.followed = null;
    this.safetyY = -Infinity;
    this.requestedDistance = clamp(
      options.distance ?? this.requestedDistance,
      COMMAND_CAMERA.minDistance,
      COMMAND_CAMERA.maxDistance,
    );
    this.yaw = options.yaw ?? this.yaw;
    this.tiltOffset = options.tiltOffset ?? this.tiltOffset;
    this.cutHeight = options.cutHeight ?? this.cutFor(target);
    const reduced = this.settings.reducedMotion,
      transition: CameraTransition = {
        kind: "jump",
        style: near && !reduced ? "glide" : "fade",
        durationMs: reduced ? 150 : near ? 250 : 120,
        focusDurationMs: near && !reduced ? 250 : 0,
        elapsedMs: 0,
      };
    this.transition = transition;
    if (transition.style === "glide") {
      this.gliding = { from, to: { ...target } };
    } else {
      this.focus = { ...target };
      this.groundY = target.y;
      this.clampFocus();
      this.place(0);
    }
    return { ...transition };
  }

  /** C5/C6: root supplies the active Overhead pose and the free body's feet. */
  enterFromOverhead(view: CameraPose, body: Point): CameraTransition {
    this.cancelMotion();
    this.followed = null;
    this.focus = { x: body.x, y: view.focus.y, z: body.z };
    this.groundY = view.focus.y;
    this.yaw = view.yaw;
    this.distance = clamp(
      view.distance,
      COMMAND_CAMERA.minDistance,
      COMMAND_CAMERA.maxDistance,
    );
    this.requestedDistance = this.distance;
    this.tiltOffset = 0;
    this.cutHeight = this.environment.blocks
      ? this.cutFor(body, view.position.y)
      : view.cutHeight;
    this.safetyY = -Infinity;
    this.clearanceOffset = 0;
    const reduced = this.settings.reducedMotion;
    this.transition = {
      kind: "mode",
      style: reduced ? "fade" : "glide",
      durationMs: reduced ? 150 : 400,
      focusDurationMs: 0,
      elapsedMs: 0,
    };
    this.modeTilt = reduced ? null : { from: view.tilt };
    this.clampFocus();
    this.place(0);
    return { ...this.transition };
  }

  /** C6: stand on the drawn floor/cap, not a remembered free-body location. */
  exitToOverhead(): {
    body: Point;
    yaw: number;
    cutHeight: number;
    from: CameraPose;
    transition: CameraTransition;
  } {
    this.cancelMotion();
    this.followed = null;
    return {
      body: {
        x: this.focus.x,
        y: this.surface(this.focus.x, this.focus.z),
        z: this.focus.z,
      },
      yaw: this.yaw,
      cutHeight: this.cutHeight,
      from: {
        focus: { ...this.focus },
        position: { ...this.position },
        distance: this.distance,
        yaw: this.yaw,
        tilt: this.tilt,
        cutHeight: this.cutHeight,
      },
      transition: {
        kind: "mode",
        style: this.settings.reducedMotion ? "fade" : "glide",
        durationMs: this.settings.reducedMotion ? 150 : 400,
        focusDurationMs: this.settings.reducedMotion ? 0 : 250,
        elapsedMs: 0,
      },
    };
  }

  /** Real elapsed time, independent of simulation pace. Zero only refreshes pose. */
  step(dt: number, input: CommandInput = {}): void {
    if (!Number.isFinite(dt) || dt < 0) return;
    const pan = this.panInput(dt, input),
      panning = pan.some((slice) => slice.x !== 0 || slice.y !== 0);
    if (panning) {
      this.followed = null;
      this.zoomAnchor = null;
      this.gliding = null;
      if (this.transition?.kind === "jump") this.transition = null;
    }
    if (input.zoom && !this.grab && !panning && !this.zoomAnchor)
      this.setZoomAnchor(input.cursor);
    // Only cheap control math substeps. Terrain/rays are sampled once per frame.
    for (const slice of pan) {
      const count = Math.max(1, Math.min(240, Math.ceil(slice.seconds * 120))),
        h = slice.seconds / count;
      for (let i = 0; i < count; i++) this.advanceControls(h, input, slice);
    }
    this.safetyY -= this.distance * dt;

    if (this.transition) {
      this.transition = {
        ...this.transition,
        elapsedMs: Math.min(
          this.transition.durationMs,
          this.transition.elapsedMs + dt * 1000,
        ),
      };
      if (this.gliding) {
        const t = timed(this.transition.elapsedMs / 250);
        this.focus = interpolate(this.gliding.from, this.gliding.to, t);
        this.groundY = this.focus.y;
      }
    }

    if (this.followed) {
      const target = this.followed();
      if (
        !target ||
        !target.alive ||
        !target.inCoverage ||
        (!target.owned && !target.visible)
      ) {
        this.followed = null;
      } else {
        this.focus.x = follow(
          this.focus.x,
          target.position.x,
          dt,
          COMMAND_CAMERA.followSeconds,
        );
        this.focus.z = follow(
          this.focus.z,
          target.position.z,
          dt,
          COMMAND_CAMERA.followSeconds,
        );
        this.groundY = follow(
          this.groundY,
          target.position.y,
          dt,
          COMMAND_CAMERA.followSeconds,
        );
      }
    } else if (!this.grab && !this.gliding) {
      this.groundY = descendLimited(
        this.groundY,
        this.groundHeight(),
        dt,
        this.distance,
      );
    }
    this.clampFocus();
    this.place(dt);
    if (
      this.transition &&
      this.transition.elapsedMs >= this.transition.durationMs - 1e-7
    ) {
      this.transition = null;
      this.gliding = null;
      this.modeTilt = null;
    }
    if (Math.abs(this.distance - this.requestedDistance) < 1e-7) {
      this.distance = this.requestedDistance;
      this.zoomAnchor = null;
    }
  }

  private advanceControls(
    dt: number,
    input: CommandInput,
    pan: { x: number; y: number },
  ): void {
    const smoothing = clamp(this.settings.smoothing, 0, 1) * 2.5;
    if (input.turn) {
      this.turning = null;
      this.resetting = null;
      this.zoomAnchor = null;
      this.yaw += clamp(input.turn, -1, 1) * 100 * dt;
    }
    if (this.turning) {
      this.turning.elapsed += dt;
      this.yaw =
        this.turning.from +
        (this.turning.to - this.turning.from) *
          timed(this.turning.elapsed / 0.18);
      if (this.turning.elapsed >= 0.18 - 1e-10) {
        this.yaw = this.turning.to;
        this.turning = null;
      }
    }
    if (this.resetting) {
      this.resetting.elapsed += dt;
      const t = timed(this.resetting.elapsed / 0.25),
        northDelta = ((((-this.resetting.yaw + 540) % 360) + 360) % 360) - 180;
      this.yaw = this.resetting.yaw + northDelta * t;
      this.tiltOffset = this.resetting.offset * (1 - t);
      if (this.resetting.elapsed >= 0.25 - 1e-10) {
        this.yaw = 0;
        this.tiltOffset = 0;
        this.resetting = null;
      }
    }
    if (input.zoom) {
      this.requestedDistance = clamp(
        this.requestedDistance *
          Math.exp(clamp(input.zoom, -1, 1) * 0.96 * this.settings.zoom * dt),
        COMMAND_CAMERA.minDistance,
        COMMAND_CAMERA.maxDistance,
      );
    }
    const previousDistance = this.distance;
    this.distance = smoothing
      ? follow(
          this.distance,
          this.requestedDistance,
          dt,
          COMMAND_CAMERA.zoomSeconds * smoothing,
        )
      : this.requestedDistance;
    if (this.grab) return;
    const previous = { ...this.panVelocity },
      targetLength = Math.hypot(pan.x, pan.y),
      ramp =
        (targetLength > 0
          ? COMMAND_CAMERA.panUpSeconds
          : COMMAND_CAMERA.panDownSeconds) * smoothing,
      dx = pan.x - previous.x,
      dy = pan.y - previous.y,
      difference = Math.hypot(dx, dy),
      portion =
        difference > 0 && ramp > 0 ? Math.min(1, dt / ramp / difference) : 1;
    this.panVelocity = {
      x: previous.x + dx * portion,
      y: previous.y + dy * portion,
    };
    const rampTime = Math.min(dt, difference * ramp),
      average = (before: number, after: number) =>
        dt > 0
          ? ((before + after) * 0.5 * rampTime + after * (dt - rampTime)) / dt
          : after,
      px = average(previous.x, this.panVelocity.x),
      py = average(previous.y, this.panVelocity.y),
      speed =
        ((previousDistance + this.distance) / 2) *
        this.settings.pan *
        (input.fast ? 2.5 : 1),
      yaw = this.yaw * radians;
    this.focus.x += (px * Math.cos(yaw) + py * Math.sin(yaw)) * speed * dt;
    this.focus.z += (px * Math.sin(yaw) - py * Math.cos(yaw)) * speed * dt;
    this.clampFocus();
  }

  private panInput(dt: number, input: CommandInput): PanSlice[] {
    const x = input.panX ?? 0,
      y = input.panY ?? 0,
      slice = (seconds: number, edgeX = 0, edgeY = 0): PanSlice => {
        const px = x + edgeX,
          py = y + edgeY,
          length = Math.max(1, Math.hypot(px, py));
        return { seconds, x: px / length, y: py / length };
      };
    const cursor = input.cursor;
    if (
      this.settings.edgePan &&
      input.fullscreen &&
      !input.overPanel &&
      !input.dragging &&
      !this.dragging &&
      cursor &&
      cursor.x >= 0 &&
      cursor.x <= cursor.width &&
      cursor.y >= 0 &&
      cursor.y <= cursor.height
    ) {
      const ex = cursor.x <= 8 ? -1 : cursor.x >= cursor.width - 8 ? 1 : 0,
        ey = cursor.y <= 8 ? 1 : cursor.y >= cursor.height - 8 ? -1 : 0;
      if (ex !== this.edge.x || ey !== this.edge.y)
        this.edge = { x: ex, y: ey, seconds: 0 };
      if (ex || ey) {
        const waiting = Math.min(dt, Math.max(0, 0.15 - this.edge.seconds)),
          active = dt - waiting;
        this.edge.seconds = Math.min(0.15, this.edge.seconds + dt);
        // Split at the dwell boundary rather than averaging the edge axis.
        // This preserves both full-frame key input and the linear pan ramps.
        if (active > 0) {
          const moving = slice(active, ex, ey);
          return waiting > 0 ? [slice(waiting), moving] : [moving];
        }
      }
    } else this.edge = { x: 0, y: 0, seconds: 0 };
    return [slice(dt)];
  }

  private setZoomAnchor(cursor?: CameraCursor): void {
    if (!cursor || !this.settings.cursorZoom || this.followed || this.grab) {
      this.zoomAnchor = null;
      return;
    }
    const point = this.groundPoint(cursor),
      distance = distanceBetween(point, this.focus),
      limit = 3 * this.distance,
      limited = distance > limit,
      anchor = limited
        ? interpolate(this.focus, point, limit / distance)
        : point,
      screen = limited ? commandProject(this, anchor, cursor) : cursor;
    this.zoomAnchor = screen
      ? {
          point: anchor,
          cursor: { ...cursor, x: screen.x, y: screen.y },
          limited,
        }
      : null;
  }

  private groundHeight(): number {
    const radius = Math.max(4, 0.05 * this.distance),
      average = this.environment.averagedGround?.(
        this.focus.x,
        this.focus.z,
        radius,
        this.cutHeight,
      );
    if (average !== undefined && Number.isFinite(average)) return average;
    let sum = this.surface(this.focus.x, this.focus.z);
    for (let ring = 1; ring <= 3; ring++) {
      const r = radius * Math.sqrt((ring - 0.5) / 3);
      for (let i = 0; i < 8; i++) {
        const angle = ((i + (ring % 2) * 0.5) * Math.PI) / 4;
        sum += this.surface(
          this.focus.x + Math.cos(angle) * r,
          this.focus.z + Math.sin(angle) * r,
        );
      }
    }
    return sum / 25;
  }

  private surface(x: number, z: number): number {
    const height = this.environment.surface(x, z, this.cutHeight);
    return Number.isFinite(height) ? height : this.groundY;
  }

  private place(dt: number): void {
    this.focus.y = this.groundY;
    let desired = commandTilt(this.distance, this.tiltOffset);
    if (this.modeTilt && this.transition) {
      desired =
        this.modeTilt.from +
        (desired - this.modeTilt.from) * timed(this.transition.elapsedMs / 400);
    }
    const candidate = (tilt: number): Point => {
      const forward = axes(this.yaw, tilt).forward;
      return {
        x: this.focus.x - forward.x * this.distance,
        y: this.focus.y - forward.y * this.distance,
        z: this.focus.z - forward.z * this.distance,
      };
    };
    let required = desired,
      position = candidate(required);
    // Bounded search; sampled height is retained for this pose, not queried twice.
    while (
      position.y <
        this.surface(position.x, position.z) + COMMAND_CAMERA.clearance &&
      required < 89
    ) {
      required = Math.min(89, required + 3);
      position = candidate(required);
    }
    this.clearanceOffset = follow(
      this.clearanceOffset,
      Math.max(0, required - desired),
      dt,
      COMMAND_CAMERA.clearanceSeconds,
    );
    this.tilt = clamp(desired + this.clearanceOffset, 20, 89);
    // Find the needed tilt against the ground follower above, then retain any
    // earlier safety lift in the displayed pose until its descent budget allows.
    this.focus.y = Math.max(this.groundY, this.safetyY);
    const anchor = this.grab ?? this.zoomAnchor;
    if (anchor) this.solveAnchor(anchor);
    this.clampFocus();
    position = candidate(this.tilt);
    // While the safety tilt eases, lift immediately: safety is a hard invariant.
    // Re-solve a feasible anchor after each lift. Bounds/clearance outrank an
    // impossible anchor at a cliff/edge, with a final bounded hard-floor pass.
    let lifted = false;
    for (let i = 0; i < 8; i++) {
      const lift =
        this.surface(position.x, position.z) +
        COMMAND_CAMERA.clearance -
        position.y;
      if (lift <= 1e-7) break;
      lifted = true;
      this.focus.y += lift;
      if (anchor && i < 7) this.solveAnchor(anchor);
      this.clampFocus();
      position = candidate(this.tilt);
    }
    const finalLift = Math.max(
      0,
      this.surface(position.x, position.z) +
        COMMAND_CAMERA.clearance -
        position.y,
    );
    this.focus.y += finalLift;
    position.y += finalLift;
    if (lifted || finalLift > 0)
      this.safetyY = Math.max(this.safetyY, this.focus.y);
    this.position = position;
  }

  private solveAnchor(anchor: Anchor): void {
    const forward = axes(this.yaw, this.tilt).forward,
      offset = {
        x: -forward.x * this.distance,
        y: -forward.y * this.distance,
        z: -forward.z * this.distance,
      },
      ray = commandScreenRay(this, anchor.cursor).direction;
    let t = (anchor.point.y - this.focus.y - offset.y) / ray.y;
    if (!Number.isFinite(t) || t <= 0) {
      // No forward intersection exists at this height. Keep the held ground
      // height and any safety lift; an infeasible sky anchor cannot lower them.
      // Use finite horizontal travel until the ray can reach the anchor again.
      t = this.distance;
    }
    this.focus.x = anchor.point.x - offset.x - ray.x * t;
    this.focus.z = anchor.point.z - offset.z - ray.z * t;
  }

  private clampFocus(): void {
    const length = Math.hypot(this.focus.x, this.focus.z);
    if (length <= COMMAND_CAMERA.worldRadius) return;
    const factor = COMMAND_CAMERA.worldRadius / length;
    this.focus.x *= factor;
    this.focus.z *= factor;
  }

  private cutFor(
    target: Point,
    cameraY = target.y +
      Math.sin(commandTilt(this.requestedDistance, this.tiltOffset) * radians) *
        this.requestedDistance,
  ): number {
    if (!this.environment.blocks) return Infinity;
    const x = Math.floor(target.x),
      z = Math.floor(target.z);
    // C2 uses only the destination's own column. C4's 3x3 AutomaticCut remains
    // unchanged for Overhead; an adjacent low roof must not lower this cut.
    for (let y = Math.ceil(target.y + 1.8); y < cameraY; y++) {
      const id = this.environment.blocks(x, y, z);
      if (id !== Block.Leaves && BLOCK_REGISTRY[id]?.solid) return y - 0.5;
    }
    return Infinity;
  }

  private cancelMotion(): void {
    this.release();
    this.transition = null;
    this.gliding = null;
    this.modeTilt = null;
    this.turning = null;
    this.resetting = null;
  }

  private fade(kind: "turn" | "reset"): void {
    this.gliding = null;
    this.modeTilt = null;
    this.transition = {
      kind,
      style: "fade",
      durationMs: 150,
      focusDurationMs: 0,
      elapsedMs: 0,
    };
  }
}

function interpolate(from: Point, to: Point, t: number): Point {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    z: from.z + (to.z - from.z) * t,
  };
}

function timed(progress: number): number {
  return progress <= 0 ? 0 : progress >= 1 ? 1 : ease("ease-camera", progress);
}

/** Exact solution of the capped descending first-order follower for a fixed floor. */
function descendLimited(
  value: number,
  target: number,
  dt: number,
  speed: number,
) {
  if (target >= value)
    return follow(value, target, dt, COMMAND_CAMERA.groundSeconds);
  const linearSeconds = Math.max(
    0,
    (value - target - speed * COMMAND_CAMERA.groundSeconds) / speed,
  );
  if (dt <= linearSeconds) return value - speed * dt;
  return follow(
    value - speed * linearSeconds,
    target,
    dt - linearSeconds,
    COMMAND_CAMERA.groundSeconds,
  );
}
