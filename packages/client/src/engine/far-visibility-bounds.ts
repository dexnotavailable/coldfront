import {
  WORLD_MAX_XZ,
  WORLD_MAX_Y,
  WORLD_MIN_XZ,
  WORLD_MIN_Y,
} from "../../../shared/src/world/constants.js";
import type { LayerId, WorldContext } from "../../../shared/src/world/types.js";
import {
  farSpacing,
  packFarTileKey,
} from "../../../shared/src/worldgen/far/coordinates.js";
import type { FarTileAddress } from "../../../shared/src/worldgen/far/types.js";
import type { Point } from "../game/raycast.js";

type HeightBounds = Readonly<{ minY: number; maxY: number }>;
const FULL_HEIGHT: HeightBounds = Object.freeze({
  minY: WORLD_MIN_Y,
  maxY: WORLD_MAX_Y,
});
export interface FarVisibilityView {
  readonly layer: LayerId;
  readonly camera: Point;
  readonly cut: number;
  readonly edits: Iterable<Readonly<{ x: number; y: number; z: number }>>;
}
/** Visibility envelope, NOT the complete mesh AABB. Certified opaque ground
 * occludes its internal base faces/skirts from an exterior eye. Every stored run
 * and mesh remains full-height. Unknown sources/layers/underside views keep the
 * canonical envelope; boundary walls always keep their full lower extent. */
export function createFarVisibilityBounds(
  context: Pick<
    WorldContext,
    "conservativeBounds" | "farVisibilityCertificate"
  >,
  view: FarVisibilityView,
): (address: FarTileAddress) => HeightBounds {
  if (
    !context.farVisibilityCertificate ||
    !Number.isFinite(view.camera.y) ||
    view.camera.y < WORLD_MIN_Y
  )
    return () => FULL_HEIGHT;
  if (!Number.isFinite(view.cut) && view.cut !== Infinity)
    throw new RangeError("Invalid far visibility cut");
  const cut = Math.max(WORLD_MIN_Y, Math.min(WORLD_MAX_Y, view.cut));
  const edits = [...view.edits];
  // This small cache belongs to one plan construction/balance pass only.
  const cache = new Map<number, HeightBounds>();
  return (address) => {
    const key = packFarTileKey(address);
    const cached = cache.get(key);
    if (cached) return cached;
    const spacing = farSpacing(address),
      width = 32 * spacing;
    const x = address.tx * width,
      z = address.tz * width,
      halo = 2 * spacing;
    // Include the owned generator's s halo and a balanced coarser neighbor's
    // 2s footprint. A cliff face reaches its neighbor's ground, not just its own.
    const footprint = {
      minX: x - halo,
      minZ: z - halo,
      maxX: x + width + halo,
      maxZ: z + width + halo,
    };
    const certificate = context.farVisibilityCertificate?.(
      view.layer,
      footprint,
    );
    if (
      !certificate ||
      certificate.layer !== view.layer ||
      certificate.solidBase !== true ||
      !Number.isFinite(certificate.displacement) ||
      certificate.displacement < 0
    ) {
      cache.set(key, FULL_HEIGHT);
      return FULL_HEIGHT;
    }
    const source = context.conservativeBounds(footprint, {
      minSurfaceY: 0,
      maxSurfaceY: 0,
      maxSolidY: 0,
      maxFluidY: -Infinity,
    });
    const high = Math.max(
      source.maxSurfaceY,
      source.maxSolidY,
      source.maxFluidY,
    );
    if (
      !Number.isFinite(source.minSurfaceY) ||
      !Number.isFinite(high) ||
      source.minSurfaceY > high
    )
      return FULL_HEIGHT;
    let minY =
      source.minSurfaceY - Math.max(2 * spacing, certificate.displacement + 16);
    let maxY = high + Math.max(2 * spacing, certificate.displacement + 8);
    for (const edit of edits)
      if (
        edit.x >= footprint.minX &&
        edit.x < footprint.maxX &&
        edit.z >= footprint.minZ &&
        edit.z < footprint.maxZ
      ) {
        // Include removal floors/ceilings as well as added towers. This is
        // conservative even when one Air edit is too small for a coarse slab.
        minY = Math.min(minY, edit.y - 1);
        maxY = Math.max(maxY, edit.y + 2);
      }
    // A cut below the source band exposes a real horizontal cap there. Do not
    // invert/erase that envelope or keep a stale surface-only lower bound.
    minY = Math.min(minY, cut);
    maxY = Math.min(maxY, cut);
    minY = Math.max(WORLD_MIN_Y, minY);
    maxY = Math.max(minY, Math.min(WORLD_MAX_Y, maxY));
    const edge =
      x === WORLD_MIN_XZ ||
      x + width === WORLD_MAX_XZ ||
      z === WORLD_MIN_XZ ||
      z + width === WORLD_MAX_XZ;
    // An eye beneath the certified exterior can see unproved undersides.
    // Preserve all geometry below it instead of inferring an exterior camera.
    if (edge || view.camera.y <= minY) minY = WORLD_MIN_Y;
    const result = Object.freeze({ minY, maxY });
    cache.set(key, result);
    return result;
  };
}
