/** Test-world recipe: docs/04-terrain.md section 11; no WorldPlan until phase 1.2. */
import { Block, type BlockId } from "../blocks/registry.js";
import { hash3, hash4, rand01 } from "../math/hash.js";
import { createNoise2Sample, openSimplex2 } from "../noise/opensimplex2.js";
import {
  WORLD_MAX_XZ,
  WORLD_MAX_Y,
  WORLD_MIN_XZ,
  WORLD_MIN_Y,
  WORLDSTONE_CEILING,
} from "../world/constants.js";

/** Float64 column layout, reusable at every sample spacing. Water level is -Infinity when dry. */
export const Column = Object.freeze({
  MacroMeso: 0,
  Micro: 1,
  Height: 2,
  Dx: 3,
  Dz: 4,
  DistanceScale: 5,
  WaterLevel: 6,
  PondRadiusSquared: 7,
  Stride: 8,
} as const);
export const TEST_POND = Object.freeze({
  x: 44,
  z: 24,
  radiusX: 23,
  radiusZ: 18,
  level: 0,
  bottom: -4,
});
export const TREE_CELL_SIZE = 40;
export const MAX_TREE_RADIUS = 5;
const SPAWN_FLAT_RADIUS = 6;
const SPAWN_BLEND_RADIUS = 16;
const SPAWN_HEIGHT = 6;

export function createColumnSample(): Float64Array {
  return new Float64Array(Column.Stride);
}
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
function smoothDerivative(t: number): number {
  return 6 * t * (1 - t);
}

/**
 * Write height, true analytic height gradient and pond data at a world point.
 * Three explicit scales: 2048m macro, 180m meso, 16m micro. Finite x/z required.
 * Caller may reuse one six-lane noise scratch buffer (distinct from out).
 */
export function sampleTestColumn(
  seed: number,
  x: number,
  z: number,
  out: Float64Array,
  scratch = createNoise2Sample(),
): Float64Array {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(z) ||
    Math.abs(x) > 1_000_000 ||
    Math.abs(z) > 1_000_000
  )
    throw new RangeError("Column outside supported world-query range");
  if (out === scratch || out.length < Column.Stride || scratch.length < 6)
    throw new RangeError("Invalid column buffers");
  openSimplex2(seed, x / 2048 + 7.25, z / 2048 - 3.5, scratch);
  let hm = 9 + 12 * (scratch[0] as number);
  let dx = (12 / 2048) * (scratch[1] as number);
  let dz = (12 / 2048) * (scratch[2] as number);
  openSimplex2(seed ^ 0x3c6ef372, x / 180, z / 180, scratch);
  hm += 5 * (scratch[0] as number);
  dx += (5 / 180) * (scratch[1] as number);
  dz += (5 / 180) * (scratch[2] as number);
  openSimplex2(seed ^ 0x510e527f, x / 16, z / 16, scratch);
  let micro = 0.8 * (scratch[0] as number);
  dx += (0.8 / 16) * (scratch[1] as number);
  dz += (0.8 / 16) * (scratch[2] as number);
  let height = hm + micro;

  const px = (x - TEST_POND.x) / TEST_POND.radiusX;
  const pz = (z - TEST_POND.z) / TEST_POND.radiusZ;
  const radius2 = px * px + pz * pz;
  const radiusX = (2 * px) / TEST_POND.radiusX;
  const radiusZ = (2 * pz) / TEST_POND.radiusZ;
  // The bowl is closed: a +3m rim at r=1, with a C1 blend outside it.
  if (radius2 < 2.25) {
    const bowl = TEST_POND.bottom + 7 * radius2;
    const u = Math.max(0, (radius2 - 1) / 1.25);
    const blend = 1 - smooth(u);
    const blendD = radius2 > 1 ? -smoothDerivative(u) / 1.25 : 0;
    const delta = bowl - height;
    dx = dx * (1 - blend) + 7 * radiusX * blend + delta * blendD * radiusX;
    dz = dz * (1 - blend) + 7 * radiusZ * blend + delta * blendD * radiusZ;
    hm = hm * (1 - blend) + bowl * blend;
    micro *= 1 - blend;
    height = hm + micro;
  }

  const spawnRadius = Math.sqrt(x * x + z * z);
  if (spawnRadius < SPAWN_BLEND_RADIUS) {
    const u = Math.max(
      0,
      (spawnRadius - SPAWN_FLAT_RADIUS) /
        (SPAWN_BLEND_RADIUS - SPAWN_FLAT_RADIUS),
    );
    const blend = 1 - smooth(u);
    const blendD =
      spawnRadius > SPAWN_FLAT_RADIUS
        ? -smoothDerivative(u) / (SPAWN_BLEND_RADIUS - SPAWN_FLAT_RADIUS)
        : 0;
    const delta = SPAWN_HEIGHT - height;
    dx =
      dx * (1 - blend) +
      (spawnRadius === 0 ? 0 : (delta * blendD * x) / spawnRadius);
    dz =
      dz * (1 - blend) +
      (spawnRadius === 0 ? 0 : (delta * blendD * z) / spawnRadius);
    hm = hm * (1 - blend) + SPAWN_HEIGHT * blend;
    micro *= 1 - blend;
    height = hm + micro;
  }
  out[Column.MacroMeso] = hm;
  out[Column.Micro] = micro;
  out[Column.Height] = height;
  out[Column.Dx] = dx;
  out[Column.Dz] = dz;
  out[Column.DistanceScale] =
    1 / Math.sqrt(1 + Math.min(dx * dx + dz * dz, 64));
  out[Column.WaterLevel] =
    radius2 < 1 && height < TEST_POND.level ? TEST_POND.level : -Infinity;
  out[Column.PondRadiusSquared] = radius2;
  return out;
}

