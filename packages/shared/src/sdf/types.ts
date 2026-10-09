/** Deterministic geometry shared by terrain features. Metres; Y is up. */
export type Vec3 = readonly [number, number, number];
export type CubicBezier = readonly [Vec3, Vec3, Vec3, Vec3];
export interface Aabb {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}
export function emptyBounds(): Aabb {
  return {
    minX: Infinity,
    minY: Infinity,
    minZ: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    maxZ: -Infinity,
  };
}
export function includePoint(
  bounds: Aabb,
  x: number,
  y: number,
  z: number,
  padding = 0,
): void {
  bounds.minX = Math.min(bounds.minX, x - padding);
  bounds.minY = Math.min(bounds.minY, y - padding);
  bounds.minZ = Math.min(bounds.minZ, z - padding);
  bounds.maxX = Math.max(bounds.maxX, x + padding);
  bounds.maxY = Math.max(bounds.maxY, y + padding);
  bounds.maxZ = Math.max(bounds.maxZ, z + padding);
}
export function boundsOverlap(a: Aabb, b: Aabb): boolean {
  return (
    a.minX <= b.maxX &&
    a.maxX >= b.minX &&
    a.minY <= b.maxY &&
    a.maxY >= b.minY &&
    a.minZ <= b.maxZ &&
    a.maxZ >= b.minZ
  );
}
export function pointInBounds(
  bounds: Aabb,
  x: number,
  y: number,
  z: number,
): boolean {
  return (
    x >= bounds.minX &&
    x <= bounds.maxX &&
    y >= bounds.minY &&
    y <= bounds.maxY &&
    z >= bounds.minZ &&
    z <= bounds.maxZ
  );
}
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
export function length3(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}
