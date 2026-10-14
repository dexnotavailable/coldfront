import { describe, expect, it } from "vitest";
import {
  type HouseBox,
  HEARTHLANDS_HOUSE as house,
  sampleHearthlandsHouse as sample,
} from "../src/assets/structures/hearthlands-house.js";
import { BLOCK_REGISTRY, Block } from "../src/blocks/registry.js";

function inside(box: HouseBox, x: number, y: number, z: number): boolean {
  return (
    x >= box.min[0] &&
    x < box.max[0] &&
    y >= box.min[1] &&
    y < box.max[1] &&
    z >= box.min[2] &&
    z < box.max[2]
  );
}
/** Does an air flood from the living room reach outside the asset envelope? */
function leaks(closures: readonly HouseBox[]): boolean {
  const queue: [number, number, number][] = [[6, 1, 7]];
  const seen = new Set<string>();
  for (let head = 0; head < queue.length; head++) {
    const [x, y, z] = queue[head] as [number, number, number];
    if (
      x < 0 ||
      x >= house.size[0] ||
      y < 0 ||
      y >= house.size[1] ||
      z < 0 ||
      z >= house.size[2]
    )
      return true;
    const key = `${x},${y},${z}`;
    if (
      seen.has(key) ||
      BLOCK_REGISTRY[sample(x, y, z)]?.solid ||
      closures.some((b) => inside(b, x, y, z))
    )
      continue;
    seen.add(key);
    queue.push(
      [x - 1, y, z],
      [x + 1, y, z],
      [x, y - 1, z],
      [x, y + 1, z],
      [x, y, z - 1],
      [x, y, z + 1],
    );
  }
  return false;
}

describe("Hearthlands house geometry study", () => {
  it("exposes every solid voxel once, with exact bounds and material counts", () => {
    const counts = new Map<number, number>();
    let previous = -1;
    for (const voxel of house.voxels) {
      const { x, y, z, block } = voxel;
      const key = x + house.size[0] * (z + house.size[2] * y);
      expect(key).toBeGreaterThan(previous);
      previous = key;
      expect(sample(x, y, z)).toBe(block);
      expect(BLOCK_REGISTRY[block]?.solid).toBe(true);
      expect(inside(house.bounds, x, y, z)).toBe(true);
      counts.set(block, (counts.get(block) ?? 0) + 1);
    }
    expect(
      [...counts]
        .sort((a, b) => a[0] - b[0])
        .map(([block, count]) => ({ block, count })),
    ).toEqual(house.materialCounts);
    for (let axis = 0; axis < 3; axis++) {
      const values = house.voxels.map((v) => [v.x, v.y, v.z][axis] as number);
      expect(Math.min(...values)).toBe(house.bounds.min[axis]);
      expect(Math.max(...values) + 1).toBe(house.bounds.max[axis]);
    }
    expect(sample(-1, 1, 1)).toBe(Block.Air);
    expect(sample(13, 1, 1)).toBe(Block.Air);
    expect(() => sample(1.5, 1, 1)).toThrow(RangeError);
  });

  it("keeps a flush approach and 2 m doorway for the 1.8 m avatar", () => {
    for (let z = 1; z <= 13; z++) {
      expect(BLOCK_REGISTRY[sample(6, 0, z)]?.solid).toBe(true);
      expect(sample(6, 1, z)).toBe(Block.Air);
      expect(sample(6, 2, z)).toBe(Block.Air);
    }
    let usableFloorArea = 0;
    for (let z = 5; z <= 13; z++)
      for (let x = 3; x <= 9; x++) {
        expect(BLOCK_REGISTRY[sample(x, 0, z)]?.solid).toBe(true);
        for (let y = 1; y <= 3; y++) expect(sample(x, y, z)).toBe(Block.Air);
        usableFloorArea++;
      }
    expect(usableFloorArea).toBe(house.usableFloorArea);
    expect(
      house.pendingParts.door.max[1] - house.pendingParts.door.min[1],
    ).toBe(2);
  });

  it("is honestly open now, and enclosed only after the two declared parts close", () => {
    expect(leaks([])).toBe(true);
    expect(leaks([house.pendingParts.door])).toBe(true);
    expect(leaks([house.pendingParts.hearth])).toBe(true);
    expect(leaks([house.pendingParts.door, house.pendingParts.hearth])).toBe(
      false,
    );
    for (let y = house.flue.min[1]; y < house.flue.max[1]; y++)
      expect(sample(house.flue.min[0], y, house.flue.min[2])).toBe(Block.Air);
  });

  it("grounds every perimeter post and keeps the documented timber spans", () => {
    for (const x of [2, 10])
      for (const z of [4, 8, 11, 14])
        for (let y = 0; y <= 4; y++)
          expect(BLOCK_REGISTRY[sample(x, y, z)]?.solid).toBe(true);
    for (const z of [4, 8, 11, 14])
      for (let x = 2; x <= 9; x++)
        if (inside(house.chimney, x, 4, z))
          expect(BLOCK_REGISTRY[sample(x, 4, z)]?.solid).toBe(true);
        else expect(sample(x, 4, z)).toBe(Block.Log);
    for (const x of [5, 7])
      for (const z of [14, 16])
        for (let y = 0; y < 11; y++)
          expect(BLOCK_REGISTRY[sample(x, y, z)]?.solid).toBe(true);
    expect(house.supportIntent.porchCantilever).toBeLessThanOrEqual(4);
    expect(house.supportIntent.clearTieSpan).toBeLessThanOrEqual(8);
    expect(house.supportIntent.maxWallBay).toBeLessThanOrEqual(4);
  });
});
