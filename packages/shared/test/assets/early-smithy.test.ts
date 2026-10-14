import { describe, expect, it } from "vitest";
import {
  EARLY_SMITHY,
  type SmithyBox,
  sampleEarlySmithy as sample,
  smithyRoofY,
} from "../../src/assets/structures/early-smithy.js";
import { BLOCK_REGISTRY, Block } from "../../src/blocks/registry.js";

function expectAir(box: SmithyBox): void {
  for (let y = Math.floor(box.min[1]); y < box.max[1]; y++)
    for (let z = Math.floor(box.min[2]); z < box.max[2]; z++)
      for (let x = Math.floor(box.min[0]); x < box.max[0]; x++)
        expect(sample(x, y, z), `${x},${y},${z}`).toBe(Block.Air);
}
describe("early smithy geometry; not gameplay validation", () => {
  it("uses only registered non-ore materials and stable unique integer cells", () => {
    const keys = new Set<string>();
    for (const v of EARLY_SMITHY.voxels) {
      const key = `${v.x},${v.y},${v.z}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
      expect(
        Number.isInteger(v.x) && Number.isInteger(v.y) && Number.isInteger(v.z),
      ).toBe(true);
      expect(BLOCK_REGISTRY[v.block]?.solid).toBe(true);
      expect([
        Block.IronOre,
        Block.CoalOre,
        Block.CopperOre,
        Block.GoldOre,
      ]).not.toContain(v.block);
      expect(sample(v.x, v.y, v.z)).toBe(v.block);
    }
    expect(
      EARLY_SMITHY.materialCounts.reduce((sum, m) => sum + m.count, 0),
    ).toBe(keys.size);
    expect(sample(200, 0, 0)).toBe(Block.Air);
    expect(() => sample(0.5, 0, 0)).toThrow(RangeError);
  });
  it("leaves the full two-metre aisle and three-metre headroom open", () => {
    expectAir(EARLY_SMITHY.aisle);
    expectAir(EARLY_SMITHY.staging);
    expectAir(EARLY_SMITHY.operators.forge);
    expectAir(EARLY_SMITHY.operators.anvil);
    for (let z = -3; z < 13; z++)
      for (let x = 3; x < 5; x++)
        expect(BLOCK_REGISTRY[sample(x, -1, z)]?.solid).toBe(true);
  });
  it("has continuous grounded foundations and actual tie members under each roof bay", () => {
    for (let z = 0; z < 14; z++)
      for (let x = 0; x < 8; x++)
        expect(BLOCK_REGISTRY[sample(x, -1, z)]?.solid).toBe(true);
    const frames = EARLY_SMITHY.supportIntent.frameZ;
    for (let i = 1; i < frames.length; i++)
      expect(
        (frames[i] as number) - (frames[i - 1] as number),
      ).toBeLessThanOrEqual(4);
    for (const z of frames) {
      for (const x of [0, 7])
        for (let y = -1; y < smithyRoofY(x); y++)
          expect(BLOCK_REGISTRY[sample(x, y, z)]?.solid, `${x},${y},${z}`).toBe(
            true,
          );
      for (let x = 1; x < 7; x++)
        expect([Block.Log, Block.StoneBricks]).toContain(sample(x, 3, z));
    }
  });
  it("keeps three connected roof terraces and closes all front/rear wall steps", () => {
    for (let x = -1; x < 9; x++)
      for (let z = -1; z < 15; z++) {
        if (x >= 5 && x <= 7 && z >= 13) continue; // The open chimney replaces this roof bay.
        expect(sample(x, smithyRoofY(x), z)).toBe(Block.DarkPlanks);
      }
    for (const x of [2, 5])
      for (let z = -1; z < 13; z++)
        expect(sample(x, smithyRoofY(x) - 1, z)).toBe(
          x === 5 && z === 12 ? Block.StoneBricks : Block.DarkPlanks,
        );
    for (const z of [0, 13])
      for (let x = 0; x < 8; x++)
        for (let y = 0; y < smithyRoofY(x); y++) {
          if (z === 0 && x >= 3 && x < 5 && y < 3) continue;
          if (z === 13 && x === 6 && (y === 1 || y === 2)) continue;
          expect(BLOCK_REGISTRY[sample(x, y, z)]?.solid, `${x},${y},${z}`).toBe(
            true,
          );
        }
  });
  it("connects the cold forge mouth to a full-height open flue without timber in the duct", () => {
    for (const y of [1, 2])
      for (let z = 11; z <= 14; z++) expect(sample(6, y, z)).toBe(Block.Air);
    for (let y = 0; y <= 8; y++) expect(sample(6, y, 14)).toBe(Block.Air);
    for (let y = 3; y < 8; y++)
      for (const [x, z] of [
        [5, 14],
        [7, 14],
        [6, 13],
        [6, 15],
      ])
        expect(sample(x as number, y, z as number)).toBe(Block.StoneBricks);
    expect(EARLY_SMITHY.forgeState).toBe("unlit");
    expect(EARLY_SMITHY.state).toBe("geometry-study-pending-functional-parts");
  });
  it("confines the cold ash to the existing bed and adds no light source", () => {
    const ash = EARLY_SMITHY.voxels.filter((v) => v.block === Block.Ash);
    expect(ash).toEqual([
      { x: 6, y: 0, z: 11, block: Block.Ash },
      { x: 6, y: 0, z: 12, block: Block.Ash },
      { x: 6, y: 0, z: 13, block: Block.Ash },
    ]);
    for (const v of EARLY_SMITHY.voxels) {
      expect(BLOCK_REGISTRY[v.block]?.emission).toEqual([0, 0, 0]);
      expect(BLOCK_REGISTRY[v.block]?.emissionStrength).toBe(0);
    }
    for (const x of [5, 7])
      for (let z = 11; z < 14; z++)
        expect(sample(x, 0, z)).toBe(Block.StoneBricks);
  });
  it("has no unintended shell leaks when the door and exhaust are masked for diagnosis", () => {
    // These two masks exist in this test only. Real geometry remains open and
    // cannot pass a functioning building's future enclosure/part validation.
    const escapes = (doorMask: boolean, exhaustMask: boolean): boolean => {
      const queue: [number, number, number][] = [[4, 1, 6]];
      const seen = new Set<string>();
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const [x, y, z] = queue[cursor] as [number, number, number];
        const key = `${x},${y},${z}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (doorMask && z === 0 && x >= 3 && x < 5 && y < 3) continue;
        if (exhaustMask && x === 6 && z === 13 && y >= 1 && y < 3) continue;
        if (BLOCK_REGISTRY[sample(x, y, z)]?.solid) continue;
        if (x < 0 || x >= 8 || y < 0 || y >= 8 || z < 0 || z >= 16) return true;
        for (const [dx, dy, dz] of [
          [1, 0, 0],
          [-1, 0, 0],
          [0, 1, 0],
          [0, -1, 0],
          [0, 0, 1],
          [0, 0, -1],
        ])
          queue.push([
            x + (dx as number),
            y + (dy as number),
            z + (dz as number),
          ]);
      }
      return false;
    };
    expect(escapes(true, true)).toBe(false);
    expect(escapes(false, true)).toBe(true);
    expect(escapes(true, false)).toBe(true);
  });
});
