import { Block, type BlockId } from "../../blocks/registry.js";

export interface SmithyVoxel {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly block: BlockId;
}
export interface SmithyBox {
  readonly min: readonly [number, number, number];
  /** Exclusive upper bound, metres. */
  readonly max: readonly [number, number, number];
}
const box = (
  min: readonly [number, number, number],
  max: readonly [number, number, number],
): SmithyBox =>
  Object.freeze({ min: Object.freeze(min), max: Object.freeze(max) });
const min = [-1, -1, -3] as const;
const size = [10, 9, 19] as const;
const cells = new Uint16Array(size[0] * size[1] * size[2]);
const index = (x: number, y: number, z: number): number =>
  x - min[0] + size[0] * (z - min[2] + size[2] * (y - min[1]));
function fill(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  block: BlockId,
): void {
  for (let y = y0; y < y1; y++)
    for (let z = z0; z < z1; z++)
      for (let x = x0; x < x1; x++) cells[index(x, y, z)] = block;
}

/** Roof underside above the finished floor. Three terraces, no ridge or loft. */
export const smithyRoofY = (x: number): number => (x < 2 ? 4 : x < 5 ? 5 : 6);
const frameZ = Object.freeze([0, 4, 8, 12, 13]);

// Origin is the front-left floor corner. The one-metre foundation is below it.
fill(0, -1, -3, 8, 0, 14, Block.Cobblestone);
fill(1, -1, 1, 7, 0, 13, Block.StoneBricks);
for (let x = 0; x < 8; x++) {
  for (const z of [0, 13])
    fill(x, 0, z, x + 1, smithyRoofY(x), z + 1, Block.Planks);
}
for (const x of [0, 7]) fill(x, 0, 0, x + 1, smithyRoofY(x), 14, Block.Planks);
for (const z of [0, 13]) fill(0, 0, z, 8, 1, z + 1, Block.StoneBricks);
for (const x of [0, 7]) fill(x, 0, 0, x + 1, 1, 14, Block.StoneBricks);
// Fire-facing walls are masonry; no wooden member crosses the exhaust duct.
fill(7, 0, 10, 8, 6, 14, Block.StoneBricks);
fill(5, 0, 13, 8, 6, 14, Block.StoneBricks);

// Grounded portal frames: six clear metres across, at most four between frames.
for (const z of frameZ) {
  for (const x of [0, 7])
    fill(x, 1, z, x + 1, smithyRoofY(x), z + 1, Block.Log);
  fill(0, 3, z, 8, 4, z + 1, Block.Log);
  for (let x = 0; x < 8; x++)
    fill(x, smithyRoofY(x) - 1, z, x + 1, smithyRoofY(x), z + 1, Block.Log);
  for (const x of [2, 5])
    fill(x, 4, z, x + 1, smithyRoofY(x), z + 1, Block.Log);
}
// High daylight slots stay glazed, so they are not accidental wall holes.
for (const z of [2, 6, 10]) fill(0, 2, z, 1, 3, z + 1, Block.Glass);
for (const z of [2, 6]) fill(7, 3, z, 8, 5, z + 1, Block.Glass);
for (let x = -1; x < 9; x++) {
  fill(x, smithyRoofY(x), -1, x + 1, smithyRoofY(x) + 1, 15, Block.DarkPlanks);
}
// Vertical risers give neighbouring terraces face contact rather than an edge.
fill(2, 4, -1, 3, 5, 15, Block.DarkPlanks);
fill(5, 5, -1, 6, 6, 15, Block.DarkPlanks);
fill(3, 0, 0, 5, 3, 1, Block.Air);

