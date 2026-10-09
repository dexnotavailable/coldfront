/** Original analytic volcanic shapes. No sampled neighbour/chunk state. */
import { detSinCos } from "../../math/det.js";
import { hash3, hash4, rand01 } from "../../math/hash.js";
import { psrd2 } from "../../noise/psrd2.js";
import { Region } from "../../world/regions.js";
import type {
  IbaraCalderaData,
  IbaraGroundTag,
  XZBounds,
} from "../../world/types.js";
import {
  clamp,
  createGeometryWorkspace,
  createRegionWeights,
  SURFACE_WARP_MAX_DISTANCE,
  smoothUnit,
  surfaceInteriorDistance,
  surfaceWeights,
} from "../../worldplan/geometry.js";

export const PLATE_CELL = 96;
export const MAX_PLAIN_RISE = 4;
export const MAX_FISSURE_DEPTH = 10;
/** Sector blend <=300 m and component warp <=350 m; 64 m aligned envelope. */
export const IBARA_SUPPORT: XZBounds = {
  minX: -1024,
  minZ: -1024,
  maxX: 14080,
  maxZ: 14080,
};
/** Includes the region warp, the widest blend, and a shape's entire footprint. */
export function safelyInsideIbara(
  x: number,
  z: number,
  radius: number,
): boolean {
  return (
    surfaceInteriorDistance(Region.Hellscape, x, z) >
    SURFACE_WARP_MAX_DISTANCE + 320 + radius
  );
}
export function intersectsXZ(a: XZBounds, b: XZBounds): boolean {
  return (
    a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ
  );
}
export function distanceToBox(x: number, z: number, b: XZBounds): number {
  const dx = Math.max(b.minX - x, 0, x - b.maxX);
  const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
  return Math.sqrt(dx * dx + dz * dz);
}
/** Projection lanes: distance, closestX, closestZ, segment t, outward X/Z. */
export function projectSegment(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  out: Float64Array,
): Float64Array {
  const vx = bx - ax;
  const vz = bz - az;
  const length2 = vx * vx + vz * vz;
  const t =
    length2 > 0 ? clamp(((x - ax) * vx + (z - az) * vz) / length2, 0, 1) : 0;
  const px = ax + vx * t;
  const pz = az + vz * t;
  const dx = x - px;
  const dz = z - pz;
  const distance = Math.sqrt(dx * dx + dz * dz);
  const length = Math.sqrt(length2);
  out[0] = distance;
  out[1] = px;
  out[2] = pz;
  out[3] = t;
  out[4] = distance > 0 ? dx / distance : length > 0 ? -vz / length : 0;
  out[5] = distance > 0 ? dz / distance : length > 0 ? vx / length : 0;
  return out;
}

export interface Fissure {
  readonly id: number;
  readonly ax: number;
  readonly az: number;
  readonly bx: number;
  readonly bz: number;
  readonly halfWidth: number;
  readonly depth: number;
  readonly hot: boolean;
}
export interface PlainSample {
  offset: number;
  tag: IbaraGroundTag;
  weight: number;
}
export interface IbaraAnalytic {
  weight(x: number, z: number): number;
  plain(x: number, z: number, out: PlainSample): PlainSample;
  /** Edges owned by this signed world cell, sorted by ID; no query-order IDs. */
  fissures(cellX: number, cellZ: number): readonly Fissure[];
}
interface Site {
  x: number;
  z: number;
  cx: number;
  cz: number;
}
function site(seed: number, cx: number, cz: number): Site {
  return {
    cx,
    cz,
    x: (cx + 0.25 + 0.5 * rand01(hash4(seed, cx, cz, 1))) * PLATE_CELL,
    z: (cz + 0.25 + 0.5 * rand01(hash4(seed, cx, cz, 2))) * PLATE_CELL,
  };
}
/** Clipping bisectors re-derives Worley F2-F1=0, with metre widths instead of
 * a distance-difference threshold whose apparent width changes with plate size.
 * Site jitter is confined to the middle half-cell: a 5x5 neighbourhood contains
 * all competitors. Any point in a Voronoi cell is within 1.25 cells of its site,
 * so the initial three-cell square and the nearest-query padding are conservative.
 * Edges end short of triple points, leaving solid bridges that close hot floors. */
