import { describe, expect, it, vi } from "vitest";
import {
  clonePlanBuffers,
  planBytes,
  planChecksum,
} from "../../client/src/engine/plan-transport.js";
import { validateWorldPlan } from "../../client/src/engine/plan-validation.js";
import { Block } from "../src/blocks/registry.js";
import { createIbaraBatch } from "../src/features/ibara/field.js";
import { instantiateThorn } from "../src/features/ibara/shape.js";
import {
  createIbaraSample,
  type ThornParameters,
} from "../src/features/ibara/types.js";
import { createSpineSample, sampleSpine } from "../src/sdf/spine.js";
import { HALO_VOLUME, WORLD_MAX_Y } from "../src/world/constants.js";
import {
  haloIndex,
  sampleCenter,
  voxelIndex,
} from "../src/world/coordinates.js";
import type {
  IbaraPlanData,
  VoxelSample,
  WorldAreaSampler,
  WorldContext,
  WorldPlanData,
} from "../src/world/types.js";
import { createWorldContext } from "../src/world/world-context.js";
import { generateWorldChunk } from "../src/worldgen/main/chunk.js";
import {
  createMainIbaraField,
  type MainIbaraSampler,
  mainFeatureCacheStats,
  mayContainIbara,
  prepareMainIbara,
  sampleMainVoxel,
} from "../src/worldgen/main/features.js";
import {
  createIbaraGround,
  type IbaraGround,
} from "../src/worldgen/main/ibara-ground.js";
import { createIbaraAnalytic } from "../src/worldgen/main/ibara-volcanic.js";
import {
  createMainField,
  MAIN_COLUMN_LAYOUT,
  MainColumn,
} from "../src/worldgen/main/surface.js";
import { WORLDGEN_VERSION } from "../src/worldgen/version.js";
import { createBridges } from "../src/worldplan/bridges.js";
import { createUndergroundCells } from "../src/worldplan/geometry.js";
import { canonicalPlanGrid } from "../src/worldplan/grid.js";
import { buildIbaraPlan } from "../src/worldplan/ibara.js";
import { createLavaSample } from "../src/worldplan/lava.js";
import {
  hydrateWorldPlan,
  validateIbaraPlanData,
} from "../src/worldplan/query.js";

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
  if (value === undefined) throw new Error("Missing adapter test fixture");
  return value;
}
const voxel = (): VoxelSample => ({
  density: 0,
  block: 0,
  fluid: 0,
  featureId: 99,
  featureT: 0.91,
});
const bounds = () => ({
  minSurfaceY: 0,
  maxSurfaceY: 0,
  maxSolidY: 0,
  maxFluidY: -Infinity,
});

