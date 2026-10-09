import { readFileSync } from "node:fs";
import { Color, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  IbaraAtmosphere,
  ibaraFogDensity,
  type WorldAtmosphereSource,
} from "../../../client/src/engine/ibara-atmosphere.js";
import { WorldRenderer } from "../../../client/src/engine/renderer.js";
import { Region } from "../../../shared/src/world/regions.js";
import type { RegionWeights } from "../../../shared/src/world/types.js";
import { createAtmosphereRenderer } from "./ibara-atmosphere-fixture.js";

function source(
  id: number,
  weight: number | ((x: number, z: number) => number),
  kind: "main" | "test" = "main",
) {
  const calls: { x: number; z: number; out: RegionWeights }[] = [];
  const value: WorldAtmosphereSource = {
    world: { id },
    context: {
      kind,
      surfaceWeights(x, z, out) {
        calls.push({ x, z, out });
        out.count = 2;
        out.ids[0] = Region.Plains;
        out.ids[1] = Region.Hellscape;
        const value = typeof weight === "number" ? weight : weight(x, z);
        out.weights[0] = 1 - value;
        out.weights[1] = value;
        return out;
      },
    },
  };
  return { value, calls };
}
const point = { x: 5670.5, y: 30.62, z: 5459.5 };
const focus = {
  x: 5607.596772355778,
  y: 25.863978448565145,
  z: 5471.297624843125,
};

describe("Ibara standing-air sampling (no generation or GPU)", () => {
  it("uses the selected world's exact camera coordinates and reuses its weight buffer", () => {
    const air = new IbaraAtmosphere(),
      a = source(1, 0.6);
    air.register(a.value);
    expect(air.sample(1, point, 0)).toBe(0.6);
    for (let time = 1; time < 200; time++) air.sample(1, point, time);
    expect(a.calls).toHaveLength(1);
    air.sample(1, { ...point, x: point.x + 0.1 }, 200);
    expect(a.calls).toHaveLength(2);
    expect(a.calls[0]).toMatchObject({ x: point.x, z: point.z });
    expect(a.calls[1]?.out).toBe(a.calls[0]?.out);
  });
  it("preserves Test/unknown defaults and invalidates a replaced context at identical coordinates", () => {
    const air = new IbaraAtmosphere(),
      test = source(2, 1, "test");
    air.register(source(1, 1).value);
    air.register(test.value);
    expect(air.sample(1, point, 0)).toBe(1);
    expect(air.sample(2, point, 0)).toBe(0);
    expect(test.calls).toHaveLength(0);
    expect(air.sample(999, point, 0)).toBe(0);
    air.register(source(1, 0.25).value);
    expect(air.sample(1, point, 0)).toBe(0.25);
    air.register(source(1, 0).value);
    expect(air.sample(1, point, 0)).toBe(0);
    air.remove(1);
    expect(air.sample(1, point, 0)).toBe(0);
    air.register(source(3, 1).value);
    expect(air.sample(3, point, 0)).toBe(1);
    air.remove(3);
    expect(air.sample(3, point, 0)).toBe(0);
    air.register(source(3, 1).value);
    expect(air.sample(3, point, 0)).toBe(1);
    air.clear();
    expect(air.sample(3, point, 0)).toBe(0);
  });
  it.each([
    [-1, 0],
    [2, 1],
    [NaN, 0],
    [Infinity, 0],
    [0.35, 0.35],
  ])("bounds malformed or mixed weights (%s → %s)", (input, expected) => {
    const air = new IbaraAtmosphere();
    air.register(source(1, input).value);
    expect(air.sample(1, point, 0)).toBe(expected);
  });
  it("does not query invalid coordinates or retain their invalid sample", () => {
    const air = new IbaraAtmosphere(),
      a = source(1, 1);
    air.register(a.value);
    expect(air.sample(1, { ...point, y: NaN }, 0)).toBe(0);
    expect(a.calls).toHaveLength(0);
    expect(air.sample(1, point, 0, true)).toBe(1);
  });
  it("blends ~95% in two seconds equally at 30/144Hz, and settles discrete travel immediately", () => {
    const values = [30, 144].map((fps) => {
      const air = new IbaraAtmosphere();
      air.register(source(1, (x) => x).value);
      air.sample(1, { x: 0, y: 40, z: 0 }, 0);
      const destination = { x: 1, y: 40, z: 0 };
      air.sample(1, destination, 0);
      let value = 0;
      for (let i = 1; i <= fps * 2; i++)
        value = air.sample(1, destination, ((i / fps) * 2000) / 2);
      expect(value).toBeCloseTo(1 - Math.exp(-2000 / 650), 12);
      expect(air.sample(1, destination, 2000, true)).toBe(1);
      return value;
    });
    expect(values[0]).toBeCloseTo(values[1] ?? 0, 12);
  });
  it("bounds low-altitude distance haze without masking nearby forms", () => {
    const low = ibaraFogDensity(30.62),
      high = ibaraFogDensity(400);
    expect(low).toBeCloseTo(0.0045);
    expect(high).toBeLessThan(low);
    expect(high).toBeGreaterThan(0.0017);
    expect(1 - Math.exp(-low * low * 50 * 50)).toBeLessThan(0.06);
    expect(1 - Math.exp(-low * low * 100 * 100)).toBeLessThan(0.2);
    expect(Number.isFinite(ibaraFogDensity(NaN))).toBe(true);
  });
});

