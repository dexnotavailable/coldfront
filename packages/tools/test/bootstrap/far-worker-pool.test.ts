import { describe, expect, it } from "vitest";
import type { WorldSession } from "../../../client/src/contracts/game-ui.js";
import type { FarGenerationRequest } from "../../../client/src/engine/far-terrain-store.js";
import { FarWorkerScheduler } from "../../../client/src/engine/far-worker-scheduler.js";
import { TerrainWorkers } from "../../../client/src/engine/worker-pool.js";
import type {
  ChunkResult,
  FarTileResult,
  WorkerRequest,
  WorkerResponse,
} from "../../../client/src/engine/worker-protocol.js";
import type { WorldPlanData } from "../../../shared/src/world/types.js";
import { FarCapacityError } from "../../../shared/src/worldgen/far/types.js";

type Task = Extract<WorkerRequest, { type: "chunk" | "far" }>;
type FarTask = Extract<Task, { type: "far" }>;
const world: WorldSession = {
  id: 7,
  identity: { kind: "test", seed: 1, generation: "4:fixture" },
};
function request(
  id: number,
  overrides: Partial<FarGenerationRequest> = {},
): FarGenerationRequest {
  return {
    world,
    id,
    address: { tx: 0, tz: 0, lod: 2 },
    layer: "surface",
    revision: 0,
    priority: 0,
    postcard: false,
    ...overrides,
  };
}
const statistics = {
  densityCalls: 0,
  columns: 0,
  runs: 0,
  quads: 0,
  skirtQuads: 0,
  typedArrayBytes: 0,
};
function farResult(task: FarTask): FarTileResult {
  return {
    ...task,
    runs: {
      address: task.address,
      layer: task.layer,
      revision: task.revision,
      offsets: new Uint32Array(1157),
      words: new Uint32Array(),
      statistics,
    },
    mesh: { parts: [], skirts: [], quads: 0, statistics },
    timings: { generate: 0, mesh: 0 },
    cacheBytes: 17,
    farCacheStats: { editCount: 0, retainedTiles: 0, typedArrayBytes: 0 },
  };
}
function chunkResult(task: Extract<Task, { type: "chunk" }>): ChunkResult {
  return {
    ...task,
    blocks: new Uint16Array([task.revision]),
    light: new Uint16Array(),
    mesh: {
      parts: [],
      quads: 0,
      skirts: {
        positions: new Float32Array(),
        normals: new Int8Array(),
        expansions: new Int8Array(),
        packedPositions: new Float32Array(),
        surfaces: new Float32Array(),
        featureIdParts: new Uint16Array(),
        indices: new Uint32Array(),
      },
    },
    regionColor: [0, 0, 0],
    timings: { generate: 0, light: 0, mesh: 0 },
    cacheBytes: 13,
  };
}
class FakeWorker {
  sent: WorkerRequest[] = [];
  current: Task | null = null;
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;
  throwTasks = false;
  throwEdits = false;
  constructor(private readonly dispatched: Task[]) {}
  postMessage(message: WorkerRequest) {
    if (this.throwEdits && message.type === "edit")
      throw new Error("edit transport failed");
    if (message.type === "chunk" || message.type === "far") {
      if (this.throwTasks) throw new Error("task transport failed");
      expect(this.current).toBeNull();
      this.current = structuredClone(message);
      this.dispatched.push(this.current);
    }
    this.sent.push(structuredClone(message));
  }
  reply(message: WorkerResponse) {
    this.onmessage?.({ data: message } as MessageEvent<WorkerResponse>);
  }
  complete(response?: WorkerResponse) {
    const task = this.current;
    if (!task) throw new Error("No running task");
    this.current = null;
    this.reply(
      response ?? (task.type === "far" ? farResult(task) : chunkResult(task)),
    );
  }
  terminate() {
    this.terminated = true;
  }
}
function harness(count = 1, ready = true) {
  const workers: FakeWorker[] = [],
    dispatched: Task[] = [];
  const pool = new TerrainWorkers(world, null, [], {
    concurrency: count + 1,
    shared: false,
    factory: () => {
      const worker = new FakeWorker(dispatched);
      workers.push(worker);
      return worker as unknown as Worker;
    },
  });
  if (ready)
    for (const worker of workers) worker.reply({ type: "ready", world });
  const scheduler = new FarWorkerScheduler(pool, "surface");
  const finish = () => {
    while (pool.queued)
      for (const worker of workers) if (worker.current) worker.complete();
  };
  return { pool, scheduler, workers, dispatched, finish };
}
function currentFar(worker: FakeWorker): FarTask {
  if (worker.current?.type !== "far") throw new Error("Expected far task");
  return worker.current;
}