function plateEdges(seed: number, cx: number, cz: number): readonly Fissure[] {
  const centre = site(seed, cx, cz);
  const province = new Float64Array(6);
  const neighbours: Site[] = [];
  for (let dz = -2; dz <= 2; dz++)
    for (let dx = -2; dx <= 2; dx++) {
      if (dx !== 0 || dz !== 0) neighbours.push(site(seed, cx + dx, cz + dz));
    }
  let polygon = [
    { x: (cx - 1) * PLATE_CELL, z: (cz - 1) * PLATE_CELL },
    { x: (cx + 2) * PLATE_CELL, z: (cz - 1) * PLATE_CELL },
    { x: (cx + 2) * PLATE_CELL, z: (cz + 2) * PLATE_CELL },
    { x: (cx - 1) * PLATE_CELL, z: (cz + 2) * PLATE_CELL },
  ];
  for (const neighbour of neighbours) {
    const vx = neighbour.x - centre.x;
    const vz = neighbour.z - centre.z;
    // Centre-relative arithmetic avoids subtracting squared world coordinates.
    const limit = (vx * vx + vz * vz) * 0.5;
    const next: typeof polygon = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i] as Site;
      const b = polygon[(i + 1) % polygon.length] as Site;
      const da = (a.x - centre.x) * vx + (a.z - centre.z) * vz - limit;
      const db = (b.x - centre.x) * vx + (b.z - centre.z) * vz - limit;
      if (da <= 0) next.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
        const t = da / (da - db);
        next.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
      }
    }
    polygon = next;
  }
  const result: Fissure[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i] as Site;
    const b = polygon[(i + 1) % polygon.length] as Site;
    const mx = (a.x + b.x) * 0.5;
    const mz = (a.z + b.z) * 0.5;
    // Kilometre-scale volcanic provinces leave broad unbroken ash plains.
    // Keep or omit the complete edge, so the province boundary cannot clip
    // a hot floor and expose a vertical fluid wall.
    psrd2(seed ^ 0x9a318, mx / 1400, mz / 1400, province);
    if (Number(province[0]) <= 0.15) continue;
    let owner: Site | undefined;
    let error = Infinity;
    for (const other of neighbours) {
      const vx = other.x - centre.x;
      const vz = other.z - centre.z;
      const e = Math.abs(
        (mx - centre.x) * vx + (mz - centre.z) * vz - (vx * vx + vz * vz) * 0.5,
      );
      if (e < error) {
        error = e;
        owner = other;
      }
    }
    if (!owner || owner.cx < cx || (owner.cx === cx && owner.cz < cz)) continue;
    const vx = b.x - a.x;
    const vz = b.z - a.z;
    const length = Math.sqrt(vx * vx + vz * vz);
    if (length < 14) continue;
    const key = hash4(hash3(seed ^ 0x117a5e3d, cx, cz), owner.cx, owner.cz, 0);
    const halfWidth = 0.75 + 0.75 * rand01(key);
    const inset = (4 + 2 * halfWidth) / length;
    const ax = a.x + vx * inset;
    const az = a.z + vz * inset;
    const bx = b.x - vx * inset;
    const bz = b.z - vz * inset;
    // Full, certified-interior capsules only. There is no clipped fluid wall at
    // a biome threshold; transition-band cracks remain ordinary solid ground.
    if (!safelyInsideIbara(mx, mz, length * 0.5 + halfWidth)) continue;
    result.push({
      // Injective signed cell/pair encoding across the canonical world.
      id:
        0x40000000 +
        ((cx + 512) * 1024 + cz + 512) * 25 +
        owner.cx -
        cx +
        2 +
        5 * (owner.cz - cz + 2),
      ax,
      az,
      bx,
      bz,
      halfWidth,
      depth: 2 + 8 * rand01(hash3(key, 17, 0)),
      hot: rand01(hash3(key, 29, 0)) < 0.68,
    });
  }
  return result.sort((a, b) => a.id - b.id || a.ax - b.ax || a.az - b.az);
}

