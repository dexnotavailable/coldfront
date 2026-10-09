import { type CubicBezier, clamp01, length3, type Vec3 } from "./types.js";

/** Arc-length polyline with Wang et al. (2008) double-reflection frames.
 * Independently implemented from the paper's geometry, not third-party code.
 * https://www.microsoft.com/en-us/research/publication/computation-rotation-minimizing-frames/
 */
export interface Spine {
  readonly points: Float64Array;
  readonly tangents: Float64Array;
  readonly normals: Float64Array;
  readonly binormals: Float64Array;
  readonly cumulativeLengths: Float64Array;
  readonly length: number;
  readonly segments: number;
  readonly maxChordError: number;
  readonly minimumJointDot: number;
  /** True means the requested accuracy was NOT achieved. Consumers must reject it. */
  readonly capped: boolean;
}
export interface SpineOptions {
  readonly maxSegments?: number;
  readonly chordError?: number;
  readonly jointDegrees?: number;
  readonly initialNormal?: Vec3;
}
export interface SpineSample {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  nx: number;
  ny: number;
  nz: number;
  bx: number;
  by: number;
  bz: number;
  t: number;
  segment: number;
  u: number;
  distance: number;
}
export function createSpineSample(): SpineSample {
  return {
    x: 0,
    y: 0,
    z: 0,
    tx: 0,
    ty: 1,
    tz: 0,
    nx: 1,
    ny: 0,
    nz: 0,
    bx: 0,
    by: 0,
    bz: -1,
    t: 0,
    segment: 0,
    u: 0,
    distance: 0,
  };
}
function minus(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function mixPoint(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}
function unit(a: Vec3): Vec3 {
  const length = length3(...a);
  if (!(length > 1e-12))
    throw new RangeError("Spine must have a regular tangent");
  return [a[0] / length, a[1] / length, a[2] / length];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function reflect(value: Vec3, normal: Vec3): Vec3 {
  const squared = dot(normal, normal);
  if (squared < 1e-24) return value;
  const amount = (2 * dot(value, normal)) / squared;
  return [
    value[0] - amount * normal[0],
    value[1] - amount * normal[1],
    value[2] - amount * normal[2],
  ];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function tangent(curve: CubicBezier, end: boolean): Vec3 {
  const indices = end ? [2, 1, 0] : [1, 2, 3];
  const anchor = end ? curve[3] : curve[0];
  for (const i of indices) {
    const p = curve[i] as Vec3;
    const d = end ? minus(anchor, p) : minus(p, anchor);
    if (dot(d, d) > 1e-24) return unit(d);
  }
  throw new RangeError("Zero-length Bezier spine");
}
function distanceToSegment(p: Vec3, a: Vec3, b: Vec3): number {
  const v = minus(b, a),
    q = minus(p, a),
    squared = dot(v, v);
  const u = squared > 0 ? clamp01(dot(q, v) / squared) : 0;
  return length3(q[0] - u * v[0], q[1] - u * v[1], q[2] - u * v[2]);
}
function split(
  curve: CubicBezier,
  t = 0.5,
): readonly [CubicBezier, CubicBezier] {
  const a = mixPoint(curve[0], curve[1], t),
    b = mixPoint(curve[1], curve[2], t),
    c = mixPoint(curve[2], curve[3], t);
  const d = mixPoint(a, b, t),
    e = mixPoint(b, c, t),
    f = mixPoint(d, e, t);
  return [
    [curve[0], a, d, f],
    [f, e, c, curve[3]],
  ];
}
function error(curve: CubicBezier): number {
  // Distance to the convex chord is convex. Its Bernstein-weighted control
  // distances bound the curve; maximize that scalar cubic analytically.
  const a = distanceToSegment(curve[1], curve[0], curve[3]);
  const b = distanceToSegment(curve[2], curve[0], curve[3]);
  const value = (t: number): number => 3 * t * (1 - t) * ((1 - t) * a + t * b);
  const qa = 3 * (a - b),
    qb = 2 * (b - 2 * a),
    qc = a;
  let maximum = value(0.5);
  if (Math.abs(qa) < 1e-15) {
    if (Math.abs(qb) > 1e-15) {
      const t = -qc / qb;
      if (t > 0 && t < 1) maximum = Math.max(maximum, value(t));
    }
  } else {
    const discriminant = Math.max(0, qb * qb - 4 * qa * qc);
    for (const sign of [-1, 1]) {
      const t = (-qb + sign * Math.sqrt(discriminant)) / (2 * qa);
      if (t > 0 && t < 1) maximum = Math.max(maximum, value(t));
    }
  }
  return maximum;
}
function cosSmall(radians: number): number {
  const square = radians * radians;
  return (
    1 -
    square / 2 +
    (square * square) / 24 -
    (square * square * square) / 720 +
    (square * square * square * square) / 40320
  );
}
/** One or several tangent-continuous cubics. Adaptive subdivisions share one 24-segment budget. */
export function flattenBeziers(
  curves: readonly CubicBezier[],
  options: SpineOptions = {},
): Spine {
  const maxSegments = options.maxSegments ?? 24;
  const chordError = options.chordError ?? 0.5;
  const jointDegrees = options.jointDegrees ?? 12;
  if (
    !Number.isInteger(maxSegments) ||
    maxSegments < 1 ||
    maxSegments > 24 ||
    !(chordError > 0 && chordError <= 0.5) ||
    !(jointDegrees > 0 && jointDegrees <= 12) ||
    curves.length === 0 ||
    curves.length > maxSegments
  )
    throw new RangeError("Invalid spine accuracy or segment budget");
  const leaves: CubicBezier[] = curves.slice();
  for (let i = 0; i < leaves.length; i++) {
    const curve = leaves[i] as CubicBezier;
    for (const point of curve)
      for (const value of point)
        if (!Number.isFinite(value))
          throw new RangeError("Spine coordinates must be finite");
    tangent(curve, false);
    tangent(curve, true);
    if (
      i > 0 &&
      length3(...minus(curve[0], (leaves[i - 1] as CubicBezier)[3])) > 1e-8
    )
      throw new RangeError("Bezier chain must be connected");
  }
  const jointDot = cosSmall((jointDegrees * Math.PI) / 180);
  while (leaves.length < maxSegments) {
    let worst = 1,
      index = -1;
    for (let i = 0; i < leaves.length; i++) {
      const curve = leaves[i] as CubicBezier;
      const chord = minus(curve[3], curve[0]);
      const direction =
        dot(chord, chord) > 1e-20 ? unit(chord) : tangent(curve, false);
      const turn = Math.min(
        dot(direction, tangent(curve, false)),
        dot(direction, tangent(curve, true)),
      );
      const score = Math.max(
        error(curve) / chordError,
        (1 - turn) / (1 - jointDot),
      );
      if (score > worst) {
        worst = score;
        index = i;
      }
      if (i > 0) {
        const previous = leaves[i - 1] as CubicBezier;
        const previousChord = minus(previous[3], previous[0]);
        if (dot(previousChord, previousChord) > 1e-20) {
          const previousDirection = unit(previousChord);
          const jointScore =
            (1 - dot(previousDirection, direction)) / (1 - jointDot);
          if (jointScore > worst) {
            const shared = tangent(curve, false);
            index =
              dot(previousDirection, shared) < dot(direction, shared)
                ? i - 1
                : i;
            worst = jointScore;
          }
        }
      }
    }
    if (index < 0) break;
    let halves = split(leaves[index] as CubicBezier),
      splitScore = Infinity;
    for (let sample = 0; sample < 9; sample++) {
      const candidate = split(
        leaves[index] as CubicBezier,
        0.3 + 0.05 * sample,
      );
      let score = 0;
      for (const part of candidate) {
        const direction = unit(minus(part[3], part[0]));
        score = Math.max(
          score,
          error(part) / chordError,
          (1 - dot(direction, tangent(part, false))) / (1 - jointDot),
          (1 - dot(direction, tangent(part, true))) / (1 - jointDot),
        );
      }
      if (score < splitScore) {
        splitScore = score;
        halves = candidate;
      }
    }
    leaves.splice(index, 1, halves[0], halves[1]);
  }
  const count = leaves.length + 1;
  const points = new Float64Array(count * 3),
    tangents = new Float64Array(count * 3);
  const normals = new Float64Array(count * 3),
    binormals = new Float64Array(count * 3);
  const lengths = new Float64Array(count);
  let total = 0,
    maxError = 0,
    minimumJointDot = 1;
  let previousDirection: Vec3 | undefined;
  for (let i = 0; i < count; i++) {
    const curve = leaves[Math.min(i, leaves.length - 1)] as CubicBezier;
    const point = i === leaves.length ? curve[3] : curve[0];
    const direction = tangent(curve, i === leaves.length);
    points.set(point, i * 3);
    tangents.set(direction, i * 3);
    if (i > 0) {
      const previousCurve = leaves[i - 1] as CubicBezier;
      const chord = minus(previousCurve[3], previousCurve[0]);
      const chordLength = length3(...chord);
      if (!(chordLength > 1e-10))
        throw new RangeError("Degenerate flattened segment");
      const chordDirection = unit(chord);
      if (previousDirection)
        minimumJointDot = Math.min(
          minimumJointDot,
          dot(previousDirection, chordDirection),
        );
      previousDirection = chordDirection;
      total += chordLength;
      lengths[i] = total;
      maxError = Math.max(maxError, error(previousCurve));
    }
  }
  const firstT: Vec3 = [
    Number(tangents[0]),
    Number(tangents[1]),
    Number(tangents[2]),
  ];
  const reference: Vec3 =
    options.initialNormal ??
    (Math.abs(firstT[0]) < 0.8 ? [1, 0, 0] : [0, 0, 1]);
  let normal = unit(
    minus(reference, [
      firstT[0] * dot(reference, firstT),
      firstT[1] * dot(reference, firstT),
      firstT[2] * dot(reference, firstT),
    ]),
  );
  for (let i = 0; i < count; i++) {
    const offset = i * 3;
    const currentT: Vec3 = [
      Number(tangents[offset]),
      Number(tangents[offset + 1]),
      Number(tangents[offset + 2]),
    ];
    if (i > 0) {
      const previous = offset - 3;
      const chord: Vec3 = [
        Number(points[offset]) - Number(points[previous]),
        Number(points[offset + 1]) - Number(points[previous + 1]),
        Number(points[offset + 2]) - Number(points[previous + 2]),
      ];
      const previousT: Vec3 = [
        Number(tangents[previous]),
        Number(tangents[previous + 1]),
        Number(tangents[previous + 2]),
      ];
      const reflectedT = reflect(previousT, chord);
      normal = reflect(reflect(normal, chord), minus(currentT, reflectedT));
      const drift = dot(normal, currentT);
      normal = unit([
        normal[0] - drift * currentT[0],
        normal[1] - drift * currentT[1],
        normal[2] - drift * currentT[2],
      ]);
    }
    normals.set(normal, offset);
    binormals.set(cross(currentT, normal), offset);
  }
  return {
    points,
    tangents,
    normals,
    binormals,
    cumulativeLengths: lengths,
    length: total,
    segments: leaves.length,
    maxChordError: maxError,
    minimumJointDot,
    capped: maxError > chordError + 1e-10 || minimumJointDot < jointDot - 1e-10,
  };
}
export function flattenBezier(
  curve: CubicBezier,
  options: SpineOptions = {},
): Spine {
  return flattenBeziers([curve], options);
}
function interpolateFrame(
  spine: Spine,
  segment: number,
  u: number,
  out: SpineSample,
): SpineSample {
  const a = segment * 3,
    b = a + 3;
  const mix = (data: Float64Array, axis: number): number =>
    Number(data[a + axis]) +
    u * (Number(data[b + axis]) - Number(data[a + axis]));
  out.x = mix(spine.points, 0);
  out.y = mix(spine.points, 1);
  out.z = mix(spine.points, 2);
  out.tx = mix(spine.tangents, 0);
  out.ty = mix(spine.tangents, 1);
  out.tz = mix(spine.tangents, 2);
  let length = length3(out.tx, out.ty, out.tz);
  out.tx /= length;
  out.ty /= length;
  out.tz /= length;
  out.nx = mix(spine.normals, 0);
  out.ny = mix(spine.normals, 1);
  out.nz = mix(spine.normals, 2);
  const drift = out.tx * out.nx + out.ty * out.ny + out.tz * out.nz;
  out.nx -= drift * out.tx;
  out.ny -= drift * out.ty;
  out.nz -= drift * out.tz;
  length = length3(out.nx, out.ny, out.nz);
  out.nx /= length;
  out.ny /= length;
  out.nz /= length;
  out.bx = out.ty * out.nz - out.tz * out.ny;
  out.by = out.tz * out.nx - out.tx * out.nz;
  out.bz = out.tx * out.ny - out.ty * out.nx;
  out.segment = segment;
  out.u = u;
  out.t =
    (Number(spine.cumulativeLengths[segment]) +
      u *
        (Number(spine.cumulativeLengths[segment + 1]) -
          Number(spine.cumulativeLengths[segment]))) /
    spine.length;
  return out;
}
/** t is normalized accumulated chord length, never raw Bezier parameter. */
export function sampleSpine(
  spine: Spine,
  t: number,
  out: SpineSample,
): SpineSample {
  const distance = clamp01(t) * spine.length;
  let segment = 0;
  while (
    segment + 1 < spine.segments &&
    Number(spine.cumulativeLengths[segment + 1]) < distance
  )
    segment++;
  const start = Number(spine.cumulativeLengths[segment]);
  const u =
    (distance - start) / (Number(spine.cumulativeLengths[segment + 1]) - start);
  out.distance = 0;
  return interpolateFrame(spine, segment, u, out);
}
export function sampleSpineSegment(
  spine: Spine,
  segment: number,
  u: number,
  out: SpineSample,
): SpineSample {
  return interpolateFrame(spine, segment, clamp01(u), out);
}
export function closestSpine(
  spine: Spine,
  x: number,
  y: number,
  z: number,
  out: SpineSample,
): SpineSample {
  let best = Infinity,
    bestSegment = 0,
    bestU = 0;
  for (let i = 0; i < spine.segments; i++) {
    const a = i * 3;
    const dx = Number(spine.points[a + 3]) - Number(spine.points[a]);
    const dy = Number(spine.points[a + 4]) - Number(spine.points[a + 1]);
    const dz = Number(spine.points[a + 5]) - Number(spine.points[a + 2]);
    const px = x - Number(spine.points[a]),
      py = y - Number(spine.points[a + 1]),
      pz = z - Number(spine.points[a + 2]);
    const u = clamp01(
      (px * dx + py * dy + pz * dz) / (dx * dx + dy * dy + dz * dz),
    );
    const distance = length3(px - u * dx, py - u * dy, pz - u * dz);
    if (distance < best) {
      best = distance;
      bestSegment = i;
      bestU = u;
    }
  }
  interpolateFrame(spine, bestSegment, bestU, out);
  out.distance = best;
  return out;
}
