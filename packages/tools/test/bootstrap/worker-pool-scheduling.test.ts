import { describe, expect, it } from "vitest";
import type { WorldSession } from "../../../client/src/contracts/game-ui.js";
import {
  TerrainWorkers,
  workerCount,
} from "../../../client/src/engine/worker-pool.js";
import type {
  Address,
  ChunkResult,
  WorkerRequest,
  WorkerResponse,
} from "../../../client/src/engine/worker-protocol.js";

type Request = Extract<WorkerRequest, { type: "chunk" }>;
const world: WorldSession = {
  id: 7,
  identity: { kind: "test", seed: 1, generation: "4:fixture" },
};
const emptyMesh = {
  positions: new Float32Array(),
  normals: new Int8Array(),
  expansions: new Int8Array(),
  packedPositions: new Float32Array(),
  surfaces: new Float32Array(),
  featureIdParts: new Uint16Array(),
  indices: new Uint32Array(),
};
function result(request: Request): ChunkResult {
  return {
    ...request,
    blocks: new Uint16Array([request.revision]),
    light: new Uint16Array(),
    mesh: { parts: [], skirts: emptyMesh, quads: 0 },
    regionColor: [0, 0, 0],
    timings: { generate: 0, light: 0, mesh: 0 },
    cacheBytes: 0,
  };
}
class FakeWorker {
  sent: WorkerRequest[] = [];
  current: Request | null = null;
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;
  constructor(private readonly dispatched: Request[]) {}
  postMessage(message: WorkerRequest) {
    this.sent.push(structuredClone(message));
    if (message.type === "chunk") {
      expect(this.current).toBeNull();
      this.current = message;
      this.dispatched.push(message);
    }
  }
  reply(message: WorkerResponse) {
    this.onmessage?.({ data: message } as MessageEvent<WorkerResponse>);
  }
  complete() {
    const request = this.current;
    if (!request) throw new Error("No dispatched request");
    this.current = null;
    this.reply(result(request));
    return request;
  }
  fail(message: string) {
    const request = this.current;
    if (!request) throw new Error("No dispatched request");
    this.current = null;
    this.reply({ type: "error", world, id: request.id, message });
  }
  terminate() {
    this.terminated = true;
  }
}
function harness(count: number, ready = true) {
  const workers: FakeWorker[] = [];
  const dispatched: Request[] = [];
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
  const owner = (address: Address) => {
    void pool.request(address, 0, 0, () => {});
    const index = workers.findIndex((worker) => worker.current !== null);
    if (index < 0) throw new Error("Ready pool did not dispatch");
    workers[index]?.complete();
    return index;
  };
  return { workers, pool, owner, dispatched };
}
function disk(cx: number, cz: number, radius: number): Address[] {
  const addresses: Address[] = [];
  for (let dz = -radius; dz <= radius; dz++)
    for (let dx = -radius; dx <= radius; dx++)
      if (dx * dx + dz * dz <= (radius + 0.4) ** 2)
        addresses.push({ cx: cx + dx, cy: 0, cz: cz + dz });
  return addresses;
}

