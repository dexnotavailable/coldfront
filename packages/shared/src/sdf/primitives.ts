import { clamp01, length3, type Vec3 } from "./types.js";

/** Original elementary distance geometry. Radii/half-extents are positive. */
export function sdSphere(
  x: number,
  y: number,
  z: number,
  radius: number,
): number {
  return length3(x, y, z) - radius;
}
export function sdEllipsoid(
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  rz: number,
): number {
  const a = length3(x / rx, y / ry, z / rz);
  const b = length3(x / (rx * rx), y / (ry * ry), z / (rz * rz));
  return b > 0 ? (a * (a - 1)) / b : -Math.min(rx, ry, rz);
}
export function sdBox(
  x: number,
  y: number,
  z: number,
  hx: number,
  hy: number,
  hz: number,
): number {
  const a = Math.abs(x) - hx,
    b = Math.abs(y) - hy,
    c = Math.abs(z) - hz;
  return (
    length3(Math.max(a, 0), Math.max(b, 0), Math.max(c, 0)) +
    Math.min(Math.max(a, b, c), 0)
  );
}
export function sdRoundBox(
  x: number,
  y: number,
  z: number,
  hx: number,
  hy: number,
  hz: number,
  radius: number,
): number {
  return sdBox(x, y, z, hx, hy, hz) - radius;
}
export function sdCapsule(
  x: number,
  y: number,
  z: number,
  a: Vec3,
  b: Vec3,
  radius: number,
): number {
  const vx = b[0] - a[0],
    vy = b[1] - a[1],
    vz = b[2] - a[2];
  const px = x - a[0],
    py = y - a[1],
    pz = z - a[2];
  const l2 = vx * vx + vy * vy + vz * vz;
  const t = l2 > 0 ? clamp01((px * vx + py * vy + pz * vz) / l2) : 0;
  return length3(px - t * vx, py - t * vy, pz - t * vz) - radius;
}
/** Envelope of spheres whose radius varies linearly along the axis. */
export function sdRoundCone(
  x: number,
  y: number,
  z: number,
  a: Vec3,
  b: Vec3,
  ra: number,
  rb: number,
): number {
  const vx = b[0] - a[0],
    vy = b[1] - a[1],
    vz = b[2] - a[2];
  const px = x - a[0],
    py = y - a[1],
    pz = z - a[2];
  const length = length3(vx, vy, vz);
  if (length <= Math.abs(ra - rb))
    return ra >= rb
      ? length3(px, py, pz) - ra
      : length3(x - b[0], y - b[1], z - b[2]) - rb;
  const axial = (px * vx + py * vy + pz * vz) / length;
  const radial = Math.sqrt(
    Math.max(0, px * px + py * py + pz * pz - axial * axial),
  );
  const slope = (rb - ra) / length;
  const station = Math.max(
    0,
    Math.min(length, axial + (slope * radial) / Math.sqrt(1 - slope * slope)),
  );
  return (
    Math.sqrt(radial * radial + (axial - station) * (axial - station)) -
    (ra + slope * station)
  );
}
export function sdCylinder(
  x: number,
  y: number,
  z: number,
  radius: number,
  halfHeight: number,
): number {
  const radial = Math.sqrt(x * x + z * z) - radius,
    vertical = Math.abs(y) - halfHeight;
  return (
    Math.sqrt(
      Math.max(radial, 0) * Math.max(radial, 0) +
        Math.max(vertical, 0) * Math.max(vertical, 0),
    ) + Math.min(Math.max(radial, vertical), 0)
  );
}
export function sdTorus(
  x: number,
  y: number,
  z: number,
  majorRadius: number,
  minorRadius: number,
): number {
  const radial = Math.sqrt(x * x + z * z) - majorRadius;
  return Math.sqrt(radial * radial + y * y) - minorRadius;
}
export function sdHexPrism(
  x: number,
  y: number,
  z: number,
  apothem: number,
  halfHeight: number,
): number {
  const section =
    Math.max(
      Math.abs(x),
      0.5 * Math.abs(x) + 0.8660254037844386 * Math.abs(z),
    ) - apothem;
  return Math.max(section, Math.abs(y) - halfHeight);
}
export function sdPlane(
  x: number,
  y: number,
  z: number,
  normal: Vec3,
  offset: number,
): number {
  return (
    (x * normal[0] + y * normal[1] + z * normal[2]) / length3(...normal) -
    offset
  );
}
