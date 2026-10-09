import type { Point } from "../../../client/src/game/raycast.js";
import { BLOCK_REGISTRY } from "../../../shared/src/blocks/registry.js";
import {
  createIbaraWorkspace,
  sampleThorn,
  sweepRadius,
} from "../../../shared/src/features/ibara/sample.js";
import {
  createIbaraSample,
  type ThornInstance,
  type ThornSweep,
} from "../../../shared/src/features/ibara/types.js";
import {
  createSpineSample,
  sampleSpine,
} from "../../../shared/src/sdf/spine.js";
import {
  type CameraFirstHit,
  cameraFrame,
  type MainCameraCandidate,
} from "./geometry.js";
import type { CameraQuery } from "./query.js";

/** Selection diagnostics at the fixed 1280x720 postcard size, NOT rubric scores.
 * Native silhouettes and the whole-region census still require their own proof. */
export const HELL_READABILITY_LIMITS = Object.freeze({
  parents: 12,
  visibilityRays: 64,
  contourMargin: 12,
  usefulHeight: 72,
  usefulExcursion: 8,
  minimumParentCells: 3,
});
type Projected = Readonly<{ x: number; y: number; depth: number }>;
interface Station {
  readonly point: Point;
  readonly projected: Projected;
  readonly radiusPixels: number;
  readonly t: number;
}
export interface ThornContour {
  readonly id: number;
  readonly complete: boolean;
  readonly useful: boolean;
  readonly heightPixels: number;
  readonly curvePixels: number;
  readonly curveT: number;
  readonly hookTurnDegrees: number;
  readonly hookPixels: number;
  readonly main: readonly Station[];
  readonly branches: readonly (readonly Station[])[];
}
export interface HellReadability {
  readonly objective: "hell1-readable-forms-v1";
  readonly passed: boolean;
  readonly reasons: readonly string[];
  readonly score: number;
  readonly dominantId: number | null;
  readonly dominantComplete: boolean;
  readonly groundTransition: boolean;
  readonly sizeClasses: readonly number[];
  readonly families: Readonly<
    Record<"curved" | "hooked" | "branched" | "broken", readonly number[]>
  >;
  readonly parents: readonly {
    readonly id: number;
    readonly cells: number;
    readonly fraction: number;
    readonly borderCells: number;
    readonly contour?: Omit<ThornContour, "main" | "branches">;
    readonly mainVisible: boolean;
    readonly bodyVisible: boolean;
    readonly rootCells: number;
    readonly adjacentGroundCells: number;
  }[];
  readonly visibilityRays: number;
  readonly voxelQueries: number;
  readonly rayBudgetExhausted: boolean;
}
const distance = (a: Projected, b: Projected) =>
  Math.hypot(a.x - b.x, a.y - b.y);
function chordDistance(p: Projected, a: Projected, b: Projected): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) /
        Math.max(1e-12, dx * dx + dy * dy),
    ),
  );
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}
/** Samples the public built spine/radius table. No curve construction or salted
 * category reconstruction belongs in the camera resolver. */
