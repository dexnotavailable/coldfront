import { describe, expect, it } from "vitest";
import { Block } from "../../../shared/src/blocks/registry.js";
import type {
  IbaraCellDiagnostics,
  ThornInstance,
  ThornParameters,
} from "../../../shared/src/features/ibara/types.js";
import { HALO_VOLUME } from "../../../shared/src/world/constants.js";
import type {
  IbaraPlanData,
  WorldContext,
  WorldPlanData,
} from "../../../shared/src/world/types.js";
import { createWorldContext } from "../../../shared/src/world/world-context.js";
import { WORLDGEN_VERSION } from "../../../shared/src/worldgen/version.js";
import { createBridges } from "../../../shared/src/worldplan/bridges.js";
import { createUndergroundCells } from "../../../shared/src/worldplan/geometry.js";
import { canonicalPlanGrid } from "../../../shared/src/worldplan/grid.js";
import {
  measureGeneration,
  typedBufferBytes,
} from "../../src/bench/pipeline.js";
import { REPO_ROOT } from "../../src/golden/fixture.js";
import {
  accumulateCoverage,
  accumulatePlacement,
  band,
  censusParameters,
  censusTips,
  coverageSummary,
  createParameterWitness,
  decodeParameterWitness,
  inspectTips,
  nearestNeighbours,
  type ParameterWitness,
  type ParameterWitnessIdentity,
  parameterStatistics,
  placementTotals,
  sampleSpatial,
  topologyStatistics,
  traceComponent,
  validateWitnessPairClosure,
} from "../../src/terrain-report/ibara.js";
import {
  parseTerrainReport,
  persistParameterWitness,
} from "../../src/terrain-report/index.js";
import {
  ibaraReviewFromContext,
  sourceFromContext,
} from "../../src/terrain-review/source.js";

function thorn(
  id: number,
  overrides: Partial<ThornParameters> = {},
): ThornParameters {
  return {
    id,
    cellX: 0,
    cellZ: 0,
    cluster: 0,
    index: id,
    base: [id, 0, 0],
    height: 20,
    baseRadius: 3,
    flowX: 1,
    flowZ: 0,
    leanDegrees: 15,
    bend: 2,
    sCurve: false,
    hooked: false,
    broken: false,
    breakT: 0.6,
    branchCount: 0,
    facets: 4,
    facetiness: 1,
    twist: 0,
    phase: 0,
    exponent: 1,
    core: "basalt",
    crust: "none",
    nearLava: false,
    landmark: false,
    arch: false,
    archSpan: 0,
    ...overrides,
  };
}
function tipInstance(thin: number, capped = false): ThornInstance {
  // Only the diagnostics fields are needed: this is a measured-table fixture,
  // deliberately not represented as generated production geometry.
  return {
    parameters: thorn(1),
    sweeps: [{ spine: { length: 100, capped }, thinTipLength: thin }],
    debris: [],
  } as unknown as ThornInstance;
}
function emptyIbara(): IbaraPlanData {
  return {
    schema: 1,
    seed: 7,
    bounds: { minX: 0, minZ: 0, maxX: 64, maxZ: 64 },
    calderas: [],
    channels: [],
    vents: [],
    routing: {
      grid: { minX: 0, minZ: 0, width: 2, depth: 2, spacing: 64 },
      terrain: new Float64Array(4),
      routingHeight: new Float64Array(4),
      receivers: new Int32Array(4).fill(-1),
      routingOrder: new Uint32Array([0, 1, 2, 3]),
      drainageArea: new Float64Array(4).fill(4096),
      sourceCalderaIds: new Uint32Array(4),
    },
  };
}
/** Constant authored DEM with canonical buffers; no world/volcanic plan build. */
function syntheticMain(): WorldContext {
  const grid = canonicalPlanGrid(),
    n = grid.width * grid.depth;
  const data: WorldPlanData = {
    schema: 2,
    seed: 7,
    worldgenVersion: WORLDGEN_VERSION,
    grid,
    terrainMacro: new Float64Array(n).fill(40),
    routingHeight: new Float64Array(n).fill(40),
    receivers: new Int32Array(n).fill(-1),
    routingOrder: Uint32Array.from({ length: n }, (_, i) => i),
    drainageArea: new Float64Array(n).fill(4096),
    basinIds: new Uint32Array(n),
    waterBodies: [],
    undergroundCells: createUndergroundCells(7),
    ibara: emptyIbara(),
    sites: {
      seats: Array.from({ length: 30 }, (_, i) => ({
        id: `s${i}`,
        region: "plains",
        layer: "surface",
        x: -8000,
        z: -8000,
      })),
      forts: Array.from({ length: 106 }, (_, i) => ({
        id: `f${i}`,
        seatId: "s0",
        region: "plains",
        layer: "surface",
        x: -8000,
        z: -8000,
      })),
      descents: [],
      bridges: createBridges(7),
      spawns: Array.from({ length: 256 }, (_, i) => ({
        id: `p${i}`,
        region: "plains",
        x: -8000,
        z: -8000,
        surfaceY: 40,
        rank: i,
      })),
    },
  };
  return createWorldContext({ kind: "main", seed: 7, plan: data });
}

