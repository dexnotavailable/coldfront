import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorldSession } from "../../../client/src/contracts/game-ui.js";
import type {
  Address,
  ChunkResult,
} from "../../../client/src/engine/worker-protocol.js";
import { Block } from "../../../shared/src/blocks/registry.js";
import { meshChunk } from "../../../shared/src/meshing/greedy.js";
import { HALO_VOLUME } from "../../../shared/src/world/constants.js";
import { haloIndex } from "../../../shared/src/world/coordinates.js";
import type { WorldContext } from "../../../shared/src/world/types.js";
import { createWorldContext } from "../../../shared/src/world/world-context.js";
import {
  createVoxelSample,
  sampleTestVoxel,
} from "../../../shared/src/worldgen/test-world.js";

const fixture = vi.hoisted(() => ({
  jobs: [] as Address[],
  fail: false,
  hold: false,
  releases: [] as (() => void)[],
  staleWorld: false,
}));
vi.mock("../../../client/src/engine/worker-pool.js", () => ({
  TerrainWorkers: class {
    ready = Promise.resolve();
    queued = 0;
    memoryBytes = 0;
    constructor(readonly world: WorldSession) {}
    async request(address: Address, revision: number) {
      fixture.jobs.push(address);
      if (fixture.fail) throw new Error("worker generation failure");
      if (fixture.hold)
        await new Promise<void>((resolve) => fixture.releases.push(resolve));
      return {
        type: "chunk",
        world: fixture.staleWorld
          ? { ...this.world, id: this.world.id - 1 }
          : this.world,
        id: fixture.jobs.length,
        address,
        revision,
        blocks: new Uint16Array(32768),
        light: new Uint16Array(32768),
        timings: { generate: 0, light: 0, mesh: 0 },
      } as ChunkResult;
    }
    edit() {}
    dispose() {}
  },
}));

import {
  ChunkStore,
  planChunkView,
} from "../../../client/src/engine/chunk-store.js";

