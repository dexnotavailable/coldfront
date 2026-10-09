/** Plain-data UI boundary. No renderer objects and no game simulation in the UI. */
import type {
  BoundsXZ,
  RegionDefinition,
  SurfaceRegionId,
  WorldIdentity,
  WorldKind,
} from "../../../shared/src/world/types.js";
import type { TerrainViewMode } from "../engine/terrain-material.js";
import type { PostcardId } from "../game/postcard.js";

export type { TerrainViewMode } from "../engine/terrain-material.js";
export interface PostcardPresentation {
  readonly id: PostcardId;
  readonly name: string;
}

export type {
  BoundsXZ,
  SurfaceRegionId,
  WorldIdentity,
  WorldKind,
} from "../../../shared/src/world/types.js";
/** Stable for one loaded world; ordinary snapshot revisions never change it. */
export interface WorldSession {
  readonly id: number;
  readonly identity: WorldIdentity;
}
export type RegionPresentation = Pick<
  RegionDefinition,
  "id" | "name" | "kanji" | "discoverySentence"
>;
export interface MapInfo {
  readonly bounds: BoundsXZ;
  readonly regions: readonly RegionPresentation[];
}
export interface MapRequest {
  readonly sessionId: number;
  readonly bounds: BoundsXZ;
  readonly width: number;
  readonly height: number;
}
export interface MapFrame extends MapRequest {
  /** The receiver owns the buffer. Treat it as immutable after delivery. */
  readonly rgba: Uint8ClampedArray;
  readonly names: readonly Readonly<{
    regionId: SurfaceRegionId;
    x: number;
    z: number;
  }>[];
}
export interface MapPointRequest {
  readonly sessionId: number;
  readonly x: number;
  readonly z: number;
}
export interface MapPoint {
  readonly x: number;
  readonly z: number;
  readonly regionId: SurfaceRegionId | null;
}
export type TeleportTarget =
  | Readonly<{ kind: "point"; x: number; z: number }>
  | Readonly<{ kind: "region"; regionId: SurfaceRegionId }>;
export interface TeleportRequest {
  readonly sessionId: number;
  readonly target: TeleportTarget;
}
export interface TeleportResult {
  readonly sessionId: number;
  readonly committed: boolean;
}
export type Vec3Data = readonly [number, number, number];
export type HotbarIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type FlySpeed = 1 | 2 | 4 | 8 | 16;
export type CompassId =
  | "compass.n"
  | "compass.ne"
  | "compass.e"
  | "compass.se"
  | "compass.s"
  | "compass.sw"
  | "compass.w"
  | "compass.nw";
export interface BlockPresentation {
  readonly id: number;
  readonly name: string;
  readonly regionId: string;
  readonly icon: string;
}
export interface ToolState {
  readonly viewMode: TerrainViewMode;
  readonly timeHours: number;
  readonly clockRuns: boolean;
  readonly fog: boolean;
  readonly shadows: boolean;
  readonly chunkBorders: boolean;
  readonly wireframe: boolean;
  readonly flying: boolean;
  readonly flySpeed: FlySpeed;
}
export interface DebugState {
  readonly regionWeights: readonly Readonly<{
    regionId: SurfaceRegionId;
    weight: number;
  }>[];
  readonly feet: Vec3Data;
  readonly facing: CompassId;
  readonly pitchDegrees: number;
  readonly chunk: Vec3Data;
  readonly skyLight: number;
  readonly blockLight: Vec3Data;
  readonly fps: number;
  readonly slowestFrameMs: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly trackedMemoryBytes: number;
  readonly queues: Readonly<{ generate: number; light: number; mesh: number }>;
  readonly seed: number;
  readonly build: Readonly<{ version: string; commit: string }>;
}
export interface GameSnapshot {
  readonly world: WorldSession | null;
  readonly loadStage: "plan" | "terrain";
  readonly mapInfo: MapInfo | null;
  readonly revision: number;
  readonly lifecycle: "idle" | "loading" | "ready" | "failed";
  readonly loadProgress: number;
  readonly seed: number;
  readonly mode: "overhead" | "postcard";
  readonly postcards: readonly PostcardPresentation[];
  readonly activePostcardId: PostcardId | null;
  readonly worldPaused: boolean;
  readonly tools: ToolState;
  readonly hotbar: Readonly<{
    slots: readonly (number | null)[];
    selected: HotbarIndex;
    itemName: string | null;
  }>;
  readonly blocks: readonly BlockPresentation[];
  readonly storage: "available" | "blocked";
  readonly graphics: "available" | "unavailable" | "lost" | "rebuilding";
  readonly debug: DebugState | null;
}
export type InputScope =
  | "world"
  | "field"
  | "modal"
  | "blocking-screen"
  | "inactive";
export type ToolBoolean = Exclude<
  keyof ToolState,
  "timeHours" | "flySpeed" | "viewMode"
>;
export type GameCommand =
  | {
      readonly type: "start";
      readonly seed: number;
      readonly worldKind: WorldKind;
    }
  | { readonly type: "quit" }
  | { readonly type: "pause"; readonly paused: boolean }
  | { readonly type: "input-scope"; readonly scope: InputScope }
  | { readonly type: "set-time"; readonly hours: number }
  | { readonly type: "set-view"; readonly value: TerrainViewMode }
  | {
      readonly type: "set-tool";
      readonly key: ToolBoolean;
      readonly value: boolean;
    }
  | { readonly type: "set-fly-speed"; readonly value: FlySpeed }
  | { readonly type: "select-slot"; readonly index: HotbarIndex }
  | {
      readonly type: "assign-block";
      readonly index: HotbarIndex;
      readonly blockId: number;
    }
  | { readonly type: "hud-visible"; readonly visible: boolean }
  | { readonly type: "postcard"; readonly active: boolean }
  | { readonly type: "clear-edits"; readonly world: WorldSession };
export type GameEvent =
  | {
      readonly type: "region-entered";
      readonly sessionId: number;
      readonly regionId: SurfaceRegionId;
    }
  | { readonly type: "snapshot"; readonly snapshot: GameSnapshot }
  | {
      readonly type: "item-changed";
      readonly blockId: number | null;
      readonly displayTimeMs: number;
    }
  | { readonly type: "fly-speed-changed"; readonly value: FlySpeed }
  | { readonly type: "graphics-rebuilding" }
  | { readonly type: "storage-blocked" }
  | {
      readonly type: "clear-edits-finished";
      readonly world: WorldSession;
      readonly ok: boolean;
    };
export interface GamePort {
  read(): GameSnapshot;
  subscribe(listener: (event: GameEvent) => void): () => void;
  apply(command: GameCommand): void;
  /** Null means stale/cancelled; preparation failures throw for load.failed. */
  readMap(request: MapRequest): Promise<MapFrame | null>;
  inspectMap(request: MapPointRequest): MapPoint | null;
  /** Resolves only after safe destination readiness and atomic body/camera commit. */
  teleport(request: TeleportRequest): Promise<TeleportResult>;
  goToPostcard(request: {
    sessionId: number;
    id: PostcardId;
  }): Promise<TeleportResult>;
  cancelTeleport(sessionId: number): void;
  capturePng(): Promise<Blob>;
  dispose(): Promise<void>;
}
/** Browser services run in the original trusted click, before any asynchronous work. */
export interface UiHost {
  enterFullscreen(): void;
  toggleFullscreen(): void;
  reload(): void;
  openRoute(route: "licenses/" | "?gallery"): void;
  downloadPng(blob: Blob): void;
  randomSeed(): number;
}
