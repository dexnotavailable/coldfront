import { hash2, rand01 } from "../src/math/hash.js";
import {
  billow2,
  DEFAULT_WARP,
  erosionFbm2,
  fbm2,
  ridged2,
} from "../src/noise/fractal.js";
import {
  createNoise2Sample,
  createNoise3Sample,
  openSimplex2,
  openSimplex3,
} from "../src/noise/opensimplex2.js";
import { openSimplex2S3 } from "../src/noise/opensimplex2s.js";

export const DISTRIBUTIONS = [
  "openSimplex2",
  "openSimplex3",
  "openSimplex2S3",
  "fbm2",
  "ridged2",
  "billow2",
  "erosionFbm2",
  "warp2Component",
  "warp3Component",
] as const;
export type Distribution = (typeof DISTRIBUTIONS)[number];
export const PROBABILITIES = [
  0, 0.001, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.55, 0.6, 0.7, 0.8,
  0.9, 0.95, 0.975, 0.99, 0.999, 1,
] as const;
export const SAMPLE_COUNT = 1_000_000;

/** Deterministic uniform hash sampling in [-4096,4096)^3, cycling seeds 1,2,3. */
export function sampleDistributions(
  count: number,
  sequenceSeed = 0x243f6a88,
  worldSeedOffset = 0,
): Record<Distribution, Float64Array> {
  const values = Object.fromEntries(
    DISTRIBUTIONS.map((name) => [name, new Float64Array(count)]),
  ) as Record<Distribution, Float64Array>;
  const n2 = createNoise2Sample();
  const n3 = createNoise3Sample();
  const out = new Float64Array(3);
  for (let i = 0; i < count; i++) {
    const x = 8192 * rand01(hash2(sequenceSeed, 3 * i)) - 4096;
    const y = 8192 * rand01(hash2(sequenceSeed, 3 * i + 1)) - 4096;
    const z = 8192 * rand01(hash2(sequenceSeed, 3 * i + 2)) - 4096;
    const seed = 1 + (i % 3) + worldSeedOffset;
    openSimplex2(seed, x, z, n2);
    values.openSimplex2[i] = n2[0] as number;
    openSimplex3(seed, x, y, z, n3);
    values.openSimplex3[i] = n3[0] as number;
    openSimplex2S3(seed, x, y, z, n3);
    values.openSimplex2S3[i] = n3[0] as number;
    fbm2(seed, x, z, out, undefined, n2);
    values.fbm2[i] = out[0] as number;
    ridged2(seed, x, z, out, undefined, n2);
    values.ridged2[i] = out[0] as number;
    billow2(seed, x, z, out, undefined, n2);
    values.billow2[i] = out[0] as number;
    erosionFbm2(seed, x, z, out, undefined, 1, n2);
    values.erosionFbm2[i] = out[0] as number;
    fbm2(seed, x, z, out, DEFAULT_WARP, n2);
    values.warp2Component[i] = out[0] as number;
    // A warp3 component is two-octave, amplitude-normalised 3D fBm.
    openSimplex2S3(seed, x, y, z, n3);
    const first = n3[0] as number;
    openSimplex2S3(seed + 1, 2 * x, 2 * y, 2 * z, n3);
    values.warp3Component[i] = (first + 0.5 * (n3[0] as number)) / 1.5;
  }
  return values;
}

export function empiricalQuantiles(values: Float64Array): number[] {
  values.sort();
  return PROBABILITIES.map((p) => {
    const i = p * (values.length - 1);
    const low = Math.floor(i);
    const a = values[low] as number;
    const b = values[Math.min(low + 1, values.length - 1)] as number;
    return a + (b - a) * (i - low);
  });
}
