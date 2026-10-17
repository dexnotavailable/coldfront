import {
  WORLD_MAX_XZ,
  WORLD_MAX_Y,
  WORLD_MIN_XZ,
  WORLD_MIN_Y,
} from "../../world/constants.js";
import type { FarTileAddress, FarTileRequest } from "./types.js";

export const FAR_SIZE = 32;
export const FAR_WIDTH = 34;
export const FAR_COLUMN_COUNT = FAR_WIDTH * FAR_WIDTH;
export function farSpacing(address: FarTileAddress): number {
  if (!Number.isInteger(address.lod) || address.lod < 2 || address.lod > 6)
    throw new RangeError("Far LOD must be 2 through 6");
  const spacing = 1 << address.lod;
  const width = FAR_SIZE * spacing;
  if (
    !Number.isInteger(address.tx) ||
    !Number.isInteger(address.tz) ||
    address.tx * width < WORLD_MIN_XZ ||
    address.tz * width < WORLD_MIN_XZ ||
    address.tx * width >= WORLD_MAX_XZ ||
    address.tz * width >= WORLD_MAX_XZ
  )
    throw new RangeError("Far tile outside canonical frame");
  return spacing;
}
export function farColumnIndex(x: number, z: number): number {
  return x + 1 + FAR_WIDTH * (z + 1);
}
export function packFarTileKey(address: FarTileAddress): number {
  farSpacing(address);
  return address.tx + 176 + 352 * (address.tz + 176 + 352 * (address.lod - 2));
}
export function farTileKey(
  request: Pick<FarTileRequest, "address" | "layer">,
): string {
  return `${request.layer}:${packFarTileKey(request.address)}`;
}
export function quantizeFarY(y: number): number {
  if (!Number.isFinite(y)) throw new RangeError("Far endpoint must be finite");
  return Math.round(
    (Math.max(WORLD_MIN_Y, Math.min(WORLD_MAX_Y, y)) - WORLD_MIN_Y) * 16,
  );
}
export function decodeFarY(y: number): number {
  return WORLD_MIN_Y + y / 16;
}
