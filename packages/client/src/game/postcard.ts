import type {
  SurfaceRegionId,
  WorldIdentity,
} from "../../../shared/src/world/types.js";
import type { Point } from "./raycast.js";

export type PostcardId = "TEST-1" | `P12-${SurfaceRegionId}`;
export interface PostcardView {
  readonly position: Point;
  readonly target: Point;
  readonly hours: number;
  readonly radius: number;
}
/** The bootstrap only constructs this from a locally bundled, source-matching manifest. */
export interface WorldPostcard extends PostcardView {
  readonly id: PostcardId;
  readonly identity: WorldIdentity;
}
export interface PostcardRenderReport {
  readonly id: PostcardId;
  readonly identity: WorldIdentity;
  readonly requestedChunks: number;
  readonly readyChunks: number;
  readonly planReused: boolean;
  readonly workerTimingsAreSums: true;
  readonly timings: Readonly<{
    plan: number;
    generate: number;
    light: number;
    mesh: number;
    upload: number;
    render: number;
    total: number;
  }>;
  readonly limits: Readonly<{
    dpr: 1;
    fov: 70;
    animationTime: 0;
    renderLoop: false;
    uploadCap: null;
  }>;
}
/** Conservative horizontal projection of the70-degree final camera, plus a
 * chunk-width margin. Only near terrain exists in phase1.2; no far-LOD proxy. */
export function postcardColumnVisible(
  view: PostcardView,
  cx: number,
  cz: number,
): boolean {
  const vx = view.target.x - view.position.x,
    vy = view.target.y - view.position.y,
    vz = view.target.z - view.position.z;
  const horizontal = Math.hypot(vx, vz),
    length = Math.hypot(horizontal, vy);
  if (!horizontal || !length) return true;
  const tangent = Math.tan((35 * Math.PI) / 180),
    denominator = horizontal / length - Math.abs(vy / length) * tangent;
  if (denominator <= 0) return true;
  const dx = cx * 32 + 16 - view.position.x,
    dz = cz * 32 + 16 - view.position.z;
  if (Math.hypot(dx, dz) <= 48) return true;
  const along = (dx * vx + dz * vz) / horizontal,
    across = (dx * -vz + dz * vx) / horizontal;
  return (
    along >= -32 &&
    Math.abs(across) <=
      Math.max(0, along) * ((tangent * (16 / 9)) / denominator) + 48
  );
}
