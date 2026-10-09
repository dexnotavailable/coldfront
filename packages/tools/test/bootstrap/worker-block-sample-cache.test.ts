import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { WorldSession } from "../../../client/src/contracts/game-ui.js";
import {
  BLOCK_SAMPLE_PAGE_BYTES,
  BlockSampleCache,
} from "../../../client/src/engine/block-sample-cache.js";
import type {
  ChunkResult,
  VoxelEdit,
  WorkerRequest,
  WorkerResponse,
} from "../../../client/src/engine/worker-protocol.js";
import { Block } from "../../../shared/src/blocks/registry.js";
import * as lighting from "../../../shared/src/lighting/flood.js";
import {
  CHUNK_VOLUME,
  HALO_VOLUME,
} from "../../../shared/src/world/constants.js";
import {
  haloIndex,
  voxelIndex,
} from "../../../shared/src/world/coordinates.js";
import { generationKey } from "../../../shared/src/world/generation-variant.js";
import type {
  VoxelSample,
  WorldAreaSampler,
  WorldContext,
  WorldContextOptions,
  WorldPlanData,
} from "../../../shared/src/world/types.js";
import type { VoxelChunk } from "../../../shared/src/worldgen/chunk.js";

const hash = (array: ArrayBufferView) =>
  createHash("sha256")
    .update(Buffer.from(array.buffer, array.byteOffset, array.byteLength))
    .digest("hex");

