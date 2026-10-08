/// <reference lib="webworker" />
import { BLOCK_REGISTRY } from "../../../shared/src/blocks/registry.js";
import {
  createLightVolume,
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
import {
  Column,
  collectTestTrees,
  createColumnSample,
  createVoxelSample,
  sampleTestColumn,
  sampleTestVoxel,
  type TreeFeature,
} from "../../../shared/src/worldgen/test-world.js";
import {
  type Address,
  chunkKey,
  editKey,
  meshTransfers,
  type VoxelEdit,
  type WorkerRequest,
  type WorkerResponse,
} from "./worker-protocol.js";

interface ColumnCache {
  readonly x: number;
  readonly z: number;
  readonly columns: Float64Array;
  readonly trees: readonly TreeFeature[];
}
interface LitCache {
  readonly address: Address;
  readonly volume: LightVolume;
  readonly blocks: Uint16Array;
}
let seed = 1;
const edits = new Map<number, number>();
const columns = new Map<string, ColumnCache>();
const volumes = new Map<string, LitCache>();
const voxel = createVoxelSample();
function columnTile(cx: number, cz: number): ColumnCache {
  const key = `${cx},${cz}`;
  const old = columns.get(key);
  if (old) {
    columns.delete(key);
    columns.set(key, old);
    return old;
  }
  const x = cx * 32,
    z = cz * 32,
    values = new Float64Array(32 * 32 * Column.Stride),
    c = createColumnSample();
  for (let iz = 0; iz < 32; iz++)
    for (let ix = 0; ix < 32; ix++) {
      sampleTestColumn(seed, x + ix + 0.5, z + iz + 0.5, c);
      values.set(c, (ix + 32 * iz) * Column.Stride);
    }
  const tile = {
    x,
    z,
    columns: values,
    trees: collectTestTrees(seed, x + 0.5, z + 0.5, x + 31.5, z + 31.5),
  };
  columns.set(key, tile);
  if (columns.size > 96) columns.delete(columns.keys().next().value as string);
  return tile;
}
function sample(
  x: number,
  y: number,
  z: number,
  c: Float64Array,
  trees: readonly TreeFeature[],
): number {
  const edit = edits.get(editKey(x, y, z));
  if (edit !== undefined) return edit;
  return sampleTestVoxel(seed, x + 0.5, y + 0.5, z + 0.5, voxel, c, trees)
    .block;
}
function cachedColumn(
  x: number,
  z: number,
): { c: Float64Array; trees: readonly TreeFeature[] } {
  const tile = columnTile(Math.floor(x / 32), Math.floor(z / 32));
  const start = (x - tile.x + 32 * (z - tile.z)) * Column.Stride;
  return {
    c: tile.columns.subarray(start, start + Column.Stride),
    trees: tile.trees,
  };
}
function buildVolume(a: Address): LitCache {
  const v = createLightVolume(96, 96, 96),
    blocks = new Uint16Array(v.light.length);
  const ox = a.cx * 32 - 32,
    oy = a.cy * 32 - 32,
    oz = a.cz * 32 - 32;
  for (let z = 0; z < 96; z++)
    for (let x = 0; x < 96; x++) {
      const wx = ox + x,
        wz = oz + z,
        { c, trees } = cachedColumn(wx, wz);
      for (let y = 0; y < 96; y++) {
        const i = lightIndex(v, x, y, z),
          id = sample(wx, oy + y, wz, c, trees);
        blocks[i] = id;
        v.opacity[i] = BLOCK_REGISTRY[id]?.lightFiltering ?? 15;
      }
      // Height-map seed: look only at the surface/feature band, never a 2.5km shaft.
      // Blockers >64m above this volume's top deliberately do not darken it.
      let highest = c[Column.Height] as number;
      for (const tree of trees)
        highest = Math.max(
          highest,
          tree.crownY + tree.crownHeight,
          tree.trunkTop,
        );
      const topY = oy + 95;
      let incoming =
        highest > topY + 64
          ? 15
          : topY < (c[Column.Height] as number) - 1
            ? 0
            : 15;
      for (
        let wy = Math.min(topY + 64, Math.ceil(highest));
        incoming > 0 && wy > topY;
        wy--
      )
        incoming = Math.max(
          0,
          incoming -
            (BLOCK_REGISTRY[sample(wx, wy, wz, c, trees)]?.lightFiltering ??
              15),
        );
      // Persisted roof edits may sit above the natural surface band.
      for (
        let wy = Math.max(topY + 1, Math.ceil(highest) + 1);
        incoming > 0 && wy <= topY + 64;
        wy++
      ) {
        const id = edits.get(editKey(wx, wy, wz));
        if (id !== undefined)
          incoming = Math.max(
            0,
            incoming - (BLOCK_REGISTRY[id]?.lightFiltering ?? 15),
          );
      }
      const top = lightIndex(v, x, 95, z);
      incoming = Math.max(0, incoming - (v.opacity[top] as number));
      v.sources[top] = incoming << 12;
    }
  return { address: a, volume: v, blocks };
}
function applyEdit(edit: VoxelEdit): void {
  edits.set(editKey(edit.x, edit.y, edit.z), edit.block);
  for (const [key, cached] of volumes) {
    const x = edit.x - cached.address.cx * 32 + 32,
      y = edit.y - cached.address.cy * 32 + 32,
      z = edit.z - cached.address.cz * 32 + 32;
    if (x < 0 || x >= 96 || z < 0 || z >= 96 || y < 0 || y >= 160) continue;
    // Changes on/above the incoming boundary need a fresh height-map seed.
    if (y >= 95) {
      volumes.delete(key);
      continue;
    }
    const i = lightIndex(cached.volume, x, y, z);
    cached.blocks[i] = edit.block;
    cached.volume.opacity[i] = BLOCK_REGISTRY[edit.block]?.lightFiltering ?? 15;
    relightEdits(cached.volume, [i]);
  }
}
function generate(request: Extract<WorkerRequest, { type: "chunk" }>): void {
  const progress = (
    stage: "generating" | "generated" | "lighting" | "meshing",
  ) =>
    self.postMessage({
      type: "progress",
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
  const core = new Uint16Array(CHUNK_VOLUME),
    coreLight = new Uint16Array(CHUNK_VOLUME),
    halo = new Uint16Array(HALO_VOLUME),
    light = new Uint16Array(HALO_VOLUME);
  for (let y = -1; y < 40; y++)
    for (let z = -1; z <= 32; z++)
      for (let x = -1; x <= 32; x++) {
        const i = lightIndex(cache.volume, x + 32, y + 32, z + 32),
          h = haloIndex(x, y, z);
        halo[h] = cache.blocks[i] as number;
        light[h] = cache.volume.light[i] as number;
        if (x >= 0 && x < 32 && y >= 0 && y < 32 && z >= 0 && z < 32) {
          const j = voxelIndex(x, y, z);
          core[j] = halo[h] as number;
          coreLight[j] = light[h] as number;
        }
      }
  const mesh = meshChunk(halo, light),
    t3 = performance.now();
  let cacheBytes = 0;
  for (const column of columns.values())
    cacheBytes += column.columns.byteLength;
  for (const lit of volumes.values())
    cacheBytes +=
      lit.blocks.byteLength +
      lit.volume.opacity.byteLength +
      lit.volume.light.byteLength +
      lit.volume.sources.byteLength;
  const result: WorkerResponse = {
    type: "chunk",
    id: request.id,
    address: request.address,
    revision: request.revision,
    blocks: core,
    light: coreLight,
    mesh,
    timings: { generate: t1 - t0, light: t2 - t1, mesh: t3 - t2 },
    cacheBytes,
  };
  self.postMessage(result, {
    transfer: [core.buffer, coreLight.buffer, ...meshTransfers(mesh)],
  });
}
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  try {
    if (message.type === "init") {
      seed = message.seed;
      edits.clear();
      columns.clear();
      volumes.clear();
      for (const e of message.edits) edits.set(editKey(e.x, e.y, e.z), e.block);
    } else if (message.type === "edit") applyEdit(message.edit);
    else generate(message);
  } catch (error) {
    self.postMessage({
      type: "error",
      id: message.type === "chunk" ? message.id : -1,
      message: error instanceof Error ? error.message : String(error),
    } satisfies WorkerResponse);
  }
};
