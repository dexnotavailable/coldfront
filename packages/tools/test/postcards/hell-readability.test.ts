import { describe, expect, it } from "vitest";
import { Block } from "../../../shared/src/blocks/registry.js";
import {
  createIbaraWorkspace,
  sampleThorn,
} from "../../../shared/src/features/ibara/sample.js";
import {
  createIbaraSample,
  type ThornInstance,
  type ThornParameters,
  type ThornSweep,
} from "../../../shared/src/features/ibara/types.js";
import { polygonNormals } from "../../../shared/src/sdf/polygon.js";
import { flattenBeziers } from "../../../shared/src/sdf/spine.js";
import type { CubicBezier, Vec3 } from "../../../shared/src/sdf/types.js";
import {
  type CameraFirstHit,
  cameraFrame,
  cameraHorizonAllowed,
  type HellCameraValidation,
  inspectHellCamera,
  type MainCameraCandidate,
} from "../../src/postcards/geometry.js";
import {
  type FramingObservation,
  framingEnvelope,
  PRODUCTION_CAMERA_BUDGET,
  productionFramingCandidates,
} from "../../src/postcards/hell-framing-camera.js";
import {
  HELL_READABILITY_LIMITS,
  inspectHellReadability,
  thornContour,
} from "../../src/postcards/hell-readability.js";
import {
  forestFramingScore,
  hellSelectionPassed,
} from "../../src/postcards/hell-resolve.js";
import { createVisibleThornResolver } from "../../src/postcards/hell-visible-instances.js";
import type { CameraQuery } from "../../src/postcards/query.js";

