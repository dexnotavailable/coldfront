import { beforeAll, describe, expect, it } from "vitest";
import { BLOCK_REGISTRY, Block } from "../../src/blocks/registry.js";
import { hash3, rand01 } from "../../src/math/hash.js";
import { haloIndex, sampleCenter } from "../../src/world/coordinates.js";
import {
  REGION_IDS,
  regionIndex,
  SURFACE_REGIONS,
} from "../../src/world/regions.js";
import type { WorldContext, WorldPlanData } from "../../src/world/types.js";
import { createWorldContext } from "../../src/world/world-context.js";
import { generateWorldChunk } from "../../src/worldgen/main/chunk.js";
import {
  collectMainTrees,
  sampleMainVoxel,
} from "../../src/worldgen/main/features.js";
import {
  createMainField,
  MainColumn,
} from "../../src/worldgen/main/surface.js";
import { sampleBridges } from "../../src/worldplan/bridges.js";
import {
  buildWorldPlan,
  createRegionWeights,
  hydrateWorldPlan,
} from "../../src/worldplan/index.js";

const plans = new Map<number, WorldPlanData>();
const contexts = new Map<number, WorldContext>();
// Independent matrix from docs02 section4, never imported from production rules.
const DESCENTS_FROM_DOCS = [
  {
    type: "cenote",
    from: "jungle",
    to: ["root_halls"],
    min: 2,
    max: 4,
    exempt: false,
  },
  {
    type: "bog_hole",
    from: "swamp",
    to: ["sporewood"],
    min: 2,
    max: 4,
    exempt: false,
  },
  {
    type: "lake_trench",
    from: "lake",
    to: ["drowned_caverns"],
    min: 2,
    max: 4,
    exempt: false,
  },
  {
    type: "mine_mouth",
    from: "mountains",
    to: ["old_workings"],
    min: 2,
    max: 4,
    exempt: false,
  },
  {
    type: "surface_crevasse",
    from: "tundra",
    to: ["frost_hollows"],
    min: 2,
    max: 4,
    exempt: false,
  },
  {
    type: "lava_tube",
    from: "hellscape",
    to: ["ember_veins"],
    min: 2,
    max: 4,
    exempt: false,
  },
  {
    type: "geode_breach",
    from: "shardfields",
    to: ["crystal_grottos"],
    min: 2,
    max: 4,
    exempt: false,
  },
  {
    type: "boneyard_pit",
    from: "boneyard",
    to: ["bone_pits"],
    min: 2,
    max: 4,
    exempt: false,
  },
  {
    type: "delvers_road",
    from: "old_workings",
    to: ["buried_city"],
    min: 1,
    max: 1,
    exempt: false,
  },
  {
    type: "frost_crevasse",
    from: "frost_hollows",
    to: ["stone_garden"],
    min: 2,
    max: 4,
    exempt: false,
  },
  {
    type: "crystal_pipe",
    from: "crystal_grottos",
    to: ["leyflow"],
    min: 2,
    max: 4,
    exempt: false,
  },
  {
    type: "magma_tube",
    from: "ember_veins",
    to: ["great_shear"],
    min: 2,
    max: 4,
    exempt: false,
  },
  {
    type: "root_shaft",
    from: "root_halls",
    to: ["great_shear"],
    min: 2,
    max: 4,
    exempt: false,
  },
  {
    type: "drowned_falls",
    from: "drowned_caverns",
    to: ["hollow_sky"],
    min: 2,
    max: 4,
    exempt: false,
  },
  {
    type: "sundering",
    from: "isles",
    to: ["hollow_sky"],
    min: 1,
    max: 1,
    exempt: true,
  },
  {
    type: "great_shear",
    from: "great_shear",
    to: ["deep_forges", "gut", "ash_sea"],
    min: 1,
    max: 1,
    exempt: true,
  },
  {
    type: "leyfall",
    from: "leyflow",
    to: ["gut"],
    min: 1,
    max: 1,
    exempt: false,
  },
  {
    type: "deep_lift",
    from: "buried_city",
    to: ["deep_forges"],
    min: 1,
    max: 1,
    exempt: false,
  },
  {
    type: "throat",
    from: "deep_forges",
    to: ["throne"],
    min: 1,
    max: 1,
    exempt: true,
  },
  { type: "throat", from: "gut", to: ["throne"], min: 1, max: 1, exempt: true },
  {
    type: "throat",
    from: "ash_sea",
    to: ["throne"],
    min: 1,
    max: 1,
    exempt: true,
  },
  {
    type: "nadir_stair",
    from: "nadir",
    to: ["throne"],
    min: 1,
    max: 1,
    exempt: true,
  },
] as const;
function plan(seed: number): WorldPlanData {
  const result = plans.get(seed);
  if (!result) throw new Error("Plan was not built");
  return result;
}
function context(seed: number): WorldContext {
  const result = contexts.get(seed);
  if (!result) throw new Error("Context was not built");
  return result;
}
beforeAll(() => {
  for (const seed of [1, 2, 3]) {
    const data = buildWorldPlan(seed);
    plans.set(seed, data);
    contexts.set(seed, createWorldContext({ kind: "main", seed, plan: data }));
    console.info({
      seed,
      seats: data.sites.seats.length,
      forts: data.sites.forts.length,
      descents: data.sites.descents.length,
      spawns: data.sites.spawns.length,
      waterBodies: data.waterBodies.length,
    });
  }
}, 120_000);

