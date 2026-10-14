import { describe, expect, it } from "vitest";
import {
  IBARA_ORDINARY_BASE_REACH,
  ibaraNormalInclinationFloor,
  thornFeatureId,
} from "../src/features/ibara/cells.js";
import {
  certifyIbaraIncomingRadius,
  createIbaraNeighbourContrast,
  IBARA_CONTRAST_RADIUS,
  type IbaraContrastPoint,
  ibaraParametersDifferent,
} from "../src/features/ibara/neighbour-contrast.js";
import { hash2, hash5, rand01 } from "../src/math/hash.js";

const point = (
  id: number,
  x: number,
  z: number,
  leanDegrees = 20,
  height = 20,
): IbaraContrastPoint =>
  Object.freeze({
    id,
    base: Object.freeze([x, 0, z] as const),
    height,
    leanDegrees,
    bend: height * 0.1,
    landmark: false,
  });
const witnesses = [
  point(10, -10, -10, 20, 100),
  point(11, -10, 10, 20, 100),
  point(12, 10, -10, 20, 100),
  point(13, 10, 10, 20, 100),
];
function engine(points: readonly IbaraContrastPoint[], capacity = 4096) {
  return createIbaraNeighbourContrast(
    (x, z, radius) =>
      points.filter((p) => {
        const dx = p.base[0] - x,
          dz = p.base[2] - z;
        return dx * dx + dz * dz <= radius * radius;
      }),
    capacity,
  );
}
function nearest(
  p: IbaraContrastPoint,
  points: readonly IbaraContrastPoint[],
): IbaraContrastPoint {
  const sorted = points
    .filter((q) => q.id !== p.id && !q.landmark)
    .map((q) => ({
      q,
      d: (q.base[0] - p.base[0]) ** 2 + (q.base[2] - p.base[2]) ** 2,
    }))
    .sort((a, b) => a.d - b.d || a.q.id - b.q.id);
  const found = sorted[0]?.q;
  if (!found) throw new Error("Missing synthetic neighbour");
  return found;
}

