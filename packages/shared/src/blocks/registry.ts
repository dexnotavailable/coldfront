/** Minimal phase 1.1 step 1 registry. Texture recipes expand this in step 2. */
export const Block = Object.freeze({
  Air: 0,
  Worldstone: 1,
  Stone: 2,
  Dirt: 3,
  Grass: 4,
  Sand: 5,
  Water: 6,
  Log: 7,
  Leaves: 8,
  DeepStone: 9,
} as const);
export type BlockId = (typeof Block)[keyof typeof Block];
export type RenderType = "opaque" | "cutout" | "translucent" | "fluid";
export interface BlockDefinition {
  readonly id: BlockId;
  readonly key: string;
  readonly name: string;
  readonly renderType: RenderType;
  readonly solid: boolean;
  readonly opaque: boolean;
  readonly breakable: boolean;
  /** Light loss per voxel; sky/block light itself is implemented in step 2. */
  readonly lightFiltering: number;
  /** Semantic recipe key, not a texture index or downloaded asset. */
  readonly texture: string;
  readonly variantCount: number;
}
function define(
  id: BlockId,
  key: string,
  name: string,
  renderType: RenderType,
  solid: boolean,
  opaque: boolean,
  breakable: boolean,
  lightFiltering: number,
  texture = key,
): Readonly<BlockDefinition> {
  return Object.freeze({
    id,
    key,
    name,
    renderType,
    solid,
    opaque,
    breakable,
    lightFiltering,
    texture,
    variantCount: id === Block.Air ? 0 : 3,
  });
}
export const BLOCK_REGISTRY: readonly Readonly<BlockDefinition>[] =
  Object.freeze([
    define(Block.Air, "air", "Air", "cutout", false, false, false, 0),
    define(
      Block.Worldstone,
      "worldstone",
      "Worldstone",
      "opaque",
      true,
      true,
      false,
      15,
    ),
    define(Block.Stone, "stone", "Stone", "opaque", true, true, true, 15),
    define(Block.Dirt, "dirt", "Dirt", "opaque", true, true, true, 15),
    define(Block.Grass, "grass", "Grass", "opaque", true, true, true, 15),
    define(Block.Sand, "sand", "Sand", "opaque", true, true, true, 15),
    define(Block.Water, "water", "Water", "fluid", false, false, false, 2),
    define(Block.Log, "log", "Log", "opaque", true, true, true, 15),
    define(Block.Leaves, "leaves", "Leaves", "cutout", true, false, true, 1),
    define(
      Block.DeepStone,
      "deep_stone",
      "Deep stone",
      "opaque",
      true,
      true,
      true,
      15,
    ),
  ]);
export function getBlockDefinition(id: number): Readonly<BlockDefinition> {
  const block = BLOCK_REGISTRY[id];
  if (!block) throw new RangeError("Unknown block ID");
  return block;
}
