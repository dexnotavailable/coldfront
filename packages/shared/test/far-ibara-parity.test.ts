import { describe, expect, it } from "vitest";
import { createSpineSample, sampleSpine } from "../src/sdf/spine.js";
import type {
  IbaraPlanData,
  VoxelSample,
  WorldContext,
  WorldPlanData,
} from "../src/world/types.js";
import { createWorldContext } from "../src/world/world-context.js";
import { createMainIbaraField } from "../src/worldgen/main/features.js";
import { createMainField } from "../src/worldgen/main/surface.js";
import { WORLDGEN_VERSION } from "../src/worldgen/version.js";
import { createBridges } from "../src/worldplan/bridges.js";
import { createUndergroundCells } from "../src/worldplan/geometry.js";
import { canonicalPlanGrid } from "../src/worldplan/grid.js";

// Reuse the existing ibara-world.test.ts authored local-caldera/constant-DEM
// fixture verbatim. A local copy avoids importing and registering that entire
// test suite or changing its ownership. No WorldPlan builder/census runs here.
/** A small authored package, not a generated region or a population audit. */
function ibaraFixture(): IbaraPlanData {
  const count = 17 * 17;
  const sourceCalderaIds = new Uint32Array(count);
  sourceCalderaIds[8 + 8 * 17] = 1;
  return {
    schema: 1,
    seed: 7,
    bounds: { minX: 5632, minZ: 5632, maxX: 6656, maxZ: 6656 },
    calderas: [
      {
        id: 1,
        x: 6144,
        z: 6144,
        radius: 180,
        baseY: 40,
        floorY: 16,
        rimHeight: 50,
        rimWidth: 40,
        lavaRadius: 90,
        lavaLevel: 30,
        bounds: {
          minX: 5924,
          minZ: 5924,
          maxX: 6364,
          maxZ: 6364,
          minY: 16,
          maxY: 90,
        },
      },
    ],
    channels: [
      {
        id: 0x10001,
        calderaId: 1,
        points: new Float64Array([
          6144, 6144, 25, 30, 5, 6400, 6144, 19, 25, 5, 6528, 6208, 17, 22, 5,
        ]),
        leveeWidth: 8,
        leveeHeight: 3,
        sink: "cooled",
        bounds: {
          minX: 6131,
          minZ: 6131,
          maxX: 6541,
          maxZ: 6221,
          minY: 0,
          maxY: 100,
        },
      },
    ],
    vents: [
      {
        id: 0x20001,
        x: 5888,
        z: 6144,
        baseY: 44,
        height: 6,
        radius: 8,
        mouthRadius: 2,
        bounds: {
          minX: 5880,
          minZ: 6136,
          maxX: 5896,
          maxZ: 6152,
          minY: 0,
          maxY: 60,
        },
      },
    ],
    routing: {
      grid: { minX: 5632, minZ: 5632, width: 17, depth: 17, spacing: 64 },
      terrain: new Float64Array(count).fill(40),
      routingHeight: new Float64Array(count).fill(40),
      receivers: new Int32Array(count).fill(-1),
      routingOrder: Uint32Array.from({ length: count }, (_, i) => i),
      drainageArea: new Float64Array(count).fill(4096),
      sourceCalderaIds,
    },
  };
}
/** Canonical buffer sizes with constant DEM: no full plan builder runs here. */
function worldFixture(): WorldPlanData {
  const grid = canonicalPlanGrid(),
    count = grid.width * grid.depth;
  const basinIds = new Uint32Array(count);
  const pond = (-8192 - grid.minX) / 64;
  for (let z = pond - 2; z <= pond + 2; z++)
    for (let x = pond - 2; x <= pond + 2; x++) basinIds[x + z * grid.width] = 1;
  return {
    schema: 2,
    seed: 7,
    worldgenVersion: WORLDGEN_VERSION,
    grid,
    terrainMacro: new Float64Array(count).fill(40),
    routingHeight: new Float64Array(count).fill(40),
    receivers: new Int32Array(count).fill(-1),
    routingOrder: Uint32Array.from({ length: count }, (_, i) => i),
    drainageArea: new Float64Array(count).fill(4096),
    basinIds,
    waterBodies: [{ id: 1, kind: "water", level: 44, source: "pond" }],
    undergroundCells: createUndergroundCells(7),
    ibara: ibaraFixture(),
    sites: {
      seats: Array.from({ length: 30 }, (_, i) => ({
        id: `seat-${i}`,
        region: "plains",
        layer: "surface",
        x: -8192,
        z: -8192,
      })),
      forts: Array.from({ length: 106 }, (_, i) => ({
        id: `fort-${i}`,
        seatId: "seat-0",
        region: "plains",
        layer: "surface",
        x: -8192,
        z: -8192,
      })),
      descents: [],
      bridges: createBridges(7),
      spawns: Array.from({ length: 256 }, (_, i) => ({
        id: `spawn-${i}`,
        region: "plains",
        x: -8000,
        z: -8000,
        surfaceY: 40,
        rank: i,
      })),
    },
  };
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing real Ibara parity fixture");
  return value;
}
interface Point {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
function landmarkPoint(data: WorldPlanData): Point {
  const field = createMainField(data, data.sites.bridges, data.ibara);
  const features = createMainIbaraField(field);
  // Same six-cell bounded landmark lookup used by ibara-world.test.ts.
  const parameters = [
    [3, 3],
    [4, 3],
    [3, 4],
    [4, 4],
    [5, 3],
    [3, 5],
  ].flatMap(([x, z]) =>
    features.parametersForCell(required(x), required(z), true),
  )[0];
  const landmark = required(parameters);
  const thorn = required(
    features
      .landmarks(landmark.cellX, landmark.cellZ)
      .find((candidate) => candidate.parameters.id === landmark.id),
  );
  const point = sampleSpine(
    required(thorn.sweeps[0]).spine,
    0.6,
    createSpineSample(),
  );
  return { x: point.x, y: point.y, z: point.z };
}
interface NearSnapshot {
  readonly density: Float64Array;
  readonly blocks: Uint16Array;
  readonly fluids: Uint16Array;
  readonly featureIds: Uint32Array;
  readonly featureT: Float64Array;
  readonly columns: Float64Array;
}
/** 3x3 columns, five centre samples each: 45 real voxel samples per near LOD. */
function nearSnapshot(
  context: WorldContext,
  point: Point,
  spacing: 1 | 2,
): NearSnapshot {
  const x = (Math.floor(point.x / spacing) + 0.5) * spacing;
  const y = (Math.floor(point.y / spacing) + 0.5) * spacing;
  const z = (Math.floor(point.z / spacing) + 0.5) * spacing;
  const area = context.prepareArea(
    {
      minX: x - spacing,
      maxX: x + spacing,
      minZ: z - spacing,
      maxZ: z + spacing,
    },
    spacing,
  );
  const result: NearSnapshot = {
    density: new Float64Array(45),
    blocks: new Uint16Array(45),
    fluids: new Uint16Array(45),
    featureIds: new Uint32Array(45),
    featureT: new Float64Array(45),
    columns: new Float64Array(9 * area.columns.stride),
  };
  const column = area.createColumn();
  const voxel: VoxelSample = { density: 0, block: 0, fluid: 0 };
  let index = 0;
  for (let iz = -1; iz <= 1; iz++)
    for (let ix = -1; ix <= 1; ix++) {
      const wx = x + ix * spacing,
        wz = z + iz * spacing;
      area.sampleColumn(wx, wz, column);
      result.columns.set(column, (ix + 1 + 3 * (iz + 1)) * area.columns.stride);
      for (let iy = -2; iy <= 2; iy++) {
        area.sampleVoxel(wx, y + iy * spacing, wz, voxel, column);
        result.density[index] = voxel.density;
        result.blocks[index] = voxel.block;
        result.fluids[index] = voxel.fluid;
        result.featureIds[index] = voxel.featureId ?? 0;
        result.featureT[index] = voxel.featureT ?? 0;
        index++;
      }
    }
  expect(result.featureIds.some((id) => id !== 0)).toBe(true);
  return result;
}
/** Six direct prepared-area probes at a real landmark; no whole far-tile sweep. */
function coarseSnapshot(context: WorldContext, point: Point): Float64Array {
  const result = new Float64Array(30);
  let index = 0;
  for (const spacing of [8, 64]) {
    const area = required(context.prepareFarArea)(
      {
        minX: point.x - spacing,
        maxX: point.x + spacing,
        minZ: point.z - spacing,
        maxZ: point.z + spacing,
      },
      { spacing, layer: "surface" },
    );
    expect(area.featureBounds.length).toBeGreaterThan(0);
    const column = area.sampleColumn(point.x, point.z, area.createColumn());
    for (const dy of [-spacing / 2, 0, spacing / 2]) {
      const voxel = area.sampleVoxel(
        point.x,
        point.y + dy,
        point.z,
        { density: 0, block: 0, fluid: 0 },
        column,
      );
      if (dy === 0) expect(voxel.featureId).toBeGreaterThan(0);
      result.set(
        [
          voxel.density,
          voxel.block,
          voxel.fluid,
          voxel.featureId ?? 0,
          voxel.featureT ?? 0,
        ],
        index,
      );
      index += 5;
    }
  }
  return result;
}
function expectSameNearBytes(
  actual: NearSnapshot,
  expected: NearSnapshot,
): void {
  for (const field of [
    "density",
    "blocks",
    "fluids",
    "featureIds",
    "featureT",
    "columns",
  ] as const)
    expect(new Uint8Array(actual[field].buffer)).toEqual(
      new Uint8Array(expected[field].buffer),
    );
}

describe("real generated Ibara far/near order parity", () => {
  it("preserves LOD0/1 bytes through coarse-first and near-first requests in fresh contexts", () => {
    const data = worldFixture();
    const point = landmarkPoint(data);
    const nearFirst = createWorldContext({
      kind: "main",
      seed: data.seed,
      plan: data,
    });
    const coarseFirst = createWorldContext({
      kind: "main",
      seed: data.seed,
      plan: data,
    });
    const before = [
      nearSnapshot(nearFirst, point, 1),
      nearSnapshot(nearFirst, point, 2),
    ];
    const farAfterNear = coarseSnapshot(nearFirst, point);
    const farBeforeNear = coarseSnapshot(coarseFirst, point);
    expect(new Uint8Array(farBeforeNear.buffer)).toEqual(
      new Uint8Array(farAfterNear.buffer),
    );
    for (const [index, spacing] of ([1, 2] as const).entries()) {
      const expected = required(before[index]);
      expectSameNearBytes(nearSnapshot(coarseFirst, point, spacing), expected);
      expectSameNearBytes(nearSnapshot(nearFirst, point, spacing), expected);
    }
  });
});
