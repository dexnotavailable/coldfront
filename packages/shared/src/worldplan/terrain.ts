/** First-pass regional profiles: docs04 section11. No rivers, erosion, caverns or thorn substitutes. */
import { Block } from "../blocks/registry.js";
import { psrd2 } from "../noise/psrd2.js";
import { Region } from "../world/regions.js";
import type { RegionWeights } from "../world/types.js";
import {
  clamp,
  createGeometryWorkspace,
  createRegionWeights,
  type GeometryWorkspace,
  smoothUnit,
  surfaceInteriorDistance,
  surfaceWeights,
} from "./geometry.js";
export interface TerrainRecipe {
  readonly base: number;
  readonly macroAmplitude: number;
  readonly macroScale: number;
  readonly mesoAmplitude: number;
  readonly mesoScale: number;
  readonly microAmplitude: number;
  readonly microScale: number;
  readonly top: number;
  readonly soil: number;
  readonly rock: number;
  readonly moisture: number;
  readonly trees: number;
}
function recipe(
  base: number,
  macroAmplitude: number,
  macroScale: number,
  mesoAmplitude: number,
  mesoScale: number,
  microAmplitude: number,
  microScale: number,
  top: number,
  soil: number,
  rock: number,
  moisture: number,
  trees: number,
): TerrainRecipe {
  return Object.freeze({
    base,
    macroAmplitude,
    macroScale,
    mesoAmplitude,
    mesoScale,
    microAmplitude,
    microScale,
    top,
    soil,
    rock,
    moisture,
    trees,
  });
}
/** Index is the stable surface Region numeric ID,0..15. */
export const TERRAIN_RECIPES: readonly TerrainRecipe[] = Object.freeze([
  recipe(
    40,
    25,
    3000,
    12,
    400,
    1,
    14,
    Block.Grass,
    Block.Dirt,
    Block.Limestone,
    0.75,
    0.45,
  ),
  recipe(
    60,
    30,
    3000,
    6,
    240,
    0.7,
    16,
    Block.Snow,
    Block.Dirt,
    Block.Granite,
    0.3,
    0.1,
  ),
  recipe(
    500,
    350,
    2500,
    28,
    240,
    1.5,
    14,
    Block.Stone,
    Block.Gravel,
    Block.Granite,
    0.55,
    0.14,
  ),
  recipe(
    80,
    35,
    4000,
    16,
    240,
    0.6,
    20,
    Block.Sand,
    Block.Sand,
    Block.Sandstone,
    0.02,
    0,
  ),
  recipe(
    30,
    10,
    2500,
    3,
    160,
    0.8,
    18,
    Block.Ash,
    Block.Dirt,
    Block.Limestone,
    0.15,
    0.05,
  ),
  recipe(
    60,
    55,
    3000,
    20,
    180,
    1.2,
    12,
    Block.Grass,
    Block.Dirt,
    Block.Limestone,
    0.95,
    0.75,
  ),
  recipe(
    2,
    0,
    2000,
    0.6,
    140,
    0.4,
    14,
    Block.Mud,
    Block.Clay,
    Block.Limestone,
    1,
    0.4,
  ),
  recipe(
    -120,
    0,
    3000,
    0,
    180,
    0.4,
    14,
    Block.Gravel,
    Block.Clay,
    Block.Granite,
    1,
    0.45,
  ),
  recipe(
    50,
    30,
    1500,
    12,
    120,
    0.8,
    18,
    Block.MossyStone,
    Block.Dirt,
    Block.Slate,
    0,
    0.24,
  ),
  recipe(
    40,
    20,
    3000,
    8,
    250,
    1,
    20,
    Block.Ash,
    Block.Basalt,
    Block.Basalt,
    0,
    0,
  ),
  recipe(
    70,
    15,
    2800,
    5,
    300,
    0.7,
    12,
    Block.Slate,
    Block.Stone,
    Block.Slate,
    0.05,
    0,
  ),
  recipe(
    20,
    15,
    2300,
    8,
    280,
    0.8,
    18,
    Block.Grass,
    Block.Dirt,
    Block.Slate,
    0.25,
    0.15,
  ),
  recipe(
    200,
    30,
    3200,
    6,
    200,
    0.8,
    12,
    Block.Basalt,
    Block.Ash,
    Block.Basalt,
    0,
    0.1,
  ),
  recipe(
    -200,
    50,
    4000,
    0,
    200,
    0.5,
    18,
    Block.Sand,
    Block.Gravel,
    Block.Basalt,
    1,
    0,
  ),
  recipe(
    40,
    0,
    3000,
    2,
    120,
    0.5,
    20,
    Block.PackedIce,
    Block.PackedIce,
    Block.Granite,
    0,
    0,
  ),
  recipe(
    600,
    0,
    3000,
    0,
    180,
    0,
    18,
    Block.PackedIce,
    Block.PackedIce,
    Block.Granite,
    0,
    0,
  ),
]);
export interface TerrainWorkspace {
  readonly geometry: GeometryWorkspace;
  readonly weights: RegionWeights;
  readonly noise: Float64Array;
  readonly parts: Float64Array;
}
export function createTerrainWorkspace(): TerrainWorkspace {
  return {
    geometry: createGeometryWorkspace(),
    weights: createRegionWeights(),
    noise: new Float64Array(6),
    parts: new Float64Array(4),
  };
}
/** Explicitly bounded psrd profile; this clamp makes the fine-relief bounds rigorous. */
export function boundedNoise(
  seed: number,
  x: number,
  z: number,
  out: Float64Array,
): number {
  psrd2(seed, x, z, out);
  return clamp(Number(out[0]), -1, 1);
}
export function regionalMacroNoise(
  seed: number,
  region: number,
  x: number,
  z: number,
  scratch: Float64Array,
): number {
  const r = TERRAIN_RECIPES[region] as TerrainRecipe;
  return r.macroAmplitude === 0
    ? 0
    : boundedNoise(
        seed ^ Math.imul(region + 1, 0x45d9f3b),
        x / r.macroScale,
        z / r.macroScale,
        scratch,
      );
}
/**
 * Four auditable components: blended base,bowl,owned basin/plateau/Rim shapes,
 * regional macro relief. meanNoise is measured once on the same64m grid, weighted
 * by region area. Rendering caches their sum once and adds ONLY meso/micro later.
 */