describe("Ibara plan boundary", () => {
  it("review regression: rejects finite channel geometry that implies unbounded index work", () => {
    const endpoint = ibaraFixture();
    required(endpoint.channels[0]).points[5] = 1e20;
    const oversizedEndpoint = {
      ...endpoint,
      channels: [
        {
          ...required(endpoint.channels[0]),
          bounds: { ...required(endpoint.channels[0]).bounds, maxX: 1e20 },
        },
      ],
    };
    // Validator only: never construct runtime buckets from the malformed input.
    expect(() => validateIbaraPlanData(oversizedEndpoint, 7)).toThrow();
    const width = ibaraFixture();
    required(width.channels[0]).points[4] = 1e20;
    const oversizedWidth = {
      ...width,
      channels: [
        {
          ...required(width.channels[0]),
          bounds: {
            minX: -1e20,
            minZ: -1e20,
            maxX: 1e20,
            maxZ: 1e20,
            minY: 0,
            maxY: 100,
          },
        },
      ],
    };
    expect(() => validateIbaraPlanData(oversizedWidth, 7)).toThrow();
  });
  it("bounds feature tables, segment tables and cumulative in-domain index work", () => {
    const data = ibaraFixture();
    const channel = required(data.channels[0]);
    expect(() =>
      validateIbaraPlanData(
        {
          ...data,
          channels: Array.from({ length: 7 }, (_, i) => ({
            ...channel,
            id: channel.id + i,
          })),
        },
        7,
      ),
    ).toThrow(/table limit/);
    const points = new Float64Array(53 * 5);
    for (let i = 0; i < 53; i++)
      points.set([6144 + (i % 2), 6144, 25 - i * 0.1, 30 - i * 0.1, 5], i * 5);
    expect(() =>
      validateIbaraPlanData({ ...data, channels: [{ ...channel, points }] }, 7),
    ).toThrow(/channel/);
    const count = 129 * 129;
    const sourceCalderaIds = new Uint32Array(count);
    sourceCalderaIds[96 + 96 * 129] = 1;
    const stretched: IbaraPlanData = {
      ...data,
      bounds: { minX: 0, minZ: 0, maxX: 8192, maxZ: 8192 },
      channels: [
        {
          ...channel,
          points: new Float64Array([
            6144, 6144, 25, 30, 5, 128, 128, 19, 25, 5, 6528, 6208, 17, 22, 5,
          ]),
          bounds: {
            minX: 115,
            minZ: 115,
            maxX: 6541,
            maxZ: 6221,
            minY: 0,
            maxY: 100,
          },
        },
      ],
      routing: {
        grid: { minX: 0, minZ: 0, width: 129, depth: 129, spacing: 64 },
        terrain: new Float64Array(count).fill(40),
        routingHeight: new Float64Array(count).fill(40),
        receivers: new Int32Array(count).fill(-1),
        routingOrder: Uint32Array.from({ length: count }, (_, i) => i),
        drainageArea: new Float64Array(count).fill(4096),
        sourceCalderaIds,
      },
    };
    expect(() => validateIbaraPlanData(stretched, 7)).toThrow(/index work/);
  });
  it("accepts the bounded volcanic builder output before main sites exist", () => {
    const base = createMainField(
      {
        seed: 7,
        grid: { minX: 4096, minZ: 4096, width: 65, depth: 65, spacing: 64 },
        terrainMacro: new Float64Array(65 * 65).fill(40),
        basinIds: new Uint32Array(65 * 65),
        waterBodies: [],
      },
      [],
    );
    expect(() =>
      validateIbaraPlanData(buildIbaraPlan(base.data, base), 7),
    ).not.toThrow();
  });
  it("validates bounded local geometry and rejects corrupt ownership, bounds and drainage", () => {
    expect(() => validateIbaraPlanData(ibaraFixture(), 7)).not.toThrow();
    const mutations: ((p: IbaraPlanData) => IbaraPlanData)[] = [
      (p) => ({ ...p, seed: 8 }),
      (p) => ({
        ...p,
        channels: [{ ...required(p.channels[0]), calderaId: 9 }],
      }),
      (p) => ({
        ...p,
        calderas: [required(p.calderas[0]), required(p.calderas[0])],
      }),
      (p) => ({ ...p, calderas: [{ ...required(p.calderas[0]), radius: -1 }] }),
      (p) => ({
        ...p,
        calderas: [
          {
            ...required(p.calderas[0]),
            bounds: { ...required(p.calderas[0]).bounds, maxY: 42 },
          },
        ],
      }),
      (p) => ({
        ...p,
        vents: [{ ...required(p.vents[0]), mouthRadius: Infinity }],
      }),
      (p) => ({
        ...p,
        routing: { ...p.routing, terrain: new Float64Array(2) },
      }),
      (p) => {
        p.routing.routingOrder[1] = 0;
        return p;
      },
      (p) => {
        p.routing.receivers[0] = 1;
        return p;
      },
      (p) => {
        p.routing.sourceCalderaIds.fill(0);
        return p;
      },
      (p) => {
        p.routing.sourceCalderaIds[0] = 9;
        return p;
      },
      (p) => {
        required(p.channels[0]).points[8] = 31;
        return p;
      },
      (p) => {
        required(p.channels[0]).points[4] = 0;
        return p;
      },
      (p) => {
        required(p.channels[0]).points[0] =
          Number(required(p.channels[0]).points[0]) + 1;
        return p;
      },
    ];
    for (const mutate of mutations)
      expect(() => validateIbaraPlanData(mutate(ibaraFixture()), 7)).toThrow();
  });
  it("clones all nested buffers with and without shared memory; hashes every new field", async () => {
    const original = { ibara: ibaraFixture() };
    const expectedBytes = 17 * 17 * (8 * 3 + 4 * 3) + 15 * 8;
    expect(planBytes(original)).toBe(expectedBytes);
    const checksum = await planChecksum(original);
    for (const shared of [false, true]) {
      const copy = clonePlanBuffers(original, shared);
      expect(copy).toEqual(original);
      expect(await planChecksum(copy)).toBe(checksum);
      expect(planBytes(copy)).toBe(expectedBytes);
      const arrays = [
        copy.ibara.routing.terrain,
        copy.ibara.routing.routingHeight,
        copy.ibara.routing.receivers,
        copy.ibara.routing.routingOrder,
        copy.ibara.routing.drainageArea,
        copy.ibara.routing.sourceCalderaIds,
        required(copy.ibara.channels[0]).points,
      ];
      for (const array of arrays)
        expect(array.buffer instanceof SharedArrayBuffer).toBe(shared);
      required(copy.ibara.channels[0]).points[2] =
        Number(required(copy.ibara.channels[0]).points[2]) - 1;
      expect(required(original.ibara.channels[0]).points[2]).toBe(25);
      expect(await planChecksum(copy)).not.toBe(checksum);
    }
    const changed = clonePlanBuffers(original, false);
    changed.ibara.routing.terrain[0] =
      Number(changed.ibara.routing.terrain[0]) + 1;
    expect(await planChecksum(changed)).not.toBe(checksum);
    expect(
      await planChecksum({ ibara: { ...original.ibara, vents: [] } }),
    ).not.toBe(checksum);
    expect(original.ibara.routing.terrain.byteLength).toBe(17 * 17 * 8);
  });
  it("hydrates schema 2, preserves the plan owner's arrays and rejects old cached data", () => {
    const data = worldFixture();
    const identity = {
      kind: "main",
      seed: 7,
      generation: "synthetic-p4",
    } as const;
    expect(() =>
      validateWorldPlan(data, identity, WORLDGEN_VERSION),
    ).not.toThrow();
    expect(hydrateWorldPlan(data).data.ibara).toBe(data.ibara);
    for (const shared of [false, true]) {
      const copy = clonePlanBuffers(data, shared);
      expect(() =>
        validateWorldPlan(copy, identity, WORLDGEN_VERSION),
      ).not.toThrow();
      expect(hydrateWorldPlan(copy).data.ibara).toEqual(data.ibara);
      expect(copy.ibara.routing.terrain.buffer).not.toBe(
        data.ibara.routing.terrain.buffer,
      );
    }
    expect(() =>
      validateWorldPlan({ ...data, schema: 1 }, identity, WORLDGEN_VERSION),
    ).toThrow(/compatibility/);
    expect(() =>
      validateWorldPlan(
        { ...data, ibara: undefined },
        identity,
        WORLDGEN_VERSION,
      ),
    ).toThrow();
    expect(() =>
      validateWorldPlan(data, { ...identity, seed: 8 }, WORLDGEN_VERSION),
    ).toThrow();
  });
});

