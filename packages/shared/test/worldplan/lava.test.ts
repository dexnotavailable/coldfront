import { describe, expect, it } from "vitest";
import type { IbaraPlanData } from "../../src/world/types.js";
import { createIbaraGround } from "../../src/worldgen/main/ibara-ground.js";
import {
  createIbaraAnalytic,
  PLATE_CELL,
  projectSegment,
} from "../../src/worldgen/main/ibara-volcanic.js";
import { createMainField } from "../../src/worldgen/main/surface.js";
import {
  createLavaQueries,
  createLavaSample,
} from "../../src/worldplan/lava.js";

function fixture(): IbaraPlanData {
  return {
    schema: 1,
    seed: 7,
    bounds: { minX: 5800, minZ: 5800, maxX: 6500, maxZ: 6500 },
    calderas: [],
    channels: [],
    vents: [],
    routing: {
      grid: { minX: 5760, minZ: 5760, width: 2, depth: 2, spacing: 64 },
      terrain: new Float64Array(4).fill(40),
      routingHeight: new Float64Array(4).fill(40),
      receivers: new Int32Array(4).fill(-1),
      routingOrder: new Uint32Array([0, 1, 2, 3]),
      drainageArea: new Float64Array(4).fill(1024),
      sourceCalderaIds: new Uint32Array(4),
    },
  };
}
function field() {
  return createMainField(
    {
      seed: 7,
      grid: { minX: 5504, minZ: 5504, width: 33, depth: 33, spacing: 64 },
      terrainMacro: new Float64Array(1089).fill(40),
      basinIds: new Uint32Array(1089),
      waterBodies: [],
    },
    [],
  );
}

