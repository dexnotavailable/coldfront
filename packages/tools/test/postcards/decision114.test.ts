import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Block } from "../../../shared/src/blocks/registry.js";
import {
  type CameraFirstHit,
  cameraFrame,
  cameraHorizonAllowed,
  cameraPoseRejections,
  inspectHellCamera,
  inspectMainCamera,
  isSupportingGroundHit,
  supportingVoxelTop,
} from "../../src/postcards/geometry.js";
import { inspectTestCamera } from "../../src/postcards/resolve.js";
import {
  decision114Camera,
  decision114Cases,
  decision114Lava,
  decision114Query,
  decision114Target,
} from "./fixtures/decision114-fields.js";

const baseline = JSON.parse(
  readFileSync(
    new URL("./fixtures/decision114-first-hits.json", import.meta.url),
    "utf8",
  ),
) as {
  sourceSha256: string;
  cases: {
    name: string;
    firstHitCount: number;
    voxelHitSha256: string;
    counts: Record<string, number>;
    visibleFeatureIds: number[];
    visibleLavaOwners: unknown[];
  }[];
};
describe("decision114 support floor and scoped horizon contract", () => {
  it.each(decision114Cases)(
    "preserves original first hits, coverage and sky: $name",
    (test) => {
      const hits: CameraFirstHit[] = [],
        view = decision114Camera(test.pitch);
      const checked = inspectHellCamera(view, decision114Query(test.field), {
        target: decision114Target,
        lava: decision114Lava,
        onHit: (hit) => hits.push(hit),
      });
      const old = baseline.cases.find((row) => row.name === test.name);
      expect(old).toBeDefined();
      const voxels = hits.map((h) => [
        h.px,
        h.py,
        Math.floor(h.x),
        Math.floor(h.y),
        Math.floor(h.z),
        h.block,
        h.featureId,
        h.distance,
      ]);
      expect(
        createHash("sha256").update(JSON.stringify(voxels)).digest("hex"),
      ).toBe(old?.voxelHitSha256);
      expect(hits.length).toBe(old?.firstHitCount);
      for (const [key, count] of Object.entries(old?.counts ?? {}))
        expect(
          Math.round((checked[key as keyof typeof checked] as number) * 2304),
        ).toBe(count);
      expect(checked.visibleFeatureIds).toEqual(old?.visibleFeatureIds);
      expect(checked.visibleLavaOwners).toEqual(old?.visibleLavaOwners);
    },
  );
  it.each([-5, 0, 4.25, 7, 9])(
    "allows the audit's supported flat floor at pitch %s without manufacturing target content",
    (pitch) => {
      const view = decision114Camera(pitch),
        query = decision114Query("flat");
      const checked = inspectHellCamera(view, query, {
        target: decision114Target,
        lava: decision114Lava,
      });
      expect(cameraPoseRejections(view, query)).toEqual([]);
      expect(checked).toMatchObject({
        eyeClear: true,
        walkable: true,
        centralClear: true,
        targetFraction: 0,
        passed: false,
      });
      expect(checked.horizonFraction).toBe(cameraFrame(view).horizonFraction);
    },
  );
  it.each(["wall", "raised", "tagged-floor", "water", "lava"] as const)(
    "retains genuine nearby %s obstructions",
    (kind) => {
      const view = decision114Camera(4.25),
        query = decision114Query(kind);
      expect(cameraPoseRejections(view, query)).toEqual([
        "central-five-metres",
      ]);
      expect(
        inspectHellCamera(view, query, {
          target: decision114Target,
          lava: decision114Lava,
        }),
      ).toMatchObject({
        eyeClear: true,
        walkable: true,
        centralClear: false,
        passed: false,
      });
    },
  );
  it("does not exempt an untagged low wall above ordinary terrain even below a higher support plane", () => {
    const base = decision114Query("flat"),
      ordinaryTop = (x: number, z: number) =>
        Math.abs(Math.floor(x) + 0.5 - 0.5) < 1 &&
        Math.abs(Math.floor(z) + 0.5 - 0.5) < 1
          ? 5
          : 0;
    const query = {
      ...base,
      ground: ordinaryTop,
      bounds: () => ({
        minSurfaceY: 0,
        maxSurfaceY: 5,
        maxSolidY: 5,
        maxFluidY: 0,
      }),
      voxel(x: number, y: number, z: number) {
        const cx = Math.floor(x) + 0.5,
          cy = Math.floor(y) + 0.5,
          cz = Math.floor(z) + 0.5;
        const wall = Math.abs(cx) < 3 && cz >= 3 && cz < 5 && cy < 5 && cy >= 0,
          solid = cy < ordinaryTop(x, z) || wall;
        return {
          density: solid ? 1 : -1,
          block: solid ? Block.Basalt : Block.Air,
          fluid: 0,
          featureId: 0,
        };
      },
    };
    const original = decision114Camera(4.25),
      view = {
        ...original,
        position: { ...original.position, y: 6.62 },
        target: { ...original.target, y: original.target.y + 5 },
      };
    const checked = inspectHellCamera(view, query, {
      target: decision114Target,
      lava: decision114Lava,
    });
    expect(checked.walkable).toBe(true);
    expect(checked.centralClear).toBe(false);
    expect(cameraPoseRejections(view, query)).toEqual(["central-five-metres"]);
  });
  it("requires validated support and explicit ordinary-ground identity", () => {
    const hit = {
      x: 0.5,
      y: -0.5,
      z: 4.5,
      block: Block.Basalt,
      fluid: 0,
      featureId: 0,
    };
    expect(supportingVoxelTop(30.62)).toBe(29);
    expect(isSupportingGroundHit(hit, 0, () => 0)).toBe(true);
    expect(isSupportingGroundHit(hit, 0, () => 1)).toBe(false); // A raised column is not supporting floor.
    for (const top of [null, NaN, 0.2])
      expect(isSupportingGroundHit(hit, top, () => 0)).toBe(false);
    expect(isSupportingGroundHit(hit, 0, undefined)).toBe(false);
    for (const ground of [NaN, Infinity, 0.2])
      expect(isSupportingGroundHit(hit, 0, () => ground)).toBe(false);
    expect(
      isSupportingGroundHit({ ...hit, featureId: undefined }, 0, () => 0),
    ).toBe(false);
    const base = decision114Query("flat"),
      missingIdentity = {
        ...base,
        voxel: (x: number, y: number, z: number) => {
          const sample = base.voxel(x, y, z);
          return {
            density: sample.density,
            block: sample.block,
            fluid: sample.fluid,
          };
        },
      };
    expect(
      cameraPoseRejections(decision114Camera(4.25), missingIdentity),
    ).toEqual(["central-five-metres"]);
    const noSupport = {
      ...base,
      voxel: (x: number, y: number, z: number) =>
        Math.floor(x) === 0 && Math.floor(z) === 0 && y < 0
          ? { density: -1, block: Block.Air, fluid: 0, featureId: 0 }
          : base.voxel(x, y, z),
    };
    expect(
      inspectHellCamera(decision114Camera(4.25), noSupport, {
        target: decision114Target,
        lava: decision114Lava,
      }),
    ).toMatchObject({ walkable: false, centralClear: false });
  });
  it("retains aerial near-obstruction behavior and the aerial vista horizon band", () => {
    const query = decision114Query("flat"),
      low = {
        ...decision114Camera(4.25),
        kind: "aerial" as const,
        terrainUpperBound: 0,
      };
    expect(inspectMainCamera(low, query).centralClear).toBe(false);
    expect(cameraPoseRejections(low, query)).toEqual(["central-five-metres"]);
    const level = {
      ...decision114Camera(0),
      kind: "aerial" as const,
      position: { x: 0.5, y: 24, z: 0.5 },
      target: { x: 0.5, y: 24, z: 64.5 },
      terrainUpperBound: 0,
    };
    expect(cameraHorizonAllowed(level, 0.5)).toBe(false);
    expect(inspectMainCamera(level, query).passed).toBe(false);
    const vista = {
      ...level,
      target: { ...level.target, y: 24 - 64 * Math.tan((9 * Math.PI) / 180) },
    };
    expect(inspectMainCamera(vista, query)).toMatchObject({
      passed: true,
      centralClear: true,
    });
    expect(cameraHorizonAllowed(decision114Camera(0), 0.5)).toBe(true);
  });
  it("copies borrowed first-hit values before a ground-column query can overwrite scratch storage", () => {
    const base = decision114Query("raised"),
      query = {
        ...base,
        ground: (x: number, z: number) => {
          const top = base.ground(x, z);
          base.voxel(1000, 1000, 1000);
          return top;
        },
      };
    const a: CameraFirstHit[] = [],
      b: CameraFirstHit[] = [],
      view = decision114Camera(4.25);
    const inspect = (q: typeof query, hits: CameraFirstHit[]) =>
      inspectHellCamera(view, q, {
        target: decision114Target,
        lava: decision114Lava,
        onHit: (hit) => hits.push(hit),
      });
    expect(inspect(query, a)).toEqual(inspect(decision114Query("raised"), b));
    expect(a).toEqual(b);
  });
  it("applies the same supported-floor and level-eye interpretation to legacy TEST-1", () => {
    for (const pitch of [-5, 0, 4.25])
      for (const kind of ["flat", "wall"] as const) {
        const query = decision114Query(kind),
          view = decision114Camera(pitch);
        const checked = inspectTestCamera(
          {
            id: "TEST-1",
            seed: 1,
            position: view.position,
            target: view.target,
            hours: view.hours,
            radius: view.radius,
          },
          { ...query, get: (x, y, z) => query.voxel(x, y, z).block },
        );
        expect(checked.validation).toMatchObject({
          eyeClear: true,
          walkable: true,
          centralClear: kind === "flat",
        });
        expect(checked.validation.horizonFraction).toBeCloseTo(
          cameraFrame(view).horizonFraction,
          12,
        );
        expect(checked.score).toBeLessThan(100); // No required pond coverage was supplied.
      }
  });
});
