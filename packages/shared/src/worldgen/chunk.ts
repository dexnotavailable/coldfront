import { createNoise2Sample } from "../noise/opensimplex2.js";
import {
  CHUNK_SIZE,
  CHUNK_VOLUME,
  HALO_ABOVE,
  HALO_VOLUME,
  HALO_WIDTH,
} from "../world/constants.js";
import { haloIndex, sampleCenter, voxelIndex } from "../world/coordinates.js";
import {
  Column,
  collectTestTrees,
  createColumnSample,
  createVoxelSample,
  sampleTestColumn,
  sampleTestVoxel,
} from "./test-world.js";
import { WORLDGEN_VERSION } from "./version.js";

export interface ChunkRequest {
  readonly seed: number;
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  /** Metres per sample; any finite positive spacing, not just powers of two. */
  readonly spacing?: number;
}
export interface VoxelChunk {
  readonly seed: number;
  readonly version: number;
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly spacing: number;
  /** Core 32^3 block IDs, x-fastest then z then y (voxelIndex). */
  readonly blocks: Uint16Array;
  /** Includes core and halo: 34 x 41 x 34, indexed by haloIndex. */
  readonly haloBlocks: Uint16Array;
  /** Float64 solid density at the same halo indices; water density stays negative. */
  readonly density: Float64Array;
  /** Float64 interleaved column data: Column.Stride * ((x+1)+34*(z+1)). */
  readonly columns: Float64Array;
}

/** Pure seed/position generation, caller owns all returned buffers; no cache or neighbour dependency. */
export function generateTestChunk(request: ChunkRequest): VoxelChunk {
  const { cx, cy, cz, seed } = request;
  const spacing = request.spacing ?? 1;
  if (!Number.isInteger(seed) || seed < -2_147_483_648 || seed > 4_294_967_295)
    throw new RangeError("Seed must be a 32-bit word");
  const minX = sampleCenter(cx, -1, spacing);
  const minZ = sampleCenter(cz, -1, spacing);
  const maxX = sampleCenter(cx, CHUNK_SIZE, spacing);
  const maxZ = sampleCenter(cz, CHUNK_SIZE, spacing);
  sampleCenter(cy, CHUNK_SIZE + HALO_ABOVE - 1, spacing);
  const blocks = new Uint16Array(CHUNK_VOLUME);
  const haloBlocks = new Uint16Array(HALO_VOLUME);
  const density = new Float64Array(HALO_VOLUME);
  const columns = new Float64Array(HALO_WIDTH * HALO_WIDTH * Column.Stride);
  const trees = collectTestTrees(seed, minX, minZ, maxX, maxZ);
  const column = createColumnSample();
  const noise = createNoise2Sample();
  const voxel = createVoxelSample();
  for (let z = -1; z <= CHUNK_SIZE; z++) {
    const wz = sampleCenter(cz, z, spacing);
    for (let x = -1; x <= CHUNK_SIZE; x++) {
      const wx = sampleCenter(cx, x, spacing);
      sampleTestColumn(seed, wx, wz, column, noise);
      const ci = (x + 1 + HALO_WIDTH * (z + 1)) * Column.Stride;
      columns.set(column, ci);
      for (let y = -1; y < CHUNK_SIZE + HALO_ABOVE; y++) {
        const wy = sampleCenter(cy, y, spacing);
        sampleTestVoxel(seed, wx, wy, wz, voxel, column, trees);
        const hi = haloIndex(x, y, z);
        haloBlocks[hi] = voxel.block;
        density[hi] = voxel.density;
        if (
          x >= 0 &&
          x < CHUNK_SIZE &&
          z >= 0 &&
          z < CHUNK_SIZE &&
          y >= 0 &&
          y < CHUNK_SIZE
        )
          blocks[voxelIndex(x, y, z)] = voxel.block;
      }
    }
  }
  return {
    seed,
    version: WORLDGEN_VERSION,
    cx,
    cy,
    cz,
    spacing,
    blocks,
    haloBlocks,
    density,
    columns,
  };
}
