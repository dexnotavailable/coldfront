import { Block, type BlockId } from "../../blocks/registry.js";

export type WatchtowerPoint = readonly [number, number, number];
export interface WatchtowerBox {
  readonly min: WatchtowerPoint;
  /** Exclusive upper bound, metres. */
  readonly max: WatchtowerPoint;
}
export interface WatchtowerVoxel {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly block: BlockId;
}
export interface WatchtowerBrace {
  readonly from: WatchtowerPoint;
  readonly to: WatchtowerPoint;
  readonly width: number;
  readonly block: BlockId;
}
const point = (x: number, y: number, z: number): WatchtowerPoint =>
  Object.freeze([x, y, z] as const);
const box = (min: WatchtowerPoint, max: WatchtowerPoint): WatchtowerBox =>
  Object.freeze({ min: Object.freeze(min), max: Object.freeze(max) });
const min = [-1, -1, -1] as const;
const size = [13, 33, 13] as const;
const cells = new Uint16Array(size[0] * size[1] * size[2]);
const index = (x: number, y: number, z: number): number =>
  x + 1 + size[0] * (z + 1 + size[2] * (y + 1));
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

// The footing is buried; the doorway and surrounding ground are flush at zero.
fill(0, -1, 0, 11, 0, 11, Block.Cobblestone);
for (const z of [0, 10]) fill(0, 0, z, 11, 5, z + 1, Block.StoneBricks);
for (const x of [0, 10]) fill(x, 0, 0, x + 1, 5, 11, Block.StoneBricks);
fill(5, 0, 0, 7, 3, 1, Block.Air);
for (const x of [0, 10]) fill(x, 2, 5, x + 1, 4, 6, Block.Air);
fill(5, 2, 10, 6, 4, 11, Block.Air);
for (const x of [1, 9])
  for (const z of [1, 9]) fill(x, 0, z, x + 1, 28, z + 1, Block.Log);

// Upper platform, with an opening above the last flight's lower four treads.
fill(0, 24, 0, 11, 25, 11, Block.Planks);
fill(3, 24, 3, 5, 25, 7, Block.Air);
for (const z of [0, 10]) fill(0, 25, z, 11, 26, z + 1, Block.Log);
for (const x of [0, 10]) fill(x, 25, 0, x + 1, 26, 11, Block.Log);
for (const x of [2, 5]) fill(x, 25, 3, x + 1, 26, 7, Block.Log);
fill(3, 25, 2, 5, 26, 3, Block.Log);
// Stepped slate hip, three metres of clear height at its lowest underside.
for (let tier = 0; tier < 4; tier++)
  fill(
    -1 + tier * 2,
    28 + tier,
    -1 + tier * 2,
    12 - tier * 2,
    29 + tier,
    12 - tier * 2,
    Block.Slate,
  );

