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
  it("merges only equal exact feature identities along both greedy axes", () => {
    const blocks = new Uint16Array(HALO_VOLUME),
      lights = new Uint16Array(HALO_VOLUME).fill(0xf000),
      ids = new Uint32Array(HALO_VOLUME);
    for (let x = 0; x < 2; x++)
      for (let z = 0; z < 2; z++) {
        blocks[haloIndex(x, 0, z)] = Block.Stone;
        ids[haloIndex(x, 0, z)] = 0xfedcba98;
      }
    expect(meshChunk(blocks, lights, ids).quads).toBe(6);
    ids[haloIndex(1, 0, 0)] = 0xfedcba99;
    ids[haloIndex(0, 0, 1)] = 0x02000001;
    const mesh = meshChunk(blocks, lights, ids);
    expect(mesh.quads).toBeGreaterThan(6);
    const part = mesh.parts[0];
    if (!part) throw new Error("Missing opaque part");
    const seen = new Set<number>();
    for (let q = 0; q < part.featureIdParts.length; q += 8) {
      const id =
        ((part.featureIdParts[q] as number) |
          ((part.featureIdParts[q + 1] as number) << 16)) >>>
        0;
      seen.add(id);
      for (let k = 0; k < 4; k++) {
        expect(part.featureIdParts[q + k * 2]).toBe(id & 0xffff);
        expect(part.featureIdParts[q + k * 2 + 1]).toBe(id >>> 16);
      }
    }
    expect(seen).toEqual(new Set([0xfedcba98, 0xfedcba99, 0x02000001]));
    expect(() => meshChunk(blocks, lights, new Uint32Array(32768))).toThrow(
      "halo",
    );
  });
  it("carries identities on culled skirts and defaults legacy meshes to zero", () => {
    const blocks = new Uint16Array(HALO_VOLUME).fill(Block.Stone),
      lights = new Uint16Array(HALO_VOLUME),
      ids = new Uint32Array(HALO_VOLUME).fill(0xffffffff);
    const skirts = meshChunk(blocks, lights, ids).skirts;
    expect(skirts.featureIdParts.length).toBe(
      (skirts.positions.length / 3) * 2,
    );
    expect(skirts.featureIdParts.every((half) => half === 65535)).toBe(true);
    const legacy = meshChunk(blocks, lights);
    expect(legacy.skirts.featureIdParts.every((half) => half === 0)).toBe(true);
  });
  it("keeps water at part 3 and appends opaque lava at part 4", () => {
    const blocks = new Uint16Array(HALO_VOLUME);
    blocks[haloIndex(4, 4, 4)] = Block.Water;
    blocks[haloIndex(8, 4, 4)] = Block.Lava;
    const mesh = meshChunk(blocks, new Uint16Array(HALO_VOLUME));
    expect(mesh.parts).toHaveLength(5);
    expect(mesh.parts[3]?.indices.length).toBe(36);
    expect(mesh.parts[4]?.indices.length).toBe(36);
    expect(mesh.parts[0]?.indices.length).toBe(0);
    expect(mesh.parts[3]?.surfaces[0]).toBe(Block.Water);
    expect(mesh.parts[4]?.surfaces[0]).toBe(Block.Lava);
    blocks[haloIndex(9, 4, 4)] = Block.Lava;
    expect(
      meshChunk(blocks, new Uint16Array(HALO_VOLUME)).parts[4]?.indices.length,
    ).toBe(36);
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
