import { detLog, detPow, detSinCos } from "../../math/det.js";
import { hash2, rand01 } from "../../math/hash.js";
import { polygonNormals } from "../../sdf/polygon.js";
import {
  createSpineSample,
  flattenBeziers,
  type Spine,
  sampleSpine,
} from "../../sdf/spine.js";
import {
  type Aabb,
  type CubicBezier,
  emptyBounds,
  includePoint,
  length3,
  type Vec3,
} from "../../sdf/types.js";
import type {
  IbaraEnvironment,
  ThornConstructionDiagnostics,
  ThornInstance,
  ThornParameters,
  ThornRubble,
  ThornSweep,
} from "./types.js";

const PROFILE_SAMPLES = 257;
const TIP_RADIUS = 0.45;
/** Maximum supported spacing's thickening is included before any query culls the shape. */
export const IBARA_MAX_LOD_SPACING = 64;
function draw(id: number, salt: number): number {
  return rand01(hash2(id, salt));
}
function add(a: Vec3, x: number, y: number, z: number): Vec3 {
  return [a[0] + x, a[1] + y, a[2] + z];
}
/** Maximum distance of the ORIGINAL cubic from its endpoint chord. Projected
 * controls inside the chord make line and segment distance identical. Squared
 * distance is 9*t^2*(1-t)^2*(a+b*t+c*t^2); its interior extrema solve a cubic.
 * Its quadratic turning points bracket every root, then 48 bisections bound
 * each parameter interval by 2^-48. No samples, flags or handle-size proxy. */
function originalExcursion(curve: CubicBezier): number {
  const start = curve[0],
    end = curve[3];
  const dx = end[0] - start[0],
    dy = end[1] - start[1],
    dz = end[2] - start[2];
  const squared = dx * dx + dy * dy + dz * dz;
  if (!(squared > 0)) return Infinity;
  const perpendicular: Vec3[] = [];
  for (const point of [curve[1], curve[2]]) {
    const x = point[0] - start[0],
      y = point[1] - start[1],
      z = point[2] - start[2];
    const t = (x * dx + y * dy + z * dz) / squared;
    if (t < 0 || t > 1) return Infinity;
    perpendicular.push([x - t * dx, y - t * dy, z - t * dz]);
  }
  const first = perpendicular[0] as Vec3,
    last = perpendicular[1] as Vec3;
  const x = last[0] - first[0],
    y = last[1] - first[1],
    z = last[2] - first[2];
  const a = first[0] * first[0] + first[1] * first[1] + first[2] * first[2];
  const b = 2 * (first[0] * x + first[1] * y + first[2] * z);
  const c = x * x + y * y + z * z;
  const g0 = 2 * a,
    g1 = 3 * b - 4 * a,
    g2 = 4 * c - 5 * b,
    g3 = -6 * c;
  const value = (t: number): number => ((g3 * t + g2) * t + g1) * t + g0;
  const boundaries = [0, 1];
  if (c > 0) {
    const discriminant = 4 * g2 * g2 - 12 * g3 * g1;
    if (discriminant > 0)
      for (const sign of [-1, 1]) {
        const t = (-2 * g2 + sign * Math.sqrt(discriminant)) / (6 * g3);
        if (t > 0 && t < 1) boundaries.push(t);
      }
  }
  boundaries.sort((a, b) => a - b);
  let maximum = 0;
  for (let i = 1; i < boundaries.length; i++) {
    let low = Number(boundaries[i - 1]),
      high = Number(boundaries[i]);
    const positive = value(low) > 0;
    const highPositive = value(high) > 0;
    if (positive === highPositive) continue;
    for (let step = 0; step < 48; step++) {
      const t = (low + high) * 0.5;
      const middlePositive = value(t) > 0;
      if (middlePositive === positive) low = t;
      else high = t;
    }
    const t = (low + high) * 0.5,
      u = 1 - t;
    maximum = Math.max(maximum, 9 * t * t * u * u * (a + b * t + c * t * t));
  }
  return Math.sqrt(maximum);
}
/** Exact de Casteljau subdivision: give the tight terminal hook its own adaptive interval. */
function splitHook(curve: CubicBezier, t: number): readonly CubicBezier[] {
  const mix = (a: Vec3, b: Vec3): Vec3 => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
  const a = mix(curve[0], curve[1]),
    b = mix(curve[1], curve[2]),
    c = mix(curve[2], curve[3]);
  const d = mix(a, b),
    e = mix(b, c),
    point = mix(d, e);
  return [
    [curve[0], a, d, point],
    [point, e, c, curve[3]],
  ];
}
/** A different exact partition can allocate the frozen 24 segments better on a
 * slope. Try a finite list only after the accepted partition fails. Never change
 * controls, tolerances or the budget, and propagate any remaining failure. */
