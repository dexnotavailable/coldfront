import { describe, expect, it } from "vitest";
import { Block } from "../src/blocks/registry.js";
import { farSideIntervals, meshFarTile } from "../src/meshing/columns.js";
import { quantizeFarY } from "../src/worldgen/far/coordinates.js";
import { farLight } from "../src/worldgen/far/edits.js";
import {
  FarCapacityError,
  type FarRun,
  type FarTileRuns,
} from "../src/worldgen/far/types.js";

function run(bottom: number, top: number, block: number = Block.Stone): FarRun {
  return {
    bottom,
    top,
    block,
    light: farLight(block),
    featureId: 0xfedcba98,
    flags: 0,
  };
}
function uniformTile(runs: readonly FarRun[]): FarTileRuns {
  const words = new Uint32Array(1156 * runs.length * 4),
    offsets = new Uint32Array(1157);
  for (let ci = 0; ci <= 1156; ci++) {
    offsets[ci] = ci * runs.length;
    if (ci === 1156) break;
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i] as FarRun,
        start = (ci * runs.length + i) * 4;
      words[start] = quantizeFarY(r.bottom) | (quantizeFarY(r.top) << 16);
      words[start + 1] = r.block | (r.light << 16);
      words[start + 2] = r.featureId;
    }
  }
  return {
    address: { tx: -1, tz: -1, lod: 2 },
    layer: "surface",
    revision: 0,
    offsets,
    words,
    statistics: {
      densityCalls: 0,
      columns: 1156,
      runs: 1156 * runs.length,
      quads: 0,
      skirtQuads: 0,
      typedArrayBytes: offsets.byteLength + words.byteLength,
    },
  };
}
describe("far interval meshing", () => {
  it("subtracts several neighbouring solid intervals without filling the cave gap", () => {
    expect(
      farSideIntervals(run(0, 20), [run(-5, 4), run(8, 12), run(16, 24)]),
    ).toEqual({
      visible: [
        [4, 8],
        [12, 16],
      ],
      hidden: [
        [0, 4],
        [8, 12],
        [16, 20],
      ],
    });
  });
  it("culls touching material interfaces and retains four independently selectable skirt sides", () => {
    const mesh = meshFarTile(uniformTile([run(-8, 0), run(0, 8, Block.Dirt)]));
    expect(mesh.statistics.quads).toBe(2 * 32 * 32);
    expect(mesh.statistics.skirtQuads).toBe(4 * 32 * 2);
    expect(mesh.skirts).toHaveLength(4);
    for (const side of mesh.skirts)
      expect(side[0]?.indices.length).toBe(32 * 2 * 6);
    const features = mesh.parts[0]?.featureIdParts;
    expect(features?.[0]).toBe(0xba98);
    expect(features?.[1]).toBe(0xfedc);
  });
  it("keeps full-height fractional Y in direct Float32 positions", () => {
    const mesh = meshFarTile(uniformTile([run(-1200.125, 900.375)]));
    const heights = new Set<number>();
    const positions = mesh.parts[0]?.positions ?? [];
    for (let i = 1; i < positions.length; i += 3)
      heights.add(Number(positions[i]));
    expect(heights).toEqual(new Set([335.875, 2436.375]));
  });
  it("returns a typed capacity error instead of a truncated mesh", () => {
    expect(() => meshFarTile(uniformTile([run(0, 8)]), { quads: 1 })).toThrow(
      FarCapacityError,
    );
  });
});
