import {
  IBARA_CELL_SIZE,
  IBARA_LANDMARK_CELL_SIZE,
  IBARA_MAX_REACH,
} from "../../../shared/src/features/ibara/cells.js";
import type { IbaraField } from "../../../shared/src/features/ibara/field.js";
import type {
  ThornInstance,
  ThornParameters,
} from "../../../shared/src/features/ibara/types.js";
import type { CameraFirstHit } from "./geometry.js";
import { readabilityParents } from "./hell-readability.js";

type LookupField = Pick<IbaraField, "parametersForCell" | "cell" | "landmarks">;
export interface VisibleThornLookupReceipt {
  readonly requestedIds: readonly number[];
  readonly reusedIds: readonly number[];
  readonly resolvedIds: readonly number[];
  readonly missingIds: readonly number[];
  readonly parameterCellRequests: number;
  readonly parameterCellCacheHits: number;
  readonly ownerCellRequests: readonly {
    readonly x: number;
    readonly z: number;
    readonly landmark: boolean;
    /** All returned cell instances, an upper bound on constructions, not a
     * claim that the field's own geometry cache missed. */
    readonly returnedInstances: number;
  }[];
}
/** Resolve only the twelve coverage-selected parents. A local target's 144m
 * root disc controls target coverage, never which visible forms can be read.
 * Use the field's public cell queries and conservative collection reach; no
 * packed-ID decoding, placement formulas, or broad geometry collect per pose. */
export function createVisibleThornResolver(
  field: LookupField,
  known: Map<number, ThornInstance>,
) {
  const parameterCache = new Map<string, readonly ThornParameters[]>();
  return (
    hits: readonly CameraFirstHit[],
  ): {
    instances: readonly ThornInstance[];
    receipt: VisibleThornLookupReceipt;
  } => {
    const selected = readabilityParents(hits),
      instances: ThornInstance[] = [];
    const reusedIds: number[] = [],
      resolvedIds: number[] = [],
      missingIds: number[] = [];
    const ownerCellRequests: {
      x: number;
      z: number;
      landmark: boolean;
      returnedInstances: number;
    }[] = [];
    const ownerCache = new Map<string, readonly ThornInstance[]>();
    let parameterCellRequests = 0,
      parameterCellCacheHits = 0;
    for (const parent of selected) {
      const cached = known.get(parent.id);
      if (cached) {
        instances.push(cached);
        reusedIds.push(parent.id);
        continue;
      }
      const hit = parent.hits[0] as CameraFirstHit;
      let found: ThornInstance | undefined,
        located = false;
      // These are the SAME published reach and grid sizes used by field.collect.
      // At most81 ordinary +4 landmark parameter cells per missed parent.
      // Parameter enumeration does not construct swept geometry.
      for (const landmark of [false, true]) {
        if (located) break;
        const size = landmark ? IBARA_LANDMARK_CELL_SIZE : IBARA_CELL_SIZE;
        const cells: { x: number; z: number; distance: number }[] = [];
        for (
          let z = Math.floor((hit.z - IBARA_MAX_REACH) / size);
          z <= Math.floor((hit.z + IBARA_MAX_REACH) / size);
          z++
        )
          for (
            let x = Math.floor((hit.x - IBARA_MAX_REACH) / size);
            x <= Math.floor((hit.x + IBARA_MAX_REACH) / size);
            x++
          )
            cells.push({
              x,
              z,
              distance:
                ((x + 0.5) * size - hit.x) ** 2 +
                ((z + 0.5) * size - hit.z) ** 2,
            });
        cells.sort((a, b) => a.distance - b.distance || a.z - b.z || a.x - b.x);
        for (const cell of cells) {
          const key = `${Number(landmark)}:${cell.x}:${cell.z}`;
          let parameters = parameterCache.get(key);
          if (!parameters) {
            parameters = field.parametersForCell(cell.x, cell.z, landmark);
            parameterCellRequests++;
            parameterCache.set(key, parameters);
            // Bounded independently of how many cameras are searched.
            if (parameterCache.size > 256)
              parameterCache.delete(
                parameterCache.keys().next().value as string,
              );
          } else parameterCellCacheHits++;
          if (!parameters.some((p) => p.id === parent.id)) continue;
          located = true;
          let owners = ownerCache.get(key);
          if (!owners) {
            owners = landmark
              ? field.landmarks(cell.x, cell.z)
              : field.cell(cell.x, cell.z);
            ownerCache.set(key, owners);
            ownerCellRequests.push({
              x: cell.x,
              z: cell.z,
              landmark,
              returnedInstances: owners.length,
            });
          }
          found = owners.find((thorn) => thorn.parameters.id === parent.id);
          // A declared owner that cannot return its instance stays missing.
          break;
        }
      }
      if (found) {
        known.set(parent.id, found);
        instances.push(found);
        resolvedIds.push(parent.id);
      } else missingIds.push(parent.id);
    }
    return {
      instances,
      receipt: {
        requestedIds: selected.map((p) => p.id),
        reusedIds,
        resolvedIds,
        missingIds,
        parameterCellRequests,
        parameterCellCacheHits,
        ownerCellRequests,
      },
    };
  };
}
