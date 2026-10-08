import { WORLD_MAX_Y, WORLD_MIN_Y } from "../world/constants.js";
import { REGION_IDS } from "../world/regions.js";
import type { WorldPlan, WorldPlanData } from "../world/types.js";
import { createMainField } from "../worldgen/main/surface.js";
import { WORLDGEN_VERSION } from "../worldgen/version.js";
import {
  createGeometryWorkspace,
  footprint,
  layerWeights,
  surfaceWeights,
} from "./geometry.js";
import { canonicalPlanGrid, sampleGrid } from "./grid.js";
/** Validate clone/cache input before any sampler is exposed. No mutated/corrupt plan fallback. */
export function validateWorldPlanData(data: WorldPlanData): void {
  if (
    data?.schema !== 1 ||
    data.worldgenVersion !== WORLDGEN_VERSION ||
    !Number.isInteger(data.seed) ||
    data.seed < -2147483648 ||
    data.seed > 4294967295
  )
    throw new Error("WorldPlan identity/schema mismatch");
  const expected = canonicalPlanGrid();
  const grid = data.grid;
  if (
    !grid ||
    grid.minX !== expected.minX ||
    grid.minZ !== expected.minZ ||
    grid.width !== expected.width ||
    grid.depth !== expected.depth ||
    grid.spacing !== 64
  )
    throw new Error("WorldPlan grid mismatch");
  const count = grid.width * grid.depth;
  for (const values of [
    data.terrainMacro,
    data.routingHeight,
    data.drainageArea,
  ]) {
    if (!(values instanceof Float64Array) || values.length !== count)
      throw new Error("WorldPlan Float64 layout mismatch");
    for (const value of values)
      if (!Number.isFinite(value)) throw new Error("Nonfinite WorldPlan field");
  }
  if (
    !(data.receivers instanceof Int32Array) ||
    !(data.routingOrder instanceof Uint32Array) ||
    !(data.basinIds instanceof Uint32Array) ||
    data.receivers.length !== count ||
    data.routingOrder.length !== count ||
    data.basinIds.length !== count
  )
    throw new Error("WorldPlan integer layout mismatch");
  const seen = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const cell = Number(data.routingOrder[i]);
    if (cell >= count || seen[cell])
      throw new Error("Routing order is not a permutation");
    const receiver = Number(data.receivers[cell]);
    if (
      receiver < -1 ||
      receiver >= count ||
      (receiver >= 0 && !seen[receiver])
    )
      throw new Error("Receiver does not precede its child");
    seen[cell] = 1;
    if (
      Number(data.routingHeight[cell]) < Number(data.terrainMacro[cell]) ||
      Number(data.drainageArea[cell]) < 0
    )
      throw new Error("Invalid drainage height/area");
  }
  if (!Array.isArray(data.waterBodies))
    throw new Error("Missing body ownership table");
  for (let i = 0; i < data.waterBodies.length; i++) {
    const body = data.waterBodies[i];
    if (
      !body ||
      body.id !== i + 1 ||
      body.kind !== "water" ||
      !Number.isFinite(body.level) ||
      body.level < WORLD_MIN_Y ||
      body.level >= WORLD_MAX_Y
    )
      throw new Error("Invalid water body");
  }
  for (const id of data.basinIds)
    if (id > data.waterBodies.length)
      throw new Error("Unknown water-body owner");
  if (
    !Array.isArray(data.undergroundCells) ||
    data.undergroundCells.length !== 17
  )
    throw new Error("Missing underground layout");
  for (const cell of data.undergroundCells)
    if (
      !Number.isFinite(cell.x) ||
      !Number.isFinite(cell.z) ||
      REGION_IDS.indexOf(cell.region) < 16
    )
      throw new Error("Invalid underground cell");
  if (
    data.sites?.seats.length !== 30 ||
    data.sites.forts.length !== 106 ||
    data.sites.bridges.length !== 3 ||
    data.sites.spawns.length !== 256
  )
    throw new Error("WorldPlan site roster incomplete");
  for (const site of [
    ...data.sites.seats,
    ...data.sites.forts,
    ...data.sites.descents,
    ...data.sites.spawns,
  ])
    if (!Number.isFinite(site.x) || !Number.isFinite(site.z))
      throw new Error("Nonfinite site position");
  for (const bridge of data.sites.bridges)
    if (
      !(bridge.centreline instanceof Float64Array) ||
      bridge.centreline.length < 4 ||
      bridge.centreline.length % 2 ||
      !(bridge.gaps instanceof Float64Array) ||
      bridge.gaps.length < 2 ||
      bridge.gaps.length > 6 ||
      bridge.gaps.length % 2 ||
      !(bridge.halfWidth > 0)
    )
      throw new Error("Invalid bridge descriptor");
}
export function hydrateWorldPlan(data: WorldPlanData): WorldPlan {
  validateWorldPlanData(data);
  const workspace = createGeometryWorkspace();
  const field = createMainField(data, data.sites.bridges);
  return Object.freeze({
    data,
    seed: data.seed,
    worldgenVersion: data.worldgenVersion,
    sites: data.sites,
    surfaceWeights: (x, z, out) =>
      surfaceWeights(data.seed, x, z, out, workspace),
    layerWeights: (layer, x, z, out) =>
      layerWeights(
        data.seed,
        data.undergroundCells,
        layer,
        x,
        z,
        out,
        workspace,
      ),
    footprint: (layer, x, z) => footprint(data.seed, layer, x, z, workspace),
    macroHeight: (x, z) => sampleGrid(data.grid, data.terrainMacro, x, z),
    waterQuery: (x, z, out) => field.waterQuery(x, z, out),
  } satisfies WorldPlan);
}
