import type {
  PlanProgress,
  WorldIdentity,
  WorldPlanData,
} from "../../../shared/src/world/types.js";
import { WORLDGEN_VERSION } from "../../../shared/src/worldgen/version.js";
import type { PlanWorkerRequest, PlanWorkerResponse } from "./plan-worker.js";
import { WorldPlanCache } from "./world-plan-cache.js";

let serial = 0;
export class PlanPreparation {
  private readonly cache = new WorldPlanCache();
  private epoch = 0;
  private active: { worker: Worker; reject: (error: Error) => void } | null =
    null;
  async prepare(
    identity: WorldIdentity,
    progress: (progress: PlanProgress) => void,
  ): Promise<WorldPlanData | null> {
    const epoch = this.epoch;
    if (identity.kind === "test") return null;
    const data = await this.cache.ensure(
      identity,
      WORLDGEN_VERSION,
      () =>
        new Promise((resolve, reject) => {
          if (epoch !== this.epoch) {
            reject(new Error("WorldPlan preparation cancelled"));
            return;
          }
          const id = ++serial,
            worker = new Worker(new URL("./plan-worker.ts", import.meta.url), {
              type: "module",
            });
          const finish = () => {
            worker.terminate();
            if (this.active?.worker === worker) this.active = null;
          };
          this.active = { worker, reject };
          worker.onmessage = (event: MessageEvent<PlanWorkerResponse>) => {
            if (event.data.id !== id) return;
            if (event.data.type === "progress") {
              if (epoch === this.epoch) progress(event.data.progress);
            } else if (event.data.type === "ready") {
              finish();
              resolve(event.data.data);
            } else {
              finish();
              reject(new Error(event.data.error));
            }
          };
          worker.onerror = (event) => {
            finish();
            reject(new Error(event.message));
          };
          worker.postMessage({ id, identity } satisfies PlanWorkerRequest);
        }),
    );
    if (epoch !== this.epoch)
      throw new Error("WorldPlan preparation cancelled");
    progress({ stage: "complete", completed: 1, total: 1 });
    return data;
  }
  cancel(): void {
    this.epoch++;
    const active = this.active;
    if (!active) return;
    this.active = null;
    active.worker.terminate();
    active.reject(new Error("WorldPlan preparation cancelled"));
  }
  async dispose(): Promise<void> {
    this.cancel();
    await this.cache.close();
  }
}
