import { describe, expect, it } from "vitest";
import { parametersIbaraCell } from "../src/features/ibara/cells.js";
import {
  compareThorns,
  createIbaraBatch,
  type IbaraBatch,
} from "../src/features/ibara/field.js";
import {
  createIbaraWorkspace,
  type IbaraWorkspace,
  sampleThorn,
  sweepLowerBound,
  thornVisibleAtSpacing,
} from "../src/features/ibara/sample.js";
import { instantiateThorn } from "../src/features/ibara/shape.js";
import {
  clearIbaraSample,
  createIbaraSample,
  type IbaraSample,
  type ThornInstance,
} from "../src/features/ibara/types.js";
import { smoothIntersection } from "../src/sdf/ops.js";
import { createSpineSample, sampleSpine } from "../src/sdf/spine.js";
import { pointInBounds } from "../src/sdf/types.js";

// Frozen b8 field.ts SHA256:
// 12fd2daa7a161f91303572be715e876119646df7719b8ac244a859eb31885f36.
// copySample and the original factory below are unchanged except its name.
// This reference always constructs the key and reads the original coarse Map.
function copySample(out: IbaraSample, source: IbaraSample): void {
  out.distance = source.distance;
  out.featureId = source.featureId;
  out.t = source.t;
  out.fillet = source.fillet;
  out.core = source.core;
  out.crust = source.crust;
  out.kind = source.kind;
  out.broken = source.broken;
}
/** A bounded chunk/tile evaluator. The global 4m lattice never depends on chunk origin.
 * Exterior narrow-band rejection uses a capsule certificate as well as |f|,
 * because twisted polygons and roughness need not obey a global 1.3 Lipschitz bound.
 * Deep solid samples retain exact t/material identity; no interior interpolation seam.
 */
function createReferenceBatch(
  instances: readonly ThornInstance[],
  narrowBand = true,
): IbaraBatch {
  const ordered = instances.slice().sort(compareThorns);
  const coarse = ordered.map(() => new Map<string, number>());
  const work: IbaraWorkspace = createIbaraWorkspace(),
    candidate = createIbaraSample();
  const diagnostics = { coarseSamples: 0, exactSamples: 0, capsuleRejects: 0 };
  const evaluate = (
    thorn: ThornInstance,
    i: number,
    x: number,
    y: number,
    z: number,
    spacing: number,
  ): boolean => {
    if (
      !thornVisibleAtSpacing(thorn, spacing) ||
      !pointInBounds(thorn.bounds, x, y, z)
    )
      return false;
    if (narrowBand) {
      const gx = Math.round(x / 4) * 4,
        gy = Math.round(y / 4) * 4,
        gz = Math.round(z / 4) * 4;
      const key = `${gx},${gy},${gz},${spacing}`;
      const grid = coarse[i] as Map<string, number>;
      let value = grid.get(key);
      if (value === undefined) {
        sampleThorn(thorn, gx, gy, gz, spacing, candidate, work);
        value = candidate.distance;
        if (grid.size >= 4096) grid.clear();
        grid.set(key, value);
        diagnostics.coarseSamples++;
      }
      if (value > 4.6 + thorn.fillet) {
        const thickening =
          spacing <= 1 || thorn.lodPolicy === "landmark"
            ? 0
            : Math.min(0.5 * spacing, 0.3 * thorn.parameters.height);
        let lower = Infinity;
        for (const sweep of thorn.sweeps)
          lower = Math.min(lower, sweepLowerBound(sweep, x, y, z, thickening));
        for (const sweep of thorn.debris)
          lower = Math.min(lower, sweepLowerBound(sweep, x, y, z, thickening));
        for (const rock of thorn.rubble) {
          const dx = x - rock.centre[0],
            dy = y - rock.centre[1],
            dz = z - rock.centre[2];
          lower = Math.min(
            lower,
            // The clipped-box plane field is not Euclidean distance at corners.
            (Math.sqrt(dx * dx + dy * dy + dz * dz) - rock.boundRadius) /
              Math.sqrt(3),
          );
        }
        // Account for all intra-thorn smooth unions before declaring empty space.
        lower -=
          Math.max(0, thorn.sweeps.length - 1) *
          Math.max(1, 0.18 * thorn.parameters.baseRadius) *
          0.25;
        if (lower > thorn.fillet + 4.6) {
          diagnostics.capsuleRejects++;
          return false;
        }
      }
    }
    sampleThorn(thorn, x, y, z, spacing, candidate, work);
    diagnostics.exactSamples++;
    return true;
  };
  return {
    instances: ordered,
    diagnostics,
    sample(x, y, z, spacing, out): IbaraSample {
      if (!(spacing >= 1 && spacing <= 64))
        throw new RangeError("Unsupported Ibara sample spacing");
      clearIbaraSample(out);
      for (let i = 0; i < ordered.length; i++) {
        const thorn = ordered[i] as ThornInstance;
        if (
          evaluate(thorn, i, x, y, z, spacing) &&
          candidate.distance < out.distance
        )
          copySample(out, candidate);
      }
      return out;
    },
    density(terrain, x, y, z, spacing, out): number {
      if (!(spacing >= 1 && spacing <= 64))
        throw new RangeError("Unsupported Ibara sample spacing");
      let density = terrain,
        dominance = terrain;
      if (!(spacing >= 1 && spacing <= 64))
        throw new RangeError("Unsupported Ibara sample spacing");
      clearIbaraSample(out);
      for (let i = 0; i < ordered.length; i++) {
        const thorn = ordered[i] as ThornInstance;
        if (!evaluate(thorn, i, x, y, z, spacing)) continue;
        if (-candidate.distance > dominance) {
          copySample(out, candidate);
          dominance = -candidate.distance;
        }
        density = smoothIntersection(
          density,
          -candidate.distance,
          candidate.fillet,
        );
      }
      return density;
    },
  };
}

