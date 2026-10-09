import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  cappedPoisson,
  createIbaraPlacement,
  ibaraNormalInclinationFloor,
  instantiateIbaraCell,
  instantiateIbaraLandmarks,
  parametersIbaraCell,
  parametersIbaraLandmarks,
  thornFeatureId,
} from "../src/features/ibara/cells.js";
import {
  compareThorns,
  createIbaraBatch,
  createIbaraField,
} from "../src/features/ibara/field.js";
import {
  createIbaraWorkspace,
  sampleThorn,
  sampleThornRubble,
  thornGroundFillet,
  thornVisibleAtSpacing,
} from "../src/features/ibara/sample.js";
import { instantiateThorn } from "../src/features/ibara/shape.js";
import {
  createIbaraSample,
  type IbaraCellDiagnostics,
  type IbaraEnvironment,
  type ThornInstance,
} from "../src/features/ibara/types.js";
import * as spineModule from "../src/sdf/spine.js";
import { createSpineSample, sampleSpine } from "../src/sdf/spine.js";
import { pointInBounds } from "../src/sdf/types.js";
import type { IbaraMaterialSample } from "../src/world/types.js";

const environment: IbaraEnvironment = {
  seed: 1,
  surfaceAt: () => 0,
  weightAt: () => 1,
};
const clusters = instantiateIbaraCell(environment, 0, 0);
const thorns = clusters.flatMap((cluster) => cluster.thorns);
const landmarks = instantiateIbaraLandmarks(environment, 0, 0);
describe("Ibara deterministic feature cells", () => {
  it("preserves small-blade category floors through production parameter and diagnostic paths without geometry", () => {
    const spy = vi.spyOn(spineModule, "flattenBeziers");
    try {
      let blades = 0,
        othersBelow18 = 0;
      for (const seed of [1, 2, 3]) {
        const field = createIbaraField({ ...environment, seed }, 1);
        for (const [x, z] of [
          [-1, 0],
          [0, 0],
          [1, 0],
        ] as const) {
          const parameters = field.parametersForCell(x, z);
          field.diagnosticsForCell(x, z);
          field.contrastForCell(x, z);
          for (const p of parameters) {
            const blade = !p.broken && p.height < 30 && p.facetiness === 1;
            expect(ibaraNormalInclinationFloor(seed, p)).toBe(blade ? 18 : 5);
            if (blade) {
              blades++;
              expect(p.leanDegrees).toBeGreaterThanOrEqual(18);
            } else othersBelow18 += Number(p.leanDegrees < 18);
          }
        }
        expect(field.cachedInstanceCount).toBe(0);
      }
      expect(blades).toBeGreaterThan(0);
      expect(othersBelow18).toBeGreaterThan(0);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("caps an actual Poisson distribution and packs signed identities without hash collisions", () => {
    expect(cappedPoisson(0, 0.99)).toBe(0);
    expect(cappedPoisson(1.2, 0.999)).toBe(3);
    const ids = new Set<number>();
    for (const landmark of [false, true])
      for (const x of [-118, -1, 0, 117])
        for (const z of [-118, -1, 0, 117])
          for (let cluster = 0; cluster < 3; cluster++)
            for (let i = 0; i < 40; i++)
              ids.add(thornFeatureId(x, z, cluster, i, landmark));
    expect(ids.size).toBe(2 * 4 * 4 * 3 * 40);
    expect(() => thornFeatureId(-129, 0, 0, 0)).toThrow();
  });
  it("creates a useful single cluster with varied forms and grounded origins", () => {
    expect(thorns.length).toBeGreaterThan(12);
    expect(thorns.some((thorn) => thorn.parameters.hooked)).toBe(true);
    expect(thorns.some((thorn) => thorn.parameters.broken)).toBe(true);
    expect(new Set(thorns.map((thorn) => thorn.parameters.height)).size).toBe(
      thorns.length,
    );
    for (const thorn of thorns) {
      expect(Number(thorn.sweeps[0]?.spine.points[1])).toBeLessThan(0);
      expect(thorn.fillet).toBeGreaterThanOrEqual(2);
      expect(thorn.parameters.facets).toBeGreaterThanOrEqual(3);
      expect(thorn.parameters.facetiness).toBeGreaterThanOrEqual(0.6);
      expect(thorn.thinTipLength).toBeLessThanOrEqual(
        Math.max(1.5, 0.04 * (thorn.sweeps[0]?.spine.length ?? 0)) + 1e-5,
      );
      for (const sweep of [...thorn.sweeps, ...thorn.debris]) {
        expect(sweep.spine.capped).toBe(false);
        const point = createSpineSample();
        for (let i = 0; i <= 12; i++) {
          sampleSpine(sweep.spine, i / 12, point);
          expect(pointInBounds(thorn.bounds, point.x, point.y, point.z)).toBe(
            true,
          );
        }
      }
    }
  });
  it("packs bases with size-aware spacing", () => {
    for (let i = 0; i < thorns.length; i++)
      for (let j = i + 1; j < thorns.length; j++) {
        const a = thorns[i],
          b = thorns[j];
        if (!a || !b) throw new Error("Fixture missing");
        const dx = a.parameters.base[0] - b.parameters.base[0],
          dz = a.parameters.base[2] - b.parameters.base[2];
        expect(Math.sqrt(dx * dx + dz * dz)).toBeGreaterThanOrEqual(
          0.8 * (a.parameters.baseRadius + b.parameters.baseRadius),
        );
      }
  });
  it("cache eviction and reversed requests do not alter cell geometry or canonical order", () => {
    const field = createIbaraField(environment, 1);
    const first = field.cell(0, 0).map((thorn) => thorn.parameters);
    field.cell(2, 2);
    expect(field.cachedCellCount).toBe(1);
    expect(field.cell(0, 0).map((thorn) => thorn.parameters)).toEqual(first);
    const forward = createIbaraBatch(thorns, false),
      backward = createIbaraBatch(thorns.slice().reverse(), false);
    expect(backward.instances.map((thorn) => thorn.parameters.id)).toEqual(
      forward.instances.map((thorn) => thorn.parameters.id),
    );
    expect(
      [...thorns, ...landmarks].sort(compareThorns)[0]?.parameters.landmark,
    ).toBe(true);
  });
  it("arches re-enter the actual terrain and remain landmarks at every supported LOD", () => {
    expect(landmarks.length).toBeGreaterThan(0);
    const arches = landmarks.filter((thorn) => thorn.parameters.arch);
    expect(arches.length).toBeGreaterThan(0);
    for (const thorn of arches) {
      const spine = thorn.sweeps[0]?.spine;
      if (!spine) throw new Error("Missing arch spine");
      expect(Number(spine.points[spine.points.length - 2])).toBeLessThanOrEqual(
        0,
      );
      expect(thornVisibleAtSpacing(thorn, 64)).toBe(true);
      expect(thorn.parameters.height).toBeGreaterThanOrEqual(220);
    }
  });
});
describe("Ibara pointwise density and material identity", () => {
  it("writes the dominant feature and arc-length parameter", () => {
    const thorn = thorns.find(
      (value) => !value.parameters.broken && !value.parameters.hooked,
    );
    if (!thorn?.sweeps[0]) throw new Error("Fixture missing");
    const point = sampleSpine(thorn.sweeps[0].spine, 0.4, createSpineSample());
    const out = sampleThorn(
      thorn,
      point.x,
      point.y,
      point.z,
      1,
      createIbaraSample(),
      createIbaraWorkspace(),
    );
    expect(out.distance).toBeLessThan(0);
    expect(out.featureId).toBe(thorn.parameters.id);
    expect(out.t).toBeCloseTo(0.4, 1);
  });
  it("narrow-band certificates preserve surface occupancy and density under reversed queries", () => {
    const thorn = thorns[0];
    if (!thorn?.sweeps[0]) throw new Error("Fixture missing");
    const exact = createIbaraBatch([thorn], false),
      band = createIbaraBatch([thorn], true);
    const a = createIbaraSample(),
      b = createIbaraSample(),
      point = createSpineSample();
    for (const t of [0.1, 0.4, 0.75, 0.96]) {
      sampleSpine(thorn.sweeps[0].spine, t, point);
      for (const offset of [-12, -4, 0, 4, 12]) {
        const x = point.x + offset,
          y = point.y,
          z = point.z;
        const da = exact.density(-y, x, y, z, 1, a),
          db = band.density(-y, x, y, z, 1, b);
        expect(db > 0).toBe(da > 0);
        if (Math.abs(da) < 2) expect(db).toBeCloseTo(da, 10);
      }
    }
    const canonical = createIbaraBatch(thorns, false),
      reverse = createIbaraBatch(thorns.slice().reverse(), false);
    expect(canonical.density(-1, 100, 1, 100, 1, a)).toBe(
      reverse.density(-1, 100, 1, 100, 1, b),
    );
    expect(a).toEqual(b);
  });
});

describe("Ibara pass02 form guards", () => {
  it("generates the exact seed2 hooked-colossus regression without relaxing spine guards", () => {
    const thorn = instantiateIbaraLandmarks(
      { ...environment, seed: 2 },
      0,
      0,
    ).find((value) => value.parameters.id === 25198721);
    if (!thorn?.sweeps[0]) throw new Error("Seed2 regression missing");
    expect(thorn.parameters.hooked).toBe(true);
    expect(thorn.parameters.height).toBe(230.65696916775778);
    expect(thorn.sweeps[0].spine.segments).toBe(23);
    expect(thorn.sweeps[0].spine.maxChordError).toBeLessThanOrEqual(0.5);
    expect(thorn.sweeps[0].spine.minimumJointDot).toBeGreaterThanOrEqual(
      0.9781476007,
    );
    expect(thorn.sweeps[0].spine.capped).toBe(false);
  });
  it("keeps affected landmark forms valid across a bounded five-cell probe for seeds1-3", () => {
    let hooked = 0;
    for (const seed of [1, 2, 3])
      for (const [x, z] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ] as const)
        for (const thorn of instantiateIbaraLandmarks(
          { ...environment, seed },
          x,
          z,
        )) {
          if (thorn.parameters.hooked) hooked++;
          for (const sweep of [...thorn.sweeps, ...thorn.debris]) {
            expect(sweep.spine.capped).toBe(false);
            expect(sweep.spine.segments).toBeLessThanOrEqual(24);
            expect(sweep.spine.maxChordError).toBeLessThanOrEqual(0.5);
            expect(sweep.spine.minimumJointDot).toBeGreaterThanOrEqual(
              0.9781476007,
            );
          }
        }
    expect(hooked).toBeGreaterThanOrEqual(2);
  });
  it("keeps the asymmetric crown and both landings inside the frozen curve budget", () => {
    const prototype = landmarks.find((thorn) => thorn.parameters.arch);
    if (!prototype) throw new Error("Arch fixture missing");
    for (const height of [220, 240, 260])
      for (const archSpan of [160, 180, 200])
        for (const bend of [0.03, 0.18, 0.35]) {
          const thorn = instantiateThorn(
            {
              ...prototype.parameters,
              base: [0, 0, 0],
              flowX: 1,
              flowZ: 0,
              height,
              archSpan,
              bend: height * bend,
            },
            environment,
          );
          const main = thorn.sweeps[0];
          if (!main) throw new Error("Missing arch spine");
          expect(main.spine.capped).toBe(false);
          expect(main.spine.segments).toBeLessThanOrEqual(24);
          let top = 0;
          for (let i = 3; i < main.spine.points.length; i += 3)
            if (
              Number(main.spine.points[i + 1]) >
              Number(main.spine.points[top + 1])
            )
              top = i;
          const crown = Number(main.spine.points[top]) / archSpan;
          expect(crown).toBeGreaterThan(0.3);
          expect(crown).toBeLessThan(0.43);
          expect(Number(main.spine.points[1])).toBeLessThan(0);
          expect(
            Number(main.spine.points[main.spine.points.length - 2]),
          ).toBeLessThan(0);
          expect(Number(main.radii[main.radii.length - 1])).toBeCloseTo(
            prototype.parameters.baseRadius * 0.35,
            10,
          );
        }
  });
  it("limits the structural ground blend locally and continuously around a foot", () => {
    const thorn = landmarks[0];
    if (!thorn) throw new Error("Landmark missing");
    const p = thorn.parameters;
    expect(thornGroundFillet(thorn, p.base[0], p.base[2])).toBe(thorn.fillet);
    const x = p.base[0] - p.flowZ * p.baseRadius * 3;
    const z = p.base[2] + p.flowX * p.baseRadius * 3;
    expect(thornGroundFillet(thorn, x, z)).toBeCloseTo(0.6, 10);
    for (let i = 0; i < 200; i++) {
      const offset = (p.baseRadius * i) / 100;
      const a = thornGroundFillet(thorn, p.base[0] + offset, p.base[2]);
      const b = thornGroundFillet(thorn, p.base[0] + offset + 0.001, p.base[2]);
      expect(Math.abs(a - b)).toBeLessThan(0.002);
      expect(a).toBeLessThanOrEqual(thorn.fillet);
    }
  });
  it("keeps rotated angular rubble buried, bounded and identical through narrow-band culling", () => {
    const thorn = landmarks[0];
    if (!thorn) throw new Error("Landmark missing");
    const exact = createIbaraBatch([thorn], false),
      band = createIbaraBatch([thorn], true);
    const a = createIbaraSample(),
      b = createIbaraSample();
    expect(thorn.rubble.length).toBeGreaterThan(3);
    for (const rock of thorn.rubble) {
      expect(rock.centre[1]).toBeLessThan(0);
      expect(sampleThornRubble(rock, ...rock.centre)).toBeLessThan(0);
      for (const ox of [-1.4, -0.7, 0, 0.7, 1.4])
        for (const oy of [-0.5, 0.5, 1.5])
          for (const oz of [-1.4, -0.7, 0, 0.7, 1.4]) {
            const x = rock.centre[0] + ox * rock.boundRadius;
            const y = rock.centre[1] + oy * rock.radii[1];
            const z = rock.centre[2] + oz * rock.boundRadius;
            const da = exact.density(-y, x, y, z, 1, a);
            const db = band.density(-y, x, y, z, 1, b);
            expect(db > 0).toBe(da > 0);
            if (Math.abs(da) < 2) expect(db).toBeCloseTo(da, 10);
            if (sampleThornRubble(rock, x, y, z) < 0)
              expect(pointInBounds(thorn.bounds, x, y, z)).toBe(true);
          }
    }
  });
});

describe("production parameter, cache and material boundaries", () => {
  it("enumerates final parameters without constructing geometry and retains them through lazy LOD and eviction", () => {
    const field = createIbaraField(environment, 256);
    const parameters = field.parametersForCell(1, 0);
    expect(parameters.length).toBeGreaterThan(20);
    expect(field.cachedInstanceCount).toBe(0);
    expect(field.cell(1, 0).map((thorn) => thorn.parameters)).toEqual(
      parameters,
    );
    const coarse = createIbaraField(environment, 256);
    const beforeLodCounts = coarse.diagnosticsForCell(1, 0);
    coarse.collect(
      { minX: -1, minY: -1000, minZ: -1, maxX: 1, maxY: 1000, maxZ: 1 },
      64,
    );
    // The same 104 cell lookups contain hundreds of small thorns. Only eight
    // eligible objects are constructed at this fixed coarse-query fixture.
    expect(coarse.cachedInstanceCount).toBeLessThan(20);
    expect(coarse.diagnosticsForCell(1, 0)).toEqual(beforeLodCounts);
    expect(beforeLodCounts.acceptedInstances).toBe(
      coarse.parametersForCell(1, 0).length,
    );
    expect(beforeLodCounts.acceptedInstances).toBeGreaterThan(
      coarse.cachedInstanceCount,
    );
    const evicted = createIbaraField(environment, 1);
    expect(evicted.parametersForCell(1, 0)).toEqual(parameters);
    evicted.parametersForCell(10, -8);
    expect(evicted.parametersForCell(1, 0)).toEqual(parameters);
    expect(evicted.cachedInstanceCount).toBe(0);
    expect(evicted.cachedCellCount).toBe(1);
    expect(evicted.cachedPlacementCellCount).toBe(1);
  });
  it("keeps size-aware separation across clusters and signed cell boundaries", () => {
    const placement = createIbaraPlacement(environment, 4);
    const params = [];
    for (let z = -2; z <= 1; z++)
      for (let x = -2; x <= 1; x++)
        params.push(
          ...placement.cell(x, z).flatMap((cluster) => cluster.thorns),
        );
    expect(params.some((p) => p.base[0] < 0 || p.base[2] < 0)).toBe(true);
    expect(params.length).toBeGreaterThan(150);
    for (let i = 0; i < params.length; i++)
      for (let j = i + 1; j < params.length; j++) {
        const a = params[i],
          b = params[j];
        if (!a || !b) throw new Error("Missing placement");
        const dx = a.base[0] - b.base[0],
          dz = a.base[2] - b.base[2];
        const minimum = 0.8 * (a.baseRadius + b.baseRadius);
        expect(dx * dx + dz * dz).toBeGreaterThanOrEqual(minimum * minimum);
      }
    expect(placement.cachedCellCount).toBeLessThanOrEqual(4);
  });
  it("does not alias outside-domain cells onto an already cached signed cell", () => {
    const field = createIbaraField(environment);
    field.parametersForCell(0, 1);
    expect(field.parametersForCell(256, 0)).toEqual([]);
    expect(field.parametersForCell(-256, 2)).toEqual([]);
    expect(() => field.parametersForCell(-0.25, 0)).toThrow("integers");
  });
  it("validates all public sample spacings and retains the bounded-query guard", () => {
    const field = createIbaraField(environment);
    const bounds = { minX: 0, minY: -10, minZ: 0, maxX: 2, maxY: 100, maxZ: 2 };
    const batch = createIbaraBatch([]);
    for (const spacing of [0, 0.5, 65, Infinity, NaN]) {
      expect(() => field.collect(bounds, spacing)).toThrow("spacing");
      expect(() => batch.sample(0, 0, 0, spacing, createIbaraSample())).toThrow(
        "spacing",
      );
      expect(() =>
        batch.density(0, 0, 0, 0, spacing, createIbaraSample()),
      ).toThrow("spacing");
    }
    for (const spacing of [1, 1.5, 3, 7, 16, 64]) {
      const selected = field.collect(bounds, spacing);
      expect(
        selected.every(
          (thorn) =>
            thorn.parameters.landmark || thorn.parameters.height >= 2 * spacing,
        ),
      ).toBe(true);
    }
    expect(() =>
      field.collect({
        ...bounds,
        minX: -20000,
        maxX: 20000,
        minZ: -20000,
        maxZ: 20000,
      }),
    ).toThrow("Tile large feature queries");
  });
  it("produces equal-point density and identity in overlapping negative-coordinate areas with reversed warmup", () => {
    const env = { ...environment, seed: 1 };
    const field = createIbaraField(env, 128),
      other = createIbaraField(env, 1);
    const parameters = [-2, -1, 0, 1].flatMap((x) =>
      field.parametersForCell(x, -1),
    );
    const p = parameters.find((item) => item.base[0] < 0 || item.base[2] < 0);
    if (!p) throw new Error("Negative fixture missing");
    const bounds = {
      minX: p.base[0] - 4,
      maxX: p.base[0] + 4,
      minY: -100,
      maxY: 300,
      minZ: p.base[2] - 4,
      maxZ: p.base[2] + 4,
    };
    const shifted = {
      ...bounds,
      minX: bounds.minX - 19,
      maxZ: bounds.maxZ + 23,
    };
    for (const spacing of [1, 3, 16]) {
      const a = createIbaraBatch(field.collect(bounds, spacing));
      other.collect(shifted, 64);
      const b = createIbaraBatch(
        other.collect(shifted, spacing).slice().reverse(),
      );
      const sa = createIbaraSample(),
        sb = createIbaraSample();
      for (const y of [-2, 0, 1, 5, 12]) {
        expect(a.density(-y, p.base[0], y, p.base[2], spacing, sa)).toBe(
          b.density(-y, p.base[0], y, p.base[2], spacing, sb),
        );
        expect(sa).toEqual(sb);
      }
    }
  });
  it("keeps canonical ties and parent material properties, then clears every reused field", () => {
    const prototype = thorns.find(
      (t) => !t.parameters.broken && !t.parameters.hooked,
    );
    if (!prototype?.sweeps[0]) throw new Error("Material fixture missing");
    const first: ThornInstance = {
      ...prototype,
      parameters: {
        ...prototype.parameters,
        broken: true,
        breakT: 0.75,
        crust: "ember",
        core: "obsidian",
        index: 0,
      },
    };
    const second: ThornInstance = {
      ...first,
      parameters: {
        ...first.parameters,
        id: first.parameters.id + 1,
        index: 1,
        core: "basalt",
      },
    };
    const point = sampleSpine(
      first.sweeps[0]?.spine ?? prototype.sweeps[0].spine,
      0.25,
      createSpineSample(),
    );
    const sample = createIbaraSample(),
      reverse = createIbaraSample();
    const a = createIbaraBatch([first, second]),
      b = createIbaraBatch([second, first]);
    a.density(-1000, point.x, point.y, point.z, 1, sample);
    b.density(-1000, point.x, point.y, point.z, 1, reverse);
    expect(sample).toEqual(reverse);
    const material: IbaraMaterialSample = sample;
    expect(material.featureId).toBe(first.parameters.id);
    expect(material.broken).toBe(true);
    expect(material.crust).toBe("ember");
    expect(material.core).toBe("obsidian");
    expect(material.t).toBeGreaterThan(0);
    a.sample(1e6, 1e6, 1e6, 1, sample);
    expect(sample).toEqual(createIbaraSample());
    a.density(1e6, point.x, point.y, point.z, 1, sample);
    expect(sample).toEqual(createIbaraSample());
  });
  it("uses actual cluster lava flow and per-thorn proximity with deterministic no-normal fallback", () => {
    const adapter = (
      direction: number,
      distance: number,
    ): IbaraEnvironment => ({
      ...environment,
      lavaAt: (_x, _z, out) => {
        out[0] = distance;
        out[1] = direction;
        out[2] = 0;
        return out;
      },
    });
    const right = parametersIbaraCell(adapter(1, 20), 1, 0).flatMap(
      (c) => c.thorns,
    );
    const left = parametersIbaraCell(adapter(-1, 20), 1, 0).flatMap(
      (c) => c.thorns,
    );
    expect(right.length).toBe(left.length);
    for (let i = 0; i < right.length; i++) {
      expect(right[i]?.id).toBe(left[i]?.id);
      expect(right[i]?.flowX).toBeGreaterThan(0);
      expect(left[i]?.flowX).toBeLessThan(0);
      expect(right[i]?.nearLava).toBe(true);
    }
    const dry = parametersIbaraCell(environment, 1, 0).flatMap((c) => c.thorns);
    const undefinedNormal = parametersIbaraCell(adapter(0, 0), 1, 0).flatMap(
      (c) => c.thorns,
    );
    expect(undefinedNormal.map((p) => [p.flowX, p.flowZ])).toEqual(
      dry.map((p) => [p.flowX, p.flowZ]),
    );
    expect(right.some((p) => p.crust === "ember")).toBe(true);
    expect(dry.every((p) => p.crust !== "ember")).toBe(true);
  });
});

describe("cell-owned production placement diagnostics", () => {
  const closeCounts = (d: IbaraCellDiagnostics): void => {
    expect(d.candidateClusters).toBe(
      d.rejectedMaskClusters +
        d.rejectedWeightClusters +
        d.rejectedProximityClusters +
        d.acceptedClusters,
    );
    expect(d.candidateInstances).toBe(
      d.rejectedAttemptsInstances +
        d.rejectedSpacingInstances +
        d.acceptedInstances,
    );
    expect(d.poissonAtCap).toBe(d.candidateClusters === 3);
    expect(d.emptyAcceptedClusters).toBeLessThanOrEqual(d.acceptedClusters);
    expect(d.candidateAttempts).toBe(
      d.rejectedWeightAttempts +
        d.rejectedLocalSpacingAttempts +
        (d.landmark ? 0 : d.acceptedInstances + d.rejectedSpacingInstances),
    );
  };

  it("preserves saved operands except normal inclination, with exact outliers, landmarks and ID/order on seeds1-3 signed cells", () => {
    const hash = (value: unknown): string =>
      createHash("sha256").update(JSON.stringify(value)).digest("hex");
    const records = [];
    for (const seed of [1, 2, 3]) {
      const field = createIbaraField(
        {
          seed,
          surfaceAt: (x, z) => 0.2 * x + 0.06 * z,
          weightAt: () => 1,
        },
        2,
      );
      for (const cellX of [-1, 0, 1])
        for (const landmark of [false, true]) {
          const parameters = field.parametersForCell(cellX, 0, landmark);
          const instances = landmark
            ? field.landmarks(cellX, 0)
            : field.cell(cellX, 0);
          records.push({
            seed,
            cellX,
            cellZ: 0,
            landmark,
            count: parameters.length,
            parametersSha256: hash(
              parameters.map((p) => ({
                ...p,
                leanDegrees:
                  p.landmark || p.leanDegrees >= 45 ? p.leanDegrees : 0,
              })),
            ),
            geometrySha256: landmark ? hash(instances) : null,
          });
        }
    }
    // Recorded before contrast: 18 fixtures / 114 parameter objects. Only normal
    // ordinary inclination may differ; all landmark geometry stays exact.
    expect(hash(records)).toBe(
      "81affbba3e7d439f2bbdba8209327e41d7587ab76bf05912c6b5a6627175778f",
    );
  });

  it("returns immutable per-cell snapshots independent of reverse queries, neighbour probes and eviction", () => {
    const cells = [
      [-1, 0],
      [0, -1],
      [0, 0],
      [1, 0],
      [2, -1],
    ] as const;
    const spy = vi.spyOn(spineModule, "flattenBeziers");
    let attempts = 0,
      localSpacingRejects = 0,
      neighbourSpacingRejects = 0,
      proximityRejects = 0,
      cappedBuckets = 0;
    try {
      for (const seed of [1, 2, 3]) {
        const env = { ...environment, seed };
        const first = createIbaraField(env, 1);
        const second = createIbaraField(env, 8);
        const expected = cells.flatMap(([x, z]) =>
          [false, true].map((landmark) =>
            first.diagnosticsForCell(x, z, landmark),
          ),
        );
        for (const d of expected.slice().reverse()) {
          const actual = second.diagnosticsForCell(
            d.cellX,
            d.cellZ,
            d.landmark,
          );
          expect(actual).toEqual(d);
          closeCounts(actual);
          expect(actual.inDomain).toBe(true);
          expect(actual.acceptedInstances).toBe(
            second.parametersForCell(d.cellX, d.cellZ, d.landmark).length,
          );
          expect(Object.isFrozen(actual)).toBe(true);
          const contrast = second.contrastForCell(d.cellX, d.cellZ, d.landmark);
          expect(Object.isFrozen(contrast)).toBe(true);
          expect(contrast.candidatePairs).toBe(
            contrast.adjustedPairs +
              contrast.uncertifiedPairs +
              contrast.noLegalAdjustmentPairs,
          );
          expect(first.contrastForCell(d.cellX, d.cellZ, d.landmark)).toEqual(
            contrast,
          );
          attempts += actual.candidateAttempts;
          localSpacingRejects += actual.rejectedLocalSpacingAttempts;
          neighbourSpacingRejects += actual.rejectedSpacingInstances;
          proximityRejects += actual.rejectedProximityClusters;
          cappedBuckets += Number(actual.poissonAtCap);
        }
        for (const d of expected)
          expect(
            first.diagnosticsForCell(d.cellX, d.cellZ, d.landmark),
          ).toEqual(d);
        expect(first.cachedInstanceCount).toBe(0);
        expect(second.cachedInstanceCount).toBe(0);
      }
      expect(spy).not.toHaveBeenCalled();
      expect(attempts).toBeGreaterThan(0);
      expect(localSpacingRejects).toBeGreaterThan(0);
      expect(neighbourSpacingRejects).toBeGreaterThan(0);
      expect(proximityRejects).toBeGreaterThan(0);
      expect(cappedBuckets).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
    }
  });

  it("separates cluster mask/weight rejection from eight-attempt instance exhaustion", () => {
    const isCellCentre = (x: number, z: number): boolean =>
      Number.isInteger(x / 192 - 0.5) && Number.isInteger(z / 192 - 0.5);
    const mask = createIbaraField({
      ...environment,
      weightAt: (x, z) => (isCellCentre(x, z) ? 1 : 0),
    }).diagnosticsForCell(1, 0);
    expect(mask.candidateClusters).toBeGreaterThan(0);
    expect(mask.rejectedMaskClusters).toBe(mask.candidateClusters);
    expect(mask.candidateInstances).toBe(0);
    expect(mask.candidateAttempts).toBe(0);
    closeCounts(mask);

    const weight = createIbaraField({
      ...environment,
      weightAt: (x, z) => (isCellCentre(x, z) ? 1 : 0.05),
    }).diagnosticsForCell(1, 0);
    expect(weight.rejectedWeightClusters).toBe(weight.candidateClusters);
    expect(weight.rejectedMaskClusters).toBe(0);
    expect(weight.candidateInstances).toBe(0);
    closeCounts(weight);

    const centres = parametersIbaraCell(environment, 1, 0);
    const exhausted = createIbaraField({
      ...environment,
      weightAt: (x, z) =>
        isCellCentre(x, z) || centres.some((c) => c.x === x && c.z === z)
          ? 1
          : 0.15,
    }).diagnosticsForCell(1, 0);
    expect(exhausted.acceptedClusters).toBeGreaterThan(0);
    expect(exhausted.rejectedAttemptsInstances).toBe(
      exhausted.candidateInstances,
    );
    expect(exhausted.candidateAttempts).toBe(8 * exhausted.candidateInstances);
    expect(exhausted.rejectedWeightAttempts).toBe(exhausted.candidateAttempts);
    expect(exhausted.acceptedInstances).toBe(0);
    expect(exhausted.emptyAcceptedClusters).toBe(exhausted.acceptedClusters);
    closeCounts(exhausted);
  });

  it("keeps landmark slot/weight counts separate and reports no invented packing or geometry work", () => {
    const rejected = createIbaraField({
      ...environment,
      weightAt: () => 0.84,
    }).diagnosticsForCell(0, 0, true);
    expect(rejected.landmark).toBe(true);
    expect(rejected.candidateClusters).toBeGreaterThan(0);
    expect(rejected.rejectedWeightClusters).toBe(rejected.candidateClusters);
    expect(rejected.candidateInstances).toBe(0);
    expect(rejected.candidateAttempts).toBe(0);
    closeCounts(rejected);
    const field = createIbaraField({ ...environment, weightAt: () => 0.85 });
    const accepted = field.diagnosticsForCell(0, 0, true);
    expect(accepted.candidateClusters).toBe(rejected.candidateClusters);
    expect(accepted.acceptedClusters).toBe(accepted.candidateClusters);
    expect(accepted.candidateInstances).toBe(accepted.acceptedClusters);
    expect(accepted.acceptedInstances).toBe(accepted.candidateInstances);
    expect(accepted.candidateAttempts).toBe(0);
    expect(field.cachedInstanceCount).toBe(0);
    closeCounts(accepted);
  });

  it("returns empty out-of-domain diagnostics without aliasing a cached cell", () => {
    const field = createIbaraField(environment);
    field.diagnosticsForCell(0, 1);
    for (const landmark of [false, true]) {
      const outside = field.diagnosticsForCell(256, 0, landmark);
      expect(outside).toMatchObject({
        cellX: 256,
        cellZ: 0,
        landmark,
        inDomain: false,
        candidateClusters: 0,
        candidateInstances: 0,
        candidateAttempts: 0,
      });
      closeCounts(outside);
    }
    expect(() => field.diagnosticsForCell(-0.25, 0)).toThrow("integers");
  });
});

describe("production sweep guards on analytic volcanic stand-ins", () => {
  it("keeps all sampled roots, shards and sloped arch landings accurate without dropping curve failures", () => {
    let built = 0,
      arches = 0,
      debris = 0;
    for (const seed of [1, 2, 3])
      for (const slope of [-0.6, -0.2, 0.2, 0.6]) {
        const env: IbaraEnvironment = {
          seed,
          weightAt: () => 1,
          surfaceAt: (x, z) => slope * x + 0.3 * slope * z,
        };
        for (const x of [-1, 0, 1]) {
          const parameters = [
            ...parametersIbaraLandmarks(env, x, 0),
            ...parametersIbaraCell(env, x, 0).flatMap((c) => c.thorns),
          ];
          for (const p of parameters) {
            // Intentionally no catch: a capped spine must fail this regression.
            const thorn = instantiateThorn(p, env);
            built++;
            const main = thorn.sweeps[0];
            if (!main) throw new Error("Missing main spine");
            expect(main.spine.points[1]).toBe(p.base[1] - 0.12 * p.height);
            if (p.arch) {
              arches++;
              const i = main.spine.points.length - 3;
              expect(main.spine.points[i + 1]).toBe(
                env.surfaceAt(
                  Number(main.spine.points[i]),
                  Number(main.spine.points[i + 2]),
                ) -
                  0.1 * p.baseRadius,
              );
              expect(main.radii[main.radii.length - 1]).toBe(
                0.35 * p.baseRadius,
              );
            }
            for (const sweep of [...thorn.sweeps, ...thorn.debris]) {
              expect(sweep.spine.capped).toBe(false);
              expect(sweep.spine.segments).toBeLessThanOrEqual(24);
              expect(sweep.spine.maxChordError).toBeLessThanOrEqual(0.5);
              expect(sweep.spine.minimumJointDot).toBeGreaterThanOrEqual(
                0.9781476007,
              );
              expect(sweep.thinTipLength).toBeLessThanOrEqual(
                Math.max(1.5, 0.04 * sweep.spine.length),
              );
            }
            for (const rock of thorn.rubble)
              expect(rock.centre[1]).toBeLessThan(
                env.surfaceAt(rock.centre[0], rock.centre[2]),
              );
            debris += thorn.debris.length;
            expect(thorn.sweeps.length - 1).toBe(p.branchCount);
          }
        }
      }
    expect(built).toBeGreaterThan(400);
    expect(arches).toBeGreaterThan(20);
    expect(debris).toBeGreaterThan(100);
  });
  it("measures strict tip thickness from actual sampled radii including every debris sweep", () => {
    for (const thorn of [...thorns, ...landmarks])
      for (const sweep of [...thorn.sweeps, ...thorn.debris]) {
        const limit = Math.max(1.5, 0.04 * sweep.spine.length);
        const t = 1 - Math.min(limit, sweep.spine.length) / sweep.spine.length;
        const station = t * (sweep.radii.length - 1),
          i = Math.floor(station),
          f = station - i;
        const radius =
          Number(sweep.radii[i]) +
          (Number(sweep.radii[i + 1]) - Number(sweep.radii[i])) * f;
        expect(radius).toBeGreaterThanOrEqual(0.7);
        expect(sweep.thinTipLength).toBeLessThanOrEqual(limit);
      }
  });
});

it("retains the additional seed1 hooked-colossus and rejects unrepresentable authored curves", () => {
  const thorn = instantiateIbaraLandmarks(environment, -13, -7).find(
    (value) => value.parameters.id === 24736513,
  );
  if (!thorn?.sweeps[0]) throw new Error("Additional hook fixture missing");
  expect(thorn.parameters.hooked).toBe(true);
  expect(thorn.sweeps[0].spine.segments).toBeLessThanOrEqual(24);
  expect(thorn.sweeps[0].spine.maxChordError).toBeLessThanOrEqual(0.5);
  expect(thorn.sweeps[0].spine.minimumJointDot).toBeGreaterThanOrEqual(
    0.9781476007,
  );
  expect(() =>
    instantiateThorn(
      { ...thorn.parameters, height: 50000, bend: 10000 },
      environment,
    ),
  ).toThrow("accuracy");
});

it("supports the full 220-350m arch and 80-200m landing ranges on sloped terrain", () => {
  const prototype = landmarks.find((thorn) => thorn.parameters.arch);
  if (!prototype) throw new Error("Arch extreme fixture missing");
  let count = 0;
  for (const height of [220, 285, 350])
    for (const archSpan of [80, 140, 200])
      for (const bend of [0.03, 0.18, 0.35])
        for (const slope of [-0.6, 0, 0.6]) {
          const env = {
            ...environment,
            surfaceAt: (x: number, z: number) => slope * x + 0.3 * slope * z,
          };
          const thorn = instantiateThorn(
            {
              ...prototype.parameters,
              base: [0, 0, 0],
              flowX: 1,
              flowZ: 0,
              height,
              archSpan,
              bend: height * bend,
            },
            env,
          );
          count++;
          for (const sweep of [...thorn.sweeps, ...thorn.debris]) {
            expect(sweep.spine.capped).toBe(false);
            expect(sweep.spine.segments).toBeLessThanOrEqual(24);
            expect(sweep.spine.maxChordError).toBeLessThanOrEqual(0.5);
            expect(sweep.spine.minimumJointDot).toBeGreaterThanOrEqual(
              0.9781476007,
            );
          }
          const main = thorn.sweeps[0];
          if (!main) throw new Error("Arch sweep missing");
          const i = main.spine.points.length - 3;
          expect(main.spine.points[i]).toBe(archSpan);
          expect(main.spine.points[i + 2]).toBe(0);
          expect(main.spine.points[i + 1]).toBe(
            slope * archSpan - 0.1 * thorn.parameters.baseRadius,
          );
        }
  expect(count).toBe(81);
});

it("runs partition searches only while constructing a cached instance, never while sampling", () => {
  const field = createIbaraField({ ...environment, seed: 2 });
  const built = field.landmarks(0, 0);
  expect(built.some((thorn) => thorn.construction.partitionAttempts > 0)).toBe(
    true,
  );
  const batch = createIbaraBatch(built),
    sample = createIbaraSample();
  const spy = vi.spyOn(spineModule, "flattenBeziers");
  try {
    expect(field.landmarks(0, 0)).toEqual(built);
    for (const thorn of built)
      for (let i = 0; i < 20; i++)
        batch.density(
          -i,
          thorn.parameters.base[0],
          i,
          thorn.parameters.base[2],
          1,
          sample,
        );
    expect(spy).not.toHaveBeenCalled();
  } finally {
    spy.mockRestore();
  }
});

it("retains the exact six pre-production sloped-arch failures after widening the parameter ranges", () => {
  // Seed, slope, cellX, ID, original height/bend/span from the failed source probe.
  const cases = [
    [
      1, -0.6, -1, 25198337, 256.11992413178086, 65.01017492910238,
      189.49086913838983,
    ],
    [
      1, -0.2, 0, 25198657, 252.39725226536393, 70.88266574804375,
      190.89257170446217,
    ],
    [
      1, 0.2, 0, 25198593, 225.9382835123688, 64.77855879211528,
      172.71628629416227,
    ],
    [
      1, 0.6, 1, 25198849, 242.8548124898225, 39.86259581496206,
      173.53939625434577,
    ],
    [
      2, -0.6, 0, 25198593, 257.7913025766611, 13.46220547865611,
      193.81943906657398,
    ],
    [
      3, -0.2, 1, 25198849, 241.76522037945688, 9.65273467405724,
      185.6702740676701,
    ],
  ] as const;
  for (const [seed, slope, cellX, id, height, bend, archSpan] of cases) {
    const env = {
      seed,
      weightAt: () => 1,
      surfaceAt: (x: number, z: number) => slope * x + slope * 0.3 * z,
    };
    const p = parametersIbaraLandmarks(env, cellX, 0).find(
      (value) => value.id === id,
    );
    if (!p) throw new Error("Archived failure fixture missing");
    const thorn = instantiateThorn({ ...p, height, bend, archSpan }, env);
    const spine = thorn.sweeps[0]?.spine;
    if (!spine) throw new Error("Archived failure spine missing");
    expect(spine.capped).toBe(false);
    expect(spine.segments).toBeLessThanOrEqual(24);
    expect(spine.maxChordError).toBeLessThanOrEqual(0.5);
    expect(spine.minimumJointDot).toBeGreaterThanOrEqual(0.9781476007);
  }
});

it("retains exact production hooked landmark 25265665 with the original cubic and frozen spine guards", () => {
  const parameters = {
    id: 25265665,
    cellX: 6,
    cellZ: 1,
    cluster: 0,
    index: 0,
    base: [9855.367626994848, 28.15413793813647, 2270.3296452760696],
    height: 342.8999923658557,
    baseRadius: 19.167104738764465,
    flowX: 0.5282521530313723,
    flowZ: 0.8490875472044798,
    leanDegrees: 49.23690071795136,
    bend: 104.60714759328872,
    sCurve: false,
    hooked: true,
    broken: false,
    breakT: 0.5072431859676726,
    branchCount: 1,
    facets: 6,
    facetiness: 0.8884801372140647,
    twist: 1.3612206772040647,
    phase: 2.560831982759592,
    exponent: 1.0275040809297935,
    core: "obsidian",
    crust: "none",
    nearLava: false,
    landmark: true,
    arch: false,
    archSpan: 183.33445669151843,
  } as const;
  const original = spineModule.flattenBeziers([
    [
      [9855.367626994848, -12.993861145766214, 2270.3296452760696],
      [9800.846128590012, 84.12681247213618, 2380.7193936342755],
      [9995.657050758022, 308.01751060813496, 2654.2442580848315],
      [9970.358982263164, 252.0448360741353, 2504.667572689048],
    ],
  ]);
  expect(original.capped).toBe(true);
  expect(original.maxChordError).toBeCloseTo(0.7662678925026553, 12);
  const thorn = instantiateThorn(parameters, {
    seed: 2,
    surfaceAt: () => parameters.base[1],
    weightAt: () => 1,
  });
  expect(thorn.parameters).toEqual(parameters);
  expect(thorn.sweeps.length).toBe(2);
  for (const sweep of [...thorn.sweeps, ...thorn.debris]) {
    expect(sweep.spine.capped).toBe(false);
    expect(sweep.spine.segments).toBeLessThanOrEqual(24);
    expect(sweep.spine.maxChordError).toBeLessThanOrEqual(0.5);
    expect(sweep.spine.minimumJointDot).toBeGreaterThanOrEqual(0.9781476007);
  }
  const main = thorn.sweeps[0];
  if (!main) throw new Error("Exact production main sweep missing");
  expect(main.spine.segments).toBe(24);
  expect(main.spine.maxChordError).toBeCloseTo(0.48959517729079716, 12);
  expect(main.spine.minimumJointDot).toBeCloseTo(0.9793026788425683, 12);
  expect(main.spine.points.slice(0, 3)).toEqual(original.points.slice(0, 3));
  expect(main.spine.points.slice(-3)).toEqual(original.points.slice(-3));
});
