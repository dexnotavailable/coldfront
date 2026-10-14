import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { BLOCK_REGISTRY, Block } from "../../src/blocks/registry.js";
import { generateTextureArray } from "../../src/blocks/textures/recipes.js";

const sha256 = (data: Uint8Array | string): string =>
  createHash("sha256").update(data).digest("hex");

it("preserves every original registry field and all 192 original texture layers", () => {
  // Verified at 28b596b against the accepted tree's bark-dependency.json.
  // P0 requires the four additive material fields; strip only those for the
  // original-definition comparison, then check their defaults independently.
  const legacyDefinitions = BLOCK_REGISTRY.slice(0, 32).map((block) => {
    const { emission, emissionStrength, gloss, fluidKind, ...legacy } = block;
    expect(emission).toEqual([0, 0, 0]);
    expect(emissionStrength).toBe(0);
    expect(gloss).toBe(0);
    expect(fluidKind).toBe(block.id === Block.Water ? "water" : "none");
    return legacy;
  });
  const textures = generateTextureArray();
  expect(sha256(JSON.stringify(legacyDefinitions))).toBe(
    "396c5cf3241e915a3ff1d24fdc21c44466bbef1ab0ad590f9e54c5787d72bf1d",
  );
  expect(sha256(textures.data.subarray(0, 196608))).toBe(
    "7589a6c15cbcf75a37aa50947b3c0a400320fb4ed1a29ff8240b42d15aa20ecb",
  );
  expect(sha256(textures.averages.subarray(0, 96))).toBe(
    "50ef345dec472fa1f41f352c3e4a33fab502c8e949d0ae2fa33efca183fae63a",
  );
  expect(Block.Bark).toBe(32);
  expect(textures.layers).toBe(234);
  const log = BLOCK_REGISTRY[Block.Log];
  expect(BLOCK_REGISTRY[Block.Bark]).toMatchObject({
    renderType: log?.renderType,
    solid: log?.solid,
    opaque: log?.opaque,
    lightFiltering: log?.lightFiltering,
  });
});

it("uses identical Log-side variants on every Bark face", () => {
  const { data } = generateTextureArray();
  const tile = (id: number, face: number, variant: number): Uint8Array => {
    const offset = (id * 6 + face * 3 + variant) * 1024;
    return data.subarray(offset, offset + 1024);
  };
  for (let face = 0; face < 2; face++)
    for (let variant = 0; variant < 3; variant++) {
      expect(tile(Block.Bark, face, variant)).toEqual(
        tile(Block.Log, 0, variant),
      );
    }
  expect(tile(Block.Bark, 1, 0)).not.toEqual(tile(Block.Log, 1, 0));
});
