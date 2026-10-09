import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { parseAtlas } from "../../src/atlas/config.js";
import { type AtlasRequest, renderAtlas } from "../../src/atlas/render.js";
import { atlasReview } from "../../src/terrain-review/annotate.js";
import { encodeRaster } from "../../src/terrain-review/output.js";
import {
  createSurfaceSample,
  createTestWorldSource,
  type TerrainReviewSource,
} from "../../src/terrain-review/source.js";

const small = (
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
): AtlasRequest => ({
  width: 2,
  height: 2,
  bounds: { minX, minZ, maxX, maxZ },
  heightMin: -8,
  heightMax: 32,
  relief: 4,
});
describe("height atlas", () => {
  it("adds review units outside the plot without resizing or replacing data pixels", async () => {
    const raw = renderAtlas(
      { ...small(-32, -32, 32, 32), width: 64, height: 64 },
      createTestWorldSource(1),
    );
    const review = await atlasReview(raw),
      plot = review.metadata.review.plot;
    expect([plot.width, plot.height]).toEqual([64, 64]);
    for (let row = 0; row < raw.height; row++)
      expect([
        ...review.rgba.slice(
          ((plot.y + row) * review.width + plot.x) * 4,
          ((plot.y + row) * review.width + plot.x + raw.width) * 4,
        ),
      ]).toEqual([
        ...raw.rgba.slice(row * raw.width * 4, (row + 1) * raw.width * 4),
      ]);
  });
  it("samples pixel centres in north-up order, preserving negative coordinates", () => {
    const seen: [number, number][] = [],
      source: TerrainReviewSource = {
        ...createTestWorldSource(1),
        writeSurface(x, z, out) {
          seen.push([x, z]);
          Object.assign(out, { height: x + z, dx: 1, dz: 1, waterLevel: null });
        },
      };
    const image = renderAtlas(small(-3, -2, -1, 0), source);
    expect(seen).toEqual([
      [-2.5, -1.5],
      [-1.5, -1.5],
      [-2.5, -0.5],
      [-1.5, -0.5],
    ]);
    expect(image.metadata.metresPerPixel).toEqual({ x: 1, z: 1 });
    expect(image.metadata.statistics.minHeight).toBe(-4);
    expect(image.metadata.statistics.maxHeight).toBe(-2);
  });
  it("uses real pond water, while the dry spawn remains land", () => {
    const source = createTestWorldSource(1),
      pond = renderAtlas(small(43, 23, 45, 25), source),
      spawn = renderAtlas(small(-1, -1, 1, 1), source);
    expect(pond.metadata.statistics.waterPixels).toBe(4);
    expect(pond.rgba[2]).toBeGreaterThan(Number(pond.rgba[0]));
    expect(spawn.metadata.statistics).toMatchObject({
      minHeight: 6,
      maxHeight: 6,
      waterPixels: 0,
    });
    expect(spawn.rgba[1]).toBeGreaterThan(Number(spawn.rgba[2]));
  });
  it("does not turn dry terrain below the datum into an ocean", () => {
    const source = createTestWorldSource(1),
      surface = createSurfaceSample();
    let dry: [number, number] | null = null;
    for (let z = -20000; z <= 20000 && !dry; z += 2500)
      for (let x = -20000; x <= 20000; x += 2500) {
        source.writeSurface(x, z, surface);
        if (surface.height < -0.5 && surface.waterLevel === null) {
          dry = [x, z];
          break;
        }
      }
    expect(dry).not.toBeNull();
    if (!dry) throw new Error("Expected a dry below-datum test-world location");
    const image = renderAtlas(
      small(dry[0] - 1, dry[1] - 1, dry[0] + 1, dry[1] + 1),
      source,
    );
    expect(image.metadata.statistics.waterPixels).toBe(0);
    expect(image.metadata.statistics.dryBelowDatumPixels).toBe(4);
  });
  it("encodes exact dimensions, orientation and opaque water pixels into PNG", () => {
    const image = renderAtlas(
      { ...small(40, 20, 48, 28), width: 8, height: 8 },
      createTestWorldSource(1),
    );
    const decoded = PNG.sync.read(encodeRaster(image));
    expect(decoded.width).toBe(8);
    expect(decoded.height).toBe(8);
    expect(new Uint8Array(decoded.data)).toEqual(image.rgba);
    expect(
      [...decoded.data].filter((_v, i) => i % 4 === 3).every((v) => v === 255),
    ).toBe(true);
  });
  it("keeps adjacent image tiles on the same sampling lattice", () => {
    const source = createTestWorldSource(3),
      whole = renderAtlas({ ...small(-2, -1, 2, 1), width: 4 }, source);
    const left = renderAtlas(small(-2, -1, 0, 1), source),
      right = renderAtlas(small(0, -1, 2, 1), source);
    for (let row = 0; row < 2; row++)
      expect([...whole.rgba.slice(row * 16, row * 16 + 16)]).toEqual([
        ...left.rgba.slice(row * 8, row * 8 + 8),
        ...right.rgba.slice(row * 8, row * 8 + 8),
      ]);
  });
  it("rejects unsupported content and stretched/invalid bounds instead of inventing maps", () => {
    expect(() => parseAtlas(["--world", "test", "--mode", "regions"])).toThrow(
      /WorldPlan/,
    );
    expect(() => parseAtlas(["--layer", "maw"])).toThrow(/floor heights/);
    expect(parseAtlas(["--world", "main", "--mode", "regions"])).toMatchObject({
      world: "main",
      request: {
        mode: "regions",
        bounds: { minX: -22528, maxX: 22528, minZ: -22528, maxZ: 22528 },
      },
    });
    expect(parseAtlas(["--mode", "features"])).toMatchObject({
      world: "main",
      request: { mode: "features", layer: "surface" },
    });
    expect(
      parseAtlas([
        "--world",
        "main",
        "--layer",
        "surface",
        "--mode",
        "features",
      ]),
    ).toMatchObject({
      world: "main",
      request: { mode: "features", layer: "surface" },
    });
    expect(() => parseAtlas(["--mode", "unknown"])).toThrow(/Mode/);
    expect(() => parseAtlas(["--world", "test", "--mode", "features"])).toThrow(
      /WorldPlan/,
    );
    for (const layer of ["upper_deep", "undercrown", "maw", "pit"])
      expect(() =>
        parseAtlas(["--layer", layer, "--mode", "features"]),
      ).toThrow(/surface-only/);
    expect(() => parseAtlas(["--region", "hellscape"])).toThrow(/Unsupported/);
    expect(() =>
      renderAtlas(small(0, 0, 2, 4), createTestWorldSource(1)),
    ).toThrow(/equal metres/);
    expect(() =>
      renderAtlas(small(-22529, 0, -22527, 2), createTestWorldSource(1)),
    ).toThrow(/world frame/);
    expect(() => parseAtlas(["--seed", "4294967296"])).toThrow(/32-bit/);
  });
});
