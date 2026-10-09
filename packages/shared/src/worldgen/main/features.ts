/** Additive surface features shared by point, prepared and chunk sampling. */
import { Block } from "../../blocks/registry.js";
import { IBARA_MAX_REACH } from "../../features/ibara/cells.js";
import {
  createIbaraBatch,
  createIbaraField,
  type IbaraBatch,
  type IbaraField,
} from "../../features/ibara/field.js";
import {
  createIbaraSample,
  type IbaraSample,
} from "../../features/ibara/types.js";
import { hash3, hash4, rand01 } from "../../math/hash.js";
import type { Aabb } from "../../sdf/types.js";
import {
  WORLD_MAX_XZ,
  WORLD_MAX_Y,
  WORLD_MIN_XZ,
  WORLD_MIN_Y,
  WORLDSTONE_CEILING,
} from "../../world/constants.js";
import type {
  FeatureCacheStats,
  IbaraGroundSample,
  LavaSample,
  VoxelSample,
  XZBounds,
} from "../../world/types.js";
import { createLavaSample } from "../../worldplan/lava.js";
import {
  TERRAIN_RECIPES,
  type TerrainRecipe,
} from "../../worldplan/terrain.js";
import type { TreeFeature } from "../test-world.js";
import type { IbaraGround } from "./ibara-ground.js";
import { ibaraGroundMaterial, ibaraMaterial } from "./ibara-material.js";
import {
  createIbaraAnalytic,
  IBARA_SUPPORT,
  intersectsXZ,
} from "./ibara-volcanic.js";
import { MainColumn, type MainField, mainTerrainMaterial } from "./surface.js";
export const MAIN_TREE_CELL = 40;
export const MAIN_TREE_RADIUS = 4.75;
/** Actual maxima: trunk9 + crown3.5 - crown offset0.5 =12m above its anchor. */
export const MAIN_TREE_MAX_RISE = 12;
export const MAIN_IBARA_CACHE_CAPACITY = 256;
export interface MainIbaraField extends IbaraField {
  readonly cacheCapacity: number;
  groundWeightAt(x: number, z: number): number;
}
/** Placement reach includes overhanging features rooted outside the query. */
export function mayContainIbara(bounds: XZBounds): boolean {
  return intersectsXZ(bounds, {
    minX: IBARA_SUPPORT.minX - IBARA_MAX_REACH,
    minZ: IBARA_SUPPORT.minZ - IBARA_MAX_REACH,
    maxX: IBARA_SUPPORT.maxX + IBARA_MAX_REACH,
    maxZ: IBARA_SUPPORT.maxZ + IBARA_MAX_REACH,
  });
}
export function createMainIbaraField(
  field: MainField,
  capacity = MAIN_IBARA_CACHE_CAPACITY,
): MainIbaraField {
  const ground = field.ibara;
  if (!ground)
    throw new Error("Ibara features require the final volcanic field");
  const analytic = createIbaraAnalytic(field.data.seed);
  const features = createIbaraField(
    {
      seed: field.data.seed,
      surfaceAt: ground.height,
      weightAt: analytic.weight,
      lavaAt: ground.lavaAt,
    },
    capacity,
  );
  return Object.assign(features, {
    cacheCapacity: capacity,
    groundWeightAt: analytic.weight,
  });
}
export function mainFeatureCacheStats(
  features: MainIbaraField,
  preparedInstanceReferences: number,
): FeatureCacheStats {
  return Object.freeze({
    geometryCells: features.cachedCellCount,
    geometryCellLimit: features.cacheCapacity,
    placementCells: features.cachedPlacementCellCount,
    placementCellLimit: features.cacheCapacity,
    cachedInstances: features.cachedInstanceCount,
    preparedInstanceReferences,
  });
}
export interface IbaraDensityBatch {
  readonly instances: readonly { readonly bounds: Readonly<Aabb> }[];
  density: IbaraBatch["density"];
}
export interface MainIbaraSampler<B extends IbaraDensityBatch = IbaraBatch> {
  readonly ground: IbaraGround;
  readonly batch: B;
  readonly spacing: number;
  readonly groundSample: IbaraGroundSample;
  readonly featureSample: IbaraSample;
  readonly lavaSample: LavaSample;
  sampleGround?(
    x: number,
    y: number,
    z: number,
    column: Float64Array,
    out: IbaraGroundSample,
  ): IbaraGroundSample;
  sampleLava?(x: number, z: number, out: LavaSample): LavaSample;
}
export function prepareMainIbara(
  ground: IbaraGround,
  features: MainIbaraField,
  bounds: XZBounds,
  spacing: number,
): MainIbaraSampler {
  const instances = mayContainIbara(bounds)
    ? features.collect(
        { ...bounds, minY: WORLD_MIN_Y, maxY: WORLD_MAX_Y },
        spacing,
      )
    : [];
  return prepareIbaraSampler(
    ground,
    features.groundWeightAt,
    createIbaraBatch(instances),
    spacing,
  );
}
export function prepareIbaraSampler<B extends IbaraDensityBatch>(
  ground: IbaraGround,
  weightAt: (x: number, z: number) => number,
  batch: B,
  spacing: number,
): MainIbaraSampler<B> {
  let columnX: number | undefined,
    columnZ: number | undefined,
    weight = 0;
  let lavaX: number | undefined, lavaZ: number | undefined;
  const lavaColumn = createLavaSample();
  return {
    ground,
    batch,
    spacing,
    groundSample: { density: 0, surfaceY: 0, tag: "base" },
    featureSample: createIbaraSample(),
    lavaSample: createLavaSample(),
    sampleGround(x, y, z, column, out) {
      if (x !== columnX || z !== columnZ) {
        columnX = x;
        columnZ = z;
        weight = weightAt(x, z);
      }
      if (weight !== 0) return ground.sample(x, y, z, out);
      // A supplied final column is exactly the base column where weight is 0.
      // Reuse its binary64 values but still evaluate the feature batch below:
      // thorns rooted in Ibara may overhang this ordinary-ground column.
      out.surfaceY = Number(column[MainColumn.Height]);
      out.tag = "base";
      out.density = Math.max(
        (Number(column[MainColumn.NaturalHeight]) - y) *
          Number(column[MainColumn.DistanceScale]),
        Math.min(
          Number(column[MainColumn.BridgeMargin]),
          Number(column[MainColumn.BridgeTop]) - y,
        ),
      );
      return out;
    },
    sampleLava(x, z, out) {
      if (x !== lavaX || z !== lavaZ) {
        lavaX = x;
        lavaZ = z;
        ground.lavaQuery(x, z, lavaColumn);
      }
      out.bodyId = lavaColumn.bodyId;
      out.kind = lavaColumn.kind;
      out.source = lavaColumn.source;
      out.bed = lavaColumn.bed;
      out.level = lavaColumn.level;
      return out;
    },
  };
}
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
/** Complete raw solid composition/material before cleanup and fluid occupancy. */
export function sampleMainSolid(
  x: number,
  y: number,
  z: number,
  out: VoxelSample,
  column: Float64Array,
  trees: readonly TreeFeature[],
  ibara?: MainIbaraSampler<IbaraDensityBatch>,
): VoxelSample {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z))
    throw new RangeError("Voxel point must be finite");
  out.fluid = Block.Air;
  out.featureId = 0;
  out.featureT = 0;
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
  const terrainBlock = out.block;
  let ibaraSolid = false;
  if (ibara) {
    const ground = ibara.sampleGround
      ? ibara.sampleGround(x, y, z, column, ibara.groundSample)
      : ibara.ground.sample(x, y, z, ibara.groundSample);
    out.density = ibara.batch.density(
      ground.density,
      x,
      y,
      z,
      ibara.spacing,
      ibara.featureSample,
    );
    if (out.density > 0) {
      ibaraSolid = true;
      // Mark occupancy for later additive trees; choose volcanic material only
      // after final density and owned fluids have been resolved.
      if (out.block === Block.Air) out.block = Block.Basalt;
      out.featureId = ibara.featureSample.featureId;
      out.featureT = ibara.featureSample.t;
    } else out.block = Block.Air;
  }
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
  // Explicit carvers belong here, after all additive density. The current
  // volcanic excavation is already part of ground; no ambient cave may inherit
  // its fluid level merely by being below a nearby source.
  if (out.density <= 0) {
    out.featureId = 0;
    out.featureT = 0;
  }
  if (ibara && ibaraSolid && out.density > 0) {
    const ground = ibara.groundSample;
    // Surface tags are a skin; ash/vent crust never replaces the deep column.
    const tag =
      ground.surfaceY - y > 4 && ground.tag !== "base" ? "base" : ground.tag;
    const material = ibaraGroundMaterial(tag, mainTerrainMaterial(y, column));
    out.block = ibara.featureSample.featureId
      ? ibaraMaterial(x, y, z, material, ibara.featureSample)
      : ground.tag === "base" && terrainBlock !== Block.Air
        ? terrainBlock
        : material;
  }
  return out;
}

