import { describe, expect, it } from "vitest";
import { detSinCos } from "../src/math/det.js";
import {
  repeatHex,
  smoothIntersection,
  smoothSubtraction,
  smoothUnion,
} from "../src/sdf/ops.js";
import { polygonNormals, polygonSection } from "../src/sdf/polygon.js";
import {
  sdBox,
  sdCapsule,
  sdCylinder,
  sdEllipsoid,
  sdHexPrism,
  sdPlane,
  sdRoundCone,
  sdSphere,
  sdTorus,
} from "../src/sdf/primitives.js";
import {
  closestSpine,
  createSpineSample,
  flattenBezier,
  sampleSpine,
} from "../src/sdf/spine.js";
import type { CubicBezier } from "../src/sdf/types.js";

describe("deterministic SDF geometry", () => {
  it("classifies independently chosen analytic primitive surfaces and interiors", () => {
    expect(sdSphere(0, 0, 0, 2)).toBe(-2);
    expect(sdSphere(0, 3, 4, 5)).toBe(0);
    expect(sdBox(4, 6, 0, 1, 2, 3)).toBe(5);
    expect(sdEllipsoid(0, 0, 0, 2, 3, 4)).toBe(-2);
    expect(sdEllipsoid(0, 3, 0, 2, 3, 4)).toBe(0);
    expect(sdCapsule(2, 5, 0, [0, 0, 0], [0, 10, 0], 2)).toBe(0);
    expect(sdRoundCone(0, -2, 0, [0, 0, 0], [0, 10, 0], 2, 1)).toBe(0);
    expect(sdRoundCone(0, 11, 0, [0, 0, 0], [0, 10, 0], 2, 1)).toBe(0);
    expect(sdCylinder(3, 0, 4, 5, 2)).toBe(0);
    expect(sdTorus(7, 0, 0, 5, 2)).toBe(0);
    expect(sdHexPrism(3, 0, 0, 3, 2)).toBe(0);
    expect(sdPlane(0, 5, 0, [0, 2, 0], 5)).toBe(0);
  });
  it("round cone agrees with an independent dense sphere-envelope oracle", () => {
    for (const point of [
      [2, 3, 0],
      [1, 10, 1],
      [4, 7, 2],
      [0, 4, 0],
    ]) {
      let brute = Infinity;
      for (let i = 0; i <= 1000; i++) {
        const u = i / 1000,
          x = point[0] as number,
          y = (point[1] as number) - 10 * u,
          z = point[2] as number;
        brute = Math.min(brute, Math.sqrt(x * x + y * y + z * z) - (3 - 2 * u));
      }
      expect(
        sdRoundCone(
          point[0] as number,
          point[1] as number,
          point[2] as number,
          [0, 0, 0],
          [0, 10, 0],
          3,
          1,
        ),
      ).toBeCloseTo(brute, 4);
    }
  });
  it("smooth operators use the correct density sign and bounded support", () => {
    expect(smoothUnion(0, 0, 4)).toBe(-1);
    expect(smoothIntersection(0, 0, 4)).toBe(1);
    expect(smoothUnion(1, 10, 4)).toBe(1);
    expect(smoothSubtraction(-2, -4, 0)).toBe(4);
    const out = repeatHex(-100, -100, 3, new Float64Array(4));
    expect(
      Math.sqrt(
        Number(out[0]) * Number(out[0]) + Number(out[1]) * Number(out[1]),
      ),
    ).toBeLessThanOrEqual(3);
  });
  it("polygon apothem and circle blending do not require inverse trigonometry", () => {
    const square = polygonNormals(4);
    expect(polygonSection(3, 0, 3, square, 1)).toBeCloseTo(0, 12);
    expect(polygonSection(3, 3, 3, square, 1)).toBeCloseTo(0, 12);
    expect(polygonSection(3, 3, 3, square, 0)).toBeCloseTo(
      Math.sqrt(18) - 3,
      12,
    );
  });
});
describe("arc-length Beziers and rotation-minimising frames", () => {
  const curve: CubicBezier = [
    [0, 0, 0],
    [25, 20, 10],
    [-25, 55, 20],
    [10, 90, 0],
  ];
  it("spends a bounded adaptive budget and certifies actual joints", () => {
    const spine = flattenBezier(curve);
    expect(spine.capped).toBe(false);
    expect(spine.segments).toBeLessThanOrEqual(24);
    expect(spine.maxChordError).toBeLessThanOrEqual(0.5);
    expect(spine.minimumJointDot).toBeGreaterThanOrEqual(
      Math.cos((12 * Math.PI) / 180) - 1e-10,
    );
    const lowBudget = flattenBezier(curve, { maxSegments: 2 });
    expect(lowBudget.capped).toBe(true);
  });
  it("keeps the entire exact Bezier within half a metre of its polyline", () => {
    const spine = flattenBezier(curve),
      out = createSpineSample();
    for (let i = 0; i <= 1000; i++) {
      const t = i / 1000,
        a = (1 - t) * (1 - t) * (1 - t),
        b = 3 * (1 - t) * (1 - t) * t,
        c = 3 * (1 - t) * t * t,
        d = t * t * t;
      const x =
        a * curve[0][0] + b * curve[1][0] + c * curve[2][0] + d * curve[3][0];
      const y =
        a * curve[0][1] + b * curve[1][1] + c * curve[2][1] + d * curve[3][1];
      const z =
        a * curve[0][2] + b * curve[1][2] + c * curve[2][2] + d * curve[3][2];
      closestSpine(spine, x, y, z, out);
      expect(out.distance).toBeLessThanOrEqual(0.50000001);
    }
  });
  it("samples normalized arc length, not Bezier parameter, and interpolates orthonormal frames", () => {
    const line = flattenBezier([
      [0, 0, 0],
      [0, 1, 0],
      [0, 2, 0],
      [0, 100, 0],
    ]);
    const out = createSpineSample();
    sampleSpine(line, 0.5, out);
    expect(out.y).toBeCloseTo(50, 10);
    const spine = flattenBezier(curve);
    for (let i = 0; i <= 100; i++) {
      sampleSpine(spine, i / 100, out);
      expect(out.tx * out.nx + out.ty * out.ny + out.tz * out.nz).toBeCloseTo(
        0,
        12,
      );
      expect(out.nx * out.nx + out.ny * out.ny + out.nz * out.nz).toBeCloseTo(
        1,
        12,
      );
      expect(out.bx * out.bx + out.by * out.by + out.bz * out.bz).toBeCloseTo(
        1,
        12,
      );
    }
  });
  it("transports a planar normal unchanged through an inflection", () => {
    const spine = flattenBezier(
      [
        [0, 0, 0],
        [20, 20, 0],
        [-20, 40, 0],
        [0, 60, 0],
      ],
      { initialNormal: [0, 0, 1] },
    );
    for (let i = 0; i <= spine.segments; i++) {
      expect(Number(spine.normals[i * 3])).toBeCloseTo(0, 12);
      expect(Number(spine.normals[i * 3 + 1])).toBeCloseTo(0, 12);
      expect(Number(spine.normals[i * 3 + 2])).toBeCloseTo(1, 12);
    }
    const trig = detSinCos(Math.PI, new Float64Array(2));
    expect(Number(trig[1])).toBeCloseTo(-1, 12);
  });
});
