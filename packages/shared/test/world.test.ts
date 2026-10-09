import { describe, expect, it } from "vitest";
import { BLOCK_REGISTRY, Block } from "../src/blocks/registry.js";
import {
  CHUNK_VOLUME,
  HALO_VOLUME,
  HALO_WIDTH,
  WORLD_MIN_Y,
  WORLDSTONE_CEILING,
} from "../src/world/constants.js";
import {
  haloIndex,
  sampleCenter,
  voxelIndex,
} from "../src/world/coordinates.js";
import { generateTestChunk } from "../src/worldgen/chunk.js";
import {
  Column,
  collectTestTrees,
  createColumnSample,
  createVoxelSample,
  sampleTestColumn,
  sampleTestVoxel,
  TEST_POND,
  testTreeInCell,
  testWorldSpawn,
} from "../src/worldgen/test-world.js";
import { WORLDGEN_VERSION } from "../src/worldgen/version.js";

describe("pointwise test-world contract", () => {
  it("uses a real typed core/halo and repeats exactly regardless of request order or other seeds", () => {
    const request = { seed: 1, cx: -1, cy: 0, cz: 0 };
    const first = generateTestChunk(request);
    generateTestChunk({ seed: 3, cx: 2, cy: -1, cz: -2, spacing: 2 });
    generateTestChunk({ seed: 2, cx: 0, cy: 0, cz: 0 });
    const repeated = generateTestChunk(request);
    expect(WORLDGEN_VERSION).toBe(3);
    expect(first.blocks).toBeInstanceOf(Uint16Array);
    expect(first.blocks.length).toBe(CHUNK_VOLUME);
    expect(first.haloBlocks.length).toBe(HALO_VOLUME);
    expect(first.density).toBeInstanceOf(Float64Array);
    expect(first.columns).toBeInstanceOf(Float64Array);
    expect(first.columns.length).toBe(HALO_WIDTH * HALO_WIDTH * Column.Stride);
    expect(
      Buffer.from(first.blocks.buffer).equals(
        Buffer.from(repeated.blocks.buffer),
      ),
    ).toBe(true);
    expect(
      Buffer.from(first.haloBlocks.buffer).equals(
        Buffer.from(repeated.haloBlocks.buffer),
      ),
    ).toBe(true);
    expect(
      Buffer.from(first.density.buffer).equals(
        Buffer.from(repeated.density.buffer),
      ),
    ).toBe(true);
    expect(
      Buffer.from(first.columns.buffer).equals(
        Buffer.from(repeated.columns.buffer),
      ),
    ).toBe(true);
    const other = generateTestChunk({ ...request, seed: 2 });
    expect(
      Buffer.from(first.blocks.buffer).equals(Buffer.from(other.blocks.buffer)),
    ).toBe(false);
    expect(new Set(first.blocks)).toContain(Block.Grass);
    expect(new Set(first.blocks)).toContain(Block.Air);
  });

  it.each([1, 2, 3, 0.5])(
    "halos agree exactly on all axes at negative boundaries, spacing %s",
    (spacing) => {
      const a = generateTestChunk({ seed: 2, cx: -1, cy: -1, cz: -1, spacing });
      const right = generateTestChunk({
        seed: 2,
        cx: 0,
        cy: -1,
        cz: -1,
        spacing,
      });
      const front = generateTestChunk({
        seed: 2,
        cx: -1,
        cy: -1,
        cz: 0,
        spacing,
      });
      const up = generateTestChunk({ seed: 2, cx: -1, cy: 0, cz: -1, spacing });
      // Compare real overlapping core/halo values, including all eight upward samples.
      for (let y = -1; y < 40; y++)
        for (let z = -1; z <= 32; z++) {
          for (const [xA, xB] of [
            [31, -1],
            [32, 0],
          ] as const) {
            expect(a.haloBlocks[haloIndex(xA, y, z)]).toBe(
              right.haloBlocks[haloIndex(xB, y, z)],
            );
            expect(a.density[haloIndex(xA, y, z)]).toBe(
              right.density[haloIndex(xB, y, z)],
            );
          }
        }
      for (let y = -1; y < 40; y++)
        for (let x = -1; x <= 32; x++) {
          expect(a.haloBlocks[haloIndex(x, y, 32)]).toBe(
            front.haloBlocks[haloIndex(x, y, 0)],
          );
          expect(a.density[haloIndex(x, y, 32)]).toBe(
            front.density[haloIndex(x, y, 0)],
          );
        }
      for (let x = -1; x <= 32; x++)
        for (let z = -1; z <= 32; z++) {
          for (let y = 31; y < 40; y++) {
            expect(a.haloBlocks[haloIndex(x, y, z)]).toBe(
              up.haloBlocks[haloIndex(x, y - 32, z)],
            );
            expect(a.density[haloIndex(x, y, z)]).toBe(
              up.density[haloIndex(x, y - 32, z)],
            );
          }
          const ca = (x + 1 + 34 * (z + 1)) * Column.Stride;
          for (let lane = 0; lane < Column.Stride; lane++)
            expect(a.columns[ca + lane]).toBe(up.columns[ca + lane]);
        }
    },
  );

  it("samples at voxel centres and uses the same point field across different spacings", () => {
    const fine = generateTestChunk({
      seed: 3,
      cx: 0,
      cy: 0,
      cz: 0,
      spacing: 1,
    });
    const coarse = generateTestChunk({
      seed: 3,
      cx: 0,
      cy: 0,
      cz: 0,
      spacing: 3,
    });
    const column = createColumnSample();
    const voxel = createVoxelSample();
    for (let x = 0; x < 10; x++)
      for (let z = 0; z < 10; z++) {
        const wx = sampleCenter(0, x, 3);
        const wz = sampleCenter(0, z, 3);
        sampleTestColumn(3, wx, wz, column);
        const ci = (x + 1 + 34 * (z + 1)) * Column.Stride;
        for (let lane = 0; lane < Column.Stride; lane++)
          expect(coarse.columns[ci + lane]).toBe(column[lane]);
        for (let y = 0; y < 10; y++) {
          const wy = sampleCenter(0, y, 3);
          sampleTestVoxel(3, wx, wy, wz, voxel, column);
          expect(coarse.blocks[voxelIndex(x, y, z)]).toBe(voxel.block);
          expect(coarse.blocks[voxelIndex(x, y, z)]).toBe(
            fine.blocks[voxelIndex(3 * x + 1, 3 * y + 1, 3 * z + 1)],
          );
          expect(coarse.density[haloIndex(x, y, z)]).toBe(
            fine.density[haloIndex(3 * x + 1, 3 * y + 1, 3 * z + 1)],
          );
        }
      }
  });

  it("has a bounded pond at y=0 with a solid bed/rim, while other below-datum basins stay dry", () => {
    const column = createColumnSample();
    const voxel = createVoxelSample();
    for (const seed of [1, 2, 3]) {
      expect(
        sampleTestVoxel(seed, TEST_POND.x, -1, TEST_POND.z, voxel).block,
      ).toBe(Block.Water);
      expect(voxel.density).toBeLessThan(0);
      expect(voxel.fluid).toBe(Block.Water);
      expect(
        sampleTestVoxel(seed, TEST_POND.x, -4.5, TEST_POND.z, voxel).block,
      ).toBe(Block.Sand);
      expect(
        sampleTestVoxel(seed, TEST_POND.x, 0, TEST_POND.z, voxel).block,
      ).toBe(Block.Air);
      for (let i = 0; i < 40; i++) {
        const t = (i * 2 * Math.PI) / 40;
        const x = TEST_POND.x + TEST_POND.radiusX * Math.cos(t);
        const z = TEST_POND.z + TEST_POND.radiusZ * Math.sin(t);
        sampleTestColumn(seed, x, z, column);
        expect(column[Column.Height]).toBeCloseTo(3, 12);
        expect(sampleTestVoxel(seed, x, -0.5, z, voxel, column).block).not.toBe(
          Block.Water,
        );
      }
    }
    let dryBelowZero = 0;
    for (let x = -4000; x <= 4000; x += 100)
      for (let z = -4000; z <= 4000; z += 100) {
        sampleTestColumn(1, x, z, column);
        if ((column[Column.Height] as number) < -1) {
          expect(sampleTestVoxel(1, x, -0.5, z, voxel, column, []).block).toBe(
            Block.Air,
          );
          expect(column[Column.WaterLevel]).toBe(-Infinity);
          dryBelowZero++;
        }
      }
    expect(dryBelowZero).toBeGreaterThan(10);
  });

  it("provides a dry origin spawn with clearance and the canonical unbreakable floor", () => {
    const spawn = testWorldSpawn();
    const sample = createVoxelSample();
    expect(spawn).toEqual({ x: 0, y: 6, z: 0 });
    for (let seed = 1; seed <= 10; seed++) {
      for (const x of [-0.3, 0, 0.3])
        for (const z of [-0.3, 0, 0.3]) {
          expect(sampleTestVoxel(seed, x, spawn.y - 0.5, z, sample).block).toBe(
            Block.Grass,
          );
          for (const y of [spawn.y + 0.01, spawn.y + 0.9, spawn.y + 1.8])
            expect(sampleTestVoxel(seed, x, y, z, sample).block).toBe(
              Block.Air,
            );
        }
    }
    expect(sampleTestVoxel(1, 0, WORLD_MIN_Y + 0.5, 0, sample).block).toBe(
      Block.Worldstone,
    );
    expect(
      sampleTestVoxel(1, 0, WORLDSTONE_CEILING - 0.5, 0, sample).block,
    ).toBe(Block.Worldstone);
    expect(
      sampleTestVoxel(1, 0, WORLDSTONE_CEILING + 0.5, 0, sample).block,
    ).toBe(Block.DeepStone);
    expect(sampleTestVoxel(1, 0, WORLD_MIN_Y - 0.5, 0, sample).block).toBe(
      Block.Air,
    );
    expect(BLOCK_REGISTRY[Block.Worldstone]?.breakable).toBe(false);
  });

  it("finds connected, varied tree features spanning chunk boundaries and compares their seam voxels", () => {
    const trees = collectTestTrees(1, -250, -250, 250, 250);
    expect(trees.length).toBeGreaterThan(10);
    expect(trees.length).toBeLessThan(100);
    expect(new Set(trees.map((t) => t.trunkTop - t.baseY)).size).toBe(
      trees.length,
    );
    const spanning = trees.find(
      (tree) =>
        Math.floor((tree.x - tree.crownRadius) / 32) !==
        Math.floor((tree.x + tree.crownRadius) / 32),
    );
    expect(spanning).toBeDefined();
    if (!spanning) throw new Error("No seam feature found");
    expect(testTreeInCell(1, spanning.cellX, spanning.cellZ)).toEqual(spanning);
    const leftX = Math.floor((spanning.x - spanning.crownRadius) / 32);
    const cz = Math.floor(spanning.z / 32);
    const cy = Math.floor(spanning.crownY / 32);
    const a = generateTestChunk({ seed: 1, cx: leftX, cy, cz });
    const b = generateTestChunk({ seed: 1, cx: leftX + 1, cy, cz });
    let leaves = 0;
    for (let y = 0; y < 32; y++)
      for (let z = 0; z < 32; z++) {
        const left = a.haloBlocks[haloIndex(32, y, z)];
        const right = b.blocks[voxelIndex(0, y, z)];
        expect(left).toBe(right);
        expect(a.density[haloIndex(32, y, z)]).toBe(
          b.density[haloIndex(0, y, z)],
        );
        if (left === Block.Leaves) leaves++;
      }
    expect(leaves).toBeGreaterThan(0);
    const voxel = createVoxelSample();
    expect(
      sampleTestVoxel(1, spanning.x, spanning.baseY + 2.5, spanning.z, voxel)
        .block,
    ).toBe(Block.Log);
    expect(
      sampleTestVoxel(1, spanning.x, spanning.baseY - 0.5, spanning.z, voxel)
        .density,
    ).toBeGreaterThan(0);
    const local = collectTestTrees(
      1,
      spanning.x - 1,
      spanning.z - 1,
      spanning.x + 1,
      spanning.z + 1,
    );
    expect(local).toContainEqual(spanning);
  });

  it("column gradients include pond and spawn blend derivatives", () => {
    const c = createColumnSample();
    const p = createColumnSample();
    const m = createColumnSample();
    const eps = 1e-4;
    for (const [x, z] of [
      [0, 0],
      [-130.7, 83.2],
      [10, 2],
      [16, 0],
      [44, 24],
      [65, 24],
      [71, 29],
      [78, 30],
    ]) {
      sampleTestColumn(1, x as number, z as number, c);
      sampleTestColumn(1, (x as number) + eps, z as number, p);
      sampleTestColumn(1, (x as number) - eps, z as number, m);
      expect(
        Math.abs(
          (c[Column.Dx] as number) -
            ((p[Column.Height] as number) - (m[Column.Height] as number)) /
              (2 * eps),
        ),
      ).toBeLessThan(3e-5);
      sampleTestColumn(1, x as number, (z as number) + eps, p);
      sampleTestColumn(1, x as number, (z as number) - eps, m);
      expect(
        Math.abs(
          (c[Column.Dz] as number) -
            ((p[Column.Height] as number) - (m[Column.Height] as number)) /
              (2 * eps),
        ),
      ).toBeLessThan(3e-5);
      expect(
        (c[Column.MacroMeso] as number) + (c[Column.Micro] as number),
      ).toBe(c[Column.Height]);
    }
  });

  it("fails invalid external request domains loudly", () => {
    expect(() =>
      generateTestChunk({ seed: NaN, cx: 0, cy: 0, cz: 0 }),
    ).toThrow();
    expect(() =>
      generateTestChunk({ seed: 1, cx: 0.5, cy: 0, cz: 0 }),
    ).toThrow();
    expect(() =>
      generateTestChunk({ seed: 1, cx: 0, cy: 0, cz: 0, spacing: 0 }),
    ).toThrow();
    expect(() =>
      sampleTestColumn(1, Infinity, 0, createColumnSample()),
    ).toThrow();
    expect(() => collectTestTrees(1, 1, 0, -1, 0)).toThrow();
  });
});
