import { afterEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ read: Promise.resolve() }));
vi.mock("../../../client/src/engine/world-plan-cache.js", () => ({
  WorldPlanCache: class {
    async ensure(
      _identity: unknown,
      _version: number,
      build: () => Promise<unknown>,
    ) {
      await fixture.read;
      return build();
    }
    async close() {}
  },
}));

import { PlanPreparation } from "../../../client/src/engine/prepare-plan.js";

afterEach(() => vi.unstubAllGlobals());
describe("asynchronous plan lifetime", () => {
  it("does not create a worker after cancellation during an IndexedDB cache read", async () => {
    let release = () => {};
    fixture.read = new Promise<void>((resolve) => {
      release = resolve;
    });
    const worker = vi.fn();
    vi.stubGlobal("Worker", worker);
    const plan = new PlanPreparation();
    const pending = plan.prepare(
      { kind: "main", seed: 1, generation: "1:hash" },
      () => {},
    );
    const rejected = expect(pending).rejects.toThrow("cancelled");
    plan.cancel();
    release();
    await rejected;
    expect(worker).not.toHaveBeenCalled();
    await plan.dispose();
  });
  it("terminates the active builder and ignores later progress when its world is superseded", async () => {
    fixture.read = Promise.resolve();
    const instances: { terminate: ReturnType<typeof vi.fn> }[] = [];
    class WorkerFixture {
      terminate = vi.fn();
      postMessage() {}
      constructor() {
        instances.push(this);
      }
    }
    vi.stubGlobal("Worker", WorkerFixture);
    const plan = new PlanPreparation(),
      progress = vi.fn();
    const pending = plan.prepare(
      { kind: "main", seed: 1, generation: "1:hash" },
      progress,
    );
    const rejected = expect(pending).rejects.toThrow("cancelled");
    await Promise.resolve();
    plan.cancel();
    await rejected;
    expect(instances[0]?.terminate).toHaveBeenCalledTimes(1);
    expect(progress).not.toHaveBeenCalled();
    await plan.dispose();
  });
});
