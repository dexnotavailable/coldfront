import { expect, it } from "vitest";
import {
  generateTextureArray,
  TEXTURE_RECIPES,
} from "../src/blocks/textures/recipes.js";

it("generates deterministic variants within WebGL2's minimum array-layer limit", () => {
  const a = generateTextureArray(),
    b = generateTextureArray();
  expect(a.layers).toBeLessThanOrEqual(256);
  expect(TEXTURE_RECIPES.length).toBeGreaterThanOrEqual(30);
  expect(a.data).toEqual(b.data);
  expect(a.data.slice(6 * 1024, 7 * 1024)).not.toEqual(
    a.data.slice(7 * 1024, 8 * 1024),
  );
});
