import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import {
  type GenerationVariant,
  generationKey,
  generationVariant,
} from "../../../shared/src/world/generation-variant.js";
import type {
  SurfaceRegionId,
  WorldContext,
  WorldIdentity,
  WorldKind,
  WorldPlanData,
  XZ,
} from "../../../shared/src/world/types.js";
import { createWorldContext } from "../../../shared/src/world/world-context.js";
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
  MapFrame,
  MapPoint,
  MapPointRequest,
  MapRequest,
  TeleportRequest,
  TeleportResult,
  ToolState,
  WorldSession,
} from "../contracts/game-ui.js";
import { ChunkStore } from "../engine/chunk-store.js";
import { blockIcon } from "../engine/effects.js";
import { ease, GameClocks } from "../engine/motion.js";
import { PlanPreparation } from "../engine/prepare-plan.js";
import { type WorldColors, WorldRenderer } from "../engine/renderer.js";
import type { TerrainViewMode } from "../engine/terrain-material.js";
import {
  type Address,
  chunkKey,
  type VoxelEdit,
} from "../engine/worker-protocol.js";
import { WORLD_BUTTONS, WORLD_CODES } from "./bindings.js";
import { OverheadCamera } from "./camera.js";
import {
  type BodyState,
  intersectsBody,
  makeBody,
  PHYSICS,
  stepBody,
} from "./controller.js";
import { insideXZ, resolveDestination } from "./destination.js";
import { FLY_SPEEDS, WorldInput } from "./input.js";
import { EditPersistence } from "./persistence.js";
import type {
  PostcardId,
  PostcardRenderReport,
  PostcardView,
  WorldPostcard,
} from "./postcard.js";
import { parseTerrainViewMode, postcardPresentations } from "./postcard.js";
import {
  actionRay,
  type BlockHit,
  fallbackRay,
  type Point,
  raycast,
} from "./raycast.js";
import { NavigationGate, sameSession } from "./session.js";
import {
  type MapSamplingReport,
  mapFrame,
  regionAt,
  regionViewpoints,
  topRegions,
} from "./world-map.js";
import {
  insideFrame,
  type SavedPose,
  sameIdentity,
  worldKey,
} from "./world-save.js";

