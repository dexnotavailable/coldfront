import { describe, expect, it } from "vitest";
import { Block } from "../src/blocks/registry.js";
import { meshChunk, runMask, vertexAO } from "../src/meshing/greedy.js";
import { HALO_VOLUME } from "../src/world/constants.js";
import { haloIndex } from "../src/world/coordinates.js";

describe("full-width bitwise greedy port", () => {
  it("handles all 32 bits, including unsigned bit31 and shift32", () => {
    expect(runMask(0, 32)).toBe(0xffffffff);
    expect(runMask(31, 1)).toBe(0x80000000);
    const blocks = new Uint16Array(HALO_VOLUME),
      light = new Uint16Array(HALO_VOLUME).fill(0xf000);
    for (let z = 0; z < 32; z++)
      for (let x = 0; x < 32; x++) blocks[haloIndex(x, 0, z)] = Block.Stone;
    const m = meshChunk(blocks, light);
    expect(m.quads).toBe(6);
    expect(m.parts[0]?.indices.length).toBe(36);
    expect(Math.max(...(m.parts[0]?.positions ?? []))).toBe(32);
  });
  it("culls against separate boundary masks and retains boundary skirts", () => {
    const blocks = new Uint16Array(HALO_VOLUME).fill(Block.Stone);
    const m = meshChunk(blocks, new Uint16Array(HALO_VOLUME));
    expect(m.quads).toBe(0);
    expect(m.skirts.indices.length).toBe(6 * 32 * 32 * 6);
  });
  it("saturates AO when two sides meet and preserves ordered tuples", () => {
    expect(vertexAO(1, 1, 0)).toBe(0);
    expect(vertexAO(0, 0, 0)).toBe(3);
    expect(vertexAO(1, 0, 1)).toBe(1);
    const blocks = new Uint16Array(HALO_VOLUME),
      light = new Uint16Array(HALO_VOLUME).fill(0xf000);
    blocks[haloIndex(0, 0, 0)] = Block.Stone;
    blocks[haloIndex(1, 0, 0)] = Block.Stone;
    const clean = meshChunk(blocks, light);
    light[haloIndex(1, 1, 0)] = 0x7000;
    expect(meshChunk(blocks, light).quads).toBeGreaterThan(clean.quads);
  });
  it("emits outward triangles on all six normals", () => {
    const blocks = new Uint16Array(HALO_VOLUME);
    blocks[haloIndex(3, 2, 1)] = Block.Stone;
    const p = meshChunk(blocks, new Uint16Array(HALO_VOLUME)).parts[0];
    if (!p) throw new Error("missing opaque part");
    for (let t = 0; t < p.indices.length; t += 3) {
      const a = (p.indices[t] as number) * 3,
        b = (p.indices[t + 1] as number) * 3,
        c = (p.indices[t + 2] as number) * 3;
      const ab = [0, 1, 2].map(
        (k) => (p.positions[b + k] as number) - (p.positions[a + k] as number),
      );
      const ac = [0, 1, 2].map(
        (k) => (p.positions[c + k] as number) - (p.positions[a + k] as number),
      );
      const cross = [
        (ab[1] as number) * (ac[2] as number) -
          (ab[2] as number) * (ac[1] as number),
        (ab[2] as number) * (ac[0] as number) -
          (ab[0] as number) * (ac[2] as number),
        (ab[0] as number) * (ac[1] as number) -
          (ab[1] as number) * (ac[0] as number),
      ];
      expect(
        cross.reduce((s, n, k) => s + n * (p.normals[a + k] as number), 0),
      ).toBeGreaterThan(0);
    }
  });
});
