import { PerspectiveCamera } from "three";
import { describe, expect, it, vi } from "vitest";
import type { WorldSession } from "../../../client/src/contracts/game-ui.js";
import {
  type ChunkStore,
  drainChunkUploads,
  type StoredChunk,
} from "../../../client/src/engine/chunk-store.js";
import type {
  FarGenerationRequest,
  FarGenerationResult,
} from "../../../client/src/engine/far-terrain-store.js";
import {
  columnFitsNearDepth,
  DEFAULT_FAR_REACH,
  FarWorld,
  FRAME_UPLOAD_PARTS,
  renderOrigin,
} from "../../../client/src/engine/far-world.js";
import type {
  ChunkResult,
  VoxelEdit,
} from "../../../client/src/engine/worker-protocol.js";
import type { FarMeshPart } from "../../../shared/src/worldgen/far/types.js";

const world: WorldSession = {
  id: 7,
  identity: { kind: "test", seed: 1, generation: "far-runtime-fixture" },
};
const emptyPart = (): FarMeshPart => ({
  positions: new Float32Array(),
  normals: new Float32Array(),
  expansions: new Int8Array(),
  surfaces: new Float32Array(),
  featureIdParts: new Uint16Array(),
  indices: new Uint32Array(),
});
const stats = {
  densityCalls: 0,
  columns: 0,
  runs: 0,
  quads: 0,
  skirtQuads: 0,
  typedArrayBytes: 0,
};
function emptyResult(request: FarGenerationRequest): FarGenerationResult {
  return {
    ...request,
    runs: {
      ...request,
      offsets: new Uint32Array(34 * 34 + 1),
      words: new Uint32Array(),
      statistics: stats,
    },
    mesh: {
      parts: Array.from({ length: 5 }, emptyPart),
      skirts: Array.from({ length: 4 }, () =>
        Array.from({ length: 5 }, emptyPart),
      ),
      quads: 0,
      statistics: stats,
    },
  };
}
function farFixture(failure?: (request: FarGenerationRequest) => Error | null) {
  const requests: FarGenerationRequest[] = [];
  const cancel = vi.fn(),
    dispose = vi.fn(),
    unsubscribe = vi.fn(),
    prepared = vi.fn();
  let edited: ((edit: VoxelEdit) => void) | undefined;
  const scheduler = {
    request: async (request: FarGenerationRequest) => {
      requests.push(request);
      const error = failure?.(request);
      if (error) throw error;
      return emptyResult(request);
    },
    cancel,
    dispose,
  };
  const createFarScheduler = vi.fn(() => scheduler);
  const near = {
    world,
    edits: new Map(),
    context: {
      conservativeBounds() {
        throw new Error("Uncertified fixture must use full-height bounds");
      },
    },
    createFarScheduler,
    subscribeEdits: (listener: (edit: VoxelEdit) => void) => {
      edited = listener;
      return unsubscribe;
    },
  } as unknown as ChunkStore;
  // Empty tiles still cross this explicit CPU test double. This is not GPU proof.
  const far = new FarWorld(near, "surface", {
    materials: [null, null, null, null, null] as never,
    prepareGpu: prepared,
  });
  const view = {
    position: { x: 0, y: 150, z: 400 },
    target: { x: 0, y: 0, z: 0 },
    fov: 40,
    aspect: 1,
    pixelHeight: 64,
    reach: 512,
  };
  return {
    far,
    view,
    requests,
    prepared,
    createFarScheduler,
    dispose,
    unsubscribe,
    edit: (edit: VoxelEdit) => edited?.(edit),
  };
}

