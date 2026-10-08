import type { BoundsXZ } from "../contracts/game-ui";
export interface MapView {
  readonly x: number;
  readonly z: number;
  readonly metresPerPixel: number;
}
export interface MapSize {
  readonly width: number;
  readonly height: number;
}
/** Geography raster resolution is independent of CSS pixels and exact hit tests. */
export function mapRasterSize(size: MapSize): MapSize {
  const factor = Math.min(1, 1024 / Math.max(size.width, size.height));
  return {
    width: Math.max(1, Math.round(size.width * factor)),
    height: Math.max(1, Math.round(size.height * factor)),
  };
}
export function fitMap(bounds: BoundsXZ, size: MapSize): MapView {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    z: (bounds.minZ + bounds.maxZ) / 2,
    metresPerPixel: Math.max(
      (bounds.maxX - bounds.minX) / size.width,
      (bounds.maxZ - bounds.minZ) / size.height,
    ),
  };
}
export function mapPoint(view: MapView, size: MapSize, x: number, y: number) {
  return {
    x: view.x + (x - size.width / 2) * view.metresPerPixel,
    z: view.z + (y - size.height / 2) * view.metresPerPixel,
  };
}
export function mapPixel(view: MapView, size: MapSize, x: number, z: number) {
  return {
    x: (x - view.x) / view.metresPerPixel + size.width / 2,
    y: (z - view.z) / view.metresPerPixel + size.height / 2,
  };
}
export function mapBounds(view: MapView, size: MapSize): BoundsXZ {
  const a = mapPoint(view, size, 0, 0),
    b = mapPoint(view, size, size.width, size.height);
  return { minX: a.x, minZ: a.z, maxX: b.x, maxZ: b.z };
}
export function clampMap(
  view: MapView,
  bounds: BoundsXZ,
  maxScale: number,
): MapView {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, view.x)),
    z: Math.max(bounds.minZ, Math.min(bounds.maxZ, view.z)),
    metresPerPixel: Math.max(1, Math.min(maxScale, view.metresPerPixel)),
  };
}
export function zoomMap(
  view: MapView,
  size: MapSize,
  x: number,
  y: number,
  factor: number,
  bounds: BoundsXZ,
  maxScale: number,
): MapView {
  const anchor = mapPoint(view, size, x, y),
    scale = Math.max(
      1,
      Math.min(
        maxScale,
        view.metresPerPixel * Math.max(0.8, Math.min(1.25, factor)),
      ),
    );
  return clampMap(
    {
      x: anchor.x - (x - size.width / 2) * scale,
      z: anchor.z - (y - size.height / 2) * scale,
      metresPerPixel: scale,
    },
    bounds,
    maxScale,
  );
}
export function wheelPixels(delta: number, mode: number): number {
  return delta * (mode === 1 ? 100 / 3 : mode === 2 ? 400 : 1);
}
export function scaleBar(metresPerPixel: number): {
  metres: number;
  pixels: number;
} {
  const target = metresPerPixel * 100,
    power = 10 ** Math.floor(Math.log10(target));
  const metres =
    (target / power >= 5 ? 5 : target / power >= 2 ? 2 : 1) * power;
  return { metres, pixels: metres / metresPerPixel };
}
