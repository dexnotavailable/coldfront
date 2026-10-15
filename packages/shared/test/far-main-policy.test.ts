import { describe, expect, it } from "vitest";
import { createIbaraSample } from "../src/features/ibara/types.js";
import type { VoxelSample } from "../src/world/types.js";
import {
  type IbaraDensityBatch,
  prepareIbaraSampler,
  sampleMainVoxel,
} from "../src/worldgen/main/features.js";
import type { IbaraGround } from "../src/worldgen/main/ibara-ground.js";
import { MainColumn } from "../src/worldgen/main/surface.js";
import { clearLava } from "../src/worldplan/lava.js";

describe("main density far-only terrain policy", () => {
  it("preserves near samples after coarse calls and never translates feature Y", () => {
    const ground: IbaraGround = {
      height: () => 20,
      sample: (_x, y, _z, out) =>
        Object.assign(out, {
          density: 20 - y,
          surfaceY: 20,
          tag: "base" as const,
        }),
      lavaQuery: (_x, _z, out) => clearLava(out),
      lavaAt: (_x, _z, out) => out.fill(-Infinity),
      conservativeBounds: (_bounds, out) =>
        Object.assign(out, {
          minSurfaceY: 20,
          maxSurfaceY: 20,
          maxSolidY: 20,
          maxFluidY: -Infinity,
        }),
    };
    const observedY: number[] = [];
    const batch: IbaraDensityBatch = {
      instances: [
        {
          bounds: { minX: 0, maxX: 8, minY: 100, maxY: 108, minZ: 0, maxZ: 8 },
        },
      ],
      density(terrain, _x, y, _z, _spacing, out) {
        observedY.push(y);
        Object.assign(out, createIbaraSample());
        const feature = Math.min(y - 100, 108 - y);
        if (feature > 0 && feature > terrain) {
          out.featureId = 0xfedcba98;
          out.t = 0.5;
          out.kind = "thorn";
          out.core = "obsidian";
          out.crust = "ember";
        }
        return Math.max(terrain, feature);
      },
    };
    const column = new Float64Array(MainColumn.Stride);
    column[MainColumn.Height] = 20;
    column[MainColumn.NaturalHeight] = 20;
    column[MainColumn.DistanceScale] = 1;
    column[MainColumn.WaterLevel] = -Infinity;
    column[MainColumn.BridgeMargin] = -Infinity;
    column[MainColumn.BridgeTop] = -Infinity;
    const shifted = column.slice();
    shifted[MainColumn.Height] = 28;
    shifted[MainColumn.NaturalHeight] = 28;
    const voxel = (): VoxelSample => ({ density: 0, block: 0, fluid: 0 });
    for (const spacing of [1, 2]) {
      const sampler = prepareIbaraSampler(ground, () => 1, batch, spacing);
      const ys = [10, 25, 104, 110];
      const before = ys.map((y) => ({
        ...sampleMainVoxel(4, y, 4, voxel(), column, [], sampler),
      }));
      const feature = sampleMainVoxel(4, 104, 4, voxel(), column, [], sampler, {
        column: shifted,
        heightDelta: 8,
      });
      expect(feature.density).toBe(4);
      expect(feature.featureId).toBe(0xfedcba98);
      expect(observedY.at(-1)).toBe(104);
      expect(
        sampleMainVoxel(4, 25, 4, voxel(), column, [], sampler, {
          column: shifted,
          heightDelta: 8,
        }).density,
      ).toBe(3);
      const after = ys.map((y) => ({
        ...sampleMainVoxel(4, y, 4, voxel(), column, [], sampler),
      }));
      expect(after).toEqual(before);
      expect(column[MainColumn.Height]).toBe(20);
    }
  });
});