describe("far runtime readiness and lifecycle", () => {
  it("preserves a current ancestor failure even after target children are ready", async () => {
    const error = new Error("current coarse revision failed");
    let failed = false;
    const f = farFixture((request) => {
      if (failed || request.address.lod !== 6) return null;
      failed = true;
      return error;
    });
    try {
      await f.far.select(f.view, true, true);
      f.far.drain(Infinity);
      expect(failed).toBe(true);
      expect(f.far.ready).toBe(true);
      expect(f.far.store.status.failed).toBe(1);
      expect(f.far.error).toBe(error);
      expect(() => f.far.assertPrepared()).toThrow(error);
    } finally {
      f.far.dispose();
    }
  });
  it("ignores an unwanted historical failure without promoting an unprepared new target", async () => {
    const error = new Error("old target revision failed");
    let failed = false;
    const f = farFixture((request) => {
      if (failed || request.address.lod !== 2) return null;
      failed = true;
      return error;
    });
    try {
      await f.far.select(f.view, true, true);
      f.far.drain(Infinity);
      expect(f.far.error).toBe(error);
      await f.far.select(
        {
          ...f.view,
          position: { ...f.view.position, x: 8192 },
          target: { ...f.view.target, x: 8192 },
        },
        true,
        true,
      );
      expect(f.far.store.status.failed).toBe(1);
      expect(f.far.error).toBeNull();
      expect(f.far.ready).toBe(false);
      expect(() => f.far.assertPrepared()).toThrow(
        "Far target is not prepared",
      );
      f.far.drain(Infinity);
      expect(f.far.ready).toBe(true);
      expect(() => f.far.assertPrepared()).not.toThrow();
    } finally {
      f.far.dispose();
    }
  });
  it("uses the existing pool adapter once and requires actual preparation callback after generation", async () => {
    const f = farFixture();
    await f.far.select(f.view);
    expect(f.createFarScheduler).toHaveBeenCalledExactlyOnceWith("surface");
    expect(f.requests.length).toBeGreaterThan(0);
    expect(
      f.requests.every(
        (request) => request.world === world && request.layer === "surface",
      ),
    ).toBe(true);
    expect(f.far.ready).toBe(false);
    expect(f.prepared).not.toHaveBeenCalled();
    expect(f.far.drain(FRAME_UPLOAD_PARTS)).toBe(0);
    expect(f.prepared).toHaveBeenCalled();
    expect(f.far.ready).toBe(true);
    expect(f.far.telemetry.lod.reduce((sum, count) => sum + count, 0)).toBe(
      f.far.telemetry.visible.length,
    );
    f.far.dispose();
    expect(f.dispose).toHaveBeenCalledTimes(1);
    expect(f.unsubscribe).toHaveBeenCalledTimes(1);
  });
  it("only permits unbounded uploads after freezing a postcard selection", async () => {
    const f = farFixture();
    expect(() => f.far.drain(Infinity)).toThrow(/frozen postcard/);
    await f.far.select(f.view, true, false);
    expect(() => f.far.drain(Infinity)).toThrow(/frozen postcard/);
    await f.far.select(f.view, true, true);
    f.far.drain(Infinity);
    expect(f.far.ready).toBe(true);
    const count = f.requests.length;
    f.far.stream({ ...f.view, position: { x: 4096, y: 150, z: 400 } });
    expect(f.requests).toHaveLength(count);
    f.far.unfreeze();
    expect(() => f.far.drain(Infinity)).toThrow(/frozen postcard/);
    f.far.dispose();
  });
  it("keeps edits unready until the new revisions are prepared and committed", async () => {
    const f = farFixture();
    await f.far.select(f.view, true, true);
    f.far.drain(Infinity);
    expect(f.far.ready).toBe(true);
    const revision = Math.max(...f.requests.map((request) => request.revision));
    f.edit({ x: 0, y: 0, z: 0, block: 1 });
    expect(f.far.ready).toBe(false);
    await f.far.select(f.view, true, true);
    expect(f.requests.some((request) => request.revision > revision)).toBe(
      true,
    );
    expect(f.far.ready).toBe(false);
    f.far.drain(Infinity);
    expect(f.far.ready).toBe(true);
    f.far.dispose();
  });
  it("reprepares retained tiles after context loss before restoring readiness", async () => {
    const f = farFixture();
    await f.far.select(f.view);
    f.far.drain(FRAME_UPLOAD_PARTS);
    const count = f.prepared.mock.calls.length;
    f.far.contextLost();
    expect(f.far.ready).toBe(false);
    f.far.drain(FRAME_UPLOAD_PARTS);
    expect(f.prepared.mock.calls.length).toBeGreaterThan(count);
    expect(f.far.ready).toBe(true);
    f.far.dispose();
  });
  it("keeps source rollback suspended until explicitly resumed", async () => {
    const f = farFixture();
    await f.far.select(f.view);
    f.far.drain(FRAME_UPLOAD_PARTS);
    f.far.suspend();
    expect(f.far.ready).toBe(false);
    expect(f.far.drain(FRAME_UPLOAD_PARTS)).toBe(0);
    f.far.resume();
    expect(f.far.ready).toBe(true);
    f.far.dispose();
  });
});

