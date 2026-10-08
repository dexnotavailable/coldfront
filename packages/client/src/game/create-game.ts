import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import { WORLDGEN_VERSION } from "../../../shared/src/worldgen/version.js";
import type {
  CompassId,
  FlySpeed,
  GameCommand,
  GameEvent,
  GamePort,
  GameSnapshot,
  HotbarIndex,
  InputScope,
  ToolState,
} from "../contracts/game-ui.js";
import { ChunkStore } from "../engine/chunk-store.js";
import { blockIcon } from "../engine/effects.js";
import { GameClocks } from "../engine/motion.js";
import { type WorldColors, WorldRenderer } from "../engine/renderer.js";
import { chunkKey, type VoxelEdit } from "../engine/worker-protocol.js";
import { WORLD_BUTTONS, WORLD_CODES } from "./bindings.js";
import { OverheadCamera } from "./camera.js";
import {
  type BodyState,
  intersectsBody,
  makeBody,
  PHYSICS,
  stepBody,
} from "./controller.js";
import { FLY_SPEEDS, WorldInput } from "./input.js";
import { EditPersistence } from "./persistence.js";
import {
  actionRay,
  type BlockHit,
  fallbackRay,
  type Point,
  raycast,
} from "./raycast.js";

export interface GameOptions {
  readonly colors: WorldColors;
  readonly keyboardLocked: () => boolean;
  readonly onWindowedSprint: () => void;
  readonly build: { readonly version: string; readonly commit: string };
  /** Root injects the worldgen+registry source hash at build time. */
  readonly cacheTag: string;
  readonly externalKeyboard?: boolean;
  readonly postcard?: {
    readonly position: Point;
    readonly target: Point;
    readonly hours: number;
    readonly radius?: number;
  };
}
export interface GameTelemetry {
  readonly camera: Readonly<{
    position: Point;
    focus: Point;
    distance: number;
    requestedDistance: number;
    yaw: number;
    tilt: number;
    chosenTilt: number;
    cut: number | null;
    fov: number;
  }>;
  readonly body: Readonly<BodyState>;
  readonly target: BlockHit | null;
  readonly ghost: Point | null;
  readonly loaded: number;
  readonly queued: number;
  readonly ready: boolean;
  readonly displayTimeMs: number;
  readonly editCount: number;
  readonly lastEdit: VoxelEdit | null;
  readonly lastAction: Readonly<{
    type: "place" | "break";
    displayTimeMs: number;
    position: Point;
    block: number;
  }> | null;
  readonly worldTimeSeconds: number;
  readonly rendered: Readonly<{
    outline: boolean;
    silhouette: boolean;
    ghost: boolean;
  }>;
}
export interface GameHandle {
  readonly port: GamePort;
  readonly telemetry: () => GameTelemetry;
  readonly ready: () => Promise<void>;
  readonly renderStill: (displayTimeMs?: number) => Promise<Blob>;
  readonly input: {
    keydown(event: KeyboardEvent): void;
    keyup(event: KeyboardEvent): void;
    blur(): void;
    cancelDrag(): boolean;
  };
}
const initialTools = (): ToolState => ({
  timeHours: 12,
  clockRuns: true,
  fog: true,
  shadows: true,
  chunkBorders: false,
  wireframe: false,
  flying: false,
  flySpeed: 1,
});
const compass: readonly CompassId[] = [
  "compass.n",
  "compass.ne",
  "compass.e",
  "compass.se",
  "compass.s",
  "compass.sw",
  "compass.w",
  "compass.nw",
];