describe("terrain worker locality and scheduling", () => {
  it.each([false, true])(
    "replays the measured24-key window order with postcard=%s",
    async (postcard) => {
      // Fixed source91 observed-worker6 windows; expected alternative comes from
      // the separately executed exact-buffer A/B, not this scheduler's algorithm.
      const rows = [
        [1, 177, 0, 169],
        [2, 176, 0, 169],
        [3, 177, 0, 168],
        [6, 176, 0, 168],
        [9, 177, 1, 169],
        [13, 176, 1, 169],
        [15, 177, 1, 168],
        [22, 176, 1, 168],
        [50, 177, 2, 169],
        [52, 176, 2, 169],
        [53, 177, 2, 168],
        [55, 177, 0, 172],
        [60, 176, 2, 168],
        [62, 176, 0, 172],
        [69, 177, -1, 172],
        [70, 177, 1, 172],
        [74, 176, -1, 172],
        [75, 176, 1, 172],
        [96, 177, 0, 173],
        [99, 176, 0, 173],
        [106, 177, -1, 173],
        [107, 177, 1, 173],
        [114, 176, -1, 173],
        [115, 176, 1, 173],
      ] as const;
      const { pool, workers, dispatched } = harness(1, false);
      const promises = rows.map(([revision, cx, cy, cz], priority) =>
        pool.request({ cx, cy, cz }, revision, priority, () => {}, postcard),
      );
      workers[0]?.reply({ type: "ready", world });
      while (pool.queued) workers[0]?.complete();
      expect(dispatched.map((row) => row.revision)).toEqual(
        postcard
          ? [
              1, 2, 3, 6, 9, 13, 15, 22, 50, 52, 53, 60, 55, 62, 96, 99, 69, 74,
              106, 114, 70, 75, 107, 115,
            ]
          : rows.map((row) => row[0]),
      );
      expect((await Promise.all(promises)).map((row) => row.blocks[0])).toEqual(
        rows.map((row) => row[0]),
      );
      pool.dispose();
    },
  );

  it("returns to the priority head after four and never waits for a complete group", async () => {
    const { pool, workers, dispatched } = harness(1);
    const a = { cx: -2, cy: 1, cz: -2 },
      b = { cx: 2, cy: 1, cz: 0 };
    const addresses = [
      a,
      b,
      { cx: -1, cy: 1, cz: -2 },
      { cx: -2, cy: 1, cz: -1 },
      { cx: -1, cy: 1, cz: -1 },
      a,
      { cx: -2, cy: 2, cz: -2 },
    ];
    const promises = addresses.map((address, i) =>
      pool.request(address, i, i, () => {}, true),
    );
    while (pool.queued) workers[0]?.complete();
    expect(dispatched.map((row) => row.id)).toEqual([1, 3, 4, 5, 2, 6, 7]);
    expect(await Promise.all(promises)).toHaveLength(7);
    const later = pool.request(a, 99, 0, () => {}, true);
    expect(workers[0]?.current?.revision).toBe(99);
    workers[0]?.complete();
    await later;
    pool.dispose();
  });

  it.each([false, true])(
    "preserves ordinary and urgent pending priority while postcard batch is active (urgent=%s)",
    async (urgent) => {
      const { pool, workers, dispatched } = harness(1);
      const a = { cx: 0, cy: 0, cz: 0 },
        b = { cx: 2, cy: 0, cz: 0 };
      const promises = [
        pool.request(a, 1, 0, () => {}, true),
        pool.request(b, 2, 1, () => {}, true),
        pool.request({ ...a, cx: 1 }, 3, 2, () => {}, true),
        pool.request({ ...b, cy: 1 }, 4, urgent ? -1 : 3, () => {}, false),
      ];
      expect(dispatched.map((row) => row.id)).toEqual([1]);
      while (pool.queued) workers[0]?.complete();
      expect(dispatched.map((row) => row.id)).toEqual(
        urgent ? [1, 4, 2, 3] : [1, 2, 3, 4],
      );
      await Promise.all(promises);
      pool.dispose();
    },
  );
  it("prefers one owner for every level and four neighboring columns, including negative cells, without an idle-tail steal", () => {
    for (let count = 1; count <= 6; count++) {
      const { pool, owner, workers } = harness(count);
      expect(workers).toHaveLength(count);
      for (const cx of [-704, -178, -2, 0, 2, 176, 702])
        for (const cz of [-704, -172, -2, 0, 2, 170, 702]) {
          const owners = new Set<number>();
          for (const dx of [0, 1])
            for (const dz of [0, 1])
              for (const cy of [-48, -1, 0, 1, 31])
                owners.add(owner({ cx: cx + dx, cy, cz: cz + dz }));
          expect(owners.size).toBe(1);
        }
      expect(pool.queued).toBe(0);
      pool.dispose();
    }
    expect([1, 2, 4, 7, 32].map(workerCount)).toEqual([1, 1, 3, 6, 6]);
  });

  it("uses every available worker for a small disk across all mapping phases without concentrating its queue", () => {
    for (let count = 1; count <= 6; count++) {
      const { pool, owner } = harness(count);
      // The mapping repeats within 2*count along either axis. Cover negative
      // and positive phases; each radius-2 disk has the same 21 columns.
      for (let x = -count; x < count; x++)
        for (let z = -count; z < count; z++) {
          const counts = Array<number>(count).fill(0);
          for (const address of disk(x, z, 2)) {
            const lane = owner(address);
            counts[lane] = (counts[lane] as number) + 1;
          }
          expect(counts.every((n) => n > 0)).toBe(true);
          expect(Math.max(...counts)).toBeLessThanOrEqual(
            Math.ceil(21 / count) + 2,
          );
        }
      pool.dispose();
    }
  });

  it("spreads ordinary view movement frontiers over several workers", () => {
    const { pool, owner } = harness(6);
    // Ordinary requestNear radii are 96..224m: r=3..7 chunks. Test the new
    // frontier after axial and diagonal movement, not only a full view.
    for (const radius of [3, 4, 5, 6, 7])
      for (let x = -6; x < 6; x++)
        for (let z = -6; z < 6; z++) {
          const old = new Set(disk(x, z, radius).map((a) => `${a.cx},${a.cz}`));
          for (const [dx, dz] of [
            [1, 0],
            [0, 1],
            [1, 1],
          ] as const) {
            const owners = new Set(
              disk(x + dx, z + dz, radius)
                .filter((a) => !old.has(`${a.cx},${a.cz}`))
                .map(owner),
            );
            expect(owners.size).toBeGreaterThanOrEqual(3);
          }
        }
    pool.dispose();
  });

  it("retains readiness, priority, equal-priority FIFO and nonpreemption within a shared cell", async () => {
    const { workers, pool, dispatched } = harness(6, false);
    const progress: string[] = [];
    const addresses = [
      { cx: -2, cy: 0, cz: -2 },
      { cx: -1, cy: 2, cz: -2 },
      { cx: -2, cy: -1, cz: -1 },
      { cx: -1, cy: 1, cz: -1 },
    ];
    const promises = addresses.map((address, i) =>
      pool.request(address, i + 11, [8, 1, 3, 3][i] as number, (stage) =>
        progress.push(stage),
      ),
    );
    expect(workers.every((worker) => worker.current === null)).toBe(true);
    workers[0]?.reply({ type: "ready", world: { ...world, id: 6 } });
    expect(workers.every((worker) => worker.current === null)).toBe(true);
    for (const worker of workers) worker.reply({ type: "ready", world });
    await pool.ready;
    const lane = workers.find((worker) => worker.current);
    if (!lane?.current) throw new Error("Expected one active cell");
    const first = lane.current;
    expect(first.id).toBe(2);
    const urgent = pool.request(addresses[0] as Address, 20, -1, () => {});
    expect(lane.current).toBe(first);
    lane.reply({ ...result(first), world: { ...world, id: 6 } });
    lane.reply({ ...result(first), id: 999 });
    expect(lane.current).toBe(first);
    lane.reply({ type: "progress", world, id: first.id, stage: "lighting" });
    expect(progress).toEqual(["lighting"]);
    lane.complete();
    // The owner takes its urgent job first; idle workers then borrow pending
    // heads by priority/id. All original job operands and promises survive.
    expect(dispatched.map((request) => request.id)).toEqual([2, 5, 3, 4, 1]);
    for (const worker of workers) if (worker.current) worker.complete();
    const responses = await Promise.all([...promises, urgent]);
    expect(responses.map((value) => value.revision)).toEqual([
      11, 12, 13, 14, 20,
    ]);
    expect(responses.slice(0, 4).map((value) => value.address)).toEqual(
      addresses,
    );
    expect(pool.queued).toBe(0);
    pool.dispose();
  });

  it.each([false, true])(
    "broadcasts edits and rejects both active and queued requests on disposal (postcard=%s)",
    async (postcard) => {
      const { pool, workers } = harness(6);
      const active = pool.request(
        { cx: 0, cy: 0, cz: 0 },
        1,
        0,
        () => {},
        postcard,
      );
      const queued = pool.request(
        { cx: 1, cy: 0, cz: 1 },
        1,
        0,
        () => {},
        postcard,
      );
      const settled = Promise.allSettled([active, queued]);
      const edit = { x: 31, y: 0, z: 31, block: 0 };
      pool.edit(edit);
      for (const worker of workers)
        expect(worker.sent.at(-1)).toEqual({ type: "edit", world, edit });
      expect(pool.queued).toBe(2);
      pool.dispose();
      expect(workers.every((worker) => worker.terminated)).toBe(true);
      expect(pool.queued).toBe(0);
      const results = await settled;
      expect(results.every((entry) => entry.status === "rejected")).toBe(true);
      await expect(
        pool.request({ cx: 2, cy: 0, cz: 2 }, 0, 0, () => {}),
      ).rejects.toThrow("Worker pool disposed");
    },
  );

  it.each([false, true])(
    "fills idle capacity only after a completion and all ready acknowledgements, then drains without duplicate or lost jobs (postcard=%s)",
    async (postcard) => {
      const { pool, workers, dispatched } = harness(6, false);
      const addresses = Array.from({ length: 24 }, (_, i) => ({
        cx: 0,
        cy: i - 12,
        cz: 0,
      }));
      const promises = addresses.map((address, i) =>
        pool.request(address, i + 1, i, () => {}, postcard),
      );
      workers[0]?.reply({ type: "ready", world });
      expect(dispatched.map((request) => request.id)).toEqual([1]);
      workers[0]?.complete();
      expect(dispatched.map((request) => request.id)).toEqual([1, 2]);
      for (const worker of workers.slice(1))
        worker.reply({ type: "ready", world });
      // Ready/enqueue do not fragment the initial same-column batch.
      expect(dispatched).toHaveLength(2);
      workers[0]?.complete();
      expect(workers.every((worker) => worker.current)).toBe(true);
      expect(dispatched.map((request) => request.id)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8,
      ]);
      while (pool.queued > 0)
        for (const worker of [...workers].reverse()) {
          if (!worker.current) continue;
          worker.complete();
          const active = workers.filter((lane) => lane.current).length;
          if (pool.queued > active) expect(active).toBe(workers.length);
        }
      const results = await Promise.all(promises);
      expect(dispatched).toHaveLength(addresses.length);
      expect(new Set(dispatched.map((request) => request.id)).size).toBe(
        addresses.length,
      );
      expect(results.map((value) => value.address)).toEqual(addresses);
      expect(results.map((value) => value.blocks[0])).toEqual(
        addresses.map((_, i) => i + 1),
      );
      pool.dispose();
    },
  );

  it("selects the best pending donor head by priority and id without moving in-flight jobs", async () => {
    const { pool, workers, dispatched } = harness(4);
    const a = { cx: 0, cy: 0, cz: 0 },
      b = { cx: 2, cy: 0, cz: 0 },
      c = { cx: 4, cy: 0, cz: 0 };
    const promises = [
      pool.request(a, 1, 0, () => {}),
      pool.request(b, 2, 0, () => {}),
      pool.request(c, 3, 0, () => {}),
      pool.request(a, 4, 4, () => {}),
      pool.request(a, 5, 9, () => {}),
      pool.request(b, 6, 4, () => {}),
      pool.request(b, 7, 1, () => {}),
    ];
    const first = workers[0]?.current,
      second = workers[1]?.current;
    expect(dispatched.map((request) => request.id)).toEqual([1, 2, 3]);
    workers[2]?.complete();
    // Choose priority1/id7, then priority4/id4 before its equal-priority id6.
    expect(dispatched.map((request) => request.id)).toEqual([1, 2, 3, 7, 4]);
    expect(workers[0]?.current).toBe(first);
    expect(workers[1]?.current).toBe(second);
    while (pool.queued > 0)
      for (const worker of workers) if (worker.current) worker.complete();
    expect(
      (await Promise.all(promises)).map((value) => value.revision),
    ).toEqual([1, 2, 3, 4, 5, 6, 7]);
    pool.dispose();
  });

  it.each([false, true])(
    "keeps borrowed callbacks and session/error boundaries, then rejects borrowed and pending work on disposal (postcard=%s)",
    async (postcard) => {
      const { pool, workers } = harness(3);
      const progress: string[] = [];
      const address = { cx: 0, cy: 0, cz: 0 };
      const promises = Array.from({ length: 8 }, (_, i) =>
        pool.request(
          address,
          i,
          i,
          (stage) => progress.push(`${i}:${stage}`),
          postcard,
        ),
      );
      const settled = Promise.allSettled(promises);
      workers[0]?.complete();
      const borrower = workers[1];
      if (!borrower?.current) throw new Error("Missing borrowed job");
      const borrowed = borrower.current;
      expect(borrowed.id).toBe(3);
      const lighting = {
        type: "progress",
        world,
        id: borrowed.id,
        stage: "lighting",
      } as const;
      workers[0]?.reply(lighting); // It no longer owns this job.
      borrower.reply({ ...lighting, world: { ...world, id: 6 } });
      expect(progress).toEqual([]);
      borrower.reply(lighting);
      expect(progress).toEqual(["2:lighting"]);
      borrower.reply({ ...result(borrowed), world: { ...world, id: 6 } });
      expect(borrower.current).toBe(borrowed);
      borrower.fail("borrowed job failed");
      expect(borrower.current?.id).toBe(5);
      expect(workers.every((worker) => !worker.terminated)).toBe(true);
      const edit = { x: 31, y: 2, z: 31, block: 0 };
      pool.edit(edit);
      for (const worker of workers)
        expect(worker.sent.at(-1)).toEqual({ type: "edit", world, edit });
      pool.dispose();
      const results = await settled;
      expect(results[0]?.status).toBe("fulfilled");
      expect(results[2]).toMatchObject({
        status: "rejected",
        reason: new Error("borrowed job failed"),
      });
      for (const i of [1, 3, 4, 5, 6, 7])
        expect(results[i]).toMatchObject({
          status: "rejected",
          reason: new Error("Worker pool disposed"),
        });
      expect(pool.queued).toBe(0);
      expect(workers.every((worker) => worker.terminated)).toBe(true);
    },
  );
});