describe("near/far frame boundaries", () => {
  it("keeps absolute coordinates while flooring negative render origins", () => {
    const position = { x: -0.001, y: 6123, z: -1024.001 };
    expect(renderOrigin(position)).toEqual({ x: -1024, y: 0, z: -2048 });
    expect(position).toEqual({ x: -0.001, y: 6123, z: -1024.001 });
    expect(DEFAULT_FAR_REACH).toBe(16_000);
  });
  it("does not mask far land with depth-clipped columns at Command altitude", () => {
    const camera = new PerspectiveCamera(40, 1, 0.2, 1600);
    const column = {
      minX: 0,
      maxX: 32,
      minY: 0,
      maxY: 32,
      minZ: 0,
      maxZ: 32,
      ready: true,
      drawn: true,
    };
    camera.position.set(16, 100, 16);
    camera.lookAt(16, 0, 16);
    camera.updateMatrixWorld();
    expect(columnFitsNearDepth(column, camera)).toBe(true);
    expect(columnFitsNearDepth({ ...column, minY: -1550 }, camera)).toBe(false);
    camera.position.set(16, 6000, 16);
    camera.lookAt(16, 0, 16);
    camera.updateMatrixWorld();
    expect(columnFitsNearDepth(column, camera)).toBe(false);
  });
  it("counts parts, preserves whole chunk replacement, and leaves the remainder for far", () => {
    function result(cx: number, parts: number, revision = 0): ChunkResult {
      return {
        world,
        revision,
        address: { cx, cy: 0, cz: 0 },
        mesh: {
          parts: Array.from({ length: 5 }, (_, index) => ({
            indices: new Uint32Array(index < parts ? 3 : 0),
          })),
        },
      } as unknown as ChunkResult;
    }
    const first = result(0, 4),
      second = result(1, 5);
    const chunks = new Map<string, StoredChunk>(
      [first, second].map((item) => [
        `${item.address.cx},0,0`,
        {
          address: item.address,
          result: item,
          revision: 0,
          state: "meshing",
          touched: 0,
        },
      ]),
    );
    const store = { world, chunks, uploads: [result(0, 5, -1), first, second] };
    const uploaded: ChunkResult[] = [];
    const spent = drainChunkUploads(store, FRAME_UPLOAD_PARTS, (item) =>
      uploaded.push(item),
    );
    expect(spent).toBe(4);
    expect(FRAME_UPLOAD_PARTS - spent).toBe(4);
    expect(uploaded).toEqual([first]);
    expect(store.uploads).toEqual([second]);
    expect(chunks.get("1,0,0")?.state).toBe("meshing");
    expect(
      drainChunkUploads(store, FRAME_UPLOAD_PARTS, (item) =>
        uploaded.push(item),
      ),
    ).toBe(5);
    expect(chunks.get("1,0,0")?.state).toBe("visible");
  });
});
