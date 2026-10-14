import { expect, it } from "vitest";
import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import { lightIndex, solveLight } from "../../../shared/src/lighting/flood.js";
import { haloIndex } from "../../../shared/src/world/coordinates.js";
import type { WorldContext } from "../../../shared/src/world/types.js";
import { createWorldContext } from "../../../shared/src/world/world-context.js";
import { generateTestChunk } from "../../../shared/src/worldgen/chunk.js";
import {
  extractHaloLight,
  prepareChunkLighting,
} from "../../src/bench/lighting-input.js";
import { benchmarkCases } from "../../src/bench/samples.js";

it("seeds static RGB throughout a synthetic neighbourhood including the top sky row", () => {
  const area = {
    createColumn: () => new Float64Array(8),
    sampleColumn: (_x: number, _z: number, out: Float64Array) => out,
    sampleVoxel: (x: number, y: number, z: number, out: { block: number }) => {
      out.block =
        x === 0.5 && z === 0.5 && (y === 0.5 || y === 63.5)
          ? Block.Lava
          : Block.Stone;
      return out;
    },
    skyInput: (
      _x: number,
      _z: number,
      out: { highestFilterY: number; solidBelowY: number },
    ) => {
      out.highestFilterY = 63;
      out.solidBelowY = -32;
      return out;
    },
  };
  const context = {
    kind: "test",
    seed: 1,
    prepareArea: () => area,
  } as unknown as WorldContext;
  const volume = prepareChunkLighting(
    {
      id: "synthetic-rgb",
      world: "test",
      seed: 1,
      region: "test",
      lod: 0,
      cx: 0,
      cy: 0,
      cz: 0,
      spacing: 1,
    },
    context,
  );
  expect(volume.sources[lightIndex(volume, 32, 32, 32)]).toBe(0x0f72);
  expect(volume.sources[lightIndex(volume, 32, 95, 32)]).toBe(0x0f72);
  expect(volume.sources[lightIndex(volume, 33, 95, 32)]).toBe(0);
  expect(volume.opacity[lightIndex(volume, 32, 32, 32)]).toBe(15);
});

it("prepares real neighbour opacity, solves skylight and extracts the exact centre halo", () => {
  const context = createWorldContext({ kind: "test", seed: 1 });
  const sample = benchmarkCases(context, 0)[0];
  if (!sample) throw new Error("Missing benchmark sample");
  const chunk = generateTestChunk(sample);
  let preparedAreas = 0;
  let skyColumns = 0;
  const volume = prepareChunkLighting(sample, {
    ...context,
    sampleVoxel() {
      throw new Error("Use the prepared area, not point feature collection");
    },
    skyInput() {
      throw new Error("Use the prepared area's sky inputs");
    },
    prepareArea(bounds) {
      preparedAreas++;
      const area = context.prepareArea(bounds);
      return {
        ...area,
        skyInput(x, z, out, column) {
          skyColumns++;
          return area.skyInput(x, z, out, column);
        },
      };
    },
  });
  expect(preparedAreas).toBe(1);
  expect(skyColumns).toBe(96 * 96);
  let compared = 0;
  for (let y = -1; y < 40; y++)
    for (let z = -1; z <= 32; z++)
      for (let x = -1; x <= 32; x++) {
        const h = haloIndex(x, y, z);
        const v = lightIndex(volume, x + 32, y + 32, z + 32);
        expect(volume.opacity[v]).toBe(
          BLOCK_REGISTRY[chunk.haloBlocks[h] as number]?.lightFiltering,
        );
        compared++;
      }
  expect(compared).toBe(chunk.haloBlocks.length);
  solveLight(volume);
  const halo = extractHaloLight(volume);
  expect((halo[haloIndex(0, 16, 0)] as number) >>> 12).toBe(15);
  expect((halo[haloIndex(0, 0, 0)] as number) >>> 12).toBe(0);
  for (let i = 0; i < 31; i++)
    expect(halo[haloIndex(i, i, i)]).toBe(
      volume.light[lightIndex(volume, i + 32, i + 32, i + 32)],
    );
  expect(() =>
    prepareChunkLighting({ ...sample, lod: 1, spacing: 2 }, context),
  ).toThrow("LOD0");
});
