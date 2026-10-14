import { describe, expect, it } from "vitest";
import type {
  IbaraGroundSample,
  WorldPlanData,
} from "../../src/world/types.js";
import { createIbaraGround } from "../../src/worldgen/main/ibara-ground.js";
import { createIbaraAnalytic } from "../../src/worldgen/main/ibara-volcanic.js";
import {
  createMainField,
  MainColumn,
} from "../../src/worldgen/main/surface.js";
import {
  buildIbaraPlan,
  ibaraRoutingPoint,
} from "../../src/worldplan/ibara.js";
import { createLavaSample } from "../../src/worldplan/lava.js";

/** Deliberately small pre-Ibara DEM; no whole-world plan/census in unit tests. */
function fixture(
  seed: number,
): Omit<WorldPlanData, "schema" | "ibara"> & { readonly schema: 1 } {
  const width = 65;
  const count = width * width;
  const terrainMacro = new Float64Array(count);
  for (let z = 0; z < width; z++)
    for (let x = 0; x < width; x++)
      terrainMacro[x + width * z] = 40 + x * 0.07 + z * 0.02;
  return {
    schema: 1,
    seed,
    worldgenVersion: 2,
    grid: { minX: 4096, minZ: 4096, width, depth: width, spacing: 64 },
    terrainMacro,
    routingHeight: terrainMacro.slice(),
    receivers: new Int32Array(count).fill(-1),
    routingOrder: Uint32Array.from({ length: count }, (_, i) => i),
    drainageArea: new Float64Array(count).fill(4096),
    basinIds: new Uint32Array(count),
    waterBodies: [],
    undergroundCells: [],
    sites: { seats: [], forts: [], descents: [], bridges: [], spawns: [] },
  };
}

