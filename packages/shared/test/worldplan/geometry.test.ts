import { describe, expect, it } from "vitest";
import { REGION_IDS, SURFACE_REGIONS } from "../../src/world/regions.js";
import {
  createGeometryWorkspace,
  createRegionWeights,
  createUndergroundCells,
  footprint,
  layerWeights,
  SURFACE_WARP_MAX_DISTANCE,
  surfaceWeights,
  warpedPoint,
} from "../../src/worldplan/geometry.js";

describe("WorldPlan region geometry", () => {
  it("uses the documented bearings, stable IDs and sixteen surface metadata definitions", () => {
    const out = createRegionWeights();
    const workspace = createGeometryWorkspace();
    const expected = [
      "tundra",
      "mountains",
      "desert",
      "boneyard",
      "jungle",
      "swamp",
      "lake",
      "plains",
    ];
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      surfaceWeights(
        1,
        Math.sin(a) * 16700,
        -Math.cos(a) * 16700,
        out,
        workspace,
      );
      expect(REGION_IDS[out.ids[0] as number]).toBe(expected[i]);
    }
    expect(SURFACE_REGIONS.length).toBe(16);
    expect(
      SURFACE_REGIONS.every(
        (r) => r.layer === "surface" && !!r.discoverySentence,
      ),
    ).toBe(true);
    expect(SURFACE_REGIONS[15]?.id).toBe("frost");
  });
  it("keeps a partition and continuous weights through ring/sector ties and signed coordinates", () => {
    const a = createRegionWeights();
    const b = createRegionWeights();
    const ws = createGeometryWorkspace();
    for (const seed of [1, 2, 3])
      for (const radius of [0, 5000, 6200, 12900, 20500, 21500, 22000])
        for (let ray = 0; ray < 32; ray++) {
          const theta = (ray * Math.PI) / 16;
          const x = radius * Math.sin(theta);
          const z = -radius * Math.cos(theta);
          surfaceWeights(seed, x - 1e-4, z + 1e-4, a, ws);
          surfaceWeights(seed, x + 1e-4, z - 1e-4, b, ws);
          expect(a.count).toBeGreaterThanOrEqual(1);
          expect(a.count).toBeLessThanOrEqual(3);
          expect(a.weights.reduce((sum, value) => sum + value, 0)).toBeCloseTo(
            1,
            14,
          );
          for (let id = 0; id < 16; id++) {
            const ai = a.ids.indexOf(id);
            const bi = b.ids.indexOf(id);
            expect(
              Math.abs(
                (ai < 0 ? 0 : (a.weights[ai] as number)) -
                  (bi < 0 ? 0 : (b.weights[bi] as number)),
              ),
            ).toBeLessThan(2e-5);
          }
          warpedPoint(seed ^ 0x2b992ddf, x, z, 350, false, ws);
          expect(
            Math.hypot(
              (ws.vector[0] as number) - x,
              (ws.vector[1] as number) - z,
            ),
          ).toBeLessThanOrEqual(SURFACE_WARP_MAX_DISTANCE + 1e-9);
        }
  });
  it("measures90–110km² per ring region on the full64m atlas grid for seeds1–3", () => {
    const out = createRegionWeights();
    const ws = createGeometryWorkspace();
    for (const seed of [1, 2, 3]) {
      const areas = new Float64Array(16);
      for (let z = -22528 + 32; z < 22528; z += 64)
        for (let x = -22528 + 32; x < 22528; x += 64) {
          surfaceWeights(seed, x, z, out, ws);
          areas[out.ids[0] as number] =
            (areas[out.ids[0] as number] as number) + 4096 / 1e6;
        }
      for (let id = 0; id < 12; id++) {
        expect(areas[id], `${seed}/${REGION_IDS[id]}`).toBeGreaterThanOrEqual(
          90,
        );
        expect(areas[id], `${seed}/${REGION_IDS[id]}`).toBeLessThanOrEqual(110);
      }
      console.info({ seed, ringAreasKm2: Array.from(areas.slice(0, 12)) });
    }
  });
  it("retains seventeen underground cells, bounded frayed footprints and a sealed central Upper Deep", () => {
    const ws = createGeometryWorkspace();
    const out = createRegionWeights();
    for (const seed of [1, 2, 3]) {
      const cells = createUndergroundCells(seed);
      expect(cells.length).toBe(17);
      for (const cell of cells) {
        expect(footprint(seed, cell.layer, cell.x, cell.z, ws)).toBeGreaterThan(
          0,
        );
        layerWeights(seed, cells, cell.layer, cell.x, cell.z, out, ws);
        expect(out.weights.reduce((sum, value) => sum + value, 0)).toBeCloseTo(
          1,
          14,
        );
      }
      expect(footprint(seed, "upper_deep", 0, 0, ws)).toBe(0);
      expect(footprint(seed, "pit", 0, 0, ws)).toBe(1);
      expect(footprint(seed, "maw", 15000, 15000, ws)).toBe(0);
    }
  });
});
