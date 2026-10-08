import { Block } from "../../blocks/registry.js";
import { psrd2, psrd2Quantile } from "../../noise/psrd2.js";
import { WORLD_MAX_XZ, WORLD_MIN_XZ } from "../../world/constants.js";
import { Region } from "../../world/regions.js";
import type {
  BridgeSite,
  SurfaceWaterBody,
  WaterSample,
  WorldBounds,
  WorldColumnLayout,
  WorldPlanData,
  XZBounds,
} from "../../world/types.js";
import {
  BRIDGE_TOP,
  bridgeIntersects,
  sampleBridges,
} from "../../worldplan/bridges.js";
import {
  createGeometryWorkspace,
  createRegionWeights,
  surfaceWeights,
} from "../../worldplan/geometry.js";
import { sampleGrid } from "../../worldplan/grid.js";
import {
  fineAmplitude,
  fineRelief,
  TERRAIN_RECIPES,
  type TerrainRecipe,
} from "../../worldplan/terrain.js";
import { buildShoreGuards, potentialWaterBody } from "../../worldplan/water.js";
/** Separate main layout; never modifies/relabels the accepted test-world's eight lanes. */
export const MainColumn = Object.freeze({
  Height: 0,
  Dx: 1,
  Dz: 2,
  WaterLevel: 3,
  Macro: 4,
  Meso: 5,
  Micro: 6,
  DistanceScale: 7,
  DominantRegion: 8,
  Body: 9,
  NaturalHeight: 10,
  BridgeMargin: 11,
  BridgeTop: 12,
  PaletteRegion: 13,
  Stride: 14,
} as const);
export const MAIN_COLUMN_LAYOUT: WorldColumnLayout = Object.freeze({
  stride: 14,
  height: 0,
  gradientX: 1,
  gradientZ: 2,
  waterLevel: 3,
});
export const MAX_FINE_RELIEF = 29.5; // Maximum of the actual recipe meso+micro amplitudes.
export type MainFieldData = Pick<
  WorldPlanData,
  "seed" | "grid" | "terrainMacro" | "basinIds" | "waterBodies"
