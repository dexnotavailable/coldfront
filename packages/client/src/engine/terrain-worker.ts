/// <reference lib="webworker" />

import { BLOCK_REGISTRY } from "../../../shared/src/blocks/registry.js";
import {
  createLightVolume,
  emissionLight,
  type LightVolume,
  lightIndex,
  relightEdits,
  solveLight,
} from "../../../shared/src/lighting/flood.js";
import { meshChunk } from "../../../shared/src/meshing/greedy.js";
import {
  CHUNK_VOLUME,
  HALO_VOLUME,
} from "../../../shared/src/world/constants.js";
import {
  haloIndex,
  voxelIndex,
} from "../../../shared/src/world/coordinates.js";
import { generationVariant } from "../../../shared/src/world/generation-variant.js";
import type {
  SkyInput,
  VoxelSample,
  WorldAreaSampler,
  WorldContext,
} from "../../../shared/src/world/types.js";
import { createWorldContext } from "../../../shared/src/world/world-context.js";
import type { VoxelChunk } from "../../../shared/src/worldgen/chunk.js";
import { generateWorldChunk } from "../../../shared/src/worldgen/main/chunk.js";
import type { WorldSession } from "../contracts/game-ui.js";
import { sameSession } from "../game/session.js";
import { insideFrame } from "../game/world-save.js";
import { BlockSampleCache } from "./block-sample-cache.js";
import {
  type Address,
  chunkKey,
  editKey,
  meshTransfers,
  type VoxelEdit,
  type WorkerFeatureCacheStats,
  type WorkerRequest,
  type WorkerResponse,
} from "./worker-protocol.js";

