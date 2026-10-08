import { detSinCos } from "../math/det.js";
import { hash4, rand01 } from "../math/hash.js";
import { DEFAULT_WARP, warp2 } from "../noise/fractal.js";
import { REGION_IDS, Region } from "../world/regions.js";
import type {
  RegionWeights,
  UndergroundCell,
  UndergroundLayer,
} from "../world/types.js";
export const SURFACE_WARP_AMPLITUDE = 350;
export const SURFACE_WARP_MAX_DISTANCE = 350 * Math.SQRT2;
const OUTER = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 0]);
const INNER = new Uint8Array([10, 9, 11, 8]);
const SIN_HALF_OUTER = Math.sqrt((1 - Math.SQRT1_2) / 2);
const COS_HALF_OUTER = Math.sqrt((1 + Math.SQRT1_2) / 2);
const DIRECTIONS = new Float64Array([
  0,
  -1,
  Math.SQRT1_2,
  -Math.SQRT1_2,
  1,
  0,
  Math.SQRT1_2,
  Math.SQRT1_2,
  0,
  1,
  -Math.SQRT1_2,
  Math.SQRT1_2,
  -1,
  0,
  -Math.SQRT1_2,
  -Math.SQRT1_2,
]);
export interface GeometryWorkspace {
  readonly vector: Float64Array;
  readonly noise: Float64Array<ArrayBuffer>;
  readonly component: Float64Array<ArrayBuffer>;
  readonly raw: Float64Array;
  readonly sectors: Float64Array;
  readonly top: Int16Array;
}
export function createGeometryWorkspace(): GeometryWorkspace {
  return {
    vector: new Float64Array(6),
    noise: new Float64Array(6),
    component: new Float64Array(3),
    raw: new Float64Array(33),
    sectors: new Float64Array(8),
    top: new Int16Array(4),
  };
}
export function createRegionWeights(): RegionWeights {
  return { count: 0, ids: new Uint8Array(3), weights: new Float64Array(3) };
}
export function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}
export function smoothUnit(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}
export function blendAt(
  value: number,
  boundary: number,
  width: number,
): number {
  return smoothUnit((value - boundary) / width + 0.5);
}
/** Write a displaced XZ point in workspace.vector[0..1]. */
export function warpedPoint(
  seed: number,
  x: number,
  z: number,
  amplitude: number,
  radialBound: boolean,
  workspace: GeometryWorkspace,
): void {
  warp2(
    seed,
    x / 5000,
    z / 5000,
    workspace.vector,
    DEFAULT_WARP,
    workspace.noise,
    workspace.component,
  );
  let vx = clamp(Number(workspace.vector[0]), -1, 1);
  let vz = clamp(Number(workspace.vector[1]), -1, 1);
  if (radialBound) {
    const norm = Math.max(1, Math.sqrt(vx * vx + vz * vz));
    vx /= norm;
    vz /= norm;
  }
  workspace.vector[0] = x + amplitude * vx;
  workspace.vector[1] = z + amplitude * vz;
}
/** Continuous top-three projection from docs04: subtract fourth, then normalise. */
export function projectWeights(
  raw: Float64Array,
  out: RegionWeights,
  top: Int16Array,
): RegionWeights {
  top.fill(-1);
  for (let id = 0; id < raw.length; id++) {
    const weight = Number(raw[id]);
    if (!(weight > 0)) continue;
    for (let rank = 0; rank < 4; rank++) {
      const old = Number(top[rank]);
      if (
        old < 0 ||
        weight > Number(raw[old]) ||
        (weight === raw[old] &&
          (REGION_IDS[id] as string) < (REGION_IDS[old] as string))
      ) {
        for (let move = 3; move > rank; move--)
          top[move] = Number(top[move - 1]);
        top[rank] = id;
        break;
      }
    }
  }
  out.count = 0;
  out.ids.fill(255);
  out.weights.fill(0);
  if (Number(top[0]) < 0) return out;
  const fourth = Number(top[3]) < 0 ? 0 : Number(raw[Number(top[3])]);
  let total = 0;
  for (let rank = 0; rank < 3; rank++) {
    const id = Number(top[rank]);
    if (id < 0) continue;
    const weight = Math.max(0, Number(raw[id]) - fourth);
    if (weight === 0) continue;
    out.ids[out.count] = id;
    out.weights[out.count] = weight;
    out.count++;
    total += weight;
  }
  if (!(total > 0))
    throw new Error(
      "Degenerate four-way region junction; repair layout instead of truncating discontinuously",
    );
  for (let i = 0; i < out.count; i++)
    out.weights[i] = Number(out.weights[i]) / total;
  return out;
}
function sectorWeights(
  x: number,
  z: number,
  outer: boolean,
  out: Float64Array,
): void {
  const count = outer ? 8 : 4;
  const sine = outer ? SIN_HALF_OUTER : Math.SQRT1_2;
  const cosine = outer ? COS_HALF_OUTER : Math.SQRT1_2;
  let total = 0;
  for (let k = 0; k < count; k++) {
    const direction = outer ? k : 1 + 2 * k;
    const sx = Number(DIRECTIONS[direction * 2]);
    const sz = Number(DIRECTIONS[direction * 2 + 1]);
    const along = x * sx + z * sz;
    const across = x * -sz + z * sx;
    // Each half-plane is the inward normal of a forward boundary ray. Their
    // intersection excludes the opposite ray without atan2 or signed-zero cases.
    const low = along * sine + across * cosine;
    const high = along * sine - across * cosine;
    const lowWidth = outer && (k === 1 || (k + 7) % 8 === 1) ? 600 : 400;
    const highWidth = outer && (k === 1 || (k + 1) % 8 === 1) ? 600 : 400;
    const weight = blendAt(low, 0, lowWidth) * blendAt(high, 0, highWidth);
    out[k] = weight;
    total += weight;
  }
  for (let k = 0; k < count; k++) out[k] = Number(out[k]) / total;
}
/** Surface IDs/weights at a point, with a strict displacement bound below500m. */
export function surfaceWeights(
  seed: number,
  x: number,
  z: number,
  out: RegionWeights,
  workspace = createGeometryWorkspace(),
): RegionWeights {
  if (!Number.isFinite(x) || !Number.isFinite(z))
    throw new RangeError("Region point must be finite");
  warpedPoint(
    seed ^ 0x2b992ddf,
    x,
    z,
    SURFACE_WARP_AMPLITUDE,
    false,
    workspace,
  );
  const px = Number(workspace.vector[0]);
  const pz = Number(workspace.vector[1]);
  const r = Math.sqrt(px * px + pz * pz);
  const raw = workspace.raw;
  raw.fill(0);
  sectorWeights(px, pz, true, workspace.sectors);
  const innerOuterWidth = 400 + 200 * Number(workspace.sectors[1]);
  const nadirEdge = blendAt(r, 5000, 150);
  const coast = blendAt(r, 6200, 150);
  const rings = blendAt(r, 12900, innerOuterWidth);
  const rim = blendAt(r, 20500, 800);
  const frost = blendAt(r, 21500, 400);
  raw[Region.Nadir] = 1 - nadirEdge;
  raw[Region.Blackwater] = nadirEdge * (1 - coast);
  raw[Region.Rim] = rim * (1 - frost);
  raw[Region.Frost] = frost;
  for (let k = 0; k < 8; k++)
    raw[Number(OUTER[k])] = rings * (1 - rim) * Number(workspace.sectors[k]);
  sectorWeights(px, pz, false, workspace.sectors);
  for (let k = 0; k < 4; k++)
    raw[Number(INNER[k])] = coast * (1 - rings) * Number(workspace.sectors[k]);
  return projectWeights(raw, out, workspace.top);
}
/** Signed distance to nominal region edges in the already-warped XZ frame. */
export function surfaceInteriorDistance(
  region: number,
  x: number,
  z: number,
): number {
  const r = Math.sqrt(x * x + z * z);
  if (region === Region.Nadir) return 5000 - r;
  if (region === Region.Blackwater) return Math.min(r - 5000, 6200 - r);
  if (region === Region.Rim) return Math.min(r - 20500, 21500 - r);
  if (region === Region.Frost) return r - 21500;
  const outer = region < 8;
  const sector = outer ? OUTER.indexOf(region) : INNER.indexOf(region);
  if (sector < 0) throw new RangeError("Surface region required");
  const direction = outer ? sector : 1 + 2 * sector;
  const dx = Number(DIRECTIONS[direction * 2]);
  const dz = Number(DIRECTIONS[direction * 2 + 1]);
  const along = x * dx + z * dz;
  const across = x * -dz + z * dx;
  const side =
    along * (outer ? SIN_HALF_OUTER : Math.SQRT1_2) -
    Math.abs(across) * (outer ? COS_HALF_OUTER : Math.SQRT1_2);
  return Math.min(
    side,
    r - (outer ? 12900 : 6200),
    (outer ? 20500 : 12900) - r,
  );
}
export function layerRadii(layer: UndergroundLayer): readonly [number, number] {
  switch (layer) {
    case "upper_deep":
      return [6500, 16500];
    case "undercrown":
      return [3500, 11500];
    case "maw":
      return [2000, 7000];
    case "pit":
      return [0, 2200];
  }
}
/** Shared footprint warp preserves the narrow Maw/Pit overlap; no caves are carved. */
export function footprint(
  seed: number,
  layer: UndergroundLayer,
  x: number,
  z: number,
  workspace = createGeometryWorkspace(),
): number {
  warpedPoint(seed ^ 0x41c64e6d, x, z, 600, true, workspace);
  const px = Number(workspace.vector[0]);
  const pz = Number(workspace.vector[1]);
  const r = Math.sqrt(px * px + pz * pz);
  const [inner, outer] = layerRadii(layer);
  let result =
    (inner === 0 ? 1 : blendAt(r, inner, 500)) * (1 - blendAt(r, outer, 500));
  if (layer === "upper_deep") {
    // The protected Nadir/Blackwater floor is an additional invariant, not a cave.
    warpedPoint(seed ^ 0x2b992ddf, x, z, 350, false, workspace);
    const sx = Number(workspace.vector[0]);
    const sz = Number(workspace.vector[1]);
    result *= smoothUnit((Math.sqrt(sx * sx + sz * sz) - 6500) / 250);
  }
  return result;
}
const CELL_BEARINGS = new Float64Array([
  0, 45, 75, 125, 145, 180, 225, 275, 0, 50, 115, 170, 235, 0, 120, 240, 0,
]);
const CELL_RADII = new Float64Array([
  14000, 14500, 9000, 9000, 14000, 13500, 14000, 13000, 8000, 7500, 8000, 8000,
  8000, 4500, 4500, 4500, 0,
]);
export function undergroundLayerForIndex(index: number): UndergroundLayer {
  return index < 24
    ? "upper_deep"
    : index < 29
      ? "undercrown"
      : index < 32
        ? "maw"
        : "pit";
}
export function createUndergroundCells(
  seed: number,
): readonly UndergroundCell[] {
  const cells: UndergroundCell[] = [];
  const sc = new Float64Array(2);
  for (let i = 0; i < 17; i++) {
    const index = i + 16;
    detSinCos(Number(CELL_BEARINGS[i]) * (Math.PI / 180), sc);
    let jx = (2 * rand01(hash4(seed, index, 1, 0)) - 1) * 1000;
    let jz = (2 * rand01(hash4(seed, index, 1, 1)) - 1) * 1000;
    const norm = Math.max(1, Math.sqrt(jx * jx + jz * jz) / 1000);
    jx /= norm;
    jz /= norm;
    const radius = Number(CELL_RADII[i]);
    cells.push(
      Object.freeze({
        region: REGION_IDS[index] as UndergroundCell["region"],
        layer: undergroundLayerForIndex(index),
        x: radius === 0 ? 0 : Number(sc[0]) * radius + jx,
        z: radius === 0 ? 0 : -Number(sc[1]) * radius + jz,
      }),
    );
  }
  return Object.freeze(cells);
}
/** Smooth Voronoi half-plane weights with a300m pairwise border band. */
export function layerWeights(
  seed: number,
  cells: readonly UndergroundCell[],
  layer: UndergroundLayer,
  x: number,
  z: number,
  out: RegionWeights,
  workspace = createGeometryWorkspace(),
): RegionWeights {
  if (footprint(seed, layer, x, z, workspace) === 0) {
    out.count = 0;
    out.ids.fill(255);
    out.weights.fill(0);
    return out;
  }
  warpedPoint(seed ^ 0x6c078965, x, z, 700, true, workspace);
  const px = Number(workspace.vector[0]);
  const pz = Number(workspace.vector[1]);
  workspace.raw.fill(0);
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i] as UndergroundCell;
    if (cell.layer !== layer) continue;
    const dx = px - cell.x;
    const dz = pz - cell.z;
    const squared = dx * dx + dz * dz;
    let distance = Infinity;
    for (let j = 0; j < cells.length; j++) {
      if (i === j) continue;
      const other = cells[j] as UndergroundCell;
      if (other.layer !== layer) continue;
      const ox = px - other.x;
      const oz = pz - other.z;
      const cx = cell.x - other.x;
      const cz = cell.z - other.z;
      distance = Math.min(
        distance,
        (ox * ox + oz * oz - squared) / (2 * Math.sqrt(cx * cx + cz * cz)),
      );
    }
    workspace.raw[16 + i] = blendAt(distance, 0, 300);
  }
  return projectWeights(workspace.raw, out, workspace.top);
}