export interface GameOptions {
  readonly resolvePostcards?: (
    identity: WorldIdentity,
  ) => Promise<readonly WorldPostcard[]>;
  readonly initialViewMode?: TerrainViewMode;
  readonly generationVariant?: GenerationVariant;
  readonly colors: WorldColors;
  readonly keyboardLocked: () => boolean;
  readonly onWindowedSprint: () => void;
  readonly build: { readonly version: string; readonly commit: string };
  /** Root injects the worldgen+registry source hash at build time. */
  readonly cacheTag: string;
  readonly externalKeyboard?: boolean;
  /** The opaque map covers the canvas; simulation/clocks continue without hidden draws. */
  readonly worldVisible?: () => boolean;
  readonly postcard?: {
    readonly id?: PostcardId;
    readonly identity?: WorldIdentity;
    readonly position: Point;
    readonly target: Point;
    readonly hours: number;
    readonly radius?: number;
  };
}
export interface GameTelemetry {
  readonly postcard: PostcardRenderReport | null;
  readonly rendering: Readonly<{
    visible: boolean;
    animationRenders: number;
    hiddenFrames: number;
  }>;
  readonly mapReports: readonly Readonly<
    MapSamplingReport & { sessionId: number; requestId: number }
  >[];
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
  readonly renderPostcard: (camera: WorldPostcard) => Promise<Blob>;
  readonly input: {
    keydown(event: KeyboardEvent): void;
    keyup(event: KeyboardEvent): void;
    blur(): void;
    cancelDrag(): boolean;
  };
}
const initialTools = (viewMode: TerrainViewMode = "normal"): ToolState => ({
  viewMode,
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
/** Harness gets telemetry and frozen captures; the page only receives validated local postcard IDs. */
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
    renderPostcard: (camera) => runtime.renderPostcard(camera),
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
  private initialPostcardConsumed = false;
  private postcardView: GameOptions["postcard"] | null = null;
  private postcardReport: PostcardRenderReport | null = null;
  private postcards: readonly WorldPostcard[] = [];
  private target: BlockHit | null = null;
  private ghost: Point | null = null;
  private aim: Point = { x: 0, y: 6, z: -5 };
  private occluded = false;
  private actionRecord: GameTelemetry["lastAction"] = null;
  private hud = true;
  private stopped = false;
  private session = 0;
  private worldRequest = 0;
  private world: WorldSession | null = null;
  private loadStage: "plan" | "terrain" = "terrain";
  private readonly plans = new PlanPreparation();
  private readonly navigation = new NavigationGate();
  private mapSerial = 0;
  private readonly mapReports: (MapSamplingReport & {
    sessionId: number;
    requestId: number;
  })[] = [];
  private viewpoints: ReadonlyMap<SurfaceRegionId, XZ> = new Map();
  private discoveries = new Set<SurfaceRegionId>();
  private readonly discoveryMemory = new Map<string, Set<SurfaceRegionId>>();
  private lastRegion: SurfaceRegionId | null = null;
  private poseSavedAt = 0;
  private cameraTransition: {
    fromPosition: Point;
    fromFocus: Point;
    started: number;
    duration: number;
  } | null = null;
  private fade: Animation | null = null;
  private frame = 0;
  private lastFrame = 0;
  private animationRenders = 0;
  private hiddenFrames = 0;
  private accumulator = 0;
  private snapshotTime = 0;
  private tick = 0;
  private lastBreak = -100;
  private lastPlace = -100;
  private lastView = "";
  private frames: { t: number; dt: number }[] = [];
  private promise: Promise<void> = Promise.resolve();
  private transitions: Promise<void> = Promise.resolve();
  private pendingTransitions = 0;
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: GameOptions,
  ) {
    this.tools = initialTools(parseTerrainViewMode(options.initialViewMode));
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
    const lifecycle =
      this.pendingTransitions && this.lifecycle === "ready"
        ? "loading"
        : this.lifecycle;
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
      world: lifecycle === "ready" ? this.world : null,
      loadStage: this.loadStage,
      mapInfo:
        lifecycle === "ready" && this.store
          ? {
              bounds: { minX: -22528, minZ: -22528, maxX: 22528, maxZ: 22528 },
              regions: this.store.context.regions.map(
                ({ id, name, kanji, discoverySentence }) => ({
                  id,
                  name,
                  ...(kanji ? { kanji } : {}),
                  ...(discoverySentence ? { discoverySentence } : {}),
                }),
              ),
            }
          : null,
      revision: this.revision,
      lifecycle,
      loadProgress: this.loadProgress,
      seed: this.seed,
      mode: this.mode,
      postcards:
        lifecycle === "ready" ? postcardPresentations(this.postcards) : [],
      activePostcardId: this.postcardView?.id ?? null,
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
        lifecycle === "ready"
          ? {
              regionWeights: this.store
                ? topRegions(this.store.context, this.body.x, this.body.z)
                : [],
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
  /** A later session cannot overtake an earlier save/clear or its cleanup. */
  private transition(operation: () => Promise<void>): Promise<void> {
    this.pendingTransitions++;
    this.input.release();
    this.input.setScope("inactive");
    const next = this.transitions
      .then(operation)
      .catch((error: unknown) => {
        console.error(error);
        this.lifecycle = "failed";
      })
      .finally(() => {
        this.pendingTransitions--;
        this.input.setScope(this.pendingTransitions ? "inactive" : this.scope);
        this.publish();
        if (this.lifecycle === "ready" && this.pendingTransitions === 0)
          this.discoverRegion();
      });
    this.transitions = next;
    this.promise = next;
    return next;
  }
  apply(command: GameCommand): void {
    if (this.stopped) return;
    switch (command.type) {
      case "start": {
        const request = ++this.worldRequest;
        this.cancelNavigation();
        this.plans.cancel();
        this.transition(() =>
          this.start(command.seed, command.worldKind, request),
        );
        break;
      }
      case "quit":
        ++this.worldRequest;
        this.cancelNavigation();
        this.plans.cancel();
        this.transition(() => this.quit());
        break;
      case "pause":
        if (this.clocks.paused === command.paused) return;
        this.clocks.paused = command.paused;
        this.input.release();
        break;
      case "input-scope":
        if (this.scope === command.scope) return;
        this.scope = command.scope;
        this.input.setScope(
          this.pendingTransitions || this.navigation.pending
            ? "inactive"
            : command.scope,
        );
        break;
      case "set-time":
        this.clocks.setHours(command.hours);
        break;
      case "set-view":
        this.tools = {
          ...this.tools,
          viewMode: parseTerrainViewMode(command.value),
        };
        this.renderer?.setViewMode(this.tools.viewMode);
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
        this.transition(() => this.setPostcard(command.active));
        break;
      case "clear-edits":
        if (!sameSession(this.world, command.world)) {
          this.emit({
            type: "clear-edits-finished",
            world: command.world,
            ok: false,
          });
          break;
        }
        this.cancelNavigation();
        this.transition(() => this.clear(command.world));
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
  private pose(): SavedPose {
    return {
      x: this.body.x,
      y: this.body.y,
      z: this.body.z,
      yaw: this.body.yaw,
      flying: this.tools.flying,
    };
  }
  private async saveCurrent(): Promise<void> {
    if (!this.store || !this.world) return;
    const identity = this.world.identity,
      edits = [...this.store.edits.values()],
      pose = this.pose();
    await this.persistence.save(identity, edits);
    await this.persistence.savePose(identity, pose);
  }
  private destination(
    store: ChunkStore,
    x: number,
    z: number,
    preferred?: SavedPose | null,
  ): SavedPose {
    return resolveDestination(
      {
        get: store.get,
        surface: store.surface,
        water: (wx, wz) =>
          store.context.waterQuery(wx, wz, {
            bodyId: 0,
            kind: "none",
            level: 0,
          }),
      },
      x,
      z,
      this.body.yaw,
      preferred,
    );
  }
  private uploadStore(store: ChunkStore, limit: number): void {
    if (!this.renderer) return;
    for (let i = 0; i < limit && store.uploads.length; i++) {
      const result = store.uploads.shift();
      if (!result) break;
      const stored = store.chunks.get(chunkKey(result.address));
      if (
        !stored ||
        stored.revision !== result.revision ||
        !sameSession(store.world, result.world)
      )
        continue;
      this.renderer.upload(result);
      stored.state = "visible";
    }
  }
  private async prepareNear(
    store: ChunkStore,
    position: Point,
    radius: number,
    current: () => boolean,
    progress?: (value: number) => void,
  ): Promise<boolean> {
    let complete = false,
      failure: unknown;
    const pending = store
      .requestView(position.x, position.y, position.z, radius)
      .then(
        (value) => {
          complete = true;
          return value;
        },
        (error: unknown) => {
          failure = error;
          complete = true;
          return [];
        },
      );
    while (!complete && current()) {
      this.uploadStore(store, 8);
      const finished = [...store.chunks.values()].filter(
        (chunk) => chunk.result,
      ).length;
      progress?.(finished / Math.max(1, store.chunks.size));
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
    }
    if (!current()) return false;
    const addresses = await pending;
    if (failure) throw failure;
    while (store.uploads.length && current()) {
      this.uploadStore(store, 8);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    if (!current()) return false;
    if (!store.hasView(addresses, true))
      throw new Error("Destination meshes are not uploaded");
    return true;
  }
  private async loadPostcardChunks(
    store: ChunkStore,
    view: PostcardView,
    current: () => boolean,
    progress?: (value: number) => void,
    testView = false,
  ): Promise<{
    addresses: readonly Address[];
    upload: number;
    worker: { generate: number; light: number; mesh: number };
  } | null> {
    const before = store.workTotals;
    let complete = false,
      failure: unknown,
      upload = 0;
    const request = testView
      ? store.requestView(
          view.target.x,
          view.target.y,
          view.target.z,
          view.radius,
        )
      : store.requestCamera(view);
    const pending = request.then(
      (addresses) => {
        complete = true;
        return addresses;
      },
      (error: unknown) => {
        complete = true;
        failure = error;
        return [];
      },
    );
    while (!complete && current()) {
      const started = performance.now();
      this.uploadStore(store, Infinity);
      upload += performance.now() - started;
      progress?.(
        [...store.chunks.values()].filter((chunk) => chunk.result).length /
          Math.max(1, store.chunks.size),
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }
    if (!current()) return null;
    const addresses = await pending;
    if (failure) throw failure;
    const uploadStarted = performance.now();
    this.uploadStore(store, Infinity);
    upload += performance.now() - uploadStarted;
    if (!store.hasView(addresses, true))
      throw new Error("Postcard requested meshes are not uploaded");
    const after = store.workTotals;
    return {
      addresses,
      upload,
      worker: {
        generate: after.generate - before.generate,
        light: after.light - before.light,
        mesh: after.mesh - before.mesh,
      },
    };
  }
  private async start(
    seed: number,
    kind: WorldKind,
    request: number,
    skipSave = false,
  ): Promise<void> {
    if (kind !== "main" && kind !== "test")
      throw new Error("Unknown world kind");
    if (request !== this.worldRequest || this.stopped) return;
    const started = performance.now();
    const postcard = this.initialPostcardConsumed
      ? undefined
      : this.options.postcard;
    const current = () => request === this.worldRequest && !this.stopped;
    const oldStore = this.store,
      oldWorld = this.world,
      oldMode = this.mode;
    let candidate: ChunkStore | null = null;
    cancelAnimationFrame(this.frame);
    this.lifecycle = "loading";
    this.seed = seed >>> 0;
    this.loadProgress = 0;
    this.loadStage = kind === "main" ? "plan" : "terrain";
    this.publish();
    try {
      if (!skipSave) await this.saveCurrent();
      // Keep source geometry/pose, but release its worker resources before a
      // builder or candidate pool starts. At most one terrain pool is alive.
      oldStore?.suspendWorkers();
      await this.persistence.open();
      if (!current()) return;
      const world: WorldSession = Object.freeze({
        id: ++this.session,
        identity: Object.freeze({
          kind,
          seed: seed >>> 0,
          generation: generationKey(
            WORLDGEN_VERSION,
            this.options.cacheTag,
            kind === "main" ? this.options.generationVariant : "production",
          ),
        }),
      });
      if (
        postcard?.identity &&
        !sameIdentity(postcard.identity, world.identity)
      )
        throw new Error("Postcard world/source identity mismatch");
      const planStarted = performance.now();
      const plan: WorldPlanData | null = await this.plans.prepare(
        world.identity,
        (value) => {
          if (!current()) return;
          this.loadProgress = Math.max(
            this.loadProgress,
            (0.35 * value.completed) / Math.max(1, value.total),
          );
          this.publish();
        },
      );
      if (!current()) return;
      const context: WorldContext =
        kind === "main"
          ? createWorldContext({
              kind,
              seed: world.identity.seed,
              plan: plan as WorldPlanData,
              variant: generationVariant(world.identity),
            })
          : createWorldContext({ kind, seed: world.identity.seed });
      const planMs = performance.now() - planStarted;
      const saved = await this.persistence.loadWorld(world.identity);
      if (!current()) return;
      if (this.persistence.blocked) this.emit({ type: "storage-blocked" });
      if (postcard && saved.edits.length)
        throw new Error(
          "Automatic postcards require an unedited generation profile",
        );
      candidate = new ChunkStore(world, context, plan, saved.edits);
      const pose = this.destination(
        candidate,
        saved.pose?.x ?? context.spawn.x,
        saved.pose?.z ?? context.spawn.z,
        saved.pose,
      );
      const body = makeBody(pose.x, pose.y, pose.z);
      body.yaw = body.headYaw = pose.yaw;
      body.flying = pose.flying;
      const camera = new OverheadCamera();
      camera.relocate(body, candidate.get, candidate.surface);
      const viewpoints = regionViewpoints(context);
      this.loadStage = "terrain";
      this.loadProgress = Math.max(this.loadProgress, 0.35);
      this.publish();
      if (!this.renderer)
        this.renderer = new WorldRenderer(this.canvas, this.options.colors);
      this.renderer.setViewMode(this.tools.viewMode);
      this.graphics = "available";
      this.renderer.onLost = () => {
        this.graphics = "lost";
        this.input.release();
        this.cancelNavigation();
        this.publish();
      };
      this.renderer.onRestored = () => {
        this.graphics = "rebuilding";
        this.emit({ type: "graphics-rebuilding" });
        this.rebuildGraphics();
      };
      if (postcard && !postcard.identity && kind !== "test")
        throw new Error("TEST-1 postcard requires the test world");
      const progress = (value: number): void => {
        this.loadProgress = Math.max(this.loadProgress, 0.35 + 0.55 * value);
        this.publish();
      };
      const postcardPrepared = postcard
        ? await this.loadPostcardChunks(
            candidate,
            { ...postcard, radius: postcard.radius ?? 160 },
            current,
            progress,
            (postcard.id ?? "TEST-1") === "TEST-1",
          )
        : null;
      const prepared = postcard
        ? postcardPrepared !== null
        : await this.prepareNear(candidate, body, 96, current, progress);
      if (!prepared || !current()) return;
      const renderStarted = performance.now();
      this.renderer.setPostcard(!!postcard);
      this.renderer.update(
        body,
        body,
        1,
        0,
        Infinity,
        {
          ...initialTools(this.tools.viewMode),
          timeHours: postcard?.hours ?? 12,
          flying: pose.flying,
        },
        null,
        null,
        Block.Stone,
        false,
      );
      this.renderer.prepareView(
        world.id,
        postcard?.position ?? camera.position,
        postcard?.target ?? camera.focus,
      );
      if (!current()) return;
      this.renderer.effects.reset();
      this.renderer.setWorld(world.id);
      this.renderer.setView(
        postcard?.position ?? camera.position,
        postcard?.target ?? camera.focus,
      );
      this.renderer.update(
        body,
        body,
        1,
        0,
        Infinity,
        {
          ...initialTools(this.tools.viewMode),
          timeHours: postcard?.hours ?? 12,
          flying: pose.flying,
        },
        null,
        null,
        Block.Stone,
        false,
      );
      this.renderer.render();
      this.renderer.render();
      const renderMs = performance.now() - renderStarted;
      // No awaited operation after this point: pose, world and visible GPU set commit together.
      this.store = candidate;
      candidate = null;
      this.world = world;
      this.postcards = [];
      void this.resolvePostcardCatalogue(world, request);
      this.viewpoints = viewpoints;
      const discoveryKey = worldKey(world.identity);
      this.discoveries =
        this.discoveryMemory.get(discoveryKey) ?? new Set<SurfaceRegionId>();
      for (const id of saved.discoveries) this.discoveries.add(id);
      this.discoveryMemory.set(discoveryKey, this.discoveries);
      this.lastRegion = null;
      this.body = body;
      this.previous = { ...body };
      this.camera = camera;
      this.input.dispose();
      this.input = this.makeInput();
      this.input.setScope("inactive");
      this.clocks.setHours(postcard?.hours ?? 12);
      this.clocks.paused = false;
      this.clocks.runs = true;
      this.clocks.displayMs = 0;
      this.tools = {
        ...initialTools(this.tools.viewMode),
        flying: pose.flying,
      };
      this.mode = postcard ? "postcard" : "overhead";
      this.initialPostcardConsumed = true;
      this.postcardView = postcard ?? null;
      this.postcardReport =
        postcard && postcardPrepared
          ? {
              id: postcard.id ?? "TEST-1",
              identity: world.identity,
              requestedChunks: postcardPrepared.addresses.length,
              readyChunks: postcardPrepared.addresses.length,
              planReused: false,
              workerTimingsAreSums: true,
              timings: {
                plan: planMs,
                ...postcardPrepared.worker,
                upload: postcardPrepared.upload,
                render: renderMs,
                total: performance.now() - started,
              },
              limits: {
                dpr: 1,
                fov: 70,
                animationTime: 0,
                renderLoop: false,
                uploadCap: null,
              },
            }
          : null;
      this.target = this.ghost = null;
      this.actionRecord = null;
      this.cameraTransition = null;
      this.lastView = "";
      this.tick = this.lastFrame = this.accumulator = this.poseSavedAt = 0;
      oldStore?.dispose();
      if (oldWorld) this.renderer.removeWorld(oldWorld.id);
      this.store.onFailure = (error) => {
        if (this.store?.world.id !== world.id) return;
        console.error(error);
        this.lifecycle = "failed";
        this.publish();
      };
      this.lifecycle = "ready";
      this.loadProgress = 1;
      this.publish();
      if (!postcard) this.frame = requestAnimationFrame(this.animate);
    } catch (error) {
      if (!current()) return;
      console.error(error);
      this.lifecycle = "failed";
      if (error instanceof Error && error.message.includes("WebGL2"))
        this.graphics = "unavailable";
      if (oldWorld && this.renderer) {
        this.renderer.setWorld(oldWorld.id);
        this.renderer.setPostcard(oldMode === "postcard");
        this.renderer.setView(this.camera.position, this.camera.focus);
        this.updatePicture(1);
      }
      this.publish();
    } finally {
      if (candidate) {
        this.renderer?.removeWorld(candidate.world.id);
        candidate.dispose();
      }
      if (current() && this.store === oldStore && oldStore)
        await oldStore.resumeWorkers();
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
    this.uploadStore(this.store, limit);
  }
  private async resolvePostcardCatalogue(
    world: WorldSession,
    request: number,
  ): Promise<void> {
    try {
      const cameras =
        (await this.options.resolvePostcards?.(world.identity)) ?? [];
      if (this.stopped || this.world !== world || request !== this.worldRequest)
        return;
      const seen = new Set<PostcardId>();
      this.postcards = cameras.filter((camera) => {
        if (
          !sameIdentity(camera.identity, world.identity) ||
          seen.has(camera.id)
        )
          return false;
        seen.add(camera.id);
        return true;
      });
      this.publish();
    } catch {
      if (this.world === world && request === this.worldRequest) {
        this.postcards = [];
        this.publish();
      }
    }
  }
  private rebuildGraphics(): void {
    if (!this.renderer || !this.store) return;
    for (const chunk of this.store.chunks.values())
      if (chunk.result) this.renderer.upload(chunk.result);
    this.renderer.setViewMode(this.tools.viewMode);
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
      if (this.store && !this.navigation.pending)
        this.camera.step(
          dt,
          this.body,
          this.store.get,
          this.store.surface,
          this.input.turn,
          this.input.tilt,
        );
      const transition = this.cameraTransition;
      if (transition) {
        const t = ease(
          "ease-camera",
          (this.clocks.displayMs - transition.started) / transition.duration,
        );
        const mix = (a: Point, b: Point): Point => ({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          z: a.z + (b.z - a.z) * t,
        });
        this.renderer?.setView(
          mix(transition.fromPosition, this.camera.position),
          mix(transition.fromFocus, this.camera.focus),
        );
        if (t >= 1) {
          this.cameraTransition = null;
          this.lastView = "";
        }
      } else this.renderer?.setView(this.camera.position, this.camera.focus);
    }
    this.upload(8);
    if (this.options.worldVisible?.() ?? true) {
      this.updatePicture(this.accumulator / PHYSICS.tick);
      this.renderer?.render();
      this.animationRenders++;
    } else this.hiddenFrames++;
    if (now - this.snapshotTime > 100) {
      this.snapshotTime = now;
      this.publish();
    }
    this.frame = requestAnimationFrame(this.animate);
  };
  private fixedStep(): void {
    if (!this.store || this.navigation.pending || this.pendingTransitions)
      return;
    this.tick++;
    this.previous = { ...this.body };
    const active = this.pendingTransitions === 0 && this.scope === "world";
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
      void this.store
        .requestView(
          this.body.x,
          this.body.y,
          this.body.z,
          Math.max(96, Math.min(224, this.camera.distance * 1.3)),
        )
        .catch(() => {});
      if (!this.cameraTransition)
        for (const key of this.store.evict(
          this.body.x,
          this.body.z,
          Math.max(192, this.camera.distance * 1.6),
        ))
          this.renderer?.remove(key);
    }
    this.discoverRegion();
    if (this.world && this.clocks.displayMs - this.poseSavedAt >= 5000) {
      this.poseSavedAt = this.clocks.displayMs;
      void this.persistence.savePose(this.world.identity, this.pose());
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
        insideFrame(p.x, p.y, p.z) &&
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
    if (
      !this.store ||
      !this.world ||
      this.navigation.pending ||
      this.pendingTransitions ||
      this.lifecycle !== "ready" ||
      !insideFrame(edit.x, edit.y, edit.z)
    )
      return;
    this.store.edit(edit);
    void this.persistence
      .save(this.world.identity, [...this.store.edits.values()])
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
    this.publish();
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
      if (this.postcardView) {
        const world = this.world,
          store = this.store,
          request = this.worldRequest;
        const prepared = await this.prepareNear(
          store,
          this.body,
          Math.max(96, Math.min(224, this.camera.distance * 1.3)),
          () =>
            this.world === world &&
            this.worldRequest === request &&
            !this.stopped,
        );
        if (
          !prepared ||
          this.world !== world ||
          this.worldRequest !== request ||
          this.stopped
        )
          return;
        this.postcardView = null;
        this.postcardReport = null;
        this.renderer.setView(this.camera.position, this.camera.focus);
        this.updatePicture(1);
        this.renderer.prepareView(
          world?.id ?? 0,
          this.camera.position,
          this.camera.focus,
        );
        this.renderer.render();
      }
      this.lastView = "";
      this.lastFrame = 0;
      this.frame = requestAnimationFrame(this.animate);
    }
    this.publish();
  }
  private async clear(world: WorldSession): Promise<void> {
    const request = this.worldRequest;
    if (!sameSession(this.world, world)) {
      this.emit({ type: "clear-edits-finished", world, ok: false });
      return;
    }
    const ok = await this.persistence.clear(world.identity);
    if (
      !ok ||
      !sameSession(this.world, world) ||
      request !== this.worldRequest
    ) {
      this.emit({ type: "clear-edits-finished", world, ok: false });
      return;
    }
    if (this.store) this.store.edits.clear();
    await this.start(world.identity.seed, world.identity.kind, request, true);
    this.emit({
      type: "clear-edits-finished",
      world,
      ok: this.lifecycle === "ready",
    });
  }
  private async quit(): Promise<void> {
    this.cancelNavigation();
    this.mapSerial++;
    cancelAnimationFrame(this.frame);
    this.input.release();
    await this.saveCurrent();
    this.store?.dispose();
    this.store = null;
    this.world = null;
    this.postcards = [];
    this.postcardView = null;
    this.postcardReport = null;
    this.renderer?.dispose();
    this.renderer = null;
    this.lifecycle = "idle";
    this.mode = "overhead";
    this.publish();
  }
  private cancelNavigation(): void {
    this.navigation.cancel();
    this.fade?.cancel();
    this.fade = null;
    this.canvas.style?.removeProperty("opacity");
    this.input.release();
    this.input.setScope(this.pendingTransitions ? "inactive" : this.scope);
  }
  cancelTeleport(sessionId: number): void {
    if (this.world?.id === sessionId && this.navigation.pending)
      this.cancelNavigation();
  }
  inspectMap(request: MapPointRequest): MapPoint | null {
    if (
      !this.world ||
      !this.store ||
      request.sessionId !== this.world.id ||
      this.lifecycle !== "ready" ||
      this.pendingTransitions ||
      !insideXZ(request.x, request.z)
    )
      return null;
    return {
      x: request.x,
      z: request.z,
      regionId: regionAt(this.store.context, request.x, request.z),
    };
  }
  async readMap(request: MapRequest): Promise<MapFrame | null> {
    const world = this.world,
      store = this.store;
    if (
      !world ||
      !store ||
      request.sessionId !== world.id ||
      this.lifecycle !== "ready" ||
      this.pendingTransitions
    )
      return null;
    const serial = ++this.mapSerial;
    return mapFrame(
      store.context,
      request,
      this.viewpoints,
      () =>
        !this.stopped &&
        this.world === world &&
        this.lifecycle === "ready" &&
        !this.pendingTransitions &&
        serial === this.mapSerial,
      (report) => {
        this.mapReports.push({
          ...report,
          sessionId: world.id,
          requestId: serial,
        });
        if (this.mapReports.length > 12) this.mapReports.shift();
      },
    );
  }
  private discoverRegion(): void {
    const world = this.world,
      store = this.store;
    if (
      !world ||
      !store ||
      world.identity.kind === "test" ||
      this.mode === "postcard"
    )
      return;
    const region = regionAt(store.context, this.body.x, this.body.z);
    if (region === this.lastRegion) return;
    this.lastRegion = region;
    if (!region || this.discoveries.has(region)) return;
    this.discoveries.add(region);
    this.emit({
      type: "region-entered",
      sessionId: world.id,
      regionId: region,
    });
    void this.persistence.discover(world.identity, region).then((ok) => {
      if (!ok && this.world === world) this.emit({ type: "storage-blocked" });
    });
  }
  async teleport(request: TeleportRequest): Promise<TeleportResult> {
    const result = (committed: boolean): TeleportResult => ({
      sessionId: request.sessionId,
      committed,
    });
    const world = this.world,
      store = this.store,
      renderer = this.renderer;
    if (
      !world ||
      !store ||
      !renderer ||
      world.id !== request.sessionId ||
      this.lifecycle !== "ready" ||
      this.pendingTransitions ||
      this.mode !== "overhead"
    )
      return result(false);
    const point =
      request.target.kind === "region"
        ? this.viewpoints.get(request.target.regionId)
        : request.target;
    if (!point || !insideXZ(point.x, point.z)) return result(false);
    this.fade?.cancel();
    this.fade = null;
    const ticket = this.navigation.begin(world.id);
    const current = () =>
      this.navigation.current(ticket, this.world?.id ?? -1) &&
      this.world === world &&
      !this.stopped &&
      !this.pendingTransitions;
    this.input.release();
    this.input.setScope("inactive");
    const fromPosition = { ...this.camera.position },
      fromFocus = { ...this.camera.focus };
    try {
      const pose = this.destination(store, point.x, point.z);
      const body = makeBody(pose.x, pose.y, pose.z);
      body.yaw = body.headYaw = pose.yaw;
      body.flying = pose.flying;
      const camera = this.camera.destination(body, store.get, store.surface);
      const distance = Math.hypot(
        body.x - this.body.x,
        body.y - this.body.y,
        body.z - this.body.z,
      );
      const reduced =
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches;
      const glide = !reduced && distance < 3 * this.camera.requestedDistance;
      const radius = Math.max(96, Math.min(224, camera.distance * 1.3));
      if (!(await this.prepareNear(store, body, radius, current)))
        return result(false);
      // A short camera glide keeps the source and each intervening near set.
      if (glide)
        for (
          let step = 1, count = Math.ceil(distance / 96);
          step < count;
          step++
        ) {
          const t = step / count;
          if (
            !(await this.prepareNear(
              store,
              {
                x: this.body.x + (body.x - this.body.x) * t,
                y: this.body.y + (body.y - this.body.y) * t,
                z: this.body.z + (body.z - this.body.z) * t,
              },
              radius,
              current,
            ))
          )
            return result(false);
        }
      if (!current()) return result(false);
      renderer.update(
        body,
        body,
        1,
        this.clocks.displayMs,
        Infinity,
        { ...this.tools, flying: pose.flying },
        null,
        null,
        this.slots[this.selected] ?? Block.Stone,
        false,
      );
      try {
        renderer.prepareView(world.id, camera.position, camera.focus);
      } finally {
        this.updatePicture(this.accumulator / PHYSICS.tick);
      }
      if (!current()) return result(false);
      const fadeMs = reduced ? 150 : 120;
      if (!glide && this.canvas.animate) {
        this.fade = this.canvas.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: fadeMs / 2,
          fill: "forwards",
        });
        await this.fade.finished.catch(() => {});
        if (!current()) return result(false);
      }
      // Candidate body and camera become active in one synchronous commit only
      // after real geometry draw preparation; every preceding await is guarded.
      renderer.setView(
        glide ? fromPosition : camera.position,
        glide ? fromFocus : camera.focus,
      );
      renderer.update(
        body,
        body,
        1,
        this.clocks.displayMs,
        Infinity,
        { ...this.tools, flying: pose.flying },
        null,
        null,
        this.slots[this.selected] ?? Block.Stone,
        false,
      );
      renderer.render();
      this.body = body;
      this.previous = { ...body };
      this.camera = camera;
      this.tools = { ...this.tools, flying: pose.flying };
      this.accumulator = 0;
      this.lastFrame = 0;
      this.lastView = "";
      this.target = this.ghost = null;
      this.aim = { x: body.x, y: body.y + 1, z: body.z - 1 };
      this.occluded = false;
      this.input.dispose();
      this.input = this.makeInput();
      this.input.setScope("inactive");
      this.cameraTransition = glide
        ? {
            fromPosition,
            fromFocus,
            started: this.clocks.displayMs,
            duration: 250,
          }
        : null;
      if (!glide && this.canvas.animate) {
        this.fade?.cancel();
        this.fade = this.canvas.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: fadeMs / 2,
        });
      }
      this.discoverRegion();
      void this.persistence.savePose(world.identity, this.pose());
      this.publish();
      return result(true);
    } catch (error) {
      if (current()) {
        this.fade?.cancel();
        this.fade = null;
        renderer.setView(fromPosition, fromFocus);
        this.updatePicture(1);
      }
      throw error;
    } finally {
      this.navigation.finish(ticket);
      if (!this.navigation.pending) {
        this.input.release();
        this.input.setScope(this.pendingTransitions ? "inactive" : this.scope);
      }
    }
  }
  /** Owner travel keeps edits, relocates the free body, and publishes only after
   * both the destination and the exact postcard GPU view have been prepared. */
  async goToPostcard(request: {
    sessionId: number;
    id: PostcardId;
  }): Promise<TeleportResult> {
    const world = this.world,
      store = this.store,
      renderer = this.renderer;
    const view = this.postcards.find((camera) => camera.id === request.id);
    const result = (committed: boolean): TeleportResult => ({
      sessionId: request.sessionId,
      committed,
    });
    if (
      !world ||
      !store ||
      !renderer ||
      !view ||
      world.id !== request.sessionId ||
      !sameIdentity(view.identity, world.identity) ||
      this.lifecycle !== "ready" ||
      this.pendingTransitions ||
      this.mode !== "overhead"
    )
      return result(false);
    const worldRequest = this.worldRequest;
    this.cancelNavigation();
    let committed = false,
      failure: unknown;
    await this.transition(async () => {
      if (
        this.stopped ||
        this.world !== world ||
        this.worldRequest !== worldRequest
      )
        return;
      const ticket = this.navigation.begin(world.id);
      const current = () =>
        !this.stopped &&
        this.world === world &&
        this.store === store &&
        this.worldRequest === worldRequest &&
        this.navigation.current(ticket, this.world.id);
      if (!current()) return;
      cancelAnimationFrame(this.frame);
      const oldPosition = { ...this.camera.position },
        oldFocus = { ...this.camera.focus };
      try {
        const preferred: SavedPose = {
          x: view.position.x,
          y: view.position.y - 1.62,
          z: view.position.z,
          yaw: Math.atan2(
            view.target.x - view.position.x,
            -(view.target.z - view.position.z),
          ),
          flying: false,
        };
        const atFeet = store.get(
          Math.floor(preferred.x),
          Math.floor(preferred.y),
          Math.floor(preferred.z),
        );
        const supported = [-0.29, 0.29].some((dx) =>
          [-0.29, 0.29].some(
            (dz) =>
              BLOCK_REGISTRY[
                store.get(
                  Math.floor(preferred.x + dx),
                  Math.floor(preferred.y - 0.01),
                  Math.floor(preferred.z + dz),
                )
              ]?.solid,
          ),
        );
        const pose = this.destination(
          store,
          preferred.x,
          preferred.z,
          !supported || atFeet === Block.Lava || atFeet === Block.Water
            ? null
            : preferred,
        );
        const body = makeBody(pose.x, pose.y, pose.z);
        body.yaw = body.headYaw = pose.yaw;
        body.flying = pose.flying;
        const camera = this.camera.destination(body, store.get, store.surface);
        if (!(await this.prepareNear(store, body, 96, current))) return;
        const prepared = await this.loadPostcardChunks(
          store,
          view,
          current,
          undefined,
          view.id === "TEST-1",
        );
        if (!prepared || !current()) return;
        renderer.setPostcard(true);
        renderer.setViewMode(this.tools.viewMode);
        renderer.update(
          body,
          body,
          1,
          0,
          Infinity,
          { ...this.tools, flying: pose.flying, timeHours: view.hours },
          null,
          null,
          this.slots[this.selected] ?? Block.Stone,
          false,
        );
        renderer.prepareView(world.id, view.position, view.target);
        if (!current()) return;
        renderer.setView(view.position, view.target);
        // Offscreen preparation restores source-camera effect/origin state.
        // Refresh it at the final eye before either draw or atomic publication.
        renderer.update(
          body,
          body,
          1,
          0,
          Infinity,
          { ...this.tools, flying: pose.flying, timeHours: view.hours },
          null,
          null,
          this.slots[this.selected] ?? Block.Stone,
          false,
        );
        renderer.render();
        renderer.render();
        // No await between successful draw preparation and body/camera publication.
        this.body = body;
        this.previous = { ...body };
        this.camera = camera;
        this.cameraTransition = null;
        this.tools = { ...this.tools, flying: pose.flying };
        this.mode = "postcard";
        this.postcardView = view;
        this.postcardReport = null;
        this.clocks.displayMs = 0;
        this.clocks.setHours(view.hours);
        renderer.effects.reset();
        this.target = this.ghost = null;
        this.occluded = false;
        this.accumulator = this.lastFrame = 0;
        this.lastView = "";
        this.aim = { x: body.x, y: body.y + 1, z: body.z - 1 };
        this.input.dispose();
        this.input = this.makeInput();
        this.input.setScope("inactive");
        committed = true;
        void this.persistence.savePose(world.identity, this.pose());
        this.publish();
      } catch (error) {
        failure = error;
        throw error;
      } finally {
        this.navigation.finish(ticket);
        if (!committed && this.world === world && this.renderer === renderer) {
          renderer.setPostcard(false);
          renderer.setView(oldPosition, oldFocus);
          this.updatePicture(1);
          renderer.render();
          this.lastFrame = 0;
          this.frame = requestAnimationFrame(this.animate);
        }
      }
    });
    if (failure) throw failure;
    return result(committed);
  }
  whenReady(): Promise<void> {
    return this.promise;
  }
  /** Capture-only boundary: boot validates the local manifest; this method still
   * enforces the loaded identity and real mesh/GPU readiness for every shot. */
  async renderPostcard(view: WorldPostcard): Promise<Blob> {
    const world = this.world,
      request = this.worldRequest;
    if (
      !world ||
      !sameIdentity(world.identity, view.identity) ||
      this.lifecycle !== "ready"
    )
      throw new Error("Postcard does not match the loaded world");
    if (this.store?.edits.size)
      throw new Error(
        "Automatic postcards require an unedited generation profile",
      );
    let blob: Blob | undefined, failure: unknown;
    await this.transition(async () => {
      const store = this.store,
        renderer = this.renderer;
      const current = () =>
        !this.stopped && this.world === world && this.worldRequest === request;
      if (!current() || !store || !renderer)
        throw new Error("Postcard world changed before preparation");
      if (store.edits.size)
        throw new Error(
          "Automatic postcards require an unedited generation profile",
        );
      const started = performance.now();
      try {
        this.cancelNavigation();
        // Capture takes over the view; the committed destination must not
        // resume a glide whose start belongs to the previous display clock.
        this.cameraTransition = null;
        cancelAnimationFrame(this.frame);
        this.input.release();
        this.mode = "postcard";
        this.postcardView = view;
        this.loadStage = "terrain";
        this.loadProgress = 0;
        renderer.setPostcard(true);
        renderer.effects.reset();
        this.clocks.displayMs = 0;
        this.clocks.setHours(view.hours);
        this.publish();
        await store.settled();
        if (!current()) throw new Error("Postcard preparation cancelled");
        // The previous image stays in the default framebuffer while its GPU
        // chunks are released. Plan, workers, textures and programs stay alive.
        for (const key of store.retain([])) renderer.remove(key);
        const prepared = await this.loadPostcardChunks(
          store,
          view,
          current,
          (value) => {
            this.loadProgress = Math.max(this.loadProgress, value * 0.9);
            this.publish();
          },
          view.id === "TEST-1",
        );
        if (!prepared || !current())
          throw new Error("Postcard preparation cancelled");
        const renderStarted = performance.now();
        renderer.setView(view.position, view.target);
        this.target = this.ghost = null;
        this.occluded = false;
        this.updatePicture(1);
        renderer.prepareView(world.id, view.position, view.target);
        if (!current()) throw new Error("Postcard preparation cancelled");
        blob = await renderer.capturePng();
        if (!current()) throw new Error("Postcard changed during capture");
        this.postcardReport = {
          id: view.id,
          identity: world.identity,
          requestedChunks: prepared.addresses.length,
          readyChunks: prepared.addresses.length,
          planReused: true,
          workerTimingsAreSums: true,
          timings: {
            plan: 0,
            ...prepared.worker,
            upload: prepared.upload,
            render: performance.now() - renderStarted,
            total: performance.now() - started,
          },
          limits: {
            dpr: 1,
            fov: 70,
            animationTime: 0,
            renderLoop: false,
            uploadCap: null,
          },
        };
        this.loadProgress = 1;
      } catch (error) {
        failure = error;
        throw error;
      }
    });
    if (failure) throw failure;
    if (!blob) throw new Error("Postcard capture did not complete");
    return blob;
  }
  async capturePng(): Promise<Blob> {
    if (
      !this.renderer ||
      this.lifecycle !== "ready" ||
      this.navigation.pending ||
      this.pendingTransitions
    )
      throw new Error("World is not ready for capture");
    return this.renderer.capturePng();
  }
  async renderStill(displayTimeMs?: number): Promise<Blob> {
    await this.promise;
    if (
      !this.renderer ||
      !this.store ||
      this.lifecycle !== "ready" ||
      this.navigation.pending ||
      this.pendingTransitions
    )
      throw new Error("Still capture requires a ready world");
    if (displayTimeMs !== undefined) {
      cancelAnimationFrame(this.frame);
      this.clocks.displayMs = displayTimeMs;
    }
    await this.store.settled();
    this.upload(Infinity);
    this.updatePicture(1);
    const started = performance.now(),
      blob = await this.renderer.capturePng();
    if (this.mode === "postcard" && this.postcardReport) {
      const elapsed = performance.now() - started;
      this.postcardReport = {
        ...this.postcardReport,
        timings: {
          ...this.postcardReport.timings,
          render: this.postcardReport.timings.render + elapsed,
          total: this.postcardReport.timings.total + elapsed,
        },
      };
    }
    return blob;
  }
  telemetry(): GameTelemetry {
    const position = this.renderer?.camera.position ?? this.camera.position;
    const focus =
      this.mode === "postcard" && this.postcardView
        ? this.postcardView.target
        : this.camera.focus;
    const dx = focus.x - position.x,
      dy = focus.y - position.y,
      dz = focus.z - position.z;
    return Object.freeze({
      postcard: this.postcardReport
        ? structuredClone(this.postcardReport)
        : null,
      rendering: {
        visible: this.options.worldVisible?.() ?? true,
        animationRenders: this.animationRenders,
        hiddenFrames: this.hiddenFrames,
      },
      mapReports: this.mapReports.map((report) => ({
        ...report,
        names: report.names.map((name) => ({ ...name })),
      })),
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
      ready:
        this.pendingTransitions === 0 &&
        !this.navigation.pending &&
        this.lifecycle === "ready",
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
    ++this.worldRequest;
    this.cancelNavigation();
    this.plans.cancel();
    await this.transition(() => this.quit());
    this.input.dispose();
    this.listeners.clear();
    await this.persistence.close();
    await this.plans.dispose();
  }
}
