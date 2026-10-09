import type { PostcardView } from "../../../client/src/game/postcard.js";
import type { Point } from "../../../client/src/game/raycast.js";
import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import type { Aabb } from "../../../shared/src/sdf/types.js";
import type {
  IbaraCalderaData,
  LavaSample,
  SurfaceRegionId,
} from "../../../shared/src/world/types.js";
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
export type HellTarget =
  | {
      readonly kind: "thorn-cluster";
      readonly featureIds: readonly number[];
      readonly bounds: Readonly<Aabb>;
      /** Local forest scene: every target thorn is rooted inside this disc. */
      readonly rootDisc?: Readonly<{ x: number; z: number; radius: number }>;
      readonly fissureId?: number;
    }
  | {
      readonly kind: "caldera";
      readonly calderaId: number;
      readonly bounds: Readonly<Aabb>;
    };
export interface HellCameraValidation extends CameraValidation {
  readonly targetFraction: number;
  readonly visibleFeatureIds: readonly number[];
  readonly lavaFraction: number;
  readonly fissureFraction: number;
  readonly targetFissureFraction: number;
  readonly targetLavaFraction: number;
  readonly visibleLavaOwners: readonly {
    readonly source: LavaSample["source"];
    readonly bodyId: number;
  }[];
}
export interface CameraFirstHit {
  readonly px: number;
  readonly py: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly block: number;
  readonly featureId: number;
  readonly distance: number;
}
interface TargetInspection {
  readonly target: HellTarget;
  readonly caldera?: IbaraCalderaData;
  lava(x: number, z: number): Readonly<LavaSample>;
  /** Tools-only observation of the SAME first hits used by the original gates. */
  onHit?(hit: CameraFirstHit): void;
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
export function cameraFrame(camera: MainCameraCandidate) {
  const direction = normalize({
    x: camera.target.x - camera.position.x,
    y: camera.target.y - camera.position.y,
    z: camera.target.z - camera.position.z,
  });
  const right = normalize(cross(direction, { x: 0, y: 1, z: 0 })),
    up = cross(right, direction),
    tangent = Math.tan((35 * Math.PI) / 180);
  const yaw = Math.atan2(direction.x, -direction.z),
    angle = ((camera.hours - 6) / 12) * Math.PI;
  const sun = normalize({
    x: -Math.cos(angle) * 0.75,
    y: Math.max(0.08, Math.sin(angle)),
    z: Math.cos(angle) * 0.65,
  });
  const sunYaw = Math.atan2(sun.x, -sun.z);
  return {
    project: (point: Point) => {
      const x = point.x - camera.position.x,
        y = point.y - camera.position.y,
        z = point.z - camera.position.z,
        depth = x * direction.x + y * direction.y + z * direction.z;
      return {
        pixelsPerMetre: 360 / (depth * tangent),
        x:
          640 +
          (360 * (x * right.x + y * right.y + z * right.z)) / (depth * tangent),
        y: 360 - (360 * (x * up.x + y * up.y + z * up.z)) / (depth * tangent),
        depth,
      };
    },
    horizonFraction: 0.5 + Math.tan(Math.asin(direction.y)) / (2 * tangent),
    sunOffsetDegrees:
      (Math.abs(Math.atan2(Math.sin(sunYaw - yaw), Math.cos(sunYaw - yaw))) *
        180) /
      Math.PI,
    sunElevationDegrees: (Math.asin(sun.y) * 180) / Math.PI,
    ray: (sx: number, sy: number) =>
      normalize({
        x:
          direction.x + right.x * sx * tangent * (16 / 9) + up.x * sy * tangent,
        y:
          direction.y + right.y * sx * tangent * (16 / 9) + up.y * sy * tangent,
        z:
          direction.z + right.z * sx * tangent * (16 / 9) + up.z * sy * tangent,
      }),
  };
}
/** Same central pixels and metre samples as final validation; this only rejects
 * impossible poses before tracing their entire 512m scene. It never accepts a camera. */
export function cameraPoseRejections(
  camera: MainCameraCandidate,
  query: CameraQuery,
): string[] {
  const frame = cameraFrame(camera),
    reasons: string[] = [];
  if (frame.horizonFraction < 0.3 || frame.horizonFraction > 0.45)
    reasons.push("horizon");
  if (
    frame.sunOffsetDegrees < 60 ||
    frame.sunOffsetDegrees > 150 ||
    frame.sunElevationDegrees < 5 ||
    frame.sunElevationDegrees > 20
  )
    reasons.push("dusk-light");
  const p = camera.position;
  if (query.voxel(p.x, p.y, p.z).block !== Block.Air) reasons.push("eye-solid");
  if (!walkableEye(query, p.x, p.y, p.z)) reasons.push("body-or-support");
  if (reasons.length) return reasons;
  for (let py = 0; py < 36; py++)
    for (let px = 0; px < 64; px++) {
      const sx = ((px + 0.5) / 64) * 2 - 1,
        sy = 1 - ((py + 0.5) / 36) * 2;
      if (Math.abs(sx) > 0.6 || Math.abs(sy) > 0.6) continue;
      const ray = frame.ray(sx, sy);
      for (let d = 1; d < 5; d++) {
        const hit = query.voxel(
          p.x + ray.x * d,
          p.y + ray.y * d,
          p.z + ray.z * d,
        );
        if (hit.density > 0 || hit.fluid !== 0) return ["central-five-metres"];
      }
    }
  return reasons;
}
/** First-pass cards retain regional coverage. HELL cards count exact target
 * owners instead. All rays query actual voxel density through the loaded radius;
 * only conservative tile upper bounds may skip an empty sample. */
export function inspectMainCamera(
  camera: MainCameraCandidate,
  query: CameraQuery,
  grid = { width: 64, height: 36 },
  targetInspection?: TargetInspection,
): HellCameraValidation {
  const frame = cameraFrame(camera),
    { horizonFraction, sunOffsetDegrees, sunElevationDegrees } = frame;
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
    centralClear = true,
    lava = 0,
    fissure = 0,
    targetLava = 0,
    targetFissure = 0;
  const visibleFeatureIds = new Set<number>();
  const visibleLavaOwners = new Map<
    string,
    { source: LavaSample["source"]; bodyId: number }
  >();
  const targetIds = new Set(
    targetInspection?.target.kind === "thorn-cluster"
      ? targetInspection.target.featureIds
      : [],
  );
  for (let py = 0; py < grid.height; py++)
    for (let px = 0; px < grid.width; px++) {
      const sx = ((px + 0.5) / grid.width) * 2 - 1,
        sy = 1 - ((py + 0.5) / grid.height) * 2;
      const ray = frame.ray(sx, sy);
      let block: number = Block.Air;
      let featureId = 0;
      let distance = 0,
        hitX = camera.position.x,
        hitY = camera.position.y,
        hitZ = camera.position.z;
      let tileX = Infinity,
        tileZ = Infinity,
        upper = Infinity;
      for (
        distance = 0;
        distance <= Math.min(512, camera.radius);
        distance += distance < 6 ? 1 : 2
      ) {
        hitX = camera.position.x + ray.x * distance;
        hitY = camera.position.y + ray.y * distance;
        hitZ = camera.position.z + ray.z * distance;
        const cx = Math.floor(hitX / 32),
          cz = Math.floor(hitZ / 32);
        if (cx !== tileX || cz !== tileZ) {
          tileX = cx;
          tileZ = cz;
          const bounds = query.bounds({
            minX: cx * 32,
            minZ: cz * 32,
            maxX: cx * 32 + 31,
            maxZ: cz * 32 + 31,
          });
          upper = Math.max(bounds.maxSolidY, bounds.maxFluidY);
        }
        // voxel() samples the containing voxel's centre, not the ray's y.
        if (Math.floor(hitY) + 0.5 > upper) continue;
        const voxel = query.voxel(hitX, hitY, hitZ);
        if (voxel.density > 0 || voxel.fluid !== 0) {
          // The query returns reused scratch storage: copy before any query.
          block = voxel.block;
          featureId = voxel.featureId ?? 0;
          break;
        }
      }
      if (block === Block.Air) sky++;
      else {
        targetInspection?.onHit?.({
          px,
          py,
          x: hitX,
          y: hitY,
          z: hitZ,
          block,
          featureId,
          distance,
        });
        if (block === Block.Water) water++;
        if (BLOCK_REGISTRY[block]?.solid) highest = Math.max(highest, hitY);
        if (targetInspection) {
          const target = targetInspection.target;
          if (target.kind === "thorn-cluster" && targetIds.has(featureId)) {
            feature++;
            visibleFeatureIds.add(featureId);
          }
          const caldera = targetInspection.caldera;
          if (
            target.kind === "caldera" &&
            caldera?.id === target.calderaId &&
            (hitX - caldera.x) ** 2 + (hitZ - caldera.z) ** 2 <=
              caldera.radius ** 2 &&
            hitY >= caldera.bounds.minY &&
            hitY <= caldera.baseY + caldera.rimHeight &&
            featureId === 0
          )
            feature++;
          if (block === Block.Lava) {
            lava++;
            const owner = targetInspection.lava(
              Math.floor(hitX) + 0.5,
              Math.floor(hitZ) + 0.5,
            );
            const bodyId = owner.bodyId,
              source = owner.source;
            if (
              source !== "none" &&
              owner.kind === "lava" &&
              Math.floor(hitY) + 0.5 > owner.bed &&
              Math.floor(hitY) + 0.5 <= owner.level
            ) {
              visibleLavaOwners.set(`${source}:${bodyId}`, { source, bodyId });
              if (source === "fissure") fissure++;
              if (
                source === "fissure" &&
                target.kind === "thorn-cluster" &&
                bodyId === target.fissureId
              )
                targetFissure++;
              if (
                target.kind === "caldera" &&
                source === "caldera" &&
                bodyId === target.calderaId
              )
                targetLava++;
            }
          }
        } else if (
          distance <= 300 &&
          query.region(hitX, hitZ) === camera.region &&
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
    targetFraction: targetInspection ? feature / total : 0,
    visibleFeatureIds: [...visibleFeatureIds].sort((a, b) => a - b),
    lavaFraction: lava / total,
    fissureFraction: fissure / total,
    targetFissureFraction: targetFissure / total,
    targetLavaFraction: targetLava / total,
    visibleLavaOwners: [...visibleLavaOwners.values()].sort((a, b) =>
      a.source < b.source ? -1 : a.source > b.source ? 1 : a.bodyId - b.bodyId,
    ),
    passed:
      passed &&
      (!targetInspection ||
        (targetInspection.target.kind === "thorn-cluster"
          ? visibleFeatureIds.size > 0 &&
            fissure > 0 &&
            (targetInspection.target.fissureId === undefined ||
              targetFissure > 0)
          : targetLava > 0)),
  };
}
export function inspectHellCamera(
  camera: MainCameraCandidate,
  query: CameraQuery,
  inspection: TargetInspection,
  grid = { width: 64, height: 36 },
): HellCameraValidation {
  return inspectMainCamera(camera, query, grid, inspection);
}
