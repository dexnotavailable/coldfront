import {
  REGION_IDS,
  SURFACE_REGIONS,
} from "../../../shared/src/world/regions.js";

/** Diagnostic atlas colours, not blocks, biome appearance, or runtime UI content. */
const DEEP = [
  ["Frost Hollows", 143, 184, 208],
  ["The Old Workings", 139, 126, 109],
  ["Kagami Grottos", 94, 187, 213],
  ["Ember Veins", 208, 107, 70],
  ["Bone Pits", 194, 181, 142],
  ["Root Halls", 115, 145, 83],
  ["Sporewood", 144, 120, 169],
  ["Drowned Caverns", 78, 128, 166],
  ["Sekitei", 161, 163, 145],
  ["The Buried City", 165, 135, 95],
  ["The Leyflow", 103, 204, 205],
  ["The Great Shear", 181, 125, 144],
  ["The Hollow Sky", 137, 158, 214],
  ["The Deep Forges", 212, 116, 80],
  ["The Gut", 151, 92, 124],
  ["Yomi", 140, 141, 95],
  ["The Throne", 202, 168, 88],
] as const;
export const ATLAS_REGIONS = [
  ...SURFACE_REGIONS.map((r) => ({ id: r.id, name: r.name, rgb: r.color })),
  ...DEEP.map((r, i) => ({
    id: String(REGION_IDS[i + 16]),
    name: r[0],
    rgb: [r[1], r[2], r[3]] as readonly number[],
  })),
] as const;
export const SITE_LEGEND = [
  { name: "Seat (square)", rgb: [255, 220, 112] },
  { name: "Fort (diamond)", rgb: [242, 157, 78] },
  { name: "Descent (cross)", rgb: [247, 124, 181] },
  { name: "Spawn (dot)", rgb: [139, 234, 170] },
  { name: "Causeway (line)", rgb: [240, 229, 201] },
  { name: "Broken gap (red)", rgb: [246, 76, 73] },
] as const;
