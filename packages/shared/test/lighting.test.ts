import { describe, expect, it } from "vitest";
import {
  channel,
  createLightVolume,
  lightIndex,
  relightEdits,
  solveLight,
} from "../src/lighting/flood.js";

describe("Voxelize light frontier port", () => {
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
