import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hash2, rand01 } from "../src/math/hash.js";
import {
  billow2,
  DEFAULT_FRACTAL,
  erosionFbm2,
  fbm2,
  ridged2,
  warp2,
  warp3,
} from "../src/noise/fractal.js";
import {
  createNoise2Sample,
  createNoise3Sample,
  openSimplex2,
  openSimplex3,
} from "../src/noise/opensimplex2.js";
import { openSimplex2S3, terrainNoise3 } from "../src/noise/opensimplex2s.js";
import {
  NOISE_QUANTILES,
  noiseQuantile,
  QUANTILE_PROVENANCE,
} from "../src/noise/quantiles.js";
import {
  DISTRIBUTIONS,
  empiricalQuantiles,
  PROBABILITIES,
  SAMPLE_COUNT,
  sampleDistributions,
} from "./quantile-sampling.js";

interface ReferenceFixture {
  seed: number;
  x: number;
  y: number;
  z: number;
  value2: number;
  value3: number;
  value2S3: number;
}
const reference = JSON.parse(
  readFileSync(
    new URL("./fixtures/fastnoise-lite.json", import.meta.url),
    "utf8",
  ),
) as { revision: string; fixtures: ReferenceFixture[] };

describe("OpenSimplex2 and analytic derivatives", () => {
  it("matches independent values produced by the pinned upstream 2D/ImproveXZPlanes 3D source", () => {
    expect(reference.revision).toBe("785f37a9ad76e283586a379675085f2063ae03f7");
    const out2 = createNoise2Sample();
    const out3 = createNoise3Sample();
    for (const {
      seed,
      x,
      y,
      z,
      value2,
      value3,
      value2S3,
    } of reference.fixtures) {
      expect(
        Math.abs((openSimplex2(seed, x, z, out2)[0] as number) - value2),
      ).toBeLessThan(2e-11);
      expect(
        Math.abs((openSimplex3(seed, x, y, z, out3)[0] as number) - value3),
      ).toBeLessThan(2e-11);
      expect(
        Math.abs((openSimplex2S3(seed, x, y, z, out3)[0] as number) - value2S3),
      ).toBeLessThan(2e-11);
    }
  });
  it("2D gradients and Hessians match independent central differences across signed coordinates", () => {
    const out = createNoise2Sample();
    const plus = createNoise2Sample();
    const minus = createNoise2Sample();
    const eps = 1e-5;
    for (let i = 0; i < 500; i++) {
      const x = 100 * rand01(hash2(1, i)) - 50;
      const z = 100 * rand01(hash2(2, i)) - 50;
      openSimplex2(i % 3, x, z, out);
      openSimplex2(i % 3, x + eps, z, plus);
      openSimplex2(i % 3, x - eps, z, minus);
      expect(
        Math.abs(
          (out[1] as number) -
            ((plus[0] as number) - (minus[0] as number)) / (2 * eps),
        ),
      ).toBeLessThan(2e-7);
      expect(
        Math.abs(
          (out[3] as number) -
            ((plus[1] as number) - (minus[1] as number)) / (2 * eps),
        ),
      ).toBeLessThan(2e-6);
      expect(
        Math.abs(
          (out[4] as number) -
            ((plus[2] as number) - (minus[2] as number)) / (2 * eps),
        ),
      ).toBeLessThan(2e-6);
      openSimplex2(i % 3, x, z + eps, plus);
      openSimplex2(i % 3, x, z - eps, minus);
      expect(
        Math.abs(
          (out[2] as number) -
            ((plus[0] as number) - (minus[0] as number)) / (2 * eps),
        ),
      ).toBeLessThan(2e-7);
      expect(
        Math.abs(
          (out[5] as number) -
            ((plus[2] as number) - (minus[2] as number)) / (2 * eps),
        ),
      ).toBeLessThan(2e-6);
    }
  });
  it.each([openSimplex3, openSimplex2S3])(
    "rotates the 3D gradient back to world axes: %s",
    (kernel) => {
      const out = createNoise3Sample();
      const plus = createNoise3Sample();
      const minus = createNoise3Sample();
      const eps = 1e-5;
      for (let i = 0; i < 300; i++) {
        const point = [
          23 * rand01(hash2(1, i)) - 11,
          41 * rand01(hash2(2, i)) - 20,
          57 * rand01(hash2(3, i)) - 28,
        ];
        kernel(
          i,
          point[0] as number,
          point[1] as number,
          point[2] as number,
          out,
        );
        for (let axis = 0; axis < 3; axis++) {
          const p = [...point];
          const m = [...point];
          p[axis] = (p[axis] as number) + eps;
          m[axis] = (m[axis] as number) - eps;
          kernel(i, p[0] as number, p[1] as number, p[2] as number, plus);
          kernel(i, m[0] as number, m[1] as number, m[2] as number, minus);
          expect(
            Math.abs(
              (out[axis + 1] as number) -
                ((plus[0] as number) - (minus[0] as number)) / (2 * eps),
            ),
          ).toBeLessThan(2e-7);
        }
      }
    },
  );
  it("production 2D/2S3D stay continuous across origin, cell, tie and sign boundaries", () => {
    const a = createNoise2Sample();
    const b = createNoise2Sample();
    const c = createNoise3Sample();
    const d = createNoise3Sample();
    const eps = 1e-8;
    for (const seed of [1, 2, 3, -1]) {
      for (const coordinate of [-32, -1, -0.5, 0, 0.5, 1, 32]) {
        openSimplex2(seed, coordinate - eps, coordinate + eps, a);
        openSimplex2(seed, coordinate + eps, coordinate - eps, b);
        for (let j = 0; j < 3; j++)
          expect(Math.abs((a[j] as number) - (b[j] as number))).toBeLessThan(
            2e-5,
          );
        terrainNoise3(seed, coordinate - eps, 0, coordinate + eps, c);
        terrainNoise3(seed, coordinate + eps, 0, coordinate - eps, d);
        for (let j = 0; j < 4; j++)
          expect(Math.abs((c[j] as number) - (d[j] as number))).toBeLessThan(
            2e-5,
          );
      }
    }
  });
  it("retains the actual upstream fast-3D discontinuity as a compatibility regression", () => {
    const out = createNoise3Sample();
    const before = openSimplex3(1, 1 - 1e-8, 0, 1 + 1e-8, out)[0] as number;
    const after = openSimplex3(1, 1 + 1e-8, 0, 1 - 1e-8, out)[0] as number;
    // Values independently executed from pinned FastNoiseLite, not generated from this port.
    expect(before).toBeCloseTo(-0.6118403942397072, 13);
    expect(after).toBeCloseTo(-0.6114362601673478, 13);
    expect(Math.abs(after - before)).toBeGreaterThan(0.0004);
    expect(terrainNoise3).toBe(openSimplex2S3);
  });
});

