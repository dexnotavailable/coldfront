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

import { GRADIENTS_2D, GRADIENTS_3D } from "./gradients.js";

const PRIME_X = 501125321;
const PRIME_Y = 1136930381;
const PRIME_Z = 1720413743;
const G2 = (3 - 1.7320508075688772) / 6;
const F2 = 0.5 * (1.7320508075688772 - 1);
const SCALE_2 = 99.83685446303647;
const SCALE_3 = 32.69428253173828;
const ROTATION_S = -0.211324865405187;
const ROTATION_Y = 0.577350269189626;

/** [value, dx, dz, dxx, dxz, dzz]; all derivatives are in input-coordinate units. */
export function createNoise2Sample(): Float64Array {
  return new Float64Array(6);
}
/** [value, dx, dy, dz], in world input-coordinate units (not rotated lattice units). */
export function createNoise3Sample(): Float64Array {
  return new Float64Array(4);
}

// For k(r) = max(R-r.r,0)^4 (g.r):
// grad = a^4 g - 8 a^3 (g.r) r
// Hessian = 48 a^2 (g.r) rr' - 8 a^3 (rg' + gr' + (g.r)I).
// Derivatives are derived here, not borrowed from a finite-difference sampler.
function contribute2(
  seed: number,
  i: number,
  j: number,
  x: number,
  z: number,
  out: Float64Array,
): void {
  const a = 0.5 - x * x - z * z;
  if (a <= 0) return;
  let hash = Math.imul(seed ^ i ^ j, 0x27d4eb2d);
  hash = (hash ^ (hash >> 15)) & (127 << 1);
  const gx = GRADIENTS_2D[hash] as number;
  const gz = GRADIENTS_2D[hash | 1] as number;
  const dot = gx * x + gz * z;
  const a2 = a * a;
  const a3 = a2 * a;
  const a4 = a2 * a2;
  const radial = -8 * a3 * dot;
  out[0] = (out[0] as number) + a4 * dot;
  out[1] = (out[1] as number) + a4 * gx + radial * x;
  out[2] = (out[2] as number) + a4 * gz + radial * z;
  out[3] =
    (out[3] as number) + 48 * a2 * dot * x * x - 8 * a3 * (2 * x * gx + dot);
  out[4] =
    (out[4] as number) + 48 * a2 * dot * x * z - 8 * a3 * (x * gz + z * gx);
  out[5] =
    (out[5] as number) + 48 * a2 * dot * z * z - 8 * a3 * (2 * z * gz + dot);
}

/**
 * Real OpenSimplex2 2D (the reference's simplex lattice variant).
 * Caller supplies six Float64 lanes and finite coordinates with |x|,|z| < 2^28.
 * Unlike FastNoiseLite's object API there is no hidden frequency (1 means 1).
 * The attenuation is recomputed directly at each corner; this changes only
 * rounding against the reference's algebraically reduced last-corner formula.
 */
export function openSimplex2(
  seed: number,
  x: number,
  z: number,
  out: Float64Array,
): Float64Array {
  out.fill(0);
  const skew = (x + z) * F2;
  const xs = x + skew;
  const zs = z + skew;
  const ix = Math.floor(xs);
  const iz = Math.floor(zs);
  const xi = xs - ix;
  const zi = zs - iz;
  const unskew = (xi + zi) * G2;
  const x0 = xi - unskew;
  const z0 = zi - unskew;
  const i = Math.imul(ix, PRIME_X);
  const j = Math.imul(iz, PRIME_Y);
  contribute2(seed, i, j, x0, z0, out);
  if (z0 > x0) contribute2(seed, i, j + PRIME_Y, x0 + G2, z0 + G2 - 1, out);
  else contribute2(seed, i + PRIME_X, j, x0 + G2 - 1, z0 + G2, out);
  contribute2(
    seed,
    i + PRIME_X,
    j + PRIME_Y,
    x0 + 2 * G2 - 1,
    z0 + 2 * G2 - 1,
    out,
  );
  for (let lane = 0; lane < 6; lane++)
    out[lane] = (out[lane] as number) * SCALE_2;
  return out;
}

