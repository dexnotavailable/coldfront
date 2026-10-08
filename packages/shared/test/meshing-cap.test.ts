import { expect, it } from "vitest";
import { Block } from "../src/blocks/registry.js";
import { capOccupancy } from "../src/meshing/cap.js";
import { voxelIndex } from "../src/world/coordinates.js";

it("cap data is an exact solid cross-section including loaded edges and reveals no material", () => {
  const blocks = new Uint16Array(32768).fill(Block.Stone);
  for (let z = 0; z < 32; z++)
    for (let y = 4; y < 6; y++)
      for (let x = 14; x < 17; x++) blocks[voxelIndex(x, y, z)] = Block.Air;
  blocks[voxelIndex(0, 5, 0)] = Block.DeepStone;
  const cap = capOccupancy(blocks);
  for (let z = 0; z < 32; z++)
    for (let x = 0; x < 32; x++)
      expect(cap[voxelIndex(x, 5, z)]).toBe(x >= 14 && x < 17 ? 0 : 255);
  expect(cap[voxelIndex(0, 5, 0)]).toBe(cap[voxelIndex(1, 5, 0)]);
  expect(new Set(cap)).toEqual(new Set([255, 0]));
});
