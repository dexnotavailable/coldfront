import { describe, expect, it } from "vitest";
import type { WorldSession } from "../../../client/src/contracts/game-ui.js";
import type { ChunkStore } from "../../../client/src/engine/chunk-store.js";
import type {
  FarGenerationRequest,
  FarGenerationResult,
} from "../../../client/src/engine/far-terrain-store.js";
import { FarWorld } from "../../../client/src/engine/far-world.js";
import type { VoxelEdit } from "../../../client/src/engine/worker-protocol.js";
import type { FarMeshPart } from "../../../shared/src/worldgen/far/types.js";

const world: WorldSession = {
  id: 27,
  identity: { kind: "test", seed: 1, generation: "far-review-recovery" },
};
const emptyPart = (): FarMeshPart => ({
  positions: new Float32Array(),
  normals: new Float32Array(),
  expansions: new Int8Array(),
  surfaces: new Float32Array(),
  featureIdParts: new Uint16Array(),
  indices: new Uint32Array(),
});
function emptyResult(request: FarGenerationRequest): FarGenerationResult {
  const statistics = {
    densityCalls: 0,
    columns: 0,
    runs: 0,
    quads: 0,
    skirtQuads: 0,
    typedArrayBytes: 0,
  };
  return {
    ...request,
    runs: {
      ...request,
      offsets: new Uint32Array(34 * 34 + 1),
      words: new Uint32Array(),
      statistics,
    },
    mesh: {
      parts: Array.from({ length: 5 }, emptyPart),
      skirts: Array.from({ length: 4 }, () =>
        Array.from({ length: 5 }, emptyPart),
      ),
      quads: 0,
      statistics,
    },
  };
}

describe("far runtime review recovery witness (real store and selection)", () => {
  it("clears a historical failure after the edited target revision is prepared", async () => {
    const originalFailure = new Error("one failed tile revision");
    let failed: FarGenerationRequest | null = null;
    let editListener: ((edit: VoxelEdit) => void) | undefined;
    const near = {
      world,
      edits: new Map(),
      context: {
        conservativeBounds() {
          throw new Error("Uncertified fixture must use full-height bounds");
        },
      },
      createFarScheduler: () => ({
        request: async (request: FarGenerationRequest) => {
          if (request.address.lod === 2 && failed === null) {
            failed = request;
            throw originalFailure;
          }
          return emptyResult(request);
        },
        cancel() {},
        dispose() {},
      }),
      subscribeEdits: (listener: (edit: VoxelEdit) => void) => {
        editListener = listener;
        return () => {
          editListener = undefined;
        };
      },
    } as unknown as ChunkStore;
    const far = new FarWorld(near, "surface", {
      // Empty geometry isolates the real readiness/error state machine; the
      // explicit preparation callback is a test double, not GPU evidence.
      materials: [null, null, null, null, null] as never,
      prepareGpu() {},
    });
    const view = {
      position: { x: 0, y: 150, z: 400 },
      target: { x: 0, y: 0, z: 0 },
      fov: 40,
      aspect: 1,
      pixelHeight: 64,
      reach: 512,
    };
    try {
      await far.select(view, true, true);
      far.drain(Infinity);
      expect(far.error).toBe(originalFailure);
      expect(far.ready).toBe(false);
      const failedRequest = failed as FarGenerationRequest | null;
      if (!failedRequest || !editListener)
        throw new Error("Fixture did not fail a selected target tile");
      const width = 32 * 2 ** failedRequest.address.lod;
      editListener({
        x: failedRequest.address.tx * width + 1,
        y: 0,
        z: failedRequest.address.tz * width + 1,
        block: 1,
      });
      await far.select(view, true, true);
      far.drain(Infinity);
      expect(far.store.status.failed).toBe(0);
      expect(far.ready).toBe(true);
      // Current source reaches this assertion with a fully prepared target,
      // but still throws the error from the superseded revision.
      expect(() => far.assertPrepared()).not.toThrow();
      expect(far.error).toBeNull();
    } finally {
      far.dispose();
    }
  });
});