/** Shell-facing API; the shell never receives any renderer objects. */
export function createGame(
  canvas: HTMLCanvasElement,
  options: GameOptions,
): GamePort {
  return createGameHandle(canvas, options).port;
}
/** Harness gets readonly telemetry and a frozen still renderer, never camera setters. */
export function createGameHandle(
  canvas: HTMLCanvasElement,
  options: GameOptions,
): GameHandle {
  const runtime = new GameRuntime(canvas, options);
  return {
    port: runtime,
    telemetry: () => runtime.telemetry(),
    ready: () => runtime.whenReady(),
    renderStill: (time) => runtime.renderStill(time),
    input: {
      keydown: (event) => runtime.keydown(event),
      keyup: (event) => runtime.keyup(event),
      blur: () => runtime.releaseInput(),
      cancelDrag: () => runtime.cancelDrag(),
    },
  };
}
class GameRuntime implements GamePort {
  private readonly listeners = new Set<(event: GameEvent) => void>();
  private renderer: WorldRenderer | null = null;
  private store: ChunkStore | null = null;
  private readonly persistence: EditPersistence;
  private input: WorldInput;
  private readonly clocks = new GameClocks();
  private camera = new OverheadCamera();
  private body = makeBody();
  private previous = makeBody();
  private tools = initialTools();
  private slots: (number | null)[] = [
    Block.Grass,
    Block.Dirt,
    Block.Stone,
    Block.Log,
    Block.Leaves,
    Block.Sand,
    Block.DeepStone,
    null,
    null,
  ];
  private selected: HotbarIndex = 0;
  private lifecycle: GameSnapshot["lifecycle"] = "idle";
  private graphics: GameSnapshot["graphics"] = "available";
  private seed = 1;
  private revision = 0;
  private loadProgress = 0;
  private scope: InputScope = "inactive";
  private mode: "overhead" | "postcard" = "overhead";
  private target: BlockHit | null = null;
  private ghost: Point | null = null;
  private aim: Point = { x: 0, y: 6, z: -5 };
  private occluded = false;
  private actionRecord: GameTelemetry["lastAction"] = null;
  private hud = true;
  private stopped = false;
  private session = 0;
  private frame = 0;
  private lastFrame = 0;
  private accumulator = 0;
  private snapshotTime = 0;
  private tick = 0;
  private lastBreak = -100;
  private lastPlace = -100;
  private lastView = "";
  private frames: { t: number; dt: number }[] = [];
  private promise: Promise<void> = Promise.resolve();
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: GameOptions,
  ) {
    this.persistence = new EditPersistence(
      `${WORLDGEN_VERSION}:${options.cacheTag}`,
    );
    this.input = this.makeInput();
  }
  private makeInput(): WorldInput {
    return new WorldInput(
      this.canvas,
      {
        camera: this.camera,
        keyboardLocked: this.options.keyboardLocked,
        windowed: this.options.onWindowedSprint,
        select: (index) => this.apply({ type: "select-slot", index }),
        pick: () => this.pick(),
        toggleFly: () =>
          this.apply({
            type: "set-tool",
            key: "flying",
            value: !this.tools.flying,
          }),
        speed: (delta) => {
          const current = FLY_SPEEDS.indexOf(this.tools.flySpeed);
          this.apply({
            type: "set-fly-speed",
            value: FLY_SPEEDS[
              Math.max(0, Math.min(4, current + delta))
            ] as FlySpeed,
          });
        },
      },
      this.options.externalKeyboard ?? false,
    );
  }
  keydown(event: KeyboardEvent): void {
    this.input.keydown(event);
  }
  keyup(event: KeyboardEvent): void {
    this.input.keyup(event);
  }
  releaseInput(): void {
    this.input.release();
  }
  cancelDrag(): boolean {
    return this.input.cancelDrag();
  }
  read(): GameSnapshot {
    const stats = this.renderer?.statistics ?? {
        draws: 0,
        triangles: 0,
        memory: 0,
      },
      light =
        this.store?.lightAt(
          Math.floor(this.body.x),
          Math.floor(this.body.y + 0.1),
          Math.floor(this.body.z),
        ) ?? 0;
    const facing = compass[
      ((Math.round(this.body.headYaw / (Math.PI / 4)) % 8) + 8) % 8
    ] as CompassId;
    return {
      revision: this.revision,
      lifecycle: this.lifecycle,
      loadProgress: this.loadProgress,
      seed: this.seed,
      mode: this.mode,
      worldPaused: this.clocks.paused,
      tools: { ...this.tools, timeHours: this.clocks.hours },
      hotbar: {
        slots: [...this.slots],
        selected: this.selected,
        itemName:
          this.slots[this.selected] == null
            ? null
            : (BLOCK_REGISTRY[this.slots[this.selected] as number]?.name ??
              null),
      },
      blocks: BLOCK_REGISTRY.filter(
        (b) => b.id !== Block.Air && b.breakable,
      ).map((b) => ({
        id: b.id,
        name: b.name,
        regionId: "test",
        icon: blockIcon(b.id),
      })),
      storage: this.persistence.blocked ? "blocked" : "available",
      graphics: this.graphics,
      debug:
        this.lifecycle === "ready"
          ? {
              feet: [this.body.x, this.body.y, this.body.z],
              facing,
              pitchDegrees: this.camera.tilt,
              chunk: [
                Math.floor(this.body.x / 32),
                Math.floor(this.body.y / 32),
                Math.floor(this.body.z / 32),
              ],
              skyLight: light >>> 12,
              blockLight: [(light >>> 8) & 15, (light >>> 4) & 15, light & 15],
              fps: this.frames.length
                ? 1000 /
                  (this.frames.reduce((n, f) => n + f.dt, 0) /
                    this.frames.length)
                : 0,
              slowestFrameMs: this.frames.reduce(
                (n, f) => Math.max(n, f.dt),
                0,
              ),
              drawCalls: stats.draws,
              triangles: stats.triangles,
              trackedMemoryBytes: (this.store?.memoryBytes ?? 0) + stats.memory,
              queues: this.store
                ? {
                    ...this.store.workers.queues,
                    mesh:
                      this.store.workers.queues.mesh +
                      this.store.uploads.length,
                  }
                : { generate: 0, light: 0, mesh: 0 },
              seed: this.seed,
              build: this.options.build,
            }
          : null,
    };
  }
  subscribe(listener: (event: GameEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private emit(event: GameEvent): void {
    for (const listener of this.listeners) listener(event);
  }
  private publish(): void {
    this.revision++;
    this.emit({ type: "snapshot", snapshot: this.read() });
  }
  apply(command: GameCommand): void {
    switch (command.type) {
      case "start":
        this.promise = this.start(command.seed);
        break;
      case "quit":
        this.promise = this.quit();
        break;
      case "pause":
        this.clocks.paused = command.paused;
        this.input.release();
        break;
      case "input-scope":
        this.scope = command.scope;
        this.input.setScope(command.scope);
        break;
      case "set-time":
        this.clocks.setHours(command.hours);
        break;
      case "set-tool":
        this.tools = { ...this.tools, [command.key]: command.value };
        if (command.key === "clockRuns") this.clocks.runs = command.value;
        if (command.key === "flying") this.body.vy = 0;
        break;
      case "set-fly-speed":
        if (FLY_SPEEDS.includes(command.value)) {
          this.tools = { ...this.tools, flySpeed: command.value };
          this.emit({ type: "fly-speed-changed", value: command.value });
        }
        break;
      case "select-slot":
        this.selected = command.index;
        this.itemChanged();
        break;
      case "assign-block":
        if (BLOCK_REGISTRY[command.blockId]?.breakable) {
          this.slots[command.index] = command.blockId;
          this.selected = command.index;
          this.itemChanged();
        }
        break;
      case "hud-visible":
        this.hud = command.visible;
        this.renderer?.setHud(command.visible);
        break;
      case "postcard":
        this.promise = this.setPostcard(command.active);
        break;
      case "clear-edits":
        this.promise = this.clear(command.seed);
        break;
    }
    this.publish();
  }
  private itemChanged(): void {
    this.emit({
      type: "item-changed",
      blockId: this.slots[this.selected] ?? null,
      displayTimeMs: this.clocks.displayMs,
    });
  }
  private async start(seed: number): Promise<void> {
    const session = ++this.session;
    cancelAnimationFrame(this.frame);
    this.store?.dispose();
    this.store = null;
    this.input.dispose();
    this.camera = new OverheadCamera();
    this.input = this.makeInput();
    this.input.setScope(this.scope);
    this.lifecycle = "loading";
    this.seed = seed >>> 0;
    this.loadProgress = 0;
    this.body = makeBody();
    this.previous = { ...this.body };
    this.clocks.setHours(this.options.postcard?.hours ?? 12);
    this.clocks.paused = false;
    this.clocks.displayMs = 0;
    this.tools = initialTools();
    this.lastView = "";
    this.tick = 0;
    this.lastFrame = 0;
    this.accumulator = 0;
    this.publish();
    try {
      if (!this.renderer)
        this.renderer = new WorldRenderer(this.canvas, this.options.colors);
      this.graphics = "available";
      this.renderer.onLost = () => {
        this.graphics = "lost";
        this.input.release();
        this.publish();
      };
      this.renderer.onRestored = () => {
        this.graphics = "rebuilding";
        this.emit({ type: "graphics-rebuilding" });
        this.rebuildGraphics();
      };
      await this.persistence.open();
      const saved = await this.persistence.load(this.seed);
      if (this.persistence.blocked) this.emit({ type: "storage-blocked" });
      if (session !== this.session) return;
      const store = new ChunkStore(this.seed, saved);
      this.store = store;
      store.onFailure = (error) => {
        console.error(error);
        this.lifecycle = "failed";
        this.publish();
      };
      const postcard = this.options.postcard;
      if (postcard) {
        this.mode = "postcard";
        this.renderer.setPostcard(true);
        this.renderer.setView(postcard.position, postcard.target);
      } else {
        this.mode = "overhead";
        this.renderer.setPostcard(false);
        this.renderer.setView(this.camera.position, this.camera.focus);
      }
      let complete = false;
      const pending = store
        .requestView(
          postcard?.target.x ?? 0,
          postcard?.target.y ?? 6,
          postcard?.target.z ?? 0,
          postcard?.radius ?? 96,
        )
        .then(() => {
          complete = true;
        });
      while (
        !complete &&
        session === this.session &&
        this.read().lifecycle !== "failed"
      ) {
        this.upload(8);
        const finished = [...store.chunks.values()].filter(
          (c) => c.result,
        ).length;
        this.loadProgress = Math.max(
          this.loadProgress,
          0.05 + (0.8 * finished) / Math.max(1, store.chunks.size),
        );
        this.publish();
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
      }
      await pending;
      if (session !== this.session || this.read().lifecycle === "failed")
        return;
      while (store.uploads.length) {
        this.upload(postcard ? Infinity : 8);
        if (!postcard)
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
      }
      this.updatePicture(0);
      this.renderer.compile();
      this.renderer.render();
      this.renderer.render();
      this.lifecycle = "ready";
      this.loadProgress = 1;
      this.publish();
      if (!postcard) this.frame = requestAnimationFrame(this.animate);
    } catch (error) {
      console.error(error);
      this.lifecycle = "failed";
      if (error instanceof Error && error.message.includes("WebGL2"))
        this.graphics = "unavailable";
      this.publish();
    }
  }
  private upload(limit: number): void {
    if (!this.store || !this.renderer) return;
    // Keep the old neighbour faces behind a shrinking pop until its100ms finish.
    // Collision/edit data already changed; this prevents holes when the mesher
    // has culled the supporting ground against the newly placed full-size cell.
    if (
      this.lifecycle === "ready" &&
      this.renderer.effects.placementActive(this.clocks.displayMs)
    )
      return;
    for (let i = 0; i < limit && this.store.uploads.length; i++) {
      const result = this.store.uploads.shift();
      if (!result) break;
      const stored = this.store.chunks.get(chunkKey(result.address));
      if (!stored || stored.revision !== result.revision) continue;
      this.renderer.upload(result);
      stored.state = "visible";
    }
  }
  private rebuildGraphics(): void {
    if (!this.renderer || !this.store) return;
    for (const chunk of this.store.chunks.values())
      if (chunk.result) this.renderer.upload(chunk.result);
    this.renderer.compile();
    this.renderer.render();
    this.graphics = "available";
    this.publish();
  }
  private animate = (now: number): void => {
    if (this.stopped || this.lifecycle !== "ready" || this.mode === "postcard")
      return;
    const elapsed = this.lastFrame ? now - this.lastFrame : 0;
    this.lastFrame = now;
    const dt = Math.min(0.25, elapsed / 1000);
    this.frames.push({ t: now, dt: elapsed });
    this.frames = this.frames.filter((f) => now - f.t <= 1000 && f.dt > 0);
    this.clocks.step(dt);
    this.tools = { ...this.tools, timeHours: this.clocks.hours };
    if (!this.clocks.paused && this.graphics === "available") {
      this.accumulator += dt;
      while (this.accumulator >= PHYSICS.tick) {
        this.fixedStep();
        this.accumulator -= PHYSICS.tick;
      }
      if (this.store)
        this.camera.step(
          dt,
          this.body,
          this.store.get,
          this.store.surface,
          this.input.turn,
          this.input.tilt,
        );
      this.renderer?.setView(this.camera.position, this.camera.focus);
    }
    this.upload(8);
    this.updatePicture(this.accumulator / PHYSICS.tick);
    this.renderer?.render();
    if (now - this.snapshotTime > 100) {
      this.snapshotTime = now;
      this.publish();
    }
    this.frame = requestAnimationFrame(this.animate);
  };
  private fixedStep(): void {
    if (!this.store) return;
    this.tick++;
    this.previous = { ...this.body };
    const active = this.scope === "world";
    const lookYaw = Math.atan2(
      this.aim.x - this.body.x,
      -(this.aim.z - this.body.z),
    );
    stepBody(
      this.body,
      {
        forward: active ? this.input.forward : 0,
        right: active ? this.input.right : 0,
        jump: active && this.input.held.has(WORLD_CODES.jump),
        sneak: active && this.input.held.has(WORLD_CODES.sneak),
        sprint: active && this.input.sprint,
        yaw: (this.camera.yaw * Math.PI) / 180,
        lookYaw,
        fly: this.tools.flying,
        flySpeed: this.tools.flySpeed,
      },
      this.store.get,
    );
    this.renderer?.avatar.step(this.body.stepRise, this.clocks.displayMs);
    this.updateTarget();
    if (
      active &&
      this.input.buttons.has(WORLD_BUTTONS.attack) &&
      this.tick - this.lastBreak >= 6
    ) {
      this.lastBreak = this.tick;
      this.breakBlock();
    }
    if (
      active &&
      this.input.buttons.has(WORLD_BUTTONS.use) &&
      this.tick - this.lastPlace >= 4
    ) {
      this.lastPlace = this.tick;
      this.placeBlock();
    }
    if (!this.input.buttons.has(WORLD_BUTTONS.attack)) this.lastBreak = -100;
    if (!this.input.buttons.has(WORLD_BUTTONS.use)) this.lastPlace = -100;
    const view = `${Math.floor(this.body.x / 16)},${Math.floor(this.body.y / 32)},${Math.floor(this.body.z / 16)},${Math.ceil(this.camera.distance / 64)}`;
    if (view !== this.lastView) {
      this.lastView = view;
      void this.store.requestView(
        this.body.x,
        this.body.y,
        this.body.z,
        Math.max(96, Math.min(224, this.camera.distance * 1.3)),
      );
      for (const key of this.store.evict(
        this.body.x,
        this.body.z,
        Math.max(192, this.camera.distance * 1.6),
      ))
        this.renderer?.remove(key);
    }
  }
  private updateTarget(): void {
    if (!this.store || !this.renderer) return;
    const eyes = {
      x: this.body.x,
      y: this.body.y + (this.body.sneaking ? PHYSICS.sneakEye : PHYSICS.eye),
      z: this.body.z,
    };
    const ray = this.renderer.pointerRay(
        this.input.pointer.x,
        this.input.pointer.y,
      ),
      cut = this.camera.cut.height;
    const cameraHit = raycast(
      this.store.get,
      ray.origin,
      ray.direction,
      this.camera.distance * 4,
      cut,
    );
    this.aim =
      cameraHit?.point ??
      fallbackRay(
        ray.origin,
        ray.direction,
        this.camera.focus.y,
        this.camera.distance,
      );
    this.target = this.input.pointer.inside
      ? actionRay(this.store.get, eyes, this.aim, cut)
      : null;
    this.ghost = null;
    const held = this.slots[this.selected];
    if (this.target && held) {
      const p = {
        x: this.target.x + this.target.normal.x,
        y: this.target.y + this.target.normal.y,
        z: this.target.z + this.target.normal.z,
      };
      if (
        p.y + 1 <= cut &&
        this.store.get(p.x, p.y, p.z) === Block.Air &&
        !intersectsBody(this.body, p.x, p.y, p.z)
      )
        this.ghost = p;
    }
    const origin = this.renderer.camera.position,
      target = { x: this.body.x, y: this.body.y + 1, z: this.body.z };
    const distance = Math.hypot(
      origin.x - target.x,
      origin.y - target.y,
      origin.z - target.z,
    );
    this.occluded =
      raycast(
        this.store.get,
        origin,
        {
          x: target.x - origin.x,
          y: target.y - origin.y,
          z: target.z - origin.z,
        },
        distance - 0.35,
        cut,
      ) !== null;
  }
  private updatePicture(alpha: number): void {
    if (!this.renderer) return;
    if (this.mode === "overhead") this.updateTarget();
    this.renderer.update(
      this.body,
      this.previous,
      alpha,
      this.clocks.displayMs,
      this.mode === "overhead" ? this.camera.cut.height : Infinity,
      { ...this.tools, timeHours: this.clocks.hours },
      this.target,
      this.ghost,
      this.slots[this.selected] ?? Block.Stone,
      this.occluded,
    );
  }
  private recordEdit(edit: VoxelEdit): void {
    if (!this.store) return;
    this.store.edit(edit);
    void this.persistence
      .save(this.seed, [...this.store.edits.values()])
      .then(() => {
        if (this.persistence.blocked) this.emit({ type: "storage-blocked" });
      });
  }
  private breakBlock(): void {
    const hit = this.target;
    if (!hit || !BLOCK_REGISTRY[hit.block]?.breakable) return;
    this.actionRecord = {
      type: "break",
      displayTimeMs: this.clocks.displayMs,
      position: { x: hit.x, y: hit.y, z: hit.z },
      block: hit.block,
    };
    this.recordEdit({ x: hit.x, y: hit.y, z: hit.z, block: Block.Air });
    this.renderer?.effects.broken(hit, hit.block, this.clocks.displayMs);
    this.renderer?.avatar.swing(this.clocks.displayMs);
  }
  private placeBlock(): void {
    const p = this.ghost,
      block = this.slots[this.selected];
    if (!p || !block) return;
    this.actionRecord = {
      type: "place",
      displayTimeMs: this.clocks.displayMs,
      position: { ...p },
      block,
    };
    this.recordEdit({ ...p, block });
    this.renderer?.effects.placed(p, block, this.clocks.displayMs);
    this.renderer?.avatar.swing(this.clocks.displayMs);
  }
  private pick(): void {
    if (!this.target || !BLOCK_REGISTRY[this.target.block]?.breakable) return;
    const index = this.slots.indexOf(this.target.block);
    this.apply(
      index >= 0
        ? { type: "select-slot", index: index as HotbarIndex }
        : {
            type: "assign-block",
            index: this.selected,
            blockId: this.target.block,
          },
    );
  }
  private async setPostcard(active: boolean): Promise<void> {
    if (!this.renderer || !this.store || this.lifecycle !== "ready") return;
    this.input.release();
    this.mode = active ? "postcard" : "overhead";
    this.renderer.setPostcard(active);
    if (active) {
      cancelAnimationFrame(this.frame);
      await this.store.requestView(
        this.body.x,
        this.body.y,
        this.body.z,
        Math.max(96, this.camera.distance * 1.3),
      );
      await this.store.settled();
      this.upload(Infinity);
      this.updatePicture(1);
      this.renderer.compile();
      this.renderer.render();
      this.renderer.render();
    } else {
      this.lastFrame = 0;
      this.frame = requestAnimationFrame(this.animate);
    }
    this.publish();
  }
  private async clear(seed: number): Promise<void> {
    if (seed !== this.seed) {
      this.emit({ type: "clear-edits-finished", seed, ok: false });
      return;
    }
    const ok = await this.persistence.clear(seed);
    if (this.store) this.store.edits.clear();
    await this.start(seed);
    this.emit({
      type: "clear-edits-finished",
      seed,
      ok: ok && this.lifecycle === "ready",
    });
  }
  private async quit(): Promise<void> {
    ++this.session;
    cancelAnimationFrame(this.frame);
    this.input.release();
    if (this.store)
      await this.persistence.save(this.seed, [...this.store.edits.values()]);
    this.store?.dispose();
    this.store = null;
    this.renderer?.dispose();
    this.renderer = null;
    this.lifecycle = "idle";
    this.mode = "overhead";
    this.publish();
  }
  whenReady(): Promise<void> {
    return this.promise;
  }
  async capturePng(): Promise<Blob> {
    if (!this.renderer || this.lifecycle !== "ready")
      throw new Error("World is not ready for capture");
    return this.renderer.capturePng();
  }
  async renderStill(displayTimeMs?: number): Promise<Blob> {
    await this.promise;
    if (!this.renderer || !this.store || this.lifecycle !== "ready")
      throw new Error("Still capture requires a ready world");
    if (displayTimeMs !== undefined) {
      cancelAnimationFrame(this.frame);
      this.clocks.displayMs = displayTimeMs;
    }
    await this.store.settled();
    this.upload(Infinity);
    this.updatePicture(1);
    return this.renderer.capturePng();
  }
  telemetry(): GameTelemetry {
    const position = this.renderer?.camera.position ?? this.camera.position;
    const focus =
      this.mode === "postcard" && this.options.postcard
        ? this.options.postcard.target
        : this.camera.focus;
    const dx = focus.x - position.x,
      dy = focus.y - position.y,
      dz = focus.z - position.z;
    return Object.freeze({
      camera: Object.freeze({
        position: { x: position.x, y: position.y, z: position.z },
        focus: { ...focus },
        distance: Math.hypot(dx, dy, dz),
        requestedDistance: this.camera.requestedDistance,
        yaw:
          this.mode === "postcard"
            ? (Math.atan2(dx, -dz) * 180) / Math.PI
            : this.camera.yaw,
        tilt:
          this.mode === "postcard"
            ? (-Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI
            : this.camera.tilt,
        chosenTilt: this.camera.chosenTilt,
        cut: Number.isFinite(this.camera.cut.height)
          ? this.camera.cut.height
          : null,
        fov: this.renderer?.camera.fov ?? 40,
      }),
      body: Object.freeze({ ...this.body }),
      target: this.target ? { ...this.target } : null,
      ghost: this.ghost ? { ...this.ghost } : null,
      loaded: this.store?.chunks.size ?? 0,
      queued: this.store?.queueSize ?? 0,
      ready: this.lifecycle === "ready",
      displayTimeMs: this.clocks.displayMs,
      editCount: this.store?.edits.size ?? 0,
      lastAction: this.actionRecord,
      lastEdit: this.store
        ? ([...this.store.edits.values()].at(-1) ?? null)
        : null,
      worldTimeSeconds: this.clocks.worldSeconds,
      rendered: {
        outline: this.hud && this.mode === "overhead" && this.target !== null,
        silhouette: this.hud && this.mode === "overhead" && this.occluded,
        ghost: this.hud && this.mode === "overhead" && this.ghost !== null,
      },
    });
  }
  async dispose(): Promise<void> {
    this.stopped = true;
    await this.quit();
    this.input.dispose();
    this.listeners.clear();
    await this.persistence.close();
  }
}
