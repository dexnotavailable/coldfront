import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  createIbaraWorkspace,
  sampleThornSweep,
  sweepRadius,
} from "../src/features/ibara/sample.js";
import { instantiateThorn } from "../src/features/ibara/shape.js";
import type {
  ThornInstance,
  ThornParameters,
} from "../src/features/ibara/types.js";
import { detSinCos } from "../src/math/det.js";
import { hash2, rand01 } from "../src/math/hash.js";
import * as spineModule from "../src/sdf/spine.js";
import type { CubicBezier, Vec3 } from "../src/sdf/types.js";

// Historical generation-3 accepted witness, not a current production census:
// production-blade-floor-parameters/hellscape-s1-2026-10-09T09-06-48.264Z-parameters.json
// SHA of accepted population: a8abcc274cc8f2cce94e830ef63db1af3e1adfd0e6f24b44dbb2f1d619d8088c.
// Saved ID/XZ/height/inclination/bend and salted intrinsic shape draws are exact.
// Y=0, heading=(1,0), and no lava context are explicit synthetic fixture choices;
// these tests establish shape math, not production voxel silhouettes or grounding.
const first: ThornParameters = {
  id: 10198278,
  cellX: 29,
  cellZ: 27,
  cluster: 0,
  index: 5,
  base: [5625.137863312989, 0, 5445.956233126358],
  height: 18.72350004810288,
  baseRadius: 2.1150634164454085,
  flowX: 1,
  flowZ: 0,
  leanDegrees: 6.431480543739313,
  bend: 1.3221879282470672,
  sCurve: true,
  hooked: false,
  broken: false,
  breakT: 0.45789782773936166,
  branchCount: 0,
  facets: 3,
  facetiness: 0.8246045914292336,
  twist: 1.6177402902755948,
  phase: 2.198131797629608,
  exponent: 0.8735509720630944,
  core: "basalt",
  crust: "none",
  nearLava: false,
  landmark: false,
  arch: false,
  archSpan: 142.2175234556198,
};
const second: ThornParameters = {
  ...first,
  id: 10198290,
  index: 17,
  base: [5619.838766063097, 0, 5436.724245981534],
  height: 22.942259038317587,
  baseRadius: 2.6651105132447794,
  leanDegrees: 14.431481543739313,
  bend: 1.0323867000736628,
  breakT: 0.4960165479918942,
  facets: 4,
  facetiness: 0.732958531677723,
  twist: 0.9935724184164759,
  phase: 0.7748922479324708,
  exponent: 0.8129312812117859,
  archSpan: 134.40793165937066,
};
const environment = { seed: 1, surfaceAt: () => 0, weightAt: () => 1 };

/** Frozen pre-repair authored cubic; the source's measurement is tested against
 * a dense numerical evaluation of this curve, not a copy of its root solver. */
