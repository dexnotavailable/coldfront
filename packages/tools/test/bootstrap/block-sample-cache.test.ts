import { describe, expect, it } from "vitest";
import {
  BLOCK_SAMPLE_PAGE_BYTES,
  BLOCK_SAMPLE_PAGE_LIMIT,
  BlockSampleCache,
} from "../../../client/src/engine/block-sample-cache.js";
import { Block } from "../../../shared/src/blocks/registry.js";
import type {
  VoxelSample,
  WorldAreaSampler,
} from "../../../shared/src/world/types.js";

function fixture(
  blockAt = (x: number, y: number, z: number) =>
    (Math.abs(x + 3 * y + 7 * z) % 4) + 1,
) {
  const calls: number[][] = [],
    column = new Float64Array([1 + 2 ** -40]),
    voxel: VoxelSample = { density: 0, block: 0, fluid: 0 };
  const area = {
    sampleVoxel(x, y, z, out, c) {
      expect(c).toBe(column);
      calls.push([x, y, z]);
      out.block = blockAt(Math.floor(x), Math.floor(y), Math.floor(z));
      return out;
    },
  } as WorldAreaSampler;
  return {
    calls,
    sample: (cache: BlockSampleCache, x: number, y: number, z: number) =>
      cache.sample(area, x, y, z, column, voxel),
  };
}

