import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createWorldContext } from "../../../shared/src/world/world-context.js";
import { generateTestChunk } from "../../../shared/src/worldgen/chunk.js";
import {
  KNOWN_WINDOWS_BROWSER_CACHE,
  selectBrowserCache,
} from "../../src/golden/browser-cache.js";
import {
  BROWSER_NAMES,
  browserPolicy,
  browserRunSucceeded,
} from "../../src/golden/browser-policy.js";
import {
  compareGoldenRecords,
  encodeFloat64,
  encodeUint16,
  type GoldenRecord,
  hashChunk,
  sha256,
  testGoldenCases,
} from "../../src/golden/core.js";

describe("portable golden bytes", () => {
  it("matches standard SHA-256 and explicitly serialises endian and float edge cases", async () => {
    const bytes = new TextEncoder().encode("abc");
    expect(await sha256(bytes)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect([...encodeUint16(new Uint16Array([0, 1, 0x1234, 65535]))]).toEqual([
      0, 0, 1, 0, 0x34, 0x12, 255, 255,
    ]);
    const values = new Float64Array([
      0,
      -0,
      1,
      -1,
      Infinity,
      -Infinity,
      Number.MIN_VALUE,
    ]);
    const actual = encodeFloat64(values);
    const expected = Buffer.alloc(values.length * 8);
    values.forEach((value, i) => {
      expected.writeDoubleLE(value, i * 8);
    });
    expect(Buffer.from(actual)).toEqual(expected);
    expect(await sha256(actual)).toBe(
      createHash("sha256").update(expected).digest("hex"),
    );
    expect(() => encodeFloat64(new Float64Array([NaN]))).toThrow("NaN");
  });
  it("has exactly50 distinct samples per seed with both spacings, vertical and boundary coverage", () => {
    const samples = testGoldenCases();
    expect(samples.length).toBe(150);
    expect(new Set(samples.map((sample) => sample.id)).size).toBe(150);
    for (const seed of [1, 2, 3]) {
      const cases = samples.filter((sample) => sample.seed === seed);
      expect(cases.length).toBe(50);
      expect(cases.filter((sample) => sample.lod === 0).length).toBe(30);
      expect(cases.filter((sample) => sample.lod === 1).length).toBe(20);
      expect(
        new Set(
          cases.map(
            (sample) =>
              `${sample.cx},${sample.cy},${sample.cz},${sample.spacing}`,
          ),
        ).size,
      ).toBe(50);
      expect(cases.some((sample) => sample.cy === -48)).toBe(true);
      expect(cases.some((sample) => sample.cy === 31)).toBe(true);
      expect(cases.some((sample) => sample.cx === -704)).toBe(true);
      expect(cases.some((sample) => sample.cx === 703)).toBe(true);
    }
  });
  it("reports the exact changed field and refuses missing results", () => {
    const sample = testGoldenCases()[0];
    if (!sample) throw new Error("Missing sample");
    const row: GoldenRecord = {
      sample,
      hashes: { blocks: "a", haloBlocks: "b", density: "c", columns: "d" },
    };
    expect(
      compareGoldenRecords(
        [row],
        [{ ...row, hashes: { ...row.hashes, density: "changed" } }],
      ),
    ).toEqual([`${sample.id}.density: expected c, received changed`]);
    expect(compareGoldenRecords([row], []).length).toBe(1);
  });
  it("retains every original test-world sample definition without rebuilding plans", () => {
    const fixture = JSON.parse(
      readFileSync(
        new URL("../../../shared/test/golden/worldgen.json", import.meta.url),
        "utf8",
      ),
    ) as { records: GoldenRecord[] };
    expect(
      fixture.records
        .filter((record) => record.sample.world === "test")
        .map((record) => record.sample),
    ).toEqual(testGoldenCases());
  });
  it("rejects columns that do not match the supplied context layout", async () => {
    const context = createWorldContext({ kind: "test", seed: 1 });
    const chunk = generateTestChunk({ seed: 1, cx: 0, cy: 0, cz: 0 });
    await expect(hashChunk(chunk, context.columns)).resolves.toHaveProperty(
      "columns",
    );
    await expect(
      hashChunk(chunk, {
        ...context.columns,
        stride: context.columns.stride + 1,
      }),
    ).rejects.toThrow("layout");
    await expect(
      hashChunk({ ...chunk, columns: chunk.columns.slice(1) }, context.columns),
    ).rejects.toThrow("layout");
  });
});
describe("browser evidence policy", () => {
  it("honours explicit/hermetic browser caches and discovers the established D cache before import", () => {
    expect(selectBrowserCache("A:/explicit", true)).toEqual({
      path: "A:/explicit",
      source: "environment",
    });
    expect(selectBrowserCache("0", true)).toEqual({
      path: "0",
      source: "environment",
    });
    expect(selectBrowserCache(undefined, true)).toEqual({
      path: KNOWN_WINDOWS_BROWSER_CACHE,
      source: "known-d-cache",
    });
    expect(selectBrowserCache(undefined, false)).toEqual({
      path: undefined,
      source: "playwright-default",
    });
  });
  it("requires all3 in CI and cannot pass a skipped or empty run", () => {
    expect(browserPolicy([], "true")).toEqual({
      names: BROWSER_NAMES,
      requireAll: true,
    });
    expect(() => browserPolicy(["--browsers", "chromium"], "true")).toThrow(
      "requires",
    );
    expect(() =>
      browserPolicy(["--browsers", "chromium", "--require-all"], undefined),
    ).toThrow();
    expect(browserRunSucceeded(["pass", "skip", "skip"], true)).toBe(false);
    expect(browserRunSucceeded(["pass", "pass", "pass"], true)).toBe(true);
    expect(browserRunSucceeded(["skip", "skip", "skip"], false)).toBe(false);
    expect(browserRunSucceeded([], false)).toBe(false);
  });
  it("permits explicit local availability but treats installed launch/test failures as failures", () => {
    expect(
      browserPolicy(["--browsers", "chromium,webkit"], "false").names,
    ).toEqual(["chromium", "webkit"]);
    expect(browserRunSucceeded(["pass", "skip", "skip"], false)).toBe(true);
    expect(browserRunSucceeded(["pass", "fail", "skip"], false)).toBe(false);
    expect(() => browserPolicy(["--browsers", "safari"], undefined)).toThrow();
    expect(() =>
      browserPolicy(["--browsers", "chromium,chromium"], undefined),
    ).toThrow();
    expect(() => browserPolicy(["--allow-missing"], "true")).toThrow();
  });
});
