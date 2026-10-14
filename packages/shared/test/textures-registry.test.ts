import { expect, it } from "vitest";
import { BLOCK_REGISTRY, Block } from "../src/blocks/registry.js";
import {
  generateTextureArray,
  LAYERS_PER_BLOCK,
  TEXTURE_RECIPES,
  TEXTURE_SIZE,
} from "../src/blocks/textures/recipes.js";

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
  expect(BLOCK_REGISTRY).toHaveLength(39);
  expect(TEXTURE_RECIPES).toHaveLength(BLOCK_REGISTRY.length);
  expect([
    Block.Bark,
    Block.Obsidian,
    Block.EmberCrust,
    Block.BrimstoneCrust,
    Block.SulphurCrust,
    Block.Lava,
    Block.VentMouth,
  ]).toEqual([32, 33, 34, 35, 36, 37, 38]);
  expect(TEXTURE_RECIPES.map((recipe) => recipe.id)).toEqual(
    Array.from({ length: 39 }, (_, id) => id),
  );
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

it("keeps defaults inert and emission RGB, rendered strength and gloss independently bounded", () => {
  for (const block of BLOCK_REGISTRY) {
    expect(Object.isFrozen(block)).toBe(true);
    expect(Object.isFrozen(block.emission)).toBe(true);
    expect(block.emission).toHaveLength(3);
    for (const channel of block.emission) {
      expect(Number.isInteger(channel)).toBe(true);
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(15);
    }
    expect(Number.isFinite(block.emissionStrength)).toBe(true);
    expect(block.emissionStrength).toBeGreaterThanOrEqual(0);
    expect(block.gloss).toBeGreaterThanOrEqual(0);
    expect(block.gloss).toBeLessThanOrEqual(1);
    if (block.id <= Block.Bark) {
      expect(block.emission).toEqual([0, 0, 0]);
      expect(block.emissionStrength).toBe(0);
      expect(block.gloss).toBe(0);
    }
  }
  const emitters = BLOCK_REGISTRY.filter((block) =>
    block.emission.some((channel) => channel > 0),
  );
  expect(emitters.map((block) => block.id)).toEqual([
    Block.EmberCrust,
    Block.Lava,
    Block.VentMouth,
  ]);
  for (const block of emitters) {
    expect(block.emission[0]).toBeGreaterThan(block.emission[1]);
    expect(block.emission[1]).toBeGreaterThan(block.emission[2]);
    expect(block.emissionStrength).toBeGreaterThan(1);
  }
  expect(BLOCK_REGISTRY[Block.Obsidian]?.gloss).toBeGreaterThan(0.7);
  expect(BLOCK_REGISTRY[Block.Basalt]?.gloss).toBe(0);
});

it("distinguishes visually opaque lava from solid occupancy and transparent owned water", () => {
  expect(BLOCK_REGISTRY[Block.Lava]).toMatchObject({
    renderType: "fluid",
    fluidKind: "lava",
    solid: false,
    opaque: true,
    breakable: false,
    lightFiltering: 15,
  });
  expect(BLOCK_REGISTRY[Block.Water]).toMatchObject({
    renderType: "fluid",
    fluidKind: "water",
    solid: false,
    opaque: false,
    lightFiltering: 2,
    emission: [0, 0, 0],
    emissionStrength: 0,
  });
  for (const block of BLOCK_REGISTRY)
    if (block.id !== Block.Lava && block.id !== Block.Water)
      expect(block.fluidKind).toBe("none");
});

it("generates 234 deterministic complete layers below WebGL2's 256-layer floor", () => {
  const a = generateTextureArray();
  const b = generateTextureArray();
  expect(a.layers).toBe(234);
  expect(a.layers).toBeLessThanOrEqual(256);
  expect(a.width).toBe(TEXTURE_SIZE);
  expect(a.height).toBe(TEXTURE_SIZE);
  expect(a.data.length).toBe(
    39 * LAYERS_PER_BLOCK * TEXTURE_SIZE * TEXTURE_SIZE * 4,
  );
  expect(a.data).toEqual(b.data);
  expect(a.averages).toEqual(b.averages);
  for (let id = Block.Bark; id <= Block.VentMouth; id++)
    for (let layer = id * 6; layer < id * 6 + 6; layer++)
      for (let pixel = 0; pixel < 256; pixel++)
        expect(a.data[(layer * 256 + pixel) * 4 + 3]).toBe(255);
});

it("keeps black obsidian distinct from basalt, sulphur yellow, and ember seams selective", () => {
  const { data, averages } = generateTextureArray();
  const rgb = (id: number): number[] =>
    Array.from(averages.subarray(id * 3, id * 3 + 3));
  const [or = 0, og = 0, ob = 0] = rgb(Block.Obsidian);
  const [br = 0, bg = 0, bb = 0] = rgb(Block.Basalt);
  expect(or + og + ob).toBeLessThan((br + bg + bb) * 0.6);
  const [sr = 0, sg = 0, sb = 0] = rgb(Block.SulphurCrust);
  expect(sr).toBeGreaterThan(160);
  expect(sg).toBeGreaterThan(130);
  expect(sb).toBeLessThan(65);
  for (let variant = 0; variant < 3; variant++) {
    let hot = 0;
    for (let pixel = 0; pixel < 256; pixel++) {
      const i = ((Block.EmberCrust * 6 + variant) * 256 + pixel) * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      if (r - g > 60) {
        hot++;
        expect(r).toBeLessThan(170);
        expect(g).toBeLessThan(50);
      } else expect(r).toBeLessThan(55);
    }
    expect(hot / 256).toBeGreaterThan(0.08);
    expect(hot / 256).toBeLessThan(0.2);
  }
});
