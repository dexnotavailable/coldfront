import { describe, expect, it } from "vitest";
import {
  channel,
  createLightVolume,
  emissionLight,
  type LightVolume,
  lightIndex,
  relightEdits,
  solveLight,
} from "../src/lighting/flood.js";

function expectFresh(v: LightVolume): void {
  const fresh = createLightVolume(v.width, v.height, v.depth);
  fresh.opacity.set(v.opacity);
  fresh.sources.set(v.sources);
  solveLight(fresh);
  expect(v.light).toEqual(fresh.light);
}

describe("Voxelize light frontier port", () => {
  it("packs RGB below sky and propagates opaque emitters across a chunk boundary", () => {
    const v = createLightVolume(38, 7, 7),
      a = lightIndex(v, 31, 3, 3),
      b = lightIndex(v, 35, 3, 3),
      across = lightIndex(v, 33, 3, 3);
    expect(emissionLight([15, 7, 2])).toBe(0x0f72);
    v.opacity[a] = 15;
    v.sources[a] = emissionLight([15, 7, 2]);
    solveLight(v);
    expect(v.light[a]).toBe(0x0f72);
    expect(v.light[across]).toBe(0x0d50);
    v.opacity[b] = 15;
    v.sources[b] = emissionLight([6, 15, 9]);
    relightEdits(v, [b]);
    expectFresh(v);
    expect(v.light[across]).toBe(0x0dd7);
    v.opacity[a] = 0;
    v.sources[a] = 0;
    relightEdits(v, [a]);
    expectFresh(v);
    expect(v.light[across]).toBe(0x04d7);
    v.opacity[b] = 0;
    v.sources[b] = 0;
    relightEdits(v, [b]);
    expectFresh(v);
    expect(v.light.every((word) => word === 0)).toBe(true);
  });
  it("matches fresh light after simultaneous source, filtering and roof edits at volume edges", () => {
    const v = createLightVolume(8, 9, 6);
    for (let z = 0; z < v.depth; z++)
      for (let x = 0; x < v.width; x++)
        v.sources[lightIndex(v, x, v.height - 1, z)] = 0xf000;
    solveLight(v);
    const locations = [
      [0, 4, 0],
      [7, 4, 5],
      [3, 4, 2],
      [4, 4, 2],
      [3, 8, 2],
      [4, 0, 2],
      [0, 8, 5],
      [7, 0, 0],
    ] as const;
    for (let round = 0; round < 4; round++) {
      const changed: number[] = [];
      for (let n = 0; n < locations.length; n++) {
        const [x, y, z] = locations[n] as (typeof locations)[number];
        const i = lightIndex(v, x, y, z),
          opaque = round === 0 || (round === 2 && n % 2 === 0);
        v.opacity[i] = opaque ? 15 : round === 1 ? 2 : 0;
        const rgb = round < 2 ? emissionLight([15 - n, n + 2, 9]) : 0;
        v.sources[i] =
          rgb | (y === 8 ? (15 - (v.opacity[i] as number)) << 12 : 0);
        changed.push(i);
      }
      relightEdits(v, changed);
      expectFresh(v);
    }
  });
  it("keeps level15 downward, attenuates laterally, and removes a roof shadow", () => {
    const v = createLightVolume(5, 40, 5);
    v.sources[lightIndex(v, 2, 39, 2)] = 0xf000;
    solveLight(v);
    expect(channel(v.light[lightIndex(v, 2, 0, 2)] as number, 12)).toBe(15);
    expect(channel(v.light[lightIndex(v, 3, 0, 2)] as number, 12)).toBe(14);
    const roof = lightIndex(v, 2, 30, 2);
    v.opacity[roof] = 15;
    relightEdits(v, [roof]);
    expect(channel(v.light[roof] as number, 12)).toBe(0);
    expect(channel(v.light[lightIndex(v, 2, 0, 2)] as number, 12)).toBe(0);
    v.opacity[roof] = 0;
    relightEdits(v, [roof]);
    expect(channel(v.light[lightIndex(v, 2, 0, 2)] as number, 12)).toBe(15);
  });
  it("never resurrects removed sources through stale refill nodes", () => {
    const v = createLightVolume(12, 12, 12),
      a = lightIndex(v, 3, 4, 4),
      b = lightIndex(v, 8, 4, 4);
    v.sources[a] = 0xf00;
    v.sources[b] = 0x900;
    solveLight(v);
    v.sources[a] = 0;
    v.sources[b] = 0;
    relightEdits(v, [a, b]);
    expect(v.light.some((x) => x !== 0)).toBe(false);
  });
  it("retains surviving emitters and agrees with full recomputation", () => {
    const v = createLightVolume(12, 12, 12),
      a = lightIndex(v, 3, 4, 4),
      b = lightIndex(v, 8, 4, 4);
    v.sources[a] = 0xfed;
    v.sources[b] = 0x987;
    solveLight(v);
    v.sources[a] = 0;
    relightEdits(v, [a]);
    const actual = v.light.slice();
    solveLight(v);
    expect(actual).toEqual(v.light);
  });
});
