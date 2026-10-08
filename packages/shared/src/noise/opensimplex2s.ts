// Ported from Auburn/FastNoiseLite, JavaScript/src/FastNoiseLite.ts
// Revision 785f37a9ad76e283586a379675085f2063ae03f7 (MIT).
// https://github.com/Auburn/FastNoiseLite/blob/785f37a9ad76e283586a379675085f2063ae03f7/JavaScript/src/FastNoiseLite.ts
// MIT License
//
// Copyright(c) 2023 Jordan Peck (jordan.me2@gmail.com)
// Copyright(c) 2023 Contributors
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files(the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and / or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions :
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
import { GRADIENTS_3D } from "./gradients.js";

const PRIME_X = 501125321;
const PRIME_Y = 1136930381;
const PRIME_Z = 1720413743;
const R = -0.211324865405187;
const Y = 0.577350269189626;
const NORMALISE = 9.046026385208288;
// Analytic derivative of max(0,0.75-r.r)^4*(g.r), as derived in opensimplex2.ts.
function contribute(
  seed: number,
  i: number,
  j: number,
  k: number,
  x: number,
  y: number,
  z: number,
  out: Float64Array,
): void {
  const a = 0.75 - x * x - y * y - z * z;
  if (a <= 0) return;
  let hash = Math.imul(seed ^ i ^ j ^ k, 0x27d4eb2d);
  hash = (hash ^ (hash >> 15)) & (63 << 2);
  const gx = GRADIENTS_3D[hash] as number,
    gy = GRADIENTS_3D[hash | 1] as number,
    gz = GRADIENTS_3D[hash | 2] as number;
  const dot = gx * x + gy * y + gz * z,
    a2 = a * a,
    a4 = a2 * a2,
    radial = -8 * a2 * a * dot;
  out[0] = (out[0] as number) + a4 * dot;
  out[1] = (out[1] as number) + a4 * gx + radial * x;
  out[2] = (out[2] as number) + a4 * gy + radial * y;
  out[3] = (out[3] as number) + a4 * gz + radial * z;
}
/** Continuous OpenSimplex2S 3D, ImproveXZPlanes; out=[value,dx,dy,dz].
 * Production 3D field: retains the pinned reference's complete smooth lattice.
 * Finite input coordinates |x|,|y|,|z| < 2^28; caller owns at least four lanes.
 */
export function openSimplex2S3(
  seed: number,
  x: number,
  y: number,
  z: number,
  out: Float64Array,
): Float64Array {
  out.fill(0);
  const xz = x + z,
    skew = xz * R,
    yy = y * Y;
  lattice(seed, x + skew - yy, yy + xz * Y, z + skew - yy, out);
  const dx = out[1] as number,
    dy = out[2] as number,
    dz = out[3] as number;
  out[0] = (out[0] as number) * NORMALISE;
  out[1] = ((1 + R) * dx + Y * dy + R * dz) * NORMALISE;
  out[2] = (-Y * dx + Y * dy - Y * dz) * NORMALISE;
  out[3] = (R * dx + Y * dy + (1 + R) * dz) * NORMALISE;
  return out;
}
/** Production alias: smooth 3D noise; exact fast variant remains openSimplex3. */
export const terrainNoise3 = openSimplex2S3;
function lattice(
  seed: number,
  x: number,
  y: number,
  z: number,
  out: Float64Array,
): void {
  // 3D OpenSimplex2S case uses two offset rotated cube grids.
  /*
   * --- Rotation moved to TransformNoiseCoordinate method ---
   * final FNLfloat R3 = (FNLfloat)(2.0 / 3.0);
   * FNLfloat r = (x + y + z) * R3; // Rotation, not skew
   * x = r - x; y = r - y; z = r - z;
   */
  let i = Math.floor(x);
  let j = Math.floor(y);
  let k = Math.floor(z);
  const xi = x - i;
  const yi = y - j;
  const zi = z - k;
  i = Math.imul(i, PRIME_X);
  j = Math.imul(j, PRIME_Y);
  k = Math.imul(k, PRIME_Z);
  const seed2 = seed + 1293373;
  const xNMask = Math.trunc(-0.5 - xi);
  const yNMask = Math.trunc(-0.5 - yi);
  const zNMask = Math.trunc(-0.5 - zi);
  const x0 = xi + xNMask;
  const y0 = yi + yNMask;
  const z0 = zi + zNMask;
  const a0 = 0.75 - x0 * x0 - y0 * y0 - z0 * z0;
  contribute(
    seed,
    i + (xNMask & PRIME_X),
    j + (yNMask & PRIME_Y),
    k + (zNMask & PRIME_Z),
    x0,
    y0,
    z0,
    out,
  );
  const x1 = xi - 0.5;
  const y1 = yi - 0.5;
  const z1 = zi - 0.5;
  const a1 = 0.75 - x1 * x1 - y1 * y1 - z1 * z1;
  contribute(seed2, i + PRIME_X, j + PRIME_Y, k + PRIME_Z, x1, y1, z1, out);
  const xAFlipMask0 = ((xNMask | 1) << 1) * x1;
  const yAFlipMask0 = ((yNMask | 1) << 1) * y1;
  const zAFlipMask0 = ((zNMask | 1) << 1) * z1;
  const xAFlipMask1 = (-2 - (xNMask << 2)) * x1 - 1.0;
  const yAFlipMask1 = (-2 - (yNMask << 2)) * y1 - 1.0;
  const zAFlipMask1 = (-2 - (zNMask << 2)) * z1 - 1.0;
  let skip5 = false;
  const a2 = xAFlipMask0 + a0;
  if (a2 > 0) {
    const x2 = x0 - (xNMask | 1);
    contribute(
      seed,
      i + (~xNMask & PRIME_X),
      j + (yNMask & PRIME_Y),
      k + (zNMask & PRIME_Z),
      x2,
      y0,
      z0,
      out,
    );
  } else {
    const a3 = yAFlipMask0 + zAFlipMask0 + a0;
    if (a3 > 0) {
      const x3 = x0;
      const y3 = y0 - (yNMask | 1);
      const z3 = z0 - (zNMask | 1);
      contribute(
        seed,
        i + (xNMask & PRIME_X),
        j + (~yNMask & PRIME_Y),
        k + (~zNMask & PRIME_Z),
        x3,
        y3,
        z3,
        out,
      );
    }
    const a4 = xAFlipMask1 + a1;
    if (a4 > 0) {
      const x4 = (xNMask | 1) + x1;
      contribute(
        seed2,
        i + (xNMask & (PRIME_X * 2)),
        j + PRIME_Y,
        k + PRIME_Z,
        x4,
        y1,
        z1,
        out,
      );
      skip5 = true;
    }
  }
  let skip9 = false;
  const a6 = yAFlipMask0 + a0;
  if (a6 > 0) {
    const x6 = x0;
    const y6 = y0 - (yNMask | 1);
    contribute(
      seed,
      i + (xNMask & PRIME_X),
      j + (~yNMask & PRIME_Y),
      k + (zNMask & PRIME_Z),
      x6,
      y6,
      z0,
      out,
    );
  } else {
    const a7 = xAFlipMask0 + zAFlipMask0 + a0;
    if (a7 > 0) {
      const x7 = x0 - (xNMask | 1);
      const y7 = y0;
      const z7 = z0 - (zNMask | 1);
      contribute(
        seed,
        i + (~xNMask & PRIME_X),
        j + (yNMask & PRIME_Y),
        k + (~zNMask & PRIME_Z),
        x7,
        y7,
        z7,
        out,
      );
    }
    const a8 = yAFlipMask1 + a1;
    if (a8 > 0) {
      const x8 = x1;
      const y8 = (yNMask | 1) + y1;
      contribute(
        seed2,
        i + PRIME_X,
        j + (yNMask & (PRIME_Y << 1)),
        k + PRIME_Z,
        x8,
        y8,
        z1,
        out,
      );
      skip9 = true;
    }
  }
  let skipD = false;
  const aA = zAFlipMask0 + a0;
  if (aA > 0) {
    const xA = x0;
    const yA = y0;
    const zA = z0 - (zNMask | 1);
    contribute(
      seed,
      i + (xNMask & PRIME_X),
      j + (yNMask & PRIME_Y),
      k + (~zNMask & PRIME_Z),
      xA,
      yA,
      zA,
      out,
    );
  } else {
    const aB = xAFlipMask0 + yAFlipMask0 + a0;
    if (aB > 0) {
      const xB = x0 - (xNMask | 1);
      const yB = y0 - (yNMask | 1);
      contribute(
        seed,
        i + (~xNMask & PRIME_X),
        j + (~yNMask & PRIME_Y),
        k + (zNMask & PRIME_Z),
        xB,
        yB,
        z0,
        out,
      );
    }
    const aC = zAFlipMask1 + a1;
    if (aC > 0) {
      const xC = x1;
      const yC = y1;
      const zC = (zNMask | 1) + z1;
      contribute(
        seed2,
        i + PRIME_X,
        j + PRIME_Y,
        k + (zNMask & (PRIME_Z << 1)),
        xC,
        yC,
        zC,
        out,
      );
      skipD = true;
    }
  }
  if (!skip5) {
    const a5 = yAFlipMask1 + zAFlipMask1 + a1;
    if (a5 > 0) {
      const x5 = x1;
      const y5 = (yNMask | 1) + y1;
      const z5 = (zNMask | 1) + z1;
      contribute(
        seed2,
        i + PRIME_X,
        j + (yNMask & (PRIME_Y << 1)),
        k + (zNMask & (PRIME_Z << 1)),
        x5,
        y5,
        z5,
        out,
      );
    }
  }
  if (!skip9) {
    const a9 = xAFlipMask1 + zAFlipMask1 + a1;
    if (a9 > 0) {
      const x9 = (xNMask | 1) + x1;
      const y9 = y1;
      const z9 = (zNMask | 1) + z1;
      contribute(
        seed2,
        i + (xNMask & (PRIME_X * 2)),
        j + PRIME_Y,
        k + (zNMask & (PRIME_Z << 1)),
        x9,
        y9,
        z9,
        out,
      );
    }
  }
  if (!skipD) {
    const aD = xAFlipMask1 + yAFlipMask1 + a1;
    if (aD > 0) {
      const xD = (xNMask | 1) + x1;
      const yD = (yNMask | 1) + y1;
      contribute(
        seed2,
        i + (xNMask & (PRIME_X << 1)),
        j + (yNMask & (PRIME_Y << 1)),
        k + PRIME_Z,
        xD,
        yD,
        z1,
        out,
      );
    }
  }
  return;
}
