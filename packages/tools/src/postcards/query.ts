import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import type {
  SurfaceRegionId,
  VoxelSample,
  WorldAreaSampler,
  WorldBounds,
  WorldContext,
  XZBounds,
} from "../../../shared/src/world/types.js";

export interface CameraQuery {
  voxel(x: number, y: number, z: number): Readonly<VoxelSample>;
  ground(x: number, z: number): number;
  height(x: number, z: number): number;
  region(x: number, z: number): SurfaceRegionId | null;
  bounds(bounds: XZBounds): Readonly<WorldBounds>;
  walkableFeet(x: number, z: number, minY: number, maxY: number): number | null;
  clear(): void;
}
/** Bounded caches of prepared feature areas and Float64 columns; no client/Node
 * sampler implementation. All answers come from the exact shared context. */
export function cameraQuery(context: WorldContext): CameraQuery {
  const areas = new Map<string, WorldAreaSampler>();
  const intervals = new Map<string, Readonly<WorldBounds>>();
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
  const query: CameraQuery = {
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
    bounds(bounds) {
      const result: WorldBounds = {
        minSurfaceY: Infinity,
        maxSurfaceY: -Infinity,
        maxSolidY: -Infinity,
        maxFluidY: -Infinity,
      };
      for (
        let z = Math.floor(bounds.minZ / 32);
        z <= Math.floor(bounds.maxZ / 32);
        z++
      )
        for (
          let x = Math.floor(bounds.minX / 32);
          x <= Math.floor(bounds.maxX / 32);
          x++
        ) {
          const key = `${x},${z}`;
          let bound = intervals.get(key);
          if (!bound) {
            bound = Object.freeze(
              context.conservativeBounds(
                {
                  minX: x * 32,
                  minZ: z * 32,
                  maxX: x * 32 + 32,
                  maxZ: z * 32 + 32,
                },
                {
                  minSurfaceY: 0,
                  maxSurfaceY: 0,
                  maxSolidY: 0,
                  maxFluidY: -Infinity,
                },
              ),
            );
            intervals.set(key, bound);
            if (intervals.size > 4096)
              intervals.delete(intervals.keys().next().value as string);
          }
          result.minSurfaceY = Math.min(result.minSurfaceY, bound.minSurfaceY);
          result.maxSurfaceY = Math.max(result.maxSurfaceY, bound.maxSurfaceY);
          result.maxSolidY = Math.max(result.maxSolidY, bound.maxSolidY);
          result.maxFluidY = Math.max(result.maxFluidY, bound.maxFluidY);
        }
      return result;
    },
    walkableFeet(x, z, minY, maxY) {
      if (
        !inFrame(x, z) ||
        !Number.isFinite(minY) ||
        !Number.isFinite(maxY) ||
        minY > maxY
      )
        return null;
      const low = Math.max(-1535, Math.ceil(minY)),
        high = Math.min(1022, Math.floor(maxY));
      // The column is only a hint. Check actual support and the whole body at
      // every proposed integer voxel-top surface, including overhangs.
      const hint = Math.max(low, Math.min(high, query.ground(x, z)));
      for (let offset = 0; offset <= high - low; offset++) {
        for (const feet of offset === 0
          ? [hint]
          : [hint + offset, hint - offset])
          if (
            feet >= low &&
            feet <= high &&
            walkableEye(query, x, feet + 1.62, z)
          )
            return feet;
      }
      return null;
    },
    clear() {
      columns.clear();
      areas.clear();
      intervals.clear();
    },
  };
  return query;
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
      const support = q.voxel(x + dx, feet - 0.01, z + dz);
      if (!(support.density > 0) || !BLOCK_REGISTRY[support.block]?.solid)
        return false;
      for (const dy of [0.05, 0.9, 1.79])
        if (q.voxel(x + dx, feet + dy, z + dz).block !== Block.Air)
          return false;
    }
  return true;
}