function flattenTracked(
  curves: readonly CubicBezier[],
  diagnostics: ThornConstructionDiagnostics,
): Spine {
  diagnostics.flattenCalls++;
  return flattenBeziers(curves);
}
function featureSpine(
  curves: readonly CubicBezier[],
  diagnostics: ThornConstructionDiagnostics,
): Spine {
  const first = flattenTracked(curves, diagnostics);
  if (!first.capped || curves.length !== 1) return first;
  for (const t of [
    0.75, 0.95, 0.25, 0.375, 0.625, 0.875, 0.125, 0.9, 0.1, 0.3, 0.4, 0.6, 0.7,
    0.45, 0.55, 0.8, 0.2,
  ]) {
    diagnostics.partitionAttempts++;
    const spine = flattenTracked(
      splitHook(curves[0] as CubicBezier, t),
      diagnostics,
    );
    if (!spine.capped) return spine;
  }
  // Extreme height/span ratios need a finer allocation search. This is still
  // the identical cubic, and each candidate shares one global 24-segment cap.
  for (let i = 1; i < 200; i++) {
    diagnostics.partitionAttempts++;
    diagnostics.finePartitionAttempts++;
    const spine = flattenTracked(
      splitHook(curves[0] as CubicBezier, i / 200),
      diagnostics,
    );
    if (!spine.capped) return spine;
  }
  // A tight hooked colossus may need two allocation boundaries. All three
  // exact subcurves still enter ONE public flatten call and share its global
  // 24-segment budget. Existing successful paths return above unchanged.
  const curve = curves[0] as CubicBezier;
  const partition = (a: number, b: number): Spine => {
    const firstParts = splitHook(curve, a);
    const lastParts = splitHook(
      firstParts[1] as CubicBezier,
      (b - a) / (1 - a),
    );
    diagnostics.partitionAttempts++;
    return flattenTracked(
      [firstParts[0] as CubicBezier, ...lastParts],
      diagnostics,
    );
  };
  let bestFirst = 0,
    bestSecond = 0,
    bestScore = Infinity;
  for (let i = 1; i < 20; i++)
    for (let j = i + 1; j < 20; j++) {
      const a = i / 20,
        b = j / 20,
        spine = partition(a, b);
      if (!spine.capped) return spine;
      // This score only selects a refinement centre. Acceptance is exclusively
      // the unchanged public flattener's capped flag, never this approximation.
      const score = Math.max(
        spine.maxChordError / 0.5,
        (1 - spine.minimumJointDot) / (1 - 0.9781476007),
      );
      if (score < bestScore) {
        bestScore = score;
        bestFirst = a;
        bestSecond = b;
      }
    }
  // At most 121 further candidates after the finite 171-pair coarse grid.
  // Refine exact parameter partitions; never change the authored controls.
  for (let i = -5; i <= 5; i++)
    for (let j = -5; j <= 5; j++) {
      const a = bestFirst + i / 200,
        b = bestSecond + j / 200;
      if (!(a > 0 && b > a && b < 1)) continue;
      diagnostics.finePartitionAttempts++;
      const spine = partition(a, b);
      if (!spine.capped) return spine;
    }
  return first;
}
function thinLength(radii: Float64Array, length: number): number {
  const last = radii.length - 1;
  if (Number(radii[last]) >= 0.7) return 0;
  let i = last - 1;
  while (i > 0 && Number(radii[i]) < 0.7) i--;
  const fraction =
    (Number(radii[i]) - 0.7) / (Number(radii[i]) - Number(radii[i + 1]));
  return length * (1 - (i + fraction) / last);
}
/** Clamp against the table the sampler actually interpolates. The analytic cap
 * alone slightly lengthens a concave tip after linear interpolation. Applies to
 * branches, roots and scree as well as the principal thorn. */
