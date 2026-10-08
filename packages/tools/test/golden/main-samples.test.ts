import { beforeAll, expect, it } from "vitest";
import { BLOCK_REGISTRY } from "../../../shared/src/blocks/registry.js";
import {
  REGION_IDS,
  SURFACE_REGIONS,
} from "../../../shared/src/world/regions.js";
import type { WorldContext } from "../../../shared/src/world/types.js";
import { createRegionWeights } from "../../../shared/src/worldplan/index.js";
import { benchmarkCases } from "../../src/bench/samples.js";
import { mainGoldenCases } from "../../src/golden/core.js";
import { createWorldResolver } from "../../src/golden/worlds.js";

let context: WorldContext;
beforeAll(() => {
  const worlds = createWorldResolver();
  context = worlds("main", 1);
  expect(worlds("main", 1)).toBe(context);
});

it("adds50 distinct main cases covering every surface region at both LODs plus transitions, signed corners and vertical bands", () => {
  const cases = mainGoldenCases(context);
  expect(cases).toHaveLength(50);
  expect(
    new Set(
      cases.map(
        (sample) => `${sample.cx},${sample.cy},${sample.cz},${sample.spacing}`,
      ),
    ).size,
  ).toBe(50);
  for (const lod of [0, 1])
    expect(
      cases
        .filter((sample) => sample.lod === lod && sample.region)
        .map((sample) => sample.region),
    ).toEqual(SURFACE_REGIONS.map((region) => region.id));
  expect(
    cases.filter((sample) => sample.coverage === "warped-ring-transition"),
  ).toHaveLength(10);
  expect(
    cases.filter(
      (sample) => sample.coverage === "xz-frame-boundary-signed-corner",
    ),
  ).toHaveLength(4);
  expect(cases.some((sample) => sample.cy === -48)).toBe(true);
  expect(cases.some((sample) => sample.cy === 31)).toBe(true);
});

it("selects50/20 distinct, actual-region terrain interfaces per region and respects filtering", () => {
  const weights = createRegionWeights();
  const column = context.createColumn();
  const voxel = { density: 0, block: 0, fluid: 0 };
  for (const lod of [0, 1] as const) {
    const samples = benchmarkCases(context, lod);
    expect(samples).toHaveLength(16 * (lod === 0 ? 50 : 20));
    expect(
      new Set(samples.map((sample) => `${sample.cx},${sample.cy},${sample.cz}`))
        .size,
    ).toBe(samples.length);
    for (const region of SURFACE_REGIONS)
      expect(
        samples.filter((sample) => sample.region === region.id),
      ).toHaveLength(lod === 0 ? 50 : 20);
    for (const sample of samples) {
      const x = (sample.cx * 32 + 16.5) * sample.spacing;
      const z = (sample.cz * 32 + 16.5) * sample.spacing;
      context.surfaceWeights(x, z, weights);
      expect(REGION_IDS[Number(weights.ids[0])]).toBe(sample.region);
      const area = context.prepareArea({ minX: x, maxX: x, minZ: z, maxZ: z });
      area.sampleColumn(x, z, column);
      const low = area.sampleVoxel(
        x,
        (sample.cy * 32 + 0.5) * sample.spacing,
        z,
        voxel,
        column,
      ).block;
      const high = area.sampleVoxel(
        x,
        (sample.cy * 32 + 31.5) * sample.spacing,
        z,
        voxel,
        column,
      ).block;
      expect(BLOCK_REGISTRY[low]?.solid).toBe(true);
      expect(BLOCK_REGISTRY[high]?.solid).toBe(false);
    }
  }
  expect(
    benchmarkCases(context, 0, ["blackwater"]).every(
      (sample) => sample.region === "blackwater",
    ),
  ).toBe(true);
});
