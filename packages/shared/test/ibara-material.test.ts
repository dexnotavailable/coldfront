import { describe, expect, it } from "vitest";
import { Block } from "../src/blocks/registry.js";
import type { IbaraMaterialSample } from "../src/world/types.js";
import {
  IBARA_STRATA,
  ibaraGroundMaterial,
  ibaraMaterial,
} from "../src/worldgen/main/ibara-material.js";

const thorn: IbaraMaterialSample = Object.freeze({
  featureId: 16777219,
  t: 0.5,
  core: "obsidian",
  crust: "ember",
  kind: "thorn",
  broken: false,
});
const material = (
  changes: Partial<IbaraMaterialSample> = {},
  base = Block.Stone as number,
): number => ibaraMaterial(-27.5, 92.5, -4.5, base, { ...thorn, ...changes });

it("maps only the authoritative ground tag, preserving base terrain and fluid ownership", () => {
  for (const base of [Block.Air, Block.Stone, Block.Water, Block.Lava])
    expect(ibaraGroundMaterial("base", base)).toBe(base);
  expect(ibaraGroundMaterial("basalt", Block.Stone)).toBe(Block.Basalt);
  expect(ibaraGroundMaterial("ash", Block.Stone)).toBe(Block.Ash);
  expect(ibaraGroundMaterial("obsidian", Block.Stone)).toBe(Block.Obsidian);
  expect(ibaraGroundMaterial("sulphur", Block.Stone)).toBe(Block.SulphurCrust);
  expect(ibaraGroundMaterial("vent", Block.Air)).toBe(Block.VentMouth);
});

it("preserves any base material for both ways of clearing a dominant feature", () => {
  for (const base of [Block.Air, Block.Ash, Block.Water, Block.Lava]) {
    expect(material({ featureId: 0, t: 1 }, base)).toBe(base);
    expect(material({ kind: "none", t: 1 }, base)).toBe(base);
  }
});

describe.each(["obsidian", "basalt"] as const)("%s thorn", (core) => {
  const block = core === "obsidian" ? Block.Obsidian : Block.Basalt;
  it("keeps the sampled per-thorn core without re-rolling its eligibility", () => {
    for (const t of [0, 0.055, 0.5, 0.85])
      expect(material({ core, t })).toBe(block);
    expect(material({ core, t: 1, crust: "none" })).toBe(block);
  });
  it("uses the strict binary64 tip boundary for the two eligible crusts", () => {
    for (const [crust, tipBlock] of [
      ["ember", Block.EmberCrust],
      ["brimstone", Block.BrimstoneCrust],
    ] as const) {
      expect(material({ core, crust, t: 0.85 })).toBe(block);
      expect(material({ core, crust, t: 0.8500000000000001 })).toBe(tipBlock);
      expect(material({ core, crust, t: 1 })).toBe(tipBlock);
    }
  });
  it("excludes every broken owner and secondary shape even at the parent's tip", () => {
    for (const kind of ["thorn", "branch", "debris", "rubble"] as const)
      for (const crust of ["ember", "brimstone"] as const)
        for (const t of [0.85, 0.9, 1]) {
          expect(material({ core, kind, crust, t, broken: true })).toBe(block);
          if (kind !== "thorn")
            expect(material({ core, kind, crust, t, broken: false })).toBe(
              block,
            );
        }
  });
});

it("grounds patchy ash at primary roots while scree and airborne roots keep their core", () => {
  const counts = new Map<number, number>();
  for (let x = -16; x < 16; x++)
    for (let z = -16; z < 16; z++) {
      const sample = { ...thorn, t: 0.03 };
      const block = ibaraMaterial(x, -0.5, z, Block.Ash, sample);
      counts.set(block, (counts.get(block) ?? 0) + 1);
      expect(ibaraMaterial(x, -0.5, z, Block.Ash, sample)).toBe(block);
      expect(ibaraMaterial(x, -0.5, z, Block.Air, sample)).toBe(Block.Obsidian);
      for (const kind of ["branch", "debris", "rubble"] as const)
        expect(ibaraMaterial(x, -0.5, z, Block.Ash, { ...sample, kind })).toBe(
          Block.Obsidian,
        );
      expect(
        ibaraMaterial(x, -0.5, z, Block.Ash, { ...sample, t: 0.055 }),
      ).toBe(Block.Obsidian);
    }
  expect([...counts.keys()].sort((a, b) => a - b)).toEqual([
    Block.Ash,
    Block.Obsidian,
  ]);
  expect(counts.get(Block.Ash)).toBeGreaterThan(128);
  expect(counts.get(Block.Ash)).toBeLessThan(640);
});

it("is query-order independent, does not mutate the sample and keeps exact uint32 identities", () => {
  const positions = [-64.5, -32.5, -0.5, 0.5, 32.5, 64.5];
  for (const featureId of [1, 16777216, 16777217, 33554431, 0xffffffff]) {
    const sample = Object.freeze({ ...thorn, featureId, t: 0.02 });
    const ascending = positions.map((x) =>
      ibaraMaterial(x, 4, -x, Block.Ash, sample),
    );
    const descending = [...positions]
      .reverse()
      .map((x) => ibaraMaterial(x, 4, -x, Block.Ash, sample));
    expect(descending.reverse()).toEqual(ascending);
    expect(sample).toEqual({ ...thorn, featureId, t: 0.02 });
  }
  // Adjacent IDs above float32's exact range are still different input hashes.
  const pattern = (featureId: number): number[] =>
    positions.map((x) =>
      ibaraMaterial(x, 4, -x, Block.Ash, { ...thorn, featureId, t: 0.02 }),
    );
  expect(pattern(16777216)).not.toEqual(pattern(16777217));
});

it("provides immutable metres-based warped strata data for two or three tones", () => {
  expect(IBARA_STRATA.spacingRange).toEqual([3, 7]);
  expect(IBARA_STRATA.toneCounts).toEqual([2, 3]);
  expect(IBARA_STRATA.toneMultipliers).toHaveLength(3);
  expect(IBARA_STRATA.warpAmplitude).toBeGreaterThan(0);
  expect(IBARA_STRATA.warpAmplitude).toBeLessThan(3);
  expect(IBARA_STRATA.warpWavelength).toBeGreaterThan(7);
  for (const value of [
    IBARA_STRATA,
    IBARA_STRATA.spacingRange,
    IBARA_STRATA.toneCounts,
    IBARA_STRATA.toneMultipliers,
  ])
    expect(Object.isFrozen(value)).toBe(true);
});