describe("Ibara diagnostic algorithms (bounded fixtures only)", () => {
  it("round-trips exact witness operands and independently reconstructs global directed comparisons", async () => {
    const parameters = [
      thorn(0x80000002, {
        base: [0, 0, -0],
        height: 40,
        bend: 4,
        leanDegrees: 15,
      }),
      thorn(0x80000001, {
        base: [1, 0, 0],
        height: 48,
        bend: 4,
        leanDegrees: 15,
      }),
      thorn(3, {
        base: [-1, 0, 0],
        height: 12.123456789012344,
        bend: 0.30000000000000004,
        leanDegrees: 23,
      }),
      thorn(4, { base: [0.1, 0, 0], landmark: true, height: 250 }),
    ];
    const identity: ParameterWitnessIdentity = {
      seed: 1,
      world: "main",
      region: "hellscape",
      worldgenVersion: 3,
      sourceHash: "a".repeat(64),
      sourceCommit: "b".repeat(40),
      harnessHash: "c".repeat(64),
      acceptedPopulationHash: createHash("sha256")
        .update(JSON.stringify(parameters))
        .digest("hex"),
      domain: { minX: -10, minZ: -10, maxX: 10, maxZ: 10 },
    };
    const original = createParameterWitness(parameters, identity),
      witness = JSON.parse(JSON.stringify(original)) as ParameterWitness;
    const decoded = decodeParameterWitness(witness),
      ordinary = decoded.filter((r) => !r.landmark);
    for (let i = 0; i < parameters.length; i++) {
      const p = parameters[i] as ThornParameters,
        r = decoded[i] as (typeof decoded)[number];
      expect(Object.is(r.baseXMetres, p.base[0])).toBe(true);
      expect(Object.is(r.baseZMetres, p.base[2])).toBe(true);
      expect(Object.is(r.heightMetres, p.height)).toBe(true);
      expect(Object.is(r.inclinationDegrees, p.leanDegrees)).toBe(true);
      expect(Object.is(r.unsignedBendAmplitudeMetres, p.bend)).toBe(true);
    }
    const pairs = nearestNeighbours(parameters.filter((p) => !p.landmark));
    for (const a of ordinary) {
      let best: (typeof ordinary)[number] | undefined,
        squared = Infinity;
      for (const b of ordinary) {
        if (a.id === b.id) continue;
        const dx = a.baseXMetres - b.baseXMetres,
          dz = a.baseZMetres - b.baseZMetres,
          d = dx * dx + dz * dz;
        if (d < squared || (d === squared && b.id < (best?.id ?? Infinity))) {
          best = b;
          squared = d;
        }
      }
      const b = best as (typeof ordinary)[number],
        row = pairs.find((p) => p.id === a.id);
      expect(row?.neighbourId).toBe(b.id);
      expect(row?.distance).toBe(Math.sqrt(squared));
      const passes = [
        Math.abs(a.heightMetres - b.heightMetres) / a.heightMetres >= 0.2,
        Math.abs(a.inclinationDegrees - b.inclinationDegrees) >= 8,
        Math.abs(
          a.unsignedBendAmplitudeMetres - b.unsignedBendAmplitudeMetres,
        ) /
          a.heightMetres >=
          0.1,
      ];
      expect(row?.different).toBe(passes.some(Boolean));
    }
    expect(pairs[0]?.neighbourId).toBe(3);
    expect(validateWitnessPairClosure(witness, pairs)).toEqual({
      acceptedRows: 4,
      ordinaryRows: 3,
      landmarkRows: 1,
      referencedPairs: 3,
      status: "pass",
    });
    const folder = join(
      REPO_ROOT,
      "out/p7-diagnostics/witness-amendment/test-receipts",
    );
    await mkdir(folder, { recursive: true });
    const path = join(folder, `witness-${randomUUID()}.json`);
    const reference = await persistParameterWitness(path, witness, pairs),
      bytes = await readFile(path);
    expect(reference.sha256).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
    expect(reference.identity).toEqual(identity);
    expect(reference.fields).toContain("inclination_deg");
    await expect(persistParameterWitness(path, witness, pairs)).rejects.toThrow(
      /EEXIST/,
    );
    expect(await readFile(path)).toEqual(bytes);
  });
  it("rejects incomplete or corrupted witness references without changing the metric", () => {
    const parameters = [
      thorn(1, { height: 40 }),
      thorn(2, { height: 48 }),
      thorn(3, { landmark: true }),
    ];
    const identity: ParameterWitnessIdentity = {
      seed: 1,
      world: "main",
      region: "hellscape",
      worldgenVersion: 3,
      sourceHash: "a".repeat(64),
      sourceCommit: "b".repeat(40),
      harnessHash: "c".repeat(64),
      acceptedPopulationHash: "d".repeat(64),
      domain: { minX: 0, minZ: 0, maxX: 10, maxZ: 10 },
    };
    const witness = createParameterWitness(parameters, identity),
      pairs = nearestNeighbours(parameters.filter((p) => !p.landmark));
    const [first, second] = pairs,
      firstRow = witness.rows[0];
    if (!first || !second || !firstRow)
      throw new Error("Missing witness test fixture");
    expect(() => validateWitnessPairClosure(witness, pairs.slice(1))).toThrow(
      /denominator/,
    );
    expect(() => validateWitnessPairClosure(witness, [first, first])).toThrow(
      /duplicate/,
    );
    expect(() =>
      validateWitnessPairClosure(witness, [
        { ...first, neighbourId: 3 },
        second,
      ]),
    ).toThrow(/landmark/);
    expect(() =>
      validateWitnessPairClosure(witness, [
        { ...first, distance: 100 },
        second,
      ]),
    ).toThrow(/disagree/);
    expect(() =>
      validateWitnessPairClosure(witness, [
        { ...first, different: !first.different },
        second,
      ]),
    ).toThrow(/disagree/);
    expect(() =>
      decodeParameterWitness({
        ...witness,
        rows: [...witness.rows, firstRow],
      }),
    ).toThrow(/duplicate/);
    expect(() =>
      decodeParameterWitness({
        ...witness,
        identity: { ...identity, sourceHash: "missing" },
      }),
    ).toThrow(/identity/);
    expect(() =>
      decodeParameterWitness({
        ...witness,
        rows: [[1, Infinity, 0, 40, 15, 2, 0]],
      }),
    ).toThrow(/operand/);
  });
  it("closes production stage counters without conflating landmark/ordinary attempts or geometry", async () => {
    const ordinary: IbaraCellDiagnostics = {
      ...placementTotals(),
      cellX: 0,
      cellZ: 0,
      landmark: false,
      inDomain: true,
      poissonAtCap: true,
      candidateClusters: 3,
      rejectedProximityClusters: 1,
      acceptedClusters: 2,
      candidateInstances: 80,
      candidateAttempts: 82,
      rejectedLocalSpacingAttempts: 2,
      rejectedSpacingInstances: 3,
      acceptedInstances: 77,
    };
    const totals = placementTotals();
    accumulatePlacement(totals, ordinary, 77);
    expect(totals).toMatchObject({
      candidateInstances: 80,
      acceptedInstances: 77,
      poissonAtCapCells: 1,
    });
    expect(() =>
      accumulatePlacement(
        placementTotals(),
        { ...ordinary, acceptedInstances: 78 },
        78,
      ),
    ).toThrow(/closure/);
    const landmark: IbaraCellDiagnostics = {
      ...placementTotals(),
      cellX: 0,
      cellZ: 0,
      landmark: true,
      inDomain: true,
      poissonAtCap: true,
      candidateClusters: 3,
      rejectedWeightClusters: 2,
      acceptedClusters: 1,
      candidateInstances: 1,
      acceptedInstances: 1,
    };
    const l = placementTotals();
    accumulatePlacement(l, landmark, 1);
    expect(l.candidateAttempts).toBe(0);
    const features = {
      parametersForCell(x: number, z: number, landmark = false) {
        return x === 0 && z === 0
          ? [thorn(landmark ? 2 : 1, { landmark })]
          : [];
      },
      diagnosticsForCell(
        x: number,
        z: number,
        landmark = false,
      ): IbaraCellDiagnostics {
        const n = Number(x === 0 && z === 0);
        return {
          ...placementTotals(),
          cellX: x,
          cellZ: z,
          landmark,
          inDomain: true,
          poissonAtCap: false,
          candidateClusters: n,
          acceptedClusters: n,
          candidateInstances: n,
          acceptedInstances: n,
          candidateAttempts: landmark ? 0 : n,
        };
      },
      collect() {
        throw new Error("metadata must not construct curves");
      },
    } as unknown as Parameters<typeof censusParameters>[0]["features"];
    const census = await censusParameters({ features });
    expect(census.placement).toMatchObject({
      candidates: 2,
      accepted: 2,
      skipped: 0,
    });
    expect(census.parameters).toHaveLength(2);
    expect(census.cells.ordinary).toBeGreaterThan(4096);
  });
  it("uses exact global neighbours across cells, deterministic ties, and agrees with brute force", () => {
    const points = Array.from({ length: 41 }, (_, i) =>
      thorn(i + 1, {
        base: [((i * 19) % 47) - 23, 0, ((i * 31) % 43) - 21],
        cellX: i - 20,
      }),
    );
    for (const row of nearestNeighbours(points)) {
      const p = points.find((p) => p.id === row.id) as ThornParameters;
      const best = points
        .filter((q) => q.id !== p.id)
        .sort(
          (a, b) =>
            Math.hypot(a.base[0] - p.base[0], a.base[2] - p.base[2]) -
              Math.hypot(b.base[0] - p.base[0], b.base[2] - p.base[2]) ||
            a.id - b.id,
        )[0] as ThornParameters;
      expect(row.neighbourId).toBe(best.id);
    }
    expect(
      nearestNeighbours([
        thorn(3, { base: [0, 0, 0] }),
        thorn(2, { base: [1, 0, 0] }),
        thorn(1, { base: [-1, 0, 0] }),
      ])[0]?.neighbourId,
    ).toBe(1);
    expect(nearestNeighbours([thorn(1)])[0]?.different).toBeNull();
  });
  it("keeps directed denominators, ordinary/landmark populations and broken eligibility explicit", () => {
    const p = [
      thorn(1, { height: 40, broken: true, branchCount: 1 }),
      thorn(2, { height: 48 }),
      thorn(3, { height: 350, landmark: true, arch: true, branchCount: 3 }),
    ];
    const stats = parameterStatistics(p);
    expect(stats.ordinary).toBe(2);
    expect(stats.landmarks).toMatchObject({ count: 1, arches: 1, colossi: 0 });
    expect(stats.bands.branched).toMatchObject({
      numerator: 1,
      denominator: 2,
      share: 0.5,
      status: "fail",
    });
    // 8/40 is 20%, while 8/48 is less: silently normalizing by min height would pass both.
    expect(stats.nearestNeighbours.map((r) => r.different)).toEqual([
      true,
      false,
    ]);
    expect(band(0, 0, [0.95, 1], "empty").status).toBe("unavailable");
    expect(parameterStatistics([thorn(1)]).bands.nearestNeighbour.status).toBe(
      "fail",
    );
    expect(() => parameterStatistics([thorn(1), thorn(1)])).toThrow(
      /Duplicate/,
    );
  });
  it("measures every sweep tip and retains caps and geometry errors", async () => {
    expect(inspectTips(tipInstance(4))[0]?.pass).toBe(true);
    expect(inspectTips(tipInstance(4.01))[0]?.pass).toBe(false);
    expect(inspectTips(tipInstance(0, true))[0]?.pass).toBe(false);
    const report = await censusTips([thorn(1), thorn(2)], (p) => {
      if (p.id === 2) throw new Error("curve capped fixture");
      return tipInstance(4.1);
    });
    expect(report).toMatchObject({
      expectedInstances: 2,
      checkedInstances: 1,
      checkedSweeps: 1,
      status: "fail",
    });
    expect(report.constructionFailures[0]?.id).toBe(2);
    expect(report.failures).toHaveLength(1);
  });
  it("reports achieved weighted mask areas without quietly changing the denominator", () => {
    const c = {
      samples: 0,
      weight: 0,
      thornWeight: 0,
      denseWeight: 0,
      dominantSamples: 0,
      dominantThorns: 0,
      dominantDense: 0,
    };
    accumulateCoverage(c, 1, 0, true);
    accumulateCoverage(c, 1, 0.2, true);
    accumulateCoverage(c, 0.5, 0.5, false);
    accumulateCoverage(c, 0, 0, false);
    const report = coverageSummary(c);
    expect(report.weighted.thorn).toBe(0.6);
    expect(report.weighted.dense).toBe(0.2);
    expect(report.dominant).toEqual({ thorn: 0.5, dense: 0 });
    expect(() => accumulateCoverage(c, 0.2, 0.4, true)).toThrow(/Invalid/);
  });
  it("traces neighbouring chunks instead of calling boundary-clipped solids floating", () => {
    const connected = {
      solid: (x: number, y: number, z: number) =>
        x >= 31 && x <= 37 && y === 5 && z === 0,
      grounded: (x: number) => x === 37,
    };
    expect(traceComponent([31, 5, 0], connected, 32).status).toBe("grounded");
    const closed = { ...connected, grounded: () => false };
    expect(traceComponent([32, 5, 0], closed, 32)).toMatchObject({
      status: "floating",
      minimum: [31, 5, 0],
    });
    expect(traceComponent([31, 5, 0], closed, 3).status).toBe("capped");
    const diagonal = {
      solid: (x: number, y: number, z: number) =>
        (x === 0 && y === 0 && z === 0) || (x === 1 && y === 1 && z === 0),
      grounded: (x: number) => x === 1,
    };
    expect(traceComponent([0, 0, 0], diagonal, 10).status).toBe("floating");
    const signal = AbortSignal.abort();
    expect(() =>
      traceComponent([31, 5, 0], connected, 32, new Set(), signal),
    ).toThrow();
  });
  it("counts density slopes and one-block rise from the actual surface rather than the supplied macro gradient", async () => {
    const context = {
      kind: "main",
      seed: 1,
      columns: {
        stride: 3,
        height: 0,
        gradientX: 1,
        gradientZ: 2,
        waterLevel: 0,
      },
      prepareArea: () => ({
        createColumn: () => new Float64Array(3),
        sampleColumn: (x: number, _z: number, out: Float64Array) => {
          out[0] = 2 * x;
          out[1] = 0;
          out[2] = 0;
          return out;
        },
        skyInput: (
          x: number,
          _z: number,
          out: { solidBelowY: number; highestFilterY: number },
        ) => {
          out.solidBelowY = 2 * x;
          out.highestFilterY = 2 * x;
          return out;
        },
        sampleVoxel: (
          x: number,
          y: number,
          _z: number,
          out: { density: number; block: number; fluid: number },
        ) => {
          out.density = 2 * x - y;
          out.block = out.density > 0 ? 2 : 0;
          out.fluid = 0;
          return out;
        },
      }),
    } as unknown as WorldContext;
    const report = await sampleSpatial(context, [{ x: 16, z: 16 }], 1, 100);
    expect(report.surfaceCells).toBe(1024);
    expect(report.slopes.greaterThan50).toBe(1024);
    expect(report.walkable.share).toBe(0);
    expect(report.components.floating).toBe(0);
  });
  it("validates channel and routing topology instead of inferring it from counts", () => {
    const plan = emptyIbara();
    expect(topologyStatistics(plan).status).toBe("pass");
    const damaged = {
      ...plan,
      routing: { ...plan.routing, receivers: new Int32Array([1, 0, -1, -1]) },
    };
    expect(topologyStatistics(damaged).status).toBe("fail");
  });
  it("counts actual typed buffers once, including shared views and feature fields", () => {
    const buffer = new ArrayBuffer(64),
      a = new Uint32Array(buffer, 0, 8),
      b = new Uint8Array(buffer, 10, 2),
      features = new Uint16Array(9);
    expect(
      typedBufferBytes({
        a,
        b,
        parts: [{ features }],
        plain: { count: 90000 },
      }),
    ).toBe(82);
  });
  it("benchmarks generated lava as fluid and includes real feature buffers in byte accounting", () => {
    const context = {
      kind: "main",
      seed: 1,
      worldgenVersion: WORLDGEN_VERSION,
      columns: {
        stride: 4,
        height: 0,
        gradientX: 1,
        gradientZ: 2,
        waterLevel: 3,
      },
      prepareArea: () => ({
        createColumn: () => new Float64Array(4),
        sampleColumn: (_x: number, _z: number, out: Float64Array) => {
          out[0] = 8;
          out[3] = -Infinity;
          return out;
        },
        sampleVoxel: (
          x: number,
          y: number,
          _z: number,
          out: {
            density: number;
            block: number;
            fluid: number;
            featureId: number;
            featureT: number;
          },
        ) => {
          out.density = 8 - y;
          out.block = y < 8 ? Block.Basalt : y < 9 ? Block.Lava : Block.Air;
          out.fluid = y >= 8 && y < 9 ? 1 : 0;
          out.featureId = y < 8 ? (x < 16 ? 1 : 2) : 0;
          out.featureT = y < 8 ? 0.5 : 0;
          return out;
        },
      }),
    } as unknown as WorldContext;
    const result = measureGeneration(
      {
        id: "synthetic-lava-feature-plane",
        world: "main",
        region: "hellscape",
        seed: 1,
        cx: 0,
        cy: 0,
        cz: 0,
        lod: 0,
        spacing: 1,
      },
      0,
      context,
    );
    expect(result).toMatchObject({
      solidVoxels: 8192,
      fluidVoxels: 1024,
      airVoxels: 23552,
      featureVoxels: 8192,
      featureCache: null,
    });
    expect(result.outputBytes).toBe(
      32 ** 3 * 2 + HALO_VOLUME * (2 + 8 + 4 + 8) + 34 ** 2 * 4 * 8,
    );
  });
  it("validates commands without building plans or running production censuses", () => {
    expect(
      parseTerrainReport(["--seeds", "1,2,3", "--stage", "parameters"]),
    ).toMatchObject({ seeds: [1, 2, 3], stage: "parameters" });
    for (const args of [
      ["--seed", "1", "--seeds", "2"],
      ["--seeds", "1,1"],
      ["--region", "plains"],
      ["--stage", "fake"],
      ["--component-cap", "0"],
    ])
      expect(() => parseTerrainReport(args)).toThrow();
  });
  it("adapts the production context plan and matches its final volcanic columns without constructing features", () => {
    const context = syntheticMain(),
      review = ibaraReviewFromContext(context),
      source = sourceFromContext(context),
      column = context.createColumn();
    expect(review.plan).toBe(context.plan?.data.ibara);
    for (const [x, z] of [
      [6000, 6100],
      [6400, 6144],
      [8000, 6000],
      [-8000, -8000],
    ] as const) {
      context.sampleColumn(x, z, column);
      expect(review.environment.surfaceAt(x, z)).toBe(
        Number(column[context.columns.height]),
      );
      const mask = { weight: 0, thorn: 0 };
      source.writeFeatureMasks?.(x, z, mask);
      expect(mask).toEqual({
        weight: review.environment.weightAt(x, z),
        thorn: review.mask(x, z),
      });
    }
    expect(review.features.cachedInstanceCount).toBe(0);
    expect(context.featureCacheStats?.().cachedInstances).toBe(0);
  });
});

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
