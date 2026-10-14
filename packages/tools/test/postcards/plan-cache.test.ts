import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { deserialize, serialize } from "node:v8";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorldPlanData } from "../../../shared/src/world/types.js";
import { WORLDGEN_VERSION } from "../../../shared/src/worldgen/version.js";
import { buildWorldPlan } from "../../../shared/src/worldplan/index.js";
import { loadPlan } from "../../src/postcards/main-resolve.js";

const disk = vi.hoisted(() => ({ bytes: undefined as Buffer | undefined }));
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => undefined),
  readFile: vi.fn(async () => {
    if (!disk.bytes) throw new Error("Missing optional cache");
    return Buffer.from(disk.bytes);
  }),
  writeFile: vi.fn(async (_path: string, bytes: Uint8Array) => {
    disk.bytes = Buffer.from(bytes);
  }),
}));
vi.mock("../../../shared/src/worldplan/index.js", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../../shared/src/worldplan/index.js")
  >()),
  buildWorldPlan: vi.fn(),
}));

const seed = 3;
const sourceHash = "a".repeat(64);
const root = "/synthetic-plan-cache";
const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
let fixture: WorldPlanData;
beforeAll(async () => {
  // One actual plan keeps the typed layouts and real hydration validation in
  // this regression. Rebuilds use copies; no voxel/camera queries or disk I/O.
  const actual = await vi.importActual<
    typeof import("../../../shared/src/worldplan/index.js")
  >("../../../shared/src/worldplan/index.js");
  fixture = actual.buildWorldPlan(seed);
  actual.hydrateWorldPlan(fixture);
}, 120_000);
beforeEach(() => {
  disk.bytes = undefined;
  vi.clearAllMocks();
  vi.mocked(buildWorldPlan).mockImplementation((requested) => {
    expect(requested).toBe(seed);
    return structuredClone(fixture);
  });
});
function envelope(data: unknown = fixture) {
  const payload = serialize(data);
  return {
    schema: 2,
    seed,
    sourceHash,
    worldgenVersion: WORLDGEN_VERSION,
    payload,
    checksum: sha256(payload),
  };
}
function stored() {
  if (!disk.bytes) throw new Error("Cache was not written");
  return deserialize(disk.bytes) as ReturnType<typeof envelope>;
}
async function expectRebuild() {
  const result = await loadPlan(seed, sourceHash, root);
  expect(buildWorldPlan).toHaveBeenCalledExactlyOnceWith(seed);
  expect(writeFile).toHaveBeenCalledTimes(1);
  expect(isDeepStrictEqual(result, fixture)).toBe(true);
  const repaired = stored();
  expect(repaired.schema).toBe(2);
  expect(repaired.payload).toBeInstanceOf(Uint8Array);
  expect(sha256(repaired.payload)).toBe(repaired.checksum);
  expect(isDeepStrictEqual(deserialize(repaired.payload), fixture)).toBe(true);
}

describe("WorldPlan exact-byte payload cache", () => {
  it("reuses a warm cache with the full typed plan intact", async () => {
    const cold = await loadPlan(seed, sourceHash, root);
    const cached = stored();
    expect(cached).not.toHaveProperty("data");
    expect(cached.schema).toBe(2);
    expect(cached.payload).toBeInstanceOf(Uint8Array);
    expect(sha256(cached.payload)).toBe(cached.checksum);
    const originalBytes = Buffer.from(disk.bytes as Buffer);

    const warm = await loadPlan(seed, sourceHash, root);
    expect(buildWorldPlan).toHaveBeenCalledExactlyOnceWith(seed);
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(disk.bytes?.equals(originalBytes)).toBe(true);
    expect(warm).not.toBe(cold);
    expect(isDeepStrictEqual(warm, cold)).toBe(true);
    expect(warm.terrainMacro).toBeInstanceOf(Float64Array);
    expect(warm.routingHeight).toBeInstanceOf(Float64Array);
    expect(warm.receivers).toBeInstanceOf(Int32Array);
    expect(warm.routingOrder).toBeInstanceOf(Uint32Array);
    expect(warm.basinIds).toBeInstanceOf(Uint32Array);
  });

  it("rejects changed bytes even when the payload is a valid plan", async () => {
    const cached = envelope();
    cached.payload = serialize({ ...fixture, unverifiedMarker: true });
    disk.bytes = serialize(cached); // Deliberately retain the original checksum.
    await expectRebuild();
  });

  it.each([
    ["schema", 1],
    ["seed", seed + 1],
    ["sourceHash", "b".repeat(64)],
    ["worldgenVersion", WORLDGEN_VERSION + 1],
    ["checksum", "0".repeat(64)],
  ] as const)("rebuilds after a mismatched %s", async (key, value) => {
    const cached: Record<string, unknown> = envelope();
    cached[key] = value;
    disk.bytes = serialize(cached);
    await expectRebuild();
  });

  it.each(["string", "array", "wide-view"] as const)(
    "rejects a %s payload instead of coercing it into bytes",
    async (kind) => {
      const cached: Record<string, unknown> = envelope();
      cached.payload =
        kind === "string"
          ? "not serialized bytes"
          : kind === "array"
            ? [1, 2, 3]
            : new Uint16Array([1, 2, 3]);
      disk.bytes = serialize(cached);
      await expectRebuild();
    },
  );

  it("rebuilds a legacy object cache instead of reserializing values", async () => {
    disk.bytes = serialize({
      seed,
      sourceHash,
      worldgenVersion: WORLDGEN_VERSION,
      data: fixture,
      checksum: sha256(serialize(fixture)),
    });
    await expectRebuild();
    await loadPlan(seed, sourceHash, root);
    expect(buildWorldPlan).toHaveBeenCalledTimes(1);
  });

  it("rebuilds a checksum-matching plan with invalid site data", async () => {
    disk.bytes = serialize(
      envelope({ ...fixture, sites: { ...fixture.sites, spawns: [] } }),
    );
    await expectRebuild();
  });

  it.each([{ seed: seed + 1 }, { worldgenVersion: WORLDGEN_VERSION + 1 }])(
    "rejects decoded identity inconsistent with its envelope: %j",
    async (change) => {
      disk.bytes = serialize(envelope({ ...fixture, ...change }));
      await expectRebuild();
    },
  );

  it("rebuilds checksum-matching bytes that are not a serialized plan", async () => {
    const payload = Buffer.from([0, 1, 2]);
    disk.bytes = serialize({
      ...envelope(),
      payload,
      checksum: sha256(payload),
    });
    await expectRebuild();
  });

  it("does not persist or return an invalid newly built plan", async () => {
    vi.mocked(buildWorldPlan).mockReturnValue({
      ...fixture,
      sites: { ...fixture.sites, spawns: [] },
    });
    await expect(loadPlan(seed, sourceHash, root)).rejects.toThrow(
      "WorldPlan site roster incomplete",
    );
    expect(buildWorldPlan).toHaveBeenCalledExactlyOnceWith(seed);
    expect(writeFile).not.toHaveBeenCalled();
    expect(disk.bytes).toBeUndefined();
  });
});
