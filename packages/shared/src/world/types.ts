/** Phase 1.2 public world contracts. Imports: world/types.ts, world/regions.ts,
 * world/world-context.ts and worldplan/index.ts. No runtime stand-ins. */
export type WorldKind = "main" | "test";
export type SurfaceRegionId =
  | "plains"
  | "tundra"
  | "mountains"
  | "desert"
  | "boneyard"
  | "jungle"
  | "swamp"
  | "lake"
  | "twilight"
  | "hellscape"
  | "shardfields"
  | "isles"
  | "nadir"
  | "blackwater"
  | "rim"
  | "frost";
export type UndergroundRegionId =
  | "frost_hollows"
  | "old_workings"
  | "crystal_grottos"
  | "ember_veins"
  | "bone_pits"
  | "root_halls"
  | "sporewood"
  | "drowned_caverns"
  | "stone_garden"
  | "buried_city"
  | "leyflow"
  | "great_shear"
  | "hollow_sky"
  | "deep_forges"
  | "gut"
  | "ash_sea"
  | "throne";
export type RegionId = SurfaceRegionId | UndergroundRegionId;
export type UndergroundLayer = "upper_deep" | "undercrown" | "maw" | "pit";
export type LayerId = "surface" | UndergroundLayer;
export interface RegionWeights {
  count: number;
  readonly ids: Uint8Array;
  readonly weights: Float64Array;
}
/** Numeric ids are stable indices in exported REGION_IDS, never display-name hashes. */
export interface RegionDefinition {
  readonly id: SurfaceRegionId;
  readonly index: number;
  readonly layer: "surface";
  readonly name: string;
  readonly color: readonly [number, number, number];
  readonly kanji?: string;
  readonly discoverySentence?: string;
}
export interface XZ {
  readonly x: number;
  readonly z: number;
}
export interface XZBounds {
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
}
export interface VoxelSample {
  density: number;
  block: number;
  fluid: number;
}
export interface WaterSample {
  bodyId: number;
  kind: "none" | "water";
  level: number;
}
export interface SurfaceWaterBody {
  readonly id: number;
  readonly kind: "water";
  readonly level: number;
  readonly source: "blackwater" | "lake" | "swamp" | "pond";
}
export interface SeatSite extends XZ {
  readonly id: string;
  readonly region: RegionId;
  readonly layer: LayerId;
}
export interface FortSite extends XZ {
  readonly id: string;
  readonly seatId: string;
  readonly region: RegionId;
  readonly layer: LayerId;
}
export interface DescentSite extends XZ {
  readonly id: string;
  readonly type: string;
  readonly from: RegionId;
  readonly to: RegionId;
  readonly fromLayer: LayerId;
  readonly toLayer: UndergroundLayer;
}
export interface BridgeSite {
  readonly id: string;
  readonly bearing: number;
  readonly centreline: Float64Array;
  readonly halfWidth: number;
  readonly gaps: Float64Array;
}
export interface SpawnSite extends XZ {
  readonly id: string;
  readonly region: SurfaceRegionId;
  readonly surfaceY: number;
  readonly rank: number;
}
export interface WorldSites {
  readonly seats: readonly SeatSite[];
  readonly forts: readonly FortSite[];
  readonly descents: readonly DescentSite[];
  readonly bridges: readonly BridgeSite[];
  readonly spawns: readonly SpawnSite[];
}
export interface UndergroundCell extends XZ {
  readonly region: UndergroundRegionId;
  readonly layer: UndergroundLayer;
}
/** Structured-cloneable data only. Arrays become read-only by ownership after build.
 * terrainMacro includes base+bowl+owned shapes+macro regional relief exactly once.
 * routingHeight is a SEPARATE flood result and never sampled as rendered terrain. */
