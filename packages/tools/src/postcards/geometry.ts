import type { PostcardView } from "../../../client/src/game/postcard.js";
import type { Point } from "../../../client/src/game/raycast.js";
import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import type { SurfaceRegionId } from "../../../shared/src/world/types.js";
import { type CameraQuery, walkableEye } from "./query.js";
export interface CameraValidation {
  readonly eyeClear: boolean;
  readonly walkable: boolean;
  readonly centralClear: boolean;
  readonly skyFraction: number;
  readonly featureFraction: number;
  readonly waterFraction: number;
  readonly horizonFraction: number;
  readonly sunOffsetDegrees: number;
  readonly sunElevationDegrees: number;
  readonly highestVisibleSample: number | null;
  readonly altitudeAboveHighestSample: number | null;
  readonly rayColumns: number;
  readonly rayRows: number;
  readonly passed: boolean;
}
export interface MainCameraCandidate extends PostcardView {
  readonly region: SurfaceRegionId;
  readonly kind: "eye-level" | "aerial";
  readonly terrainUpperBound?: number;
}
const normalize = (p: Point): Point => {
  const d = Math.hypot(p.x, p.y, p.z);
  if (!d) throw new Error("Zero camera direction");
  return { x: p.x / d, y: p.y / d, z: p.z / d };
};
const cross = (a: Point, b: Point): Point => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
/** Main first-pass cards use exact voxel density/fluid to300m, then height only.
 * The view's feature is current region terrain/palette (water for named lakes),
 * never a claim that a later milestone's structures or thorns already exist. */
export function inspectMainCamera(
  camera: MainCameraCandidate,
  query: CameraQuery,
  grid = { width: 64, height: 36 },
): CameraValidation {
  const direction = normalize({
    x: camera.target.x - camera.position.x,
    y: camera.target.y - camera.position.y,
    z: camera.target.z - camera.position.z,
  });
  const right = normalize(cross(direction, { x: 0, y: 1, z: 0 })),
    up = cross(right, direction);
  const tangent = Math.tan((35 * Math.PI) / 180),
    yaw = Math.atan2(direction.x, -direction.z),
    angle = ((camera.hours - 6) / 12) * Math.PI;
  const sun = normalize({
    x: -Math.cos(angle) * 0.75,
    y: Math.max(0.08, Math.sin(angle)),
    z: Math.cos(angle) * 0.65,
  });
  const sunYaw = Math.atan2(sun.x, -sun.z);
  const sunOffsetDegrees =
    (Math.abs(Math.atan2(Math.sin(sunYaw - yaw), Math.cos(sunYaw - yaw))) *
      180) /
    Math.PI;
  const sunElevationDegrees = (Math.asin(sun.y) * 180) / Math.PI;
  const horizonFraction =
    0.5 + Math.tan(Math.asin(direction.y)) / (2 * tangent);
  const eyeClear =
    query.voxel(camera.position.x, camera.position.y, camera.position.z)
      .block === Block.Air;
  const walkable = walkableEye(
    query,
    camera.position.x,
    camera.position.y,
    camera.position.z,
  );
  let sky = 0,
    water = 0,
    feature = 0,
    highest = -Infinity,
    centralClear = true;
  for (let py = 0; py < grid.height; py++)
    for (let px = 0; px < grid.width; px++) {
      const sx = ((px + 0.5) / grid.width) * 2 - 1,
        sy = 1 - ((py + 0.5) / grid.height) * 2;
      const ray = normalize({
        x:
          direction.x + right.x * sx * tangent * (16 / 9) + up.x * sy * tangent,
        y:
          direction.y + right.y * sx * tangent * (16 / 9) + up.y * sy * tangent,
        z:
          direction.z + right.z * sx * tangent * (16 / 9) + up.z * sy * tangent,
      });
      let block: number = Block.Air;
      let distance = 0,
        hitX = camera.position.x,
        hitY = camera.position.y,
        hitZ = camera.position.z;
      for (distance = 0; distance <= 300; distance += 2) {
        hitX = camera.position.x + ray.x * distance;
        hitY = camera.position.y + ray.y * distance;
        hitZ = camera.position.z + ray.z * distance;
        const voxel = query.voxel(hitX, hitY, hitZ);
        if (voxel.density > 0 || voxel.fluid !== 0) {
          block = voxel.block;
          break;
        }
      }
      // Beyond the dense ray range, use height only, as the resolver spec requires.
      if (block === Block.Air)
        for (distance = 308; distance <= 512; distance += 8) {
          hitX = camera.position.x + ray.x * distance;
          hitY = camera.position.y + ray.y * distance;
          hitZ = camera.position.z + ray.z * distance;
          if (hitY < query.height(hitX, hitZ)) {
            block = Block.Stone;
            break;
          }
        }
      if (block === Block.Air) sky++;
      else {
        if (block === Block.Water) water++;
        if (BLOCK_REGISTRY[block]?.solid) highest = Math.max(highest, hitY);
        const regionHit = query.region(hitX, hitZ) === camera.region;
        if (
          distance <= 300 &&
          regionHit &&
          ((camera.region !== "lake" && camera.region !== "blackwater") ||
            block === Block.Water)
        )
          feature++;
        if (distance < 5 && Math.abs(sx) <= 0.6 && Math.abs(sy) <= 0.6)
          centralClear = false;
      }
    }
  const total = grid.width * grid.height;
  const aerial =
    camera.kind !== "aerial" ||
    (Number.isFinite(camera.terrainUpperBound) &&
      camera.position.y >= Number(camera.terrainUpperBound) + 12 &&
      highest < camera.position.y);
  const passed =
    eyeClear &&
    (camera.kind === "aerial" || walkable) &&
    centralClear &&
    aerial &&
    sky / total >= 0.2 &&
    sky / total <= 0.65 &&
    feature / total >= 0.15 &&
    horizonFraction >= 0.3 &&
    horizonFraction <= 0.45 &&
    sunOffsetDegrees >= 60 &&
    sunOffsetDegrees <= 150 &&
    sunElevationDegrees >= 5 &&
    sunElevationDegrees <= 20;
  return {
    eyeClear,
    walkable,
    centralClear,
    skyFraction: sky / total,
    featureFraction: feature / total,
    waterFraction: water / total,
    horizonFraction,
    sunOffsetDegrees,
    sunElevationDegrees,
    highestVisibleSample: Number.isFinite(highest) ? highest : null,
    altitudeAboveHighestSample: Number.isFinite(highest)
      ? camera.position.y - highest
      : null,
    rayColumns: grid.width,
    rayRows: grid.height,
    passed,
  };
}
