import { expect, it } from "vitest";
import {
  compareGoldenRecords,
  computeGoldens,
  goldenCases,
} from "../../tools/src/golden/core.js";
import { readGoldenFixture } from "../../tools/src/golden/fixture.js";

it("reproduces 150 complete chunk goldens across seeds, signed coordinates, vertical bands and LOD0/1", async () => {
  const fixture = await readGoldenFixture();
  const actual = await computeGoldens(goldenCases());
  expect(compareGoldenRecords(fixture.records, actual)).toEqual([]);
});
