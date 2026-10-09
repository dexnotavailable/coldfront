/** Ibara, docs/04-terrain.md §8.5. Geometry is independent of world-plan ownership. */
import type { Spine } from "../../sdf/spine.js";
import type { Aabb, Vec3 } from "../../sdf/types.js";
export interface IbaraEnvironment {
  readonly seed: number;
  surfaceAt(x: number, z: number): number;
  weightAt(x: number, z: number): number;
  /** Write distance to lava, and the outward unit direction X/Z. */
  lavaAt?(x: number, z: number, out: Float64Array): Float64Array;
}
export type ThornCore = "obsidian" | "basalt";
export type ThornCrust = "none" | "ember" | "brimstone";
export interface ThornParameters {
  readonly id: number;
  readonly cellX: number;
  readonly cellZ: number;
  readonly cluster: number;
  readonly index: number;
  readonly base: Vec3;
  readonly height: number;
  readonly baseRadius: number;
  readonly flowX: number;
  readonly flowZ: number;
  readonly leanDegrees: number;
  readonly bend: number;
  readonly sCurve: boolean;
  readonly hooked: boolean;
  readonly broken: boolean;
  readonly breakT: number;
  readonly branchCount: number;
  readonly facets: number;
  readonly facetiness: number;
  readonly twist: number;
  readonly phase: number;
  readonly exponent: number;
  readonly core: ThornCore;
  readonly crust: ThornCrust;
  readonly nearLava: boolean;
  readonly landmark: boolean;
  readonly arch: boolean;
  readonly archSpan: number;
}
export interface ThornSweep {
  readonly spine: Spine;
  readonly radii: Float64Array;
  readonly maxRadius: number;
  readonly profileExponent: number;
  /** Measured from the actual interpolated radius table, in local spine metres. */
  readonly thinTipLength: number;
  readonly segmentRadii: Float64Array;
  readonly normals: Float64Array;
  readonly facetiness: number;
  readonly twist: number;
  readonly phase: number;
  readonly roughness: number;
  readonly seed: number;
  readonly tStart: number;
  readonly tScale: number;
  readonly bounds: Aabb;
}
export interface ThornRubble {
  readonly centre: Vec3;
  readonly radii: Vec3;
  /** Horizontal unit axis; the rock is a clipped convex shard, not an ellipsoid. */
  readonly axis: readonly [number, number];
  readonly topSlope: readonly [number, number];
  readonly boundRadius: number;
}
export interface ThornConstructionDiagnostics {
  flattenCalls: number;
  partitionAttempts: number;
  finePartitionAttempts: number;
}
export interface ThornInstance {
  /** Construction counters only; sampling never performs this search. */
  readonly construction: Readonly<ThornConstructionDiagnostics>;
  readonly parameters: ThornParameters;
  readonly sweeps: readonly ThornSweep[];
  readonly debris: readonly ThornSweep[];
  readonly rubble: readonly ThornRubble[];
  readonly bounds: Aabb;
  readonly fillet: number;
  readonly profileExponent: number;
  readonly thinTipLength: number;
  readonly lodPolicy: "landmark" | "thicken";
}
export interface IbaraClusterParameters {
  readonly cellX: number;
  readonly cellZ: number;
  readonly index: number;
  readonly x: number;
  readonly z: number;
  readonly mask: number;
  readonly radius: number;
  readonly thorns: readonly ThornParameters[];
}
/** One cell's production placement snapshot, before LOD filtering or geometry.
 * Neighbour probes are never accumulated into these cell-owned counts. */
export interface IbaraCellDiagnostics {
  readonly cellX: number;
  readonly cellZ: number;
  readonly landmark: boolean;
  readonly inDomain: boolean;
  /** The capped Poisson draw returned 3, the N>=3 bucket. This is not a count
   * of discarded clusters, and says nothing about capped/failed geometry. */
  readonly poissonAtCap: boolean;
  readonly candidateClusters: number;
  readonly rejectedMaskClusters: number;
  readonly rejectedWeightClusters: number;
  readonly rejectedProximityClusters: number;
  /** Survived cluster gates; includes records left empty by instance rejection. */
  readonly acceptedClusters: number;
  readonly emptyAcceptedClusters: number;
  /** Primary parameter slots opened AFTER the cluster gates. Rejected cluster
   * slots have no instance denominator. Landmarks use one candidate cluster
   * per Poisson slot, reject weight<0.85 at that gate, then open one instance. */
  readonly candidateInstances: number;
  /** Ordinary slots which failed all 8 hashed packing attempts. */
  readonly rejectedAttemptsInstances: number;
  /** Locally placed slots rejected by cross-cluster/cell base spacing. */
  readonly rejectedSpacingInstances: number;
  /** Final primary parameters before LOD selection, not instantiated curves. */
  readonly acceptedInstances: number;
  /** Ordinary packing attempts only; landmarks have no packing search.
   * Attempts = weight rejects + local-spacing rejects + locally placed slots;
   * locally placed slots = acceptedInstances + rejectedSpacingInstances. */
  readonly candidateAttempts: number;
  readonly rejectedWeightAttempts: number;
  readonly rejectedLocalSpacingAttempts: number;
}
/** Pair counts belong to the smaller-ID endpoint's cell, so cell enumeration
 * counts each mutual pair once. Changed instances belong to their own cell. */
export interface IbaraNeighbourContrastDiagnostics {
  readonly candidatePairs: number;
  readonly adjustedPairs: number;
  readonly uncertifiedPairs: number;
  readonly noLegalAdjustmentPairs: number;
  readonly protectedInclinationPairs: number;
  readonly uncertifiedNearestInstances: number;
  readonly changedInstances: number;
}
export interface IbaraCluster {
  readonly cellX: number;
  readonly cellZ: number;
  readonly index: number;
  readonly x: number;
  readonly z: number;
  readonly mask: number;
  readonly radius: number;
  readonly thorns: readonly ThornInstance[];
}
export interface IbaraSample {
  distance: number;
  featureId: number;
  t: number;
  fillet: number;
  core: ThornCore;
  crust: ThornCrust;
  kind: "none" | "thorn" | "branch" | "debris" | "rubble";
  broken: boolean;
}
export function createIbaraSample(): IbaraSample {
  return {
    distance: Infinity,
    featureId: 0,
    t: 0,
    fillet: 0,
    core: "basalt",
    crust: "none",
    kind: "none",
    broken: false,
  };
}
export function clearIbaraSample(out: IbaraSample): void {
  out.distance = Infinity;
  out.featureId = 0;
  out.t = 0;
  out.fillet = 0;
  out.core = "basalt";
  out.crust = "none";
  out.kind = "none";
  out.broken = false;
}
