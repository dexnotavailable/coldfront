import { describe, expect, it } from "vitest";
import { follow, GameClocks } from "../../client/src/engine/motion.js";
import {
  AutomaticCut,
  commandTilt,
  OverheadCamera,
  wheelFactor,
} from "../../client/src/game/camera.js";
import {
  type MovementInput,
  makeBody,
  stepBody,
} from "../../client/src/game/controller.js";
import {
  actionRay,
  fallbackRay,
  raycast,
} from "../../client/src/game/raycast.js";

const input = (): MovementInput => ({
  forward: 0,
  right: 0,
  jump: false,
  sneak: false,
  sprint: false,
  yaw: 0,
  lookYaw: 0,
  fly: false,
  flySpeed: 1,
});
const ground = (_x: number, y: number, _z: number): number => (y < 0 ? 2 : 0);
describe("controller and camera pure acceptance", () => {
  it("walks at the specified terminal speed with diagonal normalization", () => {
    const b = makeBody(0, 0, 0),
      i = { ...input(), forward: 1 };
    for (let t = 0; t < 200; t++) stepBody(b, i, ground);
    const z = b.z;
    for (let t = 0; t < 20; t++) stepBody(b, i, ground);
    expect(z - b.z).toBeCloseTo(4.317, 2);
    const d = makeBody(0, 0, 0),
      diagonal = { ...input(), forward: 1, right: 1 };
    for (let t = 0; t < 200; t++) stepBody(d, diagonal, ground);
    const old = { x: d.x, z: d.z };
    for (let t = 0; t < 20; t++) stepBody(d, diagonal, ground);
    expect(Math.hypot(d.x - old.x, d.z - old.z)).toBeCloseTo(z - b.z, 4);
  });
  it("uses 0.42 jump, 0.08 gravity, 0.98 drag and stops at the floor", () => {
    const b = makeBody(0, 0, 0);
    b.grounded = true;
    stepBody(b, { ...input(), jump: true }, ground);
    expect(b.y).toBeCloseTo(0.42, 8);
    expect(b.vy).toBeCloseTo(0.3332, 8);
    let apex = b.y;
    for (let t = 0; t < 40; t++) {
      stepBody(b, input(), ground);
      apex = Math.max(apex, b.y);
    }
    expect(apex).toBeGreaterThan(1.24);
    expect(apex).toBeLessThan(1.26);
    expect(b.y).toBeCloseTo(0, 4);
  });
  it("does not shoot or place through a wall hidden by the overhead camera", () => {
    const wall = (x: number, y: number, z: number) =>
      z === -2 && x === 0 && y >= 0 && y < 3 ? 2 : 0;
    const hit = actionRay(
      wall,
      { x: 0.5, y: 1.62, z: 0.5 },
      { x: 0.5, y: 1.6, z: -8 },
    );
    expect(hit?.z).toBe(-2);
    expect(hit?.distance).toBeLessThan(5);
    expect(
      raycast(wall, { x: 0.5, y: 10, z: -1.5 }, { x: 0, y: -1, z: 0 }, 20, 1.5)
        ?.point.y,
    ).toBeLessThanOrEqual(1.5);
  });
  it("has bounded fallback rays, wheel events and documented tilt knots", () => {
    expect(wheelFactor(100000, 0)).toBe(1.25);
    expect(wheelFactor(-100000, 0)).toBe(0.8);
    expect(
      fallbackRay({ x: 0, y: 10, z: 0 }, { x: 1, y: 0, z: 0 }, 0, 24).x,
    ).toBe(96);
    [24, 120, 600, 2000, 6000].forEach((d, i) => {
      expect(commandTilt(d)).toBeCloseTo([35, 45, 58, 68, 80][i] as number, 8);
    });
  });
  it("opens only on sustained body-column cover and ignores leaves or adjacent walls", () => {
    const c = new AutomaticCut(),
      b = { x: 0.5, y: 0, z: 0.5 };
    const roof = (_x: number, y: number, _z: number) => (y === 2 ? 2 : 0);
    c.update(0.2, b, 20, roof);
    expect(c.height).toBe(Infinity);
    c.update(0.05, b, 20, roof);
    expect(c.height).toBe(1.5);
    c.update(0.49, b, 20, () => 0);
    expect(c.height).toBe(1.5);
    c.update(0.01, b, 20, () => 0);
    expect(c.height).toBe(Infinity);
    c.update(1, b, 20, (_x, y) => (y === 3 ? 8 : 0));
    expect(c.height).toBe(Infinity);
    c.update(1, b, 20, (x, y) => (x === 1 && y < 5 ? 2 : 0));
    expect(c.height).toBe(Infinity);
    c.update(1, b, 1.9, roof);
    expect(c.height).toBe(Infinity);
  });
  it("keeps camera distance and at least 6m clearance on a cliff", () => {
    const c = new OverheadCamera();
    c.step(1 / 30, { x: 0, y: 0, z: 0 }, ground, () => 40, 0, 0);
    expect(c.position.y).toBeGreaterThanOrEqual(46);
    expect(c.requestedDistance).toBe(24);
    c.zoom(1000);
    expect(c.requestedDistance).toBe(400);
    c.zoom(0.0001);
    expect(c.requestedDistance).toBe(10);
  });
  it("follows identically at 30/144Hz and separates the two clocks", () => {
    const run = (fps: number) => {
      let v = 0;
      for (let i = 0; i < fps; i++) v = follow(v, 4, 1 / fps, 0.1);
      return v;
    };
    expect(run(30)).toBeCloseTo(run(144), 10);
    const c = new GameClocks();
    c.runs = false;
    c.step(1);
    expect(c.displayMs).toBe(1000);
    expect(c.hours).toBe(12);
    c.paused = true;
    c.step(1);
    expect(c.displayMs).toBe(1000);
  });
});
