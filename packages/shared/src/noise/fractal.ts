import {
  createNoise2Sample,
  createNoise3Sample,
  openSimplex2,
} from "./opensimplex2.js";
import { terrainNoise3 } from "./opensimplex2s.js";

export interface FractalOptions {
  readonly octaves: number;
  readonly frequency: number;
  readonly lacunarity: number;
  readonly gain: number;
}
/** Measured quantiles apply to this exact profile only. */
export const DEFAULT_FRACTAL: Readonly<FractalOptions> = Object.freeze({
  octaves: 5,
  frequency: 1,
  lacunarity: 2,
  gain: 0.5,
});
export const DEFAULT_WARP: Readonly<FractalOptions> = Object.freeze({
  octaves: 2,
  frequency: 1,
  lacunarity: 2,
  gain: 0.5,
});

function validate(options: FractalOptions): void {
  if (
    !Number.isInteger(options.octaves) ||
    options.octaves < 1 ||
    options.octaves > 16 ||
    !(options.frequency > 0) ||
    !Number.isFinite(options.frequency) ||
    !(options.lacunarity >= 1) ||
    !Number.isFinite(options.lacunarity) ||
    !(options.gain > 0 && options.gain <= 1)
  )
    throw new RangeError("Invalid fractal profile");
}

/** Normalised fBm. out: [value,dx,dz]; scratch: six lanes, distinct from out. */
export function fbm2(
  seed: number,
  x: number,
  z: number,
  out: Float64Array,
  options = DEFAULT_FRACTAL,
  scratch = createNoise2Sample(),
): Float64Array {
  return fractal2(seed, x, z, out, options, scratch, 0);
}
/** Normalised absolute-value billow, in [-1,1]. At a cusp use the symmetric derivative 0. */
export function billow2(
  seed: number,
  x: number,
  z: number,
  out: Float64Array,
  options = DEFAULT_FRACTAL,
  scratch = createNoise2Sample(),
): Float64Array {
  return fractal2(seed, x, z, out, options, scratch, 1);
}
/** Squared ridges with differentiable weight feedback (clamp cusps use derivative 0). */
export function ridged2(
  seed: number,
  x: number,
  z: number,
  out: Float64Array,
  options = DEFAULT_FRACTAL,
  scratch = createNoise2Sample(),
): Float64Array {
  return fractal2(seed, x, z, out, options, scratch, 2);
}
function fractal2(
  seed: number,
  x: number,
  z: number,
  out: Float64Array,
  options: FractalOptions,
  scratch: Float64Array,
  kind: number,
): Float64Array {
  validate(options);
  if (out === scratch) throw new RangeError("Output and scratch must differ");
  let frequency = options.frequency;
  let amplitude = 1;
  let norm = 0;
  let value = 0;
  let dx = 0;
  let dz = 0;
  let weight = 1;
  let wx = 0;
  let wz = 0;
  for (let octave = 0; octave < options.octaves; octave++) {
    openSimplex2(seed + octave, x * frequency, z * frequency, scratch);
    const n = scratch[0] as number;
    const nx = (scratch[1] as number) * frequency;
    const nz = (scratch[2] as number) * frequency;
    let signal = n;
    let sx = nx;
    let sz = nz;
    if (kind === 1) {
      signal = 2 * Math.abs(n) - 1;
      sx = 2 * Math.sign(n) * nx;
      sz = 2 * Math.sign(n) * nz;
    } else if (kind === 2) {
      const ridge = 1 - Math.abs(n);
      const r2 = ridge * ridge;
      const derivative = -2 * ridge * Math.sign(n);
      signal = r2 * weight;
      sx = derivative * nx * weight + r2 * wx;
      sz = derivative * nz * weight + r2 * wz;
      const candidate = 2 * signal;
      weight = Math.min(1, Math.max(0, candidate));
      wx = candidate > 0 && candidate < 1 ? 2 * sx : 0;
      wz = candidate > 0 && candidate < 1 ? 2 * sz : 0;
    }
    value += amplitude * signal;
    dx += amplitude * sx;
    dz += amplitude * sz;
    norm += amplitude;
    amplitude *= options.gain;
    frequency *= options.lacunarity;
  }
  const scale = (kind === 2 ? 2 : 1) / norm;
  out[0] = value * scale - (kind === 2 ? 1 : 0);
  out[1] = dx * scale;
  out[2] = dz * scale;
  return out;
}

/**
 * Derivative-damped fBm: each octave a*n/(1+strength*|D|^2), with
 * D += a*gradient(n). Returns the analytic derivative of that final field.
 * The denominator derivative uses OpenSimplex2's analytic Hessian; merely
 * damping input gradients would not differentiate this function correctly.
 */
