import { describe, expect, it } from "vitest";
import {
  Column,
  createColumnSample,
  createVoxelSample,
  sampleTestColumn,
  sampleTestVoxel,
} from "../../../shared/src/worldgen/test-world.js";
import {
  createSurfaceSample,
  createTestWorldSource,
} from "../../src/terrain-review/source.js";

describe("WorldContext review adapter", () => {
  it("preserves the accepted exact test columns and point voxels including pond ownership", () => {
    const source = createTestWorldSource(3),
      surface = createSurfaceSample(),
      expected = createVoxelSample(),
      actual = createVoxelSample();
    for (const [x, z] of [
      [0, 0],
      [44, 24],
      [-33.25, 71.5],
      [320, -64],
    ] as const) {
      const column = sampleTestColumn(3, x, z, createColumnSample());
      source.writeSurface(x, z, surface);
      expect(surface).toEqual({
        height: column[Column.Height],
        dx: column[Column.Dx],
        dz: column[Column.Dz],
        waterLevel: Number.isFinite(column[Column.WaterLevel])
          ? column[Column.WaterLevel]
          : null,
      });
      const vertical = source.column(x, z);
      for (const y of [-1505, -500, -48.5, -4.5, -0.5, 6, 20]) {
        vertical.writeVoxel(y, actual);
        sampleTestVoxel(3, x, y, z, expected, column);
        expect(actual).toEqual(expected);
      }
    }
  });
});
