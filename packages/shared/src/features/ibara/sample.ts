import { detSinCos } from "../../math/det.js";
import { openSimplex2 } from "../../noise/opensimplex2.js";
import { terrainNoise3 } from "../../noise/opensimplex2s.js";
import { smoothUnion } from "../../sdf/ops.js";
import { polygonSection } from "../../sdf/polygon.js";
import {
  createSpineSample,
  type SpineSample,
  sampleSpine,
  sampleSpineSegment,
} from "../../sdf/spine.js";
import { clamp01, length3, pointInBounds } from "../../sdf/types.js";
import {
  clearIbaraSample,
  type IbaraSample,
  type ThornInstance,
  type ThornRubble,
  type ThornSweep,
} from "./types.js";

export interface IbaraWorkspace {
  readonly frame: SpineSample;
  readonly cut: SpineSample;
  readonly trig: Float64Array;
  readonly noise: Float64Array;
  t: number;
  segmentTests: number;
}
export function createIbaraWorkspace(): IbaraWorkspace {
  return {
    frame: createSpineSample(),
    cut: createSpineSample(),
    trig: new Float64Array(2),
    noise: new Float64Array(10),
    t: 0,
    segmentTests: 0,
  };
}
export function sweepRadius(sweep: ThornSweep, t: number): number {
  const station = clamp01(t) * (sweep.radii.length - 1);
  const i = Math.min(sweep.radii.length - 2, Math.floor(station));
  return (
    Number(sweep.radii[i]) +
    (Number(sweep.radii[i + 1]) - Number(sweep.radii[i])) * (station - i)
  );
}
/** Conservative bounding capsule; also protects narrow-band culling for bent/displaced fields. */
export function sweepLowerBound(
  sweep: ThornSweep,
  x: number,
  y: number,
  z: number,
  thickening = 0,
): number {
  let best = Infinity;
  for (let i = 0; i < sweep.spine.segments; i++) {
    const a = i * 3,
      points = sweep.spine.points;
    const dx = Number(points[a + 3]) - Number(points[a]),
      dy = Number(points[a + 4]) - Number(points[a + 1]),
      dz = Number(points[a + 5]) - Number(points[a + 2]);
    const px = x - Number(points[a]),
      py = y - Number(points[a + 1]),
      pz = z - Number(points[a + 2]);
    const u = clamp01(
      (px * dx + py * dy + pz * dz) / (dx * dx + dy * dy + dz * dz),
    );
    best = Math.min(
      best,
      length3(px - u * dx, py - u * dy, pz - u * dz) -
        Number(sweep.segmentRadii[i]) -
        sweep.roughness -
        thickening,
    );
  }
  return best;
}
/** Polygonal swept capsule chain with transported frames and spatially coherent roughness. */
export function sampleThornSweep(
  sweep: ThornSweep,
  x: number,
  y: number,
  z: number,
  thickening: number,
  work: IbaraWorkspace,
): number {
  let best = Infinity,
    bestT = 0;
  const points = sweep.spine.points;
  for (let i = 0; i < sweep.spine.segments; i++) {
    const a = i * 3;
    const dx = Number(points[a + 3]) - Number(points[a]),
      dy = Number(points[a + 4]) - Number(points[a + 1]),
      dz = Number(points[a + 5]) - Number(points[a + 2]);
    const px = x - Number(points[a]),
      py = y - Number(points[a + 1]),
      pz = z - Number(points[a + 2]);
    const l2 = dx * dx + dy * dy + dz * dz;
    let u = clamp01((px * dx + py * dy + pz * dz) / l2);
    let distance = length3(px - u * dx, py - u * dy, pz - u * dz);
    if (
      distance - Number(sweep.segmentRadii[i]) - sweep.roughness - thickening >=
      best
    )
      continue;
    work.segmentTests++;
    const startT =
      Number(sweep.spine.cumulativeLengths[i]) / sweep.spine.length;
    const endT =
      Number(sweep.spine.cumulativeLengths[i + 1]) / sweep.spine.length;
    const ra = sweepRadius(sweep, startT),
      rb = sweepRadius(sweep, endT);
    // Account for taper: the nearest sphere in a conical capsule lies toward its wider end.
    const slope = (rb - ra) / Math.sqrt(l2);
    if (Math.abs(slope) < 0.95)
      u = clamp01(u + (slope * distance) / Math.sqrt(l2 * (1 - slope * slope)));
    const frame = sampleSpineSegment(sweep.spine, i, u, work.frame);
    const qx = x - frame.x,
      qy = y - frame.y,
      qz = z - frame.z;
    distance = length3(qx, qy, qz);
    const fx = qx * frame.nx + qy * frame.ny + qz * frame.nz;
    const fy = qx * frame.bx + qy * frame.by + qz * frame.bz;
    detSinCos(sweep.phase + sweep.twist * frame.t, work.trig);
    const sx = fx * Number(work.trig[1]) + fy * Number(work.trig[0]);
    const sy = fy * Number(work.trig[1]) - fx * Number(work.trig[0]);
    const radius = sweepRadius(sweep, frame.t) + thickening;
    const radial = Math.sqrt(fx * fx + fy * fy);
    let value =
      polygonSection(sx, sy, radius, sweep.normals, sweep.facetiness) +
      distance -
      radial;
    if (sweep.roughness > 0 && radius >= 4) {
      const inverse = radial > 1e-8 ? 1 / radial : 0;
      terrainNoise3(
        sweep.seed,
        sx * inverse * 2.6,
        (frame.t * sweep.spine.length) / 9,
        sy * inverse * 2.6,
        work.noise,
      );
      value +=
        Number(work.noise[0]) * sweep.roughness * clamp01((radius - 4) / 2);
    }
    if (value < best) {
      best = value;
      bestT = frame.t;
    }
  }
  work.t = sweep.tStart + bestT * sweep.tScale;
  return best;
}
/** True means this feature survives this sample spacing; landmarks are never dropped. */
export function thornVisibleAtSpacing(
  thorn: ThornInstance,
  spacing: number,
): boolean {
  if (!(spacing >= 1 && spacing <= 64))
    throw new RangeError("Unsupported Ibara sample spacing");
  return (
    thorn.lodPolicy === "landmark" || thorn.parameters.height >= 2 * spacing
  );
}
/** Clipped convex stone with planar sides and a sloping fracture face. All planes are unit length. */
export function sampleThornRubble(
  rock: ThornRubble,
  x: number,
  y: number,
  z: number,
): number {
  const dx = x - rock.centre[0],
    dy = y - rock.centre[1],
    dz = z - rock.centre[2];
  const rx = dx * rock.axis[0] + dz * rock.axis[1];
  const rz = dz * rock.axis[0] - dx * rock.axis[1];
  const [a, b, c] = rock.radii;
  const sx = rock.topSlope[0] / a,
    sy = 1 / b,
    sz = rock.topSlope[1] / c;
  return Math.max(
    Math.abs(rx) - a,
    Math.abs(dy) - b,
    Math.abs(rz) - c,
    (Math.abs(rx) / a + Math.abs(rz) / c - 1.35) /
      Math.sqrt(1 / (a * a) + 1 / (c * c)),
    (sx * rx + sy * dy + sz * rz - 0.65) / length3(sx, sy, sz),
  );
}
/** Structural flare is local to each foot; nearby stones must not inherit a colossus-sized skirt.
 * Smooth spatial weights avoid a density discontinuity where the dominant part changes.
 */
