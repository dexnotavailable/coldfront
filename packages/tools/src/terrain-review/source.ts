import {
  WORLD_MAX_XZ,
  WORLD_MAX_Y,
  WORLD_MIN_XZ,
  WORLD_MIN_Y,
} from "../../../shared/src/world/constants.js";
import type {
  WorldContext,
  WorldKind,
  WorldPlan,
} from "../../../shared/src/world/types.js";
import { createWorldContext } from "../../../shared/src/world/world-context.js";
import { buildWorldPlan } from "../../../shared/src/worldplan/index.js";

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
  /** Actual immutable plan; null for the accepted test generator. */
  readonly plan?: Pick<
    WorldPlan,
    "sites" | "surfaceWeights" | "layerWeights" | "footprint"
  > | null;
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
 * sampling. Context construction/plan building belongs outside sampling timings.
 */
export function sourceFromContext(context: WorldContext): TerrainReviewSource {
  const raw = context.createColumn(),
    layout = context.columns;
  return {
    world: context.kind,
    seed: context.seed,
    version: context.worldgenVersion,
    plan: context.plan,
    bounds: {
      minXZ: WORLD_MIN_XZ,
      maxXZ: WORLD_MAX_XZ,
      minY: WORLD_MIN_Y,
      maxY: WORLD_MAX_Y,
    },
    writeSurface(x, z, out) {
      checkXZ(x, z);
      context.sampleColumn(x, z, raw);
      out.height = Number(raw[layout.height]);
      out.dx = Number(raw[layout.gradientX]);
      out.dz = Number(raw[layout.gradientZ]);
      const water = Number(raw[layout.waterLevel]);
      out.waterLevel = Number.isFinite(water) ? water : null;
    },
    column(x, z) {
      checkXZ(x, z);
      const area = context.prepareArea({ minX: x, minZ: z, maxX: x, maxZ: z });
      const column = area.sampleColumn(x, z, area.createColumn());
      const voxel = { density: 0, block: 0, fluid: 0 };
      return {
        x,
        z,
        writeVoxel(y, out) {
          if (!Number.isFinite(y))
            throw new RangeError("Voxel height must be finite");
          area.sampleVoxel(x, y, z, voxel, column);
          out.block = voxel.block;
          out.fluid = voxel.fluid;
          out.density = voxel.density;
        },
      };
    },
  };
}
export function createReviewSource(
  world: WorldKind,
  seed: number,
): TerrainReviewSource {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new RangeError("Seed must be an unsigned 32-bit integer");
  return sourceFromContext(
    createWorldContext(
      world === "test"
        ? { kind: "test", seed }
        : { kind: "main", seed, plan: buildWorldPlan(seed) },
    ),
  );
}
export function createTestWorldSource(seed: number): TerrainReviewSource {
  return createReviewSource("test", seed);
}
