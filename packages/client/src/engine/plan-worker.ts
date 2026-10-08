/// <reference lib="webworker" />

import type {
  PlanProgress,
  WorldIdentity,
  WorldPlanData,
} from "../../../shared/src/world/types.js";
import { buildWorldPlan } from "../../../shared/src/worldplan/index.js";
export type PlanWorkerRequest = {
  readonly id: number;
  readonly identity: WorldIdentity;
};
export type PlanWorkerResponse =
  | {
      readonly type: "progress";
      readonly id: number;
      readonly progress: PlanProgress;
    }
  | {
      readonly type: "ready";
      readonly id: number;
      readonly data: WorldPlanData;
    }
  | { readonly type: "error"; readonly id: number; readonly error: string };
function buffers(value: unknown): ArrayBuffer[] {
  if (ArrayBuffer.isView(value))
    return value.buffer instanceof ArrayBuffer ? [value.buffer] : [];
  if (Array.isArray(value)) return value.flatMap(buffers);
  return value && typeof value === "object"
    ? Object.values(value).flatMap(buffers)
    : [];
}
self.onmessage = (event: MessageEvent<PlanWorkerRequest>) => {
  const { id, identity } = event.data;
  try {
    if (identity.kind !== "main")
      throw new Error("The test world has no WorldPlan");
    const data = buildWorldPlan(identity.seed, (progress) =>
      self.postMessage({
        type: "progress",
        id,
        progress,
      } satisfies PlanWorkerResponse),
    );
    self.postMessage({ type: "ready", id, data } satisfies PlanWorkerResponse, {
      transfer: [...new Set(buffers(data))],
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      id,
      error: error instanceof Error ? error.message : String(error),
    } satisfies PlanWorkerResponse);
  }
};
