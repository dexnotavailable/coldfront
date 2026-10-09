import { BLOCK_REGISTRY } from "../../../shared/src/blocks/registry.js";
import {
  createLightVolume,
  emissionLight,
  type LightVolume,
  lightIndex,
} from "../../../shared/src/lighting/flood.js";
import { HALO_VOLUME } from "../../../shared/src/world/constants.js";
import { haloIndex } from "../../../shared/src/world/coordinates.js";
import type { WorldContext } from "../../../shared/src/world/types.js";
import type { BenchmarkCase } from "./samples.js";

const emissions = Uint16Array.from(BLOCK_REGISTRY, (b) =>
  emissionLight(b.emission),
);

/**
 * Real unedited 3x3x3 LOD0 neighbourhood for the accepted shared skylight solver.
 * Preparation is separately timed; the lighting metric measures solveLight.
 * Sources follow the client's height/feature-band rule and 64m blocker limit.
 * No sky light is manufactured for underground air or substituted for BFS.
 */
export function prepareChunkLighting(
  sample: BenchmarkCase,
  context: WorldContext,
): LightVolume {
  if (sample.spacing !== 1)
    throw new Error("Neighbourhood BFS benchmark is LOD0 only");
  if (context.kind !== sample.world || context.seed !== sample.seed)
    throw new Error("Benchmark sample and world context differ");
  const volume = createLightVolume(96, 96, 96);
  const ox = sample.cx * 32 - 32;
  const oy = sample.cy * 32 - 32;
  const oz = sample.cz * 32 - 32;
  const area = context.prepareArea({
    minX: ox + 0.5,
    minZ: oz + 0.5,
    maxX: ox + 95.5,
    maxZ: oz + 95.5,
  });
  const column = area.createColumn();
  const voxel = { density: 0, block: 0, fluid: 0 };
  const sky = { solidBelowY: 0, highestFilterY: 0 };
  for (let z = 0; z < 96; z++)
    for (let x = 0; x < 96; x++) {
      const wx = ox + x + 0.5;
      const wz = oz + z + 0.5;
      area.sampleColumn(wx, wz, column);
      for (let y = 0; y < 96; y++) {
        const id = area.sampleVoxel(wx, oy + y + 0.5, wz, voxel, column).block;
        const i = lightIndex(volume, x, y, z);
        volume.opacity[i] = BLOCK_REGISTRY[id]?.lightFiltering ?? 15;
        volume.sources[i] = emissions[id] ?? 0;
      }
      area.skyInput(wx, wz, sky, column);
      const highest = sky.highestFilterY;
      const topY = oy + 95;
      let incoming =
        highest > topY + 64 ? 15 : topY < sky.solidBelowY - 1 ? 0 : 15;
      for (
        let wy = Math.min(topY + 64, Math.ceil(highest));
        incoming > 0 && wy > topY;
        wy--
      ) {
        const id = area.sampleVoxel(wx, wy + 0.5, wz, voxel, column).block;
        incoming = Math.max(
          0,
          incoming - (BLOCK_REGISTRY[id]?.lightFiltering ?? 15),
        );
      }
      const top = lightIndex(volume, x, 95, z);
      volume.sources[top] =
        ((volume.sources[top] as number) & 0x0fff) |
        (Math.max(0, incoming - (volume.opacity[top] as number)) << 12);
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