export function erosionFbm2(
  seed: number,
  x: number,
  z: number,
  out: Float64Array,
  options = DEFAULT_FRACTAL,
  strength = 1,
  scratch = createNoise2Sample(),
): Float64Array {
  validate(options);
  if (out === scratch || strength < 0 || !Number.isFinite(strength))
    throw new RangeError("Invalid erosion workspace or strength");
  let frequency = options.frequency;
  let amplitude = 1;
  let norm = 0;
  let value = 0;
  let dx = 0;
  let dz = 0;
  let gx = 0;
  let gz = 0;
  let hxx = 0;
  let hxz = 0;
  let hzz = 0;
  for (let octave = 0; octave < options.octaves; octave++) {
    openSimplex2(seed + octave, x * frequency, z * frequency, scratch);
    const n = scratch[0] as number;
    const nx = (scratch[1] as number) * frequency;
    const nz = (scratch[2] as number) * frequency;
    gx += amplitude * nx;
    gz += amplitude * nz;
    const secondScale = amplitude * frequency * frequency;
    hxx += secondScale * (scratch[3] as number);
    hxz += secondScale * (scratch[4] as number);
    hzz += secondScale * (scratch[5] as number);
    const denominator = 1 + strength * (gx * gx + gz * gz);
    const denominatorX = 2 * strength * (gx * hxx + gz * hxz);
    const denominatorZ = 2 * strength * (gx * hxz + gz * hzz);
    value += (amplitude * n) / denominator;
    dx +=
      amplitude *
      (nx / denominator - (n * denominatorX) / (denominator * denominator));
    dz +=
      amplitude *
      (nz / denominator - (n * denominatorZ) / (denominator * denominator));
    norm += amplitude;
    amplitude *= options.gain;
    frequency *= options.lacunarity;
  }
  out[0] = value / norm;
  out[1] = dx / norm;
  out[2] = dz / norm;
  return out;
}

/**
 * Vector fBm displacement plus Jacobian, NOT already-displaced coordinates.
 * out: [vx,vz, dvx/dx,dvx/dz,dvz/dx,dvz/dz]. Add identity to the Jacobian
 * when composing p + amplitude*warp(p). Two octaves by default.
 */
export function warp2(
  seed: number,
  x: number,
  z: number,
  out: Float64Array,
  options = DEFAULT_WARP,
  scratch = createNoise2Sample(),
  component = new Float64Array(3),
): Float64Array {
  if (out === scratch || out === component || scratch === component)
    throw new RangeError("Warp buffers must differ");
  fbm2(seed, x, z, component, options, scratch);
  out[0] = component[0] as number;
  out[2] = component[1] as number;
  out[3] = component[2] as number;
  fbm2(seed ^ 0x6a09e667, x, z, component, options, scratch);
  out[1] = component[0] as number;
  out[4] = component[1] as number;
  out[5] = component[2] as number;
  return out;
}

/** out: [vx,vy,vz, Jxx,Jxy,Jxz,Jyx,Jyy,Jyz,Jzx,Jzy,Jzz]; vector displacement only. */
export function warp3(
  seed: number,
  x: number,
  y: number,
  z: number,
  out: Float64Array,
  options = DEFAULT_WARP,
  scratch = createNoise3Sample(),
): Float64Array {
  validate(options);
  if (out === scratch) throw new RangeError("Output and scratch must differ");
  out.fill(0);
  for (let component = 0; component < 3; component++) {
    const componentSeed =
      seed ^ (component === 0 ? 0 : component === 1 ? 0x6a09e667 : 0x3c6ef372);
    let amplitude = 1;
    let frequency = options.frequency;
    let norm = 0;
    const lane = 3 + 3 * component;
    for (let octave = 0; octave < options.octaves; octave++) {
      terrainNoise3(
        componentSeed + octave,
        x * frequency,
        y * frequency,
        z * frequency,
        scratch,
      );
      out[component] =
        (out[component] as number) + amplitude * (scratch[0] as number);
      for (let axis = 0; axis < 3; axis++)
        out[lane + axis] =
          (out[lane + axis] as number) +
          amplitude * frequency * (scratch[axis + 1] as number);
      norm += amplitude;
      amplitude *= options.gain;
      frequency *= options.lacunarity;
    }
    out[component] = (out[component] as number) / norm;
    for (let axis = 0; axis < 3; axis++)
      out[lane + axis] = (out[lane + axis] as number) / norm;
  }
  return out;
}
