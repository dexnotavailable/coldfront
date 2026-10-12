import type { ThornInstance } from "../../../shared/src/features/ibara/types.js";
import {
  createSpineSample,
  sampleSpine,
} from "../../../shared/src/sdf/spine.js";
import {
  cameraFrame,
  cameraHorizonAllowed,
  type HellCameraValidation,
  type HellTarget,
  type MainCameraCandidate,
} from "./geometry.js";
import type { FramingPreflightResult } from "./hell-framing-preflight.js";
import {
  HELL_READABILITY_LIMITS,
  type HellReadability,
  thornContour,
} from "./hell-readability.js";

export const PRODUCTION_CAMERA_BUDGET = Object.freeze({
  coarse: 32,
  refinements: 18,
  parents: 3,
  perParent: 6,
});
/** Decision114: a finite, modest upward/level/downward bank for eye-level
 * forests. Aerial vista composition retains its separate horizon band. */
export const FOREST_CAMERA_PITCHES = Object.freeze([-5, 0, 4.25] as const);
type Event = Readonly<Record<string, unknown>>;
export interface FramingObservation {
  readonly view: MainCameraCandidate;
  readonly targetFeature: HellTarget;
  readonly validation: HellCameraValidation;
  readonly readability?: HellReadability;
}
export interface FramingRefinement {
  readonly view: MainCameraCandidate;
  readonly targetFeature: HellTarget;
  readonly parent: number;
  readonly dominantId: number;
  readonly objective: "dominant-framing" | "hook-body";
  readonly focusId: number;
  readonly retreat: number;
  readonly lateral: number;
  readonly yawDeltaDegrees: number;
  readonly pitchDegrees: number;
  readonly predictedCompleteForms: number;
  readonly framingMarginPixels: number;
  readonly score: number;
}
function hookStances(thorn: ThornInstance) {
  const spine = thorn.sweeps[0]?.spine;
  if (!spine) throw new Error("Missing hook spine");
  const at = (t: number) => sampleSpine(spine, t, createSpineSample());
  const a = at(0.6),
    b = at(0.8),
    c = at(0.92),
    d = at(1),
    focus = at(0.55);
  const ux = b.x - a.x,
    uy = b.y - a.y,
    uz = b.z - a.z,
    vx = d.x - c.x,
    vy = d.y - c.y,
    vz = d.z - c.z;
  const nx = uy * vz - uz * vy,
    nz = ux * vy - uy * vx;
  const fallback = Math.hypot(nx, nz) < 1e-8;
  const angle = Math.atan2(
    fallback ? thorn.parameters.flowX : nz,
    fallback ? -thorn.parameters.flowZ : nx,
  );
  return {
    focus,
    fallback,
    stances: [1.5, 2, 3].flatMap((factor) =>
      Array.from({ length: 5 }, (_, bearing) => {
        const radius = Math.max(24, thorn.parameters.height * factor),
          azimuth = angle + (bearing * 2 * Math.PI) / 5;
        return {
          x: Math.floor(focus.x + Math.cos(azimuth) * radius) + 0.5,
          z: Math.floor(focus.z + Math.sin(azimuth) * radius) + 0.5,
          retreat: 0,
          lateral: 0,
        };
      }),
    ),
  };
}
/** Uses the same built-spine/radius envelope and margin as final readability.
 * A framing prediction never establishes actual visibility or acceptance. */