export interface WorldPlanData {
  readonly schema: 1;
  readonly seed: number;
  readonly worldgenVersion: number;
  readonly grid: {
    readonly minX: number;
    readonly minZ: number;
    readonly spacing: 64;
    readonly width: number;
    readonly depth: number;
  };
  readonly terrainMacro: Float64Array;
  readonly routingHeight: Float64Array;
  readonly receivers: Int32Array;
  readonly routingOrder: Uint32Array;
  readonly drainageArea: Float64Array;
  readonly basinIds: Uint32Array;
  readonly waterBodies: readonly SurfaceWaterBody[];
  readonly undergroundCells: readonly UndergroundCell[];
  readonly sites: WorldSites;
}
export interface PlanProgress {
  readonly stage: "geometry" | "drainage" | "water" | "sites" | "complete";
  readonly completed: number;
  readonly total: number;
}
export interface WorldPlan {
  readonly data: WorldPlanData;
  readonly seed: number;
  readonly worldgenVersion: number;
  readonly sites: WorldSites;
  surfaceWeights(x: number, z: number, out: RegionWeights): RegionWeights;
  layerWeights(
    layer: UndergroundLayer,
    x: number,
    z: number,
    out: RegionWeights,
  ): RegionWeights;
  footprint(layer: UndergroundLayer, x: number, z: number): number;
  macroHeight(x: number, z: number): number;
  waterQuery(x: number, z: number, out: WaterSample): WaterSample;
}
/** Engines use these offsets, never the test world's Column enum for main data.
 * The test descriptor is stride8, height2, gradientX3, gradientZ4, waterLevel6;
 * its lane7 remains exactly PondRadiusSquared. Main has its own explicit layout. */
export interface WorldColumnLayout {
  readonly stride: number;
  readonly height: number;
  readonly gradientX: number;
  readonly gradientZ: number;
  readonly waterLevel: number;
}
/** Conservative over the ENTIRE requested closed XZ rectangle, not sparse samples. */
export interface WorldBounds {
  minSurfaceY: number;
  maxSurfaceY: number;
  maxSolidY: number;
  maxFluidY: number;
}
/** solidBelowY is a proven all-solid terrain bound inside the canonical frame;
 * highestFilterY includes water and decorations as well as terrain. Engines still
 * evaluate actual voxels from that bound, respecting their64m blocker policy. */
export interface SkyInput {
  solidBelowY: number;
  highestFilterY: number;
}
export interface WorldAreaSampler {
  readonly kind: WorldKind;
  readonly seed: number;
  readonly columns: WorldColumnLayout;
  createColumn(): Float64Array;
  sampleColumn(x: number, z: number, out: Float64Array): Float64Array;
  sampleVoxel(
    x: number,
    y: number,
    z: number,
    out: VoxelSample,
    column?: Float64Array,
  ): VoxelSample;
  skyInput(
    x: number,
    z: number,
    out: SkyInput,
    column?: Float64Array,
  ): SkyInput;
}
/** Context convenience point queries and prepared area queries are identical.
 * prepareArea caches deterministic features for a closed rectangle. Build it once
 * for a worker96x96 footprint and reuse in its voxel loops; do not clone it. */
export interface WorldContext extends WorldAreaSampler {
  readonly worldgenVersion: number;
  readonly plan: WorldPlan | null;
  readonly regions: readonly RegionDefinition[];
  readonly spawn: Readonly<{ x: number; y: number; z: number }>;
  /** Representative XZ whose dominant region is id; no safe-y claim. Test returns null. */
  regionAnchor(id: SurfaceRegionId): XZ | null;
  prepareArea(bounds: XZBounds): WorldAreaSampler;
  conservativeBounds(bounds: XZBounds, out: WorldBounds): WorldBounds;
  surfaceWeights(x: number, z: number, out: RegionWeights): RegionWeights;
  waterQuery(x: number, z: number, out: WaterSample): WaterSample;
}

export type BoundsXZ = XZBounds;
export interface WorldIdentity {
  readonly kind: WorldKind;
  readonly seed: number;
  readonly generation: string;
}
export type WorldContextOptions =
  | { kind: "test"; seed: number }
  | { kind: "main"; seed: number; plan: WorldPlanData };
