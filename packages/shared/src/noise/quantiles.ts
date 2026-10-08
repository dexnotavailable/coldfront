import {
  NOISE_QUANTILES,
  type NoiseDistribution,
  QUANTILE_PROBABILITIES,
} from "./quantiles.generated.js";

export {
  NOISE_QUANTILES,
  type NoiseDistribution,
  QUANTILE_PROBABILITIES,
  QUANTILE_PROVENANCE,
} from "./quantiles.generated.js";

/**
 * Empirical inverse CDF with linear interpolation. q(0.55) is exceeded by
 * approximately 45% of that distribution. Tables apply ONLY to the documented
 * default profiles, not arbitrary octave/gain/erosion changes. Endpoints are
 * measured extrema, not theoretical support bounds. p must lie in [0,1].
 */
export function noiseQuantile(
  distribution: NoiseDistribution,
  p: number,
): number {
  if (!(p >= 0 && p <= 1))
    throw new RangeError("Quantile probability must lie in [0,1]");
  let table: readonly number[];
  switch (distribution) {
    case "openSimplex2":
      table = NOISE_QUANTILES.openSimplex2;
      break;
    case "openSimplex3":
      table = NOISE_QUANTILES.openSimplex3;
      break;
    case "openSimplex2S3":
      table = NOISE_QUANTILES.openSimplex2S3;
      break;
    case "fbm2":
      table = NOISE_QUANTILES.fbm2;
      break;
    case "ridged2":
      table = NOISE_QUANTILES.ridged2;
      break;
    case "billow2":
      table = NOISE_QUANTILES.billow2;
      break;
    case "erosionFbm2":
      table = NOISE_QUANTILES.erosionFbm2;
      break;
    case "warp2Component":
      table = NOISE_QUANTILES.warp2Component;
      break;
    case "warp3Component":
      table = NOISE_QUANTILES.warp3Component;
      break;
    default:
      throw new RangeError("Unknown noise distribution");
  }
  for (let i = 1; i < QUANTILE_PROBABILITIES.length; i++) {
    const highP = QUANTILE_PROBABILITIES[i] as number;
    if (p <= highP) {
      const lowP = QUANTILE_PROBABILITIES[i - 1] as number;
      const a = table[i - 1] as number;
      return a + ((table[i] as number) - a) * ((p - lowP) / (highP - lowP));
    }
  }
  return table[table.length - 1] as number;
}
