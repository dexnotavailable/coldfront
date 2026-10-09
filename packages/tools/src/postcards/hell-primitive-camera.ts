import type {
  HellCameraValidation,
  HellTarget,
  MainCameraCandidate,
} from "./geometry.js";

/** Reserve refinement INSIDE the existing fifty full-grid candidate budget.
 * Fixed-eye angular refinement is useful for the regular tall cones, where a
 * coarse turn can trade a few sky cells against a few target cells. */
export const PRIMITIVE_CAMERA_BUDGET = Object.freeze({
  coarse: 32,
  refinements: 18,
  parents: 3,
});
export interface PrimitiveCameraObservation {
  readonly view: MainCameraCandidate;
  readonly targetFeature: HellTarget;
  readonly validation: HellCameraValidation;
}
export interface PrimitiveCameraRefinement {
  readonly view: MainCameraCandidate;
  readonly targetFeature: HellTarget;
  readonly parent: number;
  readonly yawDeltaDegrees: number;
  readonly parentDeficit: number;
}
/** Ranking only, never validation. All non-area gates must already hold; a
 * missing fissure or unsafe standing point cannot be repaired by this turn. */
export function primitiveSkyTargetDeficit({
  validation: v,
  targetFeature,
}: PrimitiveCameraObservation): number {
  if (
    targetFeature.kind !== "thorn-cluster" ||
    !v.eyeClear ||
    !v.walkable ||
    !v.centralClear ||
    v.horizonFraction < 0.3 ||
    v.horizonFraction > 0.45 ||
    v.sunOffsetDegrees < 60 ||
    v.sunOffsetDegrees > 150 ||
    v.sunElevationDegrees < 5 ||
    v.sunElevationDegrees > 20 ||
    !v.visibleFeatureIds.length ||
    v.fissureFraction <= 0 ||
    (targetFeature.fissureId !== undefined && v.targetFissureFraction <= 0)
  )
    return Infinity;
  return (
    Math.max(0, 0.2 - v.skyFraction) +
    Math.max(0, v.skyFraction - 0.65) +
    Math.max(0, 0.15 - v.targetFraction)
  );
}

/** General deterministic local search around measured near misses. No seed,
 * coordinates, IDs, manually chosen pose or saved pass is embedded here.
 * Every result still needs pose preflight and the SAME complete grid checks. */
export function primitiveCameraRefinements(
  observed: readonly PrimitiveCameraObservation[],
): PrimitiveCameraRefinement[] {
  const ranked = observed
    .map((observation, index) => ({
      observation,
      index,
      deficit: primitiveSkyTargetDeficit(observation),
    }))
    .filter(
      ({ observation, deficit }) =>
        !observation.validation.passed && Number.isFinite(deficit),
    )
    .sort((a, b) => a.deficit - b.deficit || a.index - b.index);
  const positions = new Set<string>();
  const parents = ranked
    .filter(({ observation }) => {
      const p = observation.view.position,
        key = `${p.x},${p.y},${p.z}`;
      if (positions.has(key)) return false;
      positions.add(key);
      return true;
    })
    .slice(0, PRIMITIVE_CAMERA_BUDGET.parents);
  const refinements: PrimitiveCameraRefinement[] = [];
  // Interleave parents so the closest near miss cannot consume the whole
  // reserve. Yaw changes only; height, pitch, radius and dusk time stay exact.
  for (const delta of [-1, 1, -2, 2, -4, 4])
    for (const { observation, index, deficit } of parents) {
      const { view, targetFeature } = observation;
      const dx = view.target.x - view.position.x,
        dz = view.target.z - view.position.z,
        angle = (delta * Math.PI) / 180,
        cosine = Math.cos(angle),
        sine = Math.sin(angle);
      refinements.push({
        view: {
          ...view,
          target: {
            x: view.position.x + dx * cosine + dz * sine,
            y: view.target.y,
            z: view.position.z + dz * cosine - dx * sine,
          },
        },
        targetFeature,
        parent: index,
        yawDeltaDegrees: delta,
        parentDeficit: deficit,
      });
    }
  return refinements;
}
