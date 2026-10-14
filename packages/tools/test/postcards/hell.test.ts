import { describe, expect, it } from "vitest";
import { Block } from "../../../shared/src/blocks/registry.js";
import type {
  IbaraCalderaData,
  VoxelSample,
  WorldContext,
} from "../../../shared/src/world/types.js";
import { WORLDGEN_VERSION } from "../../../shared/src/worldgen/version.js";
import {
  type HellTarget,
  inspectHellCamera,
  type MainCameraCandidate,
} from "../../src/postcards/geometry.js";
import {
  compatibleHellManifest,
  type HellCameraManifest,
  retainedHellCameras,
} from "../../src/postcards/hell-resolve.js";
import { parsePostcardIds } from "../../src/postcards/main-resolve.js";
import {
  postcardArguments,
  postcardOutputStem,
} from "../../src/postcards/prepare.js";
import { type CameraQuery, cameraQuery } from "../../src/postcards/query.js";

const bounds = {
  minX: -200,
  maxX: 200,
  minY: -10,
  maxY: 200,
  minZ: 320,
  maxZ: 400,
};
const target: HellTarget = {
  kind: "thorn-cluster",
  featureIds: [0x1234567],
  bounds,
};
const view: MainCameraCandidate = {
  region: "hellscape",
  kind: "eye-level",
  position: { x: 0, y: 1.62, z: 0 },
  target: { x: 0, y: 1.62 - Math.tan((9 * Math.PI) / 180) * 64, z: 64 },
  hours: 17.25,
  radius: 512,
};
const dry = () => ({
  bodyId: 0,
  kind: "none" as const,
  source: "none" as const,
  bed: -Infinity,
  level: -Infinity,
});
const plane: CameraQuery = {
  voxel: (_x, y) => ({
    density: -y,
    block: y < 0 ? Block.Stone : Block.Air,
    fluid: 0,
    featureId: 0,
    featureT: 0,
  }),
  height: () => 0,
  ground: () => 0,
  region: () => "hellscape",
  clear() {},
  bounds: () => ({
    minSurfaceY: -10,
    maxSurfaceY: 0,
    maxSolidY: 220,
    maxFluidY: 0,
  }),
  walkableFeet: () => 0,
};
describe("HELL evidence and namespace boundaries", () => {
  it("requires an explicit real target, not ordinary regional ground coverage", () => {
    const checked = inspectHellCamera(view, plane, { target, lava: dry });
    expect(checked.rayColumns).toBe(64);
    expect(checked.rayRows).toBe(36);
    expect(checked.targetFraction).toBe(0);
    expect(checked.featureFraction).toBe(0);
    expect(checked.visibleFeatureIds).toEqual([]);
    expect(checked.passed).toBe(false);
  });
  it("sees target overhangs beyond300m and copies the reused voxel identity immediately", () => {
    const scratch: VoxelSample = {
      density: 0,
      block: 0,
      fluid: 0,
      featureId: 0,
      featureT: 0,
    };
    const query: CameraQuery = {
      ...plane,
      height: () => -999,
      voxel(x, y, z) {
        Object.assign(scratch, plane.voxel(x, y, z));
        if (z >= 350 && z <= 360 && Math.abs(x) < 200 && y > 1 && y < 200)
          Object.assign(scratch, {
            density: 1,
            block: Block.Obsidian,
            featureId: 0x1234567,
            featureT: 0.1234567891234567,
          });
        return scratch;
      },
      region() {
        scratch.featureId = 0;
        return "hellscape";
      },
    };
    const checked = inspectHellCamera(
      view,
      query,
      { target, lava: dry },
      { width: 16, height: 9 },
    );
    expect(checked.visibleFeatureIds).toEqual([0x1234567]);
    expect(checked.targetFraction).toBeGreaterThan(0);
    expect(checked.passed).toBe(false); // No fissure evidence was provided.
    expect(
      inspectHellCamera(
        { ...view, radius: 300 },
        query,
        { target, lava: dry },
        { width: 16, height: 9 },
      ).targetFraction,
    ).toBe(0);
  });
  it("requires lava owned by the named caldera, without confusing its ID with a thorn ID", () => {
    const caldera: IbaraCalderaData = {
      id: 7,
      x: 0,
      z: 100,
      radius: 100,
      baseY: 0,
      floorY: -10,
      rimHeight: 10,
      rimWidth: 10,
      lavaRadius: 80,
      lavaLevel: 0,
      bounds: {
        minX: -100,
        maxX: 100,
        minZ: 0,
        maxZ: 200,
        minY: -20,
        maxY: 20,
      },
    };
    const query: CameraQuery = {
      ...plane,
      voxel: (x, y, z) =>
        z > 2 && y < 0 && y > -10
          ? { density: -1, block: Block.Lava, fluid: Block.Lava, featureId: 0 }
          : plane.voxel(x, y, z),
    };
    const inspection = {
      target: {
        kind: "caldera" as const,
        calderaId: 7,
        bounds: caldera.bounds,
      },
      caldera,
      lava: () => ({
        kind: "lava" as const,
        source: "caldera" as const,
        bodyId: 7,
        bed: -10,
        level: 0,
      }),
    };
    const valid = inspectHellCamera(view, query, inspection, {
      width: 16,
      height: 9,
    });
    expect(valid.targetLavaFraction).toBeGreaterThan(0);
    expect(valid.visibleFeatureIds).toEqual([]);
    expect(valid.visibleLavaOwners).toEqual([{ source: "caldera", bodyId: 7 }]);
    const wrong = inspectHellCamera(
      view,
      query,
      { ...inspection, lava: () => ({ ...inspection.lava(), bodyId: 8 }) },
      { width: 16, height: 9 },
    );
    expect(wrong.lavaFraction).toBe(valid.lavaFraction);
    expect(wrong.targetLavaFraction).toBe(0);
    expect(wrong.passed).toBe(false);
  });
  it("finds walkable overhang surfaces through the existing prepared cache, not the column hint", () => {
    let prepares = 0,
      boundsQueries = 0;
    const layout = { stride: 2, height: 0, waterLevel: 1 };
    const area = {
      createColumn: () => new Float64Array(2),
      sampleColumn: (_x: number, _z: number, out: Float64Array) => {
        out.set([0, -Infinity]);
        return out;
      },
      sampleVoxel: (_x: number, y: number, _z: number, out: VoxelSample) =>
        Object.assign(out, {
          density: y >= 18 && y < 20 ? 1 : -1,
          block: y >= 18 && y < 20 ? Block.Stone : Block.Air,
          fluid: 0,
        }),
    };
    const context = {
      columns: layout,
      prepareArea: () => {
        prepares++;
        return area;
      },
      conservativeBounds: () => {
        boundsQueries++;
        return {
          minSurfaceY: 0,
          maxSurfaceY: 0,
          maxSolidY: 20,
          maxFluidY: -Infinity,
        };
      },
    } as unknown as WorldContext;
    const query = cameraQuery(context);
    expect(query.walkableFeet(4.5, 4.5, 0, 22)).toBe(20);
    expect(prepares).toBe(1);
    expect(
      query.bounds({ minX: 0, minZ: 0, maxX: 31, maxZ: 31 }).maxSolidY,
    ).toBe(20);
    query.bounds({ minX: 4, minZ: 4, maxX: 5, maxZ: 5 });
    expect(boundsQueries).toBe(1);
    query.clear();
    query.bounds({ minX: 4, minZ: 4, maxX: 5, maxZ: 5 });
    expect(boundsQueries).toBe(2);
  });
  it("parses phase1.3 and keeps every variant/view/source output distinct", () => {
    expect(parsePostcardIds("1.3", null)).toEqual(["HELL-1", "HELL-2"]);
    expect(
      postcardArguments(["--phase", "1.3", "--primitive", "--view", "clay"]),
    ).toMatchObject({ variant: "primitive", view: "clay", world: "main" });
    expect(() => postcardArguments(["--primitive"])).toThrow("HELL");
    expect(() => postcardArguments(["--view", "wireframe"])).toThrow("view");
    expect(() => parsePostcardIds("1.3", "HELL-1,P12-plains")).toThrow(
      "separate",
    );
    const names = ["production", "primitive"].flatMap((variant) =>
      ["normal", "clay", "features"].map((mode) =>
        postcardOutputStem(
          "HELL-1",
          1,
          variant as "production" | "primitive",
          mode as "normal" | "clay" | "features",
          "a".repeat(64),
        ),
      ),
    );
    expect(new Set(names).size).toBe(6);
    expect(
      postcardOutputStem("HELL-1", 1, "production", "normal", "b".repeat(64)),
    ).not.toBe(names[0]);
    const manifest = {
      schema: 1,
      worldKind: "main",
      seed: 1,
      worldgenVersion: WORLDGEN_VERSION,
      sourceHash: "a".repeat(64),
      resolverHash: "b".repeat(64),
      variant: "production",
      cameras: [],
      resolution: { planMs: 0, totalMs: 0, entries: [] },
      attemptsPath: "fixture-only.jsonl",
    } as HellCameraManifest;
    expect(
      compatibleHellManifest(manifest, 1, "a".repeat(64), "production"),
    ).toBe(true);
    expect(
      compatibleHellManifest(manifest, 1, "a".repeat(64), "primitive"),
    ).toBe(false);
    expect(
      retainedHellCameras(
        {
          ...manifest,
          cameras: [
            { id: "HELL-1", targetFeature: undefined },
          ] as unknown as HellCameraManifest["cameras"],
        },
        1,
        "a".repeat(64),
        "production",
      ),
    ).toEqual([]);
  });
});
