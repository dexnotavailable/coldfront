import { UI_PHASE } from "../../../client/src/ui/phase";
import { catalogue, currentId } from "../../../client/src/ui/t";

/** Serialize the same phase boundary used by t() and Node lint to the browser. */
export function auditPolicy() {
  return {
    phase: UI_PHASE,
    currentIds: Object.keys(catalogue).filter(currentId),
  };
}
