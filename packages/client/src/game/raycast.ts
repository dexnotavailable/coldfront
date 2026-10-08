export interface Point {
  x: number;
  y: number;
  z: number;
}
export interface BlockHit {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly block: number;
  readonly point: Point;
  readonly normal: Point;
  readonly distance: number;
  readonly cap: boolean;
}
export type BlockQuery = (x: number, y: number, z: number) => number;
/** Amanatides-Woo traversal, independently implemented from the published method. */
export function raycast(
  get: BlockQuery,
  origin: Point,
  direction: Point,
  maxDistance: number,
  cut = Infinity,
): BlockHit | null {
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (length < 1e-12) return null;
  const dx = direction.x / length,
    dy = direction.y / length,
    dz = direction.z / length;
  let start = 0,
    capEntry = false;
  if (origin.y > cut) {
    if (dy >= 0) return null;
    start = (cut - origin.y) / dy + 1e-7;
    capEntry = true;
  }
  if (start > maxDistance) return null;
  const ox = origin.x + dx * start,
    oy = origin.y + dy * start,
    oz = origin.z + dz * start;
  let x = Math.floor(ox),
    y = Math.floor(oy),
    z = Math.floor(oz),
    distance = start;
  const sx = Math.sign(dx),
    sy = Math.sign(dy),
    sz = Math.sign(dz);
  const tx = dx === 0 ? Infinity : Math.abs(1 / dx),
    ty = dy === 0 ? Infinity : Math.abs(1 / dy),
    tz = dz === 0 ? Infinity : Math.abs(1 / dz);
  let mx = start + (dx > 0 ? x + 1 - ox : ox - x) * tx,
    my = start + (dy > 0 ? y + 1 - oy : oy - y) * ty,
    mz = start + (dz > 0 ? z + 1 - oz : oz - z) * tz;
  if (dx === 0) mx = Infinity;
  if (dy === 0) my = Infinity;
  if (dz === 0) mz = Infinity;
  let normal: Point = { x: 0, y: capEntry ? 1 : 0, z: 0 };
  while (distance <= maxDistance) {
    if (origin.y + dy * distance > cut + 1e-6) return null;
    const block = get(x, y, z);
    if (block !== 0)
      return {
        x,
        y,
        z,
        block,
        normal,
        distance,
        point: {
          x: origin.x + dx * distance,
          y: origin.y + dy * distance,
          z: origin.z + dz * distance,
        },
        cap: capEntry && distance === start,
      };
    capEntry = false;
    if (mx <= my && mx <= mz) {
      x += sx;
      distance = mx;
      mx += tx;
      normal = { x: -sx, y: 0, z: 0 };
    } else if (my <= mz) {
      y += sy;
      distance = my;
      my += ty;
      normal = { x: 0, y: -sy, z: 0 };
    } else {
      z += sz;
      distance = mz;
      mz += tz;
      normal = { x: 0, y: 0, z: -sz };
    }
  }
  return null;
}
export function fallbackRay(
  origin: Point,
  direction: Point,
  focusY: number,
  distance: number,
): Point {
  const planeT =
    Math.abs(direction.y) > 1e-8 ? (focusY - origin.y) / direction.y : Infinity;
  const t = planeT >= 0 && planeT <= distance * 4 ? planeT : distance * 4;
  return {
    x: origin.x + direction.x * t,
    y: origin.y + direction.y * t,
    z: origin.z + direction.z * t,
  };
}
export function actionRay(
  get: BlockQuery,
  eyes: Point,
  aim: Point,
  cut = Infinity,
): BlockHit | null {
  return raycast(
    get,
    eyes,
    { x: aim.x - eyes.x, y: aim.y - eyes.y, z: aim.z - eyes.z },
    5,
    cut,
  );
}