export function createIbaraAnalytic(seed: number): IbaraAnalytic {
  const geometry = createGeometryWorkspace();
  const weights = createRegionWeights();
  const noise = new Float64Array(6);
  const wind = new Float64Array(2);
  detSinCos(rand01(hash3(seed, 187, 11)) * 2 * Math.PI, wind);
  const wx = Number(wind[1]);
  const wz = Number(wind[0]);
  const cache = new Map<string, readonly Fissure[]>();
  const weight = (x: number, z: number): number => {
    surfaceWeights(seed, x, z, weights, geometry);
    for (let i = 0; i < weights.count; i++)
      if (weights.ids[i] === Region.Hellscape)
        return Number(weights.weights[i]);
    return 0;
  };
  return {
    weight,
    plain(x, z, out) {
      out.weight = weight(x, z);
      out.offset = 0;
      out.tag = "base";
      if (out.weight === 0) return out;
      psrd2(seed ^ 0x11c57, x / 1800, z / 1800, noise);
      const ash = smoothUnit((Number(noise[0]) + 0.3) / 0.6);
      // Dunes occupy coherent patches within the ash province. The rest is
      // exactly the broad base surface, rather than a region-wide noise carpet.
      const dunes = smoothUnit((ash - 0.72) / 0.28);
      // Ridge crests share one seed-wide wind; cross-wind scale is ten times
      // shorter than along-wind scale. The amplitude itself is exactly 2..4 m.
      psrd2(
        seed ^ 0x348aae,
        (x * wx + z * wz) / 450,
        (z * wx - x * wz) / 45,
        noise,
      );
      const ridge = 1 - Math.abs(clamp(Number(noise[0]), -1, 1));
      psrd2(seed ^ 0x51527, x / 1200, z / 1200, noise);
      const amplitude = 3 + clamp(Number(noise[0]), -1, 1);
      out.offset = out.weight * dunes * amplitude * ridge * ridge;
      out.tag = ash > 0.35 ? "ash" : "basalt";
      return out;
    },
    fissures(cx, cz) {
      const key = `${cx},${cz}`;
      let found = cache.get(key);
      if (!found) {
        found = plateEdges(seed, cx, cz);
        // Caches are derived only; eviction changes work, never numerical output.
        if (cache.size >= 4096) cache.clear();
        cache.set(key, found);
      }
      return found;
    },
  };
}

/** Exact heightfield bowl, wet shore at lavaRadius, broken by owned outlet cuts. */
export function calderaHeight(
  c: IbaraCalderaData,
  x: number,
  z: number,
  ground: number,
): number {
  const dx = x - c.x;
  const dz = z - c.z;
  const r = Math.sqrt(dx * dx + dz * dz);
  if (r >= c.radius + c.rimWidth) return ground;
  if (r <= c.lavaRadius) {
    const bank = smoothUnit((r / c.lavaRadius - 0.65) / 0.35);
    return c.floorY + (c.lavaLevel - c.floorY) * bank;
  }
  if (r < c.radius) {
    const t = smoothUnit((r - c.lavaRadius) / (c.radius - c.lavaRadius));
    return c.lavaLevel + (c.baseY + c.rimHeight - c.lavaLevel) * t;
  }
  return (
    c.baseY +
    c.rimHeight +
    (ground - c.baseY - c.rimHeight) * smoothUnit((r - c.radius) / c.rimWidth)
  );
}