function originalCurve(p: ThornParameters): CubicBezier {
  const trig = new Float64Array(2);
  detSinCos((p.leanDegrees * Math.PI) / 180, trig);
  const side = (rand01(hash2(p.id, 9)) < 0.5 ? -1 : 1) * p.bend;
  const point = (t: number, lateral: number): Vec3 => [
    p.base[0] + p.flowX * Number(trig[0]) * p.height * t - p.flowZ * lateral,
    p.base[1] + Number(trig[1]) * p.height * t,
    p.base[2] + p.flowZ * Number(trig[0]) * p.height * t + p.flowX * lateral,
  ];
  return [
    [p.base[0], p.base[1] - 0.12 * p.height, p.base[2]],
    point(0.25, side),
    point(0.7, -side),
    point(1, 0.25 * side),
  ];
}
function pointAt(curve: CubicBezier, t: number): Vec3 {
  const u = 1 - t;
  return [0, 1, 2].map(
    (axis) =>
      u * u * u * Number(curve[0][axis]) +
      3 * u * u * t * Number(curve[1][axis]) +
      3 * u * t * t * Number(curve[2][axis]) +
      t * t * t * Number(curve[3][axis]),
  ) as unknown as Vec3;
}
function chordDistance(point: Vec3, start: Vec3, end: Vec3): number {
  const delta = end.map((value, i) => value - Number(start[i]));
  const local = point.map((value, i) => value - Number(start[i]));
  const t = Math.max(
    0,
    Math.min(
      1,
      local.reduce((sum, value, i) => sum + value * Number(delta[i]), 0) /
        delta.reduce((sum, value) => sum + value * value, 0),
    ),
  );
  return Math.hypot(...local.map((value, i) => value - t * Number(delta[i])));
}
function denseExcursion(curve: CubicBezier): number {
  let maximum = 0;
  for (let i = 0; i <= 5000; i++)
    maximum = Math.max(
      maximum,
      chordDistance(pointAt(curve, i / 5000), curve[0], curve[3]),
    );
  return maximum;
}
function capture(p: ThornParameters): {
  thorn: ThornInstance;
  curves: readonly CubicBezier[];
} {
  const spy = vi.spyOn(spineModule, "flattenBeziers");
  try {
    const thorn = instantiateThorn(p, environment);
    const curves = spy.mock.calls[0]?.[0];
    if (!curves?.length) throw new Error("Missing authored main curve");
    return { thorn, curves };
  } finally {
    spy.mockRestore();
  }
}
const firstLobe = 1 / (3 + Math.sqrt(2));
const intervals = [firstLobe, 2 * firstLobe, 1 - 3 * firstLobe];
function pointOn(curves: readonly CubicBezier[], t: number): Vec3 {
  if (curves.length === 1) return pointAt(curves[0] as CubicBezier, t);
  let start = 0;
  for (let i = 0; i < curves.length; i++) {
    const length = Number(intervals[i]);
    if (t <= start + length || i === curves.length - 1)
      return pointAt(
        curves[i] as CubicBezier,
        Math.max(0, Math.min(1, (t - start) / length)),
      );
    start += length;
  }
  throw new Error("Missing curve interval");
}
function guards(thorn: ThornInstance): void {
  for (const sweep of [...thorn.sweeps, ...thorn.debris]) {
    expect(sweep.spine.capped).toBe(false);
    expect(sweep.spine.segments).toBeLessThanOrEqual(24);
    expect(sweep.spine.maxChordError).toBeLessThanOrEqual(0.5);
    expect(sweep.spine.minimumJointDot).toBeGreaterThanOrEqual(0.9781476007);
    expect(sweep.thinTipLength).toBeLessThanOrEqual(
      Math.max(1.5, 0.04 * sweep.spine.length),
    );
  }
}