describe("certified inclination-only neighbour contrast", () => {
  it("reconstructs only the original salted small-blade category across the packed identity domain", () => {
    let blades = 0,
      nonBlades = 0,
      broken = 0;
    for (const seed of [1, 2, 3])
      for (const x of [-128, -1, 0, 127])
        for (const z of [-128, -1, 0, 127])
          for (const cluster of [0, 1, 2])
            for (const index of [0, 17, 38, 63]) {
              const salt = hash5(seed, x, z, cluster, index),
                isBroken = rand01(hash2(salt, 10)) < 0.12,
                chosen = rand01(hash2(salt, 23)) < 0.4;
              for (const height of [12, 29.999, 30, 60]) {
                const p = {
                  id: thornFeatureId(x, z, cluster, index),
                  height,
                  landmark: false,
                };
                const expected = height < 30 && !isBroken && chosen ? 18 : 5;
                expect(ibaraNormalInclinationFloor(seed, p)).toBe(expected);
                if (expected === 18) blades++;
                else nonBlades++;
                broken += Number(isBroken);
                expect(
                  ibaraNormalInclinationFloor(seed, {
                    ...p,
                    id: thornFeatureId(x, z, cluster, index, true),
                    landmark: true,
                  }),
                ).toBe(5);
              }
            }
    expect(blades).toBeGreaterThan(0);
    expect(nonBlades).toBeGreaterThan(blades);
    expect(broken).toBeGreaterThan(0);
  });

  it("retains the authored blade floor for seed2 feature11834151 and selects the legal outward move", () => {
    // Exact saved original operands: pair, every true incoming, the four best
    // sector witnesses, and their nearest-neighbour closure. No plan or bake.
    const rows = [
      [
        11834116, 3675.0462272102254, 10065.291646660171, 13.700362273145348,
        30.956381505917005, 3.0361794806403313,
      ],
      [
        11834124, 3664.1289799359015, 10146.52825794382, 12.983446039695112,
        5.009578326248719, 4.353834273653329,
      ],
      [
        11834131, 3660.4565892241303, 10147.641180147508, 15.694765757220502,
        30.59993678338808, 5.1286390533042585,
      ],
      [
        11834135, 3749.368500862312, 10127.100458757455, 39.046972169149235,
        24.132380793060484, 8.047196079030092,
      ],
      [
        11834138, 3676.9400700416363, 10155.863486762266, 14.916547053966795,
        18.159070312995016, 5.076473775280313,
      ],
      [
        11834143, 3728.9145204173583, 10089.81623302126, 15.47434602705794,
        18.148276591438282, 5.099799231936011,
      ],
      [
        11834147, 3656.445292137181, 10059.038220954084, 19.959485195473267,
        12.400208718629512, 2.0156050237892087,
      ],
      [
        11834151, 3712.29443801984, 10119.457414217155, 19.06963360178731,
        18.073205745134352, 4.128334462136057,
      ],
    ] as const;
    const points = rows.map(([id, x, z, height, leanDegrees, bend]) => ({
      id,
      base: [x, 0, z] as const,
      height,
      leanDegrees,
      bend,
      landmark: false,
    }));
    const run = (reverse: boolean, capacity: number) => {
      const ordered = reverse ? points.slice().reverse() : points;
      const contrast = createIbaraNeighbourContrast(
        (x, z, radius) =>
          ordered.filter(
            (p) => (p.base[0] - x) ** 2 + (p.base[2] - z) ** 2 <= radius ** 2,
          ),
        capacity,
        (p) => ibaraNormalInclinationFloor(2, p),
      );
      const result = ordered.flatMap((p) => contrast.apply([p]).parameters);
      return result.sort((a, b) => a.id - b.id);
    };
    const result = run(false, 4096),
      byId = new Map<number, IbaraContrastPoint>(result.map((p) => [p.id, p]));
    expect(run(true, 1)).toEqual(result);
    expect(byId.get(11834151)?.leanDegrees).toBe(26.14827759143828);
    expect(byId.get(11834143)?.leanDegrees).toBe(18.148276591438282);
    expect(byId.get(11834135)).toEqual(points.find((p) => p.id === 11834135));
    for (const p of points) {
      const q = nearest(p, points),
        a = byId.get(p.id),
        b = byId.get(q.id);
      if (!a || !b) throw new Error("Lost point");
      expect({ ...a, leanDegrees: p.leanDegrees }).toEqual(p);
      if (ibaraParametersDifferent(p, q))
        expect(ibaraParametersDifferent(a, b)).toBe(true);
    }
  });

  it("preserves the 5deg domain for other categories instead of imposing a blanket blade floor", () => {
    const points = [
      point(1, -0.5, 0, 5.1),
      point(2, 0.5, 0, 5.2),
      ...witnesses,
    ];
    const normal = engine(points).apply(points);
    expect(Math.min(...normal.parameters.map((p) => p.leanDegrees))).toBe(5.1);
    expect(normal.parameters.some((p) => p.leanDegrees < 18)).toBe(true);
  });

  it("makes a minimal legal change on one original mutual endpoint and preserves every previously passing edge", () => {
    const points = [point(1, -0.5, 0), point(2, 0.5, 0), ...witnesses];
    const before = JSON.stringify(points),
      result = engine(points).apply(points);
    expect(result.diagnostics).toMatchObject({
      candidatePairs: 1,
      adjustedPairs: 1,
      changedInstances: 1,
    });
    expect(
      Math.abs(Number(result.parameters[0]?.leanDegrees) - 20),
    ).toBeCloseTo(8.000001, 12);
    expect(result.parameters[1]).toBe(points[1]);
    expect(JSON.stringify(points)).toBe(before);
    const byId = new Map(result.parameters.map((p) => [p.id, p]));
    for (const p of points) {
      const q = nearest(p, points),
        changed = byId.get(p.id),
        other = byId.get(q.id);
      if (!changed || !other) throw new Error("Lost point");
      expect({ ...changed, leanDegrees: p.leanDegrees }).toEqual(p);
      if (ibaraParametersDifferent(p, q))
        expect(ibaraParametersDifferent(changed, other)).toBe(true);
    }
  });

  it("certifies incoming completeness from four sectors with a metre of slack, not observed distance maxima", () => {
    expect(IBARA_ORDINARY_BASE_REACH).toBeGreaterThan(22 * Math.sqrt(40));
    const p = point(1, 0, 0);
    const enclosing = [
      point(2, 150, 73),
      point(3, -150, 73),
      point(4, 150, -73),
      point(5, -150, -73),
    ];
    const radius = certifyIbaraIncomingRadius(p, enclosing);
    expect(radius).toBeCloseTo((150 * 150 + 73 * 73) / (2 * 73), 12);
    expect(radius).toBeLessThanOrEqual(IBARA_CONTRAST_RADIUS - 1);
    expect(
      certifyIbaraIncomingRadius(p, [
        point(2, 150, 72),
        point(3, -150, 72),
        point(4, 150, -72),
        point(5, -150, -72),
      ]),
    ).toBeNull();
    expect(certifyIbaraIncomingRadius(p, enclosing.slice(0, 3))).toBeNull();
    for (let i = 0; i < 64; i++) {
      const angle = (i * Math.PI) / 32,
        x = 192 * Math.cos(angle),
        z = 192 * Math.sin(angle);
      expect(
        enclosing.some(
          (q) => (x - q.base[0]) ** 2 + (z - q.base[2]) ** 2 < 192 * 192,
        ),
      ).toBe(true);
    }
  });

  it("runs a complete nearest search at both endpoints instead of inventing a mutual pair at a query edge", () => {
    const points = [point(1, 0, 0), point(2, 190, 0), point(3, 200, 0)];
    const queried: number[] = [];
    const contrast = createIbaraNeighbourContrast((x, z, radius) => {
      queried.push(x);
      return points.filter(
        (p) => (p.base[0] - x) ** 2 + (p.base[2] - z) ** 2 <= radius * radius,
      );
    });
    expect(contrast.decision(points[0] as IbaraContrastPoint).status).toBe(
      "unchanged",
    );
    expect(queried).toContain(190);
    expect(
      contrast.apply([points[0] as IbaraContrastPoint]).parameters,
    ).toEqual([points[0]]);
  });

  it("retains uncertified sparse pairs and missing-nearest cases instead of discarding a feature", () => {
    const points = [point(1, 0, 0), point(2, 1, 0), point(3, 1000, 0)];
    const result = engine(points).apply(points);
    expect(result.parameters).toEqual(points);
    expect(result.diagnostics).toMatchObject({
      candidatePairs: 1,
      uncertifiedPairs: 1,
      uncertifiedNearestInstances: 1,
      changedInstances: 0,
    });
  });

  it("uses an incoming candidate's own complete extent, including points outside the repaired endpoint's disk", () => {
    const points = [
      point(1, -0.5, 0),
      point(2, 0.5, 0),
      point(3, 180, 0, 5),
      point(4, 200, 0, 5),
      point(10, 150, 75, 20, 100),
      point(11, -150, 75, 20, 100),
      point(12, 150, -75, 20, 100),
      point(13, -150, -75, 20, 100),
    ];
    const queries: { x: number; ids: number[] }[] = [];
    const contrast = createIbaraNeighbourContrast((x, z, radius) => {
      const found = points.filter(
        (p) => (p.base[0] - x) ** 2 + (p.base[2] - z) ** 2 <= radius * radius,
      );
      queries.push({ x, ids: found.map((p) => p.id) });
      return found;
    });
    expect(
      certifyIbaraIncomingRadius(points[0] as IbaraContrastPoint, points),
    ).not.toBeNull();
    contrast.decision(points[0] as IbaraContrastPoint);
    expect(queries.find((query) => query.x === 180)?.ids).toContain(4);
    expect(queries.find((query) => query.x === -0.5)?.ids).not.toContain(4);
  });

  it("retains a certified pair when every legal angle would break a previously passing incoming edge", () => {
    const points = [
      point(1, -0.5, 0),
      point(2, 0.5, 0),
      point(3, -2, 0, 5),
      point(4, -0.5, 2, 35),
      point(5, 2, 0, 5),
      point(6, 0.5, -2, 35),
      ...witnesses,
    ];
    const result = engine(points).apply(points);
    expect(result.parameters).toEqual(points);
    expect(result.diagnostics).toMatchObject({
      candidatePairs: 1,
      noLegalAdjustmentPairs: 1,
      changedInstances: 0,
    });
  });

  it("protects outlier inclinations and every landmark", () => {
    const points = [
      point(1, -0.5, 0, 48),
      point(2, 0.5, 0, 50),
      ...witnesses,
      { ...point(20, 0, 0), landmark: true },
    ];
    const result = engine(points).apply(points);
    expect(result.parameters).toEqual(points);
    expect(result.diagnostics).toMatchObject({
      protectedInclinationPairs: 1,
      changedInstances: 0,
    });
  });

  it("is identical under reversed queries, small caches, cell partitions and negative-coordinate translation", () => {
    const points = [point(1, -0.5, 0), point(2, 0.5, 0), ...witnesses].map(
      (p) => ({ ...p, base: [p.base[0] - 192, 0, p.base[2] - 192] as const }),
    );
    const expected = engine(points).apply(points);
    const reversed = engine(points.slice().reverse(), 1);
    const actual = points
      .slice()
      .reverse()
      .flatMap((p) => reversed.apply([p]).parameters)
      .reverse();
    expect(actual).toEqual(expected.parameters);
    expect(reversed.cachedNearestCount).toBeLessThanOrEqual(1);
    expect(reversed.cachedDecisionCount).toBeLessThanOrEqual(1);
    const partitioned = engine(points, 2);
    const a = partitioned.apply(points.filter((p) => p.base[0] < -192));
    const b = partitioned.apply(points.filter((p) => p.base[0] >= -192));
    expect(a.diagnostics.candidatePairs + b.diagnostics.candidatePairs).toBe(1);
    expect(a.diagnostics.adjustedPairs + b.diagnostics.adjustedPairs).toBe(1);
    expect(
      a.diagnostics.changedInstances + b.diagnostics.changedInstances,
    ).toBe(1);
    expect(
      [...a.parameters, ...b.parameters].sort((x, y) => x.id - y.id),
    ).toEqual(expected.parameters);
  });
});
