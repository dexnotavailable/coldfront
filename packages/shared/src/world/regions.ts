/** Stable IDs/names: docs02 section2. Discovery text: first sentence of docs03 section11. */
import type { RegionDefinition, RegionId, SurfaceRegionId } from "./types.js";

export type { RegionDefinition, RegionId, SurfaceRegionId } from "./types.js";

export const REGION_IDS: readonly RegionId[] = Object.freeze([
  "plains",
  "tundra",
  "mountains",
  "desert",
  "boneyard",
  "jungle",
  "swamp",
  "lake",
  "twilight",
  "hellscape",
  "shardfields",
  "isles",
  "nadir",
  "blackwater",
  "rim",
  "frost",
  "frost_hollows",
  "old_workings",
  "crystal_grottos",
  "ember_veins",
  "bone_pits",
  "root_halls",
  "sporewood",
  "drowned_caverns",
  "stone_garden",
  "buried_city",
  "leyflow",
  "great_shear",
  "hollow_sky",
  "deep_forges",
  "gut",
  "ash_sea",
  "throne",
]);
export const Region = Object.freeze({
  Plains: 0,
  Tundra: 1,
  Mountains: 2,
  Desert: 3,
  Boneyard: 4,
  Jungle: 5,
  Swamp: 6,
  Lake: 7,
  Twilight: 8,
  Hellscape: 9,
  Shardfields: 10,
  Isles: 11,
  Nadir: 12,
  Blackwater: 13,
  Rim: 14,
  Frost: 15,
  FrostHollows: 16,
  OldWorkings: 17,
  CrystalGrottos: 18,
  EmberVeins: 19,
  BonePits: 20,
  RootHalls: 21,
  Sporewood: 22,
  DrownedCaverns: 23,
  StoneGarden: 24,
  BuriedCity: 25,
  Leyflow: 26,
  GreatShear: 27,
  HollowSky: 28,
  DeepForges: 29,
  Gut: 30,
  AshSea: 31,
  Throne: 32,
} as const);

function define(
  index: number,
  name: string,
  color: readonly [number, number, number],
  discoverySentence: string,
  kanji?: string,
): RegionDefinition {
  const id = REGION_IDS[index] as SurfaceRegionId;
  return Object.freeze({
    id,
    index,
    layer: "surface" as const,
    name,
    color: Object.freeze(color),
    discoverySentence,
    ...(kanji === undefined ? {} : { kanji }),
  });
}
/** Surface-only navigation/content list. Diagram colours preserve docs/diagrams/world-layout.svg. */
export const SURFACE_REGIONS: readonly RegionDefinition[] = Object.freeze([
  define(0, "the Hearthlands", [162, 184, 107], "The Crown's breadbasket."),
  define(
    1,
    "Shirogane",
    [220, 230, 236],
    "The Frost lingers here longest.",
    "白銀",
  ),
  define(
    2,
    "Kurogane",
    [139, 144, 153],
    "The Crown's mines began here.",
    "黒鉄",
  ),
  define(
    3,
    "Kogane",
    [212, 176, 102],
    "The Crown's treasury province.",
    "黄金",
  ),
  define(
    4,
    "the Boneyard",
    [196, 191, 178],
    "Where the titans fell marching on the Nadir.",
  ),
  define(
    5,
    "the Selva",
    [76, 122, 58],
    "The Crown's pleasure gardens, gone wild.",
  ),
  define(
    6,
    "the Sallows",
    [110, 120, 72],
    "Pilgrims walked the causeways to the shrines of the Mere.",
  ),
  define(
    7,
    "the Grey Mere",
    [123, 149, 166],
    'Fishers call the Leviathan "the Mere\'s mother".',
  ),
  define(
    8,
    "Tasogare",
    [70, 58, 116],
    "The Sundering tore the sky here, and the light drains into the wound.",
    "黄昏",
  ),
  define(
    9,
    "Ibara",
    [110, 42, 28],
    "Where the deep's heat broke through; the thorns are the underworld's roots pushing up.",
    "茨",
  ),
  define(
    10,
    "Hoshikuzu",
    [63, 143, 152],
    "Where the Wellspring's breath crystallises in the open.",
    "星屑",
  ),
  define(
    11,
    "the Sundered Isles",
    [159, 176, 195],
    "The land that fell upward.",
  ),
  define(
    12,
    "the Nadir",
    [42, 42, 49],
    "The Crown's heart, heaved up and burned black.",
  ),
  define(
    13,
    "the Blackwater",
    [27, 39, 51],
    "Once the Mirror, the lake of the Crown's capital.",
  ),
  define(
    14,
    "the Rim",
    [201, 219, 230],
    "The Kaldfolk survive the Frost in halls deep in the ice.",
  ),
  define(
    15,
    "the Frost",
    [238, 243, 247],
    "Nothing lives in the whiteout beyond the Rim.",
  ),
]);
export function regionIndex(id: RegionId): number {
  const index = REGION_IDS.indexOf(id);
  if (index < 0) throw new RangeError("Unknown region ID");
  return index;
}
