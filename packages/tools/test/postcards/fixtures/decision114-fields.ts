import { Block } from "../../../../shared/src/blocks/registry.js";
import type { VoxelSample } from "../../../../shared/src/world/types.js";
import type { MainCameraCandidate } from "../../../src/postcards/geometry.js";
import type { CameraQuery } from "../../../src/postcards/query.js";

export type Decision114Field =
  | "flat"
  | "wall"
  | "raised"
  | "tagged-floor"
  | "water"
  | "lava";
export const decision114Cases: readonly {
  name: string;
  pitch: number;
  field: Decision114Field;
}[] = [
  { name: "flat-up", pitch: -5, field: "flat" },
  { name: "flat-level", pitch: 0, field: "flat" },
  { name: "flat-4.25", pitch: 4.25, field: "flat" },
  { name: "flat-7", pitch: 7, field: "flat" },
  { name: "flat-9", pitch: 9, field: "flat" },
  { name: "wall-level", pitch: 0, field: "wall" },
  { name: "wall-4.25", pitch: 4.25, field: "wall" },
  { name: "raised-4.25", pitch: 4.25, field: "raised" },
  { name: "tagged-floor", pitch: 4.25, field: "tagged-floor" },
  { name: "water", pitch: 4.25, field: "water" },
  { name: "lava", pitch: 4.25, field: "lava" },
];
export function decision114Camera(pitch: number): MainCameraCandidate {
  return {
    region: "hellscape",
    kind: "eye-level",
    position: { x: 0.5, y: 1.62, z: 0.5 },
    target: {
      x: 0.5,
      y: 1.62 - 64 * Math.tan((pitch * Math.PI) / 180),
      z: 64.5,
    },
    hours: 17.25,
    radius: 512,
  };
}
/** The audit's flat voxel half-space and tagged wall, plus explicit nearby
 * terrain/feature/fluid fixtures. No world generator or plan is involved. */
export function decision114Query(kind: Decision114Field): CameraQuery {
  const scratch: VoxelSample = {
    density: -1,
    block: Block.Air,
    fluid: 0,
    featureId: 0,
  };
  const patch = (x: number, z: number) => x >= -2 && x <= 3 && z >= 3 && z < 5;
  return {
    voxel(x, y, z) {
      const cx = Math.floor(x) + 0.5,
        cy = Math.floor(y) + 0.5,
        cz = Math.floor(z) + 0.5,
        inPatch = patch(cx, cz);
      const wall = kind === "wall" && inPatch && cz < 4 && cy >= 0 && cy < 4;
      const raised = kind === "raised" && inPatch && cy >= 0 && cy < 1;
      const nearFloor = inPatch && cy >= -1 && cy < 0;
      const fluid =
        nearFloor && (kind === "water" || kind === "lava")
          ? kind === "water"
            ? Block.Water
            : Block.Lava
          : 0;
      const solid = !fluid && (cy < 0 || wall || raised);
      return Object.assign(scratch, {
        density: solid ? 1 : -1,
        block: fluid || (solid ? Block.Basalt : Block.Air),
        fluid,
        featureId: wall || (nearFloor && kind === "tagged-floor") ? 99 : 0,
      });
    },
    ground: (x, z) =>
      kind === "raised" && patch(Math.floor(x) + 0.5, Math.floor(z) + 0.5)
        ? 1
        : (kind === "water" || kind === "lava") &&
            patch(Math.floor(x) + 0.5, Math.floor(z) + 0.5)
          ? -1
          : 0,
    height: () => (kind === "wall" ? 4 : kind === "raised" ? 1 : 0),
    region: () => "hellscape",
    walkableFeet: () => 0,
    clear() {},
    bounds: () => ({
      minSurfaceY: 0,
      maxSurfaceY: kind === "raised" ? 1 : 0,
      maxSolidY: kind === "wall" ? 4 : kind === "raised" ? 1 : 0,
      maxFluidY: 0,
    }),
  };
}
export const decision114Target = {
  kind: "thorn-cluster" as const,
  featureIds: [99],
  fissureId: 7,
  bounds: { minX: -2, maxX: 3, minY: -1, maxY: 4, minZ: 3, maxZ: 5 },
};
export const decision114Lava = () => ({
  kind: "lava" as const,
  source: "fissure" as const,
  bodyId: 7,
  bed: -1,
  level: 0,
});
