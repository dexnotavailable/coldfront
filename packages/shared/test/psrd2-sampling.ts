import { hash2, rand01 } from "../src/math/hash.js";
import { psrd2 } from "../src/noise/psrd2.js";

export const PSRD2_SAMPLE_COUNT = 1_000_000;
export const PSRD2_SEQUENCE_SEED = 0xb7e15162;
export const PSRD2_HELD_OUT_SEQUENCE_SEED = 0x8aed2a6b;
export const PSRD2_PROBABILITIES = [
  0, 0.001, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.55, 0.6, 0.7, 0.8,
  0.9, 0.95, 0.975, 0.99, 0.999, 1,
] as const;

/** Separate psrd2 profile: uniform hashed XZ in [-4096,4096), seeds 1,2,3. */
export function samplePsrd2(
  count = PSRD2_SAMPLE_COUNT,
  sequenceSeed = PSRD2_SEQUENCE_SEED,
  seedOffset = 0,
): Float64Array {
  const values = new Float64Array(count);
  const out = new Float64Array(6);
  for (let i = 0; i < count; i++) {
    const x = 8192 * rand01(hash2(sequenceSeed, 2 * i)) - 4096;
    const z = 8192 * rand01(hash2(sequenceSeed, 2 * i + 1)) - 4096;
    psrd2(1 + (i % 3) + seedOffset, x, z, out);
    values[i] = out[0] as number;
  }
  return values;
}

/** Numeric ascending sort and linear interpolation at rank p*(N-1). Mutates input. */
export function psrd2EmpiricalQuantiles(values: Float64Array): number[] {
  values.sort();
  return PSRD2_PROBABILITIES.map((p) => {
    const rank = p * (values.length - 1);
    const low = Math.floor(rank);
    const a = values[low] as number;
    const b = values[Math.min(low + 1, values.length - 1)] as number;
    return a + (b - a) * (rank - low);
  });
}

export function psrd2Coverage(values: Float64Array, threshold: number): number {
  let above = 0;
  for (const value of values) if (value > threshold) above++;
  return above / values.length;
}