describe("small Ibara S-curve readability", () => {
  it("realizes the two saved weak bend operands without changing any input or endpoint", () => {
    for (const p of [first, second]) {
      Object.freeze(p.base);
      Object.freeze(p);
      const before = originalCurve(p),
        snapshot = JSON.stringify(p);
      expect(denseExcursion(before)).toBeLessThan(0.5);
      const { thorn, curves } = capture(p);
      expect(thorn.parameters).toBe(p);
      expect(JSON.stringify(p)).toBe(snapshot);
      expect((curves[0] as CubicBezier)[0]).toEqual(before[0]);
      expect((curves[curves.length - 1] as CubicBezier)[3]).toEqual(before[3]);
      guards(thorn);
      const side = (rand01(hash2(p.id, 9)) < 0.5 ? -1 : 1) * p.bend;
      // Actual interior lobe extrema, not the off-curve Bezier handles.
      for (const sign of [-1, 1]) {
        const t = sign === 1 ? firstLobe : 3 * firstLobe;
        const point = pointOn(curves, t);
        const lateral =
          -p.flowZ * (point[0] - p.base[0]) + p.flowX * (point[2] - p.base[2]);
        expect(lateral - 0.25 * side * t).toBeCloseTo(sign * side, 8);
        expect(point[1]).toBeGreaterThan(p.base[1]);
      }
      const main = thorn.sweeps[0];
      if (!main) throw new Error("Missing main sweep");
      const points = main.spine.points;
      let actual = 0;
      for (let i = 0; i < points.length; i += 3)
        actual = Math.max(
          actual,
          chordDistance(
            [Number(points[i]), Number(points[i + 1]), Number(points[i + 2])],
            before[0],
            before[3],
          ),
        );
      expect(actual).toBeGreaterThan(1);
      expect(thorn.fillet).toBe(2);
      expect(thorn.debris).toHaveLength(0);
      expect(thorn.rubble).toHaveLength(0);
    }
  });

  it("settles the terminal lateral tangent and joins both lobes with continuous curvature", () => {
    for (const p of [first, second]) {
      const { curves } = capture(p);
      expect(curves).toHaveLength(3);
      const side = (rand01(hash2(p.id, 9)) < 0.5 ? -1 : 1) * p.bend;
      const last = curves[2] as CubicBezier,
        length = Number(intervals[2]);
      const dx = (3 * (last[3][0] - last[2][0])) / length,
        dz = (3 * (last[3][2] - last[2][2])) / length;
      expect(-p.flowZ * dx + p.flowX * dz).toBeCloseTo(0.25 * side, 8);
      for (let i = 0; i < 2; i++) {
        const a = curves[i] as CubicBezier,
          b = curves[i + 1] as CubicBezier;
        const da = Number(intervals[i]),
          db = Number(intervals[i + 1]);
        expect(a[3]).toEqual(b[0]);
        for (let axis = 0; axis < 3; axis++) {
          expect(
            (3 * (Number(a[3][axis]) - Number(a[2][axis]))) / da,
          ).toBeCloseTo(
            (3 * (Number(b[1][axis]) - Number(b[0][axis]))) / db,
            6,
          );
          expect(
            (6 *
              (Number(a[3][axis]) -
                2 * Number(a[2][axis]) +
                Number(a[1][axis]))) /
              (da * da),
          ).toBeCloseTo(
            (6 *
              (Number(b[2][axis]) -
                2 * Number(b[1][axis]) +
                Number(b[0][axis]))) /
              (db * db),
            6,
          );
        }
      }
    }
  });

  it("agrees with independent dense extrema through the bounded blend and keeps strong curves exact", () => {
    let full = 0,
      blend = 0,
      strong = 0;
    for (const height of [12, 24, 40, 57])
      for (const leanDegrees of [5, 18, 35, 65])
        for (const ratio of [0, 0.03, 0.1, 0.2, 0.35]) {
          const p = {
            ...first,
            base: [0, 0, 0] as const,
            height,
            leanDegrees,
            bend: ratio * height,
            baseRadius: 1.6,
          };
          const old = originalCurve(p),
            excursion = denseExcursion(old);
          const { thorn, curves } = capture(p);
          guards(thorn);
          expect((curves[0] as CubicBezier)[0]).toEqual(old[0]);
          expect((curves[curves.length - 1] as CubicBezier)[3]).toEqual(old[3]);
          if (excursion >= 1) {
            strong++;
            expect(curves).toEqual([old]);
            continue;
          }
          if (excursion <= 0.5) full++;
          else blend++;
          const t = Math.max(0, (excursion - 0.5) * 2),
            weight = 1 - t * t * (3 - 2 * t);
          const side = (rand01(hash2(p.id, 9)) < 0.5 ? -1 : 1) * p.bend;
          for (const sign of [-1, 1]) {
            const at = sign === 1 ? firstLobe : 3 * firstLobe,
              oldPoint = pointAt(old, at);
            const target = 0.25 * side * at + sign * side;
            expect(pointOn(curves, at)[2]).toBeCloseTo(
              oldPoint[2] + weight * (target - oldPoint[2]),
              5,
            );
          }
        }
    expect(full).toBeGreaterThan(5);
    expect(blend).toBeGreaterThan(5);
    expect(strong).toBeGreaterThan(5);
  });

  it("has no shape jump at either excursion threshold", () => {
    for (const boundary of [0.5, 1]) {
      let low = 0,
        high = 5;
      for (let i = 0; i < 30; i++) {
        const mid = (low + high) / 2;
        if (denseExcursion(originalCurve({ ...first, bend: mid })) < boundary)
          low = mid;
        else high = mid;
      }
      const bend = (low + high) / 2;
      const a = capture({ ...first, bend: bend - 1e-6 }).curves;
      const b = capture({ ...first, bend: bend + 1e-6 }).curves;
      for (let i = 0; i <= 32; i++)
        for (let axis = 0; axis < 3; axis++)
          expect(
            Math.abs(
              Number(pointOn(a, i / 32)[axis]) -
                Number(pointOn(b, i / 32)[axis]),
            ),
          ).toBeLessThan(1e-5);
    }
  });

  it("keeps the weak-shape decision stable across world translations and headings", () => {
    for (const fixture of [first, second]) {
      const reference = capture(fixture).curves;
      for (const [flowX, flowZ] of [
        [0.6, 0.8],
        [-0.8, 0.6],
        [-1, 0],
      ]) {
        const p = {
          ...fixture,
          base: [-22527.5, 900.25, 22527.5] as const,
          flowX: Number(flowX),
          flowZ: Number(flowZ),
        };
        const { thorn, curves } = capture(p);
        guards(thorn);
        for (let i = 0; i <= 32; i++) {
          const before = pointOn(reference, i / 32),
            after = pointOn(curves, i / 32);
          const along = before[0] - fixture.base[0],
            side = before[2] - fixture.base[2];
          expect(after[0] - p.base[0]).toBeCloseTo(
            p.flowX * along - p.flowZ * side,
            8,
          );
          expect(after[1] - p.base[1]).toBeCloseTo(
            before[1] - fixture.base[1],
            8,
          );
          expect(after[2] - p.base[2]).toBeCloseTo(
            p.flowZ * along + p.flowX * side,
            8,
          );
        }
      }
    }
  });

  it("preserves frozen output hashes of every unrelated shape family", () => {
    const cases: readonly [Partial<ThornParameters>, string][] = [
      [
        { sCurve: false },
        "a246c5d38acbb7e15116970f5ff3ecf66e01a5995fbc2fa091da3c5bba78b72a",
      ],
      [
        { hooked: true },
        "c25e9693f2f9c59bb6b71a71a21802ead1405ba822f884a448638476d30bce6f",
      ],
      [
        { baseRadius: 4 },
        "b5d4a85e5b96857a14fc87128159ff7709e4e9134ee5313f8e6d449a7bec8684",
      ],
      [
        { height: 240, baseRadius: 20, landmark: true },
        "8687657cea2fb417bccd42a5582a4438649335eadf1892c8e75e64756992c479",
      ],
      [
        {
          height: 240,
          baseRadius: 20,
          landmark: true,
          arch: true,
          sCurve: false,
        },
        "7be3822fb03eb3d09312e642f19fae26c0926cdd13bae6508e17f21629173adb",
      ],
      [
        { broken: true, sCurve: false },
        "73db161ab13d2c67377fa2092680c3634b8b55c1a979d2705afb5eeb3b8edfce",
      ],
    ];
    for (const [change, hash] of cases)
      expect(
        createHash("sha256")
          .update(
            JSON.stringify(
              instantiateThorn({ ...first, ...change }, environment),
            ),
          )
          .digest("hex"),
      ).toBe(hash);
  });
});

