import { describe, expect, it } from "vitest";
import {
  PSRD2_PROFILE,
  PSRD2_QUANTILE_PROBABILITIES,
  PSRD2_QUANTILE_PROVENANCE,
  PSRD2_QUANTILES,
  psrd2Quantile,
} from "../src/noise/psrd2.js";
import {
  PSRD2_HELD_OUT_SEQUENCE_SEED,
  PSRD2_PROBABILITIES,
  PSRD2_SAMPLE_COUNT,
  PSRD2_SEQUENCE_SEED,
  psrd2Coverage,
  psrd2EmpiricalQuantiles,
  samplePsrd2,
} from "./psrd2-sampling.js";

describe("separately measured psrd2 quantile profile", () => {
  it("recomputes all one million values and rejects stale profile/provenance", () => {
    expect(PSRD2_QUANTILE_PROVENANCE).toMatchObject({
      profile: PSRD2_PROFILE.id,
      sourceRevision: PSRD2_PROFILE.sourceRevision,
      sourceSha256: PSRD2_PROFILE.sourceSha256,
      samples: PSRD2_SAMPLE_COUNT,
      sequenceSeed: PSRD2_SEQUENCE_SEED,
      seedMin: 1,
      seedMax: 3,
      domainMin: -4096,
      domainMax: 4096,
      dimensions: 2,
      frequency: 1,
      gradientCount: 256,
    });
    expect(PSRD2_QUANTILE_PROBABILITIES).toEqual(PSRD2_PROBABILITIES);
    const measured = psrd2EmpiricalQuantiles(samplePsrd2());
    expect(measured.length).toBe(PSRD2_QUANTILES.length);
    for (let i = 0; i < measured.length; i++) {
      expect(
        Math.abs((measured[i] as number) - (PSRD2_QUANTILES[i] as number)),
      ).toBeLessThan(2e-14);
      expect(psrd2Quantile(PSRD2_PROBABILITIES[i] as number)).toBeCloseTo(
        measured[i] as number,
        14,
      );
      if (i > 0) expect(measured[i]).toBeGreaterThan(measured[i - 1] as number);
    }
    expect(measured[0]).toBeGreaterThanOrEqual(-1.01);
    expect(measured.at(-1)).toBeLessThanOrEqual(1.01);
  });

  it("achieves top45/top20 coverage on 100000 held-out points and seeds17-19", () => {
    const heldOut = samplePsrd2(100_000, PSRD2_HELD_OUT_SEQUENCE_SEED, 16);
    const coverage = [0.55, 0.8].map((p) => {
      const achieved = psrd2Coverage(heldOut, psrd2Quantile(p));
      expect(Math.abs(achieved - (1 - p))).toBeLessThan(0.007);
      return { p, achieved };
    });
    console.info({ psrd2HeldOutCoverage: coverage, samples: heldOut.length });
  });

  it("interpolates between sampled ranks and rejects invalid probabilities", () => {
    const a = psrd2Quantile(0.55);
    const b = psrd2Quantile(0.6);
    expect(psrd2Quantile(0.575)).toBeCloseTo((a + b) / 2, 14);
    for (const p of [NaN, Infinity, -Infinity, -0.01, 1.01])
      expect(() => psrd2Quantile(p)).toThrow();
    expect(psrd2Quantile(0)).toBe(PSRD2_QUANTILES[0]);
    expect(psrd2Quantile(1)).toBeCloseTo(PSRD2_QUANTILES.at(-1) as number, 15);
  });
});
