import { describe, expect, it } from "vitest";
import { createWorldContext } from "../../src/world/world-context.js";
import { generateTestChunk } from "../../src/worldgen/chunk.js";
import { generateWorldChunk } from "../../src/worldgen/main/chunk.js";
import {
  createColumnSample,
  createVoxelSample,
  sampleTestColumn,
  sampleTestVoxel,
} from "../../src/worldgen/test-world.js";

describe("WorldContext accepted test adapter", () => {
  it("preserves all eight column lanes and exact prepared-area point samples", () => {
    const context = createWorldContext({ kind: "test", seed: 2 });
    expect(context.columns.stride).toBe(8);
    expect(context.regions).toEqual([]);
    expect(context.regionAnchor("plains")).toBeNull();
    const area = context.prepareArea({
      minX: -64,
      minZ: -64,
      maxX: 96,
      maxZ: 96,
    });
    const actual = context.createColumn();
    const expected = createColumnSample();
    const voxel = createVoxelSample();
    const original = createVoxelSample();
    for (const [x, z] of [
      [0, 0],
      [44, 24],
      [-32.5, -0.5],
      [73.25, 81.5],
    ] as const) {
      area.sampleColumn(x, z, actual);
      sampleTestColumn(2, x, z, expected);
      expect(Buffer.from(actual.buffer)).toEqual(Buffer.from(expected.buffer));
      for (const y of [-40.5, -1.5, 0.5, 5.5, 16.5, 40.5]) {
        area.sampleVoxel(x, y, z, voxel, actual);
        sampleTestVoxel(2, x, y, z, original, expected);
        expect(voxel).toEqual(original);
      }
    }
  });
  it("delegates chunk assembly byte-for-byte and exposes proven frame/sky sentinels", () => {
    const context = createWorldContext({ kind: "test", seed: 1 });
    const actual = generateWorldChunk(context, -1, 0, 1, 2);
    const expected = generateTestChunk({
      seed: 1,
      cx: -1,
      cy: 0,
      cz: 1,
      spacing: 2,
    });
    for (const field of ["blocks", "haloBlocks", "density", "columns"] as const)
      expect(Buffer.from(actual[field].buffer)).toEqual(
        Buffer.from(expected[field].buffer),
      );
    const sky = { solidBelowY: 0, highestFilterY: 0 };
    context.skyInput(30000, 0, sky);
    expect(sky).toEqual({ solidBelowY: -Infinity, highestFilterY: -Infinity });
    const bounds = {
      minSurfaceY: 0,
      maxSurfaceY: 0,
      maxSolidY: 0,
      maxFluidY: -Infinity,
    };
    context.conservativeBounds(
      { minX: -200, minZ: -200, maxX: 200, maxZ: 200 },
      bounds,
    );
    const column = context.createColumn();
    for (let z = -200; z <= 200; z += 25)
      for (let x = -200; x <= 200; x += 25) {
        context.sampleColumn(x, z, column);
        expect(column[context.columns.height]).toBeGreaterThanOrEqual(
          bounds.minSurfaceY,
        );
        expect(column[context.columns.height]).toBeLessThanOrEqual(
          bounds.maxSurfaceY,
        );
        context.skyInput(x, z, sky, column);
        expect(sky.highestFilterY).toBeLessThanOrEqual(
          Math.max(bounds.maxSolidY, bounds.maxFluidY),
        );
      }
  });
});
