import type { ChunkMesh } from "../../../shared/src/meshing/greedy.js";
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
export type WorkerRequest =
  | {
      readonly type: "init";
      readonly seed: number;
      readonly edits: readonly VoxelEdit[];
    }
  | { readonly type: "edit"; readonly edit: VoxelEdit }
  | {
      readonly type: "chunk";
      readonly id: number;
      readonly address: Address;
      readonly revision: number;
    };
export interface ChunkResult {
  readonly type: "chunk";
  readonly id: number;
  readonly address: Address;
  readonly revision: number;
  readonly blocks: Uint16Array;
  readonly light: Uint16Array;
  readonly mesh: ChunkMesh;
  readonly timings: Readonly<{ generate: number; light: number; mesh: number }>;
  readonly cacheBytes: number;
}
export type WorkerStage = "generating" | "generated" | "lighting" | "meshing";
export type WorkerResponse =
  | ChunkResult
  | {
      readonly type: "progress";
      readonly id: number;
      readonly stage: WorkerStage;
    }
  | { readonly type: "error"; readonly id: number; readonly message: string };
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
        p.indices.buffer,
      ] as ArrayBuffer[],
  );
}
