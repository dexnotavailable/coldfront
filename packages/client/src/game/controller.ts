import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import type { BlockQuery, Point } from "./raycast.js";
export const PHYSICS = Object.freeze({
  tick: 0.05,
  halfWidth: 0.3,
  height: 1.8,
  eye: 1.62,
  sneakEye: 1.27,
  step: 0.6,
  jump: 0.42,
  gravity: 0.08,
  dragY: 0.98,
  groundDrag: 0.546,
  airDrag: 0.91,
  walkAcceleration: 0.1,
  sprintMultiplier: 1.3,
  sneakMultiplier: 0.3,
  flySpeed: 0.545,
});
export interface MovementInput {
  forward: number;
  right: number;
  jump: boolean;
  sneak: boolean;
  sprint: boolean;
  yaw: number;
  lookYaw: number;
  fly: boolean;
  flySpeed: number;
}
export interface BodyState extends Point {
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  swimming: boolean;
  sneaking: boolean;
  sprinting: boolean;
  flying: boolean;
  walkDistance: number;
  stepRise: number;
  yaw: number;
  headYaw: number;
}
export function makeBody(x = 0, y = 6, z = 0): BodyState {
  return {
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: false,
    swimming: false,
    sneaking: false,
    sprinting: false,
    flying: false,
    walkDistance: 0,
    stepRise: 0,
    yaw: 0,
    headYaw: 0,
  };
}
export function intersectsBody(
  body: Point,
  x: number,
  y: number,
  z: number,
): boolean {
  return (
    x < body.x + 0.3 &&
    x + 1 > body.x - 0.3 &&
    z < body.z + 0.3 &&
    z + 1 > body.z - 0.3 &&
    y < body.y + 1.8 &&
    y + 1 > body.y
  );
}
function solid(get: BlockQuery, x: number, y: number, z: number): boolean {
  return BLOCK_REGISTRY[get(x, y, z)]?.solid ?? true;
}
export function collides(get: BlockQuery, b: Point): boolean {
  for (let y = Math.floor(b.y + 1e-7); y <= Math.floor(b.y + 1.8 - 1e-7); y++)
    for (
      let z = Math.floor(b.z - 0.3 + 1e-7);
      z <= Math.floor(b.z + 0.3 - 1e-7);
      z++
    )
      for (
        let x = Math.floor(b.x - 0.3 + 1e-7);
        x <= Math.floor(b.x + 0.3 - 1e-7);
        x++
      )
        if (solid(get, x, y, z)) return true;
  return false;
}
function moveAxis(
  get: BlockQuery,
  b: BodyState,
  axis: "x" | "y" | "z",
  amount: number,
): number {
  if (!amount) return 0;
  const start = b[axis];
  const steps = Math.ceil(Math.abs(amount) / 0.25),
    increment = amount / steps;
  for (let s = 0; s < steps; s++) {
    b[axis] += increment;
    if (collides(get, b)) {
      b[axis] -= increment;
      let low = 0,
        high = 1;
      const base = b[axis];
      for (let i = 0; i < 14; i++) {
        const t = (low + high) / 2;
        b[axis] = base + increment * t;
        if (collides(get, b)) high = t;
        else low = t;
      }
      b[axis] = base + increment * low;
      break;
    }
  }
  return b[axis] - start;
}
function angleDelta(a: number, b: number): number {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}
export function stepBody(
  b: BodyState,
  input: MovementInput,
  get: BlockQuery,
): void {
  const wasGrounded = b.grounded,
    ox = b.x,
    oz = b.z;
  b.stepRise = 0;
  b.sneaking = input.sneak;
  b.flying = input.fly;
  b.swimming =
    get(Math.floor(b.x), Math.floor(b.y + 0.8), Math.floor(b.z)) ===
      Block.Water && !input.fly;
  let forward = input.forward,
    right = input.right;
  const length = Math.hypot(forward, right);
  if (length > 1) {
    forward /= length;
    right /= length;
  }
  const dx = Math.sin(input.yaw) * forward + Math.cos(input.yaw) * right;
  const dz = -Math.cos(input.yaw) * forward + Math.sin(input.yaw) * right;
  const moveYaw = length ? Math.atan2(dx, -dz) : b.yaw;
  b.headYaw += Math.max(
    -Math.PI / 10,
    Math.min(Math.PI / 10, angleDelta(b.headYaw, input.lookYaw)),
  );
  b.sprinting =
    input.sprint &&
    !input.sneak &&
    length > 0 &&
    Math.abs(angleDelta(b.headYaw, moveYaw)) <= Math.PI / 4 + 1e-7;
  b.yaw += angleDelta(b.yaw, length ? moveYaw : b.headYaw) * 0.4;
  if (input.fly) {
    const speed = PHYSICS.flySpeed * input.flySpeed * (b.sprinting ? 2 : 1);
    b.vx = dx * speed;
    b.vz = dz * speed;
    b.vy = (Number(input.jump) - Number(input.sneak)) * speed;
  } else if (b.swimming) {
    b.vx += dx * 0.02;
    b.vz += dz * 0.02;
    b.vy += input.jump ? 0.04 : -0.02;
    b.vx *= 0.8;
    b.vz *= 0.8;
    b.vy *= 0.8;
  } else {
    const acceleration =
      (wasGrounded ? 0.1 : 0.02) *
      (b.sprinting ? 1.3 : 1) *
      (input.sneak ? 0.3 : 1) *
      0.98;
    b.vx += dx * acceleration;
    b.vz += dz * acceleration;
    if (input.jump && wasGrounded) {
      b.vy = PHYSICS.jump;
      if (b.sprinting) {
        b.vx += Math.sin(b.headYaw) * 0.2;
        b.vz -= Math.cos(b.headYaw) * 0.2;
      }
    }
  }
  // Sneak clips motion before the supporting surface ends.
  if (input.sneak && wasGrounded && !input.fly) {
    for (const axis of ["x", "z"] as const) {
      const velocity = axis === "x" ? "vx" : "vz";
      let speed = b[velocity];
      while (
        Math.abs(speed) > 1e-5 &&
        !collides(get, {
          x: b.x + (axis === "x" ? speed : 0),
          y: b.y - 0.6,
          z: b.z + (axis === "z" ? speed : 0),
        })
      )
        speed = Math.abs(speed) <= 0.05 ? 0 : speed - Math.sign(speed) * 0.05;
      b[velocity] = speed;
    }
  }
  const requestedY = b.vy,
    movedY = moveAxis(get, b, "y", b.vy);
  b.grounded = requestedY < 0 && Math.abs(movedY - requestedY) > 1e-5;
  if (Math.abs(movedY - requestedY) > 1e-5) b.vy = 0;
  const bx = b.x,
    by = b.y,
    bz = b.z;
  const mx = moveAxis(get, b, "x", b.vx),
    mz = moveAxis(get, b, "z", b.vz);
  if (
    (wasGrounded || b.grounded) &&
    !input.fly &&
    (Math.abs(mx - b.vx) > 1e-5 || Math.abs(mz - b.vz) > 1e-5)
  ) {
    const flat = { x: b.x, y: b.y, z: b.z };
    b.x = bx;
    b.y = by;
    b.z = bz;
    const up = moveAxis(get, b, "y", PHYSICS.step);
    moveAxis(get, b, "x", b.vx);
    moveAxis(get, b, "z", b.vz);
    moveAxis(get, b, "y", -up);
    if ((b.x - bx) * (b.x - bx) + (b.z - bz) * (b.z - bz) <= mx * mx + mz * mz)
      Object.assign(b, flat);
    else {
      b.stepRise = b.y - by;
      b.grounded = true;
    }
  }
  if (Math.abs(b.x - bx - b.vx) > 1e-4) b.vx = 0;
  if (Math.abs(b.z - bz - b.vz) > 1e-4) b.vz = 0;
  if (!input.fly && !b.swimming) {
    b.vy = (b.vy - PHYSICS.gravity) * PHYSICS.dragY;
    const drag = b.grounded ? PHYSICS.groundDrag : PHYSICS.airDrag;
    b.vx *= drag;
    b.vz *= drag;
  }
  b.walkDistance += Math.hypot(b.x - ox, b.z - oz);
  b.x = Math.max(-22527.6, Math.min(22527.6, b.x));
  b.z = Math.max(-22527.6, Math.min(22527.6, b.z));
  b.y = Math.max(-1536, Math.min(1024 - PHYSICS.height - 0.001, b.y));
  if (b.y === -1536 || b.y >= 1024 - PHYSICS.height - 0.001) b.vy = 0;
}