describe("Ibara local plan and complete volcanic ground", () => {
  it("blends vent foundations continuously into sloping perimeter ground", () => {
    const base = fixture(7);
    const original = createMainField(base, []);
    const field = {
      ...original,
      height: (x: number, z: number) =>
        40 + (x - 6000) * 0.2 + (z - 6000) * 0.1,
      surfaceBounds(
        bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
        out: {
          minSurfaceY: number;
          maxSurfaceY: number;
          maxSolidY: number;
          maxFluidY: number;
        },
      ) {
        out.minSurfaceY = this.height(bounds.minX, bounds.minZ);
        out.maxSurfaceY = this.height(bounds.maxX, bounds.maxZ);
        out.maxSolidY = out.maxSurfaceY;
        out.maxFluidY = -Infinity;
        return out;
      },
    };
    const plan = {
      ...buildIbaraPlan(base, original),
      calderas: [],
      channels: [],
      vents: [],
    };
    const bare = createIbaraGround(field, plan);
    const baseY = bare.height(6000, 6000);
    const vent = {
      id: 131073,
      x: 6000,
      z: 6000,
      baseY,
      height: 7,
      radius: 10,
      mouthRadius: 2,
      bounds: {
        minX: 5990,
        maxX: 6010,
        minZ: 5990,
        maxZ: 6010,
        minY: 37,
        maxY: baseY + 7,
      },
    };
    const ground = createIbaraGround(field, { ...plan, vents: [vent] });
    for (let angle = 0; angle < 32; angle++) {
      const theta = (angle * Math.PI) / 16;
      const dx = Math.cos(theta),
        dz = Math.sin(theta);
      const inner = ground.height(
        6000 + dx * (10 - 1e-5),
        6000 + dz * (10 - 1e-5),
      );
      const outer = ground.height(
        6000 + dx * (10 + 1e-5),
        6000 + dz * (10 + 1e-5),
      );
      expect(Math.abs(inner - outer)).toBeLessThan(1e-4);
      for (const radius of [0, 1, 2, 5, 9.9, 10, 10.1]) {
        const x = 6000 + dx * radius,
          z = 6000 + dz * radius;
        const h = ground.height(x, z);
        expect(h).toBeGreaterThanOrEqual(bare.height(x, z));
        expect(h).toBeLessThanOrEqual(Math.max(bare.height(x, z), baseY + 7));
        const bounds = ground.conservativeBounds(
          { minX: x, maxX: x, minZ: z, maxZ: z },
          {
            minSurfaceY: 0,
            maxSurfaceY: 0,
            maxSolidY: 0,
            maxFluidY: -Infinity,
          },
        );
        expect(h).toBeGreaterThanOrEqual(bounds.minSurfaceY);
        expect(h).toBeLessThanOrEqual(bounds.maxSurfaceY);
      }
    }
  });

  it("builds cloneable, reproducible local data without touching global water or drainage", () => {
    const base = fixture(7);
    const before = structuredClone(base);
    const field = createMainField(base, []);
    const first = buildIbaraPlan(base, field);
    expect(buildIbaraPlan(base, field)).toEqual(first);
    expect(base).toEqual(before);
    const cloned = structuredClone(first);
    expect(cloned).toEqual(first);
    expect(cloned.routing.terrain.buffer).not.toBe(
      first.routing.terrain.buffer,
    );
    expect(first.routing.terrain.buffer).not.toBe(base.terrainMacro.buffer);
    cloned.routing.terrain[0] = -900;
    expect(first.routing.terrain[0]).not.toBe(-900);
    expect(first.calderas.length).toBeGreaterThanOrEqual(3);
    expect(first.calderas.length).toBeLessThanOrEqual(6);
    expect(first.channels).toHaveLength(first.calderas.length);
    expect(first.vents.length).toBeGreaterThan(0);
    for (const c of first.calderas) {
      expect(c.radius * 2).toBeGreaterThanOrEqual(300);
      expect(c.radius * 2).toBeLessThanOrEqual(900);
      expect(c.rimHeight).toBeGreaterThanOrEqual(40);
      expect(c.rimHeight).toBeLessThanOrEqual(120);
      expect(c.floorY).toBeLessThan(c.lavaLevel);
    }
    for (const v of first.vents) {
      expect(v.height).toBeGreaterThanOrEqual(3);
      expect(v.height).toBeLessThanOrEqual(10);
    }
  });

  it("uses an acyclic local receiver graph and connected monotone source-to-closed-sink routes", () => {
    const base = fixture(7);
    const plan = buildIbaraPlan(base, createMainField(base, []));
    const r = plan.routing;
    const rank = new Int32Array(r.terrain.length);
    r.routingOrder.forEach((cell, i) => {
      rank[cell] = i;
    });
    expect(new Set(r.routingOrder).size).toBe(r.terrain.length);
    for (let cell = 0; cell < r.terrain.length; cell++) {
      const receiver = Number(r.receivers[cell]);
      if (receiver >= 0)
        expect(rank[receiver]).toBeLessThan(Number(rank[cell]));
      expect(r.routingHeight[cell]).toBeGreaterThanOrEqual(
        Number(r.terrain[cell]),
      );
    }
    const point = new Float64Array(2);
    const ground = createIbaraGround(createMainField(base, []), plan);
    for (const channel of plan.channels) {
      const c = plan.calderas.find((item) => item.id === channel.calderaId);
      expect(c).toBeDefined();
      expect(channel.sink).toBe("cooled");
      expect(channel.points[0]).toBe(c?.x);
      expect(channel.points[1]).toBe(c?.z);
      expect(channel.points[3]).toBe(c?.lavaLevel);
      let cell = r.sourceCalderaIds.indexOf(channel.calderaId);
      expect(cell).toBeGreaterThanOrEqual(0);
      for (let i = 5; i < channel.points.length; i += 5) {
        ibaraRoutingPoint(plan.seed, r.grid, cell, point);
        expect(channel.points[i]).toBe(point[0]);
        expect(channel.points[i + 1]).toBe(point[1]);
        expect(channel.points[i + 3]).toBeLessThanOrEqual(
          Number(channel.points[i - 2]),
        );
        expect(channel.points[i + 2]).toBeLessThan(
          Number(channel.points[i + 3]),
        );
        expect(Number(channel.points[i + 4]) * 2).toBeGreaterThanOrEqual(4);
        expect(Number(channel.points[i + 4]) * 2).toBeLessThanOrEqual(20);
        cell = Number(r.receivers[cell]);
      }
      // Vertex monotonicity alone misses mismatched levels where rounded
      // descending reaches overlap at bends. Inspect actual complete ground.
      let previousLevel = Infinity;
      for (let i = 0; i + 5 < channel.points.length; i += 5) {
        for (let step = 0; step <= 24; step++) {
          const t = step / 24;
          const p = channel.points;
          const x = Number(p[i]) + (Number(p[i + 5]) - Number(p[i])) * t;
          const z =
            Number(p[i + 1]) + (Number(p[i + 6]) - Number(p[i + 1])) * t;
          const wet = ground.lavaQuery(x, z, createLavaSample());
          expect(wet.kind).toBe("lava");
          expect(wet.level).toBeLessThanOrEqual(previousLevel + 1e-10);
          previousLevel = wet.level;
        }
      }
    }
  });

  it("preserves all base density/height outside Ibara, including negative coordinates", () => {
    const base = fixture(7);
    const field = createMainField(base, []);
    const ground = createIbaraGround(field, buildIbaraPlan(base, field));
    const column = field.createColumn();
    const sample: IbaraGroundSample = { density: 0, surfaceY: 0, tag: "vent" };
    for (const [x, z] of [
      [-7000, -8000],
      [-0.5, -0.5],
      [15000, 3000],
    ]) {
      field.sampleColumn(x as number, z as number, column);
      for (const y of [-30, 0, 60]) {
        ground.sample(x as number, y, z as number, sample);
        expect(sample.tag).toBe("base");
        expect(sample.surfaceY).toBe(field.height(x as number, z as number));
        expect(sample.density).toBe(
          (Number(column[MainColumn.NaturalHeight]) - y) *
            Number(column[MainColumn.DistanceScale]),
        );
        expect(
          ground.lavaQuery(x as number, z as number, createLavaSample()).kind,
        ).toBe("none");
      }
    }
  });

  it("keeps anchors, density, ownership and conservative bounds consistent after clone/reordered queries", () => {
    const base = fixture(7);
    const field = createMainField(base, []);
    const plan = buildIbaraPlan(base, field);
    const ground = createIbaraGround(field, plan);
    const clone = createIbaraGround(
      createMainField(structuredClone(base), []),
      structuredClone(plan),
    );
    const points: [number, number][] = [];
    for (const c of plan.calderas) {
      for (const radius of [
        0,
        c.lavaRadius * 0.8,
        c.lavaRadius,
        c.radius,
        c.radius + c.rimWidth,
      ]) {
        points.push([c.x + radius, c.z], [c.x, c.z - radius]);
      }
    }
    for (const c of plan.channels)
      for (let i = 0; i < c.points.length; i += 25)
        points.push([Number(c.points[i]), Number(c.points[i + 1])]);
    for (const v of plan.vents) {
      points.push([v.x, v.z]);
      for (let angle = 0; angle < 16; angle++) {
        const theta = (angle * Math.PI) / 8;
        const dx = Math.cos(theta);
        const dz = Math.sin(theta);
        const inner: [number, number] = [
          v.x + dx * (v.radius - 1e-5),
          v.z + dz * (v.radius - 1e-5),
        ];
        const outer: [number, number] = [
          v.x + dx * (v.radius + 1e-5),
          v.z + dz * (v.radius + 1e-5),
        ];
        expect(
          Math.abs(ground.height(...inner) - ground.height(...outer)),
        ).toBeLessThan(1e-4);
        points.push(inner, outer);
      }
    }
    const collect = (g: typeof ground, [x, z]: [number, number]) => {
      const height = g.height(x, z);
      const below = g.sample(x, height - 0.5, z, {
        density: 0,
        surfaceY: 0,
        tag: "base",
      });
      expect(below.density).toBeGreaterThan(0);
      expect(
        g.sample(x, height + 0.5, z, { density: 0, surfaceY: 0, tag: "base" })
          .density,
      ).toBeLessThan(0);
      const wet = g.lavaQuery(x, z, createLavaSample());
      if (wet.kind === "lava") {
        expect(wet.bed).toBe(height);
        expect(wet.bed).toBeLessThan(wet.level);
        expect(
          g.sample(x, wet.bed - 6, z, { density: 0, surfaceY: 0, tag: "base" })
            .density,
        ).toBeGreaterThan(0);
      }
      const bounds = g.conservativeBounds(
        { minX: x - 0.25, minZ: z - 0.25, maxX: x + 0.25, maxZ: z + 0.25 },
        { minSurfaceY: 0, maxSurfaceY: 0, maxSolidY: 0, maxFluidY: 0 },
      );
      expect(bounds.minSurfaceY).toBeLessThanOrEqual(height);
      expect(bounds.maxSurfaceY).toBeGreaterThanOrEqual(height);
      expect(bounds.maxFluidY).toBeGreaterThanOrEqual(wet.level);
      return { height, below, wet };
    };
    const expected = points.map((p) => collect(ground, p));
    points.reverse().forEach((p, i) => {
      expect(collect(clone, p)).toEqual(expected[expected.length - 1 - i]);
    });
  });

  it("keeps Worley cracks within physical dimensions with stable cell-owned identities", () => {
    const analytic = createIbaraAnalytic(7);
    const ids = new Set<number>();
    let count = 0;
    for (let z = 58; z < 66; z++)
      for (let x = 58; x < 66; x++) {
        for (const f of analytic.fissures(x, z)) {
          expect(ids.has(f.id)).toBe(false);
          ids.add(f.id);
          expect(f.halfWidth * 2).toBeGreaterThanOrEqual(1.5);
          expect(f.halfWidth * 2).toBeLessThanOrEqual(3);
          expect(f.depth).toBeGreaterThanOrEqual(2);
          expect(f.depth).toBeLessThanOrEqual(10);
          count++;
        }
      }
    expect(count).toBeGreaterThan(30);
  });

  it("leaves broad plains between bounded dune and fissure provinces", () => {
    const analytic = createIbaraAnalytic(7);
    const plain = { offset: 0, tag: "base" as const, weight: 0 };
    let samples = 0;
    let unmodified = 0;
    let uncracked = 0;
    let dunes = 0;
    let cracked = 0;
    for (let z = 3200; z <= 8800; z += 400)
      for (let x = 3200; x <= 8800; x += 400) {
        if (analytic.weight(x, z) !== 1) continue;
        analytic.plain(x, z, plain);
        expect(plain.offset).toBeGreaterThanOrEqual(0);
        expect(plain.offset).toBeLessThanOrEqual(4);
        samples++;
        if (plain.offset === 0) unmodified++;
        else dunes++;
        if (analytic.fissures(Math.floor(x / 96), Math.floor(z / 96)).length)
          cracked++;
        else uncracked++;
      }
    expect(samples).toBeGreaterThan(80);
    expect(unmodified / samples).toBeGreaterThan(0.5);
    expect(uncracked / samples).toBeGreaterThan(0.5);
    expect(dunes).toBeGreaterThan(10);
    expect(cracked).toBeGreaterThan(10);
  });
});