interface ColumnCache {
  readonly x: number;
  readonly z: number;
  readonly columns: Float64Array;
}
interface LitCache {
  readonly address: Address;
  readonly volume: LightVolume;
  readonly blocks: Uint16Array;
  readonly chunk: VoxelChunk;
}
let world: WorldSession | null = null;
let context: WorldContext;
const edits = new Map<number, number>();
const columns = new Map<string, ColumnCache>();
const volumes = new Map<string, LitCache>();
const blockSamples = new BlockSampleCache();
const voxel: VoxelSample = { density: 0, block: 0, fluid: 0 };
const emissions = Uint16Array.from(BLOCK_REGISTRY, (b) =>
  emissionLight(b.emission),
);
function columnTile(
  cx: number,
  cz: number,
  area: WorldAreaSampler,
): ColumnCache {
  const key = `${cx},${cz}`,
    old = columns.get(key);
  if (old) {
    columns.delete(key);
    columns.set(key, old);
    return old;
  }
  const x = cx * 32,
    z = cz * 32,
    stride = area.columns.stride;
  const values = new Float64Array(32 * 32 * stride),
    c = area.createColumn();
  for (let iz = 0; iz < 32; iz++)
    for (let ix = 0; ix < 32; ix++) {
      area.sampleColumn(x + ix + 0.5, z + iz + 0.5, c);
      values.set(c, (ix + 32 * iz) * stride);
    }
  const tile = { x, z, columns: values };
  columns.set(key, tile);
  if (columns.size > 96) columns.delete(columns.keys().next().value as string);
  return tile;
}
function sample(
  area: WorldAreaSampler,
  x: number,
  y: number,
  z: number,
  c: Float64Array,
): number {
  const block = blockSamples.sample(area, x, y, z, c, voxel);
  const edit = insideFrame(x, y, z) ? edits.get(editKey(x, y, z)) : undefined;
  if (edit !== undefined) {
    voxel.featureId = 0;
    voxel.featureT = 0;
    return edit;
  }
  return block;
}
function buildVolume(a: Address): LitCache {
  const chunk = generateWorldChunk(context, a.cx, a.cy, a.cz);
  const v = createLightVolume(96, 96, 96),
    blocks = new Uint16Array(v.light.length);
  const ox = a.cx * 32 - 32,
    oy = a.cy * 32 - 32,
    oz = a.cz * 32 - 32;
  const area = context.prepareArea({
    minX: ox + 0.5,
    minZ: oz + 0.5,
    maxX: ox + 95.5,
    maxZ: oz + 95.5,
  });
  const sky: SkyInput = { solidBelowY: 0, highestFilterY: 0 };
  for (let z = 0; z < 96; z++)
    for (let x = 0; x < 96; x++) {
      const wx = ox + x,
        wz = oz + z,
        tile = columnTile(Math.floor(wx / 32), Math.floor(wz / 32), area);
      const start = (wx - tile.x + 32 * (wz - tile.z)) * area.columns.stride;
      const c = tile.columns.subarray(start, start + area.columns.stride);
      for (let y = 0; y < 96; y++) {
        const i = lightIndex(v, x, y, z);
        const inHalo =
          x >= 31 && x <= 64 && z >= 31 && z <= 64 && y >= 31 && y < 72;
        const edit = insideFrame(wx, oy + y, wz)
          ? edits.get(editKey(wx, oy + y, wz))
          : undefined;
        const id =
          edit ??
          (inHalo
            ? (chunk.haloBlocks[haloIndex(x - 32, y - 32, z - 32)] as number)
            : sample(area, wx, oy + y, wz, c));
        blocks[i] = id;
        v.opacity[i] = BLOCK_REGISTRY[id]?.lightFiltering ?? 15;
        v.sources[i] = emissions[id] ?? 0;
        if (inHalo) {
          const h = haloIndex(x - 32, y - 32, z - 32);
          chunk.haloBlocks[h] = id;
          if (edit !== undefined) {
            if (chunk.featureIds) chunk.featureIds[h] = 0;
            if (chunk.featureT) chunk.featureT[h] = 0;
          }
        }
        if (x >= 32 && x < 64 && y >= 32 && y < 64 && z >= 32 && z < 64)
          chunk.blocks[voxelIndex(x - 32, y - 32, z - 32)] = id;
      }
      // Actual surface/feature/water bound; only the64m incoming-light window is
      // evaluated. Shared skyInput owns natural bounds, never test-tree guesses.
      area.skyInput(wx + 0.5, wz + 0.5, sky, c);
      const topY = oy + 95;
      let incoming = 15;
      for (
        let wy = Math.min(topY + 64, Math.ceil(sky.highestFilterY));
        incoming > 0 && wy > topY;
        wy--
      )
        incoming = Math.max(
          0,
          incoming -
            (BLOCK_REGISTRY[sample(area, wx, wy, wz, c)]?.lightFiltering ?? 15),
        );
      // Persisted roof edits can rise above the natural bound.
      for (
        let wy = Math.max(topY + 1, Math.ceil(sky.highestFilterY) + 1);
        incoming > 0 && wy <= topY + 64;
        wy++
      ) {
        const id = insideFrame(wx, wy, wz)
          ? edits.get(editKey(wx, wy, wz))
          : undefined;
        if (id !== undefined)
          incoming = Math.max(
            0,
            incoming - (BLOCK_REGISTRY[id]?.lightFiltering ?? 15),
          );
      }
      const top = lightIndex(v, x, 95, z);
      v.sources[top] =
        ((v.sources[top] as number) & 0x0fff) |
        (Math.max(0, incoming - (v.opacity[top] as number)) << 12);
    }
  return { address: a, volume: v, blocks, chunk };
}
function applyEdit(edit: VoxelEdit): void {
  if (!insideFrame(edit.x, edit.y, edit.z))
    throw new RangeError("Edit outside world frame");
  edits.set(editKey(edit.x, edit.y, edit.z), edit.block);
  for (const [key, cached] of volumes) {
    const x = edit.x - cached.address.cx * 32 + 32,
      y = edit.y - cached.address.cy * 32 + 32,
      z = edit.z - cached.address.cz * 32 + 32;
    if (x < 0 || x >= 96 || z < 0 || z >= 96 || y < 0 || y >= 160) continue;
    if (y >= 95) {
      volumes.delete(key);
      continue;
    }
    const i = lightIndex(cached.volume, x, y, z);
    cached.blocks[i] = edit.block;
    cached.volume.opacity[i] = BLOCK_REGISTRY[edit.block]?.lightFiltering ?? 15;
    cached.volume.sources[i] =
      ((cached.volume.sources[i] as number) & 0xf000) |
      (emissions[edit.block] ?? 0);
    if (x >= 31 && x <= 64 && z >= 31 && z <= 64 && y >= 31 && y < 72) {
      const h = haloIndex(x - 32, y - 32, z - 32);
      cached.chunk.haloBlocks[h] = edit.block;
      if (cached.chunk.featureIds) cached.chunk.featureIds[h] = 0;
      if (cached.chunk.featureT) cached.chunk.featureT[h] = 0;
    }
    if (x >= 32 && x < 64 && y >= 32 && y < 64 && z >= 32 && z < 64)
      cached.chunk.blocks[voxelIndex(x - 32, y - 32, z - 32)] = edit.block;
    relightEdits(cached.volume, [i]);
  }
}
function generate(request: Extract<WorkerRequest, { type: "chunk" }>): void {
  const progress = (
    stage: "generating" | "generated" | "lighting" | "meshing",
  ) =>
    self.postMessage({
      type: "progress",
      world: request.world,
      id: request.id,
      stage,
    } satisfies WorkerResponse);
  progress("generating");
  const t0 = performance.now(),
    key = chunkKey(request.address);
  let cache = volumes.get(key);
  const fresh = !cache;
  if (!cache) cache = buildVolume(request.address);
  const t1 = performance.now();
  progress("generated");
  progress("lighting");
  if (fresh) solveLight(cache.volume);
  volumes.delete(key);
  volumes.set(key, cache);
  if (volumes.size > 2) volumes.delete(volumes.keys().next().value as string);
  const t2 = performance.now();
  progress("meshing");
  // The shared assembler owns block ordering; lighting only extracts its halo.
  const core = cache.chunk.blocks.slice(),
    coreLight = new Uint16Array(CHUNK_VOLUME),
    light = new Uint16Array(HALO_VOLUME);
  for (let y = -1; y < 40; y++)
    for (let z = -1; z <= 32; z++)
      for (let x = -1; x <= 32; x++) {
        const i = lightIndex(cache.volume, x + 32, y + 32, z + 32),
          h = haloIndex(x, y, z);
        light[h] = cache.volume.light[i] as number;
        if (x >= 0 && x < 32 && y >= 0 && y < 32 && z >= 0 && z < 32)
          coreLight[voxelIndex(x, y, z)] = light[h] as number;
      }
  const mesh = meshChunk(cache.chunk.haloBlocks, light, cache.chunk.featureIds),
    t3 = performance.now();
  const blockSampleCacheStats = blockSamples.statistics();
  let cacheBytes = emissions.byteLength + blockSampleCacheStats.typedArrayBytes;
  for (const column of columns.values())
    cacheBytes += column.columns.byteLength;
  for (const lit of volumes.values())
    cacheBytes +=
      lit.blocks.byteLength +
      lit.volume.opacity.byteLength +
      lit.volume.light.byteLength +
      lit.volume.sources.byteLength +
      lit.chunk.blocks.byteLength +
      lit.chunk.haloBlocks.byteLength +
      lit.chunk.columns.byteLength +
      lit.chunk.density.byteLength +
      (lit.chunk.featureIds?.byteLength ?? 0) +
      (lit.chunk.featureT?.byteLength ?? 0);
  const featureCacheStats = (
    context as WorldContext & {
      featureCacheStats?(): WorkerFeatureCacheStats;
    }
  ).featureCacheStats?.();
  const result: WorkerResponse = {
    type: "chunk",
    world: request.world,
    id: request.id,
    address: request.address,
    revision: request.revision,
    blocks: core,
    light: coreLight,
    mesh,
    regionColor: regionColor(request.address),
    timings: { generate: t1 - t0, light: t2 - t1, mesh: t3 - t2 },
    cacheBytes,
    blockSampleCacheStats,
    ...(featureCacheStats ? { featureCacheStats } : {}),
  };
  self.postMessage(result, {
    transfer: [core.buffer, coreLight.buffer, ...meshTransfers(mesh)],
  });
}
function regionColor(address: Address): readonly [number, number, number] {
  if (!context.regions.length) return [98, 118, 68];
  const weights = context.surfaceWeights(
    address.cx * 32 + 16,
    address.cz * 32 + 16,
    { count: 0, ids: new Uint8Array(16), weights: new Float64Array(16) },
  );
  const color: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < weights.count; i++) {
    const region = context.regions.find(
      (value) => value.index === weights.ids[i],
    );
    if (region)
      for (let channel = 0; channel < 3; channel++)
        color[channel] =
          (color[channel] as number) +
          (region.color[channel] as number) * (weights.weights[i] as number);
  }
  return color;
}
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  try {
    if (message.type === "init") {
      const variant = generationVariant(message.world.identity);
      if (message.world.identity.kind === "main") {
        if (!message.plan)
          throw new Error("Main terrain requires its WorldPlan");
        context = createWorldContext({
          kind: "main",
          seed: message.world.identity.seed,
          plan: message.plan,
          variant,
        });
      } else
        context = createWorldContext({
          kind: "test",
          seed: message.world.identity.seed,
        });
      world = message.world;
      edits.clear();
      columns.clear();
      volumes.clear();
      blockSamples.clear();
      for (const edit of message.edits)
        edits.set(editKey(edit.x, edit.y, edit.z), edit.block);
      self.postMessage({ type: "ready", world } satisfies WorkerResponse);
    } else if (sameSession(world, message.world)) {
      if (message.type === "edit") applyEdit(message.edit);
      else generate(message);
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      world: message.world,
      id: message.type === "chunk" ? message.id : -1,
      message: error instanceof Error ? error.message : String(error),
    } satisfies WorkerResponse);
  }
};
