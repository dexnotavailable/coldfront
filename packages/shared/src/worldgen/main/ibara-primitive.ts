/** Deliberately regular calibration geometry; never production placement. */
import { thornFeatureId } from "../../features/ibara/cells.js";
import {
  clearIbaraSample,
  type IbaraEnvironment,
} from "../../features/ibara/types.js";
import type { Aabb } from "../../sdf/types.js";
import { WORLD_MAX_XZ, WORLD_MIN_XZ } from "../../world/constants.js";
import type { XZBounds } from "../../world/types.js";
import type { IbaraDensityBatch } from "./features.js";

export const PRIMITIVE_IBARA_SPACING = 64;
export const PRIMITIVE_IBARA_HEIGHT = 96;
export const PRIMITIVE_IBARA_RADIUS = 12;
export interface PrimitiveIbaraInstance {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly featureId: number;
  readonly bounds: Readonly<Aabb>;
}
export interface PrimitiveIbaraBatch extends IbaraDensityBatch {
  readonly instances: readonly PrimitiveIbaraInstance[];
}
export function createPrimitiveIbaraBatch(
  environment: IbaraEnvironment,
  bounds: XZBounds,
  spacing: number,
): PrimitiveIbaraBatch {
  if (!(spacing >= 1 && spacing <= 64) || !Number.isFinite(spacing))
    throw new RangeError("Unsupported Ibara sample spacing");
  if (
    ![bounds.minX, bounds.minZ, bounds.maxX, bounds.maxZ].every(
      Number.isFinite,
    ) ||
    bounds.minX > bounds.maxX ||
    bounds.minZ > bounds.maxZ
  )
    throw new RangeError("Invalid primitive query bounds");
  const radius = PRIMITIVE_IBARA_RADIUS,
    height = PRIMITIVE_IBARA_HEIGHT;
  const minX = Math.ceil(
    Math.max(WORLD_MIN_XZ, bounds.minX - radius) / PRIMITIVE_IBARA_SPACING,
  );
  const minZ = Math.ceil(
    Math.max(WORLD_MIN_XZ, bounds.minZ - radius) / PRIMITIVE_IBARA_SPACING,
  );
  const maxX = Math.floor(
    Math.min(WORLD_MAX_XZ - 1, bounds.maxX + radius) / PRIMITIVE_IBARA_SPACING,
  );
  const maxZ = Math.floor(
    Math.min(WORLD_MAX_XZ - 1, bounds.maxZ + radius) / PRIMITIVE_IBARA_SPACING,
  );
  if ((maxX - minX + 1) * (maxZ - minZ + 1) > 4096)
    throw new RangeError("Tile large primitive queries");
  const cones: PrimitiveIbaraInstance[] = [];
  for (let iz = minZ; iz <= maxZ; iz++)
    for (let ix = minX; ix <= maxX; ix++) {
      const x = ix * PRIMITIVE_IBARA_SPACING,
        z = iz * PRIMITIVE_IBARA_SPACING;
      if (environment.weightAt(x, z) < 0.5) continue;
      const y = environment.surfaceAt(x, z);
      const cellX = Math.floor(ix / 3),
        cellZ = Math.floor(iz / 3);
      const index = (iz - cellZ * 3) * 3 + ix - cellX * 3;
      cones.push({
        x,
        y,
        z,
        featureId: thornFeatureId(cellX, cellZ, 0, index),
        bounds: {
          minX: x - radius,
          maxX: x + radius,
          minZ: z - radius,
          maxZ: z + radius,
          minY: y,
          maxY: y + height,
        },
      });
    }
  const slope = radius / height,
    scale = Math.sqrt(1 + slope * slope);
  return {
    instances: cones,
    density(terrain, x, y, z, sampleSpacing, out) {
      if (
        !(sampleSpacing >= 1 && sampleSpacing <= 64) ||
        !Number.isFinite(sampleSpacing)
      )
        throw new RangeError("Unsupported Ibara sample spacing");
      clearIbaraSample(out);
      let density = terrain;
      for (const cone of cones) {
        const dx = x - cone.x,
          dz = z - cone.z,
          h = y - cone.y;
        if (
          h < 0 ||
          h > height ||
          Math.abs(dx) > radius ||
          Math.abs(dz) > radius
        )
          continue;
        const solid = Math.min(
          h,
          (radius * (1 - h / height) - Math.sqrt(dx * dx + dz * dz)) / scale,
        );
        if (solid <= density) continue;
        density = solid;
        out.distance = -solid;
        out.featureId = cone.featureId;
        out.t = h / height;
        out.kind = "thorn";
      }
      return density;
    },
  };
}