export function thornContour(
  view: MainCameraCandidate,
  thorn: ThornInstance,
): ThornContour {
  const frame = cameraFrame(view),
    sample = createSpineSample(),
    p = thorn.parameters;
  const at = (sweep: ThornSweep, t: number): Station => {
    sampleSpine(sweep.spine, t, sample);
    const point = { x: sample.x, y: sample.y, z: sample.z },
      projected = frame.project(point);
    // A one-voxel margin covers the final block silhouette; the profile is the
    // same interpolated radius table the shared density sampler uses.
    const radiusPixels = (sweepRadius(sweep, t) + 1) * projected.pixelsPerMetre;
    return { point, projected, radiusPixels, t };
  };
  const sweep = thorn.sweeps[0];
  if (!sweep) throw new Error(`Missing main sweep: ${p.id}`);
  const end = p.broken ? p.breakT : 1;
  const mainStations = new Set(
    Array.from({ length: 33 }, (_, i) => (i / 32) * end),
  );
  // Preserve every built polyline corner as well as uniform stations: a tight
  // return between the uniform samples must not hide a cropped extremum.
  for (const length of sweep.spine.cumulativeLengths) {
    const t = length / sweep.spine.length;
    if (t <= end) mainStations.add(t);
  }
  const main = [...mainStations]
    .sort((a, b) => a - b)
    .map((t) => at(sweep, t))
    .filter((s) => s.point.y >= p.base[1]);
  const branches = thorn.sweeps
    .slice(1, 1 + p.branchCount)
    .map((branch) =>
      [
        ...new Set([
          ...Array.from({ length: 9 }, (_, i) => i / 8),
          ...Array.from(
            branch.spine.cumulativeLengths,
            (length) => length / branch.spine.length,
          ),
        ]),
      ]
        .sort((a, b) => a - b)
        .map((t) => at(branch, t)),
    );
  const contour = [...main, ...branches.flat()];
  const complete =
    main.length >= 3 &&
    contour.every(
      ({ projected: q, radiusPixels: r }) =>
        q.depth > 0 &&
        q.depth <= view.radius &&
        q.x - r >= HELL_READABILITY_LIMITS.contourMargin &&
        q.x + r <= 1280 - HELL_READABILITY_LIMITS.contourMargin &&
        q.y - r >= HELL_READABILITY_LIMITS.contourMargin &&
        q.y + r <= 720 - HELL_READABILITY_LIMITS.contourMargin,
    );
  const heightPixels = main.length
    ? Math.max(...main.map((s) => s.projected.y)) -
      Math.min(...main.map((s) => s.projected.y))
    : 0;
  let curvePixels = 0,
    curveT = 0;
  const first = main[0],
    last = main.at(-1);
  if (first && last)
    for (const station of main) {
      const value = chordDistance(
        station.projected,
        first.projected,
        last.projected,
      );
      if (value > curvePixels) {
        curvePixels = value;
        curveT = station.t;
      }
    }
  const a = at(sweep, 0.6).projected,
    b = at(sweep, 0.8).projected,
    c = at(sweep, 0.92).projected,
    d = at(sweep, 1).projected;
  const denominator = distance(a, b) * distance(c, d);
  const hookTurnDegrees =
    denominator > 1e-6
      ? (Math.acos(
          Math.max(
            -1,
            Math.min(
              1,
              ((b.x - a.x) * (d.x - c.x) + (b.y - a.y) * (d.y - c.y)) /
                denominator,
            ),
          ),
        ) *
          180) /
        Math.PI
      : 0;
  return {
    id: p.id,
    complete,
    useful: complete && heightPixels >= HELL_READABILITY_LIMITS.usefulHeight,
    heightPixels,
    curvePixels,
    curveT,
    hookTurnDegrees,
    hookPixels: distance(c, d),
    main,
    branches,
  };
}

/** The unchanged full grid supplies coverage and dominance. Directed rays only
 * test already visible parents, never award frame coverage or relax any gate.
 * Every directed result checks the first actual voxel AND the shared winning
 * part, so an obscured tip or a root carrying a branch parent's ID cannot pass. */