function rock(index: number, x = 0, radius = 1): ThornInstance {
  return {
    construction: {
      flattenCalls: 0,
      partitionAttempts: 0,
      finePartitionAttempts: 0,
    },
    parameters: {
      id: index + 1,
      cellX: 0,
      cellZ: 0,
      cluster: 0,
      index,
      base: [x, 0, 0],
      height: 1000,
      baseRadius: radius,
      flowX: 1,
      flowZ: 0,
      leanDegrees: 0,
      bend: 0,
      sCurve: false,
      hooked: false,
      broken: false,
      breakT: 0.75,
      branchCount: 0,
      facets: 6,
      facetiness: 0,
      twist: 0,
      phase: 0,
      exponent: 1,
      core: index % 2 === 0 ? "basalt" : "obsidian",
      crust: index % 2 === 0 ? "none" : "ember",
      nearLava: false,
      landmark: false,
      arch: false,
      archSpan: 0,
    },
    sweeps: [],
    debris: [],
    rubble: [
      {
        centre: [x, 0, 0],
        radii: [radius, radius, radius],
        axis: [1, 0],
        topSlope: [0, 0],
        boundRadius: Math.sqrt(3) * radius,
      },
    ],
    // Deliberately wide synthetic bounds exercise cache eviction cheaply.
    bounds: {
      minX: -20000,
      maxX: 20000,
      minY: -20000,
      maxY: 20000,
      minZ: -20000,
      maxZ: 20000,
    },
    fillet: 2,
    profileExponent: 1,
    thinTipLength: 0,
    lodPolicy: "thicken",
  };
}

function pair(instances: readonly ThornInstance[], narrowBand = true) {
  const actual = createIbaraBatch(instances, narrowBand);
  const reference = createReferenceBatch(instances, narrowBand);
  const a = createIbaraSample(),
    b = createIbaraSample();
  let calls = 0;
  return {
    actual,
    reference,
    check(x: number, y: number, z: number, spacing = 1): void {
      const sample = () => {
        actual.sample(x, y, z, spacing, a);
        reference.sample(x, y, z, spacing, b);
        expect(a).toEqual(b);
        expect(actual.diagnostics).toEqual(reference.diagnostics);
      };
      const density = () => {
        expect(actual.density(-0.25, x, y, z, spacing, a)).toBe(
          reference.density(-0.25, x, y, z, spacing, b),
        );
        expect(a).toEqual(b);
        expect(actual.diagnostics).toEqual(reference.diagnostics);
      };
      if (calls++ % 2 === 0) {
        sample();
        density();
      } else {
        density();
        sample();
      }
    },
  };
}

