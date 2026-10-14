import { describe, expect, it, vi } from "vitest";
import type { WorldSession } from "../../../client/src/contracts/game-ui.js";
import { TerrainWorkers } from "../../../client/src/engine/worker-pool.js";
import type {
  WorkerRequest,
  WorkerResponse,
} from "../../../client/src/engine/worker-protocol.js";
import { meshTransfers } from "../../../client/src/engine/worker-protocol.js";
import { NavigationGate } from "../../../client/src/game/session.js";
import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import * as lighting from "../../../shared/src/lighting/flood.js";
import { meshChunk } from "../../../shared/src/meshing/greedy.js";
import {
  CHUNK_VOLUME,
  HALO_VOLUME,
} from "../../../shared/src/world/constants.js";
import {
  haloIndex,
  voxelIndex,
} from "../../../shared/src/world/coordinates.js";
import type { WorldContext } from "../../../shared/src/world/types.js";
import type { VoxelChunk } from "../../../shared/src/worldgen/chunk.js";

class FakeWorker {
  sent: WorkerRequest[] = [];
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;
  postMessage(message: WorkerRequest) {
    this.sent.push(structuredClone(message));
  }
  terminate() {
    this.terminated = true;
  }
  reply(message: WorkerResponse) {
    this.onmessage?.({ data: message } as MessageEvent<WorkerResponse>);
  }
}
const world: WorldSession = {
  id: 7,
  identity: { kind: "test", seed: 1, generation: "1:hash" },
};
describe("world session boundaries", () => {
  it("transfers exact split feature attributes without detaching halo inputs", () => {
    const blocks = new Uint16Array(HALO_VOLUME),
      lights = new Uint16Array(HALO_VOLUME),
      ids = new Uint32Array(HALO_VOLUME);
    blocks[haloIndex(0, 0, 0)] = Block.Lava;
    ids[haloIndex(0, 0, 0)] = 0xfedcba99;
    const mesh = meshChunk(blocks, lights, ids);
    const transfer = meshTransfers(mesh);
    expect(new Set(transfer).size).toBe(transfer.length);
    expect(transfer).not.toContain(ids.buffer);
    const copy = structuredClone(mesh, { transfer });
    expect(mesh.parts[4]?.featureIdParts.byteLength).toBe(0);
    expect(copy.parts[4]?.featureIdParts.slice(0, 2)).toEqual(
      new Uint16Array([0xba99, 0xfedc]),
    );
    expect(ids.byteLength).toBe(HALO_VOLUME * 4);
    expect(blocks.byteLength).toBe(HALO_VOLUME * 2);
    expect(lights.byteLength).toBe(HALO_VOLUME * 2);
  });
  it("keeps cached border edits equivalent to fresh worker solves and owns every transferred buffer", async () => {
    // The real worker pipeline, with a cheap synthetic rock volume and one
    // sealed horizontal gallery. No world plan, terrain geometry or render.
    const chunks: VoxelChunk[] = [],
      volumes: lighting.LightVolume[] = [],
      messages: WorkerResponse[] = [];
    const blockAt = (x: number, y: number, z: number) => {
      if (y === 0 && z === 0 && x >= 28 && x <= 38)
        return x === 31 ? Block.Lava : x === 35 ? Block.EmberCrust : Block.Air;
      // Top-row source confirms skylight replacement preserves emission.
      return x === 2 && y === 63 && z === 2 ? Block.VentMouth : Block.Stone;
    };
    const area = {
      kind: "test",
      seed: 1,
      columns: {
        stride: 8,
        height: 2,
        gradientX: 3,
        gradientZ: 4,
        waterLevel: 6,
      },
      createColumn: () => new Float64Array(8),
      sampleColumn: (_x: number, _z: number, out: Float64Array) => out,
      sampleVoxel: (
        x: number,
        y: number,
        z: number,
        out: { block: number },
      ) => {
        out.block = blockAt(Math.floor(x), Math.floor(y), Math.floor(z));
        return out;
      },
      skyInput: (
        _x: number,
        _z: number,
        out: { highestFilterY: number; solidBelowY: number },
      ) => {
        out.highestFilterY = 80;
        out.solidBelowY = -20;
        return out;
      },
    };
    const stats = {
      geometryCells: 2,
      geometryCellLimit: 256,
      placementCells: 3,
      placementCellLimit: 256,
      cachedInstances: 4,
      preparedInstanceReferences: 0,
    };
    const context = {
      ...area,
      regions: [],
      prepareArea: () => area,
      featureCacheStats: () => ({ ...stats }),
    } as unknown as WorldContext;
    vi.doMock("../../../shared/src/world/world-context.js", () => ({
      createWorldContext: () => context,
    }));
    vi.doMock("../../../shared/src/lighting/flood.js", () => ({
      ...lighting,
      createLightVolume: (width: number, height: number, depth: number) => {
        const volume = lighting.createLightVolume(width, height, depth);
        volumes.push(volume);
        return volume;
      },
    }));
    vi.doMock("../../../shared/src/worldgen/main/chunk.js", () => ({
      generateWorldChunk: (
        _context: WorldContext,
        cx: number,
        cy: number,
        cz: number,
      ) => {
        const chunk: VoxelChunk = {
          seed: 1,
          version: 3,
          cx,
          cy,
          cz,
          spacing: 1,
          blocks: new Uint16Array(CHUNK_VOLUME),
          haloBlocks: new Uint16Array(HALO_VOLUME),
          density: new Float64Array(HALO_VOLUME),
          columns: new Float64Array(34 * 34 * 8),
          featureIds: new Uint32Array(HALO_VOLUME),
          featureT: new Float64Array(HALO_VOLUME),
        };
        for (let y = -1; y < 40; y++)
          for (let z = -1; z <= 32; z++)
            for (let x = -1; x <= 32; x++) {
              const h = haloIndex(x, y, z),
                id = blockAt(cx * 32 + x, cy * 32 + y, cz * 32 + z);
              chunk.haloBlocks[h] = id;
              if (id === Block.Lava) {
                (chunk.featureIds as Uint32Array)[h] = 0xfedcba99;
                (chunk.featureT as Float64Array)[h] = 0.875;
              }
              if (x >= 0 && x < 32 && y >= 0 && y < 32 && z >= 0 && z < 32)
                chunk.blocks[voxelIndex(x, y, z)] = id;
            }
        chunks.push(chunk);
        return chunk;
      },
    }));
    const worker = {
      onmessage: null as ((event: MessageEvent<WorkerRequest>) => void) | null,
      postMessage: (
        message: WorkerResponse,
        options?: { transfer: ArrayBuffer[] },
      ) => {
        messages.push(structuredClone(message, options));
      },
    };
    vi.stubGlobal("self", worker);
    try {
      await import("../../../client/src/engine/terrain-worker.js");
      const send = (message: WorkerRequest) =>
        worker.onmessage?.({ data: message } as MessageEvent<WorkerRequest>);
      send({ type: "init", world, plan: null, edits: [] });
      let serial = 0;
      const request = (cx: number, revision: number) => {
        send({
          type: "chunk",
          world,
          id: ++serial,
          address: { cx, cy: 0, cz: 0 },
          revision,
        });
        const response = messages.at(-1);
        if (response?.type !== "chunk")
          throw new Error(JSON.stringify(response));
        return response;
      };
      request(0, 0);
      const initial = request(1, 0);
      expect(initial.featureCacheStats).toEqual(stats);
      expect(initial.light[voxelIndex(0, 0, 0)]).toBe(0x0e61);
      expect(chunks).toHaveLength(2);
      const firstVolume = volumes[0];
      if (!firstVolume) throw new Error("Missing worker volume");
      expect(
        firstVolume.sources[lighting.lightIndex(firstVolume, 34, 95, 34)],
      ).toBe(0x0c41);
      const before = messages.length;
      send({
        type: "edit",
        world: { ...world, id: 6 },
        edit: { x: 31, y: 0, z: 0, block: Block.Air },
      });
      expect(messages).toHaveLength(before);
      expect(
        firstVolume.sources[lighting.lightIndex(firstVolume, 63, 32, 32)],
      ).toBe(0x0f72);
      const edit = { x: 31, y: 0, z: 0, block: Block.Air };
      send({ type: "edit", world, edit });
      const edited = [request(0, 1), request(1, 1)];
      expect(chunks).toHaveLength(2);
      expect(edited[1]?.light[voxelIndex(0, 0, 0)]).toBe(0x0500);
      for (const chunk of chunks) {
        const h = haloIndex(31 - chunk.cx * 32, 0, 0);
        expect(chunk.featureIds?.[h]).toBe(0);
        expect(chunk.featureT?.[h]).toBe(0);
        for (const value of [
          chunk.blocks,
          chunk.haloBlocks,
          chunk.columns,
          chunk.density,
          chunk.featureIds,
          chunk.featureT,
        ])
          expect(value?.byteLength).toBeGreaterThan(0);
      }
      const expectedBytes =
        2 *
          (96 * 96 * 96 * 7 +
            CHUNK_VOLUME * 2 +
            HALO_VOLUME * 22 +
            34 * 34 * 8 * 8) +
        12 * 32 * 32 * 8 * 8 +
        BLOCK_REGISTRY.length * 2;
      expect(edited[1]?.cacheBytes).toBe(
        expectedBytes +
          (edited[1]?.blockSampleCacheStats?.typedArrayBytes ?? 0),
      );
      send({ type: "init", world, plan: null, edits: [edit] });
      const fresh = [request(0, 1), request(1, 1)];
      for (let n = 0; n < fresh.length; n++) {
        expect(fresh[n]?.blocks).toEqual(edited[n]?.blocks);
        expect(fresh[n]?.light).toEqual(edited[n]?.light);
        expect(fresh[n]?.mesh).toEqual(edited[n]?.mesh);
      }
      const placed = { ...edit, block: Block.VentMouth };
      send({ type: "edit", world, edit: placed });
      const incremental = [request(0, 2), request(1, 2)];
      expect(incremental[1]?.light[voxelIndex(0, 0, 0)]).toBe(0x0b30);
      send({ type: "init", world, plan: null, edits: [placed] });
      for (let n = 0; n < 2; n++) {
        const generated = request(n, 2);
        expect(generated.blocks).toEqual(incremental[n]?.blocks);
        expect(generated.light).toEqual(incremental[n]?.light);
        expect(generated.mesh).toEqual(incremental[n]?.mesh);
      }
    } finally {
      vi.unstubAllGlobals();
      vi.doUnmock("../../../shared/src/world/world-context.js");
      vi.doUnmock("../../../shared/src/worldgen/main/chunk.js");
      vi.doUnmock("../../../shared/src/lighting/flood.js");
    }
  });
  it.each(["constructor", "postMessage"])(
    "cleans partial lanes after synchronous %s failure before a source pool is restored",
    async (fault) => {
      const workers: FakeWorker[] = [];
      let calls = 0;
      const factory = () => {
        const index = calls++;
        if (fault === "constructor" && index === 1)
          throw new Error("injected construction failure");
        const worker = new FakeWorker();
        workers.push(worker);
        if (fault === "postMessage" && index === 1)
          worker.postMessage = () => {
            throw new Error("injected construction failure");
          };
        return worker as unknown as Worker;
      };
      expect(
        () =>
          new TerrainWorkers(world, null, [], {
            concurrency: 7,
            shared: false,
            factory,
          }),
      ).toThrow("injected construction failure");
      await Promise.resolve();
      expect(workers.length).toBeGreaterThan(0);
      expect(workers.every((worker) => worker.terminated)).toBe(true);
      const restored = new TerrainWorkers(world, null, [], {
        concurrency: 7,
        shared: false,
        factory: () => {
          const worker = new FakeWorker();
          workers.push(worker);
          return worker as unknown as Worker;
        },
      });
      expect(workers.filter((worker) => !worker.terminated)).toHaveLength(6);
      restored.dispose();
      expect(workers.every((worker) => worker.terminated)).toBe(true);
    },
  );
  it("requires every ready acknowledgement, ignores stale envelopes and rejects queued jobs on init failure", async () => {
    const workers: FakeWorker[] = [];
    const pool = new TerrainWorkers(world, null, [], {
      concurrency: 3,
      shared: false,
      factory: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker as unknown as Worker;
      },
    });
    let ready = false;
    void pool.ready.then(
      () => {
        ready = true;
      },
      () => {},
    );
    const job = pool.request({ cx: 0, cy: 0, cz: 0 }, 0, 0, () => {});
    const rejected = expect(job).rejects.toThrow("bad plan");
    expect(workers[0]?.sent.map((message) => message.type)).toEqual(["init"]);
    workers[0]?.reply({ type: "ready", world: { ...world, id: 6 } });
    expect(workers[0]?.sent).toHaveLength(1);
    workers[0]?.reply({ type: "ready", world });
    await Promise.resolve();
    expect(ready).toBe(false);
    expect(workers[0]?.sent.at(-1)?.type).toBe("chunk");
    workers[1]?.reply({ type: "error", world, id: -1, message: "bad plan" });
    await expect(pool.ready).rejects.toThrow("bad plan");
    await rejected;
    expect(workers.every((worker) => worker.terminated)).toBe(true);
    await expect(
      pool.request({ cx: 2, cy: 0, cz: 0 }, 0, 0, () => {}),
    ).rejects.toThrow("bad plan");
  });
  it("prevents superseded, cancelled and old-world navigation commits without confusing snapshot revisions", async () => {
    const gate = new NavigationGate();
    const first = gate.begin(7);
    const second = gate.begin(7);
    expect(gate.current(first, 7)).toBe(false);
    expect(gate.current(second, 8)).toBe(false);
    gate.cancel(6);
    expect(gate.current(second, 7)).toBe(true);
    gate.finish(first);
    expect(gate.current(second, 7)).toBe(true);
    await Promise.resolve();
    gate.cancel(7);
    expect(gate.current(second, 7)).toBe(false);
    expect(gate.pending).toBe(false);
  });
});
