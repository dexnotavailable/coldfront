import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { commandTilt } from "../../client/src/game/camera.js";
import {
  type CameraCursor,
  type CameraPose,
  COMMAND_CAMERA,
  CommandCamera,
  type CommandEnvironment,
  type CommandInput,
  commandProject,
  commandScreenRay,
  type FollowTarget,
} from "../../client/src/game/command-camera.js";
import type { Point } from "../../client/src/game/raycast.js";
import { Block } from "../src/blocks/registry.js";

const cursor: CameraCursor = { x: 935, y: 188, width: 1280, height: 720 };
const centre: CameraCursor = { ...cursor, x: 640, y: 360 };

function plane(height = 0, slopeX = 0, slopeZ = 0): CommandEnvironment {
  return {
    surface: (x, z, cut) => Math.min(height + slopeX * x + slopeZ * z, cut),
    raycast(origin, direction, limit, cut) {
      const floor = height + slopeX * origin.x + slopeZ * origin.z,
        denominator = direction.y - slopeX * direction.x - slopeZ * direction.z;
      if (Math.abs(denominator) < 1e-10) return null;
      let t = (floor - origin.y) / denominator;
      const hitY = origin.y + direction.y * t;
      if (hitY > cut && direction.y < 0) t = (cut - origin.y) / direction.y;
      if (t < 0 || t > limit) return null;
      return {
        x: origin.x + direction.x * t,
        y: origin.y + direction.y * t,
        z: origin.z + direction.z * t,
      };
    },
  };
}

function drive(
  camera: CommandCamera,
  seconds: number,
  fps: number,
  input: CommandInput = {},
): void {
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i++) camera.step(seconds / frames, input);
}

/** Independent CPU oracle: no WebGL renderer or browser is created. */
function pixels(pose: CameraPose, point: Point, viewport = cursor) {
  const camera = new PerspectiveCamera(
    40,
    viewport.width / viewport.height,
    0.1,
    50000,
  );
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  camera.lookAt(pose.focus.x, pose.focus.y, pose.focus.z);
  camera.updateMatrixWorld();
  const projected = new Vector3(point.x, point.y, point.z).project(camera);
  return {
    x: ((projected.x + 1) / 2) * viewport.width,
    y: ((1 - projected.y) / 2) * viewport.height,
  };
}

function pixelError(pose: CameraPose, point: Point, target = cursor): number {
  const screen = pixels(pose, point, target);
  return Math.hypot(screen.x - target.x, screen.y - target.y);
}