export function framingEnvelope(
  view: MainCameraCandidate,
  thorn: ThornInstance,
) {
  const contour = thornContour(view, thorn);
  const stations = [...contour.main, ...contour.branches.flat()];
  let margin = Infinity;
  for (const station of stations) {
    const p = station.projected,
      r = station.radiusPixels;
    if (p.depth <= 0 || p.depth > view.radius)
      return {
        complete: false,
        useful: false,
        overflow: Infinity,
        margin: -Infinity,
        heightPixels: contour.heightPixels,
      };
    margin = Math.min(margin, p.x - r, 1280 - p.x - r, p.y - r, 720 - p.y - r);
  }
  return {
    complete: contour.complete,
    useful: contour.useful,
    overflow: Math.max(0, HELL_READABILITY_LIMITS.contourMargin - margin),
    margin,
    heightPixels: contour.heightPixels,
  };
}
function poseKey(view: MainCameraCandidate): string {
  const p = view.position,
    t = view.target,
    dx = t.x - p.x,
    dz = t.z - p.z;
  // Deduplication only; no quantization enters the emitted camera or its tests.
  return [
    p.x,
    p.y,
    p.z,
    Math.atan2(dx, dz),
    Math.atan2(p.y - t.y, Math.hypot(dx, dz)),
  ]
    .map((n) => n.toFixed(8))
    .join(",");
}
function proposalKey(
  view: MainCameraCandidate,
  targetFeature: HellTarget,
): string {
  // A pose evaluated for one witness/coverage target is not an evaluation of
  // another. Geometry-check reuse has its separate exact, target-free key.
  return `${poseKey(view)}|${JSON.stringify(targetFeature)}`;
}

/** Finite local proposals around at most three measured composition near misses.
 * 15 standing points x5 yaw turns x3 pitches per parent; <=675
 * projection proposals and45 proposal-ground queries total. Every eligible
 * projection receives unchanged preflight; only18 can reach full-grid testing.
 * The proposer constructs no feature geometry; its preflight callback queries
 * the existing field and reports evaluated/cached checks. */
