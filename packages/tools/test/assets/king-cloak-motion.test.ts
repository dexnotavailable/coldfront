import { describe, expect, it } from "vitest";
import {
  createKingCloakMotion,
  kingCloakPose,
} from "../../../client/src/engine/king-avatar.js";
import { makeBody } from "../../../client/src/game/controller.js";

const idle = makeBody(0, 0, 0),
  walk = { ...idle, vz: -0.22 },
  sprint = { ...walk, sprinting: true, vz: -0.28 },
  wind = { x: 1, z: 0.4, strength: 1 };

describe("King cloak movement and display-clock continuity", () => {
  it("flexes lower cloth during sustained movement even in zero wind", () => {
    for (const state of [
      walk,
      sprint,
      { ...walk, sneaking: true },
      { ...walk, swimming: true },
      { ...walk, flying: true },
    ]) {
      const samples = [0, 160, 320, 480, 640, 800].map((ms) =>
          kingCloakPose(state, ms),
        ),
        tips = samples.map((pose) => pose.tipPitch),
        middle = samples.map((pose) => pose.middlePitch);
      expect(Math.max(...tips) - Math.min(...tips)).toBeGreaterThan(0.05);
      expect(Math.max(...middle) - Math.min(...middle)).toBeGreaterThan(0.025);
      expect(samples[0]?.tipPitch).not.toBe(samples[3]?.tipPitch);
    }
    expect(kingCloakPose(idle, 0)).toEqual(kingCloakPose(idle, 4000));
  });

  it("starts and stops without an instantaneous angle jump and then settles", () => {
    const motion = createKingCloakMotion();
    motion.sample(idle, 0);
    expect(motion.sample(sprint, 500)).toEqual(kingCloakPose(idle, 500));
    const onset = motion.sample(sprint, 501);
    expect(
      Math.abs(onset.upperPitch - kingCloakPose(idle, 501).upperPitch),
    ).toBeLessThan(0.00003);
    expect(motion.sample(sprint, 720)).toEqual(kingCloakPose(sprint, 720));
    expect(motion.sample(idle, 900)).toEqual(kingCloakPose(sprint, 900));
    expect(motion.sample(idle, 1120)).toEqual(kingCloakPose(idle, 1120));
  });

  it("is identical at shared times with 10 ms and 25 ms drawing steps", () => {
    const run = (step: number) => {
      const motion = createKingCloakMotion(),
        samples: unknown[] = [];
      for (let ms = 0; ms <= 1600; ms += step) {
        const body =
            ms < 200 ? idle : ms < 700 ? walk : ms < 1100 ? sprint : idle,
          pose = motion.sample(body, ms, ms >= 900 ? wind : undefined);
        if (ms % 50 === 0) samples.push(pose);
      }
      return samples;
    };
    expect(run(10)).toEqual(run(25));
  });

  it("can reverse a partly completed transition without an angle discontinuity", () => {
    const changed = createKingCloakMotion(),
      unchanged = createKingCloakMotion();
    for (const motion of [changed, unchanged]) {
      motion.sample(idle, 0);
      motion.sample(sprint, 100);
      motion.sample(sprint, 175);
    }
    expect(changed.sample(idle, 200)).toEqual(unchanged.sample(sprint, 200));
    const next = changed.sample(idle, 201),
      before = unchanged.sample(sprint, 200);
    expect(Math.abs(next.upperPitch - before.upperPitch)).toBeLessThan(0.001);
    expect(changed.sample(idle, 420)).toEqual(kingCloakPose(idle, 420));
  });

  it("freezes at repeated timestamps, accepts pending changes on resume, and rewinds deterministically", () => {
    const motion = createKingCloakMotion();
    motion.sample(walk, 0);
    const paused = motion.sample(walk, 100);
    for (let frame = 0; frame < 200; frame++)
      expect(motion.sample(sprint, 100, wind)).toEqual(paused);
    expect(motion.sample(sprint, 101, wind)).toEqual(kingCloakPose(walk, 101));
    expect(motion.sample(sprint, 321, wind)).toEqual(
      kingCloakPose(sprint, 321, wind),
    );
    expect(motion.sample(idle, 0)).toEqual(kingCloakPose(idle, 0));
    const atZero = motion.sample(idle, 0);
    expect(motion.sample(walk, 0, wind)).toEqual(atZero);
  });

  it("bounds combined movement and wind and rejects invalid wind directions", () => {
    for (let ms = 0; ms < 6000; ms += 23)
      for (const state of [idle, walk, sprint])
        for (const direction of [wind, { x: -1, z: -1, strength: 1 }]) {
          const pose = kingCloakPose(state, ms, direction),
            cumulative = [
              pose.upperPitch,
              pose.middlePitch,
              pose.lowerPitch,
              pose.tipPitch,
            ].reduce<number[]>((sum, angle) => {
              sum.push((sum.at(-1) ?? 0) + angle);
              return sum;
            }, []);
          expect(Math.max(...cumulative.map(Math.abs))).toBeLessThan(
            Math.PI / 4,
          );
          expect(Math.abs(pose.sway)).toBeLessThan((6 * Math.PI) / 180);
        }
    expect(
      kingCloakPose(walk, 300, { x: Number.NaN, z: 1, strength: 1 }),
    ).toEqual(kingCloakPose(walk, 300));
    expect(kingCloakPose(walk, 300, { x: 0, z: 0, strength: 1 })).toEqual(
      kingCloakPose(walk, 300),
    );
  });
});