describe("Command camera C1/C7 projection and anchors", () => {
  it("uses a 40 degree vertical lens without changing the pose on resize", () => {
    const camera = new CommandCamera(plane(), { distance: 120, yaw: 61 }),
      before = camera.snapshot(),
      wide = { ...cursor, x: 1500, y: 380, width: 1920, height: 1080 },
      point = camera.groundPoint(wide),
      reference = pixels(camera, point, wide),
      projected = commandProject(camera, point, wide);
    expect(camera.fov).toBe(40);
    expect(projected?.x).toBeCloseTo(reference.x, 8);
    expect(projected?.y).toBeCloseTo(reference.y, 8);
    expect(pixelError(camera, point, wide)).toBeLessThan(1e-7);
    expect(camera.snapshot()).toEqual(before);
    const ray = commandScreenRay(camera, wide);
    expect(
      Math.hypot(ray.direction.x, ray.direction.y, ray.direction.z),
    ).toBeCloseTo(1, 12);
  });

  it.each([30, 144])(
    "holds terrain beneath the cursor during every zoom easing frame at %i Hz",
    (fps) => {
      for (const distance of [24, 120, 600, 2000, 6000]) {
        for (const direction of [-1, 1]) {
          const camera = new CommandCamera(plane(), { distance, yaw: 37 }),
            original = camera.groundPoint(cursor);
          for (let notch = 0; notch < 6; notch++)
            camera.wheel(direction * 100, 0, cursor);
          for (let frame = 0; frame < fps * 2; frame++) {
            camera.step(1 / fps);
            expect(pixelError(camera, original)).toBeLessThan(2);
          }
          expect(camera.distance).toBeGreaterThanOrEqual(24);
          expect(camera.distance).toBeLessThanOrEqual(6000);
        }
      }
    },
  );

  it("keeps the zoom anchor while focus height catches up on sloping ground", () => {
    const camera = new CommandCamera(plane(30, 0.18, -0.12), {
        distance: 300,
        yaw: 118,
        focus: { x: 0, y: 30, z: 0 },
      }),
      anchor = camera.groundPoint(cursor);
    camera.wheel(-100, 0, cursor);
    for (let frame = 0; frame < 90; frame++) {
      camera.step(1 / 60);
      expect(pixelError(camera, anchor)).toBeLessThan(2);
    }
  });

  it("grabs a fixed ground point exactly and releases without horizontal drift", () => {
    const camera = new CommandCamera(plane(), { distance: 180, yaw: -64 }),
      anchor = camera.groundPoint(cursor);
    camera.beginGrab(cursor);
    for (let i = 1; i <= 20; i++) {
      const moved = { ...cursor, x: cursor.x + i * 7, y: cursor.y + i * 3 };
      camera.moveGrab(moved);
      camera.step(1 / 30, { panX: 1 });
      expect(pixelError(camera, anchor, moved)).toBeLessThan(2);
    }
    camera.endGrab();
    const released = { ...camera.focus };
    drive(camera, 2, 144);
    expect(camera.focus.x).toBeCloseTo(released.x, 10);
    expect(camera.focus.z).toBeCloseTo(released.z, 10);
  });

  it("holds ground height during a grab, then catches up on release", () => {
    let height = 0;
    const camera = new CommandCamera({
      ...plane(),
      surface: () => height,
    });
    camera.beginGrab(centre);
    height = 4;
    drive(camera, 1, 60);
    expect(camera.focus.y).toBe(0);
    camera.endGrab();
    drive(camera, 1, 60);
    expect(camera.focus.y).toBeGreaterThan(3.8);
    expect(camera.focus.y).toBeLessThan(4);
  });

  it("falls back at the focus plane, limits sky rays to 4d, and caps zoom anchors at 3d", () => {
    const camera = new CommandCamera(
        { surface: () => 0 },
        {
          distance: 24,
          tiltOffset: -15,
        },
      ),
      ground = camera.groundPoint(centre);
    expect(ground.x).toBeCloseTo(camera.focus.x, 8);
    expect(ground.y).toBeCloseTo(camera.focus.y, 8);
    expect(ground.z).toBeCloseTo(camera.focus.z, 8);
    const sky = { ...centre, y: 0 },
      fallback = camera.groundPoint(sky);
    expect(
      Math.hypot(
        fallback.x - camera.position.x,
        fallback.y - camera.position.y,
        fallback.z - camera.position.z,
      ),
    ).toBeLessThanOrEqual(96 + 1e-8);
    camera.wheel(-100, 0, sky);
    const anchor = camera.anchor;
    expect(anchor?.limited).toBe(true);
    expect(anchor).not.toBeNull();
    if (!anchor) throw new Error("Expected a capped sky anchor");
    expect(
      Math.hypot(
        anchor.point.x - camera.focus.x,
        anchor.point.y - camera.focus.y,
        anchor.point.z - camera.focus.z,
      ),
    ).toBeCloseTo(72, 8);
    drive(camera, 1, 60);
    expect(Number.isFinite(camera.position.x)).toBe(true);
    expect(Number.isFinite(camera.position.y)).toBe(true);
    expect(Number.isFinite(camera.position.z)).toBe(true);
  });

  it("rejects an injected hit beyond reach or above the drawn cut", () => {
    const hidden = new CommandCamera(
        {
          surface: () => 0,
          raycast: () => ({ x: 0, y: 100, z: 0 }),
        },
        { cutHeight: 5 },
      ),
      tooFar = new CommandCamera({
        surface: () => 0,
        raycast: () => ({ x: 100000, y: 0, z: 0 }),
      });
    expect(hidden.groundPoint(centre).y).toBeLessThanOrEqual(5);
    expect(tooFar.groundPoint(centre).x).toBeCloseTo(0, 8);
  });

  it("zooms toward the focus when cursor zoom is off", () => {
    const camera = new CommandCamera(plane(), {}, { cursorZoom: false });
    camera.wheel(-100, 0, cursor);
    drive(camera, 1, 60);
    expect(camera.focus.x).toBe(0);
    expect(camera.focus.z).toBe(0);
    expect(camera.anchor).toBeNull();
  });
});

