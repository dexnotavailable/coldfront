import { ibaraMask } from "../../../shared/src/features/ibara/cells.js";
import { instantiateThorn } from "../../../shared/src/features/ibara/shape.js";
import type {
  IbaraEnvironment,
  ThornParameters,
} from "../../../shared/src/features/ibara/types.js";
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
import { createMainIbaraField } from "../../../shared/src/worldgen/main/features.js";
import { createIbaraAnalytic } from "../../../shared/src/worldgen/main/ibara-volcanic.js";
import { createMainField } from "../../../shared/src/worldgen/main/surface.js";
import { buildWorldPlan } from "../../../shared/src/worldplan/index.js";

export interface FeatureMaskSample {
  weight: number;
  thorn: number;
}
/** Uses the same production factories and immutable plan as the live context.
 * Building this adapter constructs no thorn curves. */
export function ibaraReviewFromContext(context: WorldContext) {
  if (context.kind !== "main" || !context.plan)
    throw new Error("Ibara diagnostics require a production main context");
  const data = context.plan.data;
  const field = createMainField(data, data.sites.bridges, data.ibara);
  const ground = field.ibara;
  if (!ground) throw new Error("Production volcanic ground is unavailable");
  const features = createMainIbaraField(field);
  const environment: IbaraEnvironment = {
    seed: context.seed,
    surfaceAt: ground.height,
    weightAt: features.groundWeightAt,
    lavaAt: ground.lavaAt,
  };
  return {
    context,
    plan: data.ibara,
    features,
    environment,
    mask: (x: number, z: number) => ibaraMask(environment, x, z),
    instantiate: (p: ThornParameters) => instantiateThorn(p, environment),
  };
}
export type IbaraReview = ReturnType<typeof ibaraReviewFromContext>;

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
  /** Optional production mask adapter; no placement or noise formulas in tools. */
  writeFeatureMasks?(x: number, z: number, out: FeatureMaskSample): void;
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
  // A feature atlas samples the shared analytic mask only, never instantiates
  // geometry or prepares a 45 km feature batch.
  const analytic =
    context.kind === "main" ? createIbaraAnalytic(context.seed) : null;
  const maskEnvironment: IbaraEnvironment | null = analytic
    ? {
        seed: context.seed,
        surfaceAt: () => {
          throw new Error("Mask queries must not request geometry");
        },
        weightAt: analytic.weight,
      }
    : null;
  return {
    world: context.kind,
    seed: context.seed,
    version: context.worldgenVersion,
    plan: context.plan,
    ...(maskEnvironment
      ? {
          writeFeatureMasks(x: number, z: number, out: FeatureMaskSample) {
            checkXZ(x, z);
            out.weight = maskEnvironment.weightAt(x, z);
            out.thorn = ibaraMask(maskEnvironment, x, z);
          },
        }
      : {}),
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
