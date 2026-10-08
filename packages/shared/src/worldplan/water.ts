import { Region } from "../world/regions.js";
import type { SurfaceWaterBody, WorldPlanData } from "../world/types.js";
import type { DrainageOutlets, DrainageResult } from "./drainage.js";
import {
  createGeometryWorkspace,
  createRegionWeights,
  surfaceWeights,
} from "./geometry.js";
import type { GeographyData, PlanGrid } from "./grid.js";
import { TERRAIN_RECIPES, type TerrainRecipe } from "./terrain.js";

const DX = new Int8Array([-1, 1, 0, 0, -1, 1, -1, 1]);
const DZ = new Int8Array([0, 0, -1, 1, -1, -1, 1, 1]);
export interface WaterOutlets extends DrainageOutlets {
  readonly named: Uint8Array;
  readonly dominant: Uint8Array;
}
/** Named level-zero waters are explicit sinks; other negative elevations remain ordinary terrain. */
export function createWaterOutlets(
  seed: number,
  geography: GeographyData,
): WaterOutlets {
  const { grid, terrainMacro } = geography;
  const named = new Uint8Array(terrainMacro.length);
  const dominant = new Uint8Array(terrainMacro.length);
  const cells: number[] = [];
  const levels: number[] = [];
  const weights = createRegionWeights();
  const workspace = createGeometryWorkspace();
  for (let z = 0; z < grid.depth; z++)
    for (let x = 0; x < grid.width; x++) {
      const index = x + z * grid.width;
      surfaceWeights(
        seed,
        grid.minX + x * grid.spacing,
        grid.minZ + z * grid.spacing,
        weights,
        workspace,
      );
      const id = Number(weights.ids[0]);
      dominant[index] = id;
      if (Number(terrainMacro[index]) >= 0) continue;
      const body =
        id === Region.Blackwater
          ? 1
          : id === Region.Lake
            ? 2
            : id === Region.Swamp
              ? 3
              : 0;
      if (!body) continue;
      named[index] = body;
      cells.push(index);
      levels.push(0);
    }
  return {
    cells: new Uint32Array(cells),
    levels: new Float64Array(levels),
    named,
    dominant,
  };
}
export interface WaterData {
  readonly basinIds: Uint32Array;
  readonly waterBodies: readonly SurfaceWaterBody[];
}
/**
 * Flood-connected wet components at a single spill level. Eligibility applies to
 * the WHOLE pond, never slices across a dry-region boundary and leaves a water wall.
 */
export function buildOwnedWater(
  geography: GeographyData,
  drainage: DrainageResult,
  outlets: WaterOutlets,
): WaterData {
  const { grid, terrainMacro } = geography;
  const n = terrainMacro.length;
  const basinIds = new Uint32Array(n);
  const bodies: SurfaceWaterBody[] = [
    Object.freeze({ id: 1, kind: "water", level: 0, source: "blackwater" }),
    Object.freeze({ id: 2, kind: "water", level: 0, source: "lake" }),
    Object.freeze({ id: 3, kind: "water", level: 0, source: "swamp" }),
  ];
  const seen = new Uint8Array(n);
  const queue = new Uint32Array(n);
  for (let start = 0; start < n; start++) {
    if (
      seen[start] ||
      !(
        Number(drainage.routingHeight[start]) >
        Number(terrainMacro[start]) + 1e-8
      )
    )
      continue;
    const level = Number(drainage.routingHeight[start]);
    let head = 0;
    let tail = 1;
    queue[0] = start;
    seen[start] = 1;
    let namedBody = 0;
    let maximumArea = 0;
    let moistureSum = 0;
    let dry = false;
    let maximumDepth = 0;
    while (head < tail) {
      const cell = Number(queue[head++]);
      const named = Number(outlets.named[cell]);
      if (named && (!namedBody || named < namedBody)) namedBody = named;
      const region = Number(outlets.dominant[cell]);
      const recipe = TERRAIN_RECIPES[region] as TerrainRecipe;
      dry ||= recipe.moisture < 0.25;
      moistureSum += recipe.moisture;
      maximumArea = Math.max(maximumArea, Number(drainage.drainageArea[cell]));
      maximumDepth = Math.max(maximumDepth, level - Number(terrainMacro[cell]));
      const x = cell % grid.width;
      const z = Math.floor(cell / grid.width);
      for (let direction = 0; direction < 8; direction++) {
        const nx = x + Number(DX[direction]);
        const nz = z + Number(DZ[direction]);
        if (nx < 0 || nz < 0 || nx >= grid.width || nz >= grid.depth) continue;
        const next = nx + nz * grid.width;
        if (
          seen[next] ||
          drainage.routingHeight[next] !== level ||
          !(Number(terrainMacro[next]) + 1e-8 < level)
        )
          continue;
        seen[next] = 1;
        queue[tail++] = next;
      }
    }
    let body = namedBody;
    if (
      !body &&
      !dry &&
      tail >= 2 &&
      tail * 4096 <= 4000000 &&
      maximumDepth >= 1 &&
      (maximumArea * moistureSum) / tail >= 100000
    ) {
      body = bodies.length + 1;
      bodies.push(
        Object.freeze({ id: body, kind: "water", level, source: "pond" }),
      );
    }
    if (body) for (let i = 0; i < tail; i++) basinIds[Number(queue[i])] = body;
  }
  return { basinIds, waterBodies: Object.freeze(bodies) };
}
export type WaterPlan = Pick<
  WorldPlanData,
  "grid" | "terrainMacro" | "basinIds" | "waterBodies"
