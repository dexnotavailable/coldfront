import { describe, expect, it } from "vitest";
import {
  detExp,
  detExp2,
  detLog,
  detLog2,
  detPow,
  detSinCos,
} from "../src/math/det.js";
import { hash2, hash3, hash4, hash5, rand01 } from "../src/math/hash.js";
import {
  cellIndex,
  localCoordinate,
  packChunkKey,
  sampleCenter,
  unpackChunkKey,
  worldToChunk,
} from "../src/world/coordinates.js";

describe("deterministic transcendental replacements", () => {
  it("measures broad power/log/exp domains against independent native references", () => {
    let maxPowRelative = 0;
    let maxLogAbsolute = 0;
    let maxExpRelative = 0;
    for (let i = 0; i < 100_000; i++) {
      const base = 2 ** (-64 + 128 * rand01(hash2(123, i)));
      const power = -16 + 32 * rand01(hash2(456, i));
      const expected = base ** power;
      if (expected >= 2.2250738585072014e-308 && Number.isFinite(expected))
        maxPowRelative = Math.max(
          maxPowRelative,
          Math.abs(detPow(base, power) / expected - 1),
        );
      maxLogAbsolute = Math.max(
        maxLogAbsolute,
        Math.abs(detLog(base) - Math.log(base)),
      );
      const x = -700 + 1400 * rand01(hash2(789, i));
      maxExpRelative = Math.max(
        maxExpRelative,
        Math.abs(detExp(x) / Math.exp(x) - 1),
      );
    }
    console.info({
      maxPowRelative,
      maxLogAbsolute,
      maxExpRelative,
      samples: 100_000,
    });
    expect(maxPowRelative).toBeLessThanOrEqual(1e-7);
    expect(maxLogAbsolute).toBeLessThan(3e-14);
    expect(maxExpRelative).toBeLessThan(2e-13);
  });
  it("covers exact powers, special values, normal/subnormal and overflow boundaries", () => {
    for (let e = -1074; e <= 1023; e++) {
      expect(detExp2(e)).toBe(2 ** e);
      expect(detLog2(2 ** e)).toBe(e);
    }
    for (const x of [
      -1075, -1074.99, -1074.9, -1074.5, -1074.01, -1074, -1022.5, 1023.5,
      1023.999999999, 1024,
    ]) {
      const reference = 2 ** x;
      if (reference < 2.2250738585072014e-308 || !Number.isFinite(reference))
        expect(detExp2(x)).toBe(reference);
      else expect(Math.abs(detExp2(x) / reference - 1)).toBeLessThan(1e-14);
    }
    for (const base of [NaN, -Infinity, -10, -1, -0, 0, 0.1, 1, 10, Infinity]) {
      for (const exponent of [
        NaN,
        -Infinity,
        -3,
        -2,
        -0.5,
        -0,
        0,
        0.5,
        2,
        3,
        Infinity,
      ]) {
        const ref = base ** exponent;
        const value = detPow(base, exponent);
        if (!Number.isFinite(ref) || ref === 0)
          expect(Object.is(value, ref)).toBe(true);
        else expect(Math.abs(value / ref - 1)).toBeLessThan(1e-12);
      }
    }
    expect(detLog(-1)).toBeNaN();
    expect(detLog(0)).toBe(-Infinity);
    expect(detLog(Infinity)).toBe(Infinity);
    expect(detExp(-Infinity)).toBe(0);
    expect(detExp(Infinity)).toBe(Infinity);
  });
  it("measures trig on signed bearings and the full documented reduction domain", () => {
    const result = new Float64Array(2);
    let maximum = 0;
    for (let i = 0; i < 50_000; i++) {
      const x =
        i < 100
          ? ((i - 50) * Math.PI) / 4
          : (2 * rand01(hash2(34, i)) - 1) * 1_048_576;
      detSinCos(x, result);
      maximum = Math.max(
        maximum,
        Math.abs((result[0] as number) - Math.sin(x)),
        Math.abs((result[1] as number) - Math.cos(x)),
      );
      expect(
        Math.abs(
          (result[0] as number) * (result[0] as number) +
            (result[1] as number) * (result[1] as number) -
            1,
        ),
      ).toBeLessThan(3e-15);
    }
    console.info({ maxSinCosAbsolute: maximum, samples: 50_000 });
    expect(maximum).toBeLessThan(1e-10);
    expect(() => detSinCos(Infinity, result)).toThrow(RangeError);
    expect(() => detSinCos(1_048_577, result)).toThrow(RangeError);
  });
});

