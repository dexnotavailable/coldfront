import { MeshLambertMaterial } from "three";
import { describe, expect, it } from "vitest";
import type { WorldSession } from "../../../client/src/contracts/game-ui.js";
import type { ChunkStore } from "../../../client/src/engine/chunk-store.js";
import type {
  FarGenerationRequest,
  FarGenerationResult,
} from "../../../client/src/engine/far-terrain-store.js";
import { FarWorld } from "../../../client/src/engine/far-world.js";
import type { VoxelEdit } from "../../../client/src/engine/worker-protocol.js";
import { createWorldContext } from "../../../shared/src/world/world-context.js";
import type { FarMeshPart } from "../../../shared/src/worldgen/far/types.js";

function fixture() {
  const world: WorldSession = {
    id: 1,
    identity: { kind: "test", seed: 1, generation: "visibility-runtime-test" },
  };
  const requests: FarGenerationRequest[] = [],
    edits = new Map<number, VoxelEdit>();
  let listener: ((edit: VoxelEdit) => void) | undefined;
  const empty = (): FarMeshPart => ({
    positions: new Float32Array(),
    normals: new Float32Array(),
    expansions: new Int8Array(),
    surfaces: new Float32Array(),
    featureIdParts: new Uint16Array(),
    indices: new Uint32Array(),
  });
  const statistics = {
    densityCalls: 0,
    columns: 0,
    runs: 0,
    quads: 0,
    skirtQuads: 0,
    typedArrayBytes: 0,
  };
  const near = {
    world,
    edits,
    context: createWorldContext({ kind: "test", seed: 1 }),
    subscribeEdits: (callback: (edit: VoxelEdit) => void) => {
      listener = callback;
      return () => {
        listener = undefined;
      };
    },
    createFarScheduler: () => ({
      async request(
        request: FarGenerationRequest,
      ): Promise<FarGenerationResult> {
        requests.push(request);
        return {
          ...request,
          runs: {
            ...request,
            offsets: new Uint32Array(1157),
            words: new Uint32Array(),
            statistics,
          },
          mesh: {
            parts: Array.from({ length: 5 }, empty),
            skirts: Array.from({ length: 4 }, () =>
              Array.from({ length: 5 }, empty),
            ),
            quads: 0,
            statistics,
          },
        };
      },
      cancel() {},
      dispose() {},
    }),
  } as unknown as ChunkStore;
  const materials = Array.from({ length: 5 }, () => new MeshLambertMaterial());
  // Real selector/store lifecycle; empty generated data and preparation are
  // explicit CPU test doubles, not a GPU or regional-generation claim.
  const far = new FarWorld(near, "surface", { materials, prepareGpu() {} });
  const view = {
    position: { x: 0, y: 26.659649062935802, z: 13.765834472425105 },
    target: { x: 0, y: 7, z: 0 },
    fov: 40,
    aspect: 1.5,
    pixelHeight: 640,
    reach: 16_000,
    cut: Infinity,
  };
  return {
    far,
    view,
    requests,
    edit(edit: VoxelEdit) {
      edits.set(edits.size, edit);
      listener?.(edit);
    },
    dispose() {
      far.dispose();
      for (const material of materials) material.dispose();
    },
  };
}

describe("far visibility selection refresh", () => {
  it("accepts an empty target only after committing it, without requesting tiles", async () => {
    const f = fixture();
    try {
      await f.far.select(f.view, true, true);
      expect(f.requests).toHaveLength(0);
      expect(f.far.telemetry.targetTiles).toBe(0);
      expect(f.far.ready).toBe(false);
      f.far.drain(Infinity);
      expect(f.far.ready).toBe(true);
      expect(f.far.telemetry.visible).toEqual([]);
    } finally {
      f.dispose();
    }
  });
  it("replans edited cavities at a fixed frozen camera and preserves its frozen flags", async () => {
    const f = fixture();
    try {
      await f.far.select(f.view, true, true);
      f.far.drain(Infinity);
      expect(f.far.ready).toBe(true);
      f.edit({ x: 0, y: -300, z: -256, block: 0 });
      expect(f.far.ready).toBe(false);
      expect(f.far.telemetry.targetTiles).toBeGreaterThan(0);
      expect(f.requests.length).toBeGreaterThan(0);
      expect(f.far.telemetry.frozen).toBe(true);
      expect(f.far.camera.position.toArray()).toEqual([
        f.view.position.x,
        f.view.position.y,
        f.view.position.z,
      ]);
      expect(() => f.far.drain(Infinity)).not.toThrow();
    } finally {
      f.dispose();
    }
  });
  it("uses a candidate cut on the first plan and refreshes a later fixed-camera cut", async () => {
    const f = fixture();
    try {
      await f.far.select({ ...f.view, cut: -300 }, true, true);
      expect(f.far.cutHeight).toBe(-300);
      expect(f.far.telemetry.targetTiles).toBeGreaterThan(0);
      f.far.setPresentation({ x: 0, y: 0, z: 0 }, Infinity, []);
      expect(f.far.telemetry.targetTiles).toBe(0);
      expect(f.far.ready).toBe(false);
      f.far.drain(Infinity);
      expect(f.far.ready).toBe(true);
      f.far.setPresentation({ x: 0, y: 0, z: 0 }, -300, []);
      expect(f.far.telemetry.targetTiles).toBeGreaterThan(0);
      expect(f.far.ready).toBe(false);
      expect(f.far.telemetry.frozen).toBe(true);
    } finally {
      f.dispose();
    }
  });
});
