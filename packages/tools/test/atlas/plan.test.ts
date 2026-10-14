import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  REGION_IDS,
  SURFACE_REGIONS,
} from "../../../shared/src/world/regions.js";
import { createRegionWeights } from "../../../shared/src/worldplan/geometry.js";
import { parseAtlas } from "../../src/atlas/config.js";
import { atlasSourceHashes } from "../../src/atlas/index.js";
import { type AtlasRequest, renderAtlas } from "../../src/atlas/render.js";
import { REPO_ROOT } from "../../src/golden/fixture.js";
import { writeRaster } from "../../src/terrain-review/output.js";
import { createTestWorldSource } from "../../src/terrain-review/source.js";
import { geometryPlan } from "../terrain-review/plan-fixture.js";

const request: AtlasRequest = {
  width: 8,
  height: 8,
  bounds: { minX: -4, minZ: -4, maxX: 4, maxZ: 4 },
  mode: "regions",
  heightMin: -256,
  heightMax: 1024,
  relief: 4,
};
describe("WorldPlan atlas", () => {
  it("binds the emitted small-fixture receipt to every source byte including coverage helpers", async () => {
    const sources = await atlasSourceHashes(REPO_ROOT);
    expect(new Set(sources.map((s) => s.path)).size).toBe(sources.length);
    expect(
      sources.some(
        (s) => s.path === "packages/tools/src/terrain-report/ibara.ts",
      ),
    ).toBe(true);
    const raster = renderAtlas(request, {
      ...createTestWorldSource(1),
      world: "main",
      plan: geometryPlan(),
    });
    const receiptPath = await writeRaster(
      REPO_ROOT,
      "out/p7-diagnostics/test-receipt/atlas-fixture.png",
      raster,
      0,
      sources,
    );
    const receipt = JSON.parse(await readFile(receiptPath, "utf8")) as {
      sources: typeof sources;
      sampling: { seed: number; worldgenVersion: number };
    };
    expect(receipt.sampling).toMatchObject({
      seed: 1,
      worldgenVersion: raster.metadata.worldgenVersion,
    });
    for (const entry of receipt.sources)
      expect(entry.sha256).toBe(
        createHash("sha256")
          .update(await readFile(join(REPO_ROOT, entry.path)))
          .digest("hex"),
      );
  });
  it("uses authoritative blended colours and reports actual sampled area rather than height statistics", () => {
    const plan = geometryPlan(),
      source = { ...createTestWorldSource(1), world: "main", plan };
    const r = {
      ...request,
      bounds: { minX: 12100, minZ: 0, maxX: 12900, maxZ: 800 },
    };
    const image = renderAtlas(r, source),
      weights = createRegionWeights();
    plan.surfaceWeights(12150, 50, weights);
    const expected = [0, 0, 0];
    for (let k = 0; k < weights.count; k++)
      for (let c = 0; c < 3; c++)
        expected[c] =
          Number(expected[c]) +
          Number(SURFACE_REGIONS[Number(weights.ids[k])]?.color[c]) *
            Number(weights.weights[k]);
    expect([...image.rgba.slice(0, 4)]).toEqual([
      ...expected.map(Math.round),
      255,
    ]);
    expect(
      image.metadata.regions?.reduce((s, r) => s + r.dominantAreaKm2, 0),
    ).toBeCloseTo(0.64, 12);
    expect(
      image.metadata.regions?.reduce((s, r) => s + r.weightedAreaKm2, 0),
    ).toBeCloseTo(0.64, 12);
    expect(image.metadata.statistics.minHeight).toBeNull();
    expect(
      image.metadata.regions?.every((r) =>
        REGION_IDS.includes(r.id as (typeof REGION_IDS)[number]),
      ),
    ).toBe(true);
  });
  it("keeps the Upper Deep sealed at the centre while showing the actual Pit footprint", () => {
    const source = {
      ...createTestWorldSource(1),
      world: "main",
      plan: geometryPlan(),
    };
    const upper = renderAtlas({ ...request, layer: "upper_deep" }, source),
      pit = renderAtlas({ ...request, layer: "pit" }, source);
    expect(upper.metadata.footprint?.weightedAreaKm2).toBe(0);
    expect(upper.metadata.regions).toEqual([]);
    expect(pit.metadata.regions?.map((r) => r.id)).toEqual(["throne"]);
    expect(pit.metadata.footprint?.coreAreaKm2).toBeCloseTo(64 / 1e6, 12);
    expect(() =>
      renderAtlas({ ...request, layer: "pit", mode: "height" }, source),
    ).toThrow(/floor heights/);
  });
  it("projects all actual site records on surface and filters deep membership, with clipped causeway gaps", () => {
    const plan = geometryPlan(1, {
      seats: [
        { id: "a", region: "plains", layer: "surface", x: 0, z: 0 },
        { id: "b", region: "throne", layer: "pit", x: 20, z: 20 },
      ],
      forts: [
        { id: "fort", seatId: "b", region: "throne", layer: "pit", x: 1, z: 1 },
      ],
      descents: [
        {
          id: "stair",
          type: "Nadir Stair",
          from: "nadir",
          to: "throne",
          fromLayer: "surface",
          toLayer: "pit",
          x: 2,
          z: 2,
        },
      ],
      spawns: [
        { id: "spawn", region: "plains", x: 3, z: 3, surfaceY: 5, rank: 0 },
      ],
      bridges: [
        {
          id: "bridge",
          bearing: 0,
          halfWidth: 20,
          centreline: new Float64Array([-1000, -2, 1000, -2]),
          gaps: new Float64Array([999, 1001]),
        },
      ],
    });
    const source = { ...createTestWorldSource(1), world: "main", plan };
    const surface = renderAtlas({ ...request, mode: "sites" }, source);
    expect(surface.metadata.sites?.counts).toEqual([
      { kind: "bridges", total: 1, visible: 1 },
      { kind: "spawns", total: 1, visible: 1 },
      { kind: "forts", total: 1, visible: 1 },
      { kind: "descents", total: 1, visible: 1 },
      { kind: "seats", total: 2, visible: 1 },
    ]);
    const pit = renderAtlas(
      { ...request, mode: "sites", layer: "pit" },
      source,
    );
    expect(pit.metadata.sites?.counts).toContainEqual({
      kind: "seats",
      total: 1,
      visible: 0,
    });
    expect(pit.metadata.sites?.counts).toContainEqual({
      kind: "descents",
      total: 1,
      visible: 1,
    });
    // Large offscreen segments are clipped before stepping even at tiny pixel scales.
    const tiny = renderAtlas(
      {
        ...request,
        mode: "sites",
        bounds: { minX: -0.004, minZ: -2.004, maxX: 0.004, maxZ: -1.996 },
      },
      source,
    );
    expect([...tiny.rgba.slice(4 * 8 * 4, 4 * 8 * 4 + 3)]).toEqual([
      246, 76, 73,
    ]);
  });
  it("offers all five real plan layers and keeps test output paths and defaults distinct", () => {
    for (const layer of ["surface", "upper_deep", "undercrown", "maw", "pit"])
      expect(
        parseAtlas(["--layer", layer, "--mode", "regions"]).request.layer,
      ).toBe(layer);
    expect(parseAtlas(["--world", "test"])).toMatchObject({
      world: "test",
      output: "out/atlas/test/seed-1/surface-height.png",
      request: {
        heightMin: -8,
        heightMax: 32,
        bounds: { minX: -256, maxX: 256 },
      },
    });
  });
  it("renders supplied production feature masks and reports the requested-domain coverage", () => {
    const source = {
      ...createTestWorldSource(1),
      world: "main",
      plan: geometryPlan(),
      writeFeatureMasks(
        x: number,
        _z: number,
        out: { weight: number; thorn: number },
      ) {
        out.weight = 1;
        out.thorn = x < 0 ? 0 : 1;
      },
    };
    const image = renderAtlas({ ...request, mode: "features" }, source);
    expect(image.metadata.features).toMatchObject({
      region: "hellscape",
      samples: 64,
      weight: 64,
      weighted: { thorn: 0.5, dense: 0.5 },
    });
    expect([...image.rgba.slice(0, 4)]).toEqual([18, 22, 48, 255]);
    expect([...image.rgba.slice(4 * 4, 4 * 5)]).toEqual([238, 142, 48, 255]);
    expect(image.metadata.sampleConvention).toContain(
      "requested raster domain",
    );
    expect(parseAtlas(["--mode", "features"]).request.mode).toBe("features");
    expect(() => parseAtlas(["--mode", "features", "--layer", "pit"])).toThrow(
      /surface-only/,
    );
    expect(() =>
      parseAtlas(["--world", "test", "--mode", "features"]),
    ).toThrow();
    expect(() =>
      renderAtlas({ ...request, mode: "features" }, {
        ...source,
        writeFeatureMasks: undefined,
      } as unknown as typeof source),
    ).toThrow(/production/);
  });
});