export function macroComponents(
  seed: number,
  x: number,
  z: number,
  meanNoise: Float64Array,
  centreRadius: Float64Array,
  workspace: TerrainWorkspace,
): Float64Array {
  surfaceWeights(seed, x, z, workspace.weights, workspace.geometry);
  const px = Number(workspace.geometry.vector[0]);
  const pz = Number(workspace.geometry.vector[1]);
  const radial = Math.sqrt(px * px + pz * pz);
  const parts = workspace.parts;
  parts.fill(0);
  for (let i = 0; i < workspace.weights.count; i++) {
    const id = Number(workspace.weights.ids[i]);
    const weight = Number(workspace.weights.weights[i]);
    const r = TERRAIN_RECIPES[id] as TerrainRecipe;
    let bowl = 0;
    let owned = 0;
    if (id < 12 && id !== Region.Swamp && id !== Region.Lake)
      bowl = (radial - Number(centreRadius[id])) * (40 / 15000);
    if (id === Region.Lake)
      owned =
        150 *
        (1 -
          smoothUnit(Math.max(0, surfaceInteriorDistance(id, px, pz)) / 1500));
    else if (id === Region.Nadir)
      owned =
        (120 + r.macroAmplitude * Number(meanNoise[id])) *
        (1 - smoothUnit(radial / 900));
    else if (id === Region.Rim)
      owned = 560 * smoothUnit((radial - 20500) / 1000);
    else if (id === Region.Swamp) {
      const channel = Math.abs(
        boundedNoise(seed ^ 0x71acb991, x / 800, z / 800, workspace.noise),
      );
      owned = -4 * (1 - smoothUnit(channel / 0.35));
    }
    const relief =
      r.macroAmplitude *
      (regionalMacroNoise(seed, id, x, z, workspace.noise) -
        Number(meanNoise[id]));
    parts[0] = Number(parts[0]) + weight * r.base;
    parts[1] = Number(parts[1]) + weight * bowl;
    parts[2] = Number(parts[2]) + weight * owned;
    parts[3] = Number(parts[3]) + weight * relief;
  }
  return parts;
}
export function fineAmplitude(weights: RegionWeights): number {
  let amplitude = 0;
  for (let i = 0; i < weights.count; i++) {
    const r = TERRAIN_RECIPES[Number(weights.ids[i])] as TerrainRecipe;
    amplitude +=
      Number(weights.weights[i]) * (r.mesoAmplitude + r.microAmplitude);
  }
  return amplitude;
}
/** Meso/micro only; macro relief is already present in WorldPlanData.terrainMacro. */
export function fineRelief(
  seed: number,
  x: number,
  z: number,
  weights: RegionWeights,
  out: Float64Array,
  scratch: Float64Array,
): void {
  let meso = 0;
  let micro = 0;
  for (let i = 0; i < weights.count; i++) {
    const id = Number(weights.ids[i]);
    const w = Number(weights.weights[i]);
    const r = TERRAIN_RECIPES[id] as TerrainRecipe;
    if (r.mesoAmplitude)
      meso +=
        w *
        r.mesoAmplitude *
        boundedNoise(
          seed ^ Math.imul(id + 1, 0x27d4eb2d),
          x / r.mesoScale,
          z / r.mesoScale,
          scratch,
        );
    if (r.microAmplitude)
      micro +=
        w *
        r.microAmplitude *
        boundedNoise(
          seed ^ Math.imul(id + 1, 0x165667b1),
          x / r.microScale,
          z / r.microScale,
          scratch,
        );
  }
  out[0] = meso;
  out[1] = micro;
}
