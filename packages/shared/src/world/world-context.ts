import { BLOCK_REGISTRY } from "../blocks/registry.js";
import { IBARA_CELL_SIZE, IBARA_MAX_REACH } from "../features/ibara/cells.js";
import { createNoise2Sample } from "../noise/opensimplex2.js";
import {
  allowsMainFloatingFeature,
  createCrumbCleanup,
} from "../worldgen/main/crumb-cleanup.js";
import {
  collectMainTrees,
  createMainIbaraField,
  MAIN_TREE_MAX_RISE,
  MAIN_TREE_RADIUS,
  mainFeatureCacheStats,
  mayContainIbara,
  prepareIbaraSampler,
  prepareMainIbara,
  resolveMainFluids,
  sampleMainVoxel,
  suppressMainSolid,
} from "../worldgen/main/features.js";
import {
  createPrimitiveIbaraBatch,
  PRIMITIVE_IBARA_HEIGHT,
  PRIMITIVE_IBARA_RADIUS,
} from "../worldgen/main/ibara-primitive.js";
import { createIbaraAnalytic } from "../worldgen/main/ibara-volcanic.js";
import {
  createMainField,
  MAIN_COLUMN_LAYOUT,
  MainColumn,
} from "../worldgen/main/surface.js";
import {
  Column,
  collectTestTrees,
  createColumnSample,
  sampleTestColumn,
  sampleTestVoxel,
  TEST_POND,
  testWorldSpawn,
} from "../worldgen/test-world.js";
import { WORLDGEN_VERSION } from "../worldgen/version.js";
import {
  createGeometryWorkspace,
  createRegionWeights,
  surfaceWeights,
} from "../worldplan/geometry.js";
import { hydrateWorldPlan } from "../worldplan/query.js";
import {
  WORLD_MAX_XZ,
  WORLD_MAX_Y,
  WORLD_MIN_XZ,
  WORLD_MIN_Y,
} from "./constants.js";
import { REGION_IDS, SURFACE_REGIONS } from "./regions.js";
import type {
  CleanupCacheStats,
  SkyInput,
  VoxelSample,
  WorldAreaSampler,
  WorldBounds,
  WorldContext,
  WorldContextOptions,
  XZ,
  XZBounds,
} from "./types.js";

export type { WorldContext, WorldContextOptions } from "./types.js";

function inFrame(x: number, z: number): boolean {
  return (
    x >= WORLD_MIN_XZ &&
    x < WORLD_MAX_XZ &&
    z >= WORLD_MIN_XZ &&
    z < WORLD_MAX_XZ
  );
}
function checkBounds(bounds: XZBounds): void {
  if (
    ![bounds.minX, bounds.minZ, bounds.maxX, bounds.maxZ].every(
      Number.isFinite,
    ) ||
    bounds.minX > bounds.maxX ||
    bounds.minZ > bounds.maxZ ||
    bounds.maxX < WORLD_MIN_XZ ||
    bounds.minX >= WORLD_MAX_XZ ||
    bounds.maxZ < WORLD_MIN_XZ ||
    bounds.minZ >= WORLD_MAX_XZ
  )
    throw new RangeError("Area does not intersect the canonical frame");
}
function checkSpacing(spacing: number, main: boolean): void {
  if (
    !Number.isFinite(spacing) ||
    spacing <= 0 ||
    (main && (spacing < 1 || spacing > 64))
  )
    throw new RangeError(
      main
        ? "Unsupported Ibara sample spacing"
        : "Sample spacing must be finite and positive",
    );
}
function skyFrom(
  columnHeight: number,
  waterLevel: number,
  x: number,
  z: number,
  trees: readonly {
    readonly x: number;
    readonly z: number;
    readonly crownRadius: number;
    readonly crownY: number;
    readonly crownHeight: number;
    readonly trunkTop: number;
  }[],
  out: SkyInput,
): SkyInput {
  if (!inFrame(x, z)) {
    out.solidBelowY = -Infinity;
    out.highestFilterY = -Infinity;
    return out;
  }
  out.solidBelowY = columnHeight;
  out.highestFilterY = Math.max(columnHeight, waterLevel);
  for (const tree of trees) {
    const dx = x - tree.x;
    const dz = z - tree.z;
    if (dx * dx + dz * dz <= tree.crownRadius * tree.crownRadius)
      out.highestFilterY = Math.max(
        out.highestFilterY,
        tree.crownY + tree.crownHeight,
        tree.trunkTop,
      );
  }
  return out;
}
const TEST_LAYOUT = Object.freeze({
  stride: Column.Stride,
  height: Column.Height,
  gradientX: Column.Dx,
  gradientZ: Column.Dz,
  waterLevel: Column.WaterLevel,
});
// A triangle kernel has at most three corners. Max of (0.5-r²)^4*r occurs
// at r²=0.5/9. This loose analytic bound exceeds the actual normalised range;
// it is not a sampled maximum or a hidden nine-point height estimate.
const KERNEL_RADIUS = Math.sqrt(0.5 / 9);
const KERNEL_ATTENUATION = 0.5 - KERNEL_RADIUS * KERNEL_RADIUS;
const TEST_NOISE_BOUND =
  3 *
    99.83685446303647 *
    KERNEL_ATTENUATION *
    KERNEL_ATTENUATION *
    KERNEL_ATTENUATION *
    KERNEL_ATTENUATION *
    KERNEL_RADIUS +
  1e-8;