// Exact source91 HELL-2 seed1 owner parameters from the 2026-10-12 body/profile
// receipt (owner8891401), followed by its 1,872-cell production occupancy probe.
// Flat ground at baseY affects incidental debris only; these tests sample the
// main sweep alone, not a WorldPlan or production chunk cleanup.
const longTipWitness: ThornParameters = {
  id: 8891401,
  cellX: 44,
  cellZ: 7,
  cluster: 0,
  index: 8,
  base: [8635.048966192337, 33.07310484832025, 1469.5111290749005],
  height: 117.72198294666302,
  baseRadius: 10.118207950569976,
  flowX: -0.24873723007401555,
  flowZ: -0.9685710043022693,
  leanDegrees: 5.9726936391544125,
  bend: 35.4682024547197,
  sCurve: false,
  hooked: false,
  broken: false,
  breakT: 0.6389695584191941,
  branchCount: 0,
  facets: 5,
  facetiness: 0.989823425412178,
  twist: 0.0005761771124704074,
  phase: 5.467178004102894,
  exponent: 1.22494417920243,
  core: "obsidian",
  crust: "none",
  nearLava: true,
  landmark: false,
  arch: false,
  archSpan: 164.7261363081634,
};
const tipEnvironment = {
  seed: 1,
  weightAt: () => 1,
  surfaceAt: () => longTipWitness.base[1],
};
const shapeHash = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

