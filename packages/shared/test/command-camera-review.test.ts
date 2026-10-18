import { describe, expect, it } from "vitest";
import { CommandCamera } from "../../client/src/game/command-camera.js";
import { Block } from "../src/blocks/registry.js";

const leftEdge = { x: 0, y: 360, width: 1280, height: 720 };

// Independent catalogue regression oracles. Authored only; root runs them.
describe("Command camera independent catalogue regressions", () => {
  it("enables C1 fullscreen edge panning without an explicit settings override", () => {
    const camera = new CommandCamera(
      { surface: () => 0 },
      { distance: 120 },
      { smoothing: 0 },
    );
    camera.step(0.2, { cursor: leftEdge, fullscreen: true });
    expect(camera.focus.x).toBeLessThan(0);
  });

  it("releases a clearance lift no faster than d metres per second", () => {
    let height = 300;
    const camera = new CommandCamera(
      { surface: () => height },
      { distance: 24 },
    );
    const liftedHeight = camera.focus.y;
    expect(liftedHeight).toBeGreaterThan(250);

    height = 0;
    const dt = 1 / 144;
    camera.step(dt);
    expect(liftedHeight - camera.focus.y).toBeLessThanOrEqual(24 * dt + 1e-8);
    expect(camera.position.y).toBeGreaterThanOrEqual(height + 6 - 1e-8);
    expect(camera.distance).toBe(24);
  });

  it("cuts half a metre below the destination's own roof, ignoring an adjacent lower roof", () => {
    const camera = new CommandCamera(
      {
        surface: () => 0,
        blocks: (x, y, z) =>
          z === 0 && ((x === 0 && y === 8) || (x === 1 && y === 2))
            ? Block.Stone
            : Block.Air,
      },
      { distance: 24 },
    );
    camera.jump({ x: 0, y: 0, z: 0 });
    expect(camera.cutHeight).toBe(7.5);
  });

  it("counts only time after the 150ms edge dwell at both 30 and 144Hz", () => {
    const travel = (fps: number) => {
      const camera = new CommandCamera(
        { surface: () => 0 },
        { distance: 120 },
        { edgePan: true, smoothing: 0 },
      );
      for (let frame = 0; frame < fps; frame++) {
        camera.step(1 / fps, { cursor: leftEdge, fullscreen: true });
      }
      return -camera.focus.x;
    };
    const low = travel(30),
      high = travel(144),
      expected = 120 * (1 - 0.15);
    expect(Math.abs(low - high) / expected).toBeLessThan(0.01);
    expect(low).toBeCloseTo(expected, 7);
    expect(high).toBeCloseTo(expected, 7);
  });

  it("also uses the own-column roof when entering Command from Overhead", () => {
    const camera = new CommandCamera({
      surface: () => 0,
      blocks: (x, y, z) => {
        if (z !== 0) return Block.Air;
        if (x === 0 && y === 3) return Block.Leaves;
        return (x === 0 && y === 8) || (x === 1 && y === 2)
          ? Block.Stone
          : Block.Air;
      },
    });
    camera.enterFromOverhead(
      {
        focus: { x: 0.5, y: 1, z: 0.5 },
        position: { x: 0.5, y: 24, z: 14.5 },
        distance: 24,
        yaw: 0,
        tilt: 55,
        cutHeight: 1.5,
      },
      { x: 0.5, y: 0, z: 0.5 },
    );
    expect(camera.cutHeight).toBe(7.5);
  });

  it("preserves key-pan time before the edge dwell and normalizes the corner afterwards", () => {
    for (const fps of [30, 144]) {
      const camera = new CommandCamera(
        { surface: () => 0 },
        { distance: 120 },
        { smoothing: 0 },
      );
      for (let frame = 0; frame < fps; frame++) {
        camera.step(1 / fps, {
          panY: 1,
          cursor: leftEdge,
          fullscreen: true,
        });
      }
      const diagonal = (120 * 0.85) / Math.sqrt(2);
      expect(camera.focus.x).toBeCloseTo(-diagonal, 7);
      expect(camera.focus.z).toBeCloseTo(-120 * 0.15 - diagonal, 7);
    }
  });
});

it("preserves the retained safety height when a captured grab crosses above the horizon", () => {
  let height = 300;
  const camera = new CommandCamera(
      { surface: () => height },
      { distance: 24, tiltOffset: -15 },
    ),
    centre = { x: 640, y: 360, width: 1280, height: 720 },
    liftedHeight = camera.focus.y;
  expect(liftedHeight).toBeGreaterThan(250);

  height = 0;
  camera.beginGrab(centre);
  // Pointer capture keeps this drag alive outside the top of the canvas.
  // No step has elapsed: the retained height has no downward travel budget.
  camera.moveGrab({ ...centre, y: -36 });

  expect(camera.focus.y).toBeGreaterThanOrEqual(liftedHeight - 1e-8);
  expect(camera.position.y).toBeGreaterThanOrEqual(6 - 1e-8);
  expect(camera.distance).toBe(24);
  expect(camera.requestedDistance).toBe(24);
  expect(
    Math.hypot(
      camera.position.x - camera.focus.x,
      camera.position.y - camera.focus.y,
      camera.position.z - camera.focus.z,
    ),
  ).toBeCloseTo(24, 9);
});
