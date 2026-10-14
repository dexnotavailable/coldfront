import { Block, type BlockId } from "../../blocks/registry.js";

/** A hand-authored, metre-grid house study; no simulation or placement policy. */
export interface HouseVoxel {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly block: BlockId;
}
export interface HouseBox {
  readonly min: readonly [number, number, number];
  /** Exclusive upper bound, in metres. */
  readonly max: readonly [number, number, number];
}
const box = (
  min: readonly [number, number, number],
  max: readonly [number, number, number],
): HouseBox =>
  Object.freeze({ min: Object.freeze(min), max: Object.freeze(max) });

const size = Object.freeze([12, 11, 17] as const);
const cells = new Uint16Array(size[0] * size[1] * size[2]);
const index = (x: number, y: number, z: number): number =>
  x + size[0] * (z + size[2] * y);
function fill(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  block: BlockId,
): void {
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) cells[index(x, y, z)] = block;
}
const roofY = (x: number): number => 9 - Math.abs(x - 6);

// One level foundation. Site preparation must bring the approach to y=1;
// the asset has no hidden one-metre step or decorative, unwalkable stairs.
fill(2, 0, 4, 10, 0, 14, Block.Cobblestone);
fill(3, 0, 5, 9, 0, 13, Block.Planks);
fill(5, 0, 1, 7, 0, 3, Block.StoneBricks);

// Three clear metres below the tie beams. Long walls have supported bays
// of at most four metres; transverse log ties span seven clear metres.
fill(2, 1, 4, 2, 4, 14, Block.Limestone);
fill(10, 1, 4, 10, 4, 14, Block.Limestone);
for (const z of [4, 14])
  for (let x = 2; x <= 10; x++)
    fill(x, 1, z, x, roofY(x) - 1, z, Block.Limestone);
for (const x of [2, 10]) {
  fill(x, 1, 4, x, 1, 14, Block.StoneBricks);
  for (const z of [4, 8, 11, 14]) fill(x, 1, z, x, 4, z, Block.Log);
  fill(x, 4, 4, x, 4, 14, Block.Log);
}
for (const z of [4, 8, 11, 14]) fill(2, 4, z, 10, 4, z, Block.Log);
for (const z of [4, 14]) {
  fill(6, 3, z, 6, 8, z, Block.Log);
  fill(3, 5, z, 9, 5, z, Block.DarkPlanks);
  // Gable window, seated within the timber chord and king post.
  fill(5, 6, z, 5, 6, z, Block.Glass);
  fill(7, 6, z, 7, 6, z, Block.Glass);
}
// Glazed openings are physically solid under the current block registry.
for (const x of [2, 10])
  for (const z of [6, 12]) fill(x, 2, z, x, 2, z + 1, Block.Glass);
for (const z of [4, 14]) {
  fill(3, 2, z, 4, 2, z, Block.Glass);
  fill(8, 2, z, 9, 2, z, Block.Glass);
}

// Broad slate planes, a long ridge and timber bargeboards. Every
// roof cube remains an ordinary voxel for future block-by-block construction.
for (let x = 1; x <= 11; x++) {
  fill(x, roofY(x), 3, x, roofY(x), 15, Block.Slate);
  for (const z of [3, 15])
    fill(x, roofY(x), z, x, roofY(x), z, Block.DarkPlanks);
}
fill(6, 9, 3, 6, 9, 15, Block.DarkPlanks);

// A shallow covered stone stoop keeps the threshold visible from above.
// Its one-metre canopy cantilever is anchored into the front wall; bulky
// free-standing posts would swallow the one-metre doorway at this scale.
for (let x = 5; x <= 7; x++) {
  const y = 4 - Math.abs(x - 6);
  fill(x, y, 3, x, y, 3, Block.DarkPlanks);
}
fill(5, 1, 4, 5, 3, 4, Block.Limestone);
fill(7, 1, 4, 7, 3, 4, Block.Limestone);
fill(6, 3, 4, 6, 3, 4, Block.Limestone);
fill(6, 1, 4, 6, 2, 4, Block.Air);

// The grounded chimney is integrated into the rear gable, next to the ridge,
// so the roof encloses most of its mass. It consumes no living-room volume.
// A real one-metre flue rises from the unlit firebox to the open crown.
fill(5, 0, 14, 7, 9, 16, Block.Cobblestone);
fill(5, 10, 14, 7, 10, 16, Block.StoneBricks);
fill(6, 1, 15, 6, 10, 15, Block.Air);
fill(6, 1, 14, 6, 2, 14, Block.Air);
fill(5, 0, 12, 7, 0, 15, Block.Slate);
fill(5, 3, 14, 7, 3, 14, Block.StoneBricks);

const voxels: HouseVoxel[] = [];
const counts = new Map<BlockId, number>();
for (let y = 0; y < size[1]; y++)
  for (let z = 0; z < size[2]; z++)
    for (let x = 0; x < size[0]; x++) {
      const block = cells[index(x, y, z)] as BlockId;
      if (block === Block.Air) continue;
      voxels.push(Object.freeze({ x, y, z, block }));
      counts.set(block, (counts.get(block) ?? 0) + 1);
    }

/** Integer local coordinates only. Outside the template is air. */
export function sampleHearthlandsHouse(
  x: number,
  y: number,
  z: number,
): BlockId {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z))
    throw new RangeError("House samples require integer voxel coordinates");
  if (x < 0 || x >= size[0] || y < 0 || y >= size[1] || z < 0 || z >= size[2])
    return Block.Air;
  return cells[index(x, y, z)] as BlockId;
}

export const HEARTHLANDS_HOUSE = Object.freeze({
  id: "hearthlands-house",
  buildingType: "house",
  regionId: "plains",
  revision: 4,
  voxelSize: 1,
  size,
  bounds: box([1, 0, 1], [12, 11, 17]),
  /** Placement origin on the foundation's bottom plane; entrance faces -Z. */
  pivot: Object.freeze([6.5, 0, 4] as const),
  forward: Object.freeze([0, 0, -1] as const),
  floorY: 1,
  interior: box([3, 1, 5], [10, 4, 14]),
  usableFloorArea: 63,
  approach: Object.freeze([6.5, 1, 0.5] as const),
  entry: Object.freeze([6.5, 1, 4.5] as const),
  /** Stable y/z/x order is inspectable; this is not a construction scheduler. */
  voxels: Object.freeze(voxels),
  materialCounts: Object.freeze(
    [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([block, count]) => Object.freeze({ block, count })),
  ),
  pendingParts: Object.freeze({
    door: box([6, 1, 4], [7, 3, 5]),
    /** A closed firebox/throat seal is needed before the room is sealed. */
    hearth: box([6, 1, 14], [7, 3, 15]),
    lamp: Object.freeze([5.5, 2.5, 3.5] as const),
    beds: Object.freeze([
      box([3, 1, 11], [4, 2, 13]),
      box([8, 1, 12], [9, 2, 14]),
    ]),
  }),
  chimney: box([5, 0, 14], [8, 11, 17]),
  flue: box([6, 1, 15], [7, 11, 16]),
  supportIntent: Object.freeze({
    maxWallBay: 4,
    clearTieSpan: 7,
    clearHeight: 3,
    porchCantilever: 1,
  }),
  state: "geometry-study-pending-functional-parts",
} as const);
