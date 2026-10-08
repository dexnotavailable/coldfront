const LN2 = Math.LN2;
const LOG2E = Math.LOG2E;
const SQRT_HALF = Math.SQRT1_2;
const SQRT_TWO = Math.SQRT2;

/**
 * Deterministic log2: exact binary range reduction, then the odd atanh series
 * through degree 19 on |(m-1)/(m+1)| <= 0.171573. Its analytic remainder is
 * below 1.3e-17 in log2 units before rounding. Only specified IEEE operations are used.
 * Zero -> -Infinity; negative/NaN -> NaN; +Infinity -> +Infinity.
 */
export function detLog2(x: number): number {
  if (x === 0) return -Infinity;
  if (x < 0 || Number.isNaN(x)) return NaN;
  if (x === Infinity) return Infinity;
  let m = x;
  let e = 0;
  while (m < SQRT_HALF) {
    m *= 2;
    e--;
  }
  while (m > SQRT_TWO) {
    m *= 0.5;
    e++;
  }
  const t = (m - 1) / (m + 1);
  const t2 = t * t;
  let term = t;
  let sum = t;
  for (let i = 3; i <= 19; i += 2) {
    term *= t2;
    sum += term / i;
  }
  return e + 2 * LOG2E * sum;
}

function positivePowerOfTwo(exponent: number): number {
  let n = exponent;
  let factor = 2;
  let value = 1;
  while (n > 0) {
    if (n % 2 === 1) value *= factor;
    n = Math.floor(n / 2);
    if (n > 0) factor *= factor;
  }
  return value;
}

/** Range-reduced exp2 with a degree-16 exponential polynomial on [-ln(2)/2, ln(2)/2]. */
export function detExp2(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x >= 1024) return Infinity;
  if (x <= -1075) return 0;
  const k = Math.floor(x + 0.5);
  const r = (x - k) * LN2;
  let value = 1;
  let term = 1;
  for (let i = 1; i <= 16; i++) {
    term *= r / i;
    value += term;
  }
  if (k === 1024) return value * 2 * positivePowerOfTwo(1023);
  if (k === -1075) return value * 0.5 * Number.MIN_VALUE;
  if (k < -1022) return value * positivePowerOfTwo(k + 1074) * Number.MIN_VALUE;
  return k < 0 ? value / positivePowerOfTwo(-k) : value * positivePowerOfTwo(k);
}
/** Natural logarithm with detLog2's domain semantics. */
export function detLog(x: number): number {
  return detLog2(x) * LN2;
}
/** Natural exponential; underflow/overflow follow binary64 limits. */
export function detExp(x: number): number {
  return detExp2(x * LOG2E);
}

/**
 * Real powers via deterministic exp2/log2; negative bases require integer powers.
 * The tested accuracy domain is 2^-64 <= |base| <= 2^64, |exponent| <= 16,
 * with finite normal results: relative error <= 1e-7. See test/math.test.ts for
 * the measured maximum and README for wider-domain/edge-case guarantees.
 */
export function detPow(base: number, exponent: number): number {
  if (exponent === 0) return 1;
  if (Number.isNaN(base) || Number.isNaN(exponent)) return NaN;
  const magnitude = Math.abs(base);
  if (!Number.isFinite(exponent)) {
    if (magnitude === 1) return NaN;
    return magnitude > 1 === exponent > 0 ? Infinity : 0;
  }
  const odd = Number.isInteger(exponent) && Math.abs(exponent % 2) === 1;
  const negative = base < 0 || Object.is(base, -0);
  if (magnitude === 0)
    return exponent < 0
      ? negative && odd
        ? -Infinity
        : Infinity
      : negative && odd
        ? -0
        : 0;
  if (magnitude === Infinity)
    return exponent < 0
      ? negative && odd
        ? -0
        : 0
      : negative && odd
        ? -Infinity
        : Infinity;
  if (base < 0 && !Number.isInteger(exponent)) return NaN;
  const value = detExp2(exponent * detLog2(magnitude));
  return negative && odd ? -value : value;
}

/**
 * Write [sin(angle),cos(angle)] using split pi/2 reduction and degree 17/16
 * polynomials. Finite |angle| <= 2^20 radians only (far beyond world bearings).
 * Reject larger inputs instead of silently losing reduction precision.
 */
export function detSinCos(angle: number, out: Float64Array): Float64Array {
  if (!Number.isFinite(angle) || Math.abs(angle) > 1_048_576)
    throw new RangeError("Angle outside deterministic trig domain");
  if (out.length < 2) throw new RangeError("Two output lanes required");
  const quadrant = Math.round(angle * (2 / Math.PI));
  const r =
    angle - quadrant * 1.5707963267341256 - quadrant * 6.077100506506192e-11;
  const square = r * r;
  let sin = r;
  let cos = 1;
  let st = r;
  let ct = 1;
  for (let i = 1; i <= 8; i++) {
    st *= -square / (2 * i * (2 * i + 1));
    ct *= -square / ((2 * i - 1) * (2 * i));
    sin += st;
    cos += ct;
  }
  const q = ((quadrant % 4) + 4) % 4;
  out[0] = q === 0 ? sin : q === 1 ? cos : q === 2 ? -sin : -cos;
  out[1] = q === 0 ? cos : q === 1 ? -sin : q === 2 ? -cos : sin;
  return out;
}
