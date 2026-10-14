import { Box3, Mesh, MeshLambertMaterial, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { SmithyParts } from "../../../client/src/engine/assets/smithy-parts.js";
import { OverheadCamera } from "../../../client/src/game/camera.js";
import { makeBody } from "../../../client/src/game/controller.js";
import { sampleEarlySmithy } from "../../../shared/src/assets/structures/early-smithy.js";
import { Block } from "../../../shared/src/blocks/registry.js";

describe("smithy presentation and actual camera contracts", () => {
  it("keeps fully open door leaves outside the full two-metre aisle", () => {
    const parts = new SmithyParts();
    try {
      parts.setDoorPose(1);
      const left = new Box3().setFromObject(
        parts.doors[0] as import("three").Group,
      );
      const right = new Box3().setFromObject(
        parts.doors[1] as import("three").Group,
      );
      expect(left.max.x).toBeLessThanOrEqual(3);
      expect(right.min.x).toBeGreaterThanOrEqual(5);
      expect(Math.max(left.max.z, right.max.z)).toBeLessThanOrEqual(0);
      parts.setDoorPose(0);
      const shut = new Box3().setFromObject(
        parts.doors[0] as import("three").Group,
      );
      expect(shut.max.x).toBeCloseTo(4);
      expect(shut.max.y).toBeCloseTo(3);
    } finally {
      parts.dispose();
    }
  });
  it("grounds the anvil at 0.95 m working height and keeps bench/stations out of circulation", () => {
    const parts = new SmithyParts(() => 0.4);
    try {
      const aisle = new Box3(new Vector3(3, 0, 0), new Vector3(5, 3, 13));
      let face = 0;
      parts.group.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const bounds = new Box3().setFromObject(object);
        expect(bounds.intersectsBox(aisle), object.name).toBe(false);
        if (object.name === "anvil-face") face = bounds.max.y;
        const surfaces = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const surface of surfaces) {
          expect(surface).toBeInstanceOf(MeshLambertMaterial);
          expect(surface.emissive.getHex()).toBe(0);
          expect(surface.clippingPlanes).toContain(parts.clip);
        }
        expect(object.geometry.getAttribute("smithySky").getX(0)).toBeCloseTo(
          0.4,
        );
      });
      expect(face).toBeCloseTo(0.95);
      parts.setCut(2.5);
      expect(parts.clip.constant).toBe(2.5);
    } finally {
      parts.dispose();
    }
  });
  it("uses the unchanged Overhead camera to open a cut after entry and steepen above 70 degrees", () => {
    const camera = new OverheadCamera();
    const body = makeBody(4, 0, -2);
    const sample = (x: number, y: number, z: number) =>
      y < -1 ? Block.Dirt : sampleEarlySmithy(x, y, z);
    camera.relocate(body, sample, () => 0);
    for (let i = 0; i < 12; i++) camera.step(0.05, body, sample, () => 0, 0, 0);
    expect(camera.distance).toBe(24);
    expect(camera.cut.height).toBe(Infinity);
    body.z = 8;
    for (let i = 0; i < 30; i++) camera.step(0.05, body, sample, () => 0, 0, 0);
    expect(camera.cut.height).toBe(2.5);
    expect(camera.tilt).toBeGreaterThanOrEqual(70);
    expect(camera.cut.height).toBeGreaterThan(body.y + 1.8);
  });
});
