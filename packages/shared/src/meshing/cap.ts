import { BLOCK_REGISTRY, Block } from "../blocks/registry.js";
/** One-bit semantic occupancy. No material, texture or ore identity survives. */
export function capOccupancy(blocks: Uint16Array): Uint8Array {
  const out = new Uint8Array(blocks.length);
  for (let i = 0; i < blocks.length; i++) {
    const id = Number(blocks[i]);
    out[i] = BLOCK_REGISTRY[id]?.solid && id !== Block.Leaves ? 255 : 0;
  }
  return out;
}