const rendererFixture = (failDraw = false) =>
  createAtmosphereRenderer(WorldRenderer, failDraw);
describe("Ibara air in actual renderer transitions (CPU proof; pixels remain a separate gate)", () => {
  it.each([0, 6, 12, 17.25, 18, 22])(
    "preserves every zero-weight time-of-day value at hour %s",
    (hours) => {
      const f = rendererFixture();
      f.tools.timeHours = hours;
      f.select(source(1, 0).value);
      const angle = ((hours - 6) / 12) * Math.PI,
        elevation = Math.sin(angle),
        day = Math.max(0, Math.min(1, (elevation + 0.08) / 0.25));
      expect(f.snapshot()).toEqual({
        skyWeight: 0,
        sun: new Color(
          day > 0.1 && elevation < 0.4 ? 0xffb76f : 0xfff1d9,
        ).toArray(),
        sunIntensity: day * 2.1,
        sunPosition: new Vector3(
          -Math.cos(angle) * 0.75,
          Math.max(0.08, elevation),
          Math.cos(angle) * 0.65,
        )
          .normalize()
          .toArray(),
        ambient: new Color(day > 0.2 ? 0xb8cfdf : 0x9cb5de).toArray(),
        ground: new Color(day > 0.2 ? 0x6c6e51 : 0x596a8d).toArray(),
        ambientIntensity: 2.5 - day * 1.1,
        fog: new Color(
          day > 0.2 ? (elevation < 0.4 ? 0xb6aa92 : 0xa6b6bd) : 0x3b526f,
        ).toArray(),
        density: 0.004,
        day,
        rayleigh: 1.2 + day * 0.5,
      });
    },
  );
  it("mixes light/fog continuously while preserving sun position and saved hour", () => {
    const snapshots = [0, 0.5, 1].map((w) => {
      const f = rendererFixture();
      f.select(source(1, w).value);
      return f.snapshot();
    });
    const [zero, mixed, full] = snapshots;
    expect(zero && mixed && full).toBeTruthy();
    if (!zero || !mixed || !full) throw new Error("missing fixture");
    for (const key of ["sunIntensity", "ambientIntensity", "density"] as const)
      expect(mixed[key]).toBeCloseTo((zero[key] + full[key]) / 2, 12);
    for (const key of ["sun", "ambient", "ground", "fog"] as const)
      for (let channel = 0; channel < 3; channel++)
        expect(mixed[key][channel]).toBeCloseTo(
          ((zero[key][channel] ?? 0) + (full[key][channel] ?? 0)) / 2,
          12,
        );
    expect(full.sunPosition).toEqual(zero.sunPosition);
    expect(full.day).toBe(1);
    expect(full.sunIntensity).toBeLessThan(zero.sunIntensity);
    expect(full.ambientIntensity).toBeGreaterThan(zero.ambientIntensity);
    expect(full.fog[0]).toBeGreaterThan(full.fog[2] ?? 0);
  });
  it.each([false, true])(
    "uses destination world during preparation and restores source on exit (failure=%s)",
    (fail) => {
      const f = rendererFixture(fail),
        main = source(1, 1),
        test = source(2, 1, "test");
      f.select(main.value);
      const before = f.snapshot();
      f.update(test.value); // A candidate is registered without selecting it.
      expect(f.snapshot()).toEqual(before);
      const prepare = () =>
        f.renderer.prepareView(2, { x: 4, y: 80, z: -5 }, focus);
      if (fail) expect(prepare).toThrow("destination draw failed");
      else prepare();
      expect(f.draws.length).toBeGreaterThan(0);
      expect(
        f.draws.every((v) => v.skyWeight === 0 && v.density === 0.004),
      ).toBe(true);
      expect(f.snapshot()).toEqual(before);
      f.renderer.setWorld(2);
      f.renderer.setView({ x: 4, y: 80, z: -5 }, focus);
      f.update(test.value);
      expect(f.snapshot().skyWeight).toBe(0);
      expect(test.calls).toHaveLength(0);
    },
  );
  it("samples a same-world destination before drawing, rollback, and final commit at a frozen display time", () => {
    const f = rendererFixture(),
      a = source(1, (x) => (x > 50 ? 1 : 0));
    f.select(a.value, { x: 0, y: 30, z: 0 });
    f.renderer.prepareView(1, { x: 100, y: 30, z: 0 }, focus);
    expect(f.draws.every((v) => v.skyWeight === 1)).toBe(true);
    expect(f.snapshot().skyWeight).toBe(0);
    f.renderer.setView({ x: 100, y: 30, z: 0 }, focus, true);
    f.update(a.value);
    expect(f.snapshot().skyWeight).toBe(1);
    expect(a.calls.some((query) => query.x === 100)).toBe(true);
  });
  it("uses gradual air for ordinary movement and identical standing air in postcard mode", () => {
    const f = rendererFixture(),
      a = source(1, (x) => (x > 50 ? 1 : 0));
    f.select(a.value, { x: 0, y: 30, z: 0 });
    f.renderer.setView({ x: 100, y: 30, z: 0 }, focus);
    f.update(a.value, 1000);
    expect(f.snapshot().skyWeight).toBeCloseTo(1 - Math.exp(-1000 / 650));
    // Explicit final destination settles independently of capture mode.
    f.renderer.setView({ x: 100, y: 30, z: 0 }, focus, true);
    const ordinary = f.snapshot();
    f.renderer.setPostcard(true);
    f.update(a.value, 1000);
    expect(f.snapshot()).toEqual(ordinary);
  });
  it.each([
    { fail: false, destinationWorld: 1 },
    { fail: true, destinationWorld: 1 },
    { fail: false, destinationWorld: 2 },
    { fail: true, destinationWorld: 2 },
  ])(
    "restores an in-progress source blend and its next frame after prepare ($fail, world $destinationWorld)",
    ({ fail, destinationWorld }) => {
      const f = rendererFixture(fail),
        control = rendererFixture(),
        a = source(1, (x) => (x > 50 ? 1 : 0)),
        destination = source(2, 0.4);
      for (const fixture of [f, control]) {
        fixture.select(a.value, { x: 0, y: 40, z: 0 });
        fixture.renderer.setView({ x: 100, y: 40, z: 0 }, focus);
        fixture.update(a.value, 650);
      }
      const before = f.snapshot();
      expect(before.skyWeight).toBeCloseTo(1 - Math.exp(-1), 12);
      const flags = [
        Reflect.get(f.renderer, "airSnap"),
        Reflect.get(f.renderer, "airSnapView"),
      ];
      // New-world startup configures a zero display clock before prewarm. This
      // registration must not reset the still-visible source blend.
      if (destinationWorld === 2) {
        f.update(destination.value, 0, Infinity, true);
        expect(f.snapshot()).toEqual(before);
      }
      const prepare = () =>
        f.renderer.prepareView(destinationWorld, { x: 0, y: 40, z: 0 }, focus);
      if (fail) expect(prepare).toThrow("destination draw failed");
      else prepare();
      expect(f.snapshot()).toEqual(before);
      expect([
        Reflect.get(f.renderer, "airSnap"),
        Reflect.get(f.renderer, "airSnapView"),
      ]).toEqual(flags);
      // Repeat selection as GameRuntime's failure handler does, then take an
      // ordinary moving frame; a leaked snap flag must not surface here.
      f.renderer.setWorld(1);
      for (const fixture of [f, control]) {
        fixture.renderer.setView({ x: 101, y: 40, z: 0 }, focus);
        fixture.update(a.value, 666);
      }
      expect(f.snapshot()).toEqual(control.snapshot());
      expect(f.snapshot().skyWeight).toBeCloseTo(1 - Math.exp(-666 / 650), 12);
    },
  );
  it("honours Fog off and retains diagnostic/under-cut defaults", () => {
    const f = rendererFixture(),
      a = source(1, 1);
    f.select(a.value);
    const ibara = f.snapshot();
    f.tools.fog = false;
    f.update(a.value);
    expect(f.snapshot().density).toBe(0);
    expect(f.snapshot().skyWeight).toBe(1);
    f.tools.fog = true;
    for (const mode of ["clay", "features"] as const) {
      f.renderer.setViewMode(mode);
      f.update(a.value);
      expect(f.snapshot().skyWeight).toBe(0);
      expect(f.snapshot().sunIntensity).toBe(2.1);
      expect(f.snapshot().density).toBe(0.004);
    }
    f.renderer.setViewMode("normal");
    f.update(a.value);
    expect(f.snapshot()).toEqual(ibara);
    f.update(a.value, 0, 20);
    expect(f.snapshot().skyWeight).toBe(0);
    expect(f.sky.visible).toBe(false);
  });
  it("keeps the atmosphere source independent of capture IDs, emission, exposure and ToolState", () => {
    const helper = readFileSync(
        "packages/client/src/engine/ibara-atmosphere.ts",
        "utf8",
      ),
      renderer = readFileSync("packages/client/src/engine/renderer.ts", "utf8");
    expect(helper).not.toMatch(
      /HELL-|\b(?:capturePng|sampleVoxel|prepareArea)\(/,
    );
    expect(renderer).toContain("this.renderer.toneMappingExposure = 1");
    expect(renderer).toContain("luminanceThreshold: TERRAIN_BLOOM_THRESHOLD");
    expect(renderer).toContain("adaptive: false");
  });
});