describe("Ibara final field and sampler", () => {
  it("review regression: reuses supplied zero-weight columns inside the feature search envelope", () => {
    const data = worldFixture();
    const base = createMainField(data, data.sites.bridges);
    const height = vi.spyOn(base, "height");
    const sampleColumn = vi.spyOn(base, "sampleColumn");
    const ground = createIbaraGround(base, data.ibara);
    const features = createMainIbaraField({ ...base, ibara: ground });
    const area = { minX: 0, minZ: 0, maxX: 1, maxZ: 1 };
    expect(mayContainIbara(area)).toBe(true);
    expect(createIbaraAnalytic(7).weight(0.5, 0.5)).toBe(0);
    const adapter = prepareMainIbara(ground, features, area, 1);
    const column = base.sampleColumn(0.5, 0.5, base.createColumn());
    height.mockClear();
    sampleColumn.mockClear();
    for (const depth of [4, 8, 12]) {
      const y = Number(column[MainColumn.NaturalHeight]) - depth;
      const expected = sampleMainVoxel(0.5, y, 0.5, voxel(), column, []);
      const actual = sampleMainVoxel(0.5, y, 0.5, voxel(), column, [], adapter);
      expect(actual).toEqual(expected);
    }
    expect(height).toHaveBeenCalledTimes(0);
    expect(sampleColumn).toHaveBeenCalledTimes(0);
    for (const rise of [10, 20, 30]) {
      const y = Number(column[MainColumn.Height]) + rise;
      expect(
        sampleMainVoxel(0.5, y, 0.5, voxel(), column, [], adapter),
      ).toEqual(sampleMainVoxel(0.5, y, 0.5, voxel(), column, []));
    }
    // Lava ownership may need the base height once, never once per air voxel.
    expect(height).toHaveBeenCalledTimes(1);
    expect(sampleColumn).toHaveBeenCalledTimes(0);
    let crossing: MainIbaraSampler | undefined;
    syntheticContext(1, (batch) => {
      crossing = batch;
    });
    expect(Number(column[MainColumn.Height])).toBeLessThan(48);
    const overhang = { ...adapter, batch: required(crossing).batch };
    const hit = sampleMainVoxel(0.5, 48, 0.5, voxel(), column, [], overhang);
    expect(hit.featureId).toBeGreaterThan(0);
    const reference = { ...overhang };
    // Compare the same real SDF union through the uncached P2 ground path.
    delete reference.sampleGround;
    expect(
      sampleMainVoxel(0.5, 48, 0.5, voxel(), column, [], reference),
    ).toEqual(hit);
  });
  it("reports actual bounded cache counts separately from each prepared batch's references", () => {
    const data = worldFixture(),
      field = createMainField(data, [], data.ibara);
    const features = createMainIbaraField(field, 3);
    const adapter = prepareMainIbara(
      required(field.ibara),
      features,
      { minX: 0, minZ: 0, maxX: 1, maxZ: 1 },
      1,
    );
    const stats = mainFeatureCacheStats(
      features,
      adapter.batch.instances.length,
    );
    expect(stats.geometryCells).toBe(features.cachedCellCount);
    expect(stats.placementCells).toBe(features.cachedPlacementCellCount);
    expect(stats.cachedInstances).toBe(features.cachedInstanceCount);
    expect(stats.geometryCells).toBeGreaterThan(0);
    expect(stats.placementCells).toBeGreaterThan(0);
    expect(stats.geometryCellLimit).toBe(3);
    expect(stats.placementCellLimit).toBe(3);
    expect(stats.geometryCells).toBeLessThanOrEqual(3);
    expect(stats.placementCells).toBeLessThanOrEqual(3);
    for (const count of Object.values(stats))
      expect(Number.isInteger(count) && count >= 0).toBe(true);
    expect(
      createWorldContext({ kind: "test", seed: 7 }).featureCacheStats,
    ).toBeUndefined();
  });
  it("preserves outside-Ibara columns, owned water and ordinary voxel arithmetic", () => {
    const data = worldFixture();
    const base = createMainField(data, data.sites.bridges);
    const final = createMainField(data, data.sites.bridges, data.ibara);
    const context = createWorldContext({ kind: "main", seed: 7, plan: data });
    for (const [x, z] of [
      [-8192, -8192],
      [-8256.5, -8192.5],
      [-32.5, -8192.5],
    ] as const) {
      const before = base.sampleColumn(x, z, base.createColumn());
      const after = final.sampleColumn(x, z, final.createColumn());
      expect(after).toEqual(before);
      const water = { bodyId: 0, kind: "none" as const, level: -Infinity };
      expect(final.waterQuery(x, z, { ...water })).toEqual(
        base.waterQuery(x, z, { ...water }),
      );
      const prepared = context.prepareArea({
        minX: x - 1,
        maxX: x + 1,
        minZ: z - 1,
        maxZ: z + 1,
      });
      for (const y of [-1505, 20.5, 42.5, 80.5]) {
        const point = context.sampleVoxel(x, y, z, voxel());
        expect(prepared.sampleVoxel(x, y, z, voxel(), after)).toEqual(point);
        expect(point.featureId).toBe(0);
        expect(point.featureT).toBe(0);
      }
    }
    const wet = context.sampleVoxel(-8192, 43, -8192, voxel());
    expect(wet.fluid).toBe(Block.Water);
    expect(context.sampleVoxel(-8000, 43, -8000, voxel()).fluid).toBe(
      Block.Air,
    );
  });
  it("fills only a negative-density owned lava interval, and resets reused feature metadata", () => {
    const data = worldFixture(),
      field = createMainField(data, [], data.ibara);
    const ground = required(field.ibara);
    const adapter: MainIbaraSampler = {
      ground,
      batch: createIbaraBatch([]),
      spacing: 1,
      groundSample: { density: 0, surfaceY: 0, tag: "base" },
      featureSample: createIbaraSample(),
      lavaSample: createLavaSample(),
    };
    const sample = voxel(),
      x = 6144,
      z = 6144;
    const column = field.sampleColumn(x, z, field.createColumn());
    const lava = ground.lavaQuery(x, z, createLavaSample());
    expect(lava.kind).toBe("lava");
    for (const y of [
      lava.bed - 1,
      lava.bed,
      (lava.bed + lava.level) / 2,
      lava.level,
      lava.level + 1,
      WORLD_MAX_Y,
    ]) {
      sample.featureId = 25_198_721;
      sample.featureT = 0.8500000000000001;
      sampleMainVoxel(x, y, z, sample, column, [], adapter);
      expect(sample.fluid === Block.Lava).toBe(
        sample.density < 0 && lava.bed < y && y <= lava.level,
      );
      expect(sample.featureId).toBe(0);
      expect(sample.featureT).toBe(0);
    }
    // Near the hot lake but outside its wet footprint must remain dry above ground.
    const dryZ = z + 150;
    expect(ground.lavaQuery(x, dryZ, createLavaSample()).kind).toBe("none");
    const dryColumn = field.sampleColumn(x, dryZ, field.createColumn());
    sampleMainVoxel(
      x,
      field.height(x, dryZ) + 1,
      dryZ,
      sample,
      dryColumn,
      [],
      adapter,
    );
    expect(sample.fluid).toBe(Block.Air);
    // An explicit future carver can make dry air below a basin bed. It must
    // remain dry even though the XZ still resolves to that basin's ownership.
    const carved: MainIbaraSampler = {
      ...adapter,
      ground: {
        ...ground,
        sample: (_x, _y, _z, out) =>
          Object.assign(out, {
            density: -2,
            surfaceY: lava.bed,
            tag: "basalt",
          }),
      },
    };
    sampleMainVoxel(x, lava.bed - 1, z, sample, column, [], carved);
    expect(sample.density).toBe(-2);
    expect(sample.fluid).toBe(Block.Air);
    sampleMainVoxel(x, -100, z, sample, column, [], adapter);
    expect(sample.block).toBe(Block.DeepStone);
    // smax can create solid at a ground/feature equality while terrain keeps
    // the strict dominance tie (featureId=0). Air must not survive that union.
    const tied: MainIbaraSampler = {
      ...adapter,
      ground: {
        ...ground,
        sample: (_x, _y, _z, out) =>
          Object.assign(out, {
            density: -0.25,
            surfaceY: lava.bed,
            tag: "base",
          }),
      },
      batch: { ...createIbaraBatch([]), density: () => 0.25 },
    };
    sampleMainVoxel(x, lava.level + 1, z, sample, column, [], tied);
    expect(sample.density).toBeGreaterThan(0);
    expect(sample.block).not.toBe(Block.Air);
    expect(sample.fluid).toBe(Block.Air);
    expect(sample.featureId).toBe(0);
  });
  it("uses the same volcanic height and canonical features for point and overlapping areas", () => {
    const data = worldFixture(),
      context = createWorldContext({ kind: "main", seed: 7, plan: data });
    const field = createMainField(data, data.sites.bridges, data.ibara);
    expect(field.height(6144, 6144)).toBeLessThan(30);
    expect(
      context.sampleColumn(6144, 6144, context.createColumn())[
        MainColumn.Height
      ],
    ).toBe(field.height(6144, 6144));
    const a = context.prepareArea({
      minX: 6112,
      maxX: 6176,
      minZ: 6112,
      maxZ: 6176,
    });
    const b = context.prepareArea({
      minX: 6136,
      maxX: 6152,
      minZ: 6136,
      maxZ: 6152,
    });
    for (const [x, y, z] of [
      [6144, 29, 6144],
      [6143.5, 70.5, 6143.5],
      [6144.5, 90.5, 6144.5],
    ] as const) {
      expect(a.sampleVoxel(x, y, z, voxel())).toEqual(
        b.sampleVoxel(x, y, z, voxel()),
      );
      expect(context.sampleVoxel(x, y, z, voxel())).toEqual(
        a.sampleVoxel(x, y, z, voxel()),
      );
    }
    const featureField = createMainIbaraField(field);
    const landmark = [
      [3, 3],
      [4, 3],
      [3, 4],
      [4, 4],
      [5, 3],
      [3, 5],
    ].flatMap(([x, z]) =>
      featureField.parametersForCell(required(x), required(z), true),
    )[0];
    expect(landmark).toBeDefined();
    const thorn = required(
      featureField
        .landmarks(required(landmark).cellX, required(landmark).cellZ)
        .find((t) => t.parameters.id === required(landmark).id),
    );
    const point = sampleSpine(
      required(thorn.sweeps[0]).spine,
      0.6,
      createSpineSample(),
    );
    const query = {
      minX: point.x - 16,
      maxX: point.x + 16,
      minZ: point.z - 16,
      maxZ: point.z + 16,
    };
    const high = context.conservativeBounds(query, bounds());
    const prepared = prepareMainIbara(
      required(field.ibara),
      featureField,
      query,
      1,
    );
    expect(prepared.batch.instances.length).toBeGreaterThan(0);
    for (const thorn of prepared.batch.instances)
      expect(Math.min(WORLD_MAX_Y, thorn.bounds.maxY)).toBeLessThanOrEqual(
        high.maxSolidY,
      );
    const sky = context.skyInput(point.x, point.z, {
      solidBelowY: 0,
      highestFilterY: 0,
    });
    expect(sky.solidBelowY).toBe(field.height(point.x, point.z));
    expect(sky.highestFilterY).toBeGreaterThan(point.y);
    expect(sky.highestFilterY).toBeLessThanOrEqual(
      Math.max(high.maxSolidY, high.maxFluidY),
    );
    for (const spacing of [1, 1.5, 2, 4, 8, 16, 32, 64]) {
      const area = context.prepareArea(query, spacing);
      const overlap = context.prepareArea(
        { ...query, maxX: query.maxX + 8 },
        spacing,
      );
      const actual = area.sampleVoxel(point.x, point.y, point.z, voxel());
      expect(actual.featureId).toBeGreaterThan(0);
      const stats = required(area.featureCacheStats)();
      expect(stats.preparedInstanceReferences).toBeGreaterThan(0);
      expect(stats.geometryCellLimit).toBe(256);
      expect(stats.placementCellLimit).toBe(256);
      expect({ ...stats, preparedInstanceReferences: 0 }).toEqual(
        required(context.featureCacheStats)(),
      );
      expect(overlap.sampleVoxel(point.x, point.y, point.z, voxel())).toEqual(
        actual,
      );
      if (spacing === 1)
        expect(context.sampleVoxel(point.x, point.y, point.z, voxel())).toEqual(
          actual,
        );
    }
    for (const spacing of [0, -1, 0.5, 65, Infinity, NaN])
      expect(() => context.prepareArea(query, spacing)).toThrow();
  });
});

