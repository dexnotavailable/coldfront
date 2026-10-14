import { Box3, Mesh, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  HOUSE_DOOR,
  HouseDoor,
} from "../../../client/src/engine/assets/house-door.js";
import { HEARTHLANDS_HOUSE as house } from "../../../shared/src/assets/structures/hearthlands-house.js";

function bounds(door: HouseDoor): Box3 {
  return new Box3().setFromObject(door.leaf);
}

function overlapsVolume(a: Box3, b: Box3): boolean {
  return (["x", "y", "z"] as const).every(
    (axis) =>
      Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]) >
      0.000001,
  );
}

describe("Hearthlands presentation door", () => {
  it("fits the existing one-by-two-metre aperture with a grounded, thin closed leaf", () => {
    const door = new HouseDoor();
    try {
      const box = bounds(door);
      expect(house.pendingParts.door.min).toEqual([6, 1, 4]);
      expect(house.pendingParts.door.max).toEqual([7, 3, 5]);
      expect(box.min.x).toBeCloseTo(6.04, 6);
      expect(box.max.x).toBeCloseTo(6.96, 6);
      expect(box.min.y).toBeCloseTo(1.02, 6);
      expect(box.max.y).toBeCloseTo(2.98, 6);
      expect(box.min.z).toBeCloseTo(3.9, 6);
      expect(box.max.z).toBeCloseTo(3.98, 6);
      const visitor = new Box3(
        new Vector3(6.2, 1, 3.5),
        new Vector3(6.8, 2.8, 4.5),
      );
      expect(overlapsVolume(box, visitor)).toBe(true);
      // This is a visible closed pose, not a collision or enclosure registration.
      expect(house.state).toBe("geometry-study-pending-functional-parts");
    } finally {
      door.dispose();
    }
  });

  it("keeps the hinge fixed and fully opens outside the unchanged avatar approach", () => {
    const door = new HouseDoor();
    try {
      const before = door.hinge.getWorldPosition(new Vector3());
      door.setOpen(HOUSE_DOOR.poses.open);
      expect(
        door.hinge.getWorldPosition(new Vector3()).distanceTo(before),
      ).toBe(0);
      const open = bounds(door);
      expect(open.min.x).toBeCloseTo(6, 6);
      expect(open.max.x).toBeCloseTo(6.08, 6);
      expect(open.min.z).toBeCloseTo(3.02, 6);
      expect(open.max.z).toBeCloseTo(3.94, 6);
      const route = new Box3(new Vector3(6.2, 1, 1), new Vector3(6.8, 2.8, 14));
      expect(overlapsVolume(open, route)).toBe(false);
      door.setOpen(HOUSE_DOOR.poses.closed);
      expect(bounds(door).max.x).toBeCloseTo(6.96, 6);
    } finally {
      door.dispose();
    }
  });

  it("keeps every sampled swing pose clear of the accepted shell, canopy and stoop", () => {
    const door = new HouseDoor();
    try {
      for (let step = 0; step <= 18; step++) {
        door.setOpen(step / 18);
        const leaf = bounds(door);
        for (const voxel of house.voxels) {
          const solid = new Box3(
            new Vector3(voxel.x, voxel.y, voxel.z),
            new Vector3(voxel.x + 1, voxel.y + 1, voxel.z + 1),
          );
          // An AABB is conservative during rotation: a pass also clears the leaf.
          expect(
            overlapsVolume(leaf, solid),
            `pose ${step}, voxel ${voxel.x}/${voxel.y}/${voxel.z}`,
          ).toBe(false);
        }
      }
    } finally {
      door.dispose();
    }
  });

  it("keeps depth placement and cut in sync after translation and pose changes", () => {
    const door = new HouseDoor();
    try {
      door.group.position.set(24, 0, 24);
      for (const pose of [0, 0.5, 1]) {
        door.setOpen(pose);
        const visible = bounds(door);
        const depth = new Box3().setFromObject(door.depth);
        expect(depth.min.distanceTo(visible.min)).toBeLessThan(0.000001);
        expect(depth.max.distanceTo(visible.max)).toBeLessThan(0.000001);
      }
      door.setCut(2.5);
      expect(door.leaf.material.clippingPlanes).toContain(door.clip);
      door.depth.traverse((part) => {
        if (part instanceof Mesh)
          expect(part.material.clippingPlanes).toContain(door.clip);
      });
      expect(door.clip.constant).toBe(2.5);
      door.setCut(Infinity);
      expect(door.clip.constant).toBe(100000);
    } finally {
      door.dispose();
    }
  });

  it("uses solved sky without emission and rejects invalid presentation poses", () => {
    const door = new HouseDoor(() => 0.4);
    try {
      const colour = door.leaf.geometry.getAttribute("color");
      expect(colour.getX(0)).toBeCloseTo(0.478, 6);
      expect(door.leaf.material.emissive.getHex()).toBe(0);
      expect(door.leaf.material.map?.image).toMatchObject({
        width: 16,
        height: 16,
      });
      expect(() => door.setOpen(Number.NaN)).toThrow(RangeError);
      door.setOpen(3);
      expect(bounds(door).max.x).toBeCloseTo(6.08, 6);
      door.setOpen(-2);
      expect(bounds(door).max.x).toBeCloseTo(6.96, 6);
    } finally {
      door.dispose();
    }
  });
});
