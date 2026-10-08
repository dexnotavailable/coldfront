import { createNoise2Sample } from "../../../shared/src/noise/opensimplex2.js";
import {
  WORLD_MAX_XZ,
  WORLD_MAX_Y,
  WORLD_MIN_XZ,
  WORLD_MIN_Y,
} from "../../../shared/src/world/constants.js";
import {
  Column,
  collectTestTrees,
  createColumnSample,
  createVoxelSample,
  sampleTestColumn,
  sampleTestVoxel,
} from "../../../shared/src/worldgen/test-world.js";
import { WORLDGEN_VERSION } from "../../../shared/src/worldgen/version.js";

export interface SurfaceSample {
  height: number;
  dx: number;
  dz: number;
  waterLevel: number | null;
}
export interface ReviewVoxel {
  density: number;
  block: number;
  fluid: number;
}
export interface VerticalColumn {
  readonly x: number;
  readonly z: number;
  /** Writes the exact continuous point sample; never rounds to a nearby cache cell. */
  writeVoxel(y: number, out: ReviewVoxel): void;
}
export interface TerrainReviewSource {
  readonly world: string;
  readonly seed: number;
  readonly version: number;
  readonly bounds: Readonly<{
    minXZ: number;
    maxXZ: number;
    minY: number;
    maxY: number;
  }>;
  /** Terrain height excludes canopy/decoration; gradients are metres per metre. */
  writeSurface(x: number, z: number, out: SurfaceSample): void;
  /** A caller-owned exact column, reusable across every y of a slice. */
  column(x: number, z: number): VerticalColumn;
}
function checkXZ(x: number, z: number): void {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(z) ||
    x < WORLD_MIN_XZ ||
    z < WORLD_MIN_XZ ||
    x >= WORLD_MAX_XZ ||
    z >= WORLD_MAX_XZ
  )
    throw new RangeError("Sample is outside the half-open world XZ bounds");
}
export function createSurfaceSample(): SurfaceSample {
  return { height: 0, dx: 0, dz: 0, waterLevel: null };
}
/**
 * Node tools adapt the accepted pointwise generator without changing it.
 * Scratch is local to this source instance; every result is determined only by
 * seed and requested position. No renderer, neighbour order, I/O or clock enters
 * sampling. A future WorldPlan source implements the same narrow interface.
 */
export function createTestWorldSource(seed: number): TerrainReviewSource {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new RangeError("Seed must be an unsigned 32-bit integer");
  const raw = createColumnSample(),
    noise = createNoise2Sample();
  return {
    world: "test",
    seed,
    version: WORLDGEN_VERSION,
    bounds: {
      minXZ: WORLD_MIN_XZ,
      maxXZ: WORLD_MAX_XZ,
      minY: WORLD_MIN_Y,
      maxY: WORLD_MAX_Y,
    },
    writeSurface(x, z, out) {
      checkXZ(x, z);
      sampleTestColumn(seed, x, z, raw, noise);
      out.height = Number(raw[Column.Height]);
      out.dx = Number(raw[Column.Dx]);
      out.dz = Number(raw[Column.Dz]);
      const water = Number(raw[Column.WaterLevel]);
      out.waterLevel = Number.isFinite(water) ? water : null;
    },
    column(x, z) {
      checkXZ(x, z);
      const column = sampleTestColumn(seed, x, z, createColumnSample());
      const trees = collectTestTrees(seed, x, z, x, z),
        voxel = createVoxelSample();
      return {
        x,
        z,
        writeVoxel(y, out) {
          if (!Number.isFinite(y))
            throw new RangeError("Voxel height must be finite");
          sampleTestVoxel(seed, x, y, z, voxel, column, trees);
          out.block = voxel.block;
          out.fluid = voxel.fluid;
          out.density = voxel.density;
        },
      };
    },
  };
}