describe("integer hashing and coordinates", () => {
  it("has fixed arity, signed-word determinism, avalanche and a half-open random interval", () => {
    expect([hash2.length, hash3.length, hash4.length, hash5.length]).toEqual([
      2, 3, 4, 5,
    ]);
    expect(hash5(1, -1, 2, -3, 4)).toBe(hash5(1, 0xffffffff, 2, 0xfffffffd, 4));
    const distinct = new Set<number>();
    let mean = 0;
    for (let i = 0; i < 10_000; i++) {
      const h = hash4(1, i, -i, 99);
      distinct.add(h);
      mean += rand01(h);
    }
    expect(distinct.size).toBeGreaterThan(9998);
    expect(mean / 10_000).toBeCloseTo(0.5, 2);
    expect(rand01(0)).toBe(0);
    expect(rand01(0xffffffff)).toBe(1 - 1 / 4294967296);
    expect(hash3(2, 9, 7)).not.toBe(hash3(2, 7, 9));
  });
  it("floors negative cells and reconstructs boundary coordinates", () => {
    for (const size of [0.25, 1, 2, 3, 32, 64]) {
      for (const position of [
        -22528, -64.5, -64, -32.001, -32, -0.1, -0, 0, 0.1, 31.999, 32, 22527.5,
      ]) {
        const cell = cellIndex(position, size);
        const local = localCoordinate(position, size);
        expect(local).toBeGreaterThanOrEqual(0);
        expect(local).toBeLessThan(size);
        expect(cell * size + local).toBeCloseTo(position, 10);
      }
    }
    expect(worldToChunk(-0.1)).toBe(-1);
    expect(worldToChunk(-32)).toBe(-1);
    expect(worldToChunk(-32.01)).toBe(-2);
    expect(Object.is(localCoordinate(-32, 32), -0)).toBe(false);
    expect(localCoordinate(-Number.MIN_VALUE, 32)).toBeLessThan(32);
    expect(localCoordinate(-1e-20, 32)).toBeGreaterThan(31.99999999999999);
    expect(sampleCenter(-1, 31)).toBe(-0.5);
    expect(sampleCenter(-1, 32)).toBe(sampleCenter(0, 0));
    expect(sampleCenter(0, 1, 1)).toBe(sampleCenter(0, 0, 3));
    expect(() => cellIndex(1, 0)).toThrow();
    expect(() => sampleCenter(1.5, 0)).toThrow();
    expect(() => sampleCenter(Number.MAX_SAFE_INTEGER, 0)).toThrow();
  });
  it("packs bounded chunk keys without collisions and rejects invalid addresses", () => {
    const keys = new Set<number>();
    for (const lod of [0, 1] as const) {
      const scale = lod === 0 ? 1 : 2;
      for (const cx of [-704 / scale, -1, 0, 704 / scale - 1]) {
        for (const cy of [-48 / scale, -1, 0, 32 / scale - 1]) {
          for (const cz of [-704 / scale, -1, 0, 704 / scale - 1]) {
            const key = packChunkKey(cx, cy, cz, lod);
            expect(keys.has(key)).toBe(false);
            keys.add(key);
            expect(unpackChunkKey(key)).toEqual({ cx, cy, cz, lod });
          }
        }
      }
    }
    expect(() => packChunkKey(704, 0, 0, 0)).toThrow();
    expect(() => unpackChunkKey(1e20)).toThrow();
    expect(() => unpackChunkKey(-1)).toThrow();
  });
});
