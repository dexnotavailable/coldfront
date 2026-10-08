import { BLOCK_REGISTRY } from "../../../shared/src/blocks/registry.js";
import {
  createLightVolume,
  type LightVolume,
  lightIndex,
} from "../../../shared/src/lighting/flood.js";
import { createNoise2Sample } from "../../../shared/src/noise/opensimplex2.js";
import { HALO_VOLUME } from "../../../shared/src/world/constants.js";
import { haloIndex } from "../../../shared/src/world/coordinates.js";
import {
  Column,
  collectTestTrees,
  createColumnSample,
  createVoxelSample,
  sampleTestColumn,
  sampleTestVoxel,
} from "../../../shared/src/worldgen/test-world.js";
import type { BenchmarkCase } from "./samples.js";

/**
 * Real unedited 3x3x3 LOD0 neighbourhood for the accepted shared skylight solver.
 * Preparation is separately timed; the lighting metric measures solveLight.
 * Sources follow the client's height/feature-band rule and 64m blocker limit.
 * No sky light is manufactured for underground air or substituted for BFS.
 */
export function prepareChunkLighting(sample: BenchmarkCase): LightVolume {
  if (sample.spacing !== 1)
    throw new Error("Neighbourhood BFS benchmark is LOD0 only");
  const volume = createLightVolume(96, 96, 96);
  const ox = sample.cx * 32 - 32;
  const oy = sample.cy * 32 - 32;
  const oz = sample.cz * 32 - 32;
  const column = createColumnSample();
  const noise = createNoise2Sample();
  const voxel = createVoxelSample();
  const trees = collectTestTrees(
    sample.seed,
    ox + 0.5,
    oz + 0.5,
    ox + 95.5,
    oz + 95.5,
  );
  for (let z = 0; z < 96; z++)
    for (let x = 0; x < 96; x++) {
      const wx = ox + x + 0.5;
      const wz = oz + z + 0.5;
      sampleTestColumn(sample.seed, wx, wz, column, noise);
      for (let y = 0; y < 96; y++) {
        const id = sampleTestVoxel(
          sample.seed,
          wx,
          oy + y + 0.5,
          wz,
          voxel,
          column,
          trees,
        ).block;
        volume.opacity[lightIndex(volume, x, y, z)] =
          BLOCK_REGISTRY[id]?.lightFiltering ?? 15;
      }
      let highest = column[Column.Height] as number;
      for (const tree of trees) {
        const dx = wx - tree.x;
        const dz = wz - tree.z;
        if (dx * dx + dz * dz <= tree.crownRadius * tree.crownRadius)
          highest = Math.max(
            highest,
            tree.crownY + tree.crownHeight,
            tree.trunkTop,
          );
      }
      const topY = oy + 95;
      let incoming =
        highest > topY + 64
          ? 15
          : topY < (column[Column.Height] as number) - 1
            ? 0
            : 15;
      for (
        let wy = Math.min(topY + 64, Math.ceil(highest));
        incoming > 0 && wy > topY;
        wy--
      ) {
        const id = sampleTestVoxel(
          sample.seed,
          wx,
          wy + 0.5,
          wz,
          voxel,
          column,
          trees,
        ).block;
        incoming = Math.max(
          0,
          incoming - (BLOCK_REGISTRY[id]?.lightFiltering ?? 15),
        );
      }
      const top = lightIndex(volume, x, 95, z);
      volume.sources[top] =
        Math.max(0, incoming - (volume.opacity[top] as number)) << 12;
    }
  return volume;
}
/** Exact central halo extraction; measured separately from BFS and meshing. */
export function extractHaloLight(volume: LightVolume): Uint16Array {
  if (volume.width !== 96 || volume.depth !== 96 || volume.height !== 96)
    throw new Error("Expected a 96-cubed neighbourhood");
  const halo = new Uint16Array(HALO_VOLUME);
  for (let y = -1; y < 40; y++)
    for (let z = -1; z <= 32; z++)
      for (let x = -1; x <= 32; x++)
        halo[haloIndex(x, y, z)] = volume.light[
          lightIndex(volume, x + 32, y + 32, z + 32)
        ] as number;
  return halo;
}