describe("Command camera C1/B2 motion", () => {
  it("integrates the 120ms rise/80ms fall, normalizes diagonals, and scales Shift", () => {
    const run = (input: CommandInput) => {
      const camera = new CommandCamera(plane(), { distance: 120 });
      drive(camera, 1, 60, input);
      drive(camera, 1, 60, { fast: input.fast ?? false });
      return Math.hypot(camera.focus.x, camera.focus.z);
    };
    const straight = run({ panY: 1 });
    expect(straight).toBeCloseTo(117.6, 6);
    expect(run({ panX: 1, panY: 1 })).toBeCloseTo(straight, 6);
    expect(run({ panY: 1, fast: true })).toBeCloseTo(straight * 2.5, 6);
    const instant = new CommandCamera(
      plane(),
      { distance: 120, yaw: 90 },
      { smoothing: 0 },
    );
    instant.step(0.1, { panY: 1 });
    expect(instant.focus.x).toBeCloseTo(12, 8);
    expect(instant.focus.z).toBeCloseTo(0, 8);
  });

  it("finishes the same mixed camera drive at 30 and 144Hz within one percent", () => {
    const run = (fps: number) => {
      const camera = new CommandCamera(plane(), { distance: 180, yaw: 21 });
      drive(camera, 1, fps, { panX: 1, panY: 1, fast: true, zoom: 1, turn: 1 });
      drive(camera, 1, fps);
      camera.wheel(-100, 0, cursor);
      drive(camera, 1, fps);
      return camera;
    };
    const low = run(30),
      high = run(144),
      error = Math.hypot(
        low.focus.x - high.focus.x,
        low.focus.z - high.focus.z,
      ),
      travel = Math.hypot(high.focus.x, high.focus.z);
    expect(error / travel).toBeLessThan(0.01);
    expect(Math.abs(low.distance - high.distance) / high.distance).toBeLessThan(
      0.01,
    );
    expect(Math.abs(low.tilt - high.tilt)).toBeLessThan(0.1);
    expect(low.yaw).toBeCloseTo(high.yaw, 8);
  });

  it("uses six wheel notches per second for keys and caps individual wheel/pinch events", () => {
    const keys = new CommandCamera(plane(), { distance: 120 }),
      wheel = new CommandCamera(plane(), { distance: 120 });
    drive(keys, 1, 60, { zoom: 1 });
    for (let i = 0; i < 6; i++) wheel.wheel(100, 0);
    expect(keys.requestedDistance).toBeCloseTo(wheel.requestedDistance, 8);
    const bounded = new CommandCamera(plane(), { distance: 120 });
    bounded.wheel(1e6, 0);
    expect(bounded.requestedDistance).toBe(150);
    bounded.pinch(1e6);
    expect(bounded.requestedDistance).toBe(120);
    const line = new CommandCamera(plane(), { distance: 120 }),
      page = new CommandCamera(plane(), { distance: 120 });
    line.wheel(3, 1);
    page.wheel(0.25, 2);
    expect(line.requestedDistance).toBeCloseTo(page.requestedDistance, 10);
  });

  it("keeps short right presses still and never turns a moved press into a click", () => {
    const camera = new CommandCamera(plane()),
      before = { yaw: camera.yaw, offset: camera.tiltOffset },
      moved = { ...cursor, x: cursor.x + 40, y: cursor.y - 30 };
    camera.beginOrbit(cursor, 0);
    expect(camera.moveOrbit(moved, 100)).toBe(false);
    expect(camera.endOrbit(moved, 119).click).toBe(false);
    expect({ yaw: camera.yaw, offset: camera.tiltOffset }).toEqual(before);
    camera.beginOrbit(cursor, 200);
    expect(camera.moveOrbit(moved, 320)).toBe(true);
    expect(camera.yaw).toBe(-10);
    expect(camera.tiltOffset).toBe(6);
    expect(camera.endOrbit(moved, 340).click).toBe(false);
    camera.beginOrbit(cursor, 400);
    expect(camera.endOrbit({ ...cursor, x: cursor.x + 6 }, 600).click).toBe(
      true,
    );
    camera.beginOrbit(cursor, 700);
    camera.release();
    expect(camera.endOrbit(cursor, 800).click).toBe(false);
    camera.beginOrbit(cursor, 900);
    camera.moveOrbit({ ...cursor, x: cursor.x + 7 }, 930);
    expect(camera.endOrbit(cursor, 950).click).toBe(false);
  });

  it("snaps taps to the next 45 degrees and resets north/tilt in 250ms", () => {
    for (const direction of [-1, 1]) {
      const camera = new CommandCamera(plane(), { yaw: 11 });
      camera.step(0.1, { turn: direction });
      camera.tapTurn(direction, 11);
      drive(camera, 0.18, 100);
      expect(camera.yaw).toBe(direction > 0 ? 45 : 0);
    }
    const camera = new CommandCamera(plane(), { yaw: 370, tiltOffset: 15 });
    camera.resetView();
    camera.step(0.125);
    expect(camera.yaw).toBeGreaterThan(360);
    expect(camera.yaw).toBeLessThan(370);
    expect(camera.tiltOffset).toBeGreaterThan(0);
    camera.step(0.125);
    expect(camera.yaw).toBe(0);
    expect(camera.tiltOffset).toBe(0);
    camera.settings.reducedMotion = true;
    camera.orbit(40, -20);
    camera.resetView();
    expect(camera.yaw).toBe(0);
    expect(camera.tiltOffset).toBe(0);
    expect(camera.transition).toMatchObject({
      kind: "reset",
      style: "fade",
      durationMs: 150,
    });
  });

  it("only begins fullscreen edge panning after 150ms and pauses for panels/drags", () => {
    const camera = new CommandCamera(
        plane(),
        {},
        { edgePan: true, smoothing: 0 },
      ),
      edge = { ...centre, x: 1 };
    camera.step(0.5, { cursor: edge, fullscreen: false });
    expect(camera.focus.x).toBe(0);
    camera.step(0.14, { cursor: edge, fullscreen: true });
    expect(camera.focus.x).toBe(0);
    camera.step(0.01, { cursor: edge, fullscreen: true });
    expect(camera.focus.x).toBeCloseTo(0, 10);
    camera.step(0.01, { cursor: edge, fullscreen: true });
    expect(camera.focus.x).toBeLessThan(0);
    camera.release();
    const stopped = camera.focus.x;
    camera.step(1, { cursor: edge, fullscreen: true, overPanel: true });
    camera.step(1, { cursor: edge, fullscreen: true, dragging: true });
    expect(camera.focus.x).toBe(stopped);
  });
});

