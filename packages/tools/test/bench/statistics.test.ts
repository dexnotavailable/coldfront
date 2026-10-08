import { describe, expect, it } from "vitest";
import { SURFACE_REGIONS } from "../../../shared/src/world/regions.js";
import { createWorldContext } from "../../../shared/src/world/world-context.js";
import { benchmarkCases, benchmarkOptions } from "../../src/bench/samples.js";
import { compareBudget, summariseTimings } from "../../src/bench/statistics.js";

describe("benchmark statistics and policy", () => {
  it("computes median and nearest-rank p95 from unsorted raw samples without mutating them", () => {
    const raw = [10, 3, 2, 9, 1, 4];
    expect(summariseTimings(raw)).toEqual({
      count: 6,
      minimumMs: 1,
      maximumMs: 10,
      meanMs: 29 / 6,
      medianMs: 3.5,
      p95Ms: 10,
    });
    expect(raw).toEqual([10, 3, 2, 9, 1, 4]);
    expect(
      summariseTimings(Array.from({ length: 100 }, (_, i) => 100 - i)).p95Ms,
    ).toBe(95);
    expect(summariseTimings([0]).medianMs).toBe(0);
    expect(summariseTimings([1, 100, 2]).medianMs).toBe(2);
    for (const invalid of [[], [NaN], [-1], [Infinity]])
      expect(() => summariseTimings(invalid)).toThrow();
  });
  it("reports budget misses as informational and never invents a target for LOD1 voxel/tile equivalence", () => {
    const summary = summariseTimings([1, 10, 100]);
    expect(compareBudget(summary, { medianMs: 3, p95Ms: 40 })).toEqual({
      enforcement: "informational-until-phase-1.10",
      status: "over-target",
      target: { medianMs: 3, p95Ms: 40 },
      exceeded: ["medianMs", "p95Ms"],
    });
    expect(compareBudget(summary, null).status).toBe("no-applicable-target");
    expect(compareBudget(summary, { medianMs: 10, p95Ms: 100 }).status).toBe(
      "within-target",
    );
  });
  it("fixes50/20 unique signed surface positions and requires actual warmup", () => {
    for (const lod of [0, 1] as const) {
      const samples = benchmarkCases(
        createWorldContext({ kind: "test", seed: 1 }),
        lod,
      );
      expect(samples.length).toBe(lod === 0 ? 50 : 20);
      expect(new Set(samples.map((s) => `${s.cx},${s.cy},${s.cz}`)).size).toBe(
        samples.length,
      );
      expect(samples.some((s) => s.cx < 0 && s.cz < 0)).toBe(true);
      expect(samples.some((s) => s.cx > 0 && s.cz > 0)).toBe(true);
      expect(samples.every((s) => s.spacing === lod + 1)).toBe(true);
    }
    expect(benchmarkOptions([])).toEqual({
      world: "main",
      regions: SURFACE_REGIONS.map((region) => region.id),
      seed: 1,
      repetitions: 3,
      warmup: 5,
    });
    expect(() => benchmarkOptions(["--warmup", "0"])).toThrow();
    expect(() => benchmarkOptions(["--repetitions", "0"])).toThrow();
    expect(() => benchmarkOptions(["--seed", "NaN"])).toThrow();
    expect(() => benchmarkOptions(["--seed", "1", "--seed", "2"])).toThrow();
    expect(benchmarkOptions(["--world", "test"]).regions).toEqual([]);
    expect(
      benchmarkOptions(["--region", "hellscape,blackwater"]).regions,
    ).toEqual(["hellscape", "blackwater"]);
    for (const args of [
      ["--world", "unknown"],
      ["--region", "absent"],
      ["--region", ""],
      ["--region", "plains,plains"],
      ["--world", "test", "--region", "plains"],
    ])
      expect(() => benchmarkOptions(args)).toThrow();
  });
});
