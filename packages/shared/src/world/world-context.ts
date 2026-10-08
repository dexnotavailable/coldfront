import { createNoise2Sample } from "../noise/opensimplex2.js";
import {
  collectMainTrees,
  MAIN_TREE_MAX_RISE,
  MAIN_TREE_RADIUS,
  sampleMainVoxel,
} from "../worldgen/main/features.js";
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
import { WORLD_MAX_XZ, WORLD_MIN_XZ } from "./constants.js";
import { REGION_IDS, SURFACE_REGIONS } from "./regions.js";
import type {
  SkyInput,
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
    const prepareArea = (bounds: XZBounds): WorldAreaSampler => {
      checkBounds(bounds);
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
  const field = createMainField(options.plan, options.plan.sites.bridges);
  const workspace = createGeometryWorkspace();
  const anchorWeights = createRegionWeights();
  const prepareArea = (bounds: XZBounds): WorldAreaSampler => {
    checkBounds(bounds);
    const trees = collectMainTrees(field, bounds);
    const local = field.createColumn();
    return {
      kind: "main",
      seed,
      columns: MAIN_COLUMN_LAYOUT,
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
        ),
      skyInput: (x, z, out, column) => {
        const c = column ?? field.sampleColumn(x, z, local);
        return skyFrom(
          Number(c[MainColumn.Height]),
          Number(c[MainColumn.WaterLevel]),
          x,
          z,
          trees,
          out,
        );
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
      return out;
    },
  } satisfies WorldContext);
}
