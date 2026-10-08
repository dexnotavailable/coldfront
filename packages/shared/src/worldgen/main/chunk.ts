import {
  CHUNK_SIZE,
  CHUNK_VOLUME,
  HALO_ABOVE,
  HALO_VOLUME,
  HALO_WIDTH,
} from "../../world/constants.js";
import {
  haloIndex,
  sampleCenter,
  voxelIndex,
} from "../../world/coordinates.js";
import type { VoxelSample, WorldContext } from "../../world/types.js";
import { generateTestChunk, type VoxelChunk } from "../chunk.js";

/**
 * Common assembly owner. The test path delegates to the accepted generator
 * unchanged, preserving all four buffers and the original eight-lane columns.
 * Main columns use context.columns.stride; core/halo ordering stays identical.
 */
export function generateWorldChunk(
  context: WorldContext,
  cx: number,
  cy: number,
  cz: number,
  spacing = 1,
): VoxelChunk {
  if (context.kind === "test")
    return generateTestChunk({ seed: context.seed, cx, cy, cz, spacing });
  const minX = sampleCenter(cx, -1, spacing);
  const minZ = sampleCenter(cz, -1, spacing);
  const maxX = sampleCenter(cx, 32, spacing);
  const maxZ = sampleCenter(cz, 32, spacing);
  sampleCenter(cy, 39, spacing);
  const area = context.prepareArea({ minX, minZ, maxX, maxZ });
  const stride = context.columns.stride;
  const blocks = new Uint16Array(CHUNK_VOLUME);
  const haloBlocks = new Uint16Array(HALO_VOLUME);
  const density = new Float64Array(HALO_VOLUME);
  const columns = new Float64Array(HALO_WIDTH * HALO_WIDTH * stride);
  const column = area.createColumn();
  const voxel: VoxelSample = { density: 0, block: 0, fluid: 0 };
  for (let z = -1; z <= CHUNK_SIZE; z++) {
    const wz = sampleCenter(cz, z, spacing);
    for (let x = -1; x <= CHUNK_SIZE; x++) {
      const wx = sampleCenter(cx, x, spacing);
      area.sampleColumn(wx, wz, column);
      columns.set(column, (x + 1 + HALO_WIDTH * (z + 1)) * stride);
      for (let y = -1; y < CHUNK_SIZE + HALO_ABOVE; y++) {
        area.sampleVoxel(wx, sampleCenter(cy, y, spacing), wz, voxel, column);
        const h = haloIndex(x, y, z);
        haloBlocks[h] = voxel.block;
        density[h] = voxel.density;
        if (x >= 0 && x < 32 && y >= 0 && y < 32 && z >= 0 && z < 32)
          blocks[voxelIndex(x, y, z)] = voxel.block;
      }
    }
  }
  return {
    seed: context.seed,
    version: context.worldgenVersion,
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