const view: MainCameraCandidate = {
  region: "hellscape",
  kind: "eye-level",
  position: { x: 0.5, y: 1.62, z: 0.5 },
  target: { x: 0.5, y: 1.62 - Math.tan((4.25 * Math.PI) / 180) * 64, z: 64.5 },
  hours: 17.25,
  radius: 512,
};
/** Explicit synthetic assets only: no world, plan, placement or thorn factory. */
function asset(
  options: Partial<ThornParameters> = {},
  curves?: readonly CubicBezier[],
): ThornInstance {
  const p: ThornParameters = {
    id: 1,
    cellX: 0,
    cellZ: 0,
    cluster: 0,
    index: 0,
    base: [0, 0, 100],
    height: 40,
    baseRadius: 4,
    flowX: 1,
    flowZ: 0,
    leanDegrees: 10,
    bend: 0,
    sCurve: false,
    hooked: false,
    broken: false,
    breakT: 0.65,
    branchCount: 0,
    facets: 6,
    facetiness: 0,
    twist: 0,
    phase: 0,
    exponent: 1,
    core: "basalt",
    crust: "none",
    nearLava: false,
    landmark: false,
    arch: false,
    archSpan: 0,
    ...options,
  };
  const point = (x: number, y: number): Vec3 => [
    p.base[0] + x,
    p.base[1] + y,
    p.base[2],
  ];
  const curve = curves ?? [
    [
      point(0, -4),
      point(0, p.height / 3),
      point(0, (2 * p.height) / 3),
      point(0, p.height),
    ] as CubicBezier,
  ];
  const makeSweep = (
    paths: readonly CubicBezier[],
    radius: number,
    tStart = 0,
    tScale = 1,
  ): ThornSweep => {
    const spine = flattenBeziers(paths),
      points = paths.flat();
    const bounds = {
      minX: Math.min(...points.map((p) => p[0])) - radius - 2,
      maxX: Math.max(...points.map((p) => p[0])) + radius + 2,
      minY: Math.min(...points.map((p) => p[1])) - radius - 2,
      maxY: Math.max(...points.map((p) => p[1])) + radius + 2,
      minZ: Math.min(...points.map((p) => p[2])) - radius - 2,
      maxZ: Math.max(...points.map((p) => p[2])) + radius + 2,
    };
    return {
      spine,
      radii: new Float64Array([radius, radius * 0.7, 1]),
      maxRadius: radius,
      profileExponent: 1,
      thinTipLength: 0,
      segmentRadii: new Float64Array(spine.segments).fill(radius),
      normals: polygonNormals(6),
      facetiness: 0,
      twist: 0,
      phase: 0,
      roughness: 0,
      seed: p.id,
      tStart,
      tScale,
      bounds,
    };
  };
  const main = makeSweep(curve, p.baseRadius),
    sweeps = [main];
  if (p.branchCount)
    sweeps.push(
      makeSweep(
        [[point(0, 18), point(8, 20), point(17, 27), point(24, 30)]],
        3,
        0.45,
        0.55,
      ),
    );
  const bounds = {
    minX: Math.min(...sweeps.map((s) => s.bounds.minX)),
    maxX: Math.max(...sweeps.map((s) => s.bounds.maxX)),
    minY: Math.min(...sweeps.map((s) => s.bounds.minY)),
    maxY: Math.max(...sweeps.map((s) => s.bounds.maxY)),
    minZ: Math.min(...sweeps.map((s) => s.bounds.minZ)),
    maxZ: Math.max(...sweeps.map((s) => s.bounds.maxZ)),
  };
  return {
    parameters: p,
    sweeps,
    debris: [],
    rubble: [],
    bounds,
    fillet: 2,
    profileExponent: 1,
    thinTipLength: 0,
    lodPolicy: "thicken",
    construction: {
      flattenCalls: 0,
      partitionAttempts: 0,
      finePartitionAttempts: 0,
    },
  };
}
function field(
  instances: readonly ThornInstance[],
  occlude?: (x: number, y: number, z: number) => number,
): CameraQuery {
  const sample = createIbaraSample(),
    work = createIbaraWorkspace();
  return {
    voxel(x, y, z) {
      x = Math.floor(x) + 0.5;
      y = Math.floor(y) + 0.5;
      z = Math.floor(z) + 0.5;
      const owner = occlude?.(x, y, z);
      if (owner)
        return { density: 1, block: Block.Basalt, fluid: 0, featureId: owner };
      let distance = y,
        featureId = 0;
      for (const thorn of instances) {
        sampleThorn(thorn, x, y, z, 1, sample, work);
        if (sample.distance < distance) {
          distance = sample.distance;
          featureId = thorn.parameters.id;
        }
      }
      return {
        density: -distance,
        block: distance < 0 ? Block.Basalt : Block.Air,
        fluid: 0,
        featureId: distance < 0 ? featureId : 0,
      };
    },
    ground: () => 0,
    height: () => 0,
    region: () => "hellscape",
    clear() {},
    walkableFeet: () => 0,
    bounds: () => ({
      minSurfaceY: 0,
      maxSurfaceY: 0,
      maxSolidY: 200,
      maxFluidY: 0,
    }),
  };
}
function hits(thorn: ThornInstance): CameraFirstHit[] {
  const [x, y, z] = thorn.parameters.base,
    projected = cameraFrame(view).project({ x, y, z });
  const px = Math.floor(projected.x / 20),
    py = Math.floor(projected.y / 20);
  return [0, 1, 2, 3].map((i) => ({
    px: px + (i % 2),
    py: py - Math.floor(i / 2),
    x: x + (i % 2),
    y: y + Math.floor(i / 2),
    z,
    block: Block.Basalt,
    featureId: thorn.parameters.id,
    distance: z,
  }));
}
describe("bounded HELL-1 form selection", () => {
  const allowPreflight = () => ({
    reasons: [],
    cachedGeometry: false,
    cachedRejected: false,
    targetEvaluated: true,
  });
  function observation(
    thorn: ThornInstance,
    camera: MainCameraCandidate = view,
  ): FramingObservation {
    // Proposal fixture: the original pipeline has already supplied a geometry
    // pass. The new poses themselves receive no validation/pass flag here.
    return {
      view: camera,
      targetFeature: {
        kind: "thorn-cluster",
        featureIds: [thorn.parameters.id],
        bounds: thorn.bounds,
        rootDisc: {
          x: thorn.parameters.base[0],
          z: thorn.parameters.base[2],
          radius: 144,
        },
        fissureId: 7,
      },
      validation: { passed: true } as HellCameraValidation,
      readability: inspectHellReadability(
        camera,
        [thorn],
        hits(thorn),
        field([thorn]),
      ),
    };
  }
  it("automatically frames a cropped dominant within the decision114 eye-level pitch bank", () => {
    const thorn = asset({ height: 40, base: [0, 0, 60] });
    expect(framingEnvelope(view, thorn).complete).toBe(false);
    const original = observation(thorn),
      snapshot = JSON.stringify(original);
    const proposals = productionFramingCandidates(
      [original],
      () => thorn,
      () => 0,
      allowPreflight,
    );
    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals.length).toBeLessThanOrEqual(6);
    for (const candidate of proposals) {
      expect(framingEnvelope(candidate.view, thorn)).toMatchObject({
        complete: true,
        useful: true,
        overflow: 0,
      });
      expect(candidate.view.position.y).toBe(1.62);
      expect(candidate.view.position.x % 1).toBeOneOf([0.5, -0.5]);
      expect(candidate.pitchDegrees).toBeOneOf([-5, 0, 4.25]);
      const frame = cameraFrame(candidate.view);
      expect(cameraHorizonAllowed(candidate.view, frame.horizonFraction)).toBe(
        true,
      );
      expect(frame.sunOffsetDegrees).toBeGreaterThanOrEqual(60);
      expect(frame.sunOffsetDegrees).toBeLessThanOrEqual(150);
      expect(candidate.view.radius).toBe(512);
      expect(candidate.view.hours).toBe(17.25);
      expect(candidate.view.kind).toBe("eye-level");
      expect(candidate.targetFeature).toBe(original.targetFeature);
      expect(candidate).not.toHaveProperty("validation");
    }
    expect(proposals.some((candidate) => candidate.pitchDegrees <= 0)).toBe(
      true,
    );
    expect(JSON.stringify(original)).toBe(snapshot);
  });
  it("keeps projection proposal/ground-query budgets bounded and interleaves distinct measured parents", () => {
    const thorns = Array.from({ length: 4 }, (_, i) =>
      asset({ id: i + 1, height: 40, base: [i * 1000, 0, 60] }),
    );
    const observations = thorns.map((thorn, i) =>
      observation(thorn, {
        ...view,
        position: { ...view.position, x: view.position.x + i * 1000 },
        target: { ...view.target, x: view.target.x + i * 1000 },
      }),
    );
    let groundQueries = 0;
    const events: Readonly<Record<string, unknown>>[] = [];
    const result = productionFramingCandidates(
      observations,
      (id) => thorns.find((thorn) => thorn.parameters.id === id),
      () => {
        groundQueries++;
        return 0;
      },
      allowPreflight,
      (event) => events.push(event),
    );
    expect(result.length).toBeLessThanOrEqual(
      PRODUCTION_CAMERA_BUDGET.refinements,
    );
    expect(PRODUCTION_CAMERA_BUDGET.coarse + result.length).toBeLessThanOrEqual(
      50,
    );
    expect(new Set(result.map((c) => c.parent)).size).toBe(3);
    expect(groundQueries).toBe(45);
    expect(events.at(-1)).toMatchObject({
      stage: "production-framing-proposal-summary",
      parents: 3,
      groundQueries: 45,
    });
    expect(Number(events.at(-1)?.proposals)).toBeLessThanOrEqual(675);
    expect(result.slice(0, 3).map((c) => c.parent)).toEqual([
      ...new Set(result.slice(0, 3).map((c) => c.parent)),
    ]);
  });
  it("uses current ground for every new eye and is independent of world coordinates", () => {
    const thorn = asset({ height: 40, base: [0, 0, 60] }),
      original = observation(thorn);
    const proposals = productionFramingCandidates(
      [original],
      () => thorn,
      (x) => (x < 0 ? 2 : 0),
      allowPreflight,
    );
    expect(proposals.length).toBeGreaterThan(0);
    for (const candidate of proposals)
      expect(candidate.view.position.y).toBe(
        candidate.view.position.x < 0 ? 3.62 : 1.62,
      );
    const translated = asset({ height: 40, base: [2000, 0, -940] });
    const shifted = {
      ...view,
      position: {
        x: view.position.x + 2000,
        y: view.position.y,
        z: view.position.z - 1000,
      },
      target: {
        x: view.target.x + 2000,
        y: view.target.y,
        z: view.target.z - 1000,
      },
    };
    const base = productionFramingCandidates(
        [original],
        () => thorn,
        () => 0,
        allowPreflight,
      ),
      moved = productionFramingCandidates(
        [observation(translated, shifted)],
        () => translated,
        () => 0,
        allowPreflight,
      );
    expect(moved.length).toBe(base.length);
    for (const candidate of moved)
      expect(
        base.some(
          (other) =>
            Math.abs(candidate.view.position.x - 2000 - other.view.position.x) <
              1e-8 &&
            Math.abs(candidate.view.position.z + 1000 - other.view.position.z) <
              1e-8 &&
            candidate.yawDeltaDegrees === other.yawDeltaDegrees,
        ),
      ).toBe(true);
  });
  it("does not refine failed original geometry, unknown parents or already complete contours", () => {
    const cropped = asset({ height: 40, base: [0, 0, 60] }),
      original = observation(cropped),
      fail = () => {
        throw new Error("No ground lookup for an ineligible parent");
      };
    expect(
      productionFramingCandidates(
        [
          {
            ...original,
            validation: { ...original.validation, passed: false },
          },
        ],
        () => cropped,
        fail,
        fail,
      ),
    ).toEqual([]);
    expect(
      productionFramingCandidates([original], () => undefined, fail, fail),
    ).toEqual([]);
    const complete = asset();
    expect(framingEnvelope(view, complete).complete).toBe(true);
    expect(
      productionFramingCandidates(
        [observation(complete)],
        () => complete,
        fail,
        fail,
      ),
    ).toEqual([]);
  });
  it("preflights the eligible bank before blocked high-score stances can hide lower-score feasible ones", () => {
    const thorn = asset({ height: 40, base: [0, 0, 68] }),
      original = observation(thorn);
    const baseline = productionFramingCandidates(
      [original],
      () => thorn,
      () => 0,
      allowPreflight,
    );
    expect(baseline).toHaveLength(6);
    const blocked = new Set(
      baseline.map((candidate) => JSON.stringify(candidate.view)),
    );
    const events: Readonly<Record<string, unknown>>[] = [];
    const selected = productionFramingCandidates(
      [original],
      () => thorn,
      () => 0,
      (candidate) => ({
        reasons: blocked.has(JSON.stringify(candidate))
          ? ["central-five-metres"]
          : [],
        cachedGeometry: false,
        cachedRejected: false,
        targetEvaluated: true,
      }),
      (event) => events.push(event),
    );
    expect(selected.length).toBeGreaterThan(0);
    expect(
      selected.every(
        (candidate) => !blocked.has(JSON.stringify(candidate.view)),
      ),
    ).toBe(true);
    expect(selected.length).toBeLessThanOrEqual(6);
    const summary = events.at(-1);
    expect(Number(summary?.preflightEvaluated)).toBeGreaterThan(6);
    expect(Number(summary?.preflightEligible)).toBeGreaterThanOrEqual(
      selected.length,
    );
    expect(summary?.selected).toBe(selected.length);
  });
  it("never fills refinement slots with failed preflights and records cached rejection counts", () => {
    const thorn = asset({ height: 40, base: [0, 0, 68] }),
      events: Readonly<Record<string, unknown>>[] = [];
    const selected = productionFramingCandidates(
      [observation(thorn)],
      () => thorn,
      () => 0,
      () => ({
        reasons: ["central-ground"],
        cachedGeometry: true,
        cachedRejected: true,
        targetEvaluated: false,
      }),
      (event) => events.push(event),
    );
    expect(selected).toEqual([]);
    const summary = events.at(-1);
    expect(Number(summary?.preflightEvaluated)).toBeGreaterThan(0);
    expect(summary?.cachedRejected).toBe(summary?.preflightEvaluated);
    expect(summary).toMatchObject({
      geometryEvaluated: 0,
      targetEvaluated: 0,
      preflightEligible: 0,
      selected: 0,
    });
  });
  it("evaluates a shared refinement pose separately for different fissure/coverage targets", () => {
    const thorn = asset({ height: 40, base: [0, 0, 68] }),
      first = observation(thorn);
    const second = observation(thorn, {
      ...view,
      position: { ...view.position, z: view.position.z + 4 },
      target: { ...view.target, z: view.target.z + 4 },
    });
    if (second.targetFeature.kind !== "thorn-cluster")
      throw new Error("Wrong fixture target");
    const other = {
      ...second,
      targetFeature: { ...second.targetFeature, fissureId: 8 },
    };
    const firstPoses = new Set<string>();
    productionFramingCandidates(
      [first],
      () => thorn,
      () => 0,
      allowPreflight,
      (event) => {
        if (event.stage === "production-framing-preflight")
          firstPoses.add(JSON.stringify(event.view));
      },
    );
    const result = productionFramingCandidates(
      [first, other],
      () => thorn,
      () => 0,
      (candidate, target) => ({
        reasons:
          target.kind === "thorn-cluster" &&
          target.fissureId === 8 &&
          firstPoses.has(JSON.stringify(candidate))
            ? []
            : ["fissure-occluded"],
        cachedGeometry: false,
        cachedRejected: false,
        targetEvaluated: true,
      }),
    );
    expect(result.length).toBeGreaterThan(0);
    expect(
      result.every(
        (candidate) =>
          candidate.parent === 1 &&
          firstPoses.has(JSON.stringify(candidate.view)),
      ),
    ).toBe(true);
  });
  it("can inspect an actual first-hit size witness beyond the target root disc without awarding it target coverage", () => {
    // Mirrors the recorded omission: parent10329346 has17 real grid hits at
    // 172.211m and height69.336m but is outside its target's144m root disc.
    // This controlled asset uses the real grid/part sampler, not a world plan.
    const local = asset({ id: 7, height: 22, base: [-60, 0, 90] });
    const distant = asset({
      id: 10329346,
      height: 69.33654936769335,
      base: [0, 0, 172.211],
      baseRadius: 7,
    });
    const query = field([local, distant]),
      observed: CameraFirstHit[] = [];
    const target = {
      kind: "thorn-cluster" as const,
      featureIds: [7],
      bounds: local.bounds,
      rootDisc: { x: 0, z: 0, radius: 144 },
    };
    const lava = () => ({
      kind: "none" as const,
      source: "none" as const,
      bodyId: 0,
      bed: -Infinity,
      level: -Infinity,
    });
    const original = inspectHellCamera(view, query, {
      target,
      lava,
      onHit: (hit) => observed.push(hit),
    });
    expect(
      observed.filter((hit) => hit.featureId === distant.parameters.id).length,
    ).toBeGreaterThanOrEqual(3);
    const before = inspectHellReadability(view, [local], observed, query);
    expect(before.sizeClasses).not.toContain(2);
    expect(
      before.parents.find((parent) => parent.id === distant.parameters.id)
        ?.contour,
    ).toBeUndefined();
    let geometryCalls = 0;
    const lookup = createVisibleThornResolver(
      {
        parametersForCell: (x, z, landmark) =>
          x === 0 && z === 0 && !landmark
            ? [local.parameters, distant.parameters]
            : [],
        cell: () => {
          geometryCalls++;
          return [local, distant];
        },
        landmarks: () => {
          throw new Error("Not a landmark");
        },
      },
      new Map([[local.parameters.id, local]]),
    );
    const resolved = lookup(observed),
      after = inspectHellReadability(view, resolved.instances, observed, query);
    expect(resolved.receipt.resolvedIds).toContain(distant.parameters.id);
    expect(geometryCalls).toBe(1);
    expect(
      after.parents.find((parent) => parent.id === distant.parameters.id),
    ).toMatchObject({ bodyVisible: true });
    expect(after.sizeClasses).toContain(2);
    expect(target.featureIds).toEqual([7]);
    expect(inspectHellCamera(view, query, { target, lava })).toEqual(original);
    lookup(observed);
    expect(geometryCalls).toBe(1);
  });
  it("projects the exact camera rays back into the postcard pixels", () => {
    const frame = cameraFrame(view);
    for (const [sx, sy] of [
      [0, 0],
      [-0.8, 0.6],
      [0.8, -0.6],
    ]) {
      const ray = frame.ray(sx as number, sy as number),
        q = frame.project({
          x: view.position.x + ray.x * 100,
          y: view.position.y + ray.y * 100,
          z: view.position.z + ray.z * 100,
        });
      expect(q.x).toBeCloseTo(((sx as number) + 1) * 640);
      expect(q.y).toBeCloseTo((1 - (sy as number)) * 360);
    }
  });
  it("prefers a complete useful contour over the formerly rewarded near tall wall", () => {
    const complete = asset(),
      cropped = asset({ height: 75, base: [0, 0, 63], baseRadius: 10.5 });
    expect(thornContour(view, complete)).toMatchObject({
      complete: true,
      useful: true,
    });
    expect(thornContour(view, cropped).complete).toBe(false);
    const root = (thorn: ThornInstance) => ({
      id: 1,
      x: 0,
      y: 0,
      z: thorn.parameters.base[2],
      height: thorn.parameters.height,
      radius: thorn.parameters.baseRadius,
    });
    expect(forestFramingScore(view, [root(complete)])).toBeGreaterThan(
      forestFramingScore(view, [root(cropped)]),
    );
    expect(
      inspectHellReadability(view, [cropped], hits(cropped), field([cropped]))
        .dominantComplete,
    ).toBe(false);
  });
  it("rejects a full projected contour when another feature occludes its actual crown", () => {
    const thorn = asset(),
      clear = inspectHellReadability(
        view,
        [thorn],
        hits(thorn),
        field([thorn]),
      );
    expect(clear.dominantComplete).toBe(true);
    const blocked = inspectHellReadability(
      view,
      [thorn],
      hits(thorn),
      field([thorn], (_x, y, z) => (z > 60 && z < 65 && y > 15 ? 99 : 0)),
    );
    expect(blocked.dominantComplete).toBe(false);
    expect(blocked.parents[0]?.contour?.complete).toBe(true);
  });
  it("cannot ignore a larger non-target wall or infer families from parameter flags", () => {
    const thorn = asset({ hooked: true, sCurve: true }),
      ownerHits = hits(thorn);
    const checked = inspectHellReadability(
      view,
      [thorn],
      [
        ...ownerHits,
        ...ownerHits,
        ...ownerHits.map((h) => ({ ...h, featureId: 99 })),
        ...ownerHits.map((h) => ({ ...h, featureId: 99 })),
        ...ownerHits.map((h) => ({ ...h, featureId: 99 })),
      ],
      field([thorn]),
    );
    expect(checked.dominantId).toBe(99);
    expect(checked.dominantComplete).toBe(false);
    expect(checked.families.curved).toEqual([]);
    expect(checked.families.hooked).toEqual([]);
  });
  it("requires an exposed separated branch part, not a hit on its parent root", () => {
    const thorn = asset({ branchCount: 1 });
    const exposed = inspectHellReadability(
      view,
      [thorn],
      hits(thorn),
      field([thorn]),
    );
    expect(exposed.families.branched).toEqual([1]);
    const blocked = inspectHellReadability(
      view,
      [thorn],
      hits(thorn),
      field([thorn], (x, y, z) =>
        x > 4 && y > 10 && z > 60 && z < 65 ? 99 : 0,
      ),
    );
    expect(blocked.dominantComplete).toBe(true);
    expect(blocked.families.branched).toEqual([]);
  });
  it("records an actual visible curved body and a broken crown independently", () => {
    const curved = asset({}, [
      [
        [0, -4, 100],
        [25, 10, 100],
        [25, 30, 100],
        [0, 40, 100],
      ],
    ]);
    expect(
      inspectHellReadability(view, [curved], hits(curved), field([curved]))
        .families.curved,
    ).toEqual([1]);
    const broken = asset({ broken: true });
    expect(
      inspectHellReadability(view, [broken], hits(broken), field([broken]))
        .families.broken,
    ).toEqual([1]);
  });
  it("requires both a projected terminal return and actual visible hook samples", () => {
    const hook = asset({ hooked: true }, [
      [
        [0, -4, 100],
        [0, 10, 100],
        [4, 32, 100],
        [12, 36, 100],
      ],
      [
        [12, 36, 100],
        [24, 40, 100],
        [25, 29, 100],
        [17, 26, 100],
      ],
    ]);
    const checked = inspectHellReadability(
      view,
      [hook],
      hits(hook),
      field([hook]),
    );
    expect(checked.families.hooked).toEqual([1]);
    const blocked = inspectHellReadability(
      view,
      [hook],
      hits(hook),
      field([hook], (x, y, z) =>
        x > 9 && y > 10 && z > 60 && z < 65 ? 99 : 0,
      ),
    );
    expect(blocked.families.hooked).toEqual([]);
    const far = {
      ...view,
      position: { ...view.position, z: -500 },
      target: { ...view.target, z: -436 },
    };
    expect(thornContour(far, hook).useful).toBe(false);
  });
  it("needs a root-adjacent dry ground gap; unrelated foreground or lava does not count", () => {
    const thorn = asset(),
      rootHits = hits(thorn),
      root = rootHits[0] as CameraFirstHit;
    const ground = [1, 2, 3].map((i) => ({
      ...root,
      px: root.px - i,
      x: root.x - 5 - i,
      featureId: 0,
    }));
    expect(
      inspectHellReadability(
        view,
        [thorn],
        [...rootHits, ...ground],
        field([thorn]),
      ).groundTransition,
    ).toBe(true);
    for (const fake of [
      ground.map((h) => ({ ...h, z: 10 })),
      ground.map((h) => ({ ...h, block: Block.Lava })),
    ])
      expect(
        inspectHellReadability(
          view,
          [thorn],
          [...rootHits, ...fake],
          field([thorn]),
        ).groundTransition,
      ).toBe(false);
  });
  it("counts a non-dominant exposed hook even when low foreground hides its root", () => {
    const hook = asset({ id: 2, hooked: true, base: [30, 0, 100] }, [
      [
        [30, -4, 100],
        [30, 10, 100],
        [34, 32, 100],
        [42, 36, 100],
      ],
      [
        [42, 36, 100],
        [54, 40, 100],
        [55, 29, 100],
        [47, 26, 100],
      ],
    ]);
    const query = field([hook], (x, y, z) =>
      x > 14 && x < 24 && z > 60 && z < 65 && y < 10 ? 99 : 0,
    );
    const observed: CameraFirstHit[] = [];
    inspectHellCamera(view, query, {
      target: { kind: "thorn-cluster", featureIds: [2], bounds: hook.bounds },
      lava: () => ({
        kind: "none",
        source: "none",
        bodyId: 0,
        bed: -Infinity,
        level: -Infinity,
      }),
      onHit: (hit) => observed.push(hit),
    });
    const result = inspectHellReadability(view, [hook], observed, query);
    expect(observed.filter((h) => h.featureId === 2)).toHaveLength(15);
    expect(result.dominantId).toBe(99);
    expect(result.parents.find((p) => p.id === 2)).toMatchObject({
      mainVisible: false,
      bodyVisible: true,
      rootCells: 0,
      contour: { complete: true, useful: true },
    });
    expect(result.families.hooked).toEqual([2]);
    expect(result.sizeClasses).toEqual([1]);
    expect(result.dominantComplete).toBe(false);
    expect(result.groundTransition).toBe(false);
    expect(result.passed).toBe(false);
  });
  it("counts an exposed large body/crown size witness without certifying its hidden ground transition", () => {
    const large = asset({
      id: 3,
      height: 80,
      base: [-100, 0, 210],
      baseRadius: 7,
    });
    const query = field([large], (x, y, z) =>
      x > -33 && x < -27 && z > 60 && z < 65 && y < 8 ? 99 : 0,
    );
    const observed: CameraFirstHit[] = [];
    inspectHellCamera(view, query, {
      target: { kind: "thorn-cluster", featureIds: [3], bounds: large.bounds },
      lava: () => ({
        kind: "none",
        source: "none",
        bodyId: 0,
        bed: -Infinity,
        level: -Infinity,
      }),
      onHit: (hit) => observed.push(hit),
    });
    const result = inspectHellReadability(view, [large], observed, query);
    expect(
      observed.filter((h) => h.featureId === 3).length,
    ).toBeGreaterThanOrEqual(3);
    expect(result.parents.find((p) => p.id === 3)).toMatchObject({
      mainVisible: false,
      bodyVisible: true,
    });
    expect(result.sizeClasses).toEqual([2]);
    expect(result.dominantComplete).toBe(false);
    expect(result.groundTransition).toBe(false);
    expect(result.passed).toBe(false);
  });
  it("bounds part checks and never treats this objective as a replacement for old gates", () => {
    const instances = Array.from({ length: 20 }, (_, i) =>
      asset({ id: i + 1, branchCount: 1 }),
    );
    const checked = inspectHellReadability(
      view,
      instances,
      instances.flatMap(hits),
      field(instances),
    );
    expect(checked.parents.length).toBeLessThanOrEqual(
      HELL_READABILITY_LIMITS.parents,
    );
    expect(checked.visibilityRays).toBeLessThanOrEqual(
      HELL_READABILITY_LIMITS.visibilityRays,
    );
    expect(checked.voxelQueries).toBeLessThanOrEqual(
      HELL_READABILITY_LIMITS.visibilityRays * 1025,
    );
    const pass = { passed: true } as HellCameraValidation,
      fail = { passed: false } as HellCameraValidation;
    expect(hellSelectionPassed("HELL-1", "production", pass)).toBe(false);
    expect(hellSelectionPassed("HELL-1", "production", pass, checked)).toBe(
      false,
    );
    expect(
      hellSelectionPassed("HELL-1", "production", fail, {
        ...checked,
        passed: true,
      }),
    ).toBe(false);
    expect(hellSelectionPassed("HELL-1", "primitive", pass)).toBe(true);
    expect(hellSelectionPassed("HELL-2", "production", pass)).toBe(true);
  });
  it("can pass all added gates in a visible mixed-size synthetic scene", () => {
    const curved = asset({ id: 1, height: 20, base: [-25, 0, 75] }, [
      [
        [-25, -4, 75],
        [-13, 5, 75],
        [-13, 16, 75],
        [-25, 20, 75],
      ],
    ]);
    const hook = asset({ id: 2, hooked: true, base: [30, 0, 100] }, [
      [
        [30, -4, 100],
        [30, 10, 100],
        [34, 32, 100],
        [42, 36, 100],
      ],
      [
        [42, 36, 100],
        [54, 40, 100],
        [55, 29, 100],
        [47, 26, 100],
      ],
    ]);
    const tall = asset({
      id: 3,
      height: 80,
      base: [-100, 0, 210],
      baseRadius: 7,
      branchCount: 1,
    });
    const broken = asset({
      id: 4,
      height: 45,
      base: [65, 0, 150],
      broken: true,
    });
    const instances = [curved, hook, tall, broken],
      root = hits(curved)[0] as CameraFirstHit;
    const ground = [1, 2, 3].map((i) => ({
      ...root,
      px: root.px - i,
      x: root.x - 5 - i,
      featureId: 0,
    }));
    const result = inspectHellReadability(
      view,
      instances,
      [...instances.flatMap(hits), ...ground],
      field(instances),
    );
    expect(result, JSON.stringify(result)).toMatchObject({
      passed: true,
      dominantComplete: true,
      groundTransition: true,
      sizeClasses: [0, 1, 2],
    });
    for (const family of Object.values(result.families))
      expect(family.length).toBeGreaterThan(0);
  });
  it("observes the same first-hit identities without changing any original validation result", () => {
    const thorn = asset(),
      query = field([thorn]),
      target = {
        kind: "thorn-cluster" as const,
        featureIds: [1],
        bounds: thorn.bounds,
      };
    const lava = () => ({
      kind: "none" as const,
      source: "none" as const,
      bodyId: 0,
      bed: -Infinity,
      level: -Infinity,
    });
    const observed: CameraFirstHit[] = [],
      grid = { width: 64, height: 36 };
    const baseline = inspectHellCamera(view, query, { target, lava }, grid);
    expect(
      inspectHellCamera(
        view,
        query,
        { target, lava, onHit: (hit) => observed.push(hit) },
        grid,
      ),
    ).toEqual(baseline);
    expect(observed.some((h) => h.featureId === 1)).toBe(true);
  });
});
