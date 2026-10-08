import { WORLD_MAX_XZ, WORLD_MIN_XZ } from "../world/constants.js";
import type { WorldPlanData } from "../world/types.js";
import {
  createGeometryWorkspace,
  createRegionWeights,
  surfaceWeights,
  warpedPoint,
} from "./geometry.js";
import {
  createTerrainWorkspace,
  macroComponents,
  regionalMacroNoise,
} from "./terrain.js";
export type PlanGrid = WorldPlanData["grid"];
export const PLAN_SPACING = 64;
export function canonicalPlanGrid(): PlanGrid {
  const size = (WORLD_MAX_XZ - WORLD_MIN_XZ) / PLAN_SPACING + 1;
  return Object.freeze({
    minX: WORLD_MIN_XZ,
    minZ: WORLD_MIN_XZ,
    spacing: PLAN_SPACING,
    width: size,
    depth: size,
  });
}
export interface GeographyData {
  readonly grid: PlanGrid;
  readonly terrainMacro: Float64Array;
  /** Interleaved physical XZ weighted centroids, only used by deterministic site planning. */
  readonly surfaceCentres: Float64Array;
  readonly meanNoise: Float64Array;
  readonly regionArea: Float64Array;
}
/** Sample the unfilled render field. Outside the frame it extends boundary vertices for halos. */
export function sampleGrid(
  grid: PlanGrid,
  values: Float64Array,
  x: number,
  z: number,
): number {
  const gx = Math.max(
    0,
    Math.min(grid.width - 1, (x - grid.minX) / grid.spacing),
  );
  const gz = Math.max(
    0,
    Math.min(grid.depth - 1, (z - grid.minZ) / grid.spacing),
  );
  const ix = Math.min(grid.width - 2, Math.floor(gx));
  const iz = Math.min(grid.depth - 2, Math.floor(gz));
  const fx = gx - ix;
  const fz = gz - iz;
  const a = Number(values[ix + iz * grid.width]);
  const b = Number(values[ix + 1 + iz * grid.width]);
  const c = Number(values[ix + (iz + 1) * grid.width]);
  const d = Number(values[ix + 1 + (iz + 1) * grid.width]);
  return a + (b - a) * fx + (c + (d - c) * fx - (a + (b - a) * fx)) * fz;
}
/** Build once. Every macro component is written once; drainage receives a separate copy. */
export function buildGeography(
  seed: number,
  progress?: (completed: number, total: number) => void,
): GeographyData {
  const grid = canonicalPlanGrid();
  const count = grid.width * grid.depth;
  const regionArea = new Float64Array(16);
  const centres = new Float64Array(32);
  const means = new Float64Array(16);
  const weights = createRegionWeights();
  const geometry = createGeometryWorkspace();
  const noise = new Float64Array(6);
  for (let z = 0; z < grid.depth; z++) {
    const wz = grid.minZ + z * grid.spacing;
    for (let x = 0; x < grid.width; x++) {
      const wx = grid.minX + x * grid.spacing;
      const area =
        grid.spacing *
        grid.spacing *
        (x === 0 || x === grid.width - 1 ? 0.5 : 1) *
        (z === 0 || z === grid.depth - 1 ? 0.5 : 1);
      surfaceWeights(seed, wx, wz, weights, geometry);
      for (let i = 0; i < weights.count; i++) {
        const id = Number(weights.ids[i]);
        const weighted = area * Number(weights.weights[i]);
        regionArea[id] = Number(regionArea[id]) + weighted;
        centres[2 * id] = Number(centres[2 * id]) + weighted * wx;
        centres[2 * id + 1] = Number(centres[2 * id + 1]) + weighted * wz;
        means[id] =
          Number(means[id]) +
          weighted * regionalMacroNoise(seed, id, wx, wz, noise);
      }
    }
    progress?.(z + 1, 2 * grid.depth);
  }
  const centreRadius = new Float64Array(16);
  for (let id = 0; id < 16; id++) {
    const area = Number(regionArea[id]);
    if (!(area > 0)) throw new Error("A surface region has no plan area");
    centres[2 * id] = Number(centres[2 * id]) / area;
    centres[2 * id + 1] = Number(centres[2 * id + 1]) / area;
    means[id] = Number(means[id]) / area;
    warpedPoint(
      seed ^ 0x2b992ddf,
      Number(centres[2 * id]),
      Number(centres[2 * id + 1]),
      350,
      false,
      geometry,
    );
    const px = Number(geometry.vector[0]);
    const pz = Number(geometry.vector[1]);
    centreRadius[id] = Math.sqrt(px * px + pz * pz);
  }
  const terrainMacro = new Float64Array(count);
  const workspace = createTerrainWorkspace();
  for (let z = 0; z < grid.depth; z++) {
    const wz = grid.minZ + z * grid.spacing;
    for (let x = 0; x < grid.width; x++) {
      const parts = macroComponents(
        seed,
        grid.minX + x * grid.spacing,
        wz,
        means,
        centreRadius,
        workspace,
      );
      terrainMacro[x + z * grid.width] =
        Number(parts[0]) +
        Number(parts[1]) +
        Number(parts[2]) +
        Number(parts[3]);
    }
    progress?.(grid.depth + z + 1, 2 * grid.depth);
  }
  return {
    grid,
    terrainMacro,
    surfaceCentres: centres,
    meanNoise: means,
    regionArea,
  };
}