export function thornGroundFillet(
  thorn: ThornInstance,
  x: number,
  z: number,
): number {
  const p = thorn.parameters;
  const weight = (cx: number, cz: number, r: number): number => {
    const dx = x - cx,
      dz = z - cz;
    const along = (dx * p.flowX + dz * p.flowZ) / r;
    const across = (-dx * p.flowZ + dz * p.flowX) / r;
    const a = along * (along < 0 ? 0.85 : 1.15);
    const b = across * (across < 0 ? 1.1 : 0.9);
    const t = clamp01((1.65 - Math.sqrt(a * a + b * b)) / 1.05);
    return t * t * (3 - 2 * t);
  };
  let fillet =
    0.6 + (thorn.fillet - 0.6) * weight(p.base[0], p.base[2], p.baseRadius);
  if (p.arch) {
    const r = p.baseRadius * 0.35;
    fillet = Math.max(
      fillet,
      0.6 +
        (Math.max(2, 0.5 * r) - 0.6) *
          weight(
            p.base[0] + p.flowX * p.archSpan,
            p.base[2] + p.flowZ * p.archSpan,
            r,
          ),
    );
  }
  return fillet;
}
export function sampleThorn(
  thorn: ThornInstance,
  x: number,
  y: number,
  z: number,
  spacing: number,
  out: IbaraSample,
  work: IbaraWorkspace,
): IbaraSample {
  clearIbaraSample(out);
  if (
    !thornVisibleAtSpacing(thorn, spacing) ||
    !pointInBounds(thorn.bounds, x, y, z)
  )
    return out;
  const thickening =
    spacing <= 1 || thorn.lodPolicy === "landmark"
      ? 0
      : Math.min(0.5 * spacing, 0.3 * thorn.parameters.height);
  let best = Infinity,
    bestT = 0,
    kind: IbaraSample["kind"] = "none";
  for (let i = 0; i < thorn.sweeps.length; i++) {
    const sweep = thorn.sweeps[i] as ThornSweep;
    let value = sampleThornSweep(sweep, x, y, z, thickening, work);
    const t = work.t;
    if (i === 0 && thorn.parameters.broken) {
      const cut = sampleSpine(sweep.spine, thorn.parameters.breakT, work.cut);
      const qx = x - cut.x,
        qy = y - cut.y,
        qz = z - cut.z;
      const nx = qx * cut.nx + qy * cut.ny + qz * cut.nz;
      const nz = qx * cut.bx + qy * cut.by + qz * cut.bz;
      openSimplex2(
        thorn.parameters.id ^ 0x7163,
        nx / 2.4,
        nz / 2.4,
        work.noise,
      );
      const cap =
        qx * cut.tx +
        qy * cut.ty +
        qz * cut.tz +
        nx * 0.4 +
        nz * 0.2 +
        Number(work.noise[0]) *
          Math.max(1.3, 0.18 * thorn.parameters.baseRadius);
      value = Math.max(value, cap);
    }
    if (value < best) {
      bestT = t;
      kind = i === 0 ? "thorn" : "branch";
    }
    best =
      i === 0
        ? value
        : smoothUnion(
            best,
            value,
            Math.max(1, 0.18 * thorn.parameters.baseRadius),
          );
  }
  for (const sweep of thorn.debris) {
    const value = sampleThornSweep(sweep, x, y, z, thickening, work);
    if (value < best) {
      bestT = work.t;
      kind = "debris";
    }
    best = Math.min(best, value);
  }
  for (const rubble of thorn.rubble) {
    const value = sampleThornRubble(rubble, x, y, z);
    if (value < best) {
      bestT = 0;
      kind = "rubble";
    }
    best = Math.min(best, value);
  }
  out.distance = best;
  out.featureId = thorn.parameters.id;
  out.t = bestT;
  out.fillet = thornGroundFillet(thorn, x, z);
  out.core = thorn.parameters.core;
  // Material eligibility (tip, break and part kind) belongs to the material stage.
  // Preserve the winning parent's authored choice, even in its buried roots.
  out.crust = thorn.parameters.crust;
  out.kind = kind;
  out.broken = thorn.parameters.broken;
  return out;
}
