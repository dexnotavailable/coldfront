//
// psrdnoise2.glsl
//
// Authors: Stefan Gustavson (stefan.gustavson@gmail.com)
// and Ian McEwan (ijm567@gmail.com)
// Version 2021-12-02, published under the MIT license (see below)
//
// Copyright (c) 2021 Stefan Gustavson and Ian McEwan.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the "Software"),
// to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense,
// and/or sell copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
// THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.
//
// TypeScript nonperiodic port, source pinned to:
// https://github.com/stegu/psrdnoise/blob/419175a270862ce7ae692038fafafb42ec0427e9/src/psrdnoise2.glsl
// Upstream geometry, attenuation and normalisation are retained. Gradient
// selection is deliberately changed: hash3(seed, latticeX, latticeZ) selects
// one of 256 deterministic unit directions instead of mod-289 hashes and
// rotating sin/cos gradients. Optional period/alpha animation APIs are omitted.
// The six-lane Hessian extension is derived analytically below.

import { detSinCos } from "../math/det.js";
import { hash3 } from "../math/hash.js";
import {
  PSRD2_QUANTILE_PROBABILITIES,
  PSRD2_QUANTILES,
} from "./psrd2-quantiles.generated.js";

export {
  PSRD2_QUANTILE_PROBABILITIES,
  PSRD2_QUANTILE_PROVENANCE,
  PSRD2_QUANTILES,
} from "./psrd2-quantiles.generated.js";

export const PSRD2_PROFILE = Object.freeze({
  id: "psrd2-nonperiodic-hash3-unit256-v1",
  sourceRevision: "419175a270862ce7ae692038fafafb42ec0427e9",
  sourceFile: "src/psrdnoise2.glsl",
  sourceSha256:
    "3abb8a203480c79363677995f38c8ffeb1fd9d1eb941473a6f3c4a07532458a6",
  gradientCount: 256,
  attenuationRadiusSquared: 0.8,
  normalisation: 10.9,
});

function gradientTable(): Float64Array {
  const table = new Float64Array(512);
  const trig = new Float64Array(2);
  for (let i = 0; i < 256; i++) {
    detSinCos((i * (2 * Math.PI)) / 256, trig);
    const gx = trig[1] as number;
    const gz = trig[0] as number;
    const inverseLength = 1 / Math.sqrt(gx * gx + gz * gz);
    table[2 * i] = gx * inverseLength;
    table[2 * i + 1] = gz * inverseLength;
  }
  return table;
}
// Private, generated once with deterministic arithmetic, never mutated/exported.
const GRADIENTS = gradientTable();

function corner(
  seed: number,
  iu: number,
  iv: number,
  x: number,
  z: number,
  out: Float64Array,
): void {
  const w = 0.8 - (x * x + z * z);
  if (w <= 0) return;
  const index = (hash3(seed, iu, iv) & 255) * 2;
  const gx = GRADIENTS[index] as number;
  const gz = GRADIENTS[index + 1] as number;
  const dot = gx * x + gz * z;
  const w2 = w * w;
  const w3 = w2 * w;
  const w4 = w2 * w2;
  const radial = -8 * w3 * dot;
  out[0] = (out[0] as number) + w4 * dot;
  out[1] = (out[1] as number) + w4 * gx + radial * x;
  out[2] = (out[2] as number) + w4 * gz + radial * z;
  // d²[w^4(g.r)] = 48w²(g.r)rr' - 8w³(rg' + gr' + (g.r)I).
  // r is in the original input coordinates; no skew-gradient transform applies.
  out[3] =
    (out[3] as number) + 48 * w2 * dot * x * x - 8 * w3 * (2 * x * gx + dot);
  out[4] =
    (out[4] as number) + 48 * w2 * dot * x * z - 8 * w3 * (x * gz + z * gx);
  out[5] =
    (out[5] as number) + 48 * w2 * dot * z * z - 8 * w3 * (2 * z * gz + dot);
}

/**
 * Nonperiodic seeded psrdnoise 2D profile, frequency 1, no gradient animation.
 * Writes [value, dx, dz, dxx, dxz, dzz] in input-coordinate units and returns out.
 * Seeds are signed/unsigned 32-bit words. Finite |x|,|z| < 2^28; out has >=6 lanes.
 * No per-call allocation, caches, finite differences, or changes to OpenSimplex.
 * Optional upstream rectangular periods and alpha rotation are not implemented.
 */
export function psrd2(
  seed: number,
  x: number,
  z: number,
  out: Float64Array,
): Float64Array {
  if (!Number.isInteger(seed) || seed < -2147483648 || seed > 4294967295)
    throw new RangeError("psrd2 seed must be a 32-bit word");
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(z) ||
    Math.abs(x) >= 268435456 ||
    Math.abs(z) >= 268435456 ||
    out.length < 6
  )
    throw new RangeError(
      "psrd2 requires finite coordinates within 2^28 and six output lanes",
    );
  out.fill(0, 0, 6);
  // Upstream's axis-aligned, stretched hexagonal simplex grid.
  const u = x + z * 0.5;
  const iu = Math.floor(u);
  const iv = Math.floor(z);
  const fu = u - iu;
  const fv = z - iv;
  const ou = fu >= fv ? 1 : 0;
  const ov = 1 - ou;
  const vx = iu - iv * 0.5;
  const x0 = x - vx;
  const z0 = z - iv;
  corner(seed, iu, iv, x0, z0, out);
  corner(seed, iu + ou, iv + ov, x0 - ou + ov * 0.5, z0 - ov, out);
  corner(seed, iu + 1, iv + 1, x0 - 0.5, z0 - 1, out);
  for (let lane = 0; lane < 6; lane++) out[lane] = (out[lane] as number) * 10.9;
  return out;
}

/** Empirical inverse CDF for PSRD2_PROFILE only; p in [0,1], endpoints are sampled extrema. */
export function psrd2Quantile(p: number): number {
  if (!(p >= 0 && p <= 1))
    throw new RangeError("psrd2 quantile probability must lie in [0,1]");
  for (let i = 1; i < PSRD2_QUANTILE_PROBABILITIES.length; i++) {
    const high = PSRD2_QUANTILE_PROBABILITIES[i] as number;
    if (p <= high) {
      const low = PSRD2_QUANTILE_PROBABILITIES[i - 1] as number;
      const a = PSRD2_QUANTILES[i - 1] as number;
      return (
        a + ((PSRD2_QUANTILES[i] as number) - a) * ((p - low) / (high - low))
      );
    }
  }
  return PSRD2_QUANTILES[PSRD2_QUANTILES.length - 1] as number;
}