const world: WorldSession = {
  id: 1,
  identity: { kind: "test", seed: 1, generation: "1:hash" },
};
beforeEach(() => {
  fixture.jobs.length = 0;
  fixture.fail = false;
  fixture.hold = false;
  fixture.staleWorld = false;
  fixture.releases.length = 0;
});
describe("conservative streaming and real mesh readiness", () => {
  it("retains only valid uploaded destination overlap and requests missing chunks once with unchanged output", async () => {
    const context = {
      conservativeBounds: (_bounds: unknown, out: object) =>
        Object.assign(out, {
          minSurfaceY: 0,
          maxSurfaceY: 0,
          maxSolidY: 0,
          maxFluidY: -Infinity,
        }),
    } as unknown as WorldContext;
    const store = new ChunkStore(world, context, null, []),
      pool = store.workers;
    const first = store.planView(0.5, 1.62, 0.5, 32);
    expect(fixture.jobs).toHaveLength(0); // Planning does not create work.
    await store.requestPlannedView(first);
    for (const chunk of store.chunks.values()) chunk.state = "visible";
    store.uploads.length = 0;
    const original = new Map(store.chunks);
    const next = store.planView(32.5, 1.62, 0.5, 32),
      key = (a: Address) => `${a.cx},${a.cy},${a.cz}`;
    const retained = next.addresses.filter((a) => store.hasView([a], true));
    const keep = new Set(retained.map(key));
    expect(retained.length).toBeGreaterThan(0);
    expect(retained.length).toBeLessThan(next.addresses.length);
    const removed = store.retain(retained);
    expect(new Set(removed)).toEqual(
      new Set(first.addresses.map(key).filter((k) => !keep.has(k))),
    );
    const before = fixture.jobs.length;
    await store.requestPlannedView(next);
    expect(fixture.jobs.slice(before)).toEqual(
      next.addresses.filter((a) => !keep.has(key(a))),
    );
    expect(store.chunks.size).toBe(next.addresses.length);
    expect(store.workers).toBe(pool);
    for (const address of retained) {
      expect(store.chunks.get(key(address))).toBe(original.get(key(address)));
      expect(store.chunks.get(key(address))?.state).toBe("visible");
    }
    expect(store.hasView(next.addresses, true)).toBe(false);
    expect(store.uploads.map((r) => key(r.address))).toEqual(
      next.addresses.filter((a) => !keep.has(key(a))).map(key),
    );
    for (const chunk of store.chunks.values()) chunk.state = "visible";
    store.uploads.length = 0;
    expect(store.hasView(next.addresses, true)).toBe(true);
    const after = fixture.jobs.length;
    await store.requestPlannedView(next);
    expect(fixture.jobs).toHaveLength(after); // Identical view needs no new work.
    const cold = new ChunkStore(world, context, null, []);
    await cold.requestPlannedView(cold.planView(32.5, 1.62, 0.5, 32));
    for (const address of next.addresses)
      expect(store.chunks.get(key(address))?.result?.blocks).toEqual(
        cold.chunks.get(key(address))?.result?.blocks,
      );
    store.dispose();
    cold.dispose();
  });
  it("fails planning before eviction and preserves priority/bounds while dispatching that single plan", async () => {
    const bounds = vi.fn((_bounds: unknown, out: object) =>
      Object.assign(out, {
        minSurfaceY: 0,
        maxSurfaceY: 0,
        maxSolidY: 40,
        maxFluidY: -Infinity,
      }),
    );
    const context = { conservativeBounds: bounds } as unknown as WorldContext;
    const store = new ChunkStore(world, context, null, []);
    await store.request({ cx: 0, cy: 0, cz: 0 });
    const before = new Map(store.chunks);
    expect(() => store.planView(0, 0, 0, 601)).toThrow("frame");
    expect(store.chunks).toEqual(before);
    const plan = store.planView(32.5, 10, 0.5, 32);
    const count = bounds.mock.calls.length;
    expect(plan.jobs).toEqual(planChunkView(context, [], 32.5, 10, 0.5, 32));
    const afterPlanning = bounds.mock.calls.length;
    await store.requestPlannedView(plan);
    expect(bounds.mock.calls.length).toBe(afterPlanning);
    expect(afterPlanning).toBe(count * 2);
    const jobs = fixture.jobs.length;
    await expect(
      store.requestPlannedView({
        ...plan,
        world: {
          ...world,
          identity: { ...world.identity, generation: "other" },
        },
      }),
    ).rejects.toThrow("another world");
    expect(fixture.jobs).toHaveLength(jobs);
    store.dispose();
  });
  it.each([
    "revision",
    "session",
    "generation",
    "address",
    "not-uploaded",
  ] as const)(
    "never qualifies %s cached data as uploaded overlap",
    async (kind) => {
      const store = new ChunkStore(world, {} as WorldContext, null, []),
        address = { cx: 0, cy: 0, cz: 0 };
      await store.request(address);
      const chunk = store.chunks.get("0,0,0");
      if (!chunk?.result) throw new Error("Missing result");
      chunk.state = "visible";
      if (kind === "revision") chunk.revision++;
      if (kind === "session")
        chunk.result = { ...chunk.result, world: { ...world, id: 2 } };
      if (kind === "generation")
        chunk.result = {
          ...chunk.result,
          world: {
            ...world,
            identity: { ...world.identity, generation: "other" },
          },
        };
      if (kind === "address")
        chunk.result = { ...chunk.result, address: { cx: 1, cy: 0, cz: 0 } };
      if (kind === "not-uploaded") chunk.state = "meshing";
      expect(store.hasView([address], true)).toBe(false);
      expect(store.retain([])).toEqual(["0,0,0"]);
      expect(store.uploads).toEqual([]); // No stale queue can resurrect eviction.
      const before = fixture.jobs.length;
      await store.request(address);
      expect(fixture.jobs).toHaveLength(before + 1);
      expect(store.hasView([address])).toBe(true);
      expect(store.hasView([address], true)).toBe(false);
      store.dispose();
    },
  );
  it("keeps retained results but rejects a destination with failed missing work", async () => {
    const context = {
      conservativeBounds: (_bounds: unknown, out: object) =>
        Object.assign(out, {
          minSurfaceY: 0,
          maxSurfaceY: 0,
          maxSolidY: 0,
          maxFluidY: -Infinity,
        }),
    } as unknown as WorldContext;
    const store = new ChunkStore(world, context, null, []),
      first = store.planView(0.5, 1.62, 0.5, 32);
    await store.requestPlannedView(first);
    for (const chunk of store.chunks.values()) chunk.state = "visible";
    store.uploads.length = 0;
    const next = store.planView(32.5, 1.62, 0.5, 32),
      retained = next.addresses.filter((a) => store.hasView([a], true));
    store.retain(retained);
    fixture.fail = true;
    await expect(store.requestPlannedView(next)).rejects.toThrow(
      "generation failure",
    );
    expect(store.hasView(retained, true)).toBe(true);
    expect(store.hasView(next.addresses)).toBe(false);
    expect(store.chunks.size).toBeLessThanOrEqual(next.addresses.length);
    store.dispose();
  });
  it("reports shared cache counts once and every retained prepared reference without guessed heap bytes", () => {
    const stats = {
      geometryCells: 3,
      geometryCellLimit: 256,
      placementCells: 5,
      placementCellLimit: 256,
      cachedInstances: 7,
      preparedInstanceReferences: 0,
    };
    const context = {
      featureCacheStats: () => ({ ...stats }),
      prepareArea: () => ({
        createColumn: () => new Float64Array(8),
        sampleColumn: (_x: number, _z: number, out: Float64Array) => out,
        sampleVoxel: (
          _x: number,
          _y: number,
          _z: number,
          out: { block: number },
        ) => {
          out.block = Block.Air;
          return out;
        },
        featureCacheStats: () => ({ ...stats, preparedInstanceReferences: 2 }),
      }),
    } as unknown as WorldContext;
    const store = new ChunkStore(world, context, null, []);
    for (let tile = 0; tile < 65; tile++) {
      store.get(tile * 32, 0, 0);
      store.get(tile * 32 + 1, 0, 0);
    }
    expect(store.featureCacheStats).toEqual({
      ...stats,
      preparedInstanceReferences: 130,
    });
    // The point columns still retain the first area after its map entry leaves
    // the 64-area LRU. Count its references; don't multiply the shared field.
    expect(store.memoryBytes).toBe(130 * 8 * 8);
    store.dispose();
  });
  it("covers caldera floors and tall crowns without filling the empty band up to a flying camera", async () => {
    const context = {
      conservativeBounds: (_bounds: unknown, out: object) =>
        Object.assign(out, {
          minSurfaceY: -78,
          maxSurfaceY: 52,
          maxSolidY: 198,
          maxFluidY: -32,
        }),
    } as unknown as WorldContext;
    const store = new ChunkStore(world, context, null, []);
    const requested = await store.requestView(0.5, 900, 0.5, 1);
    const levels = requested
      .filter((a) => a.cx === 0 && a.cz === 0)
      .map((a) => a.cy);
    for (const level of [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 27, 28, 29])
      expect(levels).toContain(level);
    expect(levels).not.toContain(15);
    expect(levels).toHaveLength(13);
    store.dispose();
  });
  it("invalidates the complete incoming-sky window and keeps the next lower chunk intact", async () => {
    const store = new ChunkStore(world, {} as WorldContext, null, []);
    const addresses = [0, 1, 2, 3, 4, 5].map((cy) => ({ cx: 0, cy, cz: 0 }));
    await Promise.all(addresses.map((address) => store.request(address)));
    store.edit({ x: 0, y: 128, z: 0, block: Block.Stone });
    await store.settled();
    expect(store.chunks.get("0,0,0")?.revision).toBe(0);
    for (const cy of [1, 2, 3, 4, 5])
      expect(store.chunks.get(`0,${cy},0`)?.revision).toBe(1);
    expect(store.hasView(addresses)).toBe(true);
    store.dispose();
  });
  it("rejects an in-flight old revision and refills the edited chunk before it is ready", async () => {
    fixture.hold = true;
    const store = new ChunkStore(world, {} as WorldContext, null, []),
      address = { cx: 0, cy: 0, cz: 0 };
    const first = store.request(address);
    store.edit({ x: 31, y: 0, z: 0, block: Block.Lava });
    fixture.releases.shift()?.();
    await first;
    expect(store.hasView([address])).toBe(false);
    expect(store.uploads).toHaveLength(0);
    expect(fixture.releases).toHaveLength(1);
    fixture.releases.shift()?.();
    await store.settled();
    expect(store.hasView([address])).toBe(true);
    expect(store.uploads).toHaveLength(1);
    expect(store.uploads[0]?.revision).toBe(1);
    store.dispose();
  });
  it("rejects another world session and counts the new mesh buffers exactly", async () => {
    const store = new ChunkStore(world, {} as WorldContext, null, []),
      address = { cx: 0, cy: 0, cz: 0 };
    fixture.staleWorld = true;
    await store.request(address);
    expect(store.hasView([address])).toBe(false);
    fixture.staleWorld = false;
    await store.request(address);
    const result = store.chunks.get("0,0,0")?.result;
    if (!result) throw new Error("Missing fresh result");
    const blocks = new Uint16Array(HALO_VOLUME),
      ids = new Uint32Array(HALO_VOLUME);
    blocks[haloIndex(0, 0, 0)] = Block.Lava;
    ids[haloIndex(0, 0, 0)] = 0xffffffff;
    const mesh = meshChunk(blocks, new Uint16Array(HALO_VOLUME), ids);
    const stored = store.chunks.get("0,0,0");
    if (!stored) throw new Error("Missing stored chunk");
    stored.result = { ...result, mesh };
    const expected =
      result.blocks.byteLength +
      result.light.byteLength +
      [...mesh.parts, mesh.skirts].reduce(
        (sum, p) =>
          sum +
          p.positions.byteLength +
          p.normals.byteLength +
          p.expansions.byteLength +
          p.packedPositions.byteLength +
          p.surfaces.byteLength +
          p.featureIdParts.byteLength +
          p.indices.byteLength,
        0,
      );
    expect(store.memoryBytes).toBe(expected);
    store.dispose();
  });
  it("keeps exact test-world point queries across negative chunk boundaries with prepared feature caches", () => {
    const context = createWorldContext({ kind: "test", seed: 1 });
    const store = new ChunkStore(world, context, null, []),
      out = createVoxelSample();
    for (const x of [-65, -33, -32, -1, 0, 31, 32, 63])
      for (const z of [-33, -1, 0, 32])
        for (const y of [-1, 5, 12])
          expect(store.get(x, y, z)).toBe(
            sampleTestVoxel(1, x + 0.5, y + 0.5, z + 0.5, out).block,
          );
    store.dispose();
  });
  it("requests the full rectangle height range including a narrow feature absent from corner/centre probes", async () => {
    const bounds = vi.fn((_rectangle, out) =>
      Object.assign(out, {
        minSurfaceY: 4,
        maxSurfaceY: 4,
        maxSolidY: 70,
        maxFluidY: -Infinity,
      }),
    );
    const point = vi.fn(() => {
      throw new Error("Sparse probing is not a conservative bound");
    });
    const context = {
      conservativeBounds: bounds,
      sampleColumn: point,
    } as unknown as WorldContext;
    const store = new ChunkStore(world, context, null, []);
    const requested = await store.requestView(-0.5, 6, -0.5, 1);
    expect(bounds).toHaveBeenCalled();
    expect(point).not.toHaveBeenCalled();
    expect(
      requested.some(
        (address) => address.cx === -1 && address.cz === -1 && address.cy === 2,
      ),
    ).toBe(true);
    expect(store.hasView(requested)).toBe(true);
    expect(store.hasView(requested, true)).toBe(false);
    for (const chunk of store.chunks.values()) chunk.state = "visible";
    expect(store.hasView(requested, true)).toBe(true);
    store.dispose();
  });
  it("clips edge chunk requests and propagates failed preparation rather than treating settled queues as success", async () => {
    const context = {
      conservativeBounds: (_rectangle: unknown, out: object) =>
        Object.assign(out, {
          minSurfaceY: 0,
          maxSurfaceY: 0,
          maxSolidY: 0,
          maxFluidY: -Infinity,
        }),
    } as unknown as WorldContext;
    const store = new ChunkStore(world, context, null, []);
    await store.requestView(-22527.5, 6, 22527.5, 32);
    expect(
      fixture.jobs.every(
        (a) => a.cx >= -704 && a.cx < 704 && a.cz >= -704 && a.cz < 704,
      ),
    ).toBe(true);
    await expect(store.request({ cx: -705, cy: 0, cz: 0 })).rejects.toThrow(
      "frame",
    );
    fixture.fail = true;
    await expect(store.requestView(1000, 6, 1000, 1)).rejects.toThrow(
      "generation failure",
    );
    expect(store.hasView([{ cx: 31, cy: 0, cz: 31 }])).toBe(false);
    store.dispose();
  });
});
