import { describe, expect, it } from "vitest";
import { Block } from "../../../shared/src/blocks/registry.js";
import type { LavaSample } from "../../../shared/src/world/types.js";
import type { IbaraAnalytic } from "../../../shared/src/worldgen/main/ibara-volcanic.js";
import {
  cameraFrame,
  cameraPoseRejections,
  inspectHellCamera,
  type MainCameraCandidate,
} from "../../src/postcards/geometry.js";
import {
  boundedForestRoots,
  forestSceneCandidates,
  nearbyFissureWitnesses,
} from "../../src/postcards/hell-resolve.js";
import type { CameraQuery } from "../../src/postcards/query.js";

const fissure = {
  id: 7,
  ax: 0,
  az: 0,
  bx: 20,
  bz: 0,
  halfWidth: 1,
  depth: 6,
  hot: true,
};
const analytic: IbaraAnalytic = {
  weight: () => 1,
  plain: (_x, _z, out) => out,
  fissures: (x, z) => (x === 0 && z === 0 ? [fissure] : []),
};
const wet = (): LavaSample => ({
  kind: "lava",
  source: "fissure",
  bodyId: 7,
  bed: -3,
  level: -1,
});
const view: MainCameraCandidate = {
  region: "hellscape",
  kind: "eye-level",
  position: { x: 0.5, y: 6.62, z: 0.5 },
  target: { x: 0.5, y: 6.62 - Math.tan((4.25 * Math.PI) / 180) * 64, z: 64.5 },
  radius: 512,
  hours: 17.25,
};
const shelf: CameraQuery = {
  voxel: (_x, y, z) => ({
    density: (z < 1 ? 5 : 0) - y,
    block: y < (z < 1 ? 5 : 0) ? Block.Stone : Block.Air,
    fluid: 0,
  }),
  ground: () => 5,
  height: () => 5,
  region: () => "hellscape",
  walkableFeet: () => 5,
  bounds: () => ({
    minSurfaceY: 0,
    maxSurfaceY: 5,
    maxSolidY: 100,
    maxFluidY: 0,
  }),
  clear() {},
};
describe("fissure-led HELL recovery", () => {
  it("uses an actual wet voxel of the named fissure and rejects caldera/channel overrides", () => {
    expect(nearbyFissureWitnesses({ x: 0, z: 0 }, analytic, wet)).toEqual([
      { fissureId: 7, x: 10.5, y: -1.5, z: 0.5 },
    ]);
    for (const source of ["caldera", "channel"] as const)
      expect(
        nearbyFissureWitnesses({ x: 0, z: 0 }, analytic, () => ({
          ...wet(),
          source,
        })),
      ).toEqual([]);
    expect(
      nearbyFissureWitnesses({ x: 0, z: 0 }, analytic, () => ({
        ...wet(),
        bodyId: 8,
      })),
    ).toEqual([]);
    expect(
      nearbyFissureWitnesses({ x: 0, z: 0 }, analytic, () => ({
        ...wet(),
        bed: -1.2,
        level: -1.1,
      })),
    ).toEqual([]);
  });
  it("keeps only explicitly named roots inside the bounded local disc, in stable ID order", () => {
    const root = { x: 0, z: 0, height: 40, radius: 4 };
    expect(
      boundedForestRoots(
        [
          { ...root, id: 2, x: 144 },
          { ...root, id: 3, x: 145 },
          { ...root, id: 1, x: 100, z: 100 },
        ],
        { x: 0, z: 0, radius: 144 },
      ).map((item) => item.id),
    ).toEqual([1, 2]);
  });
  it("shares the final frame and actual central64x36 pixels with pose rejection", () => {
    const frame = cameraFrame(view);
    expect(frame.horizonFraction).toBeGreaterThan(0.3);
    expect(frame.horizonFraction).toBeLessThan(0.45);
    expect(cameraPoseRejections(view, shelf)).toEqual([]);
    const blocker = {
      ...shelf,
      voxel: (x: number, y: number, z: number) =>
        z > 2 && z < 4 && y > 4
          ? { density: 1, block: Block.Stone, fluid: 0 }
          : shelf.voxel(x, y, z),
    };
    expect(cameraPoseRejections(view, blocker)).toEqual([
      "central-five-metres",
    ]);
    const target = {
      kind: "thorn-cluster" as const,
      featureIds: [123],
      bounds: { minX: -10, maxX: 10, minZ: 0, maxZ: 20, minY: 0, maxY: 20 },
    };
    expect(
      inspectHellCamera(view, blocker, { target, lava: wet }).centralClear,
    ).toBe(false);
  });
  it("retains every cheap rejection before full validation and cannot turn a flat ground pose into a camera", () => {
    const events: Readonly<Record<string, unknown>>[] = [];
    const flat = {
      ...shelf,
      ground: () => 0,
      walkableFeet: () => 0,
      voxel: (_x: number, y: number) => ({
        density: -y,
        block: y < 0 ? Block.Stone : Block.Air,
        fluid: 0,
      }),
    };
    const candidates = forestSceneCandidates(
      [{ fissureId: 7, x: 0.5, y: -1.5, z: 0.5 }],
      flat,
      wet,
      () => 0,
      () => {
        throw new Error(
          "Rejected flat terrain must not construct forest geometry",
        );
      },
      () => {
        throw new Error("No eligible target");
      },
      (event) => events.push(event),
    );
    expect(candidates).toEqual([]);
    expect(events.filter((event) => event.stage === "preflight")).toHaveLength(
      360,
    );
    expect(
      events
        .filter((event) => event.stage === "preflight")
        .every((event) => event.status === "rejected"),
    ).toBe(true);
    expect(events.at(-1)).toMatchObject({
      stage: "proposal-summary",
      proposals: 360,
      fullGridCandidates: 0,
    });
  });
  it("counts the selected fissure owner separately from unrelated visible fissures", () => {
    const plane = {
      ...shelf,
      voxel: (x: number, y: number, z: number) =>
        z > 10 && y < 5 && y > -3
          ? { density: -1, block: Block.Lava, fluid: Block.Lava }
          : shelf.voxel(x, y, z),
    };
    const target = {
      kind: "thorn-cluster" as const,
      featureIds: [123],
      fissureId: 7,
      rootDisc: { x: 0, z: 0, radius: 144 },
      bounds: { minX: -10, maxX: 10, minZ: 0, maxZ: 20, minY: 0, maxY: 20 },
    };
    const lava = () => ({ ...wet(), level: 5 });
    const named = inspectHellCamera(
      view,
      plane,
      { target, lava },
      { width: 16, height: 9 },
    );
    const other = inspectHellCamera(
      view,
      plane,
      { target, lava: () => ({ ...lava(), bodyId: 8 }) },
      { width: 16, height: 9 },
    );
    expect(named.targetFissureFraction).toBeGreaterThan(0);
    expect(other.fissureFraction).toBe(named.fissureFraction);
    expect(other.targetFissureFraction).toBe(0);
    expect(other.passed).toBe(false);
  });
});
