import { describe, expect, it } from "vitest";
import { hash4, rand01 } from "../../src/math/hash.js";
import { Region } from "../../src/world/regions.js";
import type { RegionWeights } from "../../src/world/types.js";
import {
  createMainField,
  MAX_FINE_RELIEF,
  MainColumn,
  type MainFieldData,
} from "../../src/worldgen/main/surface.js";
import {
  fineAmplitude,
  fineRelief,
  TERRAIN_RECIPES,
  terrainDetailMask,
} from "../../src/worldplan/terrain.js";

const scratch = new Float64Array(6);
function weights(id: number): RegionWeights {
  return {
    count: 1,
    ids: new Uint8Array([id, 0, 0]),
    weights: new Float64Array([1, 0, 0]),
  };
}
function point(seed: number, i: number): readonly [number, number] {
  return [
    40000 * rand01(hash4(seed, i, 0, 731)) - 20000,
    40000 * rand01(hash4(seed, i, 1, 731)) - 20000,
  ];
}

describe("broad usable surface terrain", () => {
  it("keeps most of the landscape calm and retains coherent rough patches", () => {
    let calm = 0;
    let rough = 0;
    let largestTenMetreChange = 0;
    for (let seed = 1; seed <= 3; seed++)
      for (let i = 0; i < 1024; i++) {
        const [x, z] = point(seed, i);
        const mask = terrainDetailMask(seed, x, z, scratch);
        expect(mask).toBeGreaterThanOrEqual(0);
        expect(mask).toBeLessThanOrEqual(1);
        if (mask === 0) calm++;
        if (mask === 1) rough++;
        largestTenMetreChange = Math.max(
          largestTenMetreChange,
          Math.abs(mask - terrainDetailMask(seed, x + 10, z, scratch)),
        );
      }
    expect(calm / 3072).toBeGreaterThan(0.48);
    expect(calm / 3072).toBeLessThan(0.62);
    expect(rough / 3072).toBeGreaterThan(0.14);
    expect(rough / 3072).toBeLessThan(0.26);
    // The roughness envelope must not itself add short-wavelength ripples.
    expect(largestTenMetreChange).toBeLessThan(0.12);
  });

  it.each([
    [Region.Plains, 0.085],
    [Region.Tundra, 0.065],
    [Region.Desert, 0.085],
    [Region.Boneyard, 0.055],
    [Region.Jungle, 0.12],
    [Region.Swamp, 0.035],
    [Region.Twilight, 0.08],
    [Region.Hellscape, 0.075],
    [Region.Shardfields, 0.055],
    [Region.Isles, 0.07],
    [Region.Nadir, 0.06],
  ])("limits ordinary one-metre detail slopes in region%s", (id, limit) => {
    const w = weights(id);
    const centre = new Float64Array(2);
    const east = new Float64Array(2);
    const south = new Float64Array(2);
    let slopes = 0;
    for (let i = 0; i < 768; i++) {
      const [x, z] = point(17, i);
      fineRelief(17, x, z, w, centre, scratch);
      fineRelief(17, x + 1, z, w, east, scratch);
      fineRelief(17, x, z + 1, w, south, scratch);
      const h = Number(centre[0]) + Number(centre[1]);
      slopes += Math.hypot(
        Number(east[0]) + Number(east[1]) - h,
        Number(south[0]) + Number(south[1]) - h,
      );
    }
    expect(slopes / 768).toBeLessThan(limit);
  });

  it("preserves the mountain, lake-bed, Blackwater, Rim and Frost profiles", () => {
    const fixtures = [
      [Region.Mountains, 3.426179287272987, -0.6766459765242815],
      [Region.Lake, 0, -0.04104748396390395],
      [Region.Blackwater, 0, -0.18017885582684728],
      [Region.Rim, 0.18064815579518484, -0.09206556772148515],
      [Region.Frost, 0, 0],
    ];
    const out = new Float64Array(2);
    for (const [id, meso, micro] of fixtures) {
      fineRelief(17, 12345.25, -6789.75, weights(Number(id)), out, scratch);
      expect(Array.from(out)).toEqual([meso, micro]);
    }
  });

  it("bounds all recipes and blends even where roughness reaches its full strength", () => {
    const out = new Float64Array(2);
    for (let id = 0; id < 16; id++) {
      const w = weights(id);
      expect(fineAmplitude(w)).toBeLessThanOrEqual(MAX_FINE_RELIEF);
      for (let i = 0; i < 128; i++) {
        const [x, z] = point(43, i);
        fineRelief(43, x, z, w, out, scratch);
        expect(
          Math.abs(Number(out[0])) + Math.abs(Number(out[1])),
        ).toBeLessThanOrEqual(fineAmplitude(w));
      }
    }
    const blend: RegionWeights = {
      count: 3,
      ids: new Uint8Array([Region.Plains, Region.Mountains, Region.Tundra]),
      weights: new Float64Array([0.35, 0.4, 0.25]),
    };
    for (let i = 0; i < 128; i++) {
      const [x, z] = point(71, i);
      fineRelief(71, x, z, blend, out, scratch);
      expect(
        Math.abs(Number(out[0])) + Math.abs(Number(out[1])),
      ).toBeLessThanOrEqual(fineAmplitude(blend));
    }
    expect(
      Math.max(
        ...TERRAIN_RECIPES.map((r) => r.mesoAmplitude + r.microAmplitude),
      ),
    ).toBe(MAX_FINE_RELIEF);
  });

  it("keeps shores closed, finite gradients and conservative bounds in the actual field", () => {
    const data: MainFieldData = {
      seed: 1,
      grid: { minX: -12608, minZ: -12608, width: 3, depth: 3, spacing: 64 },
      terrainMacro: new Float64Array([-2, 0, 2, -2, 0, 2, -2, 0, 2]),
      basinIds: new Uint32Array([1, 0, 0, 1, 0, 0, 1, 0, 0]),
      waterBodies: [
        { id: 1, kind: "water" as const, level: 0, source: "pond" as const },
      ],
    };
    const field = createMainField(data, []);
    const column = field.createColumn();
    const area = { minX: -12608, minZ: -12608, maxX: -12480, maxZ: -12480 };
    const bounds = field.surfaceBounds(area, {
      minSurfaceY: 0,
      maxSurfaceY: 0,
      maxSolidY: 0,
      maxFluidY: 0,
    });
    for (let z = area.minZ; z <= area.maxZ; z += 8)
      for (let x = area.minX; x <= area.maxX; x += 2) {
        field.sampleColumn(x, z, column);
        const h = Number(column[MainColumn.Height]);
        expect(h).toBeGreaterThanOrEqual(bounds.minSurfaceY);
        expect(h).toBeLessThanOrEqual(bounds.maxSurfaceY);
        expect(Number.isFinite(column[MainColumn.Dx])).toBe(true);
        expect(Number.isFinite(column[MainColumn.Dz])).toBe(true);
        const macro = Number(column[MainColumn.Macro]);
        if (macro < 0) expect(h).toBeLessThanOrEqual(0);
        if (macro >= 0) expect(h).toBeGreaterThanOrEqual(0);
        expect(field.height(x, z)).toBe(h);
      }
    for (let z = area.minZ + 1; z < area.maxZ; z += 8) {
      expect(
        Math.abs(
          field.height(-12544 - 1e-5, z) - field.height(-12544 + 1e-5, z),
        ),
      ).toBeLessThan(1e-4);
    }
  });
});
