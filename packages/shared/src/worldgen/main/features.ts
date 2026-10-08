/** First-pass trees only. Region-specific giants, thorns and floating features ship later. */
import { Block } from "../../blocks/registry.js";
import { hash3, hash4, rand01 } from "../../math/hash.js";
import {
  WORLD_MAX_XZ,
  WORLD_MAX_Y,
  WORLD_MIN_XZ,
  WORLD_MIN_Y,
  WORLDSTONE_CEILING,
} from "../../world/constants.js";
import type { VoxelSample, XZBounds } from "../../world/types.js";
import {
  TERRAIN_RECIPES,
  type TerrainRecipe,
} from "../../worldplan/terrain.js";
import type { TreeFeature } from "../test-world.js";
import { MainColumn, type MainField, mainTerrainMaterial } from "./surface.js";
export const MAIN_TREE_CELL = 40;
export const MAIN_TREE_RADIUS = 4.75;
/** Actual maxima: trunk9 + crown3.5 - crown offset0.5 =12m above its anchor. */
export const MAIN_TREE_MAX_RISE = 12;
export function mainTreeInCell(
  field: MainField,
  cellX: number,
  cellZ: number,
  column: Float64Array,
): TreeFeature | null {
  const seed = field.data.seed;
  const x =
    cellX * MAIN_TREE_CELL + 4 + 32 * rand01(hash4(seed, cellX, cellZ, 11));
  const z =
    cellZ * MAIN_TREE_CELL + 4 + 32 * rand01(hash4(seed, cellX, cellZ, 12));
  if (
    x < WORLD_MIN_XZ ||
    x >= WORLD_MAX_XZ ||
    z < WORLD_MIN_XZ ||
    z >= WORLD_MAX_XZ
  )
    return null;
  field.sampleColumn(x, z, column);
  const recipe = TERRAIN_RECIPES[
    Number(column[MainColumn.DominantRegion])
  ] as TerrainRecipe;
  if (rand01(hash3(seed ^ 0x61c88647, cellX, cellZ)) >= recipe.trees)
    return null;
  const h = Number(column[MainColumn.Height]);
  const dx = Number(column[MainColumn.Dx]);
  const dz = Number(column[MainColumn.Dz]);
  if (
    h < Number(column[MainColumn.WaterLevel]) + 1 ||
    Number(column[MainColumn.BridgeMargin]) > 0 ||
    dx * dx + dz * dz > 0.5 ||
    h > 450
  )
    return null;
  const trunkHeight = 5 + 4 * rand01(hash4(seed, cellX, cellZ, 13));
  return {
    cellX,
    cellZ,
    x,
    z,
    baseY: h - 2,
    trunkTop: h + trunkHeight,
    trunkRadius: 1 + 0.35 * rand01(hash4(seed, cellX, cellZ, 14)),
    crownY: h + trunkHeight - 0.5,
    crownRadius: 3 + 1.75 * rand01(hash4(seed, cellX, cellZ, 15)),
    crownHeight: 2.5 + rand01(hash4(seed, cellX, cellZ, 16)),
  };
}
export function collectMainTrees(
  field: MainField,
  bounds: XZBounds,
): readonly TreeFeature[] {
  const minX = Math.floor((bounds.minX - MAIN_TREE_RADIUS) / MAIN_TREE_CELL);
  const maxX = Math.floor((bounds.maxX + MAIN_TREE_RADIUS) / MAIN_TREE_CELL);
  const minZ = Math.floor((bounds.minZ - MAIN_TREE_RADIUS) / MAIN_TREE_CELL);
  const maxZ = Math.floor((bounds.maxZ + MAIN_TREE_RADIUS) / MAIN_TREE_CELL);
  if ((maxX - minX + 1) * (maxZ - minZ + 1) > 1000000)
    throw new RangeError("Feature area is too large; tile it");
  const trees: TreeFeature[] = [];
  const column = field.createColumn();
  for (let x = minX; x <= maxX; x++)
    for (let z = minZ; z <= maxZ; z++) {
      const tree = mainTreeInCell(field, x, z, column);
      if (
        tree &&
        tree.x + tree.crownRadius >= bounds.minX &&
        tree.x - tree.crownRadius <= bounds.maxX &&
        tree.z + tree.crownRadius >= bounds.minZ &&
        tree.z - tree.crownRadius <= bounds.maxZ
      )
        trees.push(tree);
    }
  return trees;
}
/** Shared material/density/fluid path for point queries, chunks and the worker neighbourhood. */
export function sampleMainVoxel(
  x: number,
  y: number,
  z: number,
  out: VoxelSample,
  column: Float64Array,
  trees: readonly TreeFeature[],
): VoxelSample {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z))
    throw new RangeError("Voxel point must be finite");
  out.fluid = Block.Air;
  if (
    x < WORLD_MIN_XZ ||
    x >= WORLD_MAX_XZ ||
    z < WORLD_MIN_XZ ||
    z >= WORLD_MAX_XZ ||
    y < WORLD_MIN_Y ||
    y >= WORLD_MAX_Y
  ) {
    out.density = -Infinity;
    out.block = Block.Air;
    return out;
  }
  if (y < WORLDSTONE_CEILING) {
    out.density = WORLDSTONE_CEILING - y;
    out.block = Block.Worldstone;
    return out;
  }
  const natural =
    (Number(column[MainColumn.NaturalHeight]) - y) *
    Number(column[MainColumn.DistanceScale]);
  const bridge = Math.min(
    Number(column[MainColumn.BridgeMargin]),
    Number(column[MainColumn.BridgeTop]) - y,
  );
  out.density = Math.max(natural, bridge);
  out.block =
    natural > 0
      ? mainTerrainMaterial(y, column)
      : bridge > 0
        ? Block.Cobblestone
        : Block.Air;
  for (const tree of trees) {
    const dx = x - tree.x;
    const dz = z - tree.z;
    const horizontal = dx * dx + dz * dz;
    if (horizontal > tree.crownRadius * tree.crownRadius) continue;
    const trunk = Math.min(
      tree.trunkRadius - Math.sqrt(horizontal),
      y - tree.baseY,
      tree.trunkTop - y,
    );
    const vertical = (y - tree.crownY) / tree.crownHeight;
    const crown =
      (1 -
        Math.sqrt(
          horizontal / (tree.crownRadius * tree.crownRadius) +
            vertical * vertical,
        )) *
      Math.min(tree.crownRadius, tree.crownHeight);
    if (trunk > 0 && (out.block === Block.Air || out.block === Block.Leaves))
      out.block = Block.Log;
    else if (crown > 0 && out.block === Block.Air) out.block = Block.Leaves;
    out.density = Math.max(out.density, trunk, crown);
  }
  if (out.block === Block.Air && y < Number(column[MainColumn.WaterLevel])) {
    out.block = Block.Water;
    out.fluid = Block.Water;
  }
  return out;
}
