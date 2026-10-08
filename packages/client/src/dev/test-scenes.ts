import { Block } from "../../../shared/src/blocks/registry.js";
import type { VoxelEdit } from "../engine/worker-protocol.js";
/** Explicit input-test geometry. No camera/body setter and no production terrain change. */
export function testScene(name: string): readonly VoxelEdit[] {
  const edits: VoxelEdit[] = [];
  if (name === "tunnel") {
    for (let z = -4; z <= 3; z++)
      for (let x = -2; x <= 2; x++) {
        edits.push({
          x,
          y: 8,
          z,
          block: x % 2 === 0 ? Block.Stone : Block.GoldOre,
        });
        if (Math.abs(x) === 2)
          for (let y = 6; y < 8; y++)
            edits.push({ x, y, z, block: Block.Stone });
      }
  } else if (name === "block") {
    edits.push({ x: 0, y: 6, z: -3, block: Block.Stone });
  } else if (name === "silhouette") {
    for (let x = -1; x <= 1; x++)
      for (let y = 6; y <= 10; y++)
        edits.push({ x, y, z: 1, block: Block.Stone });
  }
  return edits;
}
