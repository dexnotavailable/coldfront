import { expect, it } from "vitest";
import { BLOCK_REGISTRY, Block } from "../src/blocks/registry.js";
import { TEXTURE_RECIPES } from "../src/blocks/textures/recipes.js";

it("keeps accepted IDs0..9 stable and appends exactly the generated recipe IDs", () => {
  expect([
    Block.Air,
    Block.Worldstone,
    Block.Stone,
    Block.Dirt,
    Block.Grass,
    Block.Sand,
    Block.Water,
    Block.Log,
    Block.Leaves,
    Block.DeepStone,
  ]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(BLOCK_REGISTRY).toHaveLength(32);
  for (const recipe of TEXTURE_RECIPES) {
    expect(BLOCK_REGISTRY[recipe.id]?.key).toBe(recipe.key);
    expect(BLOCK_REGISTRY[recipe.id]?.name).toBe(recipe.name);
    expect(BLOCK_REGISTRY[recipe.id]?.variantCount).toBe(
      recipe.id === 0 ? 0 : 3,
    );
  }
  expect(BLOCK_REGISTRY[Block.Glass]).toMatchObject({
    solid: true,
    opaque: false,
    renderType: "translucent",
    lightFiltering: 1,
  });
  expect(BLOCK_REGISTRY[Block.Worldstone]?.breakable).toBe(false);
});
