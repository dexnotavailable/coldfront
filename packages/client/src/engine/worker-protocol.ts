import type { ChunkMesh } from "../../../shared/src/meshing/greedy.js";
import type { WorldPlanData } from "../../../shared/src/world/types.js";
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
export type WorkerRequest =
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
