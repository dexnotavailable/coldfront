import { hash4 } from "../../math/hash.js";

export interface TextureRecipe {
  readonly id: number;
  readonly key: string;
  readonly name: string;
  readonly rgb: readonly [number, number, number];
  readonly kind:
    | "stone"
    | "soil"
    | "grass"
    | "sand"
    | "water"
    | "wood"
    | "leaves"
    | "brick"
    | "glass"
    | "ore"
    | "snow"
    | "obsidian"
    | "ember"
    | "brimstone"
    | "sulphur"
    | "lava"
    | "vent";
}
/** IDs 0..9 match the accepted seed; 10+ are append-only proposals for integration. */
export const TEXTURE_RECIPES: readonly TextureRecipe[] = [
  { id: 0, key: "air", name: "Air", rgb: [0, 0, 0], kind: "glass" },
  {
    id: 1,
    key: "worldstone",
    name: "Worldstone",
    rgb: [37, 43, 51],
    kind: "stone",
  },
  { id: 2, key: "stone", name: "Stone", rgb: [115, 121, 122], kind: "stone" },
  { id: 3, key: "dirt", name: "Dirt", rgb: [109, 81, 58], kind: "soil" },
  { id: 4, key: "grass", name: "Grass", rgb: [94, 119, 61], kind: "grass" },
  { id: 5, key: "sand", name: "Sand", rgb: [193, 179, 133], kind: "sand" },
  { id: 6, key: "water", name: "Water", rgb: [68, 120, 137], kind: "water" },
  { id: 7, key: "log", name: "Log", rgb: [92, 75, 51], kind: "wood" },
  { id: 8, key: "leaves", name: "Leaves", rgb: [67, 92, 49], kind: "leaves" },
  {
    id: 9,
    key: "deep_stone",
    name: "Deep stone",
    rgb: [65, 76, 85],
    kind: "stone",
  },
  {
    id: 10,
    key: "cobblestone",
    name: "Cobblestone",
    rgb: [107, 112, 111],
    kind: "brick",
  },
  {
    id: 11,
    key: "stone_bricks",
    name: "Stone bricks",
    rgb: [139, 141, 137],
    kind: "brick",
  },
  { id: 12, key: "planks", name: "Planks", rgb: [142, 109, 69], kind: "wood" },
  { id: 13, key: "gravel", name: "Gravel", rgb: [136, 131, 121], kind: "soil" },
  { id: 14, key: "clay", name: "Clay", rgb: [147, 154, 157], kind: "soil" },
  { id: 15, key: "snow", name: "Snow", rgb: [219, 229, 229], kind: "snow" },
  {
    id: 16,
    key: "packed_ice",
    name: "Packed ice",
    rgb: [143, 184, 203],
    kind: "glass",
  },
  { id: 17, key: "glass", name: "Glass", rgb: [184, 213, 218], kind: "glass" },
  { id: 18, key: "basalt", name: "Basalt", rgb: [54, 58, 64], kind: "stone" },
  {
    id: 19,
    key: "limestone",
    name: "Limestone",
    rgb: [167, 163, 141],
    kind: "stone",
  },
  { id: 20, key: "slate", name: "Slate", rgb: [74, 89, 103], kind: "stone" },
  {
    id: 21,
    key: "granite",
    name: "Granite",
    rgb: [140, 119, 111],
    kind: "stone",
  },
  {
    id: 22,
    key: "sandstone",
    name: "Sandstone",
    rgb: [185, 156, 105],
    kind: "stone",
  },
  {
    id: 23,
    key: "mossy_stone",
    name: "Mossy stone",
    rgb: [103, 115, 80],
    kind: "stone",
  },
  { id: 24, key: "coal_ore", name: "Coal ore", rgb: [85, 91, 95], kind: "ore" },
  {
    id: 25,
    key: "iron_ore",
    name: "Iron ore",
    rgb: [153, 110, 80],
    kind: "ore",
  },
  {
    id: 26,
    key: "copper_ore",
    name: "Copper ore",
    rgb: [141, 121, 83],
    kind: "ore",
  },
  {
    id: 27,
    key: "gold_ore",
    name: "Gold ore",
    rgb: [183, 149, 61],
    kind: "ore",
  },
  { id: 28, key: "mud", name: "Mud", rgb: [75, 66, 49], kind: "soil" },
  { id: 29, key: "ash", name: "Ash", rgb: [110, 105, 105], kind: "sand" },
  {
    id: 30,
    key: "dark_planks",
    name: "Dark planks",
    rgb: [81, 62, 47],
    kind: "wood",
  },
  { id: 31, key: "bricks", name: "Bricks", rgb: [140, 83, 66], kind: "brick" },
  { id: 32, key: "bark", name: "Bark wood", rgb: [92, 75, 51], kind: "wood" },
  {
    id: 33,
    key: "obsidian",
    name: "Obsidian",
    rgb: [24, 26, 33],
    kind: "obsidian",
  },
  {
    id: 34,
    key: "ember_crust",
    name: "Ember crust",
    rgb: [36, 26, 28],
    kind: "ember",
  },
  {
    id: 35,
    key: "brimstone_crust",
    name: "Brimstone crust",
    rgb: [188, 179, 126],
    kind: "brimstone",
  },
  {
    id: 36,
    key: "sulphur_crust",
    name: "Sulphur crust",
    rgb: [185, 159, 42],
    kind: "sulphur",
  },
  { id: 37, key: "lava", name: "Lava", rgb: [48, 31, 28], kind: "lava" },
  {
    id: 38,
    key: "vent_mouth",
    name: "Vent mouth",
    rgb: [31, 26, 28],
    kind: "vent",
  },
];
export const TEXTURE_SIZE = 16;
export const LAYERS_PER_BLOCK = 6;
export interface TextureArrayData {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly layers: number;
  readonly averages: Uint8Array;
}
/** Three side variants and three top variants per ID: 234 layers, below WebGL2's 256 floor. */
export function generateTextureArray(): TextureArrayData {
  const layers = TEXTURE_RECIPES.length * LAYERS_PER_BLOCK;
  const data = new Uint8Array(layers * TEXTURE_SIZE * TEXTURE_SIZE * 4);
  const averages = new Uint8Array(TEXTURE_RECIPES.length * 3);
  for (const recipe of TEXTURE_RECIPES) {
    // The accepted Bark dependency reuses Log's exact side pixels on every face.
    const textureSeed = recipe.key === "bark" ? 7 : recipe.id;
    const totals = [0, 0, 0];
    for (let face = 0; face < 2; face++)
      for (let variant = 0; variant < 3; variant++) {
        const layer = recipe.id * LAYERS_PER_BLOCK + face * 3 + variant;
        for (let y = 0; y < TEXTURE_SIZE; y++)
          for (let x = 0; x < TEXTURE_SIZE; x++) {
            const hash = hash4(0x35ab9183, textureSeed, variant, x + 31 * y);
            let grain = ((hash & 255) / 255 - 0.5) * 15;
            let r = recipe.rgb[0],
              g = recipe.rgb[1],
              b = recipe.rgb[2],
              alpha = 255;
            const coarse =
              ((hash4(
                17,
                textureSeed,
                Math.floor(x / 3),
                Math.floor(y / 3) + variant * 17,
              ) &
                255) /
                255 -
                0.5) *
              12;
            if (recipe.kind === "stone")
              grain += coarse + (y % 7 === 0 ? -6 : 0);
            if (recipe.kind === "soil") grain += coarse * 1.5;
            if (recipe.kind === "sand" || recipe.kind === "snow") grain *= 0.6;
            if (recipe.kind === "grass") {
              if (face === 0 && y < 12 + (hash % 3)) {
                r = 109;
                g = 81;
                b = 58;
              } else grain += coarse;
            }
            if (recipe.kind === "wood") {
              const planks = recipe.id === 12 || recipe.id === 30;
              grain += planks
                ? y % 5 === 0
                  ? -24
                  : x % 13 === 0 && y % 5 < 4
                    ? -8
                    : 0
                : face === 0 || recipe.key === "bark"
                  ? (x + Math.floor(y / 5)) % 4 === 0
                    ? -23
                    : 5
                  : Math.floor(
                        Math.sqrt(
                          (x - 7.5) * (x - 7.5) + (y - 7.5) * (y - 7.5),
                        ),
                      ) %
                        3 ===
                      0
                    ? -20
                    : 15;
            }
            if (recipe.kind === "brick")
              grain +=
                y % 6 === 0 || (x + (Math.floor(y / 6) % 2) * 4) % 8 === 0
                  ? -30
                  : 4;
            if (recipe.kind === "leaves") {
              grain += coarse * 1.2;
              if ((hash & 31) < 3) alpha = 0;
            }
            if (recipe.kind === "ore" && (hash & 15) > 4) {
              r = 112;
              g = 117;
              b = 119;
            }
            if (recipe.kind === "water") {
              grain *= 0.35;
              alpha = 190;
            }
            if (recipe.kind === "glass") {
              grain = x === 0 || y === 0 ? 12 : grain * 0.2;
              if (recipe.id === 17) alpha = 95;
            }
            if (recipe.kind === "obsidian") {
              // Broad, quiet glassy facets. Gloss is light-dependent in the renderer.
              grain = grain * 0.24 + coarse * 0.35;
              const facet = (x + Math.floor(y / 3) + variant * 5) % 13;
              if (facet === 0) grain -= 5;
              else if (facet === 1) grain += 6;
            }
            if (recipe.kind === "brimstone" || recipe.kind === "sulphur") {
              grain = grain * 0.65 + coarse * 1.5;
              // Powdery deposits interrupted by dark pinholes, never emissive.
              if ((hash & 63) < 4) grain -= 30;
            }
            if (
              recipe.kind === "ember" ||
              recipe.kind === "lava" ||
              recipe.kind === "vent"
            ) {
              // Connected dark-red seams in a cool crust, with sparse hotter knots.
              // RGB red excess marks hot pixels for P6; alpha stays fully opaque.
              const seam = (x + Math.floor(y / 3) + variant * 5) % 11;
              const cross = (y + Math.floor(x / 4) + variant * 3) % 13;
              const hot = seam === 0 || (cross === 0 && seam < 5);
              const lavaEdge = recipe.kind === "lava" && seam === 1;
              grain = grain * 0.55 + coarse * 0.6;
              if (hot || lavaEdge) {
                const knot = hot && (hash & 7) < 2;
                if (recipe.kind === "ember") {
                  r = knot ? 158 : 127;
                  g = knot ? 42 : 31;
                  b = knot ? 24 : 22;
                } else if (recipe.kind === "lava") {
                  r = knot ? 245 : 204;
                  g = knot ? 132 : 71;
                  b = knot ? 39 : 24;
                } else {
                  r = knot ? 220 : 165;
                  g = knot ? 83 : 44;
                  b = knot ? 27 : 22;
                }
                grain *= 0.4;
              }
            }
            const i = (layer * 256 + y * 16 + x) * 4;
            data[i] = Math.max(0, Math.min(255, Math.round(r + grain)));
            data[i + 1] = Math.max(0, Math.min(255, Math.round(g + grain)));
            data[i + 2] = Math.max(0, Math.min(255, Math.round(b + grain)));
            data[i + 3] = recipe.id === 0 ? 0 : alpha;
            if (face === 1 && variant === 0)
              for (let c = 0; c < 3; c++)
                totals[c] = (totals[c] as number) + (data[i + c] as number);
          }
      }
    for (let c = 0; c < 3; c++)
      averages[recipe.id * 3 + c] = Math.round((totals[c] as number) / 256);
  }
  return { data, width: 16, height: 16, layers, averages };
}
