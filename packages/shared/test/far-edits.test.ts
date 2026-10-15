import { describe, expect, it } from "vitest";
import { Block } from "../src/blocks/registry.js";
import {
  FarEditIndex,
  type FarVoxelEdit,
  farLight,
  replaceFarInterval,
} from "../src/worldgen/far/edits.js";
import type { FarRun } from "../src/worldgen/far/types.js";

describe("far footprint edit reduction", () => {
  it("retains an off-centre one-metre wall at all five far levels", () => {
    const edits = new FarEditIndex([
      { x: -1, y: 10, z: -1, block: Block.StoneBricks },
    ]);
    for (const s of [4, 8, 16, 32, 64])
      expect(edits.column(-s / 2, -s / 2, s)).toEqual([
        { bottom: 10, top: 11, block: Block.StoneBricks },
      ]);
  });
  it("requires every footprint voxel to be explicitly clear before removing a slab", () => {
    const edits: FarVoxelEdit[] = [];
    for (let z = -4; z < 0; z++)
      for (let x = -4; x < 0; x++) edits.push({ x, z, y: 2, block: Block.Air });
    expect(new FarEditIndex(edits.slice(1)).column(-2, -2, 4)).toEqual([]);
    expect(new FarEditIndex(edits).column(-2, -2, 4)).toEqual([
      { bottom: 2, top: 3, block: Block.Air },
    ]);
    const replacement = [...edits, { x: -1, z: -1, y: 2, block: Block.Planks }];
    expect(new FarEditIndex(replacement).column(-2, -2, 4)).toEqual([
      { bottom: 2, top: 3, block: Block.Planks },
    ]);
  });
  it("splits natural runs at exact edit planes and clears feature identity on replacement", () => {
    const run: FarRun = {
      bottom: -8,
      top: 8,
      block: Block.Stone,
      light: farLight(Block.Stone),
      featureId: 0xffffffff,
      flags: 0,
    };
    const carved = replaceFarInterval([run], {
      bottom: 1,
      top: 2,
      block: Block.Air,
    });
    expect(carved.map((item) => [item.bottom, item.top])).toEqual([
      [-8, 1],
      [2, 8],
    ]);
    const placed = replaceFarInterval(carved, {
      bottom: 1,
      top: 2,
      block: Block.Planks,
    });
    expect(placed[1]?.featureId).toBe(0);
    expect(placed[1]?.block).toBe(Block.Planks);
  });
  it("resolves material ties deterministically, independently of input order", () => {
    const edits = [
      { x: 0, y: 20, z: 0, block: Block.Planks },
      { x: 1, y: 20, z: 0, block: Block.StoneBricks },
    ];
    expect(new FarEditIndex(edits).column(2, 2, 4)).toEqual(
      new FarEditIndex(edits.slice().reverse()).column(2, 2, 4),
    );
  });
});
