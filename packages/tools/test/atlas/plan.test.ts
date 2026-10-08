import { describe, expect, it } from "vitest";
import {
  REGION_IDS,
  SURFACE_REGIONS,
} from "../../../shared/src/world/regions.js";
import { createRegionWeights } from "../../../shared/src/worldplan/geometry.js";
import { parseAtlas } from "../../src/atlas/config.js";
import { type AtlasRequest, renderAtlas } from "../../src/atlas/render.js";
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
});