function safeExponent(
  radius: number,
  exponent: number,
  length: number,
  id: number,
): number {
  const allowed = Math.min(length, Math.max(1.5, 0.04 * length));
  if (allowed >= length) return exponent;
  const cap = detLog(0.25 / (radius - TIP_RADIUS)) / detLog(allowed / length);
  let high = Math.min(exponent, cap);
  const station = (1 - allowed / length) * (PROFILE_SAMPLES - 1);
  const i = Math.floor(station),
    f = station - i;
  const atLimit = (p: number): number => {
    const a = profile(radius, p, i / (PROFILE_SAMPLES - 1), id, false);
    const b = profile(radius, p, (i + 1) / (PROFILE_SAMPLES - 1), id, false);
    return a + (b - a) * f;
  };
  if (atLimit(high) >= 0.7) return high;
  let low = 0;
  for (let iteration = 0; iteration < 40; iteration++) {
    const mid = (low + high) * 0.5;
    if (atLimit(mid) >= 0.7) low = mid;
    else high = mid;
  }
  return low;
}
function mergeBounds(a: Aabb, b: Aabb): void {
  includePoint(a, b.minX, b.minY, b.minZ);
  includePoint(a, b.maxX, b.maxY, b.maxZ);
}
function profile(
  r0: number,
  exponent: number,
  t: number,
  id: number,
  arch: boolean,
): number {
  const tip = arch ? 0.35 * r0 : TIP_RADIUS;
  let radius = tip + (r0 - tip) * detPow(1 - t, exponent);
  if (r0 >= 4) {
    const count = 2 + Math.floor(draw(id, 100) * 3);
    for (let i = 0; i < count; i++) {
      const centre = 0.16 + (i * 0.62) / Math.max(1, count - 1);
      const distance =
        Math.abs(t - centre) / (0.075 + draw(id, 110 + i) * 0.035);
      if (distance < 1) {
        const bump = (1 - distance * distance) * (1 - distance * distance);
        radius += Math.max(0.6, 0.12 * radius) * bump;
      }
    }
  }
  return radius;
}
function mainCurves(
  p: ThornParameters,
  environment: IbaraEnvironment,
  bendScale: number,
  diagnostics: ThornConstructionDiagnostics,
): readonly CubicBezier[] {
  const trig = new Float64Array(2);
  detSinCos((p.leanDegrees * Math.PI) / 180, trig);
  const horizontal = Number(trig[0]),
    up = Number(trig[1]);
  const dx = p.flowX,
    dz = p.flowZ,
    side = (draw(p.id, 9) < 0.5 ? -1 : 1) * p.bend * bendScale;
  const start = add(p.base, 0, -0.12 * p.height, 0);
  if (p.arch) {
    const endpoint = add(p.base, dx * p.archSpan, 0, dz * p.archSpan);
    const end: Vec3 = [
      endpoint[0],
      environment.surfaceAt(endpoint[0], endpoint[2]) - 0.1 * p.baseRadius,
      endpoint[2],
    ];
    return [
      [
        start,
        add(
          p.base,
          dx * p.archSpan * 0.2 - dz * side * 0.4,
          p.height * 1.6,
          dz * p.archSpan * 0.2 + dx * side * 0.4,
        ),
        add(
          end,
          -dx * p.archSpan * 0.45 - dz * side * 0.15,
          p.height * 1.1,
          -dz * p.archSpan * 0.45 + dx * side * 0.15,
        ),
        end,
      ],
    ];
  }
  const direction: Vec3 = [dx * horizontal, up, dz * horizontal];
  const point = (t: number, sideways: number): Vec3 =>
    add(
      p.base,
      direction[0] * p.height * t - dz * sideways,
      direction[1] * p.height * t,
      direction[2] * p.height * t + dx * sideways,
    );
  const c1 = point(0.25, side),
    c2 = point(0.7, p.sCurve ? -side : side * 0.8);
  if (p.sCurve && !p.hooked && !p.landmark && p.baseRadius < 4) {
    const excursion = originalExcursion([start, c1, c2, point(1, side * 0.25)]);
    if (excursion < 1) {
      // Full repair for the documented sub-0.5m invisible detail range; blend
      // continuously back to the exact old controls by a one-voxel excursion.
      // Keep the operand as +/- intermediate sideways excursion from the
      // original axial cubic plus linear root-to-tip drift. The final lobe
      // settles with zero added lateral tangent, preserving a tapered tip.
      const t = Math.max(0, (excursion - 0.5) * 2);
      const blend = 1 - t * t * (3 - 2 * t);
      // Interval lengths a, 2a, sqrt(2)*a make both first and second
      // derivatives agree at the extrema. The lower lobe retains its rise;
      // the longer terminal interval spreads the return into the tip.
      const a = 1 / (3 + Math.sqrt(2));
      const partition = (curve: CubicBezier): readonly CubicBezier[] => {
        const first = splitHook(curve, a);
        const last = splitHook(first[1] as CubicBezier, (2 * a) / (1 - a));
        return [first[0] as CubicBezier, ...last];
      };
      const original = partition([start, c1, c2, point(1, side * 0.25)]);
      const baseline = partition([
        start,
        point(0.25, side / 12),
        point(0.7, side / 6),
        point(1, side * 0.25),
      ]);
      const offsets = [
        [0, 0.5, 1, 1],
        [1, 1, -1, -1],
        [-1, -1, 0, 0],
      ] as const;
      return original.map((curve, i): CubicBezier => {
        const mixed = (j: number): Vec3 => {
          const old = curve[j] as Vec3;
          const target = add(
            (baseline[i] as CubicBezier)[j] as Vec3,
            -dz * side * Number(offsets[i]?.[j]),
            0,
            dx * side * Number(offsets[i]?.[j]),
          );
          return [
            old[0] + blend * (target[0] - old[0]),
            old[1],
            old[2] + blend * (target[2] - old[2]),
          ];
        };
        return [mixed(0), mixed(1), mixed(2), mixed(3)];
      });
    }
  }
  if (!p.hooked) return [[start, c1, c2, point(1, side * 0.25)]];
  const end = point(1, side * 0.25);
  const hookOutside = add(
    point(1.25, side * 0.8),
    dx * p.height * 0.22,
    0,
    dz * p.height * 0.22,
  );
  const hook: CubicBezier = [start, c1, hookOutside, end];
  if (p.landmark && flattenTracked([hook], diagnostics).capped) {
    // Preserve successful spines. These exact partitions only change allocation of the
    // same 24 segments, never the authored curve or its error/angle requirements.
    for (const t of [0.75, 0.95]) {
      const parts = splitHook(hook, t);
      diagnostics.partitionAttempts++;
      if (!flattenTracked(parts, diagnostics).capped) return parts;
    }
  }
  return [hook];
}
function sweep(
  curves: readonly CubicBezier[],
  radius: number,
  exponent: number,
  p: ThornParameters,
  fillet: number,
  diagnostics: ThornConstructionDiagnostics,
  tStart = 0,
  tScale = 1,
  arch = false,
  roughness = true,
  preparedSpine?: Spine,
): ThornSweep {
  const spine = preparedSpine ?? featureSpine(curves, diagnostics);
  if (spine.capped)
    throw new RangeError(
      `Thorn ${p.id} exceeds spine accuracy: ${spine.maxChordError}/${spine.minimumJointDot}; partitions=${diagnostics.partitionAttempts}, fine=${diagnostics.finePartitionAttempts}`,
    );
  const profileExponent = arch
    ? exponent
    : safeExponent(radius, exponent, spine.length, p.id);
  const radii = new Float64Array(PROFILE_SAMPLES);
  let maxRadius = 0;
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    const r = profile(
      radius,
      profileExponent,
      i / (PROFILE_SAMPLES - 1),
      p.id,
      arch,
    );
    radii[i] = r;
    maxRadius = Math.max(maxRadius, r);
  }
  const trig = new Float64Array(2);
  detSinCos(Math.PI / p.facets, trig);
  const outerRadius = maxRadius / Number(trig[1]);
  const segmentRadii = new Float64Array(spine.segments);
  for (let i = 0; i < spine.segments; i++) {
    const first = Math.floor(
      (Number(spine.cumulativeLengths[i]) / spine.length) *
        (PROFILE_SAMPLES - 1),
    );
    const last = Math.ceil(
      (Number(spine.cumulativeLengths[i + 1]) / spine.length) *
        (PROFILE_SAMPLES - 1),
    );
    let localRadius = 0;
    for (let j = first; j <= last; j++)
      localRadius = Math.max(localRadius, Number(radii[j]));
    segmentRadii[i] = localRadius / Number(trig[1]);
  }
  const displacement = roughness && radius >= 4 ? 0.8 : 0;
  const padding =
    outerRadius +
    fillet +
    displacement +
    Math.min(IBARA_MAX_LOD_SPACING * 0.5, 0.3 * p.height);
  const bounds = emptyBounds();
  // Controls bound the complete Bezier, including flattening error and endpoints.
  for (const curve of curves)
    for (const point of curve) includePoint(bounds, ...point, padding);
  return {
    spine,
    radii,
    maxRadius: outerRadius,
    profileExponent,
    thinTipLength: thinLength(radii, spine.length),
    segmentRadii,
    normals: polygonNormals(p.facets),
    facetiness: p.facetiness,
    twist: p.twist,
    phase: p.phase,
    roughness: displacement,
    seed: p.id,
    tStart,
    tScale,
    bounds,
  };
}
/** Build one complete asset. Reject impossible curve tolerances instead of accepting a capped spine. */
export function instantiateThorn(
  p: ThornParameters,
  environment: IbaraEnvironment,
): ThornInstance {
  const fillet = Math.max(2, 0.5 * p.baseRadius);
  const construction: ThornConstructionDiagnostics = {
    flattenCalls: 0,
    partitionAttempts: 0,
    finePartitionAttempts: 0,
  };
  const curves = mainCurves(p, environment, 1, construction);
  const provisional = featureSpine(curves, construction);
  if (provisional.capped)
    throw new RangeError(
      `Thorn ${p.id} cannot meet curve accuracy: error=${provisional.maxChordError}, joint=${provisional.minimumJointDot}, h=${p.height}, bend=${p.bend}, hook=${p.hooked}, arch=${p.arch}, partitions=${construction.partitionAttempts}, fine=${construction.finePartitionAttempts}`,
    );
  const allowedThin = Math.max(1.5, 0.04 * provisional.length);
  const capExponent =
    detLog(0.25 / (p.baseRadius - TIP_RADIUS)) /
    detLog(allowedThin / provisional.length);
  const exponent = p.arch
    ? p.exponent
    : Math.min(p.exponent, capExponent, p.broken ? 0.6 : 1.4);
  const main = sweep(
    curves,
    p.baseRadius,
    exponent,
    p,
    fillet,
    construction,
    0,
    1,
    p.arch,
    true,
    provisional,
  );
  const sweeps: ThornSweep[] = [main],
    debris: ThornSweep[] = [],
    rubble: ThornRubble[] = [];
  const frame = createSpineSample();
  const trig = new Float64Array(2);
  for (let i = 0; i < p.branchCount; i++) {
    const branchTop = p.broken ? Math.min(0.6, p.breakT - 0.08) : 0.6;
    const t = 0.2 + (p.broken ? branchTop - 0.2 : 0.4) * draw(p.id, 140 + i);
    sampleSpine(main.spine, t, frame);
    detSinCos(p.phase + i * 2.4 + draw(p.id, 150 + i), trig);
    let dx = frame.nx * Number(trig[1]) + frame.bx * Number(trig[0]);
    let dz = frame.nz * Number(trig[1]) + frame.bz * Number(trig[0]);
    const norm = Math.sqrt(dx * dx + dz * dz);
    dx /= Math.max(norm, 1e-6);
    dz /= Math.max(norm, 1e-6);
    const length = p.height * (0.2 + 0.2 * draw(p.id, 160 + i));
    const radius = Math.max(
      1.5,
      p.baseRadius * (0.22 + 0.16 * draw(p.id, 170 + i)),
    );
    const start: Vec3 = [frame.x, frame.y, frame.z];
    const end = add(
      start,
      dx * length * 0.75,
      length * 0.72,
      dz * length * 0.75,
    );
    const branch: CubicBezier = [
      start,
      add(start, dx * length * 0.3, length * 0.12, dz * length * 0.3),
      add(end, -dx * length * 0.16, -length * 0.38, -dz * length * 0.16),
      end,
    ];
    const branchLength = flattenTracked([branch], construction).length;
    const branchExponent = Math.min(
      0.8,
      detLog(0.25 / (radius - TIP_RADIUS)) /
        detLog(Math.max(1.5, 0.04 * branchLength) / branchLength),
    );
    sweeps.push(
      sweep(
        [branch],
        radius,
        branchExponent,
        p,
        Math.max(1, 0.35 * radius),
        construction,
        t,
        1 - t,
        false,
      ),
    );
  }
  if (p.broken) {
    const count = 1 + Math.floor(draw(p.id, 180) * 3);
    for (let i = 0; i < count; i++) {
      detSinCos(p.phase + i * 2.1, trig);
      const dx = Number(trig[1]),
        dz = Number(trig[0]);
      const r = Math.max(
        1.5,
        p.baseRadius * (0.5 + 0.18 * draw(p.id, 181 + i)),
      );
      const length = Math.max(4, Math.min(p.height * 0.24, 22));
      const x = p.base[0] + dx * p.baseRadius * 1.5,
        z = p.base[2] + dz * p.baseRadius * 1.5;
      const start: Vec3 = [x, environment.surfaceAt(x, z) - r * 0.35, z];
      const ex = x + dx * length,
        ez = z + dz * length;
      const end: Vec3 = [ex, environment.surfaceAt(ex, ez) - 0.15, ez];
      debris.push(
        sweep(
          [
            [
              start,
              add(start, (dx * length) / 3, 0.3, (dz * length) / 3),
              add(end, (-dx * length) / 3, 0.5, (-dz * length) / 3),
              end,
            ],
          ],
          r,
          0.7,
          { ...p, facets: 3, facetiness: 1, twist: 0.2, phase: p.phase + i },
          1,
          construction,
          0,
          0.6,
          false,
          false,
        ),
      );
    }
  }
  if (p.baseRadius >= 4) {
    // Unequal low buttresses join the buried body to the ground; never a ring of discs.
    const roots = 3 + Math.floor(draw(p.id, 250) * 3);
    for (let i = 0; i < roots; i++) {
      detSinCos(
        p.phase + i * 2.399963229728653 + draw(p.id, 251 + i) * 0.9,
        trig,
      );
      const dx = Number(trig[1]),
        dz = Number(trig[0]);
      const reach = p.baseRadius * (1.5 + 0.8 * draw(p.id, 260 + i));
      const r = Math.max(
        1.4,
        p.baseRadius * (0.18 + 0.15 * draw(p.id, 270 + i)),
      );
      const start = add(
        p.base,
        dx * p.baseRadius * 0.3,
        -r * 0.2,
        dz * p.baseRadius * 0.3,
      );
      const ex = p.base[0] + dx * reach,
        ez = p.base[2] + dz * reach;
      const end: Vec3 = [ex, environment.surfaceAt(ex, ez) - 0.9, ez];
      debris.push(
        sweep(
          [
            [
              start,
              add(start, dx * reach * 0.3, r * 0.3, dz * reach * 0.3),
              add(end, -dx * reach * 0.25, r * 0.1, -dz * reach * 0.25),
              end,
            ],
          ],
          r,
          0.8,
          {
            ...p,
            facets: 3 + (i % 2),
            facetiness: 1,
            twist: 0.1,
            phase: p.phase + i * 1.3,
          },
          0.6,
          construction,
          0,
          0.2,
          false,
          false,
        ),
      );
    }
    const count = 4 + Math.floor(draw(p.id, 200) * 5);
    for (let i = 0; i < count; i++) {
      detSinCos(p.phase + i * 2.399963229728653, trig);
      const distance = p.baseRadius * (1.2 + 0.8 * draw(p.id, 210 + i));
      const x = p.base[0] + Number(trig[1]) * distance,
        z = p.base[2] + Number(trig[0]) * distance;
      const r = 1.2 + draw(p.id, 220 + i) * Math.min(2.8, p.baseRadius * 0.3);
      const radii: Vec3 = [
        r * (1.1 + draw(p.id, 280 + i)),
        r,
        r * (0.5 + 0.4 * draw(p.id, 290 + i)),
      ];
      detSinCos(p.phase + draw(p.id, 300 + i) * 6, trig);
      rubble.push({
        centre: [
          x,
          environment.surfaceAt(x, z) - r * (0.2 + 0.35 * draw(p.id, 310 + i)),
          z,
        ],
        radii,
        axis: [Number(trig[1]), Number(trig[0])],
        topSlope: [
          0.25 + 0.35 * draw(p.id, 320 + i),
          -0.3 + 0.6 * draw(p.id, 330 + i),
        ],
        boundRadius: length3(...radii),
      });
    }
    for (let i = 0; i < 2; i++) {
      detSinCos(p.phase + i * 2.7, trig);
      const dx = Number(trig[1]),
        dz = Number(trig[0]);
      const h = 4 + draw(p.id, 240 + i) * 6,
        r = Math.max(1.2, 0.3 * h);
      const x = p.base[0] + dx * p.baseRadius * 1.4,
        z = p.base[2] + dz * p.baseRadius * 1.4;
      const start: Vec3 = [x, environment.surfaceAt(x, z) - r * 0.4, z];
      const end = add(start, dx * h * 0.28, h, dz * h * 0.28);
      debris.push(
        sweep(
          [
            [
              start,
              add(start, dx * h * 0.22, h * 0.2, dz * h * 0.22),
              add(end, -dx * h * 0.03, -h * 0.3, -dz * h * 0.03),
              end,
            ],
          ],
          r,
          0.7,
          {
            ...p,
            facets: 3 + (i % 2),
            facetiness: 1,
            twist: 0.15,
            phase: p.phase + i,
          },
          1,
          construction,
          0,
          0.7,
          false,
          false,
        ),
      );
    }
  }
  const bounds = emptyBounds();
  for (const part of [...sweeps, ...debris]) mergeBounds(bounds, part.bounds);
  for (const rock of rubble)
    includePoint(bounds, ...rock.centre, rock.boundRadius + fillet);
  const thinTipLength = p.arch || p.broken ? 0 : main.thinTipLength;
  return {
    parameters: p,
    construction,
    sweeps,
    debris,
    rubble,
    bounds,
    fillet,
    profileExponent: main.profileExponent,
    thinTipLength,
    lodPolicy: p.landmark ? "landmark" : "thicken",
  };
}