export function inspectHellReadability(
  view: MainCameraCandidate,
  instances: readonly ThornInstance[],
  hits: readonly CameraFirstHit[],
  query: CameraQuery,
): HellReadability {
  const byId = new Map(instances.map((thorn) => [thorn.parameters.id, thorn]));
  const groups = new Map<number, CameraFirstHit[]>();
  for (const hit of hits)
    if (hit.featureId && BLOCK_REGISTRY[hit.block]?.solid) {
      const group = groups.get(hit.featureId) ?? [];
      group.push(hit);
      groups.set(hit.featureId, group);
    }
  const ordered = [...groups].sort(
    (a, b) => b[1].length - a[1].length || a[0] - b[0],
  );
  const dominantId = ordered[0]?.[0] ?? null;
  let visibilityRays = 0,
    voxelQueries = 0,
    rayBudgetExhausted = false;
  const work = createIbaraWorkspace(),
    sampled = createIbaraSample();
  const visible = (
    thorn: ThornInstance,
    sweep: ThornSweep,
    t: number,
    kind: "thorn" | "branch",
  ) => {
    if (visibilityRays >= HELL_READABILITY_LIMITS.visibilityRays) {
      rayBudgetExhausted = true;
      return false;
    }
    const point = sampleSpine(sweep.spine, t, createSpineSample());
    const projected = cameraFrame(view).project(point);
    const dx = point.x - view.position.x,
      dy = point.y - view.position.y,
      dz = point.z - view.position.z,
      length = Math.hypot(dx, dy, dz);
    if (
      projected.depth <= 0 ||
      projected.x < 0 ||
      projected.x > 1280 ||
      projected.y < 0 ||
      projected.y > 720 ||
      length > Math.min(512, view.radius)
    )
      return false;
    visibilityRays++;
    for (let d = 0.5; d <= length + 0.5; d += 0.5) {
      const fraction = Math.min(1, d / length),
        x = view.position.x + dx * fraction,
        y = view.position.y + dy * fraction,
        z = view.position.z + dz * fraction;
      voxelQueries++;
      const hit = query.voxel(x, y, z);
      if (!(hit.density > 0) && hit.fluid === 0) continue;
      if (
        hit.featureId !== thorn.parameters.id ||
        !BLOCK_REGISTRY[hit.block]?.solid
      )
        return false;
      sampleThorn(
        thorn,
        Math.floor(x) + 0.5,
        Math.floor(y) + 0.5,
        Math.floor(z) + 0.5,
        1,
        sampled,
        work,
      );
      const expectedT = sweep.tStart + t * sweep.tScale;
      return sampled.kind === kind && Math.abs(sampled.t - expectedT) <= 0.16;
    }
    return false;
  };
  const families: {
    curved: number[];
    hooked: number[];
    branched: number[];
    broken: number[];
  } = { curved: [], hooked: [], branched: [], broken: [] };
  const sizeClasses = new Set<number>();
  let dominantComplete = false,
    groundTransition = false;
  const parents: HellReadability["parents"][number][] = [];
  for (const [id, cells] of ordered.slice(0, HELL_READABILITY_LIMITS.parents)) {
    const thorn = byId.get(id),
      borderCells = cells.filter(
        (h) => h.px === 0 || h.px === 63 || h.py === 0 || h.py === 35,
      ).length;
    if (!thorn) {
      parents.push({
        id,
        cells: cells.length,
        fraction: cells.length / 2304,
        borderCells,
        mainVisible: false,
        bodyVisible: false,
        rootCells: 0,
        adjacentGroundCells: 0,
      });
      continue;
    }
    const contour = thornContour(view, thorn),
      p = thorn.parameters,
      main = thorn.sweeps[0] as ThornSweep;
    const end = p.broken ? p.breakT : 1,
      crownT = end * 0.97;
    const eligible =
      contour.useful &&
      cells.length >= HELL_READABILITY_LIMITS.minimumParentCells;
    const rootVisible =
      eligible &&
      visible(
        thorn,
        main,
        Math.min((contour.main[0]?.t ?? 0.1) + 0.06, end * 0.4),
        "thorn",
      );
    // A foreground object may hide a witness's foot while leaving its body and
    // identifying silhouette exposed. Keep root visibility for the dominant
    // form and grounding, not as an extra requirement on every family/size.
    const bodyVisible =
      eligible &&
      (visible(thorn, main, end * 0.4, "thorn") ||
        visible(thorn, main, end * 0.65, "thorn")) &&
      visible(thorn, main, crownT, "thorn");
    const mainVisible = rootVisible && bodyVisible;
    if (id === dominantId) dominantComplete = mainVisible && !borderCells;
    // Root and neighbouring plain ground must be visible in the SAME grid. Lava
    // and unrelated foreground terrain cannot substitute for the root-to-gap transition.
    const roots = cells.filter(
      (h) =>
        h.y <= p.base[1] + Math.max(3, p.baseRadius * 0.5) &&
        h.distance >= 8 &&
        Math.hypot(h.x - p.base[0], h.z - p.base[2]) <=
          p.baseRadius * 2.5 + thorn.fillet,
    );
    const adjacentGround = hits.filter(
      (h) =>
        !h.featureId &&
        BLOCK_REGISTRY[h.block]?.solid &&
        h.distance >= 8 &&
        roots.some(
          (root) =>
            Math.abs(root.px - h.px) <= 4 &&
            Math.abs(root.py - h.py) <= 2 &&
            Math.hypot(root.x - h.x, root.z - h.z) <= p.baseRadius * 3 + 12,
        ),
    );
    if (mainVisible && roots.length >= 2 && adjacentGround.length >= 3)
      groundTransition = true;
    if (bodyVisible) {
      sizeClasses.add(p.height < 30 ? 0 : p.height < 60 ? 1 : 2);
      if (
        contour.curvePixels >= HELL_READABILITY_LIMITS.usefulExcursion &&
        visible(thorn, main, contour.curveT, "thorn")
      )
        families.curved.push(id);
      if (
        p.hooked &&
        !p.broken &&
        contour.hookTurnDegrees >= 75 &&
        contour.hookPixels >= HELL_READABILITY_LIMITS.usefulExcursion &&
        visible(thorn, main, 0.88, "thorn") &&
        visible(thorn, main, 0.98, "thorn")
      )
        families.hooked.push(id);
      if (
        p.broken &&
        visible(thorn, main, Math.max(0.15, p.breakT - 0.035), "thorn")
      )
        families.broken.push(id);
      for (let i = 0; i < contour.branches.length; i++) {
        const branch = contour.branches[i] as readonly Station[],
          tip = branch.find((station) => station.t === 0.75),
          start = branch[0];
        if (!tip || !start || distance(start.projected, tip.projected) < 12)
          continue;
        let separation = Infinity;
        for (let j = 1; j < contour.main.length; j++) {
          const a = contour.main[j - 1] as Station,
            b = contour.main[j] as Station;
          separation = Math.min(
            separation,
            chordDistance(tip.projected, a.projected, b.projected) -
              Math.max(a.radiusPixels, b.radiusPixels),
          );
        }
        const sweep = thorn.sweeps[i + 1] as ThornSweep;
        if (
          separation >= HELL_READABILITY_LIMITS.usefulExcursion &&
          visible(thorn, sweep, 0.5, "branch") &&
          visible(thorn, sweep, 0.75, "branch")
        ) {
          families.branched.push(id);
          break;
        }
      }
    }
    const { main: _main, branches: _branches, ...receipt } = contour;
    parents.push({
      id,
      cells: cells.length,
      fraction: cells.length / 2304,
      borderCells,
      contour: receipt,
      mainVisible,
      bodyVisible,
      rootCells: roots.length,
      adjacentGroundCells: adjacentGround.length,
    });
  }
  const reasons: string[] = [];
  if (!dominantComplete)
    reasons.push("dominant-contour-cropped-small-or-occluded");
  if (!groundTransition) reasons.push("root-to-ground-transition-unreadable");
  if (sizeClasses.size < 3)
    reasons.push("fewer-than-three-readable-size-classes");
  for (const family of ["curved", "hooked", "branched", "broken"] as const)
    if (!families[family].length) reasons.push(`${family}-witness-unreadable`);
  const score =
    (dominantComplete ? 30 : 0) +
    (groundTransition ? 10 : 0) +
    sizeClasses.size * 4 +
    Object.values(families).filter((ids) => ids.length > 0).length * 10;
  return {
    objective: "hell1-readable-forms-v1",
    passed: !reasons.length,
    reasons,
    score,
    dominantId,
    dominantComplete,
    groundTransition,
    sizeClasses: [...sizeClasses].sort(),
    families,
    parents,
    visibilityRays,
    voxelQueries,
    rayBudgetExhausted,
  };
}