export interface TreeFeature {
  /** Stable feature identity is the pair of cell coordinates, not a collision-prone hash. */
  readonly cellX: number;
  readonly cellZ: number;
  readonly x: number;
  readonly z: number;
  readonly baseY: number;
  readonly trunkTop: number;
  readonly trunkRadius: number;
  readonly crownY: number;
  readonly crownRadius: number;
  readonly crownHeight: number;
}

/** One deterministic candidate per cell. Returns null when rejected by density, ground or spawn rules. */
export function testTreeInCell(
  seed: number,
  cellX: number,
  cellZ: number,
  column = createColumnSample(),
  scratch = createNoise2Sample(),
): TreeFeature | null {
  if (!Number.isInteger(cellX) || !Number.isInteger(cellZ))
    throw new RangeError("Integer feature cells required");
  const h = hash3(seed ^ 0x1f83d9ab, cellX, cellZ);
  if (rand01(h) > 0.38) return null;
  const x =
    cellX * TREE_CELL_SIZE + 4 + 32 * rand01(hash4(seed, cellX, cellZ, 1));
  const z =
    cellZ * TREE_CELL_SIZE + 4 + 32 * rand01(hash4(seed, cellX, cellZ, 2));
  const crownRadius = 3 + 2 * rand01(hash4(seed, cellX, cellZ, 3));
  if (
    x * x + z * z <
    (SPAWN_BLEND_RADIUS + crownRadius) * (SPAWN_BLEND_RADIUS + crownRadius)
  )
    return null;
  sampleTestColumn(seed, x, z, column, scratch);
  const height = column[Column.Height] as number;
  const slope2 =
    (column[Column.Dx] as number) * (column[Column.Dx] as number) +
    (column[Column.Dz] as number) * (column[Column.Dz] as number);
  if (
    height < 2 ||
    (column[Column.PondRadiusSquared] as number) < 1.4 ||
    slope2 > 0.5
  )
    return null;
  const trunkHeight = 5 + 4 * rand01(hash4(seed, cellX, cellZ, 4));
  return {
    cellX,
    cellZ,
    x,
    z,
    baseY: height - 2,
    trunkTop: height + trunkHeight,
    trunkRadius: 1 + 0.35 * rand01(hash4(seed, cellX, cellZ, 5)),
    crownY: height + trunkHeight - 0.5,
    crownRadius,
    crownHeight: 2.5 + rand01(hash4(seed, cellX, cellZ, 6)),
  };
}

