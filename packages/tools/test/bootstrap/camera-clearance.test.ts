import { describe, expect, it, vi } from "vitest";
import { OverheadCamera } from "../../../client/src/game/camera.js";
import { Block } from "../../../shared/src/blocks/registry.js";

const body = { x: 0, y: 6, z: 0 };
const air = () => Block.Air;

describe("overhead camera clearance", () => {
  it("samples an already clear pose once without moving its focus or view choices", () => {
    const camera = new OverheadCamera();
    const surface = vi.fn((_x: number, _z: number, _cut: number) => 0);

    camera.step(0, body, air, surface, 0, 0);

    expect(surface).toHaveBeenCalledTimes(1);
    expect(surface).toHaveBeenCalledWith(
      camera.position.x,
      camera.position.z,
      Infinity,
    );
    expect(camera.focus).toEqual({ x: 0, y: 7, z: 0 });
    expect(camera.position.y).toBeGreaterThanOrEqual(6);
    expect(camera.tilt).toBe(55);
    expect(camera.chosenTilt).toBe(55);
    expect(camera.yaw).toBe(0);
    expect(camera.distance).toBe(24);
    expect(camera.requestedDistance).toBe(24);
    expect(
      Math.hypot(camera.position.y - camera.focus.y, camera.position.z),
    ).toBeCloseTo(24, 12);
  });

  it("clears a ledge with one tilt adjustment and samples each pose only once", () => {
    const camera = new OverheadCamera();
    const surface = vi.fn((_x: number, z: number, _cut: number) =>
      z < 13 ? 10 : 30,
    );

    camera.step(0, body, air, surface, 0, 0);

    expect(camera.tilt).toBe(58);
    expect(camera.position.z).toBeLessThan(13);
    expect(camera.position.y).toBeGreaterThanOrEqual(16);
    expect(camera.focus).toEqual({ x: 0, y: 7, z: 0 });
    expect(camera.chosenTilt).toBe(55);
    expect(camera.requestedDistance).toBe(24);
    expect(surface).toHaveBeenCalledTimes(2);
    expect(surface).toHaveBeenLastCalledWith(
      camera.position.x,
      camera.position.z,
      Infinity,
    );
  });

  it("stops at sixteen adjustments and lifts both eye and focus above the final slope", () => {
    const camera = new OverheadCamera();
    camera.chosenTilt = 20;
    const surface = vi.fn((_x: number, z: number, _cut: number) => 100 + z);

    camera.step(0, body, air, surface, 0, 0);

    expect(camera.tilt).toBe(68);
    expect(camera.position.y).toBeCloseTo(106 + camera.position.z, 12);
    expect(camera.focus.y).toBeGreaterThan(7);
    expect(camera.position.y - camera.focus.y).toBeCloseTo(
      24 * Math.sin((68 * Math.PI) / 180),
      12,
    );
    expect(camera.chosenTilt).toBe(20);
    expect(camera.distance).toBe(24);
    expect(camera.requestedDistance).toBe(24);
    expect(surface).toHaveBeenCalledTimes(17);
    expect(surface).toHaveBeenLastCalledWith(
      camera.position.x,
      camera.position.z,
      Infinity,
    );
  });

  it("samples the new pose at the 85 degree cap before applying the remaining lift", () => {
    const camera = new OverheadCamera();
    camera.chosenTilt = 84;
    const surface = vi.fn((_x: number, z: number, _cut: number) => 100 + z);

    camera.step(0, body, air, surface, 0, 0);

    expect(camera.tilt).toBe(85);
    expect(camera.position.y).toBeCloseTo(106 + camera.position.z, 12);
    expect(camera.position.y - camera.focus.y).toBeCloseTo(
      24 * Math.sin((85 * Math.PI) / 180),
      12,
    );
    expect(camera.chosenTilt).toBe(84);
    expect(camera.requestedDistance).toBe(24);
    expect(surface).toHaveBeenCalledTimes(2);
    expect(surface).toHaveBeenLastCalledWith(
      camera.position.x,
      camera.position.z,
      Infinity,
    );
  });

  it("resamples changed ground and the current cut on later steps at the same horizontal pose", () => {
    const camera = new OverheadCamera();
    camera.chosenTilt = 85;
    let ground = 0;
    const surface = vi.fn((_x: number, _z: number, cut: number) =>
      Math.min(ground, cut),
    );
    camera.step(0, body, air, surface, 0, 0);
    const { x, z } = camera.position;

    ground = 100;
    camera.step(0, body, air, surface, 0, 0);
    expect(camera.position).toEqual({ x, y: 106, z });
    expect(surface).toHaveBeenCalledTimes(2);

    const roof = (_x: number, y: number, _z: number) =>
      y === 10 ? Block.Stone : Block.Air;
    camera.step(0.3, body, roof, surface, 0, 0);
    expect(camera.cut.height).toBe(9.5);
    expect(camera.position.x).toBe(x);
    expect(camera.position.z).toBe(z);
    expect(camera.position.y).toBeLessThan(106);
    expect(camera.position.y).toBeGreaterThanOrEqual(15.5);
    expect(surface).toHaveBeenCalledTimes(3);
    expect(surface).toHaveBeenLastCalledWith(x, z, 9.5);

    camera.step(0.5, body, air, surface, 0, 0);
    expect(camera.cut.height).toBe(Infinity);
    expect(camera.position).toEqual({ x, y: 106, z });
    expect(surface).toHaveBeenCalledTimes(4);
    expect(surface).toHaveBeenLastCalledWith(x, z, Infinity);
    expect(camera.chosenTilt).toBe(85);
    expect(camera.requestedDistance).toBe(24);
  });
});
