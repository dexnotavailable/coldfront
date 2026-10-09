import { Block } from "../../blocks/registry.js";
import { hash4 } from "../../math/hash.js";
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
): number {
  if (feature.featureId === 0 || feature.kind === "none") return baseBlock;

  const core = feature.core === "obsidian" ? Block.Obsidian : Block.Basalt;
  if (feature.kind === "thorn" && !feature.broken && feature.t > 0.85) {
    if (feature.crust === "ember") return Block.EmberCrust;
    if (feature.crust === "brimstone") return Block.BrimstoneCrust;
  }

  // Ground material is the grounding signal. A low t by itself does not paint
  // floating branches or the buried end of a fallen shard with ash. Broken
  // primary roots may still meet an ash plain; scree/debris retain parent core.
  if (
    feature.kind === "thorn" &&
    feature.t >= 0 &&
    feature.t < 0.055 &&
    baseBlock === Block.Ash &&
    (hash4(
      feature.featureId,
      Math.floor(x / 2),
      Math.floor(y / 2),
      Math.floor(z / 2),
    ) &
      7) <
      3
  )
    return Block.Ash;

  return core;
}