export function productionFramingCandidates(
  observations: readonly FramingObservation[],
  instanceFor: (id: number) => ThornInstance | undefined,
  groundHeight: (x: number, z: number) => number,
  preflight: (
    view: MainCameraCandidate,
    targetFeature: HellTarget,
  ) => FramingPreflightResult,
  record: (event: Event) => void = () => {},
): FramingRefinement[] {
  const cropped = observations
    .flatMap((observation, parent) => {
      const id = observation.readability?.dominantId;
      if (
        !observation.validation.passed ||
        observation.readability?.passed ||
        id == null ||
        observation.targetFeature.kind !== "thorn-cluster"
      )
        return [];
      const thorn = instanceFor(id);
      if (!thorn) return [];
      const framing = framingEnvelope(observation.view, thorn);
      if (
        framing.complete ||
        !Number.isFinite(framing.overflow) ||
        framing.heightPixels < HELL_READABILITY_LIMITS.usefulHeight
      )
        return [];
      return [
        {
          observation,
          parent,
          thorn,
          framing,
          objective: "dominant-framing" as const,
        },
      ];
    })
    .sort(
      (a, b) => a.framing.overflow - b.framing.overflow || a.parent - b.parent,
    );
  // An intact hook can be hidden even when the largest parent already fits.
  // Reuse only instances resolved by the observed grid; never scan new cells.
  const hookKeys = new Set<string>();
  const hooks = observations
    .flatMap((observation, parent) => {
      if (
        !observation.validation.passed ||
        !observation.readability ||
        observation.readability.passed ||
        observation.readability.families.hooked.length ||
        observation.targetFeature.kind !== "thorn-cluster"
      )
        return [];
      return observation.readability.parents.flatMap(({ id, cells }) => {
        const thorn = instanceFor(id);
        if (
          !thorn?.parameters.hooked ||
          thorn.parameters.broken ||
          thorn.parameters.arch
        )
          return [];
        return [
          {
            observation,
            parent,
            thorn,
            cells,
            framing: framingEnvelope(observation.view, thorn),
            objective: "hook-body" as const,
          },
        ];
      });
    })
    .sort(
      (a, b) =>
        (b.observation.readability?.score ?? 0) -
          (a.observation.readability?.score ?? 0) ||
        b.cells - a.cells ||
        a.thorn.parameters.id - b.thorn.parameters.id ||
        (proposalKey(a.observation.view, a.observation.targetFeature) <
        proposalKey(b.observation.view, b.observation.targetFeature)
          ? -1
          : proposalKey(a.observation.view, a.observation.targetFeature) >
              proposalKey(b.observation.view, b.observation.targetFeature)
            ? 1
            : 0),
    )
    .filter(({ observation, thorn }) => {
      const key = `${thorn.parameters.id}|${JSON.stringify(observation.targetFeature)}`;
      if (hookKeys.has(key)) return false;
      hookKeys.add(key);
      return true;
    })
    .slice(0, 2);
  const ranked = [...hooks, ...cropped];
  const eyes = new Set<string>();
  const parents = ranked
    .filter(({ observation, objective, thorn }) => {
      const p = observation.view.position,
        key =
          objective === "hook-body"
            ? `hook:${thorn.parameters.id}|${JSON.stringify(observation.targetFeature)}`
            : `${p.x},${p.y},${p.z}`;
      if (eyes.has(key)) return false;
      eyes.add(key);
      return true;
    })
    .slice(0, PRODUCTION_CAMERA_BUDGET.parents);
  const used = new Set(
      observations.map((o) => proposalKey(o.view, o.targetFeature)),
    ),
    groups: FramingRefinement[][] = [];
  let preflightEvaluated = 0,
    cachedRejected = 0,
    geometryEvaluated = 0,
    targetEvaluated = 0,
    preflightEligible = 0;
  let proposals = 0,
    groundQueries = 0,
    eligible = 0;
  for (const { observation, parent, thorn, framing, objective } of parents) {
    const { view, targetFeature } = observation,
      p = view.position;
    const originalDx = view.target.x - p.x,
      originalDz = view.target.z - p.z,
      originalDistance = Math.hypot(originalDx, originalDz),
      fx = originalDx / originalDistance,
      fz = originalDz / originalDistance;
    const orbit = objective === "hook-body" ? hookStances(thorn) : undefined;
    const standingPoints =
      orbit?.stances ??
      [0, 2, 4, 8, 12].flatMap((retreat) =>
        [-2, 0, 2].map((lateral) => ({
          retreat,
          lateral,
          x: Math.floor(p.x - fx * retreat - fz * lateral) + 0.5,
          z: Math.floor(p.z - fz * retreat + fx * lateral) + 0.5,
        })),
      );
    const dominantId =
      observation.readability?.dominantId ?? thorn.parameters.id;
    const pitches = FOREST_CAMERA_PITCHES;
    const related = (observation.readability?.parents ?? []).flatMap(
      ({ id }) => {
        const instance = instanceFor(id);
        return instance ? [instance] : [];
      },
    );
    const group: FramingRefinement[] = [];
    record({
      stage: "production-framing-parent",
      parent,
      dominantId,
      objective,
      focusId: thorn.parameters.id,
      ...(orbit ? { hookBasisFallback: orbit.fallback } : {}),
      originalOverflowPixels: framing.overflow,
      view,
    });
    for (const { retreat, lateral, x, z } of standingPoints) {
      const ground = groundHeight(x, z);
      groundQueries++;
      if (!Number.isFinite(ground)) continue;
      const y = Math.ceil(ground - 0.5) + 1.62;
      const dx = orbit ? orbit.focus.x - x : originalDx,
        dz = orbit ? orbit.focus.z - z : originalDz,
        distance = Math.hypot(dx, dz);
      for (const yawDeltaDegrees of [-12, -6, 0, 6, 12])
        for (const pitchDegrees of pitches) {
          proposals++;
          const angle = (yawDeltaDegrees * Math.PI) / 180,
            cos = Math.cos(angle),
            sin = Math.sin(angle);
          const candidate: MainCameraCandidate = {
            ...view,
            position: { x, y, z },
            target: {
              x: x + dx * cos + dz * sin,
              y: y - Math.tan((pitchDegrees * Math.PI) / 180) * distance,
              z: z + dz * cos - dx * sin,
            },
          };
          const key = proposalKey(candidate, targetFeature);
          if (used.has(key)) continue;
          used.add(key);
          const frame = cameraFrame(candidate);
          if (
            !cameraHorizonAllowed(candidate, frame.horizonFraction) ||
            frame.sunOffsetDegrees < 60 ||
            frame.sunOffsetDegrees > 150 ||
            frame.sunElevationDegrees < 5 ||
            frame.sunElevationDegrees > 20
          )
            continue;
          const primary = framingEnvelope(candidate, thorn);
          if (!primary.useful) continue;
          const hook = orbit ? thornContour(candidate, thorn) : undefined;
          if (
            hook &&
            (hook.hookPixels < HELL_READABILITY_LIMITS.usefulExcursion ||
              hook.hookTurnDegrees < 75)
          )
            continue;
          eligible++;
          // Clearance and target checks run BEFORE the final per-parent cut.
          // A high-ranked blocked stance cannot hide a lower-ranked valid one.
          const checked = preflight(candidate, targetFeature);
          preflightEvaluated++;
          if (checked.cachedRejected) cachedRejected++;
          if (!checked.cachedGeometry) geometryEvaluated++;
          if (checked.targetEvaluated) targetEvaluated++;
          record({
            stage: "production-framing-preflight",
            parent,
            dominantId,
            objective,
            focusId: thorn.parameters.id,
            retreat,
            lateral,
            yawDeltaDegrees,
            pitchDegrees,
            view: candidate,
            targetFeature,
            status: checked.reasons.length
              ? "rejected"
              : "eligible-for-full-grid",
            ...checked,
          });
          if (checked.reasons.length) continue;
          preflightEligible++;
          const predictedCompleteForms = related.filter(
            (instance) =>
              instance.parameters.id === thorn.parameters.id ||
              framingEnvelope(candidate, instance).useful,
          ).length;
          const move = Math.hypot(x - p.x, z - p.z);
          const score =
            (hook ? Math.min(80, hook.hookPixels) * 2 : 0) +
            predictedCompleteForms * 4 +
            Math.min(primary.margin, 60) / 10 -
            (orbit ? 0 : move * 0.15) -
            Math.abs(yawDeltaDegrees) * 0.03;
          group.push({
            view: candidate,
            targetFeature,
            parent,
            dominantId,
            objective,
            focusId: thorn.parameters.id,
            retreat,
            lateral,
            yawDeltaDegrees,
            pitchDegrees,
            predictedCompleteForms,
            framingMarginPixels: primary.margin,
            score,
          });
        }
    }
    group.sort(
      (a, b) =>
        b.score - a.score ||
        a.retreat - b.retreat ||
        Math.abs(a.lateral) - Math.abs(b.lateral) ||
        Math.abs(a.yawDeltaDegrees) - Math.abs(b.yawDeltaDegrees) ||
        a.yawDeltaDegrees - b.yawDeltaDegrees ||
        a.pitchDegrees - b.pitchDegrees,
    );
    // Standing-point diversity protects the reserve from one good projection
    // on an unwalkable voxel. Remaining slots may vary its yaw/pitch.
    const stances = new Set<string>(),
      chosen: FramingRefinement[] = [],
      remaining: FramingRefinement[] = [];
    for (const candidate of group) {
      const p = candidate.view.position,
        key = `${p.x},${p.y},${p.z}`;
      if (
        !stances.has(key) &&
        chosen.length < PRODUCTION_CAMERA_BUDGET.perParent
      ) {
        stances.add(key);
        chosen.push(candidate);
      } else remaining.push(candidate);
    }
    for (const candidate of remaining)
      if (chosen.length < PRODUCTION_CAMERA_BUDGET.perParent)
        chosen.push(candidate);
    groups.push(chosen);
  }
  const result: FramingRefinement[] = [];
  for (let i = 0; i < PRODUCTION_CAMERA_BUDGET.perParent; i++)
    for (const group of groups) {
      const candidate = group[i];
      if (candidate) result.push(candidate);
    }
  for (const candidate of result)
    record({ stage: "production-framing-selected", ...candidate });
  record({
    stage: "production-framing-proposal-summary",
    parentCandidates: ranked.length,
    parents: parents.length,
    proposals,
    groundQueries,
    projectedEligible: eligible,
    preflightEvaluated,
    cachedRejected,
    geometryEvaluated,
    targetEvaluated,
    preflightEligible,
    selected: result.length,
    limits: {
      parents: 3,
      proposals: 675,
      groundQueries: 45,
      preflightCandidates: 675,
      fullGridRefinements: 18,
    },
  });
  return result;
}