// Exact seed-1 cell (47,5) owner from the 2026-10-15 production failure witness.
// parameters.json SHA256: 32599518c9c7b4e5d2e03545cf029cab7e12633dd0765ae5ec8aa7da1d8948a8.
// Coordinates and all shape fields are preserved; construction queried none
// of the real environment callbacks, so the regression rejects any such call.
const shortTipWitness: ThornParameters = {
  id: 8761096,
  cellX: 47,
  cellZ: 5,
  cluster: 0,
  index: 7,
  base: [8997.790169223104, 59.775272638574556, 925.2278029062845],
  height: 12.47084544089819,
  baseRadius: 1.9449975206618593,
  flowX: -0.16527325055945818,
  flowZ: -0.9862478150290171,
  leanDegrees: 6.817410878719727,
  bend: 2.74313696184254,
  sCurve: true,
  hooked: false,
  broken: false,
  breakT: 0.4832940995926037,
  branchCount: 0,
  facets: 3,
  facetiness: 0.7819145880639553,
  twist: 1.8921791688574119,
  phase: 5.431290971983959,
  exponent: 1.3020923062693328,
  core: "basalt",
  crust: "none",
  nearLava: false,
  landmark: false,
  arch: false,
  archSpan: 112.39618771709502,
};

describe("ordinary intact main-tip readability", () => {
  it("preserves the real short owner when the inverse tail length rounds above its exact limit", () => {
    const unexpectedEnvironmentQuery = (): never => {
      throw new Error("The saved short owner made no environment queries");
    };
    const thorn = instantiateThorn(shortTipWitness, {
      seed: 1,
      surfaceAt: unexpectedEnvironmentQuery,
      weightAt: unexpectedEnvironmentQuery,
      lavaAt: unexpectedEnvironmentQuery,
    });
    const main = thorn.sweeps[0];
    if (!main) throw new Error("Missing short witness main sweep");
    expect(thorn.parameters).toBe(shortTipWitness);
    expect(main.spine.length).toBe(14.503502740388427);
    expect(main.thinTipLength).toBe(1.5000000000000002);
    expect(sweepRadius(main, 1 - 1.5 / main.spine.length)).toBe(0.7);
    // Whole baseline instance, with typed arrays encoded as plain arrays in
    // the saved witness. The expected digest comes only from that saved data.
    expect(
      createHash("sha256")
        .update(
          JSON.stringify(thorn, (_, value) =>
            value instanceof Float64Array ? Array.from(value) : value,
          ),
        )
        .digest("hex"),
    ).toBe("2c3d9c029a66ad6e3a645c61d2282bf69762360d06d7a5317c4b60ce6c66bb74");
  });

  it("restores the proportional body exactly and confines the correction to the terminal tenth", () => {
    for (const change of [
      {},
      { id: 8891417, height: 80, bend: 12, baseRadius: 8, sCurve: true },
      { height: 160, bend: 56, baseRadius: 11.2, leanDegrees: 65 },
    ]) {
      const parameters = { ...longTipWitness, ...change };
      const main = instantiateThorn(parameters, tipEnvironment).sweeps[0];
      // The landmark flag leaves these authored cubics exact and selects the
      // retained proportional profile. It is a shape reference, not placement.
      const proportional = instantiateThorn(
        { ...parameters, landmark: true },
        tipEnvironment,
      ).sweeps[0];
      if (!main || !proportional) throw new Error("Missing profile reference");
      expect(main.spine).toEqual(proportional.spine);
      expect(main.profileExponent).toBe(proportional.profileExponent);
      expect(main.radii).toHaveLength(257);
      expect(main.radii.slice(0, 232)).toEqual(
        proportional.radii.slice(0, 232),
      );
      let changed = 0;
      for (let i = 232; i < 257; i++) {
        expect(Number(main.radii[i])).toBeGreaterThanOrEqual(
          Number(proportional.radii[i]),
        );
        expect(Number(main.radii[i])).toBeLessThan(Number(main.radii[i - 1]));
        if (main.radii[i] !== proportional.radii[i]) changed++;
      }
      expect(changed).toBeGreaterThan(0);
      expect(main.thinTipLength).toBeLessThanOrEqual(1.5 + 1e-9);
      expect(
        sweepRadius(main, 1 - 1.5 / main.spine.length),
      ).toBeGreaterThanOrEqual(0.7);
      expect(sweepRadius(main, 1)).toBe(0.45);
    }
  });

  it("never exceeds the published witness profile and retains its exact terminal stations", () => {
    const main = instantiateThorn(longTipWitness, tipEnvironment).sweeps[0];
    // Published closeup case.json freezes this stronger-table exponent. Using
    // the excluded family selects it unchanged, independently of the splice.
    const published = instantiateThorn(
      { ...longTipWitness, landmark: true, exponent: 0.8049466229794777 },
      tipEnvironment,
    ).sweeps[0];
    if (!main || !published) throw new Error("Missing published tip reference");
    expect(main.spine).toEqual(published.spine);
    const firstTerminalStation = Math.floor(
      (1 - 1.5 / main.spine.length) * 256,
    );
    expect(main.radii.slice(firstTerminalStation)).toEqual(
      published.radii.slice(firstTerminalStation),
    );
    for (let i = 0; i < 257; i++)
      expect(Number(main.radii[i])).toBeLessThanOrEqual(
        Number(published.radii[i]),
      );
    expect(Number(main.radii[128])).toBeLessThan(Number(published.radii[128]));
    expect(main.thinTipLength).toBe(published.thinTipLength);
  });

  it("caps the actual interpolated tail at 1.5 m across ordinary main shapes without clipping", () => {
    for (const change of [
      {},
      { id: 8891417, height: 80, bend: 12, baseRadius: 8, sCurve: true },
      {
        id: 8891420,
        height: 64,
        bend: 6,
        baseRadius: 6,
        hooked: true,
        branchCount: 2,
      },
    ]) {
      const parameters = { ...longTipWitness, ...change };
      const snapshot = JSON.stringify(parameters);
      const thorn = instantiateThorn(parameters, tipEnvironment);
      const main = thorn.sweeps[0];
      if (!main) throw new Error("Missing main sweep");
      expect(thorn.parameters).toBe(parameters);
      expect(JSON.stringify(parameters)).toBe(snapshot);
      expect(main.thinTipLength).toBeLessThanOrEqual(1.5 + 1e-9);
      expect(
        sweepRadius(main, 1 - 1.5 / main.spine.length),
      ).toBeGreaterThanOrEqual(0.7);
      expect(sweepRadius(main, 0)).toBe(parameters.baseRadius);
      expect(sweepRadius(main, 1)).toBe(0.45);
      guards(thorn);
    }
    const main = instantiateThorn(longTipWitness, tipEnvironment).sweeps[0];
    if (!main) throw new Error("Missing witness main sweep");
    // Frozen pre-correction spine: every position, frame and length.
    expect(shapeHash(main.spine)).toBe(
      "80db07eebed5e92ec8c1b845db23487687b9bc0b727a5274d2f15f360cbdf8d6",
    );
  });

  it("preserves excluded whole features and independent branch/debris/rubble data", () => {
    const cases: readonly [Partial<ThornParameters>, string][] = [
      [
        { landmark: true },
        "7a33803de131713eff3c3669acc2bb79e4a58bd061080b83659c3a952b03eb1d",
      ],
      [
        { broken: true },
        "ab4c5182e3c0a9a3a780b78fcdcce14447884c0a43dbdbbeb824d3235c899e93",
      ],
      [
        { landmark: true, arch: true },
        "769cd16ae396076098ac56e6f7156c2fb8828b05f03f7908b923079ef0e2c702",
      ],
    ];
    for (const [change, beforeHash] of cases)
      expect(
        shapeHash(
          instantiateThorn({ ...longTipWitness, ...change }, tipEnvironment),
        ),
      ).toBe(beforeHash);
    const branched = instantiateThorn(
      { ...longTipWitness, branchCount: 2 },
      tipEnvironment,
    );
    expect(
      shapeHash({
        sweeps: branched.sweeps.slice(1),
        debris: branched.debris,
        rubble: branched.rubble,
      }),
    ).toBe("d17922e6d3bd3f8de8f5d512be4e28a93dbbad0777b1c9bc58d7389b7c706284");
    // Exact branch objects do not guarantee unchanged exposure at their union
    // with a changed main. The native image review owns that separate check.
  });

  it("shortens the saved seven-voxel terminal stair chain without disconnecting it", () => {
    const main = instantiateThorn(longTipWitness, tipEnvironment).sweeps[0];
    if (!main) throw new Error("Missing witness main sweep");
    const work = createIbaraWorkspace();
    const key = (x: number, y: number, z: number): string => `${x},${y},${z}`;
    type Cell = { x: number; y: number; z: number };
    const cells = new Map<string, boolean>(),
      occupied = new Map<string, Cell>();
    // Identical fixed box to the inspected production receipt. Before:
    // 45 occupied voxels; endpoint chain seven voxels/six face steps.
    for (let z = 1451; z <= 1458; z++)
      for (let x = 8637; x <= 8649; x++)
        for (let y = 136; y <= 153; y++) {
          const solid =
            sampleThornSweep(main, x + 0.5, y + 0.5, z + 0.5, 0, work) < 0;
          cells.set(key(x, y, z), solid);
          if (solid) occupied.set(key(x, y, z), { x, y, z });
        }
    expect(cells.size).toBe(1872);
    const faces = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ] as const;
    const adjacent = (cellKey: string): string[] => {
      const cell = occupied.get(cellKey);
      if (!cell) throw new Error("Missing occupied cell");
      return faces.map(([dx, dy, dz]) =>
        key(cell.x + dx, cell.y + dy, cell.z + dz),
      );
    };
    const tip = key(8640, 150, 1455);
    expect(occupied.has(tip)).toBe(true);
    expect(adjacent(tip).filter((k) => occupied.has(k))).toHaveLength(1);
    const thin = new Set(
      [...occupied.keys()].filter(
        (k) =>
          adjacent(k).every((n) => cells.has(n)) &&
          adjacent(k).filter((n) => occupied.has(n)).length <= 2,
      ),
    );
    const connected = (allowed: ReadonlySet<string>): Set<string> => {
      const seen = new Set<string>();
      const queue = allowed.has(tip) ? [tip] : [];
      if (queue.length) seen.add(tip);
      for (let i = 0; i < queue.length; i++)
        for (const neighbour of adjacent(queue[i] as string))
          if (allowed.has(neighbour) && !seen.has(neighbour)) {
            seen.add(neighbour);
            queue.push(neighbour);
          }
      return seen;
    };
    const terminalChain = connected(thin);
    expect(terminalChain.size).toBeGreaterThan(0);
    expect(terminalChain.size).toBeLessThanOrEqual(4);
    expect(connected(new Set(occupied.keys())).size).toBe(occupied.size);
    // Count sideways stair turns, not just vertical runs.
    expect(
      new Set([...terminalChain].map((k) => occupied.get(k)?.x)).size,
    ).toBeGreaterThan(1);
  });
});