describe("shared near/far worker transport", () => {
  it("keeps readiness, mixed priority and FIFO in one queue and remaps store IDs", async () => {
    const h = harness(1, false),
      worker = h.workers[0] as FakeWorker;
    const near = h.pool.request({ cx: 0, cy: 0, cz: 0 }, 11, 9, () => {});
    const far = h.scheduler.request(request(44, { priority: 1 }));
    const tied = h.pool.request({ cx: 1, cy: 1, cz: 0 }, 12, 1, () => {});
    expect(h.dispatched).toHaveLength(0);
    worker.reply({ type: "ready", world: { ...world, id: 6 } });
    expect(h.dispatched).toHaveLength(0);
    worker.reply({ type: "ready", world });
    h.finish();
    expect(h.dispatched.map((task) => [task.type, task.id])).toEqual([
      ["far", 2],
      ["chunk", 3],
      ["chunk", 1],
    ]);
    expect((await far).id).toBe(44);
    expect((await near).blocks[0]).toBe(11);
    expect((await tied).blocks[0]).toBe(12);
    expect(h.pool.queued).toBe(0);
    h.pool.dispose();
  });
  it("shares the six-worker cap and lets idle lanes borrow both task kinds", async () => {
    const h = harness(99);
    expect(h.workers).toHaveLength(6);
    const pending = Array.from({ length: 18 }, (_, i) =>
      i % 2
        ? h.scheduler.request(request(i, { priority: i }))
        : h.pool.request({ cx: 0, cy: i, cz: 0 }, i, i, () => {}),
    );
    expect(h.workers.filter((worker) => worker.current)).toHaveLength(1);
    h.workers[0]?.complete();
    expect(h.workers.filter((worker) => worker.current)).toHaveLength(6);
    h.finish();
    await Promise.all(pending);
    expect(new Set(h.dispatched.map((task) => task.id)).size).toBe(18);
    expect(h.pool.memoryBytes).toBeGreaterThan(0);
    h.pool.dispose();
    expect(h.pool.memoryBytes).toBe(0);
  });
  it.each([false, true])(
    "honors ordinary/urgent mixed work before postcard locality (urgent=%s)",
    async (urgent) => {
      const h = harness(),
        worker = h.workers[0] as FakeWorker;
      const jobs = [
        h.scheduler.request(request(1, { postcard: true })),
        h.scheduler.request(
          request(2, {
            address: { tx: 2, tz: 0, lod: 2 },
            priority: 1,
            postcard: true,
          }),
        ),
        h.scheduler.request(
          request(3, {
            address: { tx: 1, tz: 0, lod: 2 },
            priority: 2,
            postcard: true,
          }),
        ),
        h.pool.request(
          { cx: 0, cy: 0, cz: 0 },
          0,
          urgent ? -1 : 3,
          () => {},
          false,
        ),
      ];
      expect(h.dispatched).toHaveLength(1);
      expect(worker.current?.id).toBe(1);
      h.finish();
      expect(h.dispatched.map((task) => task.id)).toEqual(
        urgent ? [1, 4, 2, 3] : [1, 2, 3, 4],
      );
      await Promise.all(jobs);
      h.pool.dispose();
    },
  );
  it("batches at most four far postcard tiles, with layer and LOD boundaries", async () => {
    const h = harness();
    const underground = new FarWorkerScheduler(h.pool, "upper_deep");
    const jobs = [
      h.scheduler.request(request(1, { postcard: true })),
      h.scheduler.request(
        request(2, {
          address: { tx: 2, tz: 0, lod: 2 },
          priority: 1,
          postcard: true,
        }),
      ),
      h.scheduler.request(
        request(3, {
          address: { tx: 1, tz: 0, lod: 2 },
          priority: 2,
          postcard: true,
        }),
      ),
      underground.request(
        request(1, { layer: "upper_deep", priority: 3, postcard: true }),
      ),
      h.scheduler.request(
        request(4, {
          address: { tx: 0, tz: 1, lod: 2 },
          priority: 4,
          postcard: true,
        }),
      ),
      h.scheduler.request(
        request(5, {
          address: { tx: 1, tz: 1, lod: 2 },
          priority: 5,
          postcard: true,
        }),
      ),
      h.scheduler.request(request(6, { priority: 6, postcard: true })),
      h.scheduler.request(
        request(7, {
          address: { tx: 0, tz: 0, lod: 3 },
          priority: 7,
          postcard: true,
        }),
      ),
    ];
    h.finish();
    expect(h.dispatched.map((task) => task.id)).toEqual([
      1, 3, 5, 6, 2, 4, 7, 8,
    ]);
    await Promise.all(jobs);
    h.pool.dispose();
  });
  it("settles queued and executing cancellation without reusing a busy worker", async () => {
    const h = harness(),
      worker = h.workers[0] as FakeWorker;
    const active = h.scheduler.request(request(1));
    const queued = h.scheduler.request(request(2));
    const settled = Promise.allSettled([active, queued]);
    const old = currentFar(worker);
    h.scheduler.cancel(2);
    h.scheduler.cancel(1);
    expect((await settled).map((entry) => entry.status)).toEqual([
      "rejected",
      "rejected",
    ]);
    expect(h.pool.queued).toBe(1);
    expect(worker.terminated).toBe(false);
    const replacement = h.scheduler.request(request(1, { revision: 1 }));
    expect(worker.current).toBe(old);
    worker.complete();
    expect(currentFar(worker).id).toBe(3);
    worker.reply(farResult(old));
    expect(currentFar(worker).id).toBe(3);
    worker.complete();
    expect(await replacement).toMatchObject({ id: 1, revision: 1 });
    expect(h.dispatched.map((task) => task.id)).toEqual([1, 3]);
    h.pool.dispose();
  });
  it("keeps reused local IDs isolated between stores and layers through disposal", async () => {
    const h = harness(),
      worker = h.workers[0] as FakeWorker;
    const nextStore = new FarWorkerScheduler(h.pool, "surface");
    const otherLayer = new FarWorkerScheduler(h.pool, "upper_deep");
    const old = h.scheduler.request(request(1));
    const rejected = expect(old).rejects.toMatchObject({ name: "AbortError" });
    const next = nextStore.request(request(1, { revision: 4 }));
    const deep = otherLayer.request(request(1, { layer: "upper_deep" }));
    h.scheduler.dispose();
    await rejected;
    h.finish();
    expect(await next).toMatchObject({ id: 1, revision: 4, layer: "surface" });
    expect(await deep).toMatchObject({ id: 1, layer: "upper_deep" });
    expect(worker.terminated).toBe(false);
    await expect(h.scheduler.request(request(2))).rejects.toThrow("disposed");
    h.pool.dispose();
  });
  it("cancels acceptance between worker delivery and promise continuation", async () => {
    const h = harness();
    const pending = h.scheduler.request(request(1));
    const rejected = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    h.workers[0]?.complete();
    h.scheduler.cancel(1);
    await rejected;
    h.pool.dispose();
  });
  it.each(["world", "identity", "layer", "duplicate"] as const)(
    "rejects %s adapter namespace violations before dispatch",
    async (kind) => {
      const h = harness();
      const first = h.scheduler.request(request(1));
      const bad =
        kind === "world"
          ? request(2, { world: { ...world, id: 8 } })
          : kind === "identity"
            ? request(2, {
                world: { ...world, identity: { ...world.identity, seed: 2 } },
              })
            : kind === "layer"
              ? request(2, { layer: "upper_deep" })
              : request(1);
      await expect(h.scheduler.request(bad)).rejects.toThrow();
      expect(h.dispatched).toHaveLength(1);
      h.finish();
      await first;
      h.pool.dispose();
    },
  );
  it.each(["revision", "address", "layer", "runs"] as const)(
    "rejects a matching-ID far reply with the wrong %s",
    async (field) => {
      const h = harness(),
        worker = h.workers[0] as FakeWorker;
      const pending = h.scheduler.request(request(1));
      const rejected = expect(pending).rejects.toThrow("identity mismatch");
      const good = farResult(currentFar(worker));
      const bad =
        field === "revision"
          ? { ...good, revision: 9 }
          : field === "address"
            ? { ...good, address: { ...good.address, tx: 1 } }
            : field === "layer"
              ? { ...good, layer: "upper_deep" as const }
              : { ...good, runs: { ...good.runs, revision: 9 } };
      worker.reply({ ...good, world: { ...world, id: 6 } });
      expect(h.pool.queued).toBe(1);
      worker.complete(bad);
      await rejected;
      expect(worker.terminated).toBe(false);
      h.pool.dispose();
    },
  );
  it("preserves capacity details and continues subsequent near/far work", async () => {
    const h = harness(),
      worker = h.workers[0] as FakeWorker;
    const pending = h.scheduler.request(request(1));
    const outcome = pending.catch((error: unknown) => error);
    const task = currentFar(worker);
    const later = h.pool.request({ cx: 0, cy: 0, cz: 0 }, 3, 0, () => {});
    worker.complete({
      type: "error",
      world,
      id: task.id,
      message: "capacity",
      far: task,
      capacity: { capacity: "runs", limit: 15, statistics },
    });
    const error = await outcome;
    expect(error).toBeInstanceOf(FarCapacityError);
    expect(error).toMatchObject({ capacity: "runs", limit: 15, statistics });
    h.finish();
    await later;
    expect(worker.terminated).toBe(false);
    h.pool.dispose();
  });
  it.each(["dispose", "error", "decode", "init", "send", "edit"] as const)(
    "settles both task kinds on fatal %s failures",
    async (kind) => {
      const h = harness(1, kind !== "init" && kind !== "send");
      const worker = h.workers[0] as FakeWorker;
      const far = h.scheduler.request(request(1));
      const near = h.pool.request({ cx: 0, cy: 0, cz: 0 }, 0, 0, () => {});
      const settled = Promise.allSettled([far, near]);
      if (kind === "dispose") h.pool.dispose();
      else if (kind === "error")
        worker.onerror?.({ message: "worker died" } as ErrorEvent);
      else if (kind === "decode") worker.onmessageerror?.();
      else if (kind === "init")
        worker.reply({ type: "error", world, id: -1, message: "bad init" });
      else if (kind === "send") {
        worker.throwTasks = true;
        worker.reply({ type: "ready", world });
      } else {
        worker.throwEdits = true;
        h.pool.edit({ x: 0, y: 0, z: 0, block: 0 });
      }
      expect(
        (await settled).every((entry) => entry.status === "rejected"),
      ).toBe(true);
      expect(h.pool.queued).toBe(0);
      expect(worker.terminated).toBe(true);
      await expect(h.scheduler.request(request(2))).rejects.toThrow();
      h.pool.dispose();
    },
  );
  it.each([false, true])(
    "keeps plan ownership intact when distributing shared=%s and dispatching far work",
    async (shared) => {
      const source = { values: new Float64Array([1, 2, 3]) };
      const main = {
        ...world,
        identity: { ...world.identity, kind: "main" as const },
      };
      const workers: FakeWorker[] = [];
      const pool = new TerrainWorkers(
        main,
        source as unknown as WorldPlanData,
        [],
        {
          concurrency: 3,
          shared,
          factory: () => {
            const worker = new FakeWorker([]);
            workers.push(worker);
            return worker as unknown as Worker;
          },
        },
      );
      for (const worker of workers)
        worker.reply({ type: "ready", world: main });
      const scheduler = new FarWorkerScheduler(pool, "surface");
      const pending = scheduler.request(request(1, { world: main }));
      const active = workers.find((worker) => worker.current) as FakeWorker;
      active.complete();
      await pending;
      expect(source.values).toEqual(new Float64Array([1, 2, 3]));
      expect(source.values.byteLength).toBe(24);
      expect(pool.memoryBytes).toBe((shared ? 24 : 48) + 17);
      pool.dispose();
    },
  );
});