async function scenario(cached: boolean) {
  vi.resetModules();
  const snapshots: {
      blocks: string;
      externalBlocks: string;
      externalSamples: number;
      opacity: string;
      sources: string;
      light: string;
      coreLight: string;
      mesh: ChunkResult["mesh"];
    }[] = [],
    stats: NonNullable<ChunkResult["blockSampleCacheStats"]>[] = [],
    rawCalls: number[] = [],
    built: VoxelChunk[] = [],
    volumes = new Map<string, lighting.LightVolume>();
  let messages: WorkerResponse[] = [],
    currentAddress = "",
    seed = 1,
    primitive = false,
    calls = 0,
    stream = createHash("sha256"),
    sampled = 0,
    used = 0;
  const streamBuffer = new Uint16Array(4096);
  const flush = () => {
    stream.update(Buffer.from(streamBuffer.buffer, 0, used * 2));
    used = 0;
  };
  const blockAt = (x: number, y: number, z: number) => {
    // A narrow sky shaft with one natural filter and an emissive gallery.
    if (x === 0 && z === 0 && y >= -4)
      return y === 80 ? Block.Water : Block.Air;
    if (y === 0 && z === 0 && x >= -8 && x <= 40)
      return x === 31 ? Block.Lava : x === 35 ? Block.EmberCrust : Block.Air;
    return primitive ? Block.Obsidian : seed === 1 ? Block.Stone : Block.Dirt;
  };
  const area = {
    columns: {
      stride: 8,
      height: 2,
      gradientX: 3,
      gradientZ: 4,
      waterLevel: 6,
    },
    createColumn: () => new Float64Array(8),
    sampleColumn: (_x: number, _z: number, out: Float64Array) => out,
    sampleVoxel(x, y, z, out) {
      calls++;
      out.block = blockAt(Math.floor(x), Math.floor(y), Math.floor(z));
      return out;
    },
    skyInput(_x, _z, out) {
      out.highestFilterY = 96;
      out.solidBelowY = -20;
      return out;
    },
  } as WorldAreaSampler;
  const context = {
    ...area,
    regions: [],
    prepareArea: () => area,
  } as unknown as WorldContext;
  vi.doMock("../../../shared/src/world/world-context.js", () => ({
    createWorldContext: (options: WorldContextOptions) => {
      seed = options.seed;
      primitive = options.kind === "main" && options.variant === "primitive";
      return context;
    },
  }));
  vi.doMock("../../../shared/src/lighting/flood.js", () => ({
    ...lighting,
    createLightVolume: (w: number, h: number, d: number) => {
      const v = lighting.createLightVolume(w, h, d);
      volumes.set(currentAddress, v);
      return v;
    },
  }));
  vi.doMock("../../../client/src/engine/block-sample-cache.js", () => ({
    BlockSampleCache: class extends BlockSampleCache {
      override sample(
        source: WorldAreaSampler,
        x: number,
        y: number,
        z: number,
        column: Float64Array,
        voxel: VoxelSample,
      ) {
        const block = cached
          ? super.sample(source, x, y, z, column, voxel)
          : source.sampleVoxel(x + 0.5, y + 0.5, z + 0.5, voxel, column).block;
        streamBuffer[used++] = block;
        sampled++;
        if (used === streamBuffer.length) flush();
        return block;
      }
    },
  }));
  vi.doMock("../../../shared/src/worldgen/main/chunk.js", () => ({
    generateWorldChunk: (
      _context: WorldContext,
      cx: number,
      cy: number,
      cz: number,
    ) => {
      currentAddress = `${cx},${cy},${cz}`;
      const chunk: VoxelChunk = {
        seed,
        version: 4,
        cx,
        cy,
        cz,
        spacing: 1,
        blocks: new Uint16Array(CHUNK_VOLUME),
        haloBlocks: new Uint16Array(HALO_VOLUME),
        density: new Float64Array(HALO_VOLUME),
        columns: new Float64Array(34 * 34 * 8),
        featureIds: new Uint32Array(HALO_VOLUME),
        featureT: new Float64Array(HALO_VOLUME),
      };
      for (let y = -1; y < 40; y++)
        for (let z = -1; z <= 32; z++)
          for (let x = -1; x <= 32; x++) {
            const h = haloIndex(x, y, z),
              id = blockAt(cx * 32 + x, cy * 32 + y, cz * 32 + z);
            chunk.haloBlocks[h] = id;
            if (id === Block.Lava) {
              (chunk.featureIds as Uint32Array)[h] = 0xfedcba99;
              (chunk.featureT as Float64Array)[h] = 0.875;
            }
            if (x >= 0 && x < 32 && y >= 0 && y < 32 && z >= 0 && z < 32)
              chunk.blocks[voxelIndex(x, y, z)] = id;
          }
      built.push(chunk);
      return chunk;
    },
  }));
  const worker = {
    onmessage: null as ((e: MessageEvent<WorkerRequest>) => void) | null,
    postMessage(
      message: WorkerResponse,
      options?: { transfer: ArrayBuffer[] },
    ) {
      messages.push(structuredClone(message, options));
      if (options)
        expect(
          options.transfer.every((buffer) => buffer.byteLength === 0),
        ).toBe(true);
    },
  };
  vi.stubGlobal("self", worker);
  try {
    await import("../../../client/src/engine/terrain-worker.js");
    let world: WorldSession = {
      id: 7,
      identity: {
        kind: "main" as const,
        seed: 1,
        generation: generationKey(4, "a".repeat(64)),
      },
    };
    const send = (data: WorkerRequest) =>
      worker.onmessage?.({ data } as MessageEvent<WorkerRequest>);
    const init = (edits: VoxelEdit[] = []) => {
      send({ type: "init", world, plan: {} as WorldPlanData, edits });
      expect(messages.at(-1)?.type).toBe("ready");
    };
    const request = (cx: number) => {
      stream = createHash("sha256");
      used = sampled = calls = 0;
      messages = [];
      send({
        type: "chunk",
        world,
        id: snapshots.length + 1,
        revision: 0,
        address: { cx, cy: 0, cz: 0 },
      });
      const result = messages.at(-1);
      if (result?.type !== "chunk") throw new Error(JSON.stringify(result));
      const volume = volumes.get(`${cx},0,0`);
      if (!volume) throw new Error("Missing volume");
      flush();
      snapshots.push({
        blocks: hash(result.blocks),
        externalBlocks: stream.digest("hex"),
        externalSamples: sampled,
        opacity: hash(volume.opacity),
        sources: hash(volume.sources),
        light: hash(volume.light),
        coreLight: hash(result.light),
        mesh: result.mesh,
      });
      const cacheStats = result.blockSampleCacheStats;
      if (!cacheStats) throw new Error("Missing block cache counters");
      stats.push(cacheStats);
      rawCalls.push(calls);
      expect(cacheStats.pages).toBeLessThanOrEqual(64);
      expect(cacheStats.typedArrayBytes).toBe(
        cacheStats.pages * BLOCK_SAMPLE_PAGE_BYTES,
      );
      // Returned core/mesh buffers have detached at the sender. Persistent core,
      // halo and raw pages must survive those transfers and later cache hits.
      for (const chunk of built) {
        expect(chunk.blocks.byteLength).toBe(CHUNK_VOLUME * 2);
        expect(chunk.haloBlocks.byteLength).toBe(HALO_VOLUME * 2);
      }
      return result;
    };
    const edit = (value: VoxelEdit) =>
      send({ type: "edit", world, edit: value });
    const topSky = () => {
      const volume = volumes.get("0,0,0") as lighting.LightVolume;
      return (
        (volume.sources[lighting.lightIndex(volume, 32, 95, 32)] as number) >>>
        12
      );
    };
    init();
    request(0);
    request(1); // Distinct address; its external volume overlaps owner0.
    request(0); // Existing whole-volume cache; no raw sampling.
    expect(rawCalls[2]).toBe(0);
    edit({ x: 31, y: 0, z: 0, block: Block.Air });
    request(1);
    request(0);
    edit({ x: 31, y: 0, z: 0, block: Block.VentMouth });
    request(1);
    expect(topSky()).toBe(13);
    edit({ x: 0, y: 80, z: 0, block: Block.Stone });
    request(0); // Incoming-window edit invalidates whole-volume entry.
    expect(topSky()).toBe(0);
    edit({ x: 0, y: 80, z: 0, block: Block.Air });
    request(0); // Explicit Air overrides the still-cached natural Water.
    expect(topSky()).toBe(15);
    edit({ x: 0, y: 110, z: 0, block: Block.Stone });
    request(0); // Persisted roof above natural bound still filters.
    expect(topSky()).toBe(0);
    edit({ x: 0, y: 110, z: 0, block: Block.Air });
    request(0);
    expect(topSky()).toBe(15);
    for (const y of [63, 64, 127]) {
      edit({ x: 0, y, z: 0, block: Block.Stone });
      request(0); // Top itself, top+1 and exactly top+64 must invalidate.
      expect(topSky()).toBe(0);
      edit({ x: 0, y, z: 0, block: Block.Air });
      request(0);
      expect(topSky()).toBe(15);
    }
    edit({ x: 0, y: 128, z: 0, block: Block.Stone });
    request(0); // top+65 is outside the unchanged incoming-light window.
    expect(topSky()).toBe(15);
    expect(rawCalls.at(-1)).toBe(0);
    request(-1);
    request(6); // Enough new owners to recycle raw pages and whole volumes.
    request(-1);
    if (cached) expect(stats.at(-1)?.evictions).toBeGreaterThan(0);
    init(); // Same identity and session must still flush every page and edit.
    request(0);
    expect(stats.at(-1)?.hits).toBe(0);
    world = { ...world, identity: { ...world.identity, seed: 2 } };
    init();
    request(0);
    expect(stats.at(-1)?.hits).toBe(0);
    world = {
      ...world,
      identity: {
        ...world.identity,
        generation: generationKey(5, "b".repeat(64)),
      },
    };
    init();
    request(0);
    expect(stats.at(-1)?.hits).toBe(0);
    world = {
      ...world,
      identity: {
        ...world.identity,
        generation: generationKey(5, "b".repeat(64), "primitive"),
      },
    };
    init();
    request(0);
    expect(stats.at(-1)?.hits).toBe(0);
    world = {
      id: 8,
      identity: {
        kind: "test",
        seed: 1,
        generation: generationKey(5, "b".repeat(64)),
      },
    };
    init();
    request(0);
    expect(stats.at(-1)?.hits).toBe(0);
    const stale = { ...world, id: world.id - 1 };
    const before = messages.length;
    send({
      type: "chunk",
      world: stale,
      id: 99,
      address: { cx: 0, cy: 0, cz: 0 },
      revision: 0,
    });
    expect(messages).toHaveLength(before);
    return { snapshots, stats, rawCalls };
  } finally {
    vi.unstubAllGlobals();
    vi.doUnmock("../../../shared/src/world/world-context.js");
    vi.doUnmock("../../../shared/src/worldgen/main/chunk.js");
    vi.doUnmock("../../../shared/src/lighting/flood.js");
    vi.doUnmock("../../../client/src/engine/block-sample-cache.js");
    vi.resetModules();
  }
}