>;
/** A cell belongs to a body when any corner is wet; the rendered height closes the shoreline. */
export function potentialWaterBody(
  plan: WaterPlan,
  x: number,
  z: number,
): number {
  const { grid } = plan;
  if (
    x < grid.minX ||
    z < grid.minZ ||
    x > grid.minX + (grid.width - 1) * grid.spacing ||
    z > grid.minZ + (grid.depth - 1) * grid.spacing
  )
    return 0;
  const ix = Math.min(
    grid.width - 2,
    Math.floor((x - grid.minX) / grid.spacing),
  );
  const iz = Math.min(
    grid.depth - 2,
    Math.floor((z - grid.minZ) / grid.spacing),
  );
  let selected = 0;
  for (let dz = 0; dz < 2; dz++)
    for (let dx = 0; dx < 2; dx++) {
      const id = Number(plan.basinIds[ix + dx + (iz + dz) * grid.width]);
      if (!id) continue;
      if (!selected) selected = id;
      else {
        const current = plan.waterBodies[selected - 1] as SurfaceWaterBody;
        const candidate = plan.waterBodies[id - 1] as SurfaceWaterBody;
        if (
          candidate.level < current.level ||
          (candidate.level === current.level && id < selected)
        )
          selected = id;
      }
    }
  return selected;
}
/**
 * Continuous grid guard for meso/micro near shorelines. Every cell touching a wet
 * node limits its corners by distance to that water level. The point sampler also
 * limits by its actual macro distance to water. On a dry boundary edge all corner
 * heights are on the dry side, so the two limits meet continuously and cannot leak.
 */
export function buildShoreGuards(
  plan: WaterPlan,
  maximumAmplitude: number,
): Float64Array {
  const guards = new Float64Array(plan.terrainMacro.length).fill(
    maximumAmplitude,
  );
  const { grid } = plan;
  for (let cell = 0; cell < plan.basinIds.length; cell++) {
    const id = Number(plan.basinIds[cell]);
    if (!id) continue;
    const level = (plan.waterBodies[id - 1] as SurfaceWaterBody).level;
    const x = cell % grid.width;
    const z = Math.floor(cell / grid.width);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= grid.width || nz >= grid.depth) continue;
        const next = nx + nz * grid.width;
        guards[next] = Math.min(
          Number(guards[next]),
          Math.abs(Number(plan.terrainMacro[next]) - level),
        );
      }
  }
  return guards;
}
export function assertWaterTopology(
  grid: PlanGrid,
  terrain: Float64Array,
  water: WaterData,
): void {
  for (let z = 0; z < grid.depth - 1; z++)
    for (let x = 0; x < grid.width - 1; x++) {
      let level = NaN;
      for (let dz = 0; dz < 2; dz++)
        for (let dx = 0; dx < 2; dx++) {
          const cell = x + dx + (z + dz) * grid.width;
          const id = Number(water.basinIds[cell]);
          if (!id) continue;
          const body = water.waterBodies[id - 1] as SurfaceWaterBody;
          if (!(Number(terrain[cell]) < body.level))
            throw new Error("Owned-water node is not below its level");
          if (!Number.isNaN(level) && level !== body.level)
            throw new Error(
              "Different water levels touch one interpolation cell",
            );
          level = body.level;
        }
    }
}
