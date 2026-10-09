import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type GoldenFixture, hashChunk } from "../../tools/src/golden/core.js";
import type { IbaraPlanData, WorldVoxelSample } from "../src/index.js";
import { HALO_VOLUME } from "../src/world/constants.js";
import { haloIndex } from "../src/world/coordinates.js";
import { createWorldContext } from "../src/world/world-context.js";
import { generateTestChunk, type VoxelChunk } from "../src/worldgen/chunk.js";

const frozen = {
  "ops.ts": "9d4c3b24ebeada590e2d5ac357ae4da6d0deee94fb48237e1d8720f040a6385e",
  "polygon.ts":
    "557dbd6a17e4acc7e79e2794acb775e391959ff3f56b23b5e9e8dbf947df0cb0",
  "primitives.ts":
    "405cfaddb4af4454f52dddb6a07ef508d586041b37d4ec15f9c8c28aa674081a",
  "spine.ts":
    "5f6ca60ed57ad4d0fa14d2080e0bfbb4a9e93c358087dd4ec6137f87c77fbc03",
  "types.ts":
    "b3e59495a8170b37d1a19df47c1b8d222d8f8903d82e68f5fba15c65c0027340",
} as const;

describe("phase 1.3 frozen shared contracts", () => {
  it("retains the five pass02b SDF sources without cross-consumer changes", () => {
    for (const [file, hash] of Object.entries(frozen)) {
      const bytes = readFileSync(
        new URL(`../src/sdf/${file}`, import.meta.url),
      );
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash);
    }
  });

  it("preserves original test-world buffers and omits feature arrays", async () => {
    const fixture = JSON.parse(
      readFileSync(new URL("./golden/worldgen.json", import.meta.url), "utf8"),
    ) as GoldenFixture;
    // Six existing records: all three seeds, signed coordinates and both LODs.
    // This bounded gate does not build the main-world plan or a regional census.
    for (const seed of [1, 2, 3]) {
      for (const lod of [0, 1]) {
        const record = fixture.records.find(
          ({ sample }) =>
            sample.world === "test" &&
            sample.seed === seed &&
            sample.lod === lod &&
            sample.cx < 0 &&
            sample.cz < 0,
        );
        if (!record) throw new Error("Missing preserved signed golden");
        const chunk = generateTestChunk(record.sample);
        const context = createWorldContext({ kind: "test", seed });
        expect(context.columns.stride).toBe(8);
        expect(chunk.featureIds).toBeUndefined();
        expect(chunk.featureT).toBeUndefined();
        expect(await hashChunk(chunk, context.columns)).toEqual(record.hashes);
      }
    }
  });

  it("keeps large CPU IDs and binary64 t across the declared halo and clone boundary", () => {
    const ids = new Uint32Array(HALO_VOLUME);
    const t = new Float64Array(HALO_VOLUME);
    const sample: WorldVoxelSample = {
      density: 1,
      block: 18,
      fluid: 0,
      featureId: 25_198_721,
      featureT: 0.8500000000000001,
    };
    const high = haloIndex(32, 39, 32);
    expect(high).toBe(HALO_VOLUME - 1);
    ids[high] = sample.featureId as number;
    t[high] = sample.featureT as number;
    const buffers: Pick<VoxelChunk, "featureIds" | "featureT"> = {
      featureIds: ids,
      featureT: t,
    };
    const cloned = structuredClone(buffers);
    expect(cloned.featureIds).toBeInstanceOf(Uint32Array);
    expect(cloned.featureT).toBeInstanceOf(Float64Array);
    expect(cloned.featureIds?.[high]).toBe(sample.featureId);
    expect(cloned.featureT?.[high]).toBe(sample.featureT);
    expect(Math.fround(sample.featureId as number)).not.toBe(sample.featureId);
    expect(Math.fround(sample.featureT as number)).not.toBe(sample.featureT);
    // Reference encoding for P5/P6, not a claim that the mesher implements it.
    for (const id of [0, 65_535, 65_536, 25_198_721, 0x02000001, 0xffffffff]) {
      const halves = new Uint16Array([id & 0xffff, id >>> 16]);
      const attributes = new Float32Array(halves);
      const reconstructed =
        ((Number(attributes[1]) << 16) | Number(attributes[0])) >>> 0;
      expect(reconstructed).toBe(id);
    }
  });

  it("clones a typed Ibara plan without detaching the owner's drainage or channel buffers", () => {
    const bounds = {
      minX: -64,
      minY: -20,
      minZ: -64,
      maxX: 64,
      maxY: 60,
      maxZ: 64,
    };
    const plan: IbaraPlanData = {
      schema: 1,
      seed: 2,
      bounds,
      calderas: [
        {
          id: 1,
          x: 0,
          z: 0,
          radius: 200,
          baseY: 0,
          floorY: -20,
          rimHeight: 40,
          rimWidth: 20,
          lavaRadius: 80,
          lavaLevel: -10,
          bounds: { ...bounds, minX: -250, minZ: -250, maxX: 250, maxZ: 250 },
        },
      ],
      channels: [
        {
          id: 2,
          calderaId: 1,
          points: new Float64Array([0, 0, -20, -10, 3, 32, 32, -25, -12, 4]),
          leveeWidth: 3,
          leveeHeight: 2,
          sink: "cooled",
          bounds,
        },
      ],
      vents: [],
      routing: {
        grid: { minX: -64, minZ: -64, spacing: 64, width: 2, depth: 2 },
        terrain: new Float64Array([-12, -10, 1.0000000000000002, 4]),
        routingHeight: new Float64Array([-12, -10, 1.0000000000000002, 4]),
        receivers: new Int32Array([-1, 0, 0, 1]),
        routingOrder: new Uint32Array([0, 1, 2, 3]),
        drainageArea: new Float64Array([16_384, 8192, 4096, 4096]),
        sourceCalderaIds: new Uint32Array([0, 1, 0, 0]),
      },
    };
    const cloned = structuredClone(plan);
    expect(cloned).toEqual(plan);
    expect(cloned.routing.terrain).toBeInstanceOf(Float64Array);
    expect(cloned.routing.receivers).toBeInstanceOf(Int32Array);
    expect(cloned.routing.sourceCalderaIds).toBeInstanceOf(Uint32Array);
    expect(cloned.routing.terrain.buffer).not.toBe(plan.routing.terrain.buffer);
    cloned.routing.terrain[0] = 900;
    expect(plan.routing.terrain[0]).toBe(-12);
    expect(plan.channels[0]?.points.byteLength).toBe(80);
  });
});
