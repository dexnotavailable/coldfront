import { expect, it } from "vitest";
import type { ThornInstance } from "../../../shared/src/features/ibara/types.js";
import {
  currentGoldenContract,
  type GoldenCase,
} from "../../src/golden/core.js";
import { validateFixture } from "../../src/golden/fixture.js";
import {
  featureAddress,
  thornGoldenCases,
} from "../../src/golden/ibara-cases.js";

it("addresses named root/branch and an actual signed64m seam at both LODs without building a plan", () => {
  const thorn = {
    parameters: { id: 0x1234567 },
    sweeps: [
      {
        spine: {
          points: new Float64Array([
            -80, 10, -20, -70, 30, -15, -60, 60, -10, -50, 90, -5,
          ]),
        },
      },
      {
        spine: {
          points: new Float64Array([-60, 60, -10, -80, 70, -20, -90, 80, -30]),
        },
      },
    ],
  } as unknown as ThornInstance;
  const cases = thornGoldenCases(1, thorn, thorn);
  expect(cases).toHaveLength(10);
  expect(cases.every((sample) => sample.targetFeatureId === 0x1234567)).toBe(
    true,
  );
  for (const lod of [0, 1]) {
    const left = cases.find(
      (c) => c.lod === lod && c.coverage === "thorn-boundary-left",
    );
    const right = cases.find(
      (c) => c.lod === lod && c.coverage === "thorn-boundary-right",
    );
    expect(right?.cx).toBe(Number(left?.cx) + 1);
    expect(right?.cy).toBe(left?.cy);
    expect(right?.cz).toBe(left?.cz);
  }
  expect(featureAddress({ x: -0.5, y: -0.5, z: -64.5 }, 1)).toEqual({
    cx: -1,
    cy: -1,
    cz: -2,
    lod: 1,
    spacing: 2,
  });
});
it("validates both new hash fields for main and forbids them in unchanged test records", () => {
  const sample: GoldenCase = {
    id: "fixture",
    world: "main",
    seed: 1,
    lod: 0,
    cx: 0,
    cy: 0,
    cz: 0,
    spacing: 1,
    coverage: "fixture",
  };
  const hash = "a".repeat(64),
    hashes = {
      blocks: hash,
      haloBlocks: hash,
      density: hash,
      columns: hash,
      featureIds: hash,
      featureT: hash,
    };
  const fixture = {
    ...currentGoldenContract(),
    provenance: {
      sourceHash: hash,
      sourceCommit: "b".repeat(40),
      nodeVersion: "fixture",
    },
    records: [{ sample, hashes }],
  };
  expect(validateFixture(fixture, [sample])).toBe(fixture);
  expect(() =>
    validateFixture(
      {
        ...fixture,
        records: [{ sample, hashes: { ...hashes, featureT: undefined } }],
      },
      [sample],
    ),
  ).toThrow("featureT");
  const test = { ...sample, world: "test" as const };
  expect(() =>
    validateFixture({ ...fixture, records: [{ sample: test, hashes }] }, [
      test,
    ]),
  ).toThrow("omit");
});