describe("generation-only lighting block pages", () => {
  it("uses canonical negative owners, exact cell centres and a separate Air validity bit", () => {
    const cache = new BlockSampleCache(),
      f = fixture(() => Block.Air);
    const cells = [
      [-33, -33, -33],
      [-32, -32, -32],
      [-1, -1, -1],
      [0, 0, 0],
      [31, 31, 31],
      [32, 32, 32],
      [45056, -1537, -45057],
    ] as const;
    for (const [x, y, z] of cells) {
      expect(f.sample(cache, x, y, z)).toBe(Block.Air);
      expect(f.sample(cache, x, y, z)).toBe(Block.Air);
    }
    expect(f.calls).toEqual(cells.map((p) => p.map((v) => v + 0.5)));
    expect(cache.statistics()).toEqual({
      pages: 5,
      pageLimit: 96,
      hits: 7,
      misses: 7,
      evictions: 0,
      typedArrayBytes: 5 * BLOCK_SAMPLE_PAGE_BYTES,
    });
  });

  it("preserves all cells including high validity bits, without pre-sampling unused cells", () => {
    const cache = new BlockSampleCache(),
      f = fixture((x, y, z) => (x + 32 * (z + 32 * y)) & 0xffff);
    for (let y = 0; y < 32; y++)
      for (let z = 0; z < 32; z++)
        for (let x = 0; x < 32; x++)
          expect(f.sample(cache, x, y, z)).toBe(x + 32 * (z + 32 * y));
    for (let y = 31; y >= 0; y--)
      for (let z = 31; z >= 0; z--)
        for (let x = 31; x >= 0; x--)
          expect(f.sample(cache, x, y, z)).toBe(x + 32 * (z + 32 * y));
    expect(f.calls).toHaveLength(32 ** 3);
    expect(cache.statistics()).toMatchObject({ pages: 1, hits: 32 ** 3 });
    f.sample(cache, 0, 96, 0);
    expect(f.calls).toHaveLength(32 ** 3 + 1);
    expect(cache.statistics().pages).toBe(2);
  });

  it("keeps strict LRU through the last-page path and clears recycled validity and init counters", () => {
    const cache = new BlockSampleCache(2),
      f = fixture((x) => (x === 0 ? Block.Air : Block.Stone));
    expect(f.sample(cache, 0, 0, 0)).toBe(Block.Air);
    f.sample(cache, 32, 0, 0);
    f.sample(cache, 0, 0, 0);
    f.sample(cache, 1, 0, 0); // Last-page path keeps owner0 MRU.
    f.sample(cache, 64, 0, 0); // Recycles owner32.
    expect(f.sample(cache, 0, 0, 0)).toBe(Block.Air);
    expect(f.sample(cache, 32, 0, 0)).toBe(Block.Stone);
    expect(cache.statistics()).toEqual({
      pages: 2,
      pageLimit: 2,
      hits: 2,
      misses: 5,
      evictions: 2,
      typedArrayBytes: 2 * BLOCK_SAMPLE_PAGE_BYTES,
    });
    cache.clear();
    expect(cache.statistics()).toEqual({
      pages: 0,
      pageLimit: 2,
      hits: 0,
      misses: 0,
      evictions: 0,
      typedArrayBytes: 0,
    });
    expect(f.sample(cache, 0, 0, 0)).toBe(Block.Air);
    expect(cache.statistics().misses).toBe(1);
  });

  it("is bounded for adversarial order and returns identical values after eviction", () => {
    const cache = new BlockSampleCache(),
      blockAt = (x: number, y: number, z: number) =>
        Math.abs(x + 3 * y + 7 * z) % 65536,
      f = fixture(blockAt);
    for (const direction of [1, -1])
      for (let n = 0; n < 128; n++) {
        const x = direction * (n * 32 + 31),
          y = direction * n,
          z = -direction * n;
        expect(f.sample(cache, x, y, z)).toBe(blockAt(x, y, z));
        expect(cache.statistics().pages).toBeLessThanOrEqual(96);
      }
    expect(cache.statistics().typedArrayBytes).toBe(6_684_672);
    expect(cache.statistics().evictions).toBeGreaterThan(0);
    expect(BLOCK_SAMPLE_PAGE_LIMIT).toBe(96);
    expect(6 * cache.statistics().typedArrayBytes).toBe(40_108_032);
    expect(() => new BlockSampleCache(0)).toThrow(RangeError);
  });

  it("retains a same-Y 2x2 column group's conservative volume-and-sky page footprint", () => {
    const cache = new BlockSampleCache(),
      f = fixture(),
      owners = new Map<string, readonly [number, number, number]>();
    // buildVolume starts at 32*(c-1), covers three pages per axis, and samples
    // incoming sky through 64m above its top: cy-1..cy+3. Use negative owners
    // and one cell per page to test retention without actual world generation.
    const cy = -1;
    for (const cx of [-2, -1])
      for (const cz of [0, 1])
        for (let pz = cz - 1; pz <= cz + 1; pz++)
          for (let px = cx - 1; px <= cx + 1; px++)
            for (let py = cy - 1; py <= cy + 3; py++)
              owners.set(`${px},${py},${pz}`, [px * 32, py * 32, pz * 32]);
    expect(owners.size).toBe(80);
    const expected = [...owners.values()].map(([x, y, z]) =>
      f.sample(cache, x, y, z),
    );
    expect(f.calls).toHaveLength(80);
    expect(
      [...owners.values()].map(([x, y, z]) => f.sample(cache, x, y, z)),
    ).toEqual(expected);
    expect(f.calls).toHaveLength(80);
    expect(cache.statistics()).toMatchObject({
      pages: 80,
      hits: 80,
      misses: 80,
      evictions: 0,
      typedArrayBytes: 80 * BLOCK_SAMPLE_PAGE_BYTES,
    });
    cache.clear();
    expect(cache.statistics()).toEqual({
      pages: 0,
      pageLimit: 96,
      hits: 0,
      misses: 0,
      evictions: 0,
      typedArrayBytes: 0,
    });
  });

  it("recycles capacity-one pages without reusing the last page's valid values", () => {
    const cache = new BlockSampleCache(1),
      f = fixture((x) => (x < 0 ? Block.Air : Block.Lava));
    for (const x of [-1, 31, -1, 31])
      expect(f.sample(cache, x, 31, 31)).toBe(x < 0 ? Block.Air : Block.Lava);
    expect(cache.statistics()).toMatchObject({
      pages: 1,
      hits: 0,
      misses: 4,
      evictions: 3,
    });
  });

  it("does not cache a failed sample", () => {
    const cache = new BlockSampleCache(),
      f = fixture(() => {
        throw new Error("sample failed");
      });
    expect(() => f.sample(cache, 0, 0, 0)).toThrow("sample failed");
    const restored = fixture(() => Block.Lava);
    expect(restored.sample(cache, 0, 0, 0)).toBe(Block.Lava);
    expect(cache.statistics()).toMatchObject({ hits: 0, misses: 2, pages: 1 });
  });
});