/** Inclusive XZ AABB; stable cell-X then cell-Z order. Never asks a neighbour chunk. */
export function collectTestTrees(
  seed: number,
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
): readonly TreeFeature[] {
  if (
    ![minX, minZ, maxX, maxZ].every(Number.isFinite) ||
    minX > maxX ||
    minZ > maxZ ||
    Math.max(Math.abs(minX), Math.abs(minZ), Math.abs(maxX), Math.abs(maxZ)) >
      1_000_000
  )
    throw new RangeError("Invalid tree query bounds");
  const minCellX = Math.floor((minX - MAX_TREE_RADIUS) / TREE_CELL_SIZE);
  const minCellZ = Math.floor((minZ - MAX_TREE_RADIUS) / TREE_CELL_SIZE);
  const maxCellX = Math.floor((maxX + MAX_TREE_RADIUS) / TREE_CELL_SIZE);
  const maxCellZ = Math.floor((maxZ + MAX_TREE_RADIUS) / TREE_CELL_SIZE);
  if ((maxCellX - minCellX + 1) * (maxCellZ - minCellZ + 1) > 1_000_000)
    throw new RangeError("Tree query is too large; tile it");
  const trees: TreeFeature[] = [];
  const column = createColumnSample();
  const scratch = createNoise2Sample();
  for (let cx = minCellX; cx <= maxCellX; cx++) {
    for (let cz = minCellZ; cz <= maxCellZ; cz++) {
      const tree = testTreeInCell(seed, cx, cz, column, scratch);
      if (
        tree &&
        tree.x + tree.crownRadius >= minX &&
        tree.x - tree.crownRadius <= maxX &&
        tree.z + tree.crownRadius >= minZ &&
        tree.z - tree.crownRadius <= maxZ
      )
        trees.push(tree);
    }
  }
  return trees;
}

/** Point sample: positive density = solid. Fluid is separate; water never contributes solid density. */
export interface VoxelSample {
  density: number;
  block: BlockId;
  fluid: BlockId;
}
export function createVoxelSample(): VoxelSample {
  return { density: 0, block: Block.Air, fluid: Block.Air };
}

/** Terrain-only signed density. Column must have been sampled at this exact XZ. */
export function testTerrainDensity(y: number, column: Float64Array): number {
  return (
    ((column[Column.Height] as number) - y) *
    (column[Column.DistanceScale] as number)
  );
}
/** Surface/subsoil/deep material by real pointwise depth, never chunk-local height. */
export function testTerrainMaterial(y: number, column: Float64Array): BlockId {
  if (y < WORLDSTONE_CEILING) return Block.Worldstone;
  if (y < -48) return Block.DeepStone;
  const depth = (column[Column.Height] as number) - y;
  if (depth > 4) return Block.Stone;
  if (
    (column[Column.PondRadiusSquared] as number) < 1.4 &&
    (column[Column.Height] as number) < 2
  )
    return Block.Sand;
  // Here density has no displacement, so its 3D normal is proportional to (Hx,-1,Hz).
  const sx = column[Column.Dx] as number;
  const sz = column[Column.Dz] as number;
  if (sx * sx + sz * sz > 1.42) return Block.Stone;
  return depth < 1 ? Block.Grass : Block.Dirt;
}

/**
 * Same point query for chunks, halo, collision and future LOD. No spacing enters
 * the recipe. Optional column and trees are exact precomputations only, never
 * rounded caches. For hot loops supply both plus a reusable output object.
 */
export function sampleTestVoxel(
  seed: number,
  x: number,
  y: number,
  z: number,
  out: VoxelSample,
  column?: Float64Array,
  trees?: readonly TreeFeature[],
): VoxelSample {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z))
    throw new RangeError("Voxel position must be finite");
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
  const c = column ?? sampleTestColumn(seed, x, z, createColumnSample());
  out.density = testTerrainDensity(y, c);
  out.block = out.density > 0 ? testTerrainMaterial(y, c) : Block.Air;
  const candidates = trees ?? collectTestTrees(seed, x, z, x, z);
  for (const tree of candidates) {
    const dx = x - tree.x;
    const dz = z - tree.z;
    const horizontal2 = dx * dx + dz * dz;
    if (horizontal2 > tree.crownRadius * tree.crownRadius) continue;
    const trunk = Math.min(
      tree.trunkRadius - Math.sqrt(horizontal2),
      y - tree.baseY,
      tree.trunkTop - y,
    );
    const vertical = (y - tree.crownY) / tree.crownHeight;
    const crown =
      (1 -
        Math.sqrt(
          horizontal2 / (tree.crownRadius * tree.crownRadius) +
            vertical * vertical,
        )) *
      Math.min(tree.crownRadius, tree.crownHeight);
    if (trunk > 0 && (out.block === Block.Air || out.block === Block.Leaves))
      out.block = Block.Log;
    else if (crown > 0 && out.block === Block.Air) out.block = Block.Leaves;
    out.density = Math.max(out.density, trunk, crown);
  }
  if (out.block === Block.Air && y < (c[Column.WaterLevel] as number)) {
    out.block = Block.Water;
    out.fluid = Block.Water;
  }
  return out;
}

/** Feet position on the flat dry LOD0 origin plateau, with a clear 0.6 x 1.8m body. */
export function testWorldSpawn(): Readonly<{
  x: number;
  y: number;
  z: number;
}> {
  return { x: 0, y: SPAWN_HEIGHT, z: 0 };
}
