import { describe, expect, it } from "vitest";
import type {
  HellTarget,
  MainCameraCandidate,
} from "../../src/postcards/geometry.js";
import { createFramingPreflight } from "../../src/postcards/hell-framing-preflight.js";

const view: MainCameraCandidate = {
  region: "hellscape",
  kind: "eye-level",
  position: { x: 1.5, y: 30.62, z: 2.5 },
  target: { x: 1.5, y: 25.86, z: 66.5 },
  hours: 17.25,
  radius: 512,
};
const target = (fissureId: number): HellTarget => ({
  kind: "thorn-cluster",
  fissureId,
  featureIds: [1],
  bounds: { minX: 0, maxX: 144, minY: 0, maxY: 144, minZ: 0, maxZ: 144 },
});
describe("equivalent camera preflight reuse", () => {
  it("reuses a prior geometry-only rejection across targets without repeating field checks", () => {
    const fail = () => {
      throw new Error("Known geometry rejection must short-circuit");
    };
    const cache = createFramingPreflight(fail, fail);
    cache.remember({
      stage: "preflight",
      status: "rejected",
      view,
      reason: "central-ground",
    });
    for (const id of [7, 8])
      expect(cache.inspect(view, target(id))).toEqual({
        reasons: ["central-ground"],
        cachedGeometry: true,
        cachedRejected: true,
        targetEvaluated: false,
      });
  });
  it("reuses geometry success but never leaks fissure or region outcomes between targets", () => {
    let geometry = 0,
      targets = 0;
    const cache = createFramingPreflight(
      () => {
        geometry++;
        return [];
      },
      (_view, t) => {
        targets++;
        return t.kind === "thorn-cluster" && t.fissureId === 7
          ? ["fissure-occluded"]
          : [];
      },
    );
    expect(cache.inspect(view, target(7))).toMatchObject({
      reasons: ["fissure-occluded"],
      cachedGeometry: false,
      targetEvaluated: true,
    });
    expect(cache.inspect(view, target(8))).toMatchObject({
      reasons: [],
      cachedGeometry: true,
      cachedRejected: false,
      targetEvaluated: true,
    });
    expect(cache.inspect(view, target(7)).reasons).toEqual([
      "fissure-occluded",
    ]);
    expect(geometry).toBe(1);
    expect(targets).toBe(3);
  });
  it("does not infer geometry clearance from a target-sensitive coarse rejection", () => {
    for (const reason of [
      "wrong-region",
      "fissure-occluded",
      "sparse-local-forest",
      "no-named-fissure-witness",
    ]) {
      let evaluated = 0;
      const cache = createFramingPreflight(
        () => {
          evaluated++;
          return [];
        },
        () => [],
      );
      cache.remember({ stage: "preflight", status: "rejected", view, reason });
      expect(cache.inspect(view, target(8))).toMatchObject({
        reasons: [],
        cachedGeometry: false,
        targetEvaluated: true,
      });
      expect(evaluated).toBe(1);
    }
  });
  it("requires exact pose/time/radius equality rather than rounded proposal-key equality", () => {
    let evaluated = 0;
    const cache = createFramingPreflight(
      () => {
        evaluated++;
        return [];
      },
      () => [],
    );
    cache.inspect(view, target(7));
    for (const changed of [
      { ...view, position: { ...view.position, x: view.position.x + 1e-10 } },
      { ...view, target: { ...view.target, z: view.target.z + 1e-10 } },
      { ...view, hours: 17.26 },
      { ...view, radius: 511 },
    ])
      expect(cache.inspect(changed, target(7)).cachedGeometry).toBe(false);
    expect(evaluated).toBe(5);
    expect(cache.inspect({ ...view }, target(8)).cachedGeometry).toBe(true);
  });
  it("keeps returned reason arrays separate from the cached geometry result", () => {
    const cache = createFramingPreflight(
      () => ["central-five-metres"],
      () => [],
    );
    const first = cache.inspect(view, target(7));
    (first.reasons as string[]).push("fissure-occluded");
    expect(cache.inspect(view, target(8)).reasons).toEqual([
      "central-five-metres",
    ]);
  });
});