// Cold masonry forge and genuinely hollow exterior chimney. The mouth at
// (6,1,11) connects through (6,1,13) into the vertical shaft at (6,*,14).
fill(5, -1, 13, 8, 8, 16, Block.StoneBricks);
fill(6, 0, 14, 7, 8, 15, Block.Air);
fill(5, 0, 11, 8, 1, 14, Block.StoneBricks);
fill(5, 1, 11, 6, 3, 14, Block.StoneBricks);
fill(7, 1, 11, 8, 3, 14, Block.StoneBricks);
fill(5, 3, 11, 8, 4, 14, Block.StoneBricks);
fill(6, 1, 11, 7, 3, 15, Block.Air);
// Replace frame timber immediately around the hot bay with its masonry lintel.
fill(5, 4, 12, 8, 6, 14, Block.StoneBricks);
// A cold ash bed separates the working hearth from the surrounding masonry.
// Replace only occupied bed cells; the mouth and exhaust stay fully open.
fill(6, 0, 11, 7, 1, 14, Block.Ash);

const voxels: SmithyVoxel[] = [];
const counts = new Map<BlockId, number>();
for (let y = min[1]; y < min[1] + size[1]; y++)
  for (let z = min[2]; z < min[2] + size[2]; z++)
    for (let x = min[0]; x < min[0] + size[0]; x++) {
      const block = cells[index(x, y, z)] as BlockId;
      if (block === Block.Air) continue;
      voxels.push(Object.freeze({ x, y, z, block }));
      counts.set(block, (counts.get(block) ?? 0) + 1);
    }

/** Integer coordinates; no placement, collision or building-type validation. */
export function sampleEarlySmithy(x: number, y: number, z: number): BlockId {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z))
    throw new RangeError("Smithy samples require integer voxel coordinates");
  if (x < -1 || x >= 9 || y < -1 || y >= 8 || z < -3 || z >= 16)
    return Block.Air;
  return cells[index(x, y, z)] as BlockId;
}

export const EARLY_SMITHY = Object.freeze({
  id: "player_smithy_early_01",
  revision: 2,
  state: "geometry-study-pending-functional-parts",
  voxelSize: 1,
  bounds: box([-1, -1, -3], [9, 8, 16]),
  hall: box([0, 0, 0], [8, 7, 14]),
  pivot: Object.freeze([0, 0, 0] as const),
  forward: Object.freeze([0, 0, -1] as const),
  floorY: 0,
  interior: box([1, 0, 1], [7, 3, 13]),
  aisle: box([3, 0, -3], [5, 3, 13]),
  staging: box([1, 0, 1], [3, 3, 3]),
  voxels: Object.freeze(voxels),
  materialCounts: Object.freeze(
    [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([block, count]) => Object.freeze({ block, count })),
  ),
  anchors: Object.freeze({
    door: box([3, 0, 0], [5, 3, 1]),
    forge: box([5, 0, 11], [8, 4, 14]),
    anvil: box([1.25, 0, 10.5], [2.25, 0.95, 12.5]),
    bench: box([1, 0, 3], [1.75, 0.9, 5]),
    chimney: box([5, -1, 13], [8, 8, 16]),
  }),
  operators: Object.freeze({
    forge: box([6, 0, 10], [7, 3, 11]),
    anvil: box([2.25, 0, 11], [3.25, 3, 12]),
  }),
  flue: box([6, 0, 14], [7, 8, 15]),
  forgeState: "unlit",
  supportIntent: Object.freeze({
    frameZ,
    clearTieSpan: 6,
    maxRoofBay: 4,
    clearHeight: 3,
    overhang: 1,
  }),
  // Pivots sit just ahead/outside the masonry jambs: open leaves clear the full aisle.
  doors: Object.freeze([
    Object.freeze({
      pivot: Object.freeze([2.875, 0, -0.125] as const),
      direction: 1,
      width: 1.125,
      height: 3,
      thickness: 0.125,
    }),
    Object.freeze({
      pivot: Object.freeze([5.125, 0, -0.125] as const),
      direction: -1,
      width: 1.125,
      height: 3,
      thickness: 0.125,
    }),
  ]),
} as const);
