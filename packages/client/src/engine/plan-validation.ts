import type {
  WorldIdentity,
  WorldPlanData,
} from "../../../shared/src/world/types.js";
import { hydrateWorldPlan } from "../../../shared/src/worldplan/index.js";

/** Cache identity is client-owned; schema, buffers, sentinels and drainage
 * invariants have one authoritative validator in the shared plan hydrator. */
export function validateWorldPlan(
  value: unknown,
  identity: WorldIdentity,
  version: number,
): asserts value is WorldPlanData {
  if (identity.kind !== "main" || !value || typeof value !== "object")
    throw new Error("WorldPlan identity mismatch");
  const data = value as WorldPlanData;
  if (
    data.seed !== identity.seed ||
    data.worldgenVersion !== version ||
    data.schema !== 2
  )
    throw new Error("WorldPlan compatibility mismatch");
  hydrateWorldPlan(data);
}
