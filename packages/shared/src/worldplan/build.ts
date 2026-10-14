import type { PlanProgress, WorldPlanData } from "../world/types.js";
import { createMainField } from "../worldgen/main/surface.js";
import { WORLDGEN_VERSION } from "../worldgen/version.js";
import { createBridges } from "./bridges.js";
import { buildDrainage } from "./drainage.js";
import { createUndergroundCells } from "./geometry.js";
import { buildGeography } from "./grid.js";
import { buildIbaraPlan } from "./ibara.js";
import { buildSites } from "./sites.js";
import {
  assertWaterTopology,
  buildOwnedWater,
  createWaterOutlets,
} from "./water.js";

/** Pure, bounded build; callbacks report completed work, never measured time. */
export function buildWorldPlan(
  seed: number,
  onProgress?: (progress: PlanProgress) => void,
): WorldPlanData {
  if (!Number.isInteger(seed) || seed < -2147483648 || seed > 4294967295)
    throw new RangeError("World seed must be a32-bit word");
  const progress = (
    stage: PlanProgress["stage"],
    completed: number,
    total: number,
  ): void => {
    onProgress?.({ stage, completed, total });
  };
  progress("geometry", 0, 1);
  const geography = buildGeography(seed, (done, total) =>
    progress("geometry", done, total),
  );
  const outlets = createWaterOutlets(seed, geography);
  const drainage = buildDrainage(
    geography.terrainMacro,
    geography.grid.width,
    geography.grid.depth,
    geography.grid.spacing,
    outlets,
    (done, total) => progress("drainage", done, total),
  );
  progress("water", 0, 1);
  const water = buildOwnedWater(geography, drainage, outlets);
  assertWaterTopology(geography.grid, geography.terrainMacro, water);
  progress("water", 1, 1);
  const undergroundCells = createUndergroundCells(seed);
  const bridges = createBridges(seed);
  const core = {
    schema: 2 as const,
    seed,
    worldgenVersion: WORLDGEN_VERSION,
    grid: geography.grid,
    terrainMacro: geography.terrainMacro,
    ...drainage,
    ...water,
    undergroundCells,
  };
  const ibara = buildIbaraPlan(core, createMainField(core, bridges));
  const field = createMainField(core, bridges, ibara);
  progress("sites", 0, 1);
  const sites = buildSites(seed, geography, field, undergroundCells, bridges);
  progress("sites", 1, 1);
  progress("complete", 1, 1);
  return Object.freeze({ ...core, ibara, sites });
}