describe("fractal operators", () => {
  it.each([fbm2, billow2, ridged2, erosionFbm2])(
    "differentiates the final composed field: %s",
    (operator) => {
      const out = new Float64Array(3);
      const a = new Float64Array(3);
      const b = new Float64Array(3);
      const eps = 1e-6;
      for (let i = 0; i < 80; i++) {
        const x = 21 * rand01(hash2(5, i)) - 10;
        const z = 37 * rand01(hash2(6, i)) - 18;
        operator(7, x, z, out);
        operator(7, x + eps, z, a);
        operator(7, x - eps, z, b);
        expect(
          Math.abs(
            (out[1] as number) -
              ((a[0] as number) - (b[0] as number)) / (2 * eps),
          ),
        ).toBeLessThan(2e-4);
        operator(7, x, z + eps, a);
        operator(7, x, z - eps, b);
        expect(
          Math.abs(
            (out[2] as number) -
              ((a[0] as number) - (b[0] as number)) / (2 * eps),
          ),
        ).toBeLessThan(2e-4);
      }
    },
  );
  it("returns full warp Jacobians and supports allocation-free scratch reuse", () => {
    const a = new Float64Array(12);
    const b = new Float64Array(12);
    const out = new Float64Array(12);
    const eps = 1e-5;
    warp2(1, 0.371, -0.83, out);
    warp2(1, 0.371 + eps, -0.83, a);
    warp2(1, 0.371 - eps, -0.83, b);
    expect(
      Math.abs(
        (out[2] as number) - ((a[0] as number) - (b[0] as number)) / (2 * eps),
      ),
    ).toBeLessThan(1e-6);
    expect(
      Math.abs(
        (out[4] as number) - ((a[1] as number) - (b[1] as number)) / (2 * eps),
      ),
    ).toBeLessThan(1e-6);
    warp2(1, 0.371, -0.83 + eps, a);
    warp2(1, 0.371, -0.83 - eps, b);
    expect(
      Math.abs(
        (out[3] as number) - ((a[0] as number) - (b[0] as number)) / (2 * eps),
      ),
    ).toBeLessThan(1e-6);
    expect(
      Math.abs(
        (out[5] as number) - ((a[1] as number) - (b[1] as number)) / (2 * eps),
      ),
    ).toBeLessThan(1e-6);
    warp3(1, 0.371, -0.27, -0.83, out);
    for (let axis = 0; axis < 3; axis++) {
      const p = [0.371, -0.27, -0.83];
      const m = [...p];
      p[axis] = (p[axis] as number) + eps;
      m[axis] = (m[axis] as number) - eps;
      warp3(1, p[0] as number, p[1] as number, p[2] as number, a);
      warp3(1, m[0] as number, m[1] as number, m[2] as number, b);
      for (let c = 0; c < 3; c++)
        expect(
          Math.abs(
            (out[3 + 3 * c + axis] as number) -
              ((a[c] as number) - (b[c] as number)) / (2 * eps),
          ),
        ).toBeLessThan(1e-6);
    }
    const sample = createNoise2Sample();
    expect(() => fbm2(1, 0, 0, sample, DEFAULT_FRACTAL, sample)).toThrow();
    expect(() =>
      fbm2(1, 0, 0, out, { ...DEFAULT_FRACTAL, octaves: 0 }),
    ).toThrow();
    const f = fbm2(1, 0.371, -0.83, a);
    const e = erosionFbm2(1, 0.371, -0.83, b, DEFAULT_FRACTAL, 0);
    expect(e.slice(0, 3)).toEqual(f.slice(0, 3));
  });
});

