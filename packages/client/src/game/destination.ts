import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import {
  WORLD_MAX_XZ,
  WORLD_MAX_Y,
  WORLD_MIN_XZ,
  WORLD_MIN_Y,
} from "../../../shared/src/world/constants.js";
import type { WaterSample } from "../../../shared/src/world/types.js";
import { collides, PHYSICS } from "./controller.js";
import type { BlockQuery } from "./raycast.js";
import type { SavedPose } from "./world-save.js";
export function insideXZ(x: number, z: number): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    x >= WORLD_MIN_XZ &&
    x < WORLD_MAX_XZ &&
    z >= WORLD_MIN_XZ &&
    z < WORLD_MAX_XZ
  );
}
export function bodyInFrame(pose: {
  x: number;
  y: number;
  z: number;
}): boolean {
  return (
    insideXZ(pose.x, pose.z) &&
    pose.x - PHYSICS.halfWidth >= WORLD_MIN_XZ &&
    pose.x + PHYSICS.halfWidth < WORLD_MAX_XZ &&
    pose.z - PHYSICS.halfWidth >= WORLD_MIN_XZ &&
    pose.z + PHYSICS.halfWidth < WORLD_MAX_XZ &&
    pose.y >= WORLD_MIN_Y &&
    pose.y + PHYSICS.height < WORLD_MAX_Y
  );
}
export interface DestinationWorld {
  readonly get: BlockQuery;
  readonly surface: (x: number, z: number) => number;
  readonly water: (x: number, z: number) => WaterSample;
}
/** Preserve requested XZ. Owned water resolves above its surface with creative
 * flight; never move to an unrelated shore or silently place on a submerged bed. */
export function resolveDestination(
  world: DestinationWorld,
  x: number,
  z: number,
  yaw: number,
  preferred?: SavedPose | null,
): SavedPose {
  if (!insideXZ(x, z)) throw new RangeError("Destination outside world frame");
  if (
    preferred &&
    bodyInFrame(preferred) &&
    !collides(world.get, preferred) &&
    world.get(Math.floor(x), Math.floor(preferred.y + 0.8), Math.floor(z)) !==
      Block.Water
  )
    return { ...preferred };
  const water = world.water(x, z);
  let y = Math.max(
    world.surface(x, z),
    water.kind === "water" ? water.level : WORLD_MIN_Y,
  );
  // Surface includes edits and decorations; the body may overlap a neighbouring
  // raised voxel, so lift at this same XZ until its full1.8m volume is clear.
  y = Math.ceil(y - 1e-7) || 0;
  while (y + PHYSICS.height < WORLD_MAX_Y && collides(world.get, { x, y, z }))
    y++;
  const pose = { x, y, z, yaw, flying: false };
  if (!bodyInFrame(pose) || collides(world.get, pose))
    throw new Error("No safe destination clearance");
  let support = false;
  for (const dx of [-0.29, 0.29])
    for (const dz of [-0.29, 0.29])
      support ||=
        BLOCK_REGISTRY[
          world.get(
            Math.floor(x + dx),
            Math.floor(y - 0.01),
            Math.floor(z + dz),
          )
        ]?.solid ?? false;
  pose.flying = !support;
  return pose;
}
