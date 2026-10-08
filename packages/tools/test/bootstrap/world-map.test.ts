import { describe, expect, it } from "vitest";
import {
  type MapSamplingReport,
  mapFrame,
  regionAt,
  topRegions,
} from "../../../client/src/game/world-map.js";
import { SURFACE_REGIONS } from "../../../shared/src/world/regions.js";
import type {
  RegionWeights,
  WorldContext,
} from "../../../shared/src/world/types.js";
import { createWorldContext } from "../../../shared/src/world/world-context.js";
import { TEST_POND } from "../../../shared/src/worldgen/test-world.js";

// A bounded query fixture isolates renderer data/coordinate rules from geography
// acceptance. Actual WorldContext test-world parity is exercised separately.
const context = {
  regions: SURFACE_REGIONS.slice(0, 2),
  columns: { stride: 5, height: 0, gradientX: 1, gradientZ: 2, waterLevel: 3 },
  createColumn: () => new Float64Array(5),
  sampleColumn: (_x: number, _z: number, out: Float64Array) => {
    out.fill(0);
    return out;
  },
  surfaceWeights: (x: number, _z: number, out: RegionWeights) => {
    out.count = 1;
    out.ids[0] = x < 0 ? 0 : 1;
    out.weights[0] = 1;
    return out;
  },
  waterQuery: (_x: number, z: number, out: object) =>
    Object.assign(out, {
      kind: z > 0 ? "water" : "none",
      bodyId: z > 0 ? 1 : 0,
      level: z > 0 ? 1 : -Infinity,
    }),
} as unknown as WorldContext;
describe("map coordinates, water and stale result boundaries", () => {
  it("uses the shared weight order for exact ties in both position lookup and debug rows", () => {
    const tied = {
      ...context,
      surfaceWeights: (_x: number, _z: number, out: RegionWeights) => {
        out.count = 2;
        out.ids[0] = 1;
        out.ids[1] = 0;
        out.weights[0] = out.weights[1] = 0.5;
        return out;
      },
    } as WorldContext;
    expect(regionAt(tied, 0, 0)).toBe("tundra");
    expect(topRegions(tied, 0, 0).map((entry) => entry.regionId)).toEqual([
      "tundra",
      "plains",
    ]);
  });
  it("yields to cancellation and records sampling separately from browser scheduling waits", async () => {
    let current = true,
      result: MapSamplingReport | undefined;
    setTimeout(() => {
      current = false;
    }, 0);
    const frame = await mapFrame(
      context,
      {
        sessionId: 3,
        bounds: { minX: -2, minZ: -2, maxX: 2, maxZ: 2 },
        width: 4,
        height: 32,
      },
      new Map(),
      () => current,
      (report) => {
        result = report;
      },
    );
    expect(frame).toBeNull();
    if (!result) throw new Error("Missing actual sampling report");
    expect(result.cancelled).toBe(true);
    expect(result.yieldCount).toBeGreaterThan(0);
    expect(result.sampledPixels).toBeLessThan(128);
    expect(result.samplingMs).toBeGreaterThanOrEqual(0);
    expect(result.yieldWaitMs).toBeGreaterThanOrEqual(0);
    expect(result.wallMs + 1).toBeGreaterThanOrEqual(
      result.samplingMs + result.yieldWaitMs,
    );
    expect(result.maxSliceMs).toBeLessThanOrEqual(result.samplingMs);
  });
  it("uses the real test pond's owned water and keeps its sandbox region unnamed", async () => {
    const actual = createWorldContext({ kind: "test", seed: 1 });
    const frame = await mapFrame(
      actual,
      {
        sessionId: 1,
        bounds: {
          minX: TEST_POND.x - 1,
          minZ: TEST_POND.z - 1,
          maxX: TEST_POND.x + 1,
          maxZ: TEST_POND.z + 1,
        },
        width: 2,
        height: 2,
      },
      new Map(),
      () => true,
    );
    if (!frame) throw new Error("Missing real pond frame");
    expect(frame.names).toEqual([]);
    expect(regionAt(actual, TEST_POND.x, TEST_POND.z)).toBeNull();
    for (let i = 0; i < 4; i++)
      expect(frame.rgba[i * 4 + 2]).toBeGreaterThan(Number(frame.rgba[i * 4]));
  });
  it("samples north-up across negative coordinates and uses water ownership without guessing regions from colours", async () => {
    const frame = await mapFrame(
      context,
      {
        sessionId: 3,
        bounds: { minX: -2, minZ: -2, maxX: 2, maxZ: 2 },
        width: 2,
        height: 2,
      },
      new Map(),
      () => true,
    );
    if (!frame) throw new Error("Expected current map frame");
    const data = frame.rgba;
    expect([...data.slice(0, 3)]).not.toEqual([...data.slice(4, 7)]);
    expect([...data.slice(8, 11)]).toEqual([...data.slice(12, 15)]);
    expect(data[10]).toBeGreaterThan(Number(data[8])); // owned water reads blue, unlike either land tint
    expect(regionAt(context, -0.00001, 0)).toBe("plains");
    expect(regionAt(context, 0.00001, 0)).toBe("tundra");
  });
  it("clips raster extent and resolution at the world frame and drops a superseded raster", async () => {
    const request = {
      sessionId: 3,
      bounds: { minX: -22529, minZ: -1, maxX: -22527, maxZ: 1 },
      width: 2,
      height: 2,
    };
    const frame = await mapFrame(context, request, new Map(), () => true);
    expect(frame?.bounds.minX).toBe(-22528);
    expect(frame?.width).toBe(1);
    expect(frame?.rgba[3]).toBe(255);
    expect(frame?.rgba[7]).toBe(255);
    let checks = 0;
    expect(
      await mapFrame(
        context,
        { ...request, height: 20 },
        new Map(),
        () => ++checks < 3,
      ),
    ).toBeNull();
    await expect(
      mapFrame(
        context,
        { ...request, width: 4096, height: 4096 },
        new Map(),
        () => true,
      ),
    ).rejects.toThrow("viewport");
  });
});