/** Two simple author-controlled crossing thorns exercise the real SDF composer
 * and main sampler, while keeping chunk-assembly verification bounded. */
function syntheticContext(
  spacing: number,
  onPrepare?: (adapter: MainIbaraSampler) => void,
): WorldContext {
  const flat: IbaraGround = {
    height: () => 40,
    sample: (_x, y, _z, out) =>
      Object.assign(out, { density: 40 - y, surfaceY: 40, tag: "basalt" }),
    lavaQuery: (_x, _z, out) => Object.assign(out, createLavaSample()),
    lavaAt: (_x, _z, out) => {
      out.set([Infinity, 0, 0]);
      return out;
    },
    conservativeBounds: (_bounds, out) =>
      Object.assign(out, {
        minSurfaceY: 40,
        maxSurfaceY: 40,
        maxSolidY: 40,
        maxFluidY: -Infinity,
      }),
  };
  const p: ThornParameters = {
    id: 25_198_721,
    cellX: -1,
    cellZ: -1,
    cluster: 0,
    index: 0,
    base: [-0.5 * spacing, 40, -0.5 * spacing],
    height: 220,
    baseRadius: 30,
    flowX: 1,
    flowZ: 0,
    leanDegrees: 12,
    bend: 35,
    sCurve: true,
    hooked: false,
    broken: false,
    breakT: 0.6,
    branchCount: 0,
    facets: 5,
    facetiness: 0.8,
    twist: 0.3,
    phase: 0.2,
    exponent: 0.8,
    core: "obsidian",
    crust: "ember",
    nearLava: true,
    landmark: true,
    arch: false,
    archSpan: 100,
  };
  const env = { seed: 7, surfaceAt: flat.height, weightAt: () => 1 };
  const thorns = [
    instantiateThorn(p, env),
    instantiateThorn(
      {
        ...p,
        id: p.id - 1,
        index: 1,
        base: [p.base[0] + 15, 40, p.base[2] - 12],
        flowZ: 0.3,
      },
      env,
    ),
  ];
  const sampleColumn = (
    _x: number,
    _z: number,
    out: Float64Array,
  ): Float64Array => {
    out.fill(0);
    out[MainColumn.Height] = 40;
    out[MainColumn.NaturalHeight] = 40;
    out[MainColumn.DistanceScale] = 1;
    out[MainColumn.WaterLevel] = -Infinity;
    out[MainColumn.BridgeMargin] = -Infinity;
    out[MainColumn.BridgeTop] = -Infinity;
    out[MainColumn.PaletteRegion] = 9;
    return out;
  };
  let reverse = false;
  const prepareArea = (_bounds: unknown, policy = 1): WorldAreaSampler => {
    const adapter: MainIbaraSampler = {
      ground: flat,
      batch: createIbaraBatch(reverse ? thorns.slice().reverse() : thorns),
      spacing: policy,
      groundSample: { density: 0, surfaceY: 0, tag: "base" },
      featureSample: createIbaraSample(),
      lavaSample: createLavaSample(),
    };
    reverse = !reverse;
    onPrepare?.(adapter);
    const column = new Float64Array(MainColumn.Stride);
    return {
      kind: "main",
      seed: 7,
      columns: MAIN_COLUMN_LAYOUT,
      createColumn: () => new Float64Array(MainColumn.Stride),
      sampleColumn,
      sampleVoxel: (x, y, z, out, input) =>
        sampleMainVoxel(
          x,
          y,
          z,
          out,
          input ?? sampleColumn(x, z, column),
          [],
          adapter,
        ),
      skyInput: (_x, _z, out) =>
        Object.assign(out, { solidBelowY: 40, highestFilterY: 400 }),
    };
  };
  return {
    ...createWorldContext({ kind: "test", seed: 7 }),
    ...prepareArea({}, spacing),
    kind: "main",
    prepareArea,
  };
}
describe("Ibara chunk transport and equal-policy boundaries", () => {
  it.each([1, 2, 4, 8, 16, 32, 64])(
    "aligns every core/halo lane, all six faces and signed corners at spacing %i",
    (spacing) => {
      const context = syntheticContext(spacing);
      const chunk = generateWorldChunk(context, -1, 0, -1, spacing);
      expect(chunk.featureIds?.length).toBe(HALO_VOLUME);
      expect(chunk.featureT?.length).toBe(HALO_VOLUME);
      const a = context.prepareArea(
        {
          minX: -32 * spacing,
          minZ: -32 * spacing,
          maxX: spacing,
          maxZ: spacing,
        },
        spacing,
      );
      const b = context.prepareArea(
        {
          minX: -40 * spacing,
          minZ: -40 * spacing,
          maxX: 40 * spacing,
          maxZ: 40 * spacing,
        },
        spacing,
      );
      let nonzero = 0;
      for (const x of [-1, 0, 15, 31, 32])
        for (const z of [-1, 0, 15, 31, 32])
          for (const y of [-1, 0, 15, 31, 32, 39]) {
            const wx = sampleCenter(-1, x, spacing),
              wy = sampleCenter(0, y, spacing),
              wz = sampleCenter(-1, z, spacing);
            const expected = a.sampleVoxel(wx, wy, wz, voxel());
            expect(b.sampleVoxel(wx, wy, wz, voxel())).toEqual(expected);
            const h = haloIndex(x, y, z);
            expect(chunk.haloBlocks[h]).toBe(expected.block);
            expect(chunk.density[h]).toBe(expected.density);
            expect(chunk.featureIds?.[h]).toBe(expected.featureId);
            expect(chunk.featureT?.[h]).toBe(expected.featureT);
            if (x >= 0 && x < 32 && y >= 0 && y < 32 && z >= 0 && z < 32)
              expect(chunk.blocks[voxelIndex(x, y, z)]).toBe(expected.block);
          }
      for (const id of required(chunk.featureIds)) if (id) nonzero++;
      expect(nonzero).toBeGreaterThan(0);
      // An actual SDF crossing above the volcanic surface, including exact uint32 identity.
      const feature = a.sampleVoxel(
        -0.5 * spacing,
        48,
        -0.5 * spacing,
        voxel(),
      );
      expect(feature.featureId).toBeGreaterThan(0x00ffffff);
      expect(feature.featureT).toBeGreaterThan(0);
      if (spacing === 1)
        expect(context.sampleVoxel(-0.5, 48, -0.5, voxel())).toEqual(feature);
    },
  );
});
