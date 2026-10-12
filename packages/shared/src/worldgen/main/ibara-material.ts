import { Block } from "../../blocks/registry.js";
import { hash4, rand01 } from "../../math/hash.js";
import type { IbaraGroundTag, IbaraMaterialSample } from "../../world/types.js";

/** P6's world-space, feature-ID-seeded strata contract. These are tone changes,
 * not alternating block IDs: an obsidian thorn remains obsidian throughout.
 * P6 chooses one spacing and two or three tones per exact feature identity;
 * warp affects band height in metres, never the feature's shape or sampled t. */
export const IBARA_STRATA = Object.freeze({
  spacingRange: Object.freeze([3, 7] as const),
  toneCounts: Object.freeze([2, 3] as const),
  toneMultipliers: Object.freeze([0.82, 1, 1.13] as const),
  warpAmplitude: 1.1,
  warpWavelength: 24,
});

/** Tags are supplied by the volcanic ground owner; proximity cannot create lava. */
export function ibaraGroundMaterial(
  tag: IbaraGroundTag,
  baseBlock: number,
): number {
  switch (tag) {
    case "base":
      return baseBlock;
    case "basalt":
      return Block.Basalt;
    case "ash":
      return Block.Ash;
    case "obsidian":
      return Block.Obsidian;
    case "sulphur":
      return Block.SulphurCrust;
    case "vent":
      return Block.VentMouth;
  }
}

/** Consume the winning P1 sample as-is. Placement probabilities, lava eligibility,
 * parent ownership and break state belong to P1; no geometry is queried here. */
export function ibaraMaterial(
  x: number,
  y: number,
  z: number,
  baseBlock: number,
  feature: IbaraMaterialSample,
  groundSurfaceY: number,
): number {
  if (feature.featureId === 0 || feature.kind === "none") return baseBlock;

  const core = feature.core === "obsidian" ? Block.Obsidian : Block.Basalt;
  if (feature.kind === "thorn" && !feature.broken && feature.t > 0.85) {
    if (feature.crust === "ember") return Block.EmberCrust;
    if (feature.crust === "brimstone") return Block.BrimstoneCrust;
  }

  // The spine starts buried, so its first 5.5% usually cannot weather the visible
  // foot. Use the actual local ash surface for both the body and its debris.
  // Broad, continuous patches climb at most three metres, irrespective of thorn
  // height; airborne branches, upper shards and non-ash terrain keep their core.
  if (
    feature.kind !== "branch" &&
    baseBlock === Block.Ash &&
    y - groundSurfaceY < 3
  ) {
    const gx = Math.floor(x / 5),
      gz = Math.floor(z / 5);
    const ux = x / 5 - gx,
      uz = z / 5 - gz;
    const sx = ux * ux * (3 - 2 * ux),
      sz = uz * uz * (3 - 2 * uz);
    const a = rand01(hash4(feature.featureId, gx, gz, 0x617368)),
      b = rand01(hash4(feature.featureId, gx + 1, gz, 0x617368)),
      c = rand01(hash4(feature.featureId, gx, gz + 1, 0x617368)),
      d = rand01(hash4(feature.featureId, gx + 1, gz + 1, 0x617368));
    const near = a + (b - a) * sx,
      far = c + (d - c) * sx;
    const depositHeight = 0.35 + 2.65 * (near + (far - near) * sz);
    if (y - groundSurfaceY < depositHeight) return Block.Ash;
  }

  return core;
}
