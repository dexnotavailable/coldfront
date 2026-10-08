import { BLOCK_REGISTRY } from "../../../shared/src/blocks/registry.js";
import {
  WORLD_MAX_XZ,
  WORLD_MAX_Y,
  WORLD_MIN_XZ,
  WORLD_MIN_Y,
} from "../../../shared/src/world/constants.js";
import { SURFACE_REGIONS } from "../../../shared/src/world/regions.js";
import type {
  SurfaceRegionId,
  WorldIdentity,
} from "../../../shared/src/world/types.js";
import type { VoxelEdit } from "../engine/worker-protocol.js";
export interface SavedPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly flying: boolean;
}
export interface WorldSave {
  readonly schema: 2;
  readonly identity: WorldIdentity;
  readonly edits: readonly VoxelEdit[];
  readonly pose: SavedPose | null;
  readonly discoveries: readonly SurfaceRegionId[];
}
export function validIdentity(value: WorldIdentity): boolean {
  return (
    (value.kind === "main" || value.kind === "test") &&
    Number.isInteger(value.seed) &&
    value.seed >= 0 &&
    value.seed <= 0xffffffff &&
    typeof value.generation === "string" &&
    value.generation.length > 0
  );
}
export function worldKey(identity: WorldIdentity): string {
  if (!validIdentity(identity)) throw new Error("Invalid world identity");
  return JSON.stringify([identity.kind, identity.seed, identity.generation]);
}
export function sameIdentity(a: WorldIdentity, b: WorldIdentity): boolean {
  return (
    a.kind === b.kind && a.seed === b.seed && a.generation === b.generation
  );
}
export function emptyWorldSave(identity: WorldIdentity): WorldSave {
  return {
    schema: 2,
    identity: { ...identity },
    edits: [],
    pose: null,
    discoveries: [],
  };
}
export function insideFrame(x: number, y: number, z: number): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(z) &&
    x >= WORLD_MIN_XZ &&
    x < WORLD_MAX_XZ &&
    z >= WORLD_MIN_XZ &&
    z < WORLD_MAX_XZ &&
    y >= WORLD_MIN_Y &&
    y < WORLD_MAX_Y
  );
}
function edits(value: unknown): readonly VoxelEdit[] {
  if (!Array.isArray(value)) throw new Error("Invalid saved edits");
  return value.map((item) => {
    const e = item as Partial<VoxelEdit> | null;
    if (
      !e ||
      !Number.isInteger(e.x) ||
      !Number.isInteger(e.y) ||
      !Number.isInteger(e.z) ||
      !Number.isInteger(e.block) ||
      !insideFrame(Number(e.x), Number(e.y), Number(e.z)) ||
      !BLOCK_REGISTRY[Number(e.block)]
    )
      throw new Error("Invalid saved voxel edit");
    return {
      x: Number(e.x),
      y: Number(e.y),
      z: Number(e.z),
      block: Number(e.block),
    };
  });
}
export function parseWorldSave(
  value: unknown,
  identity: WorldIdentity,
  allowLegacy: boolean,
): WorldSave {
  if (value === undefined) return emptyWorldSave(identity);
  if (Array.isArray(value)) {
    if (!allowLegacy || identity.kind !== "test")
      throw new Error("Legacy save is not a matching test world");
    return { ...emptyWorldSave(identity), edits: edits(value) };
  }
  const record = value as Partial<WorldSave> | null;
  if (
    record?.schema !== 2 ||
    !record.identity ||
    !sameIdentity(record.identity, identity) ||
    !Array.isArray(record.discoveries)
  )
    throw new Error("Saved world identity/schema mismatch");
  const ids = new Set(SURFACE_REGIONS.map((region) => region.id));
  if (record.discoveries.some((id) => !ids.has(id)))
    throw new Error("Invalid saved region discovery");
  const pose = record.pose;
  if (
    pose !== null &&
    (!pose ||
      !insideFrame(pose.x, pose.y, pose.z) ||
      !Number.isFinite(pose.yaw) ||
      typeof pose.flying !== "boolean")
  )
    throw new Error("Invalid saved pose");
  return {
    schema: 2,
    identity: { ...identity },
    edits: edits(record.edits),
    pose: pose ? { ...pose } : null,
    discoveries:
      identity.kind === "test" ? [] : [...new Set(record.discoveries)],
  };
}
