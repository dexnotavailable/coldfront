import { describe, expect, it } from "vitest";
import { Block } from "../src/blocks/registry.js";
import { createFarArea } from "../src/worldgen/far/bands.js";
import {
  generateFarTileFromArea,
  readFarRun,
} from "../src/worldgen/far/columns.js";
import { farColumnIndex } from "../src/worldgen/far/coordinates.js";
import type { TreeFeature } from "../src/worldgen/test-world.js";

/** Flat source ground and one source tree; the real adapter owns its canopy. */
function canopyTopRun(lod: 4 | 6) {
  const tree: TreeFeature = {
    cellX: 0,
    cellZ: 0,
    x: 8,
    z: 8,
    baseY: -2,
    trunkTop: 9,
    trunkRadius: 1,
    crownY: 8.5,
    crownRadius: 4,
    crownHeight: 3.5,
  };
  const area = createFarArea({
    area: {
      columns: {
        stride: 1,
        height: 0,
        gradientX: 0,
        gradientZ: 0,
        waterLevel: 0,
      },
      createColumn: () => new Float64Array(1),
      sampleColumn(_x, _z, out) {
        out[0] = 0;
        return out;
      },
    },
    options: { spacing: 1 << lod, layer: "surface" },
    trees: [tree],
    terrainHeightIndices: [0],
    displacement: 0,
    solidBase: true,
    featureBounds: [
      { minX: 4, maxX: 12, minZ: 4, maxZ: 12, minY: -2, maxY: 12 },
    ],
    surfaceBounds(_bounds, out) {
      out.minSurfaceY = 0;
      out.maxSurfaceY = 0;
      out.maxSolidY = 0;
      out.maxFluidY = -Infinity;
      return out;
    },
    materialAt: () => Block.Stone,
    sample(_x, y, _z, out) {
      out.density = -y;
      out.block = out.density > 0 ? Block.Stone : Block.Air;
      out.fluid = Block.Air;
      out.featureId = 0;
      out.featureT = 0;
      return out;
    },
    fluids() {},
  });
  const tile = generateFarTileFromArea(area, {
    address: { tx: 0, tz: 0, lod },
    layer: "surface",
    revision: 0,
  });
  const ci = farColumnIndex(0, 0);
  return readFarRun(tile, Number(tile.offsets[ci + 1]) - 1);
}

describe("far canopy review regressions", () => {
  it("keeps the source crown top at 12 m with 16 m vertical spacing", () => {
    expect(canopyTopRun(4)).toMatchObject({ block: Block.Leaves, top: 12 });
  });

  it("keeps the 12 m leaf canopy between 64 m vertical samples", () => {
    expect(canopyTopRun(6)).toMatchObject({ block: Block.Leaves, top: 12 });
  });
});