>;
export interface MainField {
  readonly data: MainFieldData;
  readonly bridges: readonly BridgeSite[];
  createColumn(): Float64Array;
  sampleColumn(x: number, z: number, out: Float64Array): Float64Array;
  height(x: number, z: number): number;
  waterQuery(x: number, z: number, out: WaterSample): WaterSample;
  surfaceBounds(bounds: XZBounds, out: WorldBounds): WorldBounds;
}
export function createMainField(
  data: MainFieldData,
  bridges: readonly BridgeSite[],
): MainField {
  const guards = buildShoreGuards(data, MAX_FINE_RELIEF);
  const weights = createRegionWeights();
  const geometry = createGeometryWorkspace();
  const noise = new Float64Array(6);
  const fine = new Float64Array(2);
  const bridge = new Float64Array(2);
  const temporary = new Float64Array(MainColumn.Stride);
  const point = (x: number, z: number, out: Float64Array): void => {
    if (!Number.isFinite(x) || !Number.isFinite(z))
      throw new RangeError("Column position must be finite");
    const macro = sampleGrid(data.grid, data.terrainMacro, x, z);
    surfaceWeights(data.seed, x, z, weights, geometry);
    const dominant = Number(weights.ids[0]);
    const amplitude = fineAmplitude(weights);
    fineRelief(data.seed, x, z, weights, fine, noise);
    const bodyId = potentialWaterBody(data, x, z);
    const level = bodyId
      ? (data.waterBodies[bodyId - 1] as SurfaceWaterBody).level
      : -Infinity;
    let limit = sampleGrid(data.grid, guards, x, z);
    if (bodyId) limit = Math.min(limit, Math.abs(macro - level));
    const scale = Math.min(1, limit / (amplitude + 1e-9));
    const meso = Number(fine[0]) * scale;
    const micro = Number(fine[1]) * scale;
    const natural = macro + meso + micro;
    sampleBridges(bridges, x, z, bridge);
    const height =
      Number(bridge[1]) > 0 ? Math.max(natural, Number(bridge[0])) : natural;
    psrd2(data.seed ^ 0x5bd1e995, x / 24, z / 24, noise);
    const materialNoise = Number(noise[0]);
    let cumulative = 0;
    let palette = dominant;
    for (let i = 0; i < weights.count; i++) {
      cumulative += Number(weights.weights[i]);
      if (materialNoise <= psrd2Quantile(Math.min(1, cumulative))) {
        palette = Number(weights.ids[i]);
        break;
      }
    }
    out[MainColumn.Height] = height;
    out[MainColumn.WaterLevel] = bodyId && natural < level ? level : -Infinity;
    out[MainColumn.Macro] = macro;
    out[MainColumn.Meso] = meso;
    out[MainColumn.Micro] = micro;
    out[MainColumn.DominantRegion] = dominant;
    out[MainColumn.Body] = bodyId;
    out[MainColumn.NaturalHeight] = natural;
    out[MainColumn.BridgeMargin] = Number(bridge[1]);
    out[MainColumn.BridgeTop] = Number(bridge[0]);
    out[MainColumn.PaletteRegion] = palette;
  };
  const height = (x: number, z: number): number => {
    point(x, z, temporary);
    return Number(temporary[MainColumn.Height]);
  };
  return {
    data,
    bridges,
    createColumn: () => new Float64Array(MainColumn.Stride),
    height,
    sampleColumn(x, z, out) {
      if (out.length < MainColumn.Stride)
        throw new RangeError("Main column requires fourteen lanes");
      point(x, z, out);
      const dx = height(x + 0.5, z) - height(x - 0.5, z);
      const dz = height(x, z + 0.5) - height(x, z - 0.5);
      out[MainColumn.Dx] = dx;
      out[MainColumn.Dz] = dz;
      out[MainColumn.DistanceScale] =
        1 / Math.sqrt(1 + Math.min(dx * dx + dz * dz, 64));
      return out;
    },
    waterQuery(x, z, out) {
      point(x, z, temporary);
      const level = Number(temporary[MainColumn.WaterLevel]);
      const active = Number(temporary[MainColumn.Height]) < level;
      out.bodyId = active ? Number(temporary[MainColumn.Body]) : 0;
      out.kind = active ? "water" : "none";
      out.level = active ? level : -Infinity;
      return out;
    },
    surfaceBounds(bounds, out) {
      const minX = Math.max(WORLD_MIN_XZ, bounds.minX);
      const maxX = Math.min(WORLD_MAX_XZ, bounds.maxX);
      const minZ = Math.max(WORLD_MIN_XZ, bounds.minZ);
      const maxZ = Math.min(WORLD_MAX_XZ, bounds.maxZ);
      if (
        ![minX, maxX, minZ, maxZ].every(Number.isFinite) ||
        minX > maxX ||
        minZ > maxZ
      )
        throw new RangeError("Bounds do not intersect the world frame");
      const g = data.grid;
      const ax = Math.max(0, Math.floor((minX - g.minX) / g.spacing));
      const az = Math.max(0, Math.floor((minZ - g.minZ) / g.spacing));
      const bx = Math.min(g.width - 1, Math.ceil((maxX - g.minX) / g.spacing));
      const bz = Math.min(g.depth - 1, Math.ceil((maxZ - g.minZ) / g.spacing));
      let low = Infinity;
      let high = -Infinity;
      let fluid = -Infinity;
      for (let z = az; z <= bz; z++)
        for (let x = ax; x <= bx; x++) {
          const index = x + z * g.width;
          const h = Number(data.terrainMacro[index]);
          low = Math.min(low, h);
          high = Math.max(high, h);
          const id = Number(data.basinIds[index]);
          if (id)
            fluid = Math.max(
              fluid,
              (data.waterBodies[id - 1] as SurfaceWaterBody).level,
            );
        }
      // Sub-micrometre rounding pad around interval bounds, not a sampled-height heuristic.
      out.minSurfaceY = low - MAX_FINE_RELIEF - 1e-7;
      out.maxSurfaceY = high + MAX_FINE_RELIEF + 1e-7;
      for (const item of bridges)
        if (bridgeIntersects(item, bounds))
          out.maxSurfaceY = Math.max(out.maxSurfaceY, BRIDGE_TOP);
      out.maxSolidY = out.maxSurfaceY;
      out.maxFluidY = fluid;
      return out;
    },
  };
}
/** Pointwise top/subsoil/stone selection, never based on chunk-local y. */
export function mainTerrainMaterial(y: number, column: Float64Array): number {
  const region = Number(column[MainColumn.PaletteRegion]);
  const recipe = TERRAIN_RECIPES[region] as TerrainRecipe;
  const depth = Number(column[MainColumn.NaturalHeight]) - y;
  if (depth > 4) return y < -48 ? Block.DeepStone : recipe.rock;
  const water = Number(column[MainColumn.WaterLevel]);
  if (water !== -Infinity)
    return region === Region.Swamp
      ? Block.Mud
      : region === Region.Lake
        ? Block.Gravel
        : Block.Sand;
  const dx = Number(column[MainColumn.Dx]);
  const dz = Number(column[MainColumn.Dz]);
  if (dx * dx + dz * dz > 1.42) return recipe.rock;
  if (region === Region.Mountains && y > 450 && depth < 1) return Block.Snow;
  return depth < 1 ? recipe.top : recipe.soil;
}