describe("Command camera terrain, bounds and transitions", () => {
  it("keeps the five tilt knots and offset sum within 20 to 89 degrees", () => {
    [24, 120, 600, 2000, 6000].forEach((distance, i) => {
      const camera = new CommandCamera(plane(), { distance });
      expect(camera.tilt).toBe([35, 45, 58, 68, 80][i]);
      camera.orbit(0, 1e5);
      expect(camera.tilt).toBe(20);
      camera.orbit(0, -1e5);
      expect(camera.tilt).toBe(89);
    });
  });

  it("clamps focus to the 22km disc and zoom to 24-6000m without bounce", () => {
    const camera = new CommandCamera(plane(), { distance: 6000 });
    camera.panTo(1e6, 1e6);
    drive(camera, 1, 60, { panX: 1, panY: -1, fast: true });
    expect(Math.hypot(camera.focus.x, camera.focus.z)).toBeCloseTo(22000, 8);
    for (let i = 0; i < 80; i++) camera.wheel(-1e6, 0);
    drive(camera, 4, 60);
    expect(camera.distance).toBe(24);
    for (let i = 0; i < 80; i++) camera.wheel(1e6, 0);
    drive(camera, 4, 60);
    expect(camera.distance).toBe(6000);
    expect(Math.hypot(camera.focus.x, camera.focus.z)).toBeLessThanOrEqual(
      22000 + 1e-8,
    );
  });

  it("never enters a cliff while its safety tilt eases, and preserves requested distance", () => {
    const environment: CommandEnvironment = {
        surface: (_x, z) => (z > 8 ? 180 : 0),
      },
      camera = new CommandCamera(environment, { distance: 24 });
    for (let i = 0; i < 120; i++) {
      const previousHeight = camera.focus.y;
      camera.step(1 / 60);
      expect(previousHeight - camera.focus.y).toBeLessThanOrEqual(
        24 / 60 + 1e-8,
      );
      expect(camera.position.y).toBeGreaterThanOrEqual(
        environment.surface(camera.position.x, camera.position.z, Infinity) +
          6 -
          1e-8,
      );
      expect(camera.requestedDistance).toBe(24);
      expect(camera.distance).toBe(24);
    }
    expect(camera.tilt).toBeGreaterThan(70);
    expect(camera.tiltOffset).toBe(0);
    // A roughly 172m safety lift cannot disappear in two seconds at d=24.
    // Keep checking its descent and clearance all the way back to the ground.
    for (let i = 0; i < 480; i++) {
      const previousHeight = camera.focus.y;
      camera.step(1 / 60);
      expect(previousHeight - camera.focus.y).toBeLessThanOrEqual(
        24 / 60 + 1e-8,
      );
      expect(camera.position.y).toBeGreaterThanOrEqual(
        environment.surface(camera.position.x, camera.position.z, Infinity) +
          6 -
          1e-8,
      );
      expect(camera.requestedDistance).toBe(24);
      expect(camera.distance).toBe(24);
    }
    expect(camera.focus.y).toBeLessThan(1);
  });

  it("lifts the focus if even straight down cannot clear, including terrain changes", () => {
    let height = 300;
    const camera = new CommandCamera(
      { surface: () => height },
      { distance: 24 },
    );
    for (const next of [300, 700, 200, 900]) {
      height = next;
      camera.step(1 / 144);
      expect(camera.position.y).toBeGreaterThanOrEqual(height + 6 - 1e-8);
      expect(
        Math.hypot(
          camera.position.x - camera.focus.x,
          camera.position.y - camera.focus.y,
          camera.position.z - camera.focus.z,
        ),
      ).toBeCloseTo(24, 9);
    }
  });

  it("averages narrow ground features and never descends faster than d per second", () => {
    const spike = new CommandCamera({
      surface: (x, z) => (Math.hypot(x, z) < 0.1 ? 100 : 0),
    });
    drive(spike, 3, 60);
    expect(spike.focus.y).toBeLessThan(5);
    const chasm = new CommandCamera(plane(), {
      distance: 120,
      focus: { x: 0, y: 1000, z: 0 },
    });
    for (let i = 0; i < 60; i++) {
      const before = chasm.focus.y;
      chasm.step(1 / 60);
      expect(before - chasm.focus.y).toBeLessThanOrEqual(2 + 1e-8);
    }
    expect(chasm.focus.y).toBeCloseTo(880, 7);
  });

  it("uses the injected drawn-ground disc average at radius max(4, 0.05d)", () => {
    const radii: number[] = [],
      camera = new CommandCamera(
        {
          surface: () => 0,
          averagedGround: (_x, _z, radius, cut) => {
            radii.push(radius);
            expect(cut).toBe(12);
            return 4;
          },
        },
        { distance: 600, cutHeight: 12 },
      );
    camera.step(0.3);
    expect(radii).toEqual([30]);
    expect(camera.focus.y).toBeCloseTo(4 * (1 - Math.exp(-1)), 8);
    const near = new CommandCamera(
      {
        surface: () => 0,
        averagedGround: (_x, _z, radius) => {
          expect(radius).toBe(4);
          return 0;
        },
      },
      { distance: 24 },
    );
    near.step(1 / 60);
  });

  it("glides only below 3d, cuts farther jumps, and preserves view choices", () => {
    const camera = new CommandCamera(plane(), {
      distance: 80,
      yaw: 27,
      tiltOffset: 7,
    });
    expect(camera.jump({ x: 239, y: 0, z: 0 })).toMatchObject({
      style: "glide",
      durationMs: 250,
    });
    expect(camera.focus.x).toBe(0);
    camera.step(0.125);
    expect(camera.focus.x).toBeGreaterThan(0);
    expect(camera.focus.x).toBeLessThan(239);
    camera.step(0.125);
    expect(camera.focus.x).toBe(239);
    expect(camera.jump({ x: 479, y: 0, z: 0 })).toMatchObject({
      style: "fade",
      durationMs: 120,
    });
    expect(camera.focus.x).toBe(479);
    expect(camera.yaw).toBe(27);
    expect(camera.tiltOffset).toBe(7);
    camera.settings.reducedMotion = true;
    expect(camera.jump({ x: 480, y: 0, z: 0 })).toMatchObject({
      style: "fade",
      durationMs: 150,
    });
  });

  it("restores explicit bookmark values and opens the destination's own roof on a jump", () => {
    const camera = new CommandCamera({
      ...plane(),
      blocks: (x, y) => (x < 10 && y === 3 ? Block.Stone : Block.Air),
    });
    camera.jump({ x: 0, y: 0, z: 0 });
    expect(camera.cutHeight).toBe(2.5);
    expect(camera.cutHeight).toBeGreaterThan(1.8);
    camera.jump({ x: 20, y: 0, z: 0 });
    expect(camera.cutHeight).toBe(Infinity);
    camera.jump(
      { x: 80, y: -10, z: 40 },
      {
        distance: 600,
        yaw: 123,
        tiltOffset: -4,
        cutHeight: -5,
      },
    );
    drive(camera, 2, 60);
    expect(camera.yaw).toBe(123);
    expect(camera.tiltOffset).toBe(-4);
    expect(camera.requestedDistance).toBe(600);
    expect(camera.cutHeight).toBe(-5);
  });

  it("retains follow through zoom/orbit but stops for pan or lost coverage/sight", () => {
    let target: FollowTarget = {
      position: { x: 40, y: 0, z: 50 },
      alive: true,
      inCoverage: true,
      owned: false,
      visible: true,
    };
    const camera = new CommandCamera(plane());
    camera.startFollowing(() => target);
    drive(camera, 1, 60);
    expect(camera.focus.x).toBeCloseTo(40, 0);
    camera.wheel(-100, 0, cursor);
    camera.orbit(4, -2);
    expect(camera.isFollowing).toBe(true);
    expect(camera.anchor).toBeNull();
    const last = { ...camera.focus };
    target = {
      ...target,
      visible: false,
      position: { x: 10000, y: 0, z: 10000 },
    };
    camera.step(1 / 60);
    expect(camera.isFollowing).toBe(false);
    expect(camera.focus.x).toBe(last.x);
    expect(camera.focus.z).toBe(last.z);
    target = { ...target, owned: true, inCoverage: true };
    camera.startFollowing(() => target);
    camera.step(1 / 60);
    expect(camera.isFollowing).toBe(true);
    target = { ...target, inCoverage: false };
    camera.step(1 / 60);
    expect(camera.isFollowing).toBe(false);
    camera.startFollowing(() => ({ ...target, inCoverage: true }));
    camera.step(1 / 60, { panX: 1 });
    expect(camera.isFollowing).toBe(false);
  });

  it("enters king's view from Overhead and returns a body on the drawn floor", () => {
    const camera = new CommandCamera(plane(5)),
      overhead: CameraPose = {
        focus: { x: 14, y: 6, z: -8 },
        position: { x: 14, y: 30, z: 10 },
        distance: 10,
        yaw: 42,
        tilt: 55,
        cutHeight: 12,
      };
    expect(
      camera.enterFromOverhead(overhead, { x: 14, y: 5, z: -8 }),
    ).toMatchObject({
      kind: "mode",
      durationMs: 400,
    });
    expect(camera.distance).toBe(24);
    expect(camera.yaw).toBe(42);
    expect(camera.tilt).toBe(55);
    expect(camera.cutHeight).toBe(12);
    drive(camera, 0.4, 60);
    expect(camera.tilt).toBeCloseTo(commandTilt(24), 8);
    expect(camera.tiltOffset).toBe(0);
    expect(camera.transition).toBeNull();
    camera.panTo(100, 200);
    const outgoing = camera.exitToOverhead();
    expect(outgoing.body).toEqual({ x: 100, y: 5, z: 200 });
    expect(outgoing.yaw).toBe(42);
    expect(outgoing.cutHeight).toBe(12);
    expect(outgoing.transition.durationMs).toBe(400);
    expect(COMMAND_CAMERA.worldRadius).toBe(22000);
  });
});
