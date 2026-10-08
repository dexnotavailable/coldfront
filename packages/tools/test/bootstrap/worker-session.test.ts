import { describe, expect, it } from "vitest";
import type { WorldSession } from "../../../client/src/contracts/game-ui.js";
import { TerrainWorkers } from "../../../client/src/engine/worker-pool.js";
import type {
  WorkerRequest,
  WorkerResponse,
} from "../../../client/src/engine/worker-protocol.js";
import { NavigationGate } from "../../../client/src/game/session.js";

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
