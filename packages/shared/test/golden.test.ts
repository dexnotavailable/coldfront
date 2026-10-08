import { expect, it } from "vitest";
import {
  compareGoldenRecords,
  computeGoldens,
  goldenCases,
} from "../../tools/src/golden/core.js";
import { readGoldenFixture } from "../../tools/src/golden/fixture.js";
import { createWorldResolver } from "../../tools/src/golden/worlds.js";

it("reproduces 150 preserved test and 150 main chunk goldens across all regions, seeds, frame/vertical bands and LOD0/1", async () => {
  const worlds = createWorldResolver();
  const cases = goldenCases(worlds);
  const fixture = await readGoldenFixture(undefined, cases);
  const actual = await computeGoldens(cases, undefined, worlds);
  expect(compareGoldenRecords(fixture.records, actual)).toEqual([]);
});
