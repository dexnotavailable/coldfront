import { describe, expect, it } from "vitest";
import {
  clampMap,
  fitMap,
  mapBounds,
  mapPixel,
  mapPoint,
  mapRasterSize,
  scaleBar,
  wheelPixels,
  zoomMap,
} from "../../../client/src/ui/map-math";

const bounds = { minX: -22528, minZ: -22528, maxX: 22528, maxZ: 22528 };
describe("flat map coordinates", () => {
  it("caps expensive raster work while retaining viewport aspect and world scale", () => {
    const viewport = { width: 3840, height: 2116 },
      raster = mapRasterSize(viewport);
    expect(raster.width).toBe(1024);
    expect(raster.height).toBeLessThanOrEqual(1024);
    expect(
      Math.abs(raster.width / raster.height - viewport.width / viewport.height),
    ).toBeLessThan(0.003);
    const view = fitMap(bounds, viewport),
      point = mapPoint(view, viewport, 1920, 1058);
    expect(point).toEqual({ x: 0, z: 0 });
    expect(mapRasterSize({ width: 640, height: 480 })).toEqual({
      width: 640,
      height: 480,
    });
  });
  it("fits the entire frame uniformly at wide and tall sizes", () => {
    for (const size of [
      { width: 1280, height: 676 },
      { width: 720, height: 1280 },
    ]) {
      const view = fitMap(bounds, size),
        visible = mapBounds(view, size);
      expect(visible.minX).toBeLessThanOrEqual(bounds.minX);
      expect(visible.maxX).toBeGreaterThanOrEqual(bounds.maxX);
      expect(visible.minZ).toBeLessThanOrEqual(bounds.minZ);
      expect(visible.maxZ).toBeGreaterThanOrEqual(bounds.maxZ);
      const north = mapPixel(view, size, 0, -1000),
        east = mapPixel(view, size, 1000, 0);
      expect(north.y).toBeLessThan(size.height / 2);
      expect(east.x).toBeGreaterThan(size.width / 2);
    }
  });
  it("holds the cursor anchor throughout eased zoom and caps a large event", () => {
    const size = { width: 1280, height: 676 },
      view = fitMap(bounds, size),
      anchor = mapPoint(view, size, 850, 240);
    const target = zoomMap(
      view,
      size,
      850,
      240,
      0.01,
      bounds,
      view.metresPerPixel,
    );
    expect(target.metresPerPixel / view.metresPerPixel).toBeCloseTo(0.8);
    for (const progress of [0, 0.1, 0.5, 0.9, 1]) {
      const intermediate = {
        x: view.x + (target.x - view.x) * progress,
        z: view.z + (target.z - view.z) * progress,
        metresPerPixel:
          view.metresPerPixel +
          (target.metresPerPixel - view.metresPerPixel) * progress,
      };
      const pixel = mapPixel(intermediate, size, anchor.x, anchor.z);
      expect(Math.hypot(pixel.x - 850, pixel.y - 240)).toBeLessThan(0.001);
    }
  });
  it("normalizes wheel units, enforces1m/pixel and makes scale bars honest", () => {
    expect(wheelPixels(3, 1)).toBe(100);
    expect(wheelPixels(1, 2)).toBe(400);
    expect(
      clampMap({ x: 1e6, z: -1e6, metresPerPixel: 0.01 }, bounds, 100),
    ).toEqual({ x: bounds.maxX, z: bounds.minZ, metresPerPixel: 1 });
    for (const scale of [1, 3.7, 10, 66.65, 100]) {
      const bar = scaleBar(scale);
      expect(bar.pixels * scale).toBeCloseTo(bar.metres);
      expect(bar.pixels).toBeLessThanOrEqual(100);
    }
  });
});