describe("per-thorn last coarse sample", () => {
  it.each([true, false])(
    "matches repeated/nonconsecutive grid points with narrowBand=%s",
    (narrowBand) => {
      const proof = pair([rock(0)], narrowBand);
      for (const [x, y, z] of [
        [0.1, 0.2, 0.3],
        [0.9, 1.8, 1.1],
        [0.1, 0.2, 0.3],
        [4.1, 0.2, 0.3],
        [0.1, 0.2, 0.3],
        [0.1, 4.2, 0.3],
        [0.1, 0.2, 4.3],
        [0.1, 0.2, 0.3],
        [0.9, 1.8, 1.1],
      ] as const)
        proof.check(x, y, z);
      expect(proof.actual.diagnostics.coarseSamples).toBe(narrowBand ? 4 : 0);
    },
  );

  it("matches negative rounding boundaries and signed zero", () => {
    const proof = pair([rock(0)]);
    for (const x of [
      -6.000001, -6, -5.999999, -2.000001, -2, -1.999999, -0, 0, 1.999999, 2,
      2.000001,
    ]) {
      proof.check(x, 0, 0);
      proof.check(x, 0.5, 0);
      proof.check(0, x, 0);
      proof.check(0, 0, x);
    }
    proof.check(0, 0, 0);
    proof.check(-0, -0, -0);
  });

  it("keeps spacing in the key and reuses nonconsecutive Map hits", () => {
    const proof = pair([rock(0)]);
    for (const spacing of [1, 1.5, 3, 7, 64, 3, 1.5, 1]) {
      proof.check(0.25, 0.5, 0.75, spacing);
      proof.check(0.75, 1.5, 1.25, spacing);
    }
    expect(proof.actual.diagnostics.coarseSamples).toBe(5);
  });

  it("keeps independent values/diagnostics for different thorn indices", () => {
    const instances = [rock(2, 14, 1), rock(0, 0, 1), rock(1, 0, 3)];
    for (const order of [instances, instances.slice().reverse()]) {
      const proof = pair(order);
      for (const x of [0.1, 0.2, 4.1, 0.1, 12.1, 12.2, 0.1])
        proof.check(x, 0.25, 0.5);
      expect(proof.actual.diagnostics.coarseSamples).toBe(9);
    }
  });

  it("retains cached Infinity and leaves the slot intact on rejected points", () => {
    const base = rock(0);
    const small = {
      ...base,
      bounds: { minX: -3, maxX: 3, minY: -3, maxY: 3, minZ: -3, maxZ: 3 },
    };
    const proof = pair([small]);
    // gx=4 is outside the instance: the cached coarse distance is Infinity.
    proof.check(2.5, 0, 0);
    proof.check(2.75, 0, 0);
    proof.check(4.5, 0, 0); // Entire evaluate call is rejected; no coarse access.
    proof.check(2.5, 0, 0);
    proof.check(-2.5, 0, 0);
    proof.check(-2.75, 0, 0);
    proof.check(2.5, 0, 0);
    expect(proof.actual.diagnostics.coarseSamples).toBe(2);
  });

  it("preserves the 4096-entry clear and re-evaluation after eviction", () => {
    const proof = pair([rock(0)]);
    for (let i = 0; i < 4096; i++) proof.check(i * 4, 0, 0);
    expect(proof.actual.diagnostics.coarseSamples).toBe(4096);
    proof.check(4096 * 4, 0, 0); // Miss at size 4096 clears, then installs this key.
    expect(proof.actual.diagnostics.coarseSamples).toBe(4097);
    proof.check(4096 * 4 + 0.5, 0, 0); // Same last grid point survives that clear.
    expect(proof.actual.diagnostics.coarseSamples).toBe(4097);
    // The old zero key was cleared, so it must be sampled again.
    proof.check(0, 0, 0);
    expect(proof.actual.diagnostics.coarseSamples).toBe(4098);
    proof.check(0.5, 0, 0);
    proof.check(4096 * 4, 0, 0); // Nonconsecutive lookup is still a Map hit.
    expect(proof.actual.diagnostics.coarseSamples).toBe(4098);
  });

  it("matches actual constructed sweeps with varying points and spacing", () => {
    const environment = { seed: 1, surfaceAt: () => 0, weightAt: () => 1 };
    const parameters = parametersIbaraCell(environment, 0, 0)
      .flatMap((cluster) => cluster.thorns)
      .slice(0, 2);
    expect(parameters).toHaveLength(2);
    const instances = parameters.map((p) => instantiateThorn(p, environment));
    const proof = pair(instances);
    for (const thorn of instances) {
      const sweep = thorn.sweeps[0];
      if (!sweep) throw new Error("Missing main sweep");
      const point = sampleSpine(sweep.spine, 0.4, createSpineSample());
      for (const spacing of [1, 1.5, 3, 7, 1])
        for (const dy of [-0.25, 0, 0.25, 3.9, 0])
          proof.check(point.x, point.y + dy, point.z, spacing);
    }
  });

  it("preserves empty output and invalid-spacing rejection", () => {
    const proof = pair([]);
    proof.check(0, 0, 0);
    proof.check(0.5, 0.5, 0.5, 1.5);
    expect(proof.actual.diagnostics).toEqual({
      coarseSamples: 0,
      exactSamples: 0,
      capsuleRejects: 0,
    });
    for (const spacing of [0, 0.5, 65, Infinity, NaN]) {
      expect(() =>
        proof.actual.sample(0, 0, 0, spacing, createIbaraSample()),
      ).toThrow("spacing");
      expect(() =>
        proof.reference.sample(0, 0, 0, spacing, createIbaraSample()),
      ).toThrow("spacing");
      expect(() =>
        proof.actual.density(0, 0, 0, 0, spacing, createIbaraSample()),
      ).toThrow("spacing");
      expect(() =>
        proof.reference.density(0, 0, 0, 0, spacing, createIbaraSample()),
      ).toThrow("spacing");
    }
  });
});
