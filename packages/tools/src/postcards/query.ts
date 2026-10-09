import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import type {
  SurfaceRegionId,
  VoxelSample,
  WorldAreaSampler,
  WorldContext,
} from "../../../shared/src/world/types.js";

export interface CameraQuery {
  voxel(x: number, y: number, z: number): Readonly<VoxelSample>;
  ground(x: number, z: number): number;
  height(x: number, z: number): number;
  region(x: number, z: number): SurfaceRegionId | null;
  clear(): void;
}
/** Bounded caches of prepared feature areas and Float64 columns; no client/Node
 * sampler implementation. All answers come from the exact shared context. */
export function cameraQuery(context: WorldContext): CameraQuery {
  const areas = new Map<string, WorldAreaSampler>();
  const columns = new Map<
    string,
    { c: Float64Array; area: WorldAreaSampler; region?: SurfaceRegionId | null }
  >();
  const sample: VoxelSample = { density: 0, block: 0, fluid: 0 };
  const weights = {
    count: 0,
    ids: new Uint8Array(16),
    weights: new Float64Array(16),
  };
  const column = (x: number, z: number) => {
    const ix = Math.floor(x),
      iz = Math.floor(z),
      key = `${ix},${iz}`;
    let entry = columns.get(key);
    if (!entry) {
      const cx = Math.floor(ix / 32),
        cz = Math.floor(iz / 32),
        tile = `${cx},${cz}`;
      let area = areas.get(tile);
      if (!area) {
        area = context.prepareArea({
          minX: cx * 32 + 0.5,
          minZ: cz * 32 + 0.5,
          maxX: cx * 32 + 31.5,
          maxZ: cz * 32 + 31.5,
        });
        areas.set(tile, area);
        if (areas.size > 128) areas.delete(areas.keys().next().value as string);
      }
      entry = {
        area,
        c: area.sampleColumn(ix + 0.5, iz + 0.5, area.createColumn()),
      };
      columns.set(key, entry);
      if (columns.size > 32768)
        columns.delete(columns.keys().next().value as string);
    }
    return entry;
  };
  const inFrame = (x: number, z: number) =>
    x >= -22528 && x < 22528 && z >= -22528 && z < 22528;
  return {
    voxel(x, y, z) {
      if (!inFrame(x, z) || y >= 1024)
        return { density: -Infinity, block: Block.Air, fluid: 0 };
      if (y < -1536) return { density: 1, block: Block.Worldstone, fluid: 0 };
      const entry = column(x, z);
      return entry.area.sampleVoxel(
        Math.floor(x) + 0.5,
        Math.floor(y) + 0.5,
        Math.floor(z) + 0.5,
        sample,
        entry.c,
      );
    },
    ground(x, z) {
      return Math.ceil(Number(column(x, z).c[context.columns.height]) - 0.5);
    },
    height(x, z) {
      if (!inFrame(x, z)) return -Infinity;
      const c = column(x, z).c;
      return Math.max(
        Number(c[context.columns.height]),
        Number(c[context.columns.waterLevel]),
      );
    },
    region(x, z) {
      if (!inFrame(x, z) || !context.regions.length) return null;
      const entry = column(x, z);
      if (entry.region === undefined) {
        context.surfaceWeights(
          Math.floor(x) + 0.5,
          Math.floor(z) + 0.5,
          weights,
        );
        entry.region =
          context.regions.find((r) => r.index === weights.ids[0])?.id ?? null;
      }
      return entry.region;
    },
    clear() {
      columns.clear();
      areas.clear();
    },
  };
}
export function walkableEye(
  q: CameraQuery,
  x: number,
  eyeY: number,
  z: number,
): boolean {
  const feet = eyeY - 1.62;
  for (const dx of [-0.29, 0.29])
    for (const dz of [-0.29, 0.29]) {
      if (!BLOCK_REGISTRY[q.voxel(x + dx, feet - 0.01, z + dz).block]?.solid)
        return false;
      for (const dy of [0.05, 0.9, 1.79])
        if (q.voxel(x + dx, feet + dy, z + dz).block !== Block.Air)
          return false;
    }
  return true;
}