describe("explicit local lava ownership", () => {
  it("joins descending bends and a shared junction without level or bank jumps", () => {
    const plan = fixture();
    const channel = (id: number, points: number[]) => ({
      id,
      calderaId: 1,
      points: new Float64Array(points),
      leveeWidth: 8,
      leveeHeight: 3,
      sink: "cooled" as const,
      bounds: {
        minX: 5880,
        minZ: 5880,
        maxX: 6240,
        maxZ: 6240,
        minY: 8,
        maxY: 50,
      },
    });
    const channels = [
      channel(
        65537,
        [5900, 6000, 25, 30, 5, 6100, 6000, 20, 25, 5, 6100, 6200, 10, 15, 5],
      ),
      channel(
        65538,
        [6200, 5900, 30, 35, 5, 6100, 6000, 20, 25, 5, 6100, 6200, 10, 15, 5],
      ),
    ];
    const q = createLavaQueries({ ...plan, channels });
    const ground = createIbaraGround(field(), { ...plan, channels });
    for (const c of channels) {
      let prior = Infinity;
      for (let i = 0; i + 5 < c.points.length; i += 5) {
        for (let step = 0; step <= 100; step++) {
          const t = step / 100;
          const x =
            Number(c.points[i]) +
            (Number(c.points[i + 5]) - Number(c.points[i])) * t;
          const z =
            Number(c.points[i + 1]) +
            (Number(c.points[i + 6]) - Number(c.points[i + 1])) * t;
          const wet = q.query(x, z, 40, createLavaSample());
          expect(wet.kind).toBe("lava");
          expect(wet.level).toBeLessThanOrEqual(prior + 1e-12);
          prior = wet.level;
        }
      }
    }
    // Both sides of the interior bend/junction: tiny changes must remain tiny
    // in the actual wet level and in the complete bank height, not just vertices.
    for (const [x, z] of [
      [6100, 6000],
      [6097, 6003],
      [6103, 5997],
      [6105, 6010],
      [6105, 6190],
    ]) {
      const ax = x as number;
      const az = z as number;
      const a = q.query(ax - 1e-5, az, 40, createLavaSample());
      const b = q.query(ax + 1e-5, az, 40, createLavaSample());
      if (a.kind === "lava" && b.kind === "lava")
        expect(Math.abs(a.level - b.level)).toBeLessThan(1e-4);
      expect(
        Math.abs(ground.height(ax - 1e-5, az) - ground.height(ax + 1e-5, az)),
      ).toBeLessThan(1e-3);
    }
  });
  it("clears all dry lanes and never treats a global level or proximity as fluid ownership", () => {
    const plan = fixture();
    const q = createLavaQueries(plan);
    const out = createLavaSample();
    Object.assign(out, {
      bodyId: 1,
      kind: "lava",
      source: "caldera",
      bed: -400,
      level: 40,
    });
    expect(q.query(-6000, -6000, -100, out)).toEqual(createLavaSample());
    const noHot = createLavaQueries({
      ...plan,
      bounds: { minX: -100, minZ: -100, maxX: 100, maxZ: 100 },
    });
    const vector = new Float64Array([1, 1, 1]);
    expect([...noHot.nearest(-1, -1, vector)]).toEqual([Infinity, 0, 0]);
    expect(() => q.nearest(0, 0, new Float64Array(2))).toThrow();
  });

  it("ties caldera before channel and uses exact rounded closed channel ends", () => {
    const plan = fixture();
    const caldera = {
      id: 1,
      x: 6000,
      z: 6000,
      radius: 200,
      baseY: 40,
      floorY: 15,
      rimHeight: 60,
      rimWidth: 48,
      lavaRadius: 100,
      lavaLevel: 30,
      bounds: {
        minX: 5752,
        minZ: 5752,
        maxX: 6248,
        maxZ: 6248,
        minY: 15,
        maxY: 100,
      },
    };
    const channel = {
      id: 65537,
      calderaId: 1,
      points: new Float64Array([6000, 6000, 25, 30, 5, 6400, 6000, 15, 20, 5]),
      leveeWidth: 8,
      leveeHeight: 3,
      sink: "cooled" as const,
      bounds: {
        minX: 5987,
        minZ: 5987,
        maxX: 6413,
        maxZ: 6013,
        minY: 15,
        maxY: 100,
      },
    };
    const source = { ...plan, calderas: [caldera], channels: [channel] };
    const q = createLavaQueries(source);
    const ground = createIbaraGround(field(), source);
    expect(q.query(6000, 6000, 40, createLavaSample()).source).toBe("caldera");
    expect([...q.nearest(6000, 6000, new Float64Array(3))]).toEqual([0, 0, 0]);
    // A submerged channel bank must not turn the analytic lake disc into dry
    // ground while proximity still calls it hot. Preserve the actual wet lake.
    expect(ground.lavaQuery(6000, 6007, createLavaSample()).source).toBe(
      "caldera",
    );
    expect([...ground.lavaAt(6000, 6007, new Float64Array(3))]).toEqual([
      0, 0, 1,
    ]);
    for (const radius of [7, 50, 99, 99.9999]) {
      const wet = ground.lavaQuery(6000, 6000 + radius, createLavaSample());
      expect(wet.source).toBe("caldera");
      expect(wet.bed).toBeLessThan(wet.level);
      expect(ground.lavaAt(6000, 6000 + radius, new Float64Array(3))[0]).toBe(
        0,
      );
    }
    for (const distance of [0.0001, 0.01, 1, 7]) {
      expect(
        ground.lavaQuery(6000, 6100 + distance, createLavaSample()).kind,
      ).toBe("none");
      const nearest = ground.lavaAt(6000, 6100 + distance, new Float64Array(3));
      expect(nearest[0]).toBeCloseTo(distance, 9);
      expect(nearest[1]).toBe(0);
      expect(nearest[2]).toBe(1);
    }
    for (const [x, z] of [
      [6400, 6000],
      [6403, 6000],
      [6400, 6003],
    ]) {
      const wet = ground.lavaQuery(
        x as number,
        z as number,
        createLavaSample(),
      );
      expect(wet.source).toBe("channel");
      expect(wet.level).toBe(20);
      expect(wet.bed).toBeLessThan(20);
    }
    for (const [x, z] of [
      [6405, 6000],
      [6400, 6005],
      [6408, 6000],
    ]) {
      expect(ground.height(x as number, z as number)).toBeGreaterThanOrEqual(
        20,
      );
      expect(
        ground.lavaQuery(x as number, z as number, createLavaSample()).kind,
      ).toBe("none");
    }
    const dry = q.nearest(6430, 6000, new Float64Array(3));
    // This plan also contains analytic hot cracks: whichever is nearest must
    // still be an actual source, not an invented global plane.
    expect(dry[0]).toBeLessThanOrEqual(25);
    expect(q.query(6430, 6000, 40, createLavaSample()).kind).toBe("none");
  });

  it("closes hot Worley fissures at their sides and endpoints over a solid bed", () => {
    const plan = fixture();
    const q = createLavaQueries(plan);
    const ground = createIbaraGround(field(), plan);
    const analytic = createIbaraAnalytic(plan.seed);
    let checked = 0;
    for (let cz = 61; cz <= 65; cz++)
      for (let cx = 61; cx <= 65; cx++) {
        for (const f of analytic.fissures(cx, cz)) {
          if (!f.hot) continue;
          const x = (f.ax + f.bx) * 0.5;
          const z = (f.az + f.bz) * 0.5;
          if (!q.fissuresAt(x, z).some((candidate) => candidate.id === f.id))
            continue;
          const wet = ground.lavaQuery(x, z, createLavaSample());
          expect(wet.source).toBe("fissure");
          expect(wet.bodyId).toBe(f.id);
          expect(
            ground.sample(x, wet.bed - 0.5, z, {
              density: 0,
              surfaceY: 0,
              tag: "base",
            }).density,
          ).toBeGreaterThan(0);
          expect(
            ground.sample(x, (wet.bed + wet.level) * 0.5, z, {
              density: 0,
              surfaceY: 0,
              tag: "base",
            }).density,
          ).toBeLessThan(0);
          const length = Math.sqrt(
            (f.bx - f.ax) * (f.bx - f.ax) + (f.bz - f.az) * (f.bz - f.az),
          );
          const nx = -(f.bz - f.az) / length;
          const nz = (f.bx - f.ax) / length;
          const ox = x + nx * f.halfWidth * 0.51;
          const oz = z + nz * f.halfWidth * 0.51;
          expect(ground.lavaQuery(ox, oz, createLavaSample()).kind).toBe(
            "none",
          );
          const ex = f.bx + ((f.bx - f.ax) / length) * f.halfWidth * 0.51;
          const ez = f.bz + ((f.bz - f.az) / length) * f.halfWidth * 0.51;
          expect(ground.lavaQuery(ex, ez, createLavaSample()).kind).toBe(
            "none",
          );
          checked++;
          if (checked === 12) break;
        }
        if (checked >= 12) break;
      }
    expect(checked).toBeGreaterThanOrEqual(12);
  });

  it("returns the actual nearest analytic hot capsule, independent of query order and hydration", () => {
    const plan = fixture();
    const q = createLavaQueries(plan);
    const clone = createLavaQueries(structuredClone(plan));
    const analytic = createIbaraAnalytic(plan.seed);
    const all = [];
    for (
      let cz = Math.floor(plan.bounds.minZ / PLATE_CELL) - 2;
      cz <= Math.floor(plan.bounds.maxZ / PLATE_CELL) + 2;
      cz++
    )
      for (
        let cx = Math.floor(plan.bounds.minX / PLATE_CELL) - 2;
        cx <= Math.floor(plan.bounds.maxX / PLATE_CELL) + 2;
        cx++
      )
        for (const f of analytic.fissures(cx, cz))
          if (
            f.hot &&
            q
              .fissuresAt((f.ax + f.bx) * 0.5, (f.az + f.bz) * 0.5)
              .some((s) => s.id === f.id)
          )
            all.push(f);
    const p = new Float64Array(6);
    for (const [x, z] of [
      [6000.5, 6000.5],
      [6100, 6128],
      [5700, 5900],
      [6800, 6600],
    ]) {
      let expected = Infinity;
      for (const f of all) {
        projectSegment(x as number, z as number, f.ax, f.az, f.bx, f.bz, p);
        expected = Math.min(
          expected,
          Math.max(0, Number(p[0]) - f.halfWidth * 0.5),
        );
      }
      const actual = q.nearest(x as number, z as number, new Float64Array(3));
      expect(actual[0]).toBe(expected);
      clone.nearest(6400, 5700, new Float64Array(3));
      expect(
        clone.nearest(x as number, z as number, new Float64Array(3)),
      ).toEqual(actual);
      expect(
        Math.sqrt(
          Number(actual[1]) * Number(actual[1]) +
            Number(actual[2]) * Number(actual[2]),
        ),
      ).toBeCloseTo(1, 14);
    }
  });
});
