import type { ChunkMesh } from "../../../shared/src/meshing/greedy.js";
import type { WorldPlanData } from "../../../shared/src/world/types.js";
import type {
  FarLimits,
  FarStatistics,
  FarTileMesh,
  FarTileRequest,
  FarTileRuns,
} from "../../../shared/src/worldgen/far/types.js";
import type { WorldSession } from "../contracts/game-ui.js";
import type { BlockSampleCacheStats } from "./block-sample-cache.js";
export interface Address {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
}
export interface VoxelEdit {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly block: number;
}
/** Structural match for the optional world sampler diagnostic. Counts describe
 * retained geometry, never guessed JavaScript heap bytes. Shared-cache counts
 * are one snapshot per context; prepared references belong to that sampler. */
export interface WorkerFeatureCacheStats {
  readonly geometryCells: number;
  readonly geometryCellLimit: number;
  readonly placementCells: number;
  readonly placementCellLimit: number;
  readonly cachedInstances: number;
  readonly preparedInstanceReferences: number;
}
export interface FarWorkerRequest extends FarTileRequest {
  readonly type: "far";
  /** Pool-wide ID, independent of a FarTerrainStore's local ID. */
  readonly id: number;
  readonly world: WorldSession;
  readonly priority: number;
  readonly postcard: boolean;
}
export interface WorkerFarCacheStats {
  /** Edit maps/slabs are JS objects; these counts are not heap-byte estimates. */
  readonly editCount: number;
  readonly retainedTiles: number;
  readonly typedArrayBytes: number;
}
export interface FarTileResult extends FarTileRequest {
  readonly type: "far";
  readonly world: WorldSession;
  readonly id: number;
  readonly runs: FarTileRuns;
  readonly mesh: FarTileMesh;
  readonly timings: Readonly<{ generate: number; mesh: number }>;
  /** Retained worker arrays only. Transferred runs/mesh are owned by the caller. */
  readonly cacheBytes: number;
  readonly blockSampleCacheStats?: BlockSampleCacheStats;
  readonly featureCacheStats?: WorkerFeatureCacheStats;
  readonly farCacheStats: WorkerFarCacheStats;
}
export interface WorkerFarCapacityFailure {
  readonly capacity: keyof FarLimits;
  readonly limit: number;
  readonly statistics: Readonly<FarStatistics>;
}
export type WorkerRequest =
  | FarWorkerRequest
  | {
      readonly type: "init";
      readonly world: WorldSession;
      readonly plan: WorldPlanData | null;
      readonly edits: readonly VoxelEdit[];
    }
  | {
      readonly type: "edit";
      readonly world: WorldSession;
      readonly edit: VoxelEdit;
    }
  | {
      readonly type: "chunk";
      readonly id: number;
      readonly world: WorldSession;
      readonly address: Address;
      readonly revision: number;
    };
export interface ChunkResult {
  readonly type: "chunk";
  readonly world: WorldSession;
  readonly id: number;
  readonly address: Address;
  readonly revision: number;
  readonly blocks: Uint16Array;
  readonly light: Uint16Array;
  readonly mesh: ChunkMesh;
  readonly regionColor: readonly [number, number, number];
  readonly timings: Readonly<{ generate: number; light: number; mesh: number }>;
  /** Tracked worker typed-array payload, including block-sample pages; not JS
   * heap or total worker memory. Shared sampler caches have separate counts. */
  readonly cacheBytes: number;
  readonly blockSampleCacheStats?: BlockSampleCacheStats;
  readonly featureCacheStats?: WorkerFeatureCacheStats;
}
export type WorkerStage = "generating" | "generated" | "lighting" | "meshing";
export type WorkerResponse =
  | ChunkResult
  | FarTileResult
  | { readonly type: "ready"; readonly world: WorldSession }
  | {
      readonly type: "progress";
      readonly world: WorldSession;
      readonly id: number;
      readonly stage: WorkerStage;
    }
  | {
      readonly type: "error";
      readonly world: WorldSession;
      readonly id: number;
      readonly message: string;
      /** Present for far task errors, including the exact request revision. */
      readonly far?: FarTileRequest;
      readonly capacity?: WorkerFarCapacityFailure;
    };
export function chunkKey(a: Address): string {
  return `${a.cx},${a.cy},${a.cz}`;
}
export function editKey(x: number, y: number, z: number): number {
  return x + 22528 + 45056 * (z + 22528 + 45056 * (y + 1536));
}
export function meshTransfers(mesh: ChunkMesh): ArrayBuffer[] {
  return [...mesh.parts, mesh.skirts].flatMap(
    (p) =>
      [
        p.positions.buffer,
        p.normals.buffer,
        p.expansions.buffer,
        p.packedPositions.buffer,
        p.surfaces.buffer,
        p.featureIdParts.buffer,
        p.indices.buffer,
      ] as ArrayBuffer[],
  );
}
/** Far outputs alone cross ownership; aliases appear only once in the list. */
export function farTransfers(
  runs: FarTileRuns,
  mesh: FarTileMesh,
): ArrayBuffer[] {
  const buffers = [
    runs.offsets.buffer,
    runs.words.buffer,
    ...[...mesh.parts, ...mesh.skirts.flat()].flatMap((part) => [
      part.positions.buffer,
      part.normals.buffer,
      part.expansions.buffer,
      part.surfaces.buffer,
      part.featureIdParts.buffer,
      part.indices.buffer,
    ]),
  ];
  return [...new Set(buffers)].map((buffer) => {
    if (!(buffer instanceof ArrayBuffer))
      throw new Error("Far output must own a transferable ArrayBuffer");
    return buffer;
  });
}
