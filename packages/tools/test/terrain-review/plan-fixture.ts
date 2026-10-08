import type { WorldSites } from "../../../shared/src/world/types.js";
import {
  createGeometryWorkspace,
  createUndergroundCells,
  footprint,
  layerWeights,
  surfaceWeights,
} from "../../../shared/src/worldplan/geometry.js";
import type { TerrainReviewSource } from "../../src/terrain-review/source.js";
/** Bounded renderer fixture: real pointwise geometry, explicitly supplied test sites.
 * No drainage/terrain plan is built or represented as production data. */
export function geometryPlan(
  seed = 1,
  sites: WorldSites = {
    seats: [],
    forts: [],
    descents: [],
    bridges: [],
    spawns: [],
  },
): NonNullable<TerrainReviewSource["plan"]> {
  const workspace = createGeometryWorkspace(),
    cells = createUndergroundCells(seed);
  return {
    sites,
    surfaceWeights: (x, z, out) => surfaceWeights(seed, x, z, out, workspace),
    layerWeights: (layer, x, z, out) =>
      layerWeights(seed, cells, layer, x, z, out, workspace),
    footprint: (layer, x, z) => footprint(seed, layer, x, z, workspace),
  };
}
