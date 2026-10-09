import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorldSession } from "../../../client/src/contracts/game-ui.js";
import type {
  Address,
  ChunkResult,
} from "../../../client/src/engine/worker-protocol.js";
import type { WorldContext } from "../../../shared/src/world/types.js";
import { createWorldContext } from "../../../shared/src/world/world-context.js";
import {
  createVoxelSample,
  sampleTestVoxel,
} from "../../../shared/src/worldgen/test-world.js";

const fixture = vi.hoisted(() => ({ jobs: [] as Address[], fail: false }));
vi.mock("../../../client/src/engine/worker-pool.js", () => ({
  TerrainWorkers: class {
    ready = Promise.resolve();
    queued = 0;
    memoryBytes = 0;
    constructor(readonly world: WorldSession) {}
    async request(address: Address, revision: number) {
      fixture.jobs.push(address);
      if (fixture.fail) throw new Error("worker generation failure");
      return {
        type: "chunk",
        world: this.world,
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

import { ChunkStore } from "../../../client/src/engine/chunk-store.js";

const world: WorldSession = {
  id: 1,
  identity: { kind: "test", seed: 1, generation: "1:hash" },
};
beforeEach(() => {
  fixture.jobs.length = 0;
  fixture.fail = false;
});
describe("conservative streaming and real mesh readiness", () => {
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