/** Called after generation cleanup as well as on the unchanged raw path. Fluid
 * ownership/bed tests stay authoritative; an absent solid invents no fluid. */
export function resolveMainFluids(
  x: number,
  y: number,
  z: number,
  out: VoxelSample,
  column: Float64Array,
  ibara?: MainIbaraSampler<IbaraDensityBatch>,
): VoxelSample {
  if (
    x < WORLD_MIN_XZ ||
    x >= WORLD_MAX_XZ ||
    z < WORLD_MIN_XZ ||
    z >= WORLD_MAX_XZ ||
    y < WORLD_MIN_Y ||
    y >= WORLD_MAX_Y
  )
    return out;
  if (ibara && out.density < 0) {
    const lava = ibara.sampleLava
      ? ibara.sampleLava(x, z, ibara.lavaSample)
      : ibara.ground.lavaQuery(x, z, ibara.lavaSample);
    if (
      lava.kind === "lava" &&
      lava.bodyId !== 0 &&
      lava.bed < y &&
      y <= lava.level
    ) {
      out.block = Block.Lava;
      out.fluid = Block.Lava;
      return out;
    }
  }
  if (out.block === Block.Air && y < Number(column[MainColumn.WaterLevel])) {
    out.block = Block.Water;
    out.fluid = Block.Water;
  }
  return out;
}

/** A removed unit cell has strictly negative density, including a raw zero.
 * This voxel policy introduces a subvoxel discontinuity; it is no longer a
 * smooth SDF across the removed cell's faces. Surviving cells are untouched. */
export function suppressMainSolid(out: VoxelSample): VoxelSample {
  out.density = -Math.max(Math.abs(out.density), Number.EPSILON);
  out.block = Block.Air;
  out.fluid = Block.Air;
  out.featureId = 0;
  out.featureT = 0;
  return out;
}

/** Shared raw material/density/fluid path. Cleanup is owned by WorldContext. */
export function sampleMainVoxel(
  x: number,
  y: number,
  z: number,
  out: VoxelSample,
  column: Float64Array,
  trees: readonly TreeFeature[],
  ibara?: MainIbaraSampler<IbaraDensityBatch>,
): VoxelSample {
  sampleMainSolid(x, y, z, out, column, trees, ibara);
  return resolveMainFluids(x, y, z, out, column, ibara);
}