const TEST_LOW = Math.min(-4, 9 - 17.8 * TEST_NOISE_BOUND);
const TEST_HIGH = Math.max(11.75, 9 + 17.8 * TEST_NOISE_BOUND);
export function createWorldContext(options: WorldContextOptions): WorldContext {
  const { seed } = options;
  if (!Number.isInteger(seed) || seed < -2147483648 || seed > 4294967295)
    throw new RangeError("World seed must be a32-bit word");
  if (options.kind === "test") {
    const prepareArea = (bounds: XZBounds, spacing = 1): WorldAreaSampler => {
      checkBounds(bounds);
      checkSpacing(spacing, false);
      const trees = collectTestTrees(
        seed,
        bounds.minX,
        bounds.minZ,
        bounds.maxX,
        bounds.maxZ,
      );
      const noise = createNoise2Sample();
      const local = createColumnSample();
      return {
        kind: "test",
        seed,
        columns: TEST_LAYOUT,
        createColumn: createColumnSample,
        sampleColumn: (x, z, out) => sampleTestColumn(seed, x, z, out, noise),
        sampleVoxel(x, y, z, out, column) {
          const c = column ?? sampleTestColumn(seed, x, z, local, noise);
          return sampleTestVoxel(
            seed,
            x,
            y,
            z,
            out as Parameters<typeof sampleTestVoxel>[4],
            c,
            trees,
          );
        },
        skyInput(x, z, out, column) {
          const c = column ?? sampleTestColumn(seed, x, z, local, noise);
          return skyFrom(
            Number(c[Column.Height]),
            Number(c[Column.WaterLevel]),
            x,
            z,
            trees,
            out,
          );
        },
      };
    };
    const local = createColumnSample();
    const noise = createNoise2Sample();
    const pointArea = (x: number, z: number): WorldAreaSampler =>
      prepareArea({ minX: x, minZ: z, maxX: x, maxZ: z });
    return Object.freeze({
      kind: "test",
      seed,
      worldgenVersion: WORLDGEN_VERSION,
      plan: null,
      regions: Object.freeze([]),
      columns: TEST_LAYOUT,
      spawn: Object.freeze(testWorldSpawn()),
      regionAnchor: () => null,
      createColumn: createColumnSample,
      sampleColumn: (x, z, out) => sampleTestColumn(seed, x, z, out, noise),
      sampleVoxel: (x, y, z, out, column) => {
        if (!inFrame(x, z))
          return sampleTestVoxel(
            seed,
            x,
            y,
            z,
            out as Parameters<typeof sampleTestVoxel>[4],
          );
        return pointArea(x, z).sampleVoxel(x, y, z, out, column);
      },
      skyInput: (x, z, out, column) => {
        if (!inFrame(x, z)) {
          out.solidBelowY = -Infinity;
          out.highestFilterY = -Infinity;
          return out;
        }
        return pointArea(x, z).skyInput(x, z, out, column);
      },
      prepareArea,
      surfaceWeights: (_x, _z, out) => {
        out.count = 0;
        out.ids.fill(255);
        out.weights.fill(0);
        return out;
      },
      waterQuery: (x, z, out) => {
        sampleTestColumn(seed, x, z, local, noise);
        const level = inFrame(x, z)
          ? Number(local[Column.WaterLevel])
          : -Infinity;
        out.bodyId = level === -Infinity ? 0 : 1;
        out.kind = level === -Infinity ? "none" : "water";
        out.level = level;
        return out;
      },
      conservativeBounds: (bounds, out) => {
        checkBounds(bounds);
        out.minSurfaceY = TEST_LOW;
        out.maxSurfaceY = TEST_HIGH;
        out.maxSolidY = TEST_HIGH;
        const cells =
          ((bounds.maxX - bounds.minX) / 40 + 3) *
          ((bounds.maxZ - bounds.minZ) / 40 + 3);
        if (cells <= 4096)
          for (const tree of collectTestTrees(
            seed,
            bounds.minX,
            bounds.minZ,
            bounds.maxX,
            bounds.maxZ,
          ))
            out.maxSolidY = Math.max(
              out.maxSolidY,
              tree.crownY + tree.crownHeight,
              tree.trunkTop,
            );
        else out.maxSolidY += 12; // Derived from actual test-tree parameter maxima, not a sample guess.
        out.maxFluidY =
          bounds.maxX >= TEST_POND.x - TEST_POND.radiusX &&
          bounds.minX <= TEST_POND.x + TEST_POND.radiusX &&
          bounds.maxZ >= TEST_POND.z - TEST_POND.radiusZ &&
          bounds.minZ <= TEST_POND.z + TEST_POND.radiusZ
            ? 0
            : -Infinity;
        return out;
      },
    } satisfies WorldContext);
  }
  if (options.plan.seed !== seed)
    throw new Error("Plan seed differs from world request");
  const plan = hydrateWorldPlan(options.plan);
  const field = createMainField(
    options.plan,
    options.plan.sites.bridges,
    options.plan.ibara,
  );
  const volcanic = field.ibara;
  if (!volcanic) throw new Error("Main plan has no volcanic field");
  if (
    options.variant !== undefined &&
    options.variant !== "production" &&
    options.variant !== "primitive"
  )
    throw new Error("Unknown generation variant");
  const primitive = options.variant === "primitive";
  const features = primitive ? null : createMainIbaraField(field);
  const environment = {
    seed,
    surfaceAt: volcanic.height,
    weightAt: createIbaraAnalytic(seed).weight,
  };
  const featureStats = (references: number) =>
    features
      ? mainFeatureCacheStats(features, references)
      : {
          geometryCells: 0,
          geometryCellLimit: 0,
          placementCells: 0,
          placementCellLimit: 0,
          cachedInstances: 0,
          preparedInstanceReferences: references,
        };
  const workspace = createGeometryWorkspace();
  const anchorWeights = createRegionWeights();
  interface RawArea extends WorldAreaSampler {
    refill(
      x: number,
      y: number,
      z: number,
      out: VoxelSample,
      column?: Float64Array,
    ): VoxelSample;
    readonly localColumnBytes: number;
  }
  // Private raw areas are independent of the requesting rectangle. The cleaner
  // must never recurse through prepareArea or classify with its feature batch.
  const prepareRawArea = (bounds: XZBounds, spacing = 1): RawArea => {
    checkBounds(bounds);
    checkSpacing(spacing, true);
    const trees = collectMainTrees(field, bounds);
    const ibara = mayContainIbara(bounds)
      ? features
        ? prepareMainIbara(volcanic, features, bounds, spacing)
        : prepareIbaraSampler(
            volcanic,
            environment.weightAt,
            createPrimitiveIbaraBatch(environment, bounds, spacing),
            spacing,
          )
      : undefined;
    const local = field.createColumn();
    return {
      kind: "main",
      seed,
      columns: MAIN_COLUMN_LAYOUT,
      featureCacheStats: () => featureStats(ibara?.batch.instances.length ?? 0),
      localColumnBytes: local.byteLength,
      refill: (x, y, z, out, column) =>
        resolveMainFluids(
          x,
          y,
          z,
          out,
          column ?? field.sampleColumn(x, z, local),
          ibara,
        ),
      createColumn: field.createColumn,
      sampleColumn: field.sampleColumn,
      sampleVoxel: (x, y, z, out, column) =>
        sampleMainVoxel(
          x,
          y,
          z,
          out,
          column ?? field.sampleColumn(x, z, local),
          trees,
          ibara,
        ),
      skyInput: (x, z, out, column) => {
        const c = column ?? field.sampleColumn(x, z, local);
        skyFrom(
          Number(c[MainColumn.Height]),
          Number(c[MainColumn.WaterLevel]),
          x,
          z,
          trees,
          out,
        );
        if (ibara && inFrame(x, z)) {
          const lava = ibara.sampleLava
            ? ibara.sampleLava(x, z, ibara.lavaSample)
            : volcanic.lavaQuery(x, z, ibara.lavaSample);
          out.highestFilterY = Math.max(out.highestFilterY, lava.level);
          for (const thorn of ibara.batch.instances) {
            const b = thorn.bounds;
            if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ)
              out.highestFilterY = Math.max(out.highestFilterY, b.maxY);
          }
          out.highestFilterY = Math.min(WORLD_MAX_Y, out.highestFilterY);
        }
        return out;
      },
    };
  };
  const RAW_AREA_LIMIT = 8;
  const RAW_COLUMN_LIMIT = 1024;
  const rawAreas = new Map<string, RawArea>();
  // Columns deliberately hold no area reference: evicting an area cannot leave
  // its potentially large feature batch hidden in this separate column LRU.
  const rawColumns = new Map<string, Float64Array>();
  const rawColumn = (ix: number, iz: number): Float64Array => {
    const key = `${ix},${iz}`;
    let column = rawColumns.get(key);
    if (column) rawColumns.delete(key);
    else column = field.sampleColumn(ix + 0.5, iz + 0.5, field.createColumn());
    rawColumns.set(key, column);
    if (rawColumns.size > RAW_COLUMN_LIMIT) {
      const oldest = rawColumns.keys().next().value;
      if (oldest !== undefined) rawColumns.delete(oldest);
    }
    return column;
  };
  const rawArea = (ix: number, iz: number): RawArea => {
    const ox = Math.floor(ix / 32) * 32;
    const oz = Math.floor(iz / 32) * 32;
    const key = `${ox},${oz}`;
    let area = rawAreas.get(key);
    if (area) rawAreas.delete(key);
    else
      area = prepareRawArea({
        minX: ox + 0.5,
        minZ: oz + 0.5,
        maxX: ox + 31.5,
        maxZ: oz + 31.5,
      });
    rawAreas.set(key, area);
    if (rawAreas.size > RAW_AREA_LIMIT) {
      const oldest = rawAreas.keys().next().value;
      if (oldest !== undefined) rawAreas.delete(oldest);
    }
    return area;
  };
  const rawVoxel: VoxelSample = { density: 0, block: 0, fluid: 0 };
  const sampleRaw = (ix: number, iy: number, iz: number): VoxelSample =>
    rawArea(ix, iz).sampleVoxel(
      ix + 0.5,
      iy + 0.5,
      iz + 0.5,
      rawVoxel,
      rawColumn(ix, iz),
    );
  const cleanup = createCrumbCleanup({
    rawSolidAt: (ix, iy, iz) =>
      Boolean(BLOCK_REGISTRY[sampleRaw(ix, iy, iz).block]?.solid),
    // Current complete ground is a height field; all later features are additive.
    // Every in-frame centre below it has a solid vertical path to its owner's
    // bottom. Future cave/carver integration must replace or disable this proof.
    provenSolidBelow: (ix, iz) => Number(rawColumn(ix, iz)[MainColumn.Height]),
    allowsFloating: (ix, iy, iz) => {
      const voxel = sampleRaw(ix, iy, iz);
      // Ibara owns all current nonzero feature IDs, including overhangs beyond
      // its regional footprint. No underground floating features exist yet.
      const featureId = voxel.featureId ?? 0;
      return allowsMainFloatingFeature({
        region: featureId
          ? "hellscape"
          : (REGION_IDS[Number(rawColumn(ix, iz)[MainColumn.DominantRegion])] ??
            "plains"),
        layer: "surface",
        featureId,
      });
    },
  });
  const cleanupCacheStats = (): CleanupCacheStats => {
    let rawColumnBufferBytes = 0,
      rawAreaColumnBufferBytes = 0,
      rawPreparedInstanceReferences = 0;
    for (const column of rawColumns.values())
      rawColumnBufferBytes += column.byteLength;
    for (const area of rawAreas.values()) {
      rawAreaColumnBufferBytes += area.localColumnBytes;
      rawPreparedInstanceReferences +=
        area.featureCacheStats?.().preparedInstanceReferences ?? 0;
    }
    return {
      ...cleanup.statistics(),
      rawAreas: rawAreas.size,
      rawAreaLimit: RAW_AREA_LIMIT,
      rawColumns: rawColumns.size,
      rawColumnLimit: RAW_COLUMN_LIMIT,
      rawColumnBufferBytes,
      rawAreaColumnBufferBytes,
      rawPreparedInstanceReferences,
    };
  };
  const prepareArea = (bounds: XZBounds, spacing = 1): WorldAreaSampler => {
    const raw = prepareRawArea(bounds, spacing);
    if (spacing !== 1) return raw;
    return {
      ...raw,
      cleanupCacheStats,
      sampleVoxel(x, y, z, out, column) {
        raw.sampleVoxel(x, y, z, out, column);
        // Negative raw samples are already empty with the correct owned fluid.
        // A zero at a removed cell's subvoxel surface must also become negative.
        if (
          out.density >= 0 &&
          cleanup.removed(Math.floor(x), Math.floor(y), Math.floor(z))
        ) {
          suppressMainSolid(out);
          raw.refill(x, y, z, out, column);
        }
        return out;
      },
    };
  };
  const pointArea = (x: number, z: number): WorldAreaSampler =>
    prepareArea({ minX: x, minZ: z, maxX: x, maxZ: z });
  const local = field.createColumn();
  const first = plan.sites.spawns[0];
  if (!first) throw new Error("Main world has no spawn");
  return Object.freeze({
    kind: "main",
    seed,
    worldgenVersion: plan.worldgenVersion,
    plan,
    regions: SURFACE_REGIONS,
    columns: MAIN_COLUMN_LAYOUT,
    featureCacheStats: () => featureStats(0),
    cleanupCacheStats,
    spawn: Object.freeze({
      x: first.x,
      y: Math.ceil(first.surfaceY - 0.5),
      z: first.z,
    }),
    regionAnchor: (id) => {
      const spawn = plan.sites.spawns.find((site) => site.region === id);
      const seat = plan.sites.seats.find(
        (site) => site.layer === "surface" && site.region === id,
      );
      const firstBridge = plan.sites.bridges[0];
      let point: XZ | null = spawn
        ? { x: spawn.x, z: spawn.z }
        : seat
          ? { x: seat.x, z: seat.z }
          : id === "blackwater"
            ? firstBridge
              ? {
                  x:
                    Number(firstBridge.centreline[10]) +
                    0.7 *
                      (Number(firstBridge.centreline[12]) -
                        Number(firstBridge.centreline[10])),
                  z:
                    Number(firstBridge.centreline[11]) +
                    0.7 *
                      (Number(firstBridge.centreline[13]) -
                        Number(firstBridge.centreline[11])),
                }
              : null
            : id === "rim"
              ? { x: 0, z: -21000 }
              : id === "frost"
                ? { x: 0, z: -22000 }
                : null;
      if (point) {
        surfaceWeights(seed, point.x, point.z, anchorWeights, workspace);
        if (REGION_IDS[Number(anchorWeights.ids[0])] !== id) point = null;
      }
      if (!point) throw new Error(`Missing dominant surface anchor: ${id}`);
      return Object.freeze(point);
    },
    createColumn: field.createColumn,
    sampleColumn: field.sampleColumn,
    sampleVoxel: (x, y, z, out, column) => {
      if (!inFrame(x, z))
        return sampleMainVoxel(
          x,
          y,
          z,
          out,
          column ?? field.sampleColumn(x, z, local),
          [],
        );
      return pointArea(x, z).sampleVoxel(x, y, z, out, column);
    },
    skyInput: (x, z, out, column) => {
      if (!inFrame(x, z)) {
        out.solidBelowY = -Infinity;
        out.highestFilterY = -Infinity;
        return out;
      }
      return pointArea(x, z).skyInput(x, z, out, column);
    },
    prepareArea,
    surfaceWeights: (x, z, out) => surfaceWeights(seed, x, z, out, workspace),
    waterQuery: field.waterQuery,
    conservativeBounds: (bounds, out) => {
      checkBounds(bounds);
      field.surfaceBounds(bounds, out);
      const cells =
        ((bounds.maxX - bounds.minX) / 40 + 3) *
        ((bounds.maxZ - bounds.minZ) / 40 + 3);
      if (cells <= 4096)
        for (const tree of collectMainTrees(field, bounds))
          out.maxSolidY = Math.max(
            out.maxSolidY,
            tree.crownY + tree.crownHeight,
            tree.trunkTop,
          );
      else {
        const expanded: WorldBounds = {
          minSurfaceY: 0,
          maxSurfaceY: 0,
          maxSolidY: 0,
          maxFluidY: -Infinity,
        };
        field.surfaceBounds(
          {
            minX: bounds.minX - MAIN_TREE_RADIUS,
            minZ: bounds.minZ - MAIN_TREE_RADIUS,
            maxX: bounds.maxX + MAIN_TREE_RADIUS,
            maxZ: bounds.maxZ + MAIN_TREE_RADIUS,
          },
          expanded,
        );
        out.maxSolidY = Math.max(
          out.maxSolidY,
          expanded.maxSurfaceY + MAIN_TREE_MAX_RISE,
        );
      }
      if (mayContainIbara(bounds)) {
        if (!features) {
          const expanded: WorldBounds = {
            minSurfaceY: 0,
            maxSurfaceY: 0,
            maxSolidY: 0,
            maxFluidY: -Infinity,
          };
          field.surfaceBounds(
            {
              minX: bounds.minX - PRIMITIVE_IBARA_RADIUS,
              minZ: bounds.minZ - PRIMITIVE_IBARA_RADIUS,
              maxX: bounds.maxX + PRIMITIVE_IBARA_RADIUS,
              maxZ: bounds.maxZ + PRIMITIVE_IBARA_RADIUS,
            },
            expanded,
          );
          out.maxSolidY = Math.min(
            WORLD_MAX_Y,
            Math.max(
              out.maxSolidY,
              expanded.maxSurfaceY + PRIMITIVE_IBARA_HEIGHT,
            ),
          );
          return out;
        }
        const cellsX =
          Math.floor((bounds.maxX + IBARA_MAX_REACH) / IBARA_CELL_SIZE) -
          Math.floor((bounds.minX - IBARA_MAX_REACH) / IBARA_CELL_SIZE) +
          1;
        const cellsZ =
          Math.floor((bounds.maxZ + IBARA_MAX_REACH) / IBARA_CELL_SIZE) -
          Math.floor((bounds.minZ - IBARA_MAX_REACH) / IBARA_CELL_SIZE) +
          1;
        if (cellsX * cellsZ <= 256) {
          for (const thorn of features.collect(
            { ...bounds, minY: WORLD_MIN_Y, maxY: WORLD_MAX_Y },
            1,
          ))
            out.maxSolidY = Math.max(out.maxSolidY, thorn.bounds.maxY);
        } else {
          const expanded: WorldBounds = {
            minSurfaceY: 0,
            maxSurfaceY: 0,
            maxSolidY: 0,
            maxFluidY: -Infinity,
          };
          field.surfaceBounds(
            {
              minX: bounds.minX - IBARA_MAX_REACH,
              minZ: bounds.minZ - IBARA_MAX_REACH,
              maxX: bounds.maxX + IBARA_MAX_REACH,
              maxZ: bounds.maxZ + IBARA_MAX_REACH,
            },
            expanded,
          );
          // Arch controls reach 1.6*350m; polygon padding, fillets,
          // displacement and 32m LOD thickening fit within the 768m envelope.
          // Roots/debris may anchor anywhere in the expanded footprint.
          out.maxSolidY = Math.max(
            out.maxSolidY,
            expanded.maxSurfaceY + IBARA_MAX_REACH,
          );
        }
        out.maxSolidY = Math.min(WORLD_MAX_Y, out.maxSolidY);
      }
      return out;
    },
  } satisfies WorldContext);
}
