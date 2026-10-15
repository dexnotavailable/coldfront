import { describe, expect, it } from "vitest";
import { Block } from "../src/blocks/registry.js";
import { WORLD_MAX_Y, WORLD_MIN_Y } from "../src/world/constants.js";
import { createWorldContext } from "../src/world/world-context.js";
import { createFarArea } from "../src/worldgen/far/bands.js";
import {
  generateFarTile,
  generateFarTileFromArea,
  readFarRun,
} from "../src/worldgen/far/columns.js";
import {
  farColumnIndex,
  packFarTileKey,
} from "../src/worldgen/far/coordinates.js";
import {
  type FarAreaSampler,
  FarCapacityError,
  type FarTileRequest,
  type FarTileRuns,
} from "../src/worldgen/far/types.js";
import { generateWorldChunk } from "../src/worldgen/main/chunk.js";

const request: FarTileRequest = {
  address: { tx: 0, tz: 0, lod: 2 },
  layer: "surface",
  revision: 3,
};
function volume(
  density: (x: number, y: number, z: number) => number,
  fluid = false,
): FarAreaSampler {
  return {
    columns: {
      stride: 1,
      height: 0,
      gradientX: 0,
      gradientZ: 0,
      waterLevel: 0,
    },
    featureBounds: [],
    createColumn: () => ({
      values: new Float64Array(1),
      terrainValues: new Float64Array(1),
      heightDelta: 0,
      canopyTop: -Infinity,
      minY: WORLD_MIN_Y,
      maxY: WORLD_MAX_Y,
      certifiedBase: false,
      fluids: [],
    }),
    sampleColumn(_x, _z, out) {
      out.maxY = 80;
      out.fluids.length = 0;
      if (fluid)
        out.fluids.push({ bottom: -10, top: 12.25, block: Block.Water });
      return out;
    },
    sampleVoxel(x, y, z, out) {
      out.density = density(x, y, z);
      out.block = out.density > 0 ? Block.Stone : Block.Air;
      out.fluid = Block.Air;
      out.featureId = out.density > 0 ? 0xfedcba98 : 0;
      out.featureT = 0;
      return out;
    },
    baseRuns: () => [],
  };
}
function runsAt(tile: FarTileRuns, x = 0, z = 0) {
  const ci = farColumnIndex(x, z);
  return Array.from(
    { length: Number(tile.offsets[ci + 1]) - Number(tile.offsets[ci]) },
    (_, i) => readFarRun(tile, Number(tile.offsets[ci]) + i),
  );
}
describe("far column density representation", () => {
  it("keeps a cave gap and a detached overhang as separate runs", () => {
    const tile = generateFarTileFromArea(
      volume((_x, y) =>
        Math.max(Math.min(y + 8, 8 - y), Math.min(y - 24, 40 - y)),
      ),
      request,
    );
    expect(runsAt(tile).map((run) => [run.bottom, run.top])).toEqual([
      [-8, 8],
      [24, 40],
    ]);
    expect(runsAt(tile).every((run) => run.featureId === 0xfedcba98)).toBe(
      true,
    );
    expect(tile.statistics.densityCalls).toBeLessThanOrEqual(1_000_000);
  });
  it("interpolates a sloped field at world centres, then quantizes once", () => {
    const tile = generateFarTileFromArea(
      volume((x, y, z) => 3.37 + x / 8 + z / 16 - y),
      request,
    );
    for (const [x, z] of [
      [0, 0],
      [1, 3],
      [31, 31],
    ]) {
      const expected =
        3.37 + ((x as number) * 4 + 2) / 8 + ((z as number) * 4 + 2) / 16;
      const top = runsAt(tile, x, z).at(-1)?.top as number;
      expect(Math.abs(top - expected)).toBeLessThanOrEqual(1 / 32);
      expect(top * 16).toBe(Math.round(top * 16));
    }
  });
  it("fills owned fluid intervals only where solid density is absent", () => {
    const tile = generateFarTileFromArea(
      volume((_x, y) => Math.max(-4 - y, Math.min(y - 4, 8 - y)), true),
      request,
    );
    const water = runsAt(tile).filter((run) => run.block === Block.Water);
    expect(water.map((run) => [run.bottom, run.top])).toEqual([
      [-4, 4],
      [8, 12.25],
    ]);
  });
  it("retains a thin source surface material even when the coarse centre is in rock", () => {
    const source = volume((_x, y) => 3.37 - y);
    const area: FarAreaSampler = {
      ...source,
      sampleVoxel(x, y, z, out, column) {
        source.sampleVoxel(x, y, z, out, column);
        if (out.density > 0)
          out.block = 3.37 - y < 1 ? Block.Grass : Block.Stone;
        return out;
      },
    };
    const tile = generateFarTileFromArea(area, request);
    expect(runsAt(tile).at(-1)?.block).toBe(Block.Grass);
    expect(runsAt(tile).at(-1)?.top).toBe(3.375);
  });
  it("has identical negative-coordinate halos and unique level keys", () => {
    const area = volume((x, y, z) => 5 + x / 64 - z / 128 - y);
    const left = generateFarTileFromArea(area, {
      ...request,
      address: { tx: -1, tz: -1, lod: 2 },
    });
    const right = generateFarTileFromArea(area, {
      ...request,
      address: { tx: 0, tz: -1, lod: 2 },
    });
    for (let z = 0; z < 32; z++) {
      expect(runsAt(left, 32, z)).toEqual(runsAt(right, 0, z));
      expect(runsAt(left, 31, z)).toEqual(runsAt(right, -1, z));
    }
    expect(packFarTileKey({ tx: -1, tz: -1, lod: 2 })).not.toBe(
      packFarTileKey({ tx: -1, tz: -1, lod: 3 }),
    );
  });
  it("keeps unknown lower bands sampled and reports capacity failure without partial output", () => {
    expect(() =>
      generateFarTileFromArea(
        volume((_x, y) => 1 - y),
        request,
        undefined,
        { densityCalls: 1 },
      ),
    ).toThrow(FarCapacityError);
    expect(() =>
      generateFarTileFromArea(
        volume((_x, y) => 1 - y),
        request,
        undefined,
        { runs: 1 },
      ),
    ).toThrow(FarCapacityError);
  });
  it("uses four child centres for terrain peaks while leaving a feature at its world height", () => {
    const area = createFarArea({
      area: {
        columns: {
          stride: 1,
          height: 0,
          gradientX: 0,
          gradientZ: 0,
          waterLevel: 0,
        },
        createColumn: () => new Float64Array(1),
        sampleColumn: (x, _z, out) => {
          out[0] = x * x;
          return out;
        },
      },
      options: { spacing: 8, layer: "surface" },
      trees: [],
      terrainHeightIndices: [0],
      displacement: 0,
      solidBase: false,
      featureBounds: [
        { minX: 0, minZ: 0, maxX: 8, maxZ: 8, minY: 100, maxY: 108 },
      ],
      surfaceBounds: (_bounds, out) =>
        Object.assign(out, {
          minSurfaceY: 0,
          maxSurfaceY: 64,
          maxSolidY: 64,
          maxFluidY: -Infinity,
        }),
      materialAt: () => Block.Stone,
      fluids: () => {},
      sample(_x, y, _z, out, column) {
        out.density = Math.max(
          Number(column.terrainValues[0]) - y,
          Math.min(y - 100, 108 - y),
        );
        out.block = out.density > 0 ? Block.Stone : Block.Air;
        out.fluid = 0;
        return out;
      },
    });
    const column = area.sampleColumn(4, 4, area.createColumn());
    expect(column.values[0]).toBe(16);
    expect(column.terrainValues[0]).toBe(36);
    expect(column.minY).toBe(WORLD_MIN_Y);
    expect(column.maxY).toBeGreaterThanOrEqual(116);
    expect(
      area.sampleVoxel(4, 104, 4, { density: 0, block: 0, fluid: 0 }, column)
        .density,
    ).toBe(4);
  });
  it("does not mutate accepted LOD0/1 buffers when far tiles run between near requests", () => {
    const context = createWorldContext({ kind: "test", seed: 7 });
    const before = [1, 2].map((s) => generateWorldChunk(context, -1, 0, -1, s));
    generateFarTile(context, {
      ...request,
      address: { tx: -1, tz: -1, lod: 3 },
    });
    for (const [index, s] of [1, 2].entries()) {
      const after = generateWorldChunk(context, -1, 0, -1, s);
      for (const field of [
        "blocks",
        "haloBlocks",
        "density",
        "columns",
      ] as const)
        expect(after[field]).toEqual(before[index]?.[field]);
    }
  });
  it("certified bands reproduce exhaustive sampling, including coarse material ownership", () => {
    const context = createWorldContext({ kind: "test", seed: 7 });
    for (const lod of [3, 6] as const) {
      const s = 1 << lod;
      const tileRequest: FarTileRequest = {
        ...request,
        address: { tx: -1, tz: -1, lod },
      };
      const bounds = { minX: -33 * s, maxX: s, minZ: -33 * s, maxZ: s };
      const area = context.prepareFarArea?.(bounds, {
        spacing: s,
        layer: "surface",
      });
      if (!area) throw new Error("Missing far adapter");
      const bounded = generateFarTileFromArea(area, tileRequest);
      const exhaustive: FarAreaSampler = {
        ...area,
        sampleColumn(x, z, out) {
          area.sampleColumn(x, z, out);
          out.minY = WORLD_MIN_Y;
          out.maxY = WORLD_MAX_Y;
          out.certifiedBase = false;
          return out;
        },
        baseRuns: () => [],
      };
      const full = generateFarTileFromArea(exhaustive, tileRequest);
      expect(bounded.offsets).toEqual(full.offsets);
      expect(bounded.words).toEqual(full.words);
      expect(bounded.statistics.densityCalls).toBeLessThan(
        full.statistics.densityCalls,
      );
    }
  });
});
