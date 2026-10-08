import { CHUNK_SIZE, HALO_WIDTH } from "./constants.js";

function positiveFinite(value: number): void {
  if (!(value > 0) || !Number.isFinite(value))
    throw new RangeError("Expected a finite positive size");
}
/** Floor division is deliberate: -0.1 belongs to cell -1. */
export function cellIndex(position: number, size: number): number {
  positiveFinite(size);
  if (!Number.isFinite(position))
    throw new RangeError("Position must be finite");
  const index = Math.floor(position / size);
  if (!Number.isSafeInteger(index))
    throw new RangeError("Cell index exceeds exact integer range");
  return index === 0 ? 0 : index;
}
/** Euclidean remainder in [0,size), with canonical positive zero. */
export function localCoordinate(position: number, size: number): number {
  positiveFinite(size);
  if (!Number.isFinite(position))
    throw new RangeError("Position must be finite");
  const r = position % size;
  if (r === 0) return 0;
  if (r > 0) return r;
  const local = r + size;
  // A tiny negative remainder can round up to size on addition. Keep the
  // half-open contract using a lower representable value (within two ulps).
  return local < size ? local : Math.max(0, size - Number.EPSILON * size);
}
export function worldToChunk(position: number, spacing = 1): number {
  positiveFinite(spacing);
  return cellIndex(position, CHUNK_SIZE * spacing);
}
/** World-anchored voxel centre, including local halo coordinates (-1 through 39). */
export function sampleCenter(
  chunk: number,
  local: number,
  spacing = 1,
): number {
  positiveFinite(spacing);
  if (!Number.isSafeInteger(chunk) || !Number.isInteger(local))
    throw new RangeError("Integer chunk and local coordinates required");
  const lattice = chunk * CHUNK_SIZE + local;
  if (
    !Number.isSafeInteger(lattice) ||
    Math.abs(lattice) > 4_503_599_627_370_494
  )
    throw new RangeError("Centre exceeds exact half-integer range");
  const centre = (lattice + 0.5) * spacing;
  if (!Number.isFinite(centre)) throw new RangeError("Centre overflow");
  return centre;
}
/** x-fastest, then z, then y. Caller supplies core indices 0..31. */
export function voxelIndex(x: number, y: number, z: number): number {
  return x + CHUNK_SIZE * (z + CHUNK_SIZE * y);
}
/** x,z: -1..32; y: -1..39. Same x/z/y ordering as voxelIndex. */
export function haloIndex(x: number, y: number, z: number): number {
  return x + 1 + HALO_WIDTH * (z + 1 + HALO_WIDTH * (y + 1));
}

export interface ChunkAddress {
  cx: number;
  cy: number;
  cz: number;
  lod: 0 | 1;
}
function checkAddress(cx: number, cy: number, cz: number, lod: number): void {
  const divisor = lod === 0 ? 1 : 2;
  if (
    (lod !== 0 && lod !== 1) ||
    !Number.isInteger(cx) ||
    !Number.isInteger(cy) ||
    !Number.isInteger(cz) ||
    cx < -704 / divisor ||
    cx >= 704 / divisor ||
    cz < -704 / divisor ||
    cz >= 704 / divisor ||
    cy < -48 / divisor ||
    cy >= 32 / divisor
  ) {
    throw new RangeError("Chunk address outside the canonical frame");
  }
}
/** Collision-free numeric key for bounded LOD0/1 chunk addresses; no float bitwise truncation. */
export function packChunkKey(
  cx: number,
  cy: number,
  cz: number,
  lod: 0 | 1,
): number {
  checkAddress(cx, cy, cz, lod);
  return cx + 704 + 1408 * (cz + 704 + 1408 * (cy + 48 + 80 * lod));
}
export function unpackChunkKey(key: number): ChunkAddress {
  if (!Number.isSafeInteger(key) || key < 0)
    throw new RangeError("Invalid chunk key");
  const cx = (key % 1408) - 704;
  const row = Math.floor(key / 1408);
  const cz = (row % 1408) - 704;
  const plane = Math.floor(row / 1408);
  const cy = (plane % 80) - 48;
  const lod = Math.floor(plane / 80);
  checkAddress(cx, cy, cz, lod);
  return { cx, cy, cz, lod: lod as 0 | 1 };
}
