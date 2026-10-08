import { describe, expect, it } from "vitest";
import { Block } from "../../../shared/src/blocks/registry.js";
import { parseSlice } from "../../src/slice/config.js";
import {
  renderSection,
  type SectionRequest,
  windowSection,
} from "../../src/slice/render.js";
import {
  createTestWorldSource,
  type ReviewVoxel,
  type TerrainReviewSource,
} from "../../src/terrain-review/source.js";

describe("pointwise material sections", () => {
  it("samples all pixels within exact endpoints, including partial final cells and negative coordinates", () => {
    const seen: [number, number, number][] = [],
      source: TerrainReviewSource = {
        ...createTestWorldSource(1),
        column(x, z) {
          return {
            x,
            z,
            writeVoxel(y, out) {
              seen.push([x, y, z]);
              Object.assign(out, { block: 0, fluid: 0, density: -1 });
            },
          };
        },
      };
    const image = renderSection(
      {
        kind: "window",
        from: [-3, -4],
        to: [0, 0],
        yMin: -3,
        yMax: 2,
        metresPerPixel: 2,
      },
      source,
    );
    expect([image.width, image.height]).toEqual([3, 3]);
    expect(seen[0]?.[0]).toBeCloseTo(-2.4, 12);
    expect(seen[0]?.[1]).toBe(1);
    expect(seen[0]?.[2]).toBeCloseTo(-3.2, 12);
    expect(seen.at(-1)?.[0]).toBeCloseTo(-0.3, 12);
    expect(seen.at(-1)?.[1]).toBe(-2.5);
    expect(seen.at(-1)?.[2]).toBeCloseTo(-0.4, 12);
    expect(image.metadata.lastColumnMetres).toBe(1);
    expect(image.metadata.lastRowMetres).toBe(1);
    expect(image.metadata.materials[0]?.sampledAreaSquareMetres).toBe(25);
  });
  it("shows the actual grass/dirt/stone layers at the dry origin", () => {
    const image = renderSection(
      {
        kind: "window",
        from: [-2, 0],
        to: [2, 0],
        yMin: -2,
        yMax: 8,
        metresPerPixel: 1,
      },
      createTestWorldSource(1),
    );
    expect(image.metadata.materials.map((m) => [m.id, m.pixels])).toEqual([
      [Block.Air, 8],
      [Block.Stone, 16],
      [Block.Dirt, 12],
      [Block.Grass, 4],
    ]);
    expect(image.metadata.density.positivePixels).toBe(32);
    expect(image.metadata.fluidPixels).toBe(0);
    expect([...image.rgba.slice(0, 4)]).toEqual([0, 0, 0, 255]);
  });
  it("distinguishes pond fluid from its solid sand bed and records density signs", () => {
    const image = renderSection(
      {
        kind: "window",
        from: [43, 24],
        to: [45, 24],
        yMin: -5,
        yMax: 2,
        metresPerPixel: 1,
      },
      createTestWorldSource(1),
    );
    expect(image.metadata.materials.map((m) => [m.id, m.pixels])).toEqual([
      [Block.Air, 4],
      [Block.Sand, 2],
      [Block.Water, 8],
    ]);
    expect(image.metadata.fluidPixels).toBe(8);
    expect(image.metadata.density.positivePixels).toBe(2);
    const source = createTestWorldSource(1),
      column = source.column(44, 24),
      voxel: ReviewVoxel = { block: 0, fluid: 0, density: 0 };
    column.writeVoxel(-0.5, voxel);
    expect(voxel).toMatchObject({ block: Block.Water, fluid: Block.Water });
    expect(voxel.density).toBeLessThan(0);
    column.writeVoxel(-4.5, voxel);
    expect(voxel.block).toBe(Block.Sand);
    expect(voxel.density).toBeGreaterThan(0);
  });
  it("preserves deep-stone/worldstone boundaries without fabricating caves or layers", () => {
    const column = createTestWorldSource(1).column(0, 0),
      sample: ReviewVoxel = { block: 0, fluid: 0, density: 0 };
    column.writeVoxel(-47.5, sample);
    expect(sample.block).toBe(Block.Stone);
    column.writeVoxel(-48.5, sample);
    expect(sample.block).toBe(Block.DeepStone);
    column.writeVoxel(-1503.5, sample);
    expect(sample.block).toBe(Block.DeepStone);
    column.writeVoxel(-1504.5, sample);
    expect(sample.block).toBe(Block.Worldstone);
    column.writeVoxel(-1536.5, sample);
    expect(sample.block).toBe(Block.Air);
  });
  it("defaults to the required SW→NE16m overview and creates an exact requested parallel window", () => {
    const command = parseSlice([]);
    expect(command.overview).toMatchObject({
      from: [-15556, 15556],
      to: [15556, -15556],
      metresPerPixel: 16,
      yMin: -1536,
      yMax: 1024,
    });
    expect(command.windows[0]?.metresPerPixel).toBe(1);
    const section = windowSection(command.overview, [44, 24], 2000, 2, -64, 48);
    expect((section.from[0] + section.to[0]) / 2).toBeCloseTo(44, 12);
    expect((section.from[1] + section.to[1]) / 2).toBeCloseTo(24, 12);
    expect(
      Math.hypot(
        section.to[0] - section.from[0],
        section.to[1] - section.from[1],
      ),
    ).toBeCloseTo(2000, 10);
  });
  it("rejects unknown worlds, layer clipping, excessive windows and zero/out-of-world routes", () => {
    expect(parseSlice(["--world", "main"])).toMatchObject({
      world: "main",
      overview: { overlays: "plan" },
      windows: [{ overlays: "plan", yMin: -1536, yMax: 1024 }],
    });
    expect(() => parseSlice(["--world", "future"])).toThrow(/main or test/);
    expect(() => parseSlice(["--layer", "upper_deep"])).toThrow(
      /span all depth/,
    );
    expect(() => parseSlice(["--world", "test", "--overlays", "plan"])).toThrow(
      /WorldPlan/,
    );
    expect(() => parseSlice(["--px", "3"])).toThrow(/1 or 2/);
    expect(() => parseSlice(["--len", "2001"])).toThrow(/2000/);
    expect(() => parseSlice(["--from", "0,0", "--to", "0,0"])).toThrow();
    const section: SectionRequest = {
      kind: "window",
      from: [22528, 0],
      to: [22528, 2],
      yMin: 0,
      yMax: 2,
      metresPerPixel: 1,
    };
    expect(() => renderSection(section, createTestWorldSource(1))).toThrow(
      /excluded/,
    );
    expect(() =>
      renderSection(
        { ...section, from: [0, 0], yMin: -1537 },
        createTestWorldSource(1),
      ),
    ).toThrow(/height bounds/);
  });
});
