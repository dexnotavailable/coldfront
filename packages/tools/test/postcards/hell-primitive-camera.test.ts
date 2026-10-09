import { describe, expect, it } from "vitest";
import { Block } from "../../../shared/src/blocks/registry.js";
import {
  cameraFrame,
  cameraPoseRejections,
  type HellCameraValidation,
  type HellTarget,
  type MainCameraCandidate,
} from "../../src/postcards/geometry.js";
import {
  PRIMITIVE_CAMERA_BUDGET,
  type PrimitiveCameraObservation,
  primitiveCameraRefinements,
  primitiveSkyTargetDeficit,
} from "../../src/postcards/hell-primitive-camera.js";
import type { CameraQuery } from "../../src/postcards/query.js";

const target: HellTarget = {
  kind: "thorn-cluster",
  featureIds: [1],
  fissureId: 7,
  rootDisc: { x: 0, z: 0, radius: 144 },
  bounds: {
    minX: -144,
    maxX: 144,
    minZ: -144,
    maxZ: 144,
    minY: -10,
    maxY: 150,
  },
};
function observation(
  sky: number,
  coverage: number,
  x = 0,
  yaw = 45,
): PrimitiveCameraObservation {
  const angle = (yaw * Math.PI) / 180;
  const view: MainCameraCandidate = {
    region: "hellscape",
    kind: "eye-level",
    position: { x, y: 1.62, z: 0 },
    target: {
      x: x + 64 * Math.sin(angle),
      y: 1.62 - 64 * Math.tan((4.25 * Math.PI) / 180),
      z: 64 * Math.cos(angle),
    },
    radius: 512,
    hours: 17.25,
  };
  const frame = cameraFrame(view);
  const validation: HellCameraValidation = {
    eyeClear: true,
    walkable: true,
    centralClear: true,
    skyFraction: sky,
    featureFraction: coverage,
    targetFraction: coverage,
    waterFraction: 0,
    horizonFraction: frame.horizonFraction,
    sunOffsetDegrees: frame.sunOffsetDegrees,
    sunElevationDegrees: frame.sunElevationDegrees,
    highestVisibleSample: 110,
    altitudeAboveHighestSample: -108.38,
    rayColumns: 64,
    rayRows: 36,
    visibleFeatureIds: [1],
    lavaFraction: 0.01,
    fissureFraction: 0.01,
    targetFissureFraction: 0.01,
    targetLavaFraction: 0,
    visibleLavaOwners: [{ source: "fissure", bodyId: 7 }],
    passed: false,
  };
  return { view, targetFeature: target, validation };
}
const platform: CameraQuery = {
  voxel: (x, y, z) => ({
    density: (Math.abs(x) < 0.8 && Math.abs(z) < 0.8 ? 0 : -20) - y,
    block:
      y < (Math.abs(x) < 0.8 && Math.abs(z) < 0.8 ? 0 : -20)
        ? Block.Stone
        : Block.Air,
    fluid: 0,
  }),
  ground: () => 0,
  height: () => 0,
  region: () => "hellscape",
  walkableFeet: () => 0,
  clear() {},
  bounds: () => ({
    minSurfaceY: -20,
    maxSurfaceY: 0,
    maxSolidY: 0,
    maxFluidY: -Infinity,
  }),
};
describe("primitive calibration angular refinement", () => {
  it("chooses the recorded joint sky/target near misses over the high-coverage low-sky score winner", () => {
    // Actual historical grid numerators; poses are synthetic. The production
    // witness and scene are not reconstructed or generated in this test.
    const dense = observation(157 / 2304, 874 / 2304, 3);
    const skyPass = observation(476 / 2304, 343 / 2304, 1);
    const targetPass = observation(454 / 2304, 391 / 2304, 2);
    expect(primitiveSkyTargetDeficit(skyPass)).toBeLessThan(
      primitiveSkyTargetDeficit(targetPass),
    );
    expect(primitiveSkyTargetDeficit(targetPass)).toBeLessThan(
      primitiveSkyTargetDeficit(dense),
    );
    const firstRound = primitiveCameraRefinements([
      dense,
      targetPass,
      skyPass,
    ]).slice(0, 3);
    expect(firstRound.map((r) => r.parent)).toEqual([2, 1, 0]);
    expect(firstRound.map((r) => r.view.position.x)).toEqual([1, 2, 3]);
  });
  it("adds bounded distinct turns while preserving the exact eye, pitch, radius, time and target owner", () => {
    const parent = observation(0.199, 0.17);
    const snapshot = JSON.stringify(parent),
      refinements = primitiveCameraRefinements([parent]);
    expect(refinements).toHaveLength(6);
    for (const candidate of refinements) {
      expect(candidate.view.position).toBe(parent.view.position);
      expect(candidate.targetFeature).toBe(parent.targetFeature);
      expect(candidate.view.target.y).toBe(parent.view.target.y);
      expect(candidate.view.hours).toBe(17.25);
      expect(candidate.view.radius).toBe(512);
      expect(candidate.view.kind).toBe("eye-level");
      expect(
        Math.hypot(
          candidate.view.target.x - parent.view.position.x,
          candidate.view.target.z - parent.view.position.z,
        ),
      ).toBeCloseTo(64, 12);
      expect(cameraFrame(candidate.view).horizonFraction).toBeCloseTo(
        parent.validation.horizonFraction,
        14,
      );
      expect(cameraPoseRejections(candidate.view, platform)).toEqual([]);
    }
    expect(
      new Set(refinements.map((r) => `${r.view.target.x},${r.view.target.z}`))
        .size,
    ).toBe(6);
    expect(JSON.stringify(parent)).toBe(snapshot);
  });
  it("does not let repeated pitches at one eye monopolize the reserve, and never exceeds fifty total grids", () => {
    const first = observation(0.199, 0.16),
      duplicate = {
        ...first,
        validation: { ...first.validation, skyFraction: 0.17 },
      };
    const many = [
      first,
      duplicate,
      ...Array.from({ length: 100 }, (_, i) => observation(0.18, 0.2, i + 1)),
    ];
    const candidates = primitiveCameraRefinements(many);
    expect(candidates).toHaveLength(PRIMITIVE_CAMERA_BUDGET.refinements);
    expect(PRIMITIVE_CAMERA_BUDGET.coarse + candidates.length).toBe(50);
    expect(new Set(candidates.map((c) => c.parent)).size).toBe(3);
    expect(candidates.some((c) => c.parent === 1)).toBe(false);
  });
  it("never substitutes an angular fix for a failed safety, dusk, horizon, feature or fissure gate", () => {
    const base = observation(0.199, 0.2);
    const invalid: Partial<HellCameraValidation>[] = [
      { eyeClear: false },
      { walkable: false },
      { centralClear: false },
      { horizonFraction: 0.29 },
      { horizonFraction: 0.46 },
      { sunOffsetDegrees: 59 },
      { sunOffsetDegrees: 151 },
      { sunElevationDegrees: 4 },
      { sunElevationDegrees: 21 },
      { visibleFeatureIds: [] },
      { fissureFraction: 0 },
      { targetFissureFraction: 0 },
    ];
    for (const change of invalid) {
      const candidate = {
        ...base,
        validation: { ...base.validation, ...change },
      };
      expect(primitiveSkyTargetDeficit(candidate)).toBe(Infinity);
      expect(primitiveCameraRefinements([candidate])).toEqual([]);
    }
    expect(
      primitiveCameraRefinements([
        { ...base, validation: { ...base.validation, passed: true } },
      ]),
    ).toEqual([]);
    expect(
      primitiveCameraRefinements([
        {
          ...base,
          targetFeature: {
            kind: "caldera",
            calderaId: 7,
            bounds: target.bounds,
          },
        },
      ]),
    ).toEqual([]);
  });
  it("lets the unchanged pose preflight reject a refinement that crosses the sun gate", () => {
    const edge = observation(0.199, 0.2, 0, -19);
    expect(cameraPoseRejections(edge.view, platform)).toEqual([]);
    const attempts = primitiveCameraRefinements([edge]);
    const rejected = attempts.filter((c) =>
      cameraPoseRejections(c.view, platform).includes("dusk-light"),
    );
    const eligible = attempts.filter(
      (c) => !cameraPoseRejections(c.view, platform).length,
    );
    expect(rejected.length).toBeGreaterThan(0);
    expect(eligible.length).toBeGreaterThan(0);
  });
});