function contribute3(
  seed: number,
  i: number,
  j: number,
  k: number,
  x: number,
  y: number,
  z: number,
  out: Float64Array,
): void {
  const a = 0.6 - x * x - (y * y + z * z);
  if (a <= 0) return;
  let hash = Math.imul(seed ^ i ^ j ^ k, 0x27d4eb2d);
  hash = (hash ^ (hash >> 15)) & (63 << 2);
  const gx = GRADIENTS_3D[hash] as number;
  const gy = GRADIENTS_3D[hash | 1] as number;
  const gz = GRADIENTS_3D[hash | 2] as number;
  const dot = gx * x + gy * y + gz * z;
  const a2 = a * a;
  const a4 = a2 * a2;
  const radial = -8 * a2 * a * dot;
  out[0] = (out[0] as number) + a4 * dot;
  out[1] = (out[1] as number) + a4 * gx + radial * x;
  out[2] = (out[2] as number) + a4 * gy + radial * y;
  out[3] = (out[3] as number) + a4 * gz + radial * z;
}

/**
 * Exact fast OpenSimplex2 3D, using ImproveXZPlanes rotation. Compatibility
 * export: upstream has small value/gradient jumps on some tie planes. Analytic
 * derivatives are valid within each branch. Use terrainNoise3 (OpenSimplex2S)
 * for production smooth 3D fields; see the pinned tie-plane regression tests.
 */
export function openSimplex3(
  seed: number,
  x: number,
  y: number,
  z: number,
  out: Float64Array,
): Float64Array {
  out.fill(0);
  const xz = x + z;
  const skew = xz * ROTATION_S;
  const yy = y * ROTATION_Y;
  const xr = x + skew - yy;
  const zr = z + skew - yy;
  const yr = yy + xz * ROTATION_Y;
  let ix = Math.round(xr);
  let iy = Math.round(yr);
  let iz = Math.round(zr);
  let x0 = xr - ix;
  let y0 = yr - iy;
  let z0 = zr - iz;
  // Nearest-integer lattice selection, not truncation of negative world cells.
  let sx = x0 >= 0 ? -1 : 1;
  let sy = y0 >= 0 ? -1 : 1;
  let sz = z0 >= 0 ? -1 : 1;
  let ax = Math.abs(x0);
  let ay = Math.abs(y0);
  let az = Math.abs(z0);
  ix = Math.imul(ix, PRIME_X);
  iy = Math.imul(iy, PRIME_Y);
  iz = Math.imul(iz, PRIME_Z);
  for (let lattice = 0; lattice < 2; lattice++) {
    contribute3(seed, ix, iy, iz, x0, y0, z0, out);
    if (ax >= ay && ax >= az)
      contribute3(seed, ix - sx * PRIME_X, iy, iz, x0 + sx, y0, z0, out);
    else if (ay > ax && ay >= az)
      contribute3(seed, ix, iy - sy * PRIME_Y, iz, x0, y0 + sy, z0, out);
    else contribute3(seed, ix, iy, iz - sz * PRIME_Z, x0, y0, z0 + sz, out);
    if (lattice === 1) break;
    ax = 0.5 - ax;
    ay = 0.5 - ay;
    az = 0.5 - az;
    x0 = sx * ax;
    y0 = sy * ay;
    z0 = sz * az;
    ix += (sx >> 1) & PRIME_X;
    iy += (sy >> 1) & PRIME_Y;
    iz += (sz >> 1) & PRIME_Z;
    sx = -sx;
    sy = -sy;
    sz = -sz;
    seed = ~seed;
  }
  const dx = out[1] as number;
  const dy = out[2] as number;
  const dz = out[3] as number;
  // Chain rule: transpose of ImproveXZPlanes, which is an orthogonal matrix.
  out[0] = (out[0] as number) * SCALE_3;
  out[1] =
    ((1 + ROTATION_S) * dx + ROTATION_Y * dy + ROTATION_S * dz) * SCALE_3;
  out[2] = (-ROTATION_Y * dx + ROTATION_Y * dy - ROTATION_Y * dz) * SCALE_3;
  out[3] =
    (ROTATION_S * dx + ROTATION_Y * dy + (1 + ROTATION_S) * dz) * SCALE_3;
  return out;
}
