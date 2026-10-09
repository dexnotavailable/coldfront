import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { validatePostcardSelection } from "../../../client/src/bootstrap/postcard.js";
import { postcardColumnVisible } from "../../../client/src/game/postcard.js";
import { Block } from "../../../shared/src/blocks/registry.js";
import { SURFACE_REGIONS } from "../../../shared/src/world/regions.js";
import type { WorldContext } from "../../../shared/src/world/types.js";
import { WORLDGEN_VERSION } from "../../../shared/src/worldgen/version.js";
import {
  inspectMainCamera,
  type MainCameraCandidate,
} from "../../src/postcards/geometry.js";
import {
  firstPassId,
  type MainCameraManifest,
  mainCameraCandidate,
  parsePostcardIds,
  type ResolvedMainCamera,
  retainedMainCameras,
  revalidateMainCamera,
} from "../../src/postcards/main-resolve.js";
import { postcardArguments } from "../../src/postcards/prepare.js";
import type { CameraQuery } from "../../src/postcards/query.js";

const view: MainCameraCandidate = {
  region: "plains",
  kind: "aerial",
  position: { x: 0, y: 24, z: 0 },
  target: { x: 0, y: 24 - Math.tan((9 * Math.PI) / 180) * 64, z: 64 },
  radius: 320,
  hours: 17.25,
  terrainUpperBound: 0,
};
const plane: CameraQuery = {
  voxel: (_x, y) => ({
    density: -y,
    block: y < 0 ? Block.Stone : Block.Air,
    fluid: 0,
  }),
  height: () => 0,
  ground: () => 0,
  region: () => "plains",
  bounds: () => ({
    minSurfaceY: -1,
    maxSurfaceY: 0,
    maxSolidY: Infinity,
    maxFluidY: 0,
  }),
  walkableFeet: () => 0,
  clear() {},
};
describe("first-pass postcard contracts and geometry", () => {
  it("places Blackwater aerial candidates beyond a nearby escarpment without lowering its conservative bound", () => {
    const water: CameraQuery = {
      ...plane,
      region: () => "blackwater",
      ground: () => -225,
      voxel: (_x, y) => ({
        density: -225 - y,
        block: y < 0 ? Block.Water : Block.Air,
        fluid: y < 0 ? Block.Water : Block.Air,
      }),
    };
    const context: Pick<WorldContext, "conservativeBounds"> = {
      conservativeBounds(bounds, out) {
        // High escarpment at the anchor; a distant bridge still reaches18m.
        const upper = bounds.minX <= 0 ? 240 : 18;
        return Object.assign(out, {
          minSurfaceY: -225,
          maxSurfaceY: upper,
          maxSolidY: upper,
          maxFluidY: 0,
        });
      },
    };
    const oldFootprint = mainCameraCandidate(
      "plains",
      { x: 0, z: 0 },
      38,
      context,
      { ...water, region: () => "plains" },
    );
    const candidate = mainCameraCandidate(
      "blackwater",
      { x: 0, z: 0 },
      38,
      context,
      water,
    );
    expect(oldFootprint?.terrainUpperBound).toBe(240);
    expect(candidate?.position.x).toBeGreaterThan(320);
    expect(candidate?.terrainUpperBound).toBe(18);
    expect(candidate?.position.y).toBe(42);
    if (!candidate || !oldFootprint) throw new Error("Missing candidate");
    const grid = { width: 16, height: 9 };
    expect(
      inspectMainCamera({ ...oldFootprint, region: "blackwater" }, water, grid)
        .passed,
    ).toBe(false);
    expect(inspectMainCamera(candidate, water, grid).passed).toBe(true);
    expect(
      mainCameraCandidate("blackwater", { x: 0, z: 0 }, 38, context, plane),
    ).toBeNull();
  });
  it("retains13 independent saved views across resolver changes while rejecting unknown or stale world identities", () => {
    const sourceHash = "a".repeat(64),
      resolverHash = "b".repeat(64);
    const validation = inspectMainCamera(view, plane, { width: 16, height: 9 });
    const cameras: ResolvedMainCamera[] = SURFACE_REGIONS.slice(0, 13).map(
      (region) => ({
        ...view,
        region: region.id,
        id: firstPassId(region.id),
        seed: 1,
        ungraded: true,
        validation,
        score: 101,
      }),
    );
    const manifest: MainCameraManifest = {
      schema: 1,
      worldKind: "main",
      seed: 1,
      worldgenVersion: WORLDGEN_VERSION,
      sourceHash,
      resolverHash,
      cameras,
      resolution: { planMs: 0, totalMs: 0, entries: [] },
    };
    const retained = retainedMainCameras(manifest, 1, sourceHash);
    expect(retained.map((camera) => camera.id)).toEqual(
      cameras.map((camera) => camera.id),
    );
    expect(
      retained.map(({ validatedByResolverHash, ...camera }) => {
        expect(validatedByResolverHash).toBe(resolverHash);
        return camera;
      }),
    ).toEqual(cameras);
    expect(retainedMainCameras(manifest, 2, sourceHash)).toEqual([]);
    expect(retainedMainCameras(manifest, 1, "c".repeat(64))).toEqual([]);
    expect(
      retainedMainCameras(
        { ...manifest, worldgenVersion: WORLDGEN_VERSION + 1 },
        1,
        sourceHash,
      ),
    ).toEqual([]);
    expect(
      retainedMainCameras(
        {
          ...manifest,
          cameras: [
            {
              ...cameras[0],
              id: "P12-unknown",
            } as unknown as ResolvedMainCamera,
            { ...cameras[1], seed: 2 } as ResolvedMainCamera,
          ],
        },
        1,
        sourceHash,
      ),
    ).toEqual([]);
  });
  it("revalidates retained cameras with current geometry and score before updating their resolver provenance", () => {
    const previous: ResolvedMainCamera = {
      ...view,
      id: "P12-plains",
      seed: 1,
      ungraded: true,
      validation: inspectMainCamera(view, plane),
      score: -999,
      validatedByResolverHash: "b".repeat(64),
    };
    const current = revalidateMainCamera(previous, plane, "c".repeat(64));
    expect(current?.validatedByResolverHash).toBe("c".repeat(64));
    expect(current?.validation.passed).toBe(true);
    expect(current?.score).toBeGreaterThan(100);
    expect(previous.score).toBe(-999);
    const obstructed = {
      ...plane,
      voxel: () => ({ density: 1, block: Block.Stone, fluid: 0 }),
    };
    expect(
      revalidateMainCamera(previous, obstructed, "c".repeat(64)),
    ).toBeNull();
    expect(previous.validatedByResolverHash).toBe("b".repeat(64));
  });
  it("keeps TEST-1 default and names16 distinct ungraded surface views without accepting future phases", () => {
    expect(parsePostcardIds(null, null)).toEqual(["TEST-1"]);
    expect(parsePostcardIds("1.2", null)).toEqual(
      SURFACE_REGIONS.map((region) => `P12-${region.id}`),
    );
    expect(() => parsePostcardIds("1.4", null)).toThrow("Unsupported");
    expect(() => parsePostcardIds("1.2", "HELL-1")).toThrow("phase1.3");
    expect(() => parsePostcardIds("1.2", "TEST-1,P12-plains")).toThrow(
      "separate",
    );
    expect(() => postcardArguments(["--seed", "-1"])).toThrow("unsigned");
  });
  it("requires a source/version-bound main manifest while retaining the old TEST-1 shape", () => {
    const hash = "a".repeat(64),
      camera = {
        ...view,
        id: "P12-plains",
        seed: 1,
        ungraded: true,
        validation: { passed: true },
      };
    const document = {
      phase12: {
        schema: 1,
        worldKind: "main",
        seed: 1,
        worldgenVersion: WORLDGEN_VERSION,
        sourceHash: hash,
        cameras: [camera],
      },
    };
    const selection = validatePostcardSelection(
      document,
      "P12-plains",
      1,
      hash,
    );
    expect(selection.initial.identity).toEqual({
      kind: "main",
      seed: 1,
      generation: `${WORLDGEN_VERSION}:${hash}`,
    });
    expect(() =>
      validatePostcardSelection(document, "P12-plains", 1, "b".repeat(64)),
    ).toThrow("stale");
    expect(() =>
      validatePostcardSelection(
        { phase12: { ...document.phase12, cameras: [camera, camera] } },
        "P12-plains",
        1,
        hash,
      ),
    ).toThrow("Invalid");
    const legacy = {
      id: "TEST-1",
      seed: 1,
      position: view.position,
      target: view.target,
      hours: 17.25,
      radius: 160,
    };
    expect(
      validatePostcardSelection(legacy, "TEST-1", 1, hash).initial.identity
        .kind,
    ).toBe("test");
  });
  it("validates real geometric criteria rather than using a high score to waive close obstructions", () => {
    const good = inspectMainCamera(view, plane, { width: 16, height: 9 });
    expect(good.passed).toBe(true);
    expect(good.walkable).toBe(false);
    expect(good.centralClear).toBe(true);
    const blocked: CameraQuery = {
      ...plane,
      voxel: (x, y, z) =>
        z >= 2 && z <= 5 && Math.abs(x) < 4 && y > 1
          ? { density: 1, block: Block.Stone, fluid: 0 }
          : plane.voxel(x, y, z),
    };
    const bad = inspectMainCamera(view, blocked, { width: 16, height: 9 });
    expect(bad.centralClear).toBe(false);
    expect(bad.passed).toBe(false);
    const eye = {
      ...view,
      kind: "eye-level" as const,
      position: { x: 0, y: 1.62, z: 0 },
      target: { ...view.target, y: 1.62 - Math.tan((9 * Math.PI) / 180) * 64 },
    };
    const low = inspectMainCamera(eye, plane, { width: 16, height: 9 });
    expect(low.walkable).toBe(true);
    expect(low.centralClear).toBe(false);
    expect(low.passed).toBe(false);
  });
  it("conservatively includes actual70-degree frustum corner rays across negative chunk coordinates", () => {
    const cameraView = {
      ...view,
      position: { x: -101.5, y: 70, z: -90.5 },
      target: { x: -38, y: 55, z: -9 },
    };
    const camera = new PerspectiveCamera(70, 16 / 9, 0.2, 1600);
    camera.position.set(
      cameraView.position.x,
      cameraView.position.y,
      cameraView.position.z,
    );
    camera.lookAt(
      cameraView.target.x,
      cameraView.target.y,
      cameraView.target.z,
    );
    camera.updateMatrixWorld();
    for (const x of [-0.999, 0, 0.999])
      for (const y of [-0.999, 0, 0.999]) {
        const ray = new Vector3(x, y, 0.5)
          .unproject(camera)
          .sub(camera.position)
          .normalize();
        for (const distance of [48, 128, 300]) {
          const point = camera.position.clone().addScaledVector(ray, distance);
          expect(
            postcardColumnVisible(
              cameraView,
              Math.floor(point.x / 32),
              Math.floor(point.z / 32),
            ),
          ).toBe(true);
        }
      }
  });
});
