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
/** A voxel-centre lava first hit whose current owner was confirmed as a fissure. */
export interface FramingLavaWitness {
  readonly fissureId: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
export interface FramingObservation {
  readonly view: MainCameraCandidate;
  readonly targetFeature: HellTarget;
  readonly validation: HellCameraValidation;
  readonly readability?: HellReadability;
  readonly lavaWitnesses?: readonly FramingLavaWitness[];
}
export interface FramingRefinement {
  readonly view: MainCameraCandidate;
  readonly targetFeature: HellTarget;
  readonly parent: number;
  readonly dominantId: number;
  readonly objective: "dominant-framing" | "hook-lava-pair";
  readonly focusId: number;
  readonly lavaWitness?: FramingLavaWitness;
  readonly certifiedOrigin: boolean;
  readonly certifiedPose: boolean;
  readonly retreat: number;
  readonly lateral: number;
  readonly yawDeltaDegrees: number;
  readonly pitchDegrees: number;
  readonly predictedCompleteForms: number;
  readonly framingMarginPixels: number;
  readonly score: number;
}
function bankStances(
  thorn: ThornInstance,
  view: MainCameraCandidate,
  witness: FramingLavaWitness,
) {
  const spine = thorn.sweeps[0]?.spine;
  if (!spine) throw new Error("Missing hook spine");
  const body = sampleSpine(spine, 0.55, createSpineSample());
  // Preserve the exact observed eye/wet-point pair. Nearby offsets stay on its
  // dry side; every changed pose still receives the complete preflight.
  const dx = view.position.x - witness.x,
    dz = view.position.z - witness.z,
    distance = Math.hypot(dx, dz);
  const angle =
    distance > 1e-8
      ? Math.atan2(dz, dx)
      : Math.atan2(
          view.position.z - view.target.z,
          view.position.x - view.target.x,
        );
  const awayX = Math.cos(angle),
    awayZ = Math.sin(angle);
  return {
    focus: { x: (body.x + witness.x) * 0.5, z: (body.z + witness.z) * 0.5 },
    stances: [0, 2, 4].flatMap((retreat) =>
      [-4, -2, 0, 2, 4].map((lateral) => {
        const certifiedOrigin = retreat === 0 && lateral === 0;
        return {
          x: certifiedOrigin
            ? view.position.x
            : Math.floor(view.position.x + awayX * retreat - awayZ * lateral) +
              0.5,
          z: certifiedOrigin
            ? view.position.z
            : Math.floor(view.position.z + awayZ * retreat + awayX * lateral) +
              0.5,
          retreat,
          lateral,
          certifiedOrigin,
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
  targetFor?: (
    disc: Readonly<{ x: number; z: number; radius: number }>,
    fissureId: number,
    witness: FramingLavaWitness,
  ) => HellTarget,
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
  // Pair only current source-bound hooks with actually observed owned lava.
  // A shape flag, named target or projected wet point is not a first-hit witness.
  const hookKeys = new Set<string>();
  const hooks = observations
    .flatMap((observation, parent) => {
      if (
        !observation.validation.passed ||
        !observation.readability ||
        observation.readability.passed ||
        observation.readability.families.hooked.length ||
        observation.targetFeature.kind !== "thorn-cluster" ||
        !targetFor
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
        const contour = thornContour(observation.view, thorn),
          framing = framingEnvelope(observation.view, thorn),
          frame = cameraFrame(observation.view);
        return (observation.lavaWitnesses ?? [])
          .filter(
            (witness) =>
              Math.hypot(
                witness.x - thorn.parameters.base[0],
                witness.z - thorn.parameters.base[2],
              ) <= 144,
          )
          .map((lavaWitness) => {
            const wet = frame.project(lavaWitness),
              margin = Math.min(wet.x, 1280 - wet.x, wet.y, 720 - wet.y);
            const pairScore =
              (contour.complete ? 20 : 0) +
              (Number.isFinite(contour.hookPixels)
                ? Math.min(80, contour.hookPixels) * 2
                : 0) +
              (Number.isFinite(contour.heightPixels)
                ? Math.min(12, contour.heightPixels / 30)
                : 0) +
              (wet.depth > 0 && margin >= 0 ? Math.min(60, margin) / 6 : -100);
            return {
              observation,
              parent,
              thorn,
              cells,
              framing,
              objective: "hook-lava-pair" as const,
              lavaWitness,
              pairScore,
            };
          });
      });
    })
    .sort(
      (a, b) =>
        b.pairScore - a.pairScore ||
        (b.observation.readability?.score ?? 0) -
          (a.observation.readability?.score ?? 0) ||
        b.cells - a.cells ||
        a.thorn.parameters.id - b.thorn.parameters.id ||
        a.lavaWitness.fissureId - b.lavaWitness.fissureId ||
        a.lavaWitness.x - b.lavaWitness.x ||
        a.lavaWitness.z - b.lavaWitness.z ||
        a.lavaWitness.y - b.lavaWitness.y ||
        (proposalKey(a.observation.view, a.observation.targetFeature) <
        proposalKey(b.observation.view, b.observation.targetFeature)
          ? -1
          : proposalKey(a.observation.view, a.observation.targetFeature) >
              proposalKey(b.observation.view, b.observation.targetFeature)
            ? 1
            : 0),
    )
    .filter(({ thorn, lavaWitness, observation }) => {
      const p = observation.view.position;
      const key = `${thorn.parameters.id}|${lavaWitness.fissureId}|${lavaWitness.x},${lavaWitness.y},${lavaWitness.z}|${p.x},${p.y},${p.z}`;
      if (hookKeys.has(key)) return false;
      hookKeys.add(key);
      return true;
    })
    .slice(0, 2);
  const ranked = [...hooks, ...cropped];
  const eyes = new Set<string>();
  const parents = ranked
    .filter((choice) => {
      const { observation, objective, thorn } = choice;
      const p = observation.view.position,
        key =
          objective === "hook-lava-pair"
            ? `hook:${thorn.parameters.id}|${choice.lavaWitness.fissureId}|${choice.lavaWitness.x},${choice.lavaWitness.y},${choice.lavaWitness.z}|${p.x},${p.y},${p.z}`
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
  for (const choice of parents) {
    const { observation, parent, thorn, framing, objective } = choice;
    const { view } = observation,
      p = view.position;
    const lavaWitness =
      objective === "hook-lava-pair" ? choice.lavaWitness : undefined;
    const targetFeature =
      lavaWitness && targetFor
        ? targetFor(
            { x: lavaWitness.x, z: lavaWitness.z, radius: 144 },
            lavaWitness.fissureId,
            lavaWitness,
          )
        : observation.targetFeature;
    if (
      lavaWitness &&
      (targetFeature.kind !== "thorn-cluster" ||
        targetFeature.fissureId !== lavaWitness.fissureId ||
        targetFeature.rootDisc?.x !== lavaWitness.x ||
        targetFeature.rootDisc?.z !== lavaWitness.z ||
        targetFeature.rootDisc?.radius !== 144 ||
        targetFeature.observedFissurePoint?.x !== lavaWitness.x ||
        targetFeature.observedFissurePoint?.y !== lavaWitness.y ||
        targetFeature.observedFissurePoint?.z !== lavaWitness.z ||
        !targetFeature.featureIds.includes(thorn.parameters.id))
    ) {
      record({
        stage: "production-framing-target-rejected",
        parent,
        focusId: thorn.parameters.id,
        lavaWitness,
        reason: "pair-target-does-not-match-observed-owner-and-hook",
      });
      continue;
    }
    const originalDx = view.target.x - p.x,
      originalDz = view.target.z - p.z,
      originalDistance = Math.hypot(originalDx, originalDz),
      fx = originalDx / originalDistance,
      fz = originalDz / originalDistance;
    const bank = lavaWitness
      ? bankStances(thorn, view, lavaWitness)
      : undefined;
    const standingPoints =
      bank?.stances ??
      [0, 2, 4, 8, 12].flatMap((retreat) =>
        [-2, 0, 2].map((lateral) => ({
          retreat,
          lateral,
          x: Math.floor(p.x - fx * retreat - fz * lateral) + 0.5,
          z: Math.floor(p.z - fz * retreat + fx * lateral) + 0.5,
          certifiedOrigin: false,
        })),
      );
    const dominantId =
      observation.readability?.dominantId ?? thorn.parameters.id;
    const pitches = FOREST_CAMERA_PITCHES;
    const sourcePitch =
      (Math.atan2(p.y - view.target.y, originalDistance) * 180) / Math.PI;
    const originPitch = pitches.reduce(
      (best, value) =>
        Math.abs(value - sourcePitch) < Math.abs(best - sourcePitch)
          ? value
          : best,
      pitches[0],
    );
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
      ...(lavaWitness ? { lavaWitness, targetFeature } : {}),
      ...(objective === "hook-lava-pair"
        ? { pairProjectionScore: choice.pairScore }
        : {}),
      originalOverflowPixels: framing.overflow,
      view,
    });
    for (const { retreat, lateral, x, z, certifiedOrigin } of standingPoints) {
      let y = p.y;
      if (!certifiedOrigin) {
        const ground = groundHeight(x, z);
        groundQueries++;
        if (!Number.isFinite(ground)) continue;
        y = Math.ceil(ground - 0.5) + 1.62;
      }
      const dx = bank ? bank.focus.x - x : originalDx,
        dz = bank ? bank.focus.z - z : originalDz,
        distance = Math.hypot(dx, dz);
      for (const yawDeltaDegrees of [-12, -6, 0, 6, 12])
        for (const pitchDegrees of pitches) {
          proposals++;
          const certifiedPose =
            certifiedOrigin &&
            yawDeltaDegrees === 0 &&
            pitchDegrees === originPitch;
          const angle = (yawDeltaDegrees * Math.PI) / 180,
            cos = Math.cos(angle),
            sin = Math.sin(angle);
          const candidate: MainCameraCandidate = {
            ...view,
            position: certifiedPose ? view.position : { x, y, z },
            target: certifiedPose
              ? view.target
              : {
                  x: x + dx * cos + dz * sin,
                  y: y - Math.tan((pitchDegrees * Math.PI) / 180) * distance,
                  z: z + dz * cos - dx * sin,
                },
          };
          const key = proposalKey(candidate, targetFeature);
          if (used.has(key)) {
            if (certifiedPose)
              record({
                stage: "production-framing-certified-origin",
                parent,
                focusId: thorn.parameters.id,
                lavaWitness,
                status: "already-observed",
                view: candidate,
                targetFeature,
              });
            continue;
          }
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
          // Decision115: retain the exact source pose as a diagnostic candidate
          // even when composition proxies fail. Its current geometry AND exact
          // witnessed lava must still pass preflight below and the final grid.
          if (!certifiedPose && !primary.useful) continue;
          const hook = bank ? thornContour(candidate, thorn) : undefined;
          if (
            !certifiedPose &&
            hook &&
            (hook.hookPixels < HELL_READABILITY_LIMITS.usefulExcursion ||
              hook.hookTurnDegrees < 75)
          )
            continue;
          if (lavaWitness && !certifiedPose) {
            const wet = frame.project(lavaWitness);
            if (
              wet.depth <= 5 ||
              wet.depth > candidate.radius ||
              wet.x < 0 ||
              wet.x > 1280 ||
              wet.y < 0 ||
              wet.y > 720
            )
              continue;
          }
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
            ...(lavaWitness ? { lavaWitness } : {}),
            certifiedOrigin,
            certifiedPose,
            retreat,
            lateral,
            yawDeltaDegrees,
            pitchDegrees: certifiedPose ? sourcePitch : pitchDegrees,
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
            (hook && Number.isFinite(hook.hookPixels)
              ? Math.min(80, hook.hookPixels) * 2
              : 0) +
            predictedCompleteForms * 4 +
            Math.max(-60, Math.min(primary.margin, 60)) / 10 -
            move * 0.15 -
            Math.abs(yawDeltaDegrees) * 0.03;
          group.push({
            view: candidate,
            targetFeature,
            parent,
            dominantId,
            objective,
            focusId: thorn.parameters.id,
            ...(lavaWitness ? { lavaWitness } : {}),
            certifiedOrigin,
            certifiedPose,
            retreat,
            lateral,
            yawDeltaDegrees,
            pitchDegrees: certifiedPose ? sourcePitch : pitchDegrees,
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
