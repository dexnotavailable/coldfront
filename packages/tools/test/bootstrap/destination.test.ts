import { describe, expect, it } from "vitest";
import { collides } from "../../../client/src/game/controller.js";
import {
  bodyInFrame,
  resolveDestination,
} from "../../../client/src/game/destination.js";
import { Block } from "../../../shared/src/blocks/registry.js";

describe("safe atomic-navigation destination policy", () => {
  it("keeps lake XZ and resolves above actual water with flight instead of the bed or a distant shore", () => {
    const get = (_x: number, y: number, _z: number) =>
      y < -5 ? Block.Stone : y < 0 ? Block.Water : Block.Air;
    const pose = resolveDestination(
      {
        get,
        surface: () => 0,
        water: () => ({ kind: "water", level: 0, bodyId: 2 }),
      },
      -4.25,
      17.8,
      1.3,
    );
    expect(pose).toEqual({ x: -4.25, y: 0, z: 17.8, yaw: 1.3, flying: true });
    expect(collides(get, pose)).toBe(false);
  });
  it("accounts for a raised neighbouring edit across the full body width, retaining target XZ", () => {
    const get = (x: number, y: number) =>
      y < 3 || (x === 1 && y < 6) ? Block.Stone : Block.Air;
    const pose = resolveDestination(
      {
        get,
        surface: () => 3,
        water: () => ({ kind: "none", level: -Infinity, bodyId: 0 }),
      },
      0.9,
      -0.5,
      0,
    );
    expect(pose.y).toBe(6);
    expect(pose.x).toBe(0.9);
    expect(collides(get, pose)).toBe(false);
  });
  it("rejects frame-edge body overlap and roof-to-ceiling obstruction rather than committing an invalid pose", () => {
    const world = {
      get: () => Block.Air,
      surface: () => 0,
      water: () => ({ kind: "none" as const, level: -Infinity, bodyId: 0 }),
    };
    expect(() => resolveDestination(world, 22527.95, 0, 0)).toThrow(
      "clearance",
    );
    expect(() => resolveDestination(world, -22528.01, 0, 0)).toThrow("frame");
    expect(() =>
      resolveDestination(
        { ...world, get: () => Block.Stone, surface: () => 1022 },
        0,
        0,
        0,
      ),
    ).toThrow("clearance");
    expect(bodyInFrame({ x: -22527.5, y: 1022, z: -22527.5 })).toBe(true);
  });
});
