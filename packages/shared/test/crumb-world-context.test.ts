import { describe, expect, it } from "vitest";
import { BLOCK_REGISTRY, Block } from "../src/blocks/registry.js";
import { haloIndex } from "../src/world/coordinates.js";
import type { VoxelSample, WorldAreaSampler } from "../src/world/types.js";
import { generateWorldChunk } from "../src/worldgen/main/chunk.js";
import { allowsMainFloatingFeature } from "../src/worldgen/main/crumb-cleanup.js";
import { suppressMainSolid } from "../src/worldgen/main/features.js";
import {
  CRUMB_ID,
  CRUMB_T,
  type CrumbCell,
  syntheticCrumbContext,
} from "./fixtures/crumb-context.js";

const sample = (area: WorldAreaSampler, p: CrumbCell): VoxelSample =>
  area.sampleVoxel(...p, { density: 0, block: 0, fluid: 0 });
const centre = (p: CrumbCell): CrumbCell => [
  p[0] + 0.5,
  p[1] + 0.5,
  p[2] + 0.5,
];

describe("shared cleaned WorldContext with synthetic raw input", () => {
  it("uses independent raw owner tiles for tiny/overlapping rectangles and preserves survivors bit-exactly", async () => {
    const chain: CrumbCell[] = Array.from({ length: 16 }, (_, i) => [
      i,
      10,
      10,
    ]);
    const context = await syntheticCrumbContext({
      cells: [...chain, [20, 10, 10]],
    });
    const tiny = context.prepareArea({
      minX: 15.5,
      minZ: 10.5,
      maxX: 15.5,
      maxZ: 10.5,
    });
    const overlap = context.prepareArea({
      minX: 9,
      minZ: 9,
      maxX: 25,
      maxZ: 12,
    });
    const coarse = context.prepareArea(
      { minX: 0, minZ: 0, maxX: 32, maxZ: 32 },
      2,
    );
    const raw = sample(coarse, [15.5, 10.5, 10.5]);
    expect(raw).toMatchObject({
      featureId: CRUMB_ID,
      featureT: CRUMB_T,
      block: Block.EmberCrust,
    });
    for (const area of [tiny, overlap, context])
      expect(sample(area, [15.5, 10.5, 10.5])).toEqual(raw);
    for (const area of [overlap, context])
      expect(sample(area, [20.5, 10.5, 10.5])).toEqual({
        density: -0.125,
        block: Block.Air,
        fluid: Block.Air,
        featureId: 0,
        featureT: 0,
      });
    for (const spacing of [1.0000000000000002, 1.5, 2, 4, 64]) {
      const area = context.prepareArea(
        { minX: 20, minZ: 10, maxX: 21, maxZ: 11 },
        spacing,
      );
      expect(sample(area, [20.5, 10.5, 10.5])).toEqual(
        sample(coarse, [20.5, 10.5, 10.5]),
      );
    }
  });
  it("suppresses the containing unit cell at arbitrary positions, including exact zero, with no smooth-SDF claim", async () => {
    const context = await syntheticCrumbContext({
      cells: [[5, 5, 5]],
      zeroAt: [5.25, 5.25, 5.25],
    });
    for (const p of [
      [5.001, 5.999, 5.7],
      [5.5, 5.5, 5.5],
      [5.25, 5.25, 5.25],
    ] as const) {
      expect(sample(context, p).density).toBeLessThan(0);
      expect(sample(context, p)).toMatchObject({
        block: Block.Air,
        featureId: 0,
        featureT: 0,
      });
    }
    expect(sample(context, [5.25, 5.25, 5.25]).density).toBe(-Number.EPSILON);
    expect(sample(context, [6, 5.5, 5.5]).density).toBe(-105.5);
    for (const density of [0, -0, 0.1, -0.1])
      expect(
        suppressMainSolid({ density, block: Block.Stone, fluid: 0 }).density,
      ).toBeLessThan(0);
  });
  it.each([
    { waterLevel: 10, expected: Block.Water },
    { lava: { bodyId: 3, bed: 4, level: 10 }, expected: Block.Lava },
    { lava: { bodyId: 0, bed: 4, level: 10 }, expected: Block.Air },
    { lava: { bodyId: 3, bed: 6, level: 10 }, expected: Block.Air },
    { lava: { bodyId: 3, bed: 4, level: 5 }, expected: Block.Air },
  ])(
    "refills only legitimate fluid: $expected / $lava",
    async ({ expected, ...options }) => {
      const context = await syntheticCrumbContext({
        cells: [[5, 5, 5]],
        ...options,
      });
      expect(sample(context, [5.5, 5.5, 5.5])).toEqual({
        density: -0.125,
        block: expected,
        fluid: expected,
        featureId: 0,
        featureT: 0,
      });
    },
  );
  it("makes every 34×41×34 halo entry match points, including y33…39 and neighbouring cores", async () => {
    const cells: CrumbCell[] = [
      [-1, 8, 5],
      [0, 8, 5],
      [31, 8, 5],
      [32, 8, 5],
      [5, 31, 5],
      [5, 32, 5],
    ];
    for (let y = 33; y <= 39; y += 2) cells.push([5, y, 5]);
    const context = await syntheticCrumbContext({ cells });
    const chunk = generateWorldChunk(context, 0, 0, 0);
    const point: VoxelSample = { density: 0, block: 0, fluid: 0 };
    for (let z = -1; z <= 32; z++)
      for (let x = -1; x <= 32; x++)
        for (let y = -1; y <= 39; y++) {
          context.sampleVoxel(x + 0.5, y + 0.5, z + 0.5, point);
          const h = haloIndex(x, y, z);
          if (
            chunk.haloBlocks[h] !== point.block ||
            chunk.density[h] !== point.density ||
            chunk.featureIds?.[h] !== point.featureId ||
            chunk.featureT?.[h] !== point.featureT
          )
            throw new Error(`Halo differs from point at ${x},${y},${z}`);
        }
    for (const y of [35, 37, 39])
      expect(chunk.haloBlocks[haloIndex(5, y, 5)]).toBe(Block.Air);
    // y33 connects to retained owner-bottom y32, and therefore intentionally survives.
    expect(chunk.haloBlocks[haloIndex(5, 33, 5)]).toBe(Block.EmberCrust);
    const above = generateWorldChunk(context, 0, 1, 0);
    for (let y = 32; y <= 39; y++)
      expect(above.haloBlocks[haloIndex(5, y - 32, 5)]).toBe(
        chunk.haloBlocks[haloIndex(5, y, 5)],
      );
  });
  it("retains proven-solid columns, preserves conservative sky/bounds, and excludes the frame", async () => {
    const cells: CrumbCell[] = [
      [5, 20, 5],
      [31, 24, 5],
    ];
    const context = await syntheticCrumbContext({
      cells,
      ground: 8,
      waterLevel: 12,
    });
    for (const p of [
      [5.5, 7.5, 5.5],
      [5.5, -10.5, 5.5],
      [-31.5, -20.5, -31.5],
    ] as const)
      expect(BLOCK_REGISTRY[sample(context, p).block]?.solid).toBe(true);
    const sky = context.skyInput(5.5, 5.5, {
      solidBelowY: 0,
      highestFilterY: 0,
    });
    expect(sky).toEqual({ solidBelowY: 8, highestFilterY: 21 });
    const bounds = context.conservativeBounds(
      { minX: 0, minZ: 0, maxX: 32, maxZ: 32 },
      { minSurfaceY: 0, maxSurfaceY: 0, maxSolidY: 0, maxFluidY: 0 },
    );
    expect(bounds).toEqual({
      minSurfaceY: 8,
      maxSurfaceY: 8,
      maxSolidY: 25,
      maxFluidY: 12,
    });
    for (const p of cells)
      expect(
        sample(context, centre(p)).block === Block.Air ||
          p[1] + 0.5 <= bounds.maxSolidY,
      ).toBe(true);
    for (const p of [
      [-22529, 5, 0],
      [22528, 5, 0],
      [0, -1536.5, 0],
      [0, 1024, 0],
    ] as const)
      expect(sample(context, p).block).toBe(Block.Air);
    expect(
      context.cleanupCacheStats?.().maxSearchDiscoveries,
    ).toBeLessThanOrEqual(2);
  });
  it("uses proven solid columns without preparing any raw feature area", async () => {
    const context = await syntheticCrumbContext({ cells: [], ground: 100 });
    for (let ix = 1; ix <= 1100; ix++) sample(context, [ix + 0.5, 5.5, 5.5]);
    const stats = context.cleanupCacheStats?.();
    expect(stats).toMatchObject({
      ownerChunks: 16,
      ownerChunkLimit: 16,
      flagBufferBytes: 524288,
      searchBufferBytes: 128,
      rawAreas: 0,
      rawAreaLimit: 8,
      rawColumns: 1024,
      rawColumnLimit: 1024,
      rawColumnBufferBytes: 1024 * 14 * 8,
      rawAreaColumnBufferBytes: 0,
      rawPreparedInstanceReferences: 0,
      maxSearchDiscoveries: 1,
      rawQueries: 0,
    });
    expect(sample(context, [1.5, 5.5, 5.5]).block).not.toBe(Block.Air);
  });
  it("still caps raw-area and column storage for geometry above the proven lower bound", async () => {
    const cells: CrumbCell[] = Array.from({ length: 1100 }, (_, i) => [
      i + 1,
      105,
      5,
    ]);
    const context = await syntheticCrumbContext({ cells, ground: 100 });
    for (const p of cells) sample(context, centre(p));
    const stats = context.cleanupCacheStats?.();
    expect(stats).toMatchObject({
      ownerChunks: 16,
      rawAreas: 8,
      rawColumns: 1024,
      rawColumnBufferBytes: 1024 * 14 * 8,
      rawAreaColumnBufferBytes: 8 * 14 * 8,
    });
    expect(stats?.rawPreparedInstanceReferences).toBeGreaterThan(0);
    expect(stats?.rawQueries).toBeGreaterThan(0);
    expect(sample(context, [1.5, 105.5, 5.5]).block).not.toBe(Block.Air);
  });
  it("does not exempt Ibara or arbitrary terrain merely because a region permits future floaters", () => {
    for (const region of [
      "hellscape",
      "isles",
      "shardfields",
      "hollow_sky",
    ] as const)
      expect(
        allowsMainFloatingFeature({
          region,
          layer: region === "hollow_sky" ? "undercrown" : "surface",
          featureId: CRUMB_ID,
        }),
      ).toBe(false);
  });
});
