import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { hash2, rand01 } from "../src/math/hash.js";
import { createNoise2Sample } from "../src/noise/opensimplex2.js";
import { PSRD2_PROFILE, psrd2 } from "../src/noise/psrd2.js";
import { scanDeterminism } from "./determinism-guard.js";
import { psrd2Reference } from "./psrd2-reference.js";

describe("seeded nonperiodic psrdnoise2 port", () => {
  it("retains fixed signed-coordinate vectors recorded from the independent reference", () => {
    const fixtures = [
      {
        seed: 1,
        x: 0,
        z: 0,
        expected: [0, -1.1907764455327312, -4.302913174392954],
      },
      {
        seed: 1,
        x: 0.125,
        z: 0.375,
        expected: [-0.7221517705469381, 0.7799638531392779, 1.959229881173746],
      },
      {
        seed: 2,
        x: -0.1,
        z: -0.3,
        expected: [
          -0.4973553054796677, 1.9689844730879253, -0.7798543914248318,
        ],
      },
      {
        seed: -1,
        x: 31.999,
        z: -32.001,
        expected: [0.00269953638458548, 1.5041038696176265, -4.203586263352074],
      },
      {
        seed: 2147483647,
        x: 1234.25,
        z: -987.75,
        expected: [
          0.04695439425598698, 1.7519650410516785, -1.5975216235411167,
        ],
      },
    ];
    const out = createNoise2Sample();
    for (const fixture of fixtures) {
      psrd2(fixture.seed, fixture.x, fixture.z, out);
      for (let lane = 0; lane < 3; lane++)
        expect(
          Math.abs((out[lane] as number) - (fixture.expected[lane] as number)),
        ).toBeLessThan(3e-14);
    }
  });

  it("matches an independent transcription of the pinned lattice and attenuation with native-trig gradients", () => {
    expect(PSRD2_PROFILE.sourceRevision).toBe(
      "419175a270862ce7ae692038fafafb42ec0427e9",
    );
    const out = createNoise2Sample();
    for (let i = 0; i < 300; i++) {
      const seed = i < 4 ? ([1, -1, -2147483648, 4294967295][i] as number) : i;
      const x = 50000 * rand01(hash2(73, i)) - 25000;
      const z = 50000 * rand01(hash2(91, i)) - 25000;
      psrd2(seed, x, z, out);
      const expected = psrd2Reference(seed, x, z);
      for (let lane = 0; lane < 3; lane++)
        expect(
          Math.abs((out[lane] as number) - (expected[lane] as number)),
        ).toBeLessThan(3e-14);
    }
  });

  it("differentiates the final input-space value and gradient analytically, including both mixed partials", () => {
    const out = createNoise2Sample(),
      plus = createNoise2Sample(),
      minus = createNoise2Sample();
    const eps = 1e-5;
    for (let i = 0; i < 400; i++) {
      const x = 200 * rand01(hash2(0x31, i)) - 100;
      const z = 200 * rand01(hash2(0x53, i)) - 100;
      const seed = 1 + (i % 3);
      psrd2(seed, x, z, out);
      psrd2(seed, x + eps, z, plus);
      psrd2(seed, x - eps, z, minus);
      expect(
        Math.abs(
          (out[1] as number) -
            ((plus[0] as number) - (minus[0] as number)) / (2 * eps),
        ),
      ).toBeLessThan(2e-7);
      expect(
        Math.abs(
          (out[3] as number) -
            ((plus[1] as number) - (minus[1] as number)) / (2 * eps),
        ),
      ).toBeLessThan(3e-6);
      expect(
        Math.abs(
          (out[4] as number) -
            ((plus[2] as number) - (minus[2] as number)) / (2 * eps),
        ),
      ).toBeLessThan(3e-6);
      psrd2(seed, x, z + eps, plus);
      psrd2(seed, x, z - eps, minus);
      expect(
        Math.abs(
          (out[2] as number) -
            ((plus[0] as number) - (minus[0] as number)) / (2 * eps),
        ),
      ).toBeLessThan(2e-7);
      expect(
        Math.abs(
          (out[4] as number) -
            ((plus[1] as number) - (minus[1] as number)) / (2 * eps),
        ),
      ).toBeLessThan(3e-6);
      expect(
        Math.abs(
          (out[5] as number) -
            ((plus[2] as number) - (minus[2] as number)) / (2 * eps),
        ),
      ).toBeLessThan(3e-6);
    }
  });

  it("keeps value, gradient and Hessian continuous across negative lattice, diagonal and support boundaries", () => {
    const a = createNoise2Sample(),
      b = createNoise2Sample();
    const eps = 1e-8;
    for (const seed of [1, 2, 3, -1]) {
      for (const base of [-32, -3, -1, 0, 1, 3, 32]) {
        for (const fraction of [0, 0.2, 0.4, 0.5, 0.6, 0.8]) {
          // Three simplex boundaries in (u,v), transformed back to (x,z).
          for (const [u, v, du, dv] of [
            [base, base + fraction, eps, 0],
            [base + fraction, base, 0, eps],
            [base + fraction, base + fraction, eps, -eps],
          ]) {
            const up = (u as number) + (du as number),
              vp = (v as number) + (dv as number);
            const um = (u as number) - (du as number),
              vm = (v as number) - (dv as number);
            psrd2(seed, up - 0.5 * vp, vp, a);
            psrd2(seed, um - 0.5 * vm, vm, b);
            for (let lane = 0; lane < 6; lane++)
              expect(
                Math.abs((a[lane] as number) - (b[lane] as number)),
              ).toBeLessThan(lane < 3 ? 2e-6 : 2e-5);
          }
        }
      }
    }
  });

  it("repeats byte-for-byte across seed/order changes and preserves signed-word aliases", () => {
    const out = createNoise2Sample();
    const first = psrd2(1, -32.125, 71.75, out).slice();
    for (let i = 0; i < 200; i++) psrd2(i, i - 100.25, 77 - i, out);
    expect(Buffer.from(psrd2(1, -32.125, 71.75, out).buffer)).toEqual(
      Buffer.from(first.buffer),
    );
    expect([...psrd2(2, -32.125, 71.75, out)]).not.toEqual([...first]);
    const signed = psrd2(-1, -0.25, -0.75, out).slice();
    expect([...psrd2(4294967295, -0.25, -0.75, out)]).toEqual([...signed]);
    // The changed full-coordinate hash does not retain upstream's 289-cell repetition.
    const local = psrd2(1, 0.125, 0.375, out).slice();
    expect([...psrd2(1, 289.125, 0.375, out)]).not.toEqual([...local]);
  });

  it("rejects invalid coordinate/seed/output domains and writes only its six lanes", () => {
    const out = new Float64Array(7).fill(91);
    expect(psrd2(1, 0, 0, out)).toBe(out);
    expect(out[6]).toBe(91);
    for (const coordinate of [
      NaN,
      Infinity,
      -Infinity,
      268435456,
      -268435456,
    ]) {
      expect(() => psrd2(1, coordinate, 0, out)).toThrow();
      expect(() => psrd2(1, 0, coordinate, out)).toThrow();
    }
    for (const seed of [NaN, 0.5, -2147483649, 4294967296])
      expect(() => psrd2(seed, 0, 0, out)).toThrow();
    expect(() => psrd2(1, 0, 0, new Float64Array(5))).toThrow();
    expect(
      [...psrd2(1, 268435455.25, -268435455.75, out).slice(0, 6)].every(
        Number.isFinite,
      ),
    ).toBe(true);
  });

  it("passes the actual shared AST allowlist including generated quantile constants", () => {
    const files = ["psrd2.ts", "psrd2-quantiles.generated.ts"].map((name) =>
      fileURLToPath(new URL(`../src/noise/${name}`, import.meta.url)),
    );
    const program = ts.createProgram(files, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
      types: [],
      lib: ["lib.es2022.d.ts"],
    });
    for (const file of files) {
      const source = program.getSourceFile(file);
      if (!source) throw new Error(`Missing source ${file}`);
      expect(scanDeterminism(source, program.getTypeChecker())).toEqual([]);
    }
  });
});