const route: WatchtowerPoint[] = [
  point(6, 0, -1),
  point(6, 0, 2),
  point(4, 0, 2),
];
const flights: Readonly<{
  index: number;
  bottom: number;
  top: number;
  x: number;
  direction: 1 | -1;
}>[] = [];
for (let flight = 0; flight < 5; flight++) {
  const bottom = flight * 5;
  const direction = flight % 2 === 0 ? 1 : -1;
  const x0 = direction === 1 ? 3 : 7;
  flights.push(
    Object.freeze({
      index: flight,
      bottom,
      top: bottom + 5,
      x: x0 + 1,
      direction,
    }),
  );
  for (let step = 0; step < 5; step++) {
    const z = direction === 1 ? 3 + step : 7 - step;
    const top = bottom + step + 1;
    // Solid stair wedges bear on the landing below. Every tread is a full
    // voxel; current Minecraft-style jumping is required for each rise.
    fill(x0, bottom - 1, z, x0 + 2, top, z + 1, Block.Planks);
    // Inner one-metre guard follows each step. It cannot substitute for
    // physical access: the full two-metre stair beside it stays clear.
    const railX = direction === 1 ? 5 : 6;
    fill(railX, top - 1, z, railX + 1, top + 1, z + 1, Block.Log);
    const outerRailX = direction === 1 ? 2 : 9;
    fill(outerRailX, top - 1, z, outerRailX + 1, top + 1, z + 1, Block.Log);
    route.push(point(x0 + 1, top, z + 0.5));
  }
  const top = bottom + 5;
  const z0 = direction === 1 ? 8 : 1;
  fill(2, top - 1, z0, 9, top, z0 + 2, Block.Planks);
  // Outer landing guard is clear of the 2 m turning surface.
  const guardZ = direction === 1 ? 10 : 0;
  fill(2, top - 1, guardZ, 9, top + 1, guardZ + 1, Block.Log);
  for (const x of [1, 9]) fill(x, top, z0, x + 1, top + 1, z0 + 2, Block.Log);
  // Full-grid bearing ties connect directly to corner columns.
  const tieZ = direction === 1 ? 9 : 1;
  fill(1, top - 1, tieZ, 10, top, tieZ + 1, Block.Log);
  route.push(point(x0 + 1, top, z0 + 1));
  if (flight < 4) route.push(point(direction === 1 ? 8 : 4, top, z0 + 1));
}
// Outer longitudinal ties stay beside, never across, the jumping lanes.
for (const y of [4, 9, 14, 19, 24, 27])
  for (const x of [1, 9]) fill(x, y, 1, x + 1, y + 1, 10, Block.Log);
// Top opening must keep its lower treads clear after the guard pass.
fill(3, 24, 3, 5, 25, 7, Block.Air);
// Restore the fourth tread at y=24: cutting a platform cannot cut its stairs.
fill(3, 23, 6, 5, 24, 7, Block.Planks);

const braces: WatchtowerBrace[] = [];
for (let bay = 1; bay < 5; bay++)
  for (const x of [1.25, 9.75])
    braces.push(
      Object.freeze({
        from: point(x, bay * 5 + 0.25, 2),
        to: point(x, bay * 5 + 4.75, 9),
        width: 0.25,
        block: Block.Log,
      }),
    );

const voxels: WatchtowerVoxel[] = [];
for (let y = min[1]; y < min[1] + size[1]; y++)
  for (let z = min[2]; z < min[2] + size[2]; z++)
    for (let x = min[0]; x < min[0] + size[0]; x++) {
      const block = cells[index(x, y, z)] as BlockId;
      if (block !== Block.Air) voxels.push(Object.freeze({ x, y, z, block }));
    }

/** All primary massing and all access geometry use this metre-grid sampler. */
export function sampleWatchtower(x: number, y: number, z: number): BlockId {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z))
    throw new RangeError(
      "Watchtower samples require integer voxel coordinates",
    );
  if (x < -1 || x >= 12 || y < -1 || y >= 32 || z < -1 || z >= 12)
    return Block.Air;
  return cells[index(x, y, z)] as BlockId;
}
export const WATCHTOWER = Object.freeze({
  id: "player-watchtower-early-01",
  revision: 1,
  voxelSize: 1,
  bounds: box(min, [12, 32, 12]),
  pivot: point(5.5, 0, 0),
  forward: point(0, 0, -1),
  groundY: 0,
  platformY: 25,
  roofUnderside: 28,
  entrance: box([5, 0, 0], [7, 3, 1]),
  platform: box([0, 24, 0], [11, 25, 11]),
  stairwell: box([3, 24, 3], [5, 25, 7]),
  stairs: Object.freeze({
    rise: 1,
    tread: 1,
    width: 2,
    landingDepth: 2,
    requiresJump: true,
    flights: Object.freeze(flights),
    route: Object.freeze(route),
    checkedBodyWidth: 0.6,
    checkedJumpEnvelope: 3.1,
  }),
  watchPositions: Object.freeze([
    point(7.5, 25, 1.5),
    point(9.5, 25, 5.5),
    point(6, 25, 9.5),
    point(1.5, 25, 5.5),
  ]),
  voxels: Object.freeze(voxels),
  decorativeBraces: Object.freeze(braces),
  state: "geometry-study-pending-controller-and-visual-review",
} as const);