describe("measured distribution quantiles", () => {
  it("actually samples one million points per profile and reproduces committed tables", () => {
    expect(QUANTILE_PROVENANCE.samples).toBe(SAMPLE_COUNT);
    const samples = sampleDistributions(SAMPLE_COUNT);
    for (const name of DISTRIBUTIONS) {
      const measured = empiricalQuantiles(samples[name]);
      const committed = NOISE_QUANTILES[name];
      for (let i = 0; i < measured.length; i++)
        expect(
          Math.abs((measured[i] as number) - (committed[i] as number)),
        ).toBeLessThan(2e-14);
      expect(measured[0]).toBeGreaterThanOrEqual(-1.001);
      expect(measured[measured.length - 1]).toBeLessThanOrEqual(1.001);
      for (let i = 1; i < measured.length; i++)
        expect(measured[i]).toBeGreaterThan(measured[i - 1] as number);
      for (let i = 0; i < PROBABILITIES.length; i++)
        expect(noiseQuantile(name, PROBABILITIES[i] as number)).toBeCloseTo(
          committed[i] as number,
          14,
        );
    }
    console.info(
      `Million-point calibration reproduced for ${DISTRIBUTIONS.length} distributions (${SAMPLE_COUNT * DISTRIBUTIONS.length} values).`,
    );
  });
  it("measures held-out seed coverage for top-45% and top-20% masks", () => {
    const count = 100_000;
    const samples = sampleDistributions(count, 0x6a09e667, 16);
    const coverage: Record<string, number[]> = {};
    for (const name of DISTRIBUTIONS) {
      coverage[name] = [];
      for (const p of [0.55, 0.8]) {
        const threshold = noiseQuantile(name, p);
        let above = 0;
        for (const v of samples[name]) if (v > threshold) above++;
        const achieved = above / count;
        expect(Math.abs(achieved - (1 - p))).toBeLessThan(0.007);
        coverage[name]?.push(achieved);
      }
    }
    console.info({ heldOutCoverage: coverage, samplesPerProfile: count });
    expect(() => noiseQuantile("fbm2", NaN)).toThrow();
    expect(() => noiseQuantile("fbm2", -0.01)).toThrow();
    expect(() => noiseQuantile("fbm2", 1.01)).toThrow();
  });
});