describe("worker lighting sample reuse", () => {
  it("matches uncached block streams, opacity, sources, light and meshes through overlap, edits, eviction, transfer and init", async () => {
    // Real worker/light/mesh code; only world creation and chunk generation use
    // a cheap deterministic fixture. No plan, actual terrain or browser runs.
    const reference = await scenario(false),
      reused = await scenario(true);
    expect(reused.snapshots).toEqual(reference.snapshots);
    expect(reused.rawCalls[0]).toBe(reference.rawCalls[0]);
    expect(reused.rawCalls[1]).toBeLessThan(
      (reference.rawCalls[1] as number) / 2,
    );
    expect(reused.stats[1]?.hits).toBeGreaterThan(400_000);
    expect(reused.stats.at(-1)?.evictions).toBe(0);
    process.stdout.write(
      `${JSON.stringify({
        kind: "synthetic lighting sample receipt",
        snapshots: reused.snapshots.length,
        referenceFirstTwoRawCalls: reference.rawCalls.slice(0, 2),
        cachedFirstTwoRawCalls: reused.rawCalls.slice(0, 2),
        cacheAfterTwo: reused.stats[1],
        peakPages: Math.max(...reused.stats.map((s) => s.pages)),
        peakTypedArrayBytes: Math.max(
          ...reused.stats.map((s) => s.typedArrayBytes),
        ),
        scope:
          "synthetic generator; real worker, lighting and mesh; no actual-world speed claim",
      })}\n`,
    );
  });
});
