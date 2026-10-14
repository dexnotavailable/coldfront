import { describe, expect, it } from "vitest";
import {
  sampleWatchtower as sample,
  WATCHTOWER,
} from "../../src/assets/structures/watchtower.js";
import { BLOCK_REGISTRY, Block } from "../../src/blocks/registry.js";

function clear(x: number, y: number, z: number, height: number): void {
  for (let yy = Math.floor(y + 0.001); yy < y + height; yy++)
    for (let zz = Math.floor(z - 0.3); zz <= Math.floor(z + 0.3); zz++)
      for (let xx = Math.floor(x - 0.3); xx <= Math.floor(x + 0.3); xx++)
        expect(sample(xx, yy, zz), `clearance ${xx},${yy},${zz}`).toBe(
          Block.Air,
        );
}

describe("watchtower full-block geometry; runtime traversal is separate", () => {
  it("exports stable unique metre cells using existing structural materials", () => {
    const allowed = [
      Block.Log,
      Block.Planks,
      Block.Cobblestone,
      Block.StoneBricks,
      Block.Slate,
    ];
    const keys = new Set<string>();
    let previous = -Infinity;
    for (const v of WATCHTOWER.voxels) {
      expect([v.x, v.y, v.z].every(Number.isInteger)).toBe(true);
      expect(allowed).toContain(v.block);
      expect(BLOCK_REGISTRY[v.block]?.solid).toBe(true);
      const key = `${v.x},${v.y},${v.z}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
      const order = (v.y + 1) * 169 + (v.z + 1) * 13 + v.x + 1;
      expect(order).toBeGreaterThan(previous);
      previous = order;
      expect(sample(v.x, v.y, v.z)).toBe(v.block);
    }
    expect(Object.isFrozen(WATCHTOWER.voxels)).toBe(true);
    expect(sample(-100, 0, 0)).toBe(Block.Air);
    expect(() => sample(0.5, 1, 1)).toThrow(RangeError);
  });

  it("has a 25 m platform, a grounded footing and a flush 2 by 3 m entrance", () => {
    expect(WATCHTOWER.platformY - WATCHTOWER.groundY).toBe(25);
    expect(WATCHTOWER.platformY).toBeGreaterThanOrEqual(12);
    for (let z = 0; z < 11; z++)
      for (let x = 0; x < 11; x++) expect(sample(x, -1, z)).not.toBe(Block.Air);
    for (let x = 5; x < 7; x++)
      for (let y = 0; y < 3; y++) expect(sample(x, y, 0)).toBe(Block.Air);
    expect(WATCHTOWER.bounds.max[1]).toBe(32);
  });

  it("provides 25 full one-metre steps with two-metre width and jump clearance", () => {
    let count = 0;
    for (const f of WATCHTOWER.stairs.flights)
      for (let s = 0; s < 5; s++) {
        const y = f.bottom + s + 1;
        const z = f.direction === 1 ? 3.5 + s : 7.5 - s;
        for (const x of [f.x - 0.5, f.x + 0.5]) {
          expect(sample(Math.floor(x), y - 1, Math.floor(z))).toBe(
            Block.Planks,
          );
          clear(x, y, z, y === 25 ? 1.8 : 3.1);
        }
        count++;
      }
    expect(count).toBe(25);
    expect(WATCHTOWER.stairs.requiresJump).toBe(true);
  });

  it("keeps each two-metre landing and horizontal turn connected", () => {
    for (const f of WATCHTOWER.stairs.flights) {
      const z = f.direction === 1 ? 9 : 2;
      for (let x = 4; x <= 8; x += 0.25) {
        expect(sample(Math.floor(x), f.top - 1, z)).not.toBe(Block.Air);
        clear(x, f.top, z, 1.8);
      }
      // The next jump starts from either the landing or the preceding tread.
      if (f.top < 25) clear(f.direction === 1 ? 8 : 4, f.top, z, 3.1);
    }
    for (const [x, y, z] of WATCHTOWER.stairs.route) clear(x, y, z, 1.8);
  });

  it("connects the final stair to all four usable watch positions", () => {
    const queue: [number, number][] = [[4, 8]];
    const visited = new Set<string>();
    while (queue.length) {
      const [x, z] = queue.shift() as [number, number];
      const key = `${x},${z}`;
      if (visited.has(key) || x < 0 || x > 10 || z < 0 || z > 10) continue;
      if (
        sample(x, 24, z) === Block.Air ||
        sample(x, 25, z) !== Block.Air ||
        sample(x, 26, z) !== Block.Air
      )
        continue;
      visited.add(key);
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        queue.push([x + (dx as number), z + (dz as number)]);
    }
    for (const [x, y, z] of WATCHTOWER.watchPositions) {
      expect(visited.has(`${Math.floor(x)},${Math.floor(z)}`)).toBe(true);
      clear(x, y, z, 1.8);
    }
    expect(visited.size).toBeGreaterThan(50);
  });

  it("leaves eye-level outward openings at the four watch positions", () => {
    const directions = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const;
    WATCHTOWER.watchPositions.forEach(([x, y, z], i) => {
      const [dx, dz] = directions[i] as readonly [number, number];
      for (let d = 0; d <= 6; d += 0.25)
        expect(
          sample(
            Math.floor(x + dx * d),
            Math.floor(y + 1.62),
            Math.floor(z + dz * d),
          ),
        ).toBe(Block.Air);
    });
  });

  it("keeps decorative braces outside both authoritative stair lanes", () => {
    for (const brace of WATCHTOWER.decorativeBraces) {
      expect(brace.from[0]).toBe(brace.to[0]);
      expect(brace.from[0] < 2 || brace.from[0] > 9).toBe(true);
      expect(brace.block).toBe(Block.Log);
    }
  });
});
