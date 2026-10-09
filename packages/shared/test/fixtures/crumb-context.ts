/** Synthetic raw field plugged into the REAL WorldContext/cleanup/fluid paths.
 * No WorldPlan build, placement, production geometry, archive, or render. */
import { vi } from "vitest";
import type { IbaraSample } from "../../src/features/ibara/types.js";
import type {
  IbaraGroundSample,
  LavaSample,
  WorldBounds,
  WorldContext,
  WorldPlanData,
  XZBounds,
} from "../../src/world/types.js";
import type { MainIbaraField } from "../../src/worldgen/main/features.js";
import type { IbaraGround } from "../../src/worldgen/main/ibara-ground.js";
import { MainColumn } from "../../src/worldgen/main/surface.js";

export type CrumbCell = readonly [number, number, number];
export const CRUMB_ID = 0xfedcba99;
export const CRUMB_T = 0.8500000000000001;
export interface CrumbFixtureOptions {
  cells: readonly CrumbCell[];
  ground?: number;
  waterLevel?: number;
  lava?: { bodyId: number; bed: number; level: number };
  zeroAt?: CrumbCell;
}
export async function syntheticCrumbContext(
  options: CrumbFixtureOptions,
): Promise<WorldContext> {
  vi.resetModules();
  const groundHeight = options.ground ?? -100;
  const column = (x: number, z: number, out: Float64Array) => {
    out.fill(0);
    out[MainColumn.Height] = groundHeight;
    out[MainColumn.NaturalHeight] = groundHeight;
    out[MainColumn.WaterLevel] = options.waterLevel ?? -Infinity;
    out[MainColumn.DistanceScale] = 1;
    out[MainColumn.BridgeMargin] = -Infinity;
    out[MainColumn.BridgeTop] = -Infinity;
    out[MainColumn.DominantRegion] = 9;
    out[MainColumn.PaletteRegion] = 9;
    // Keep coordinates used so accidental column reuse is visible to tests.
    out[MainColumn.Macro] = x;
    out[MainColumn.Meso] = z;
    return out;
  };
  const lavaQuery = (_x: number, _z: number, out: LavaSample) =>
    Object.assign(
      out,
      options.lava
        ? {
            ...options.lava,
            kind: "lava",
            source: "channel",
          }
        : {
            bodyId: 0,
            bed: -Infinity,
            level: -Infinity,
            kind: "none",
            source: "none",
          },
    );
  const ground: IbaraGround = {
    height: () => groundHeight,
    sample: (_x: number, y: number, _z: number, out: IbaraGroundSample) =>
      Object.assign(out, {
        density: groundHeight - y,
        surfaceY: groundHeight,
        tag: "base",
      }),
    lavaQuery,
    lavaAt: (_x, _z, out) => out.fill(0),
    conservativeBounds: (bounds, out) => surfaceBounds(bounds, out),
  };
  const surfaceBounds = (_bounds: XZBounds, out: WorldBounds) =>
    Object.assign(out, {
      minSurfaceY: groundHeight,
      maxSurfaceY: groundHeight,
      maxSolidY: groundHeight,
      maxFluidY: Math.max(
        options.waterLevel ?? -Infinity,
        options.lava?.level ?? -Infinity,
      ),
    });
  const cells = options.cells;
  const makeSampler = (bounds: XZBounds, spacing: number) => {
    const selected = cells.filter(
      ([x, _y, z]) =>
        x + 1 >= bounds.minX &&
        x <= bounds.maxX &&
        z + 1 >= bounds.minZ &&
        z <= bounds.maxZ,
    );
    const selectedSet = new Set(selected.map((p) => p.join(",")));
    return {
      ground,
      spacing,
      groundSample: { density: 0, surfaceY: 0, tag: "base" as const },
      featureSample: {} as IbaraSample,
      lavaSample: {} as LavaSample,
      batch: {
        instances: selected.map(([x, y, z]) => ({
          bounds: {
            minX: x,
            minY: y,
            minZ: z,
            maxX: x + 1,
            maxY: y + 1,
            maxZ: z + 1,
          },
        })),
        density(
          terrain: number,
          x: number,
          y: number,
          z: number,
          _spacing: number,
          out: IbaraSample,
        ) {
          const occupied = selectedSet.has(
            `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`,
          );
          Object.assign(out, {
            featureId: occupied ? CRUMB_ID : 0,
            t: occupied ? CRUMB_T : 0,
            core: "obsidian",
            crust: "ember",
            kind: occupied ? "thorn" : "none",
            broken: false,
          });
          const zero = options.zeroAt;
          const d =
            zero && x === zero[0] && y === zero[1] && z === zero[2] ? 0 : 0.125;
          return occupied ? Math.max(terrain, d) : terrain;
        },
      },
    };
  };
  vi.doMock("../../src/worldplan/query.js", () => ({
    hydrateWorldPlan: (plan: WorldPlanData) => ({ ...plan, data: plan }),
  }));
  vi.doMock("../../src/worldgen/main/surface.js", async (original) => ({
    ...(await original<typeof import("../../src/worldgen/main/surface.js")>()),
    createMainField: () => ({
      ibara: ground,
      createColumn: () => new Float64Array(MainColumn.Stride),
      sampleColumn: column,
      surfaceBounds,
      waterQuery: (_x: number, _z: number, out: object) =>
        Object.assign(out, {
          bodyId: options.waterLevel === undefined ? 0 : 1,
          kind: options.waterLevel === undefined ? "none" : "water",
          level: options.waterLevel ?? -Infinity,
        }),
    }),
  }));
  vi.doMock("../../src/worldgen/main/features.js", async (original) => ({
    ...(await original<typeof import("../../src/worldgen/main/features.js")>()),
    collectMainTrees: () => [],
    mayContainIbara: () => true,
    createMainIbaraField: () => ({
      cachedCellCount: 0,
      cachedPlacementCellCount: 0,
      cachedInstanceCount: 0,
      cacheCapacity: 0,
      collect: () =>
        makeSampler(
          { minX: -Infinity, minZ: -Infinity, maxX: Infinity, maxZ: Infinity },
          1,
        ).batch.instances,
    }),
    prepareMainIbara: (
      _ground: IbaraGround,
      _field: MainIbaraField,
      bounds: XZBounds,
      spacing: number,
    ) => makeSampler(bounds, spacing),
  }));
  try {
    const { createWorldContext } = await import(
      "../../src/world/world-context.js"
    );
    return createWorldContext({
      kind: "main",
      seed: 7,
      plan: {
        seed: 7,
        worldgenVersion: 4,
        sites: {
          spawns: [{ x: 0, z: 0, surfaceY: groundHeight }],
          bridges: [],
        },
      } as unknown as WorldPlanData,
    });
  } finally {
    vi.doUnmock("../../src/worldplan/query.js");
    vi.doUnmock("../../src/worldgen/main/surface.js");
    vi.doUnmock("../../src/worldgen/main/features.js");
  }
}