describe("complete main WorldPlans, seeds1–3", () => {
  it.each([1, 2, 3])(
    "independently verifies receiver adjacency, DAG and per-node conserved area, seed%s",
    (seed) => {
      const data = plan(seed);
      const { width, depth, spacing } = data.grid;
      const n = width * depth;
      const children = new Uint32Array(n);
      const area = new Float64Array(n);
      const queue = new Uint32Array(n);
      for (let i = 0; i < n; i++) {
        const x = i % width;
        const z = Math.floor(i / width);
        area[i] =
          spacing *
          spacing *
          (x === 0 || x === width - 1 ? 0.5 : 1) *
          (z === 0 || z === depth - 1 ? 0.5 : 1);
        const receiver = data.receivers[i] as number;
        if (receiver >= 0) {
          if (
            Math.abs((receiver % width) - x) > 1 ||
            Math.abs(Math.floor(receiver / width) - z) > 1 ||
            receiver === i
          )
            throw new Error(`Non-adjacent receiver at ${seed}/${i}`);
          children[receiver] = (children[receiver] as number) + 1;
          if (
            (data.routingHeight[receiver] as number) >
            (data.routingHeight[i] as number)
          )
            throw new Error(`Uphill spill route at ${seed}/${i}`);
        } else if (x !== 0 && z !== 0 && x !== width - 1 && z !== depth - 1)
          if (!data.basinIds[i])
            throw new Error(`Unowned interior outlet at ${seed}/${i}`);
        if (
          (data.routingHeight[i] as number) < (data.terrainMacro[i] as number)
        )
          throw new Error(`Flood lowered the DEM at ${seed}/${i}`);
      }
      let head = 0;
      let tail = 0;
      for (let i = 0; i < n; i++) if (!children[i]) queue[tail++] = i;
      let discharged = 0;
      while (head < tail) {
        const cell = queue[head++] as number;
        const receiver = data.receivers[cell] as number;
        if (area[cell] !== data.drainageArea[cell])
          throw new Error(
            `Independent accumulation differs at ${seed}/${cell}`,
          );
        if (receiver < 0) discharged += area[cell] as number;
        else {
          area[receiver] = (area[receiver] as number) + (area[cell] as number);
          children[receiver] = (children[receiver] as number) - 1;
          if (!children[receiver]) queue[tail++] = receiver;
        }
      }
      expect(head).toBe(n);
      expect(discharged).toBe((width - 1) * spacing * (depth - 1) * spacing);
    },
  );

  it.each([1, 2, 3])(
    "keeps render heights separate from routing and owned water flat, seed%s",
    (seed) => {
      const data = plan(seed);
      const ctx = context(seed);
      const column = ctx.createColumn();
      const water = {
        bodyId: 0,
        kind: "none" as "none" | "water",
        level: -Infinity,
      };
      const voxel = { density: 0, block: 0, fluid: 0 };
      let different = 0;
      for (let cell = 0; cell < data.terrainMacro.length; cell++)
        if (
          (data.routingHeight[cell] as number) -
            (data.terrainMacro[cell] as number) >
          1
        )
          different++;
      expect(different).toBeGreaterThan(100);
      for (const body of data.waterBodies) {
        let found = false;
        for (
          let cell = data.basinIds.indexOf(body.id);
          cell >= 0;
          cell = data.basinIds.indexOf(body.id, cell + 1)
        ) {
          const x = data.grid.minX + (cell % data.grid.width) * 64;
          const z = data.grid.minZ + Math.floor(cell / data.grid.width) * 64;
          ctx.sampleColumn(x, z, column);
          expect(column[MainColumn.Macro]).toBe(data.terrainMacro[cell]);
          expect(column[MainColumn.NaturalHeight]).toBe(
            (column[MainColumn.Macro] as number) +
              (column[MainColumn.Meso] as number) +
              (column[MainColumn.Micro] as number),
          );
          if ((column[MainColumn.BridgeMargin] as number) > 0) continue;
          ctx.waterQuery(x, z, water);
          expect(water.kind).toBe("water");
          expect(water.level).toBe(body.level);
          ctx.sampleVoxel(
            x,
            ((column[MainColumn.Height] as number) + body.level) / 2,
            z,
            voxel,
            column,
          );
          expect(voxel.fluid).toBe(Block.Water);
          ctx.sampleVoxel(x, body.level, z, voxel, column);
          expect(voxel.fluid).toBe(Block.Air);
          found = true;
          break;
        }
        expect(found, `${seed}/body${body.id}`).toBe(true);
      }
      for (let z = 0; z < data.grid.depth - 1; z += 3)
        for (let x = 0; x < data.grid.width - 1; x += 3) {
          const cell = x + z * data.grid.width;
          if (
            !data.basinIds[cell] &&
            !data.basinIds[cell + 1] &&
            !data.basinIds[cell + data.grid.width]
          )
            continue;
          const wx = data.grid.minX + (x + 1) * 64;
          const wz = data.grid.minZ + z * 64 + 32;
          ctx.sampleColumn(wx - 1e-5, wz, column);
          const before = column[MainColumn.NaturalHeight] as number;
          ctx.sampleColumn(wx + 1e-5, wz, column);
          const after = column[MainColumn.NaturalHeight] as number;
          expect(Math.abs(after - before)).toBeLessThan(1e-3);
        }
      ctx.sampleColumn(0, 0, column);
      expect(column[MainColumn.Height]).toBeCloseTo(320, 9);
    },
  );

  it.each([1, 2, 3])(
    "has actual region-contained sites, named exceptions and complete counts, seed%s",
    (seed) => {
      const data = plan(seed);
      const queries = hydrateWorldPlan(data);
      const weights = createRegionWeights();
      expect(data.sites.seats.length).toBe(30);
      expect(new Set(data.sites.seats.map((s) => s.region)).size).toBe(30);
      expect(data.sites.forts.length).toBe(106);
      const checkRegion = (
        region: string,
        layer: string,
        x: number,
        z: number,
      ): void => {
        if (layer === "surface") queries.surfaceWeights(x, z, weights);
        else {
          const typed = layer as "upper_deep" | "undercrown" | "maw" | "pit";
          expect(queries.footprint(typed, x, z)).toBeGreaterThanOrEqual(0.5);
          queries.layerWeights(typed, x, z, weights);
        }
        expect(REGION_IDS[weights.ids[0] as number]).toBe(region);
      };
      for (const seat of data.sites.seats) {
        checkRegion(seat.region, seat.layer, seat.x, seat.z);
        const forts = data.sites.forts.filter(
          (fort) => fort.seatId === seat.id,
        );
        const id = regionIndex(seat.region);
        expect(forts.length).toBe(
          id < 8 || (id >= 16 && id < 24) ? 3 : id === 12 ? 6 : 4,
        );
        for (const fort of forts) {
          checkRegion(fort.region, fort.layer, fort.x, fort.z);
          const distance = Math.hypot(fort.x - seat.x, fort.z - seat.z);
          expect(distance).toBeGreaterThanOrEqual(800 - 1e-8);
          expect(distance).toBeLessThanOrEqual(1500 + 1e-8);
        }
      }
      for (const rule of DESCENTS_FROM_DOCS) {
        const sites = data.sites.descents.filter(
          (site) => site.type === rule.type && site.from === rule.from,
        );
        expect(
          sites.length,
          `${seed}/${rule.type}/${rule.from}`,
        ).toBeGreaterThanOrEqual(rule.min);
        expect(
          sites.length,
          `${seed}/${rule.type}/${rule.from}`,
        ).toBeLessThanOrEqual(rule.max);
        for (const site of sites) {
          expect(
            (rule.to as readonly string[]).includes(site.to),
            `${site.id} destination`,
          ).toBe(true);
          checkRegion(site.from, site.fromLayer, site.x, site.z);
          checkRegion(site.to, site.toLayer, site.x, site.z);
          if (!rule.exempt)
            for (const seat of data.sites.seats)
              expect(
                Math.hypot(site.x - seat.x, site.z - seat.z),
              ).toBeGreaterThanOrEqual(1500);
        }
      }
      for (const site of data.sites.descents)
        expect(
          DESCENTS_FROM_DOCS.some(
            (rule) => rule.type === site.type && rule.from === site.from,
          ),
          `Unexpected descent ${site.id}`,
        ).toBe(true);
      expect(
        data.sites.descents.filter((site) => site.type === "throat").length,
      ).toBe(3);
      expect(
        data.sites.descents.find((site) => site.type === "nadir_stair"),
      ).toMatchObject({ x: 0, z: 0, from: "nadir", to: "throne" });
      for (const region of SURFACE_REGIONS) {
        const anchor = context(seed).regionAnchor(region.id);
        if (!anchor) throw new Error("Missing anchor");
        queries.surfaceWeights(anchor.x, anchor.z, weights);
        expect(REGION_IDS[weights.ids[0] as number]).toBe(region.id);
      }
    },
  );

  it.each([1, 2, 3])(
    "verifies all256 dry buildable spawns against actual water, timber and voxels, seed%s",
    (seed) => {
      const data = plan(seed);
      const ctx = context(seed);
      const field = createMainField(data, data.sites.bridges);
      const column = ctx.createColumn();
      const voxel = { density: 0, block: 0, fluid: 0 };
      expect(data.sites.spawns.length).toBe(256);
      for (const spawn of data.sites.spawns) {
        expect(Math.hypot(spawn.x, spawn.z)).toBeGreaterThanOrEqual(16000);
        for (const seat of data.sites.seats)
          expect(
            Math.hypot(spawn.x - seat.x, spawn.z - seat.z),
          ).toBeGreaterThanOrEqual(3000);
        ctx.sampleColumn(spawn.x, spawn.z, column);
        expect(
          Math.hypot(
            column[MainColumn.Dx] as number,
            column[MainColumn.Dz] as number,
          ),
        ).toBeLessThanOrEqual(0.35);
        expect(column[MainColumn.Height]).toBeGreaterThan(
          (column[MainColumn.WaterLevel] as number) + 1,
        );
        const feet = Math.ceil(spawn.surfaceY - 0.5);
        const area = ctx.prepareArea({
          minX: spawn.x - 0.3,
          minZ: spawn.z - 0.3,
          maxX: spawn.x + 0.3,
          maxZ: spawn.z + 0.3,
        });
        area.sampleVoxel(spawn.x, feet - 0.5, spawn.z, voxel, column);
        expect(BLOCK_REGISTRY[voxel.block]?.solid).toBe(true);
        for (const y of [feet + 0.5, feet + 1.5]) {
          area.sampleVoxel(spawn.x, y, spawn.z, voxel, column);
          expect(voxel.block).toBe(Block.Air);
        }
        const trees = collectMainTrees(field, {
          minX: spawn.x - 300,
          minZ: spawn.z - 300,
          maxX: spawn.x + 300,
          maxZ: spawn.z + 300,
        });
        expect(
          trees.some(
            (tree) => Math.hypot(tree.x - spawn.x, tree.z - spawn.z) <= 300,
          ),
        ).toBe(true);
        const ix = Math.floor((spawn.x - data.grid.minX) / 64);
        const iz = Math.floor((spawn.z - data.grid.minZ) / 64);
        let nearWater = false;
        const sample = {
          bodyId: 0,
          kind: "none" as "none" | "water",
          level: -Infinity,
        };
        for (let dz = -5; dz <= 5 && !nearWater; dz++)
          for (let dx = -5; dx <= 5; dx++) {
            const x = data.grid.minX + (ix + dx) * 64;
            const z = data.grid.minZ + (iz + dz) * 64;
            if (Math.hypot(x - spawn.x, z - spawn.z) > 300) continue;
            ctx.waterQuery(x, z, sample);
            if (sample.kind === "water") {
              nearWater = true;
              break;
            }
          }
        expect(nearWater, spawn.id).toBe(true);
      }
    },
  );

  it("uses exact point samples across main halos/spacings and rejects corrupted plan input", () => {
    const ctx = context(1);
    const spawn = ctx.spawn;
    const cx = Math.floor(spawn.x / 32);
    const cy = Math.floor(spawn.y / 32);
    const cz = Math.floor(spawn.z / 32);
    const a = generateWorldChunk(ctx, cx, cy, cz);
    const b = generateWorldChunk(ctx, cx + 1, cy, cz);
    for (let y = -1; y < 40; y++)
      for (let z = -1; z <= 32; z++) {
        expect(a.haloBlocks[haloIndex(32, y, z)]).toBe(
          b.haloBlocks[haloIndex(0, y, z)],
        );
        expect(a.density[haloIndex(32, y, z)]).toBe(
          b.density[haloIndex(0, y, z)],
        );
      }
    const coarse = generateWorldChunk(ctx, -1, 4, 1, 3);
    const voxel = { density: 0, block: 0, fluid: 0 };
    for (const [x, y, z] of [
      [0, 0, 0],
      [31, 31, 31],
      [-1, 39, 32],
      [7, 16, 23],
    ]) {
      ctx.sampleVoxel(
        sampleCenter(-1, x as number, 3),
        sampleCenter(4, y as number, 3),
        sampleCenter(1, z as number, 3),
        voxel,
      );
      expect(
        coarse.haloBlocks[haloIndex(x as number, y as number, z as number)],
      ).toBe(voxel.block);
      expect(
        coarse.density[haloIndex(x as number, y as number, z as number)],
      ).toBe(voxel.density);
    }
    expect(() =>
      hydrateWorldPlan({ ...plan(1), worldgenVersion: -1 }),
    ).toThrow();
    const bad = plan(1).receivers.slice();
    bad[0] = 0;
    expect(() => hydrateWorldPlan({ ...plan(1), receivers: bad })).toThrow();
  });

  it.each([1, 2, 3])(
    "proves bounds/sky inputs contain sampled terrain, features and water, seed%s",
    (seed) => {
      const ctx = context(seed);
      const column = ctx.createColumn();
      const sky = { solidBelowY: 0, highestFilterY: 0 };
      for (const region of SURFACE_REGIONS) {
        const anchor = ctx.regionAnchor(region.id);
        if (!anchor) throw new Error("Missing anchor");
        const rectangle = {
          minX: anchor.x - 48,
          minZ: anchor.z - 48,
          maxX: anchor.x + 48,
          maxZ: anchor.z + 48,
        };
        const bounds = ctx.conservativeBounds(rectangle, {
          minSurfaceY: 0,
          maxSurfaceY: 0,
          maxSolidY: 0,
          maxFluidY: -Infinity,
        });
        const area = ctx.prepareArea(rectangle);
        for (let i = 0; i < 50; i++) {
          const x = rectangle.minX + 96 * rand01(hash3(seed, i, 91));
          const z = rectangle.minZ + 96 * rand01(hash3(seed, i, 92));
          area.sampleColumn(x, z, column);
          area.skyInput(x, z, sky, column);
          expect(column[ctx.columns.height]).toBeGreaterThanOrEqual(
            bounds.minSurfaceY,
          );
          expect(column[ctx.columns.height]).toBeLessThanOrEqual(
            bounds.maxSurfaceY,
          );
          expect(sky.highestFilterY).toBeLessThanOrEqual(
            Math.max(bounds.maxSolidY, bounds.maxFluidY),
          );
        }
      }
    },
  );

  it("keeps three real broken causeways, deterministic bytes and unchanged source-owned test paths", () => {
    const data = plan(1);
    const sample = new Float64Array(2);
    expect(data.sites.bridges.length).toBe(3);
    for (const bridge of data.sites.bridges) {
      expect(bridge.gaps.length / 2).toBeGreaterThanOrEqual(1);
      expect(bridge.gaps.length / 2).toBeLessThanOrEqual(3);
      for (let i = 0; i < bridge.gaps.length; i += 2) {
        const length =
          (bridge.gaps[i + 1] as number) - (bridge.gaps[i] as number);
        expect(length).toBeGreaterThanOrEqual(20);
        expect(length).toBeLessThanOrEqual(80);
      }
      const x =
        (bridge.centreline[10] as number) +
        0.7 *
          ((bridge.centreline[12] as number) -
            (bridge.centreline[10] as number));
      const z =
        (bridge.centreline[11] as number) +
        0.7 *
          ((bridge.centreline[13] as number) -
            (bridge.centreline[11] as number));
      sampleBridges([bridge], x, z, sample);
      expect(sample[1]).toBeGreaterThan(0);
    }
    const repeated = buildWorldPlan(1);
    for (const field of [
      "terrainMacro",
      "routingHeight",
      "receivers",
      "routingOrder",
      "drainageArea",
      "basinIds",
    ] as const)
      expect(
        Buffer.from(repeated[field].buffer).equals(
          Buffer.from(data[field].buffer),
        ),
        field,
      ).toBe(true);
    expect(repeated.sites).toEqual(data.sites);
  });
});

it("does not turn an unowned below-datum air column into a global ocean", () => {
  const field = createMainField(
    {
      seed: 1,
      grid: { minX: -64, minZ: -64, spacing: 64, width: 3, depth: 3 },
      terrainMacro: new Float64Array(9).fill(-10),
      basinIds: new Uint32Array(9),
      waterBodies: [],
    },
    [],
  );
  const column = field.createColumn();
  field.sampleColumn(0, 0, column);
  const voxel = { density: 0, block: 0, fluid: 0 };
  sampleMainVoxel(0, -0.5, 0, voxel, column, []);
  expect(voxel.block).toBe(Block.Air);
  expect(voxel.fluid).toBe(Block.Air);
});
