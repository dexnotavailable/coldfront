import { describe, expect, it } from "vitest";
import { Block } from "../src/blocks/registry.js";
import { createIbaraSample } from "../src/features/ibara/types.js";
import { haloIndex, sampleCenter } from "../src/world/coordinates.js";
import type {
  IbaraPlanData,
  VoxelSample,
  WorldPlanData,
} from "../src/world/types.js";
import { createWorldContext } from "../src/world/world-context.js";
import { generateWorldChunk } from "../src/worldgen/main/chunk.js";
import {
  createPrimitiveIbaraBatch,
  PRIMITIVE_IBARA_HEIGHT,
  PRIMITIVE_IBARA_RADIUS,
  PRIMITIVE_IBARA_SPACING,
} from "../src/worldgen/main/ibara-primitive.js";
import { createIbaraAnalytic } from "../src/worldgen/main/ibara-volcanic.js";
import { createMainField } from "../src/worldgen/main/surface.js";
import { WORLDGEN_VERSION } from "../src/worldgen/version.js";
import { createBridges } from "../src/worldplan/bridges.js";
import { createUndergroundCells } from "../src/worldplan/geometry.js";
import { canonicalPlanGrid } from "../src/worldplan/grid.js";

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

const sample = (): VoxelSample => ({ density: 0, block: 0, fluid: 0 });
describe("primitive Ibara calibration field", () => {
  it("uses identical straight circular cones on the global lattice, including negative cells and query edges", () => {
    const environment = {
      seed: 1,
      surfaceAt: (x: number, z: number) => (x + z) / 128,
      weightAt: () => 1,
    };
    const batch = createPrimitiveIbaraBatch(
      environment,
      { minX: -130, minZ: -130, maxX: 130, maxZ: 130 },
      1,
    );
    expect(batch.instances).toHaveLength(25);
    expect(new Set(batch.instances.map((cone) => cone.featureId)).size).toBe(
      25,
    );
    const out = createIbaraSample();
    for (const cone of batch.instances) {
      expect(cone.x % PRIMITIVE_IBARA_SPACING).toBeCloseTo(0);
      expect(cone.z % PRIMITIVE_IBARA_SPACING).toBeCloseTo(0);
      expect(cone.y).toBe(environment.surfaceAt(cone.x, cone.z));
      expect(cone.bounds.maxY - cone.y).toBe(PRIMITIVE_IBARA_HEIGHT);
      expect(cone.bounds.maxX - cone.x).toBe(PRIMITIVE_IBARA_RADIUS);
      const t = 0.37123456789;
      expect(
        batch.density(-100, cone.x, cone.y + 96 * t, cone.z, 1, out),
      ).toBeGreaterThan(0);
      expect(out.featureId).toBe(cone.featureId);
      expect(out.t).toBeCloseTo(t, 15);
      const radial = batch.density(
        -100,
        cone.x + 4,
        cone.y + 48,
        cone.z,
        1,
        out,
      );
      expect(batch.density(-100, cone.x, cone.y + 48, cone.z + 4, 1, out)).toBe(
        radial,
      );
      expect(batch.density(-100, cone.x, cone.y + 97, cone.z, 1, out)).toBe(
        -100,
      );
    }
    const edge = createPrimitiveIbaraBatch(
      environment,
      { minX: 10, minZ: 0, maxX: 13, maxZ: 0 },
      1,
    );
    expect(edge.instances.map((cone) => cone.x)).toContain(0);
  });
  it("resets every sample field, gates on actual region weight and rejects invalid spacing", () => {
    const environment = {
      seed: 1,
      surfaceAt: () => 0,
      weightAt: (x: number) => (x >= 0 ? 1 : 0),
    };
    const batch = createPrimitiveIbaraBatch(
      environment,
      { minX: -64, maxX: 64, minZ: 0, maxZ: 0 },
      1,
    );
    expect(batch.instances.map((cone) => cone.x)).toEqual([0, 64]);
    const out = {
      ...createIbaraSample(),
      core: "obsidian" as const,
      crust: "ember" as const,
      broken: true,
      fillet: 99,
      kind: "branch" as const,
      featureId: 88,
      t: 0.9,
    };
    batch.density(-5, 40, 150, 40, 1, out);
    expect(out).toEqual(createIbaraSample());
    for (const spacing of [0, 65, NaN, Infinity])
      expect(() =>
        createPrimitiveIbaraBatch(
          environment,
          { minX: 0, maxX: 0, minZ: 0, maxZ: 0 },
          spacing,
        ),
      ).toThrow();
  });
  it("agrees between point/prepared/chunk density and binary64 identity, with conservative sky/bounds", () => {
    const plan = worldFixture();
    const context = createWorldContext({
      kind: "main",
      seed: 7,
      plan,
      variant: "primitive",
    });
    const field = createMainField(plan, plan.sites.bridges, plan.ibara),
      ground = field.ibara!;
    const batch = createPrimitiveIbaraBatch(
      {
        seed: 7,
        surfaceAt: ground.height,
        weightAt: createIbaraAnalytic(7).weight,
      },
      { minX: 5760, maxX: 6528, minZ: 5760, maxZ: 6528 },
      1,
    );
    expect(batch.instances.length).toBeGreaterThan(0);
    const cone = batch.instances[0]!;
    const bounds = {
      minX: cone.x - 32,
      maxX: cone.x + 32,
      minZ: cone.z - 32,
      maxZ: cone.z + 32,
    };
    const area = context.prepareArea(bounds),
      overlap = context.prepareArea({ ...bounds, minX: cone.x });
    const limited = context.conservativeBounds(bounds, {
      minSurfaceY: 0,
      maxSurfaceY: 0,
      maxSolidY: 0,
      maxFluidY: 0,
    });
    expect(limited.maxSolidY).toBeGreaterThanOrEqual(cone.bounds.maxY);
    expect(
      area.skyInput(cone.x, cone.z, { solidBelowY: 0, highestFilterY: 0 })
        .highestFilterY,
    ).toBeGreaterThanOrEqual(cone.bounds.maxY);
    const point = context.sampleVoxel(
      cone.x,
      cone.y + 40.123456789,
      cone.z,
      sample(),
    );
    expect(point.featureId).toBe(cone.featureId);
    expect(point.featureT).toBeCloseTo(40.123456789 / 96, 15);
    expect(
      area.sampleVoxel(cone.x, cone.y + 40.123456789, cone.z, sample()),
    ).toEqual(point);
    expect(
      overlap.sampleVoxel(cone.x, cone.y + 40.123456789, cone.z, sample()),
    ).toEqual(point);
    expect(
      context
        .prepareArea(bounds, 32)
        .sampleVoxel(cone.x, cone.y + 40.123456789, cone.z, sample()),
    ).toEqual(point);
    expect(context.featureCacheStats?.()).toMatchObject({
      geometryCells: 0,
      placementCells: 0,
      cachedInstances: 0,
    });
    const cx = Math.floor(cone.x / 32),
      cz = Math.floor(cone.z / 32),
      cy = Math.floor((cone.y + 40) / 32);
    const chunk = generateWorldChunk(context, cx, cy, cz);
    expect(chunk.featureT).toBeInstanceOf(Float64Array);
    for (const [x, y, z] of [
      [-1, 0, 0],
      [0, 3, 0],
      [1, 18, 1],
      [31, 31, 31],
      [32, 39, 32],
    ]) {
      const wx = sampleCenter(cx, x!, 1),
        wy = sampleCenter(cy, y!, 1),
        wz = sampleCenter(cz, z!, 1);
      const expected = context.sampleVoxel(wx, wy, wz, sample()),
        h = haloIndex(x!, y!, z!);
      expect(chunk.haloBlocks[h]).toBe(expected.block);
      expect(chunk.density[h]).toBe(expected.density);
      expect(chunk.featureIds![h]).toBe(expected.featureId);
      expect(chunk.featureT![h]).toBe(expected.featureT);
    }
    // The primitive path keeps volcanic ownership; choose an off-lattice caldera sample.
    const lava = context.sampleVoxel(6160, 29, 6160, sample());
    expect(lava.fluid).toBe(Block.Lava);
    expect(lava.featureId).toBe(0);
  });
});
