import { performance } from "node:perf_hooks";
import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import { solveLight } from "../../../shared/src/lighting/flood.js";
import { meshChunk } from "../../../shared/src/meshing/greedy.js";
import { HALO_WIDTH } from "../../../shared/src/world/constants.js";
import { haloIndex } from "../../../shared/src/world/coordinates.js";
import type {
  FeatureCacheStats,
  WorldColumnLayout,
  WorldContext,
} from "../../../shared/src/world/types.js";
import type { VoxelChunk } from "../../../shared/src/worldgen/chunk.js";
import { generateWorldChunk } from "../../../shared/src/worldgen/main/chunk.js";
import { extractHaloLight, prepareChunkLighting } from "./lighting-input.js";
import type { BenchmarkCase } from "./samples.js";

export interface GenerationMeasurement {
  readonly sample: BenchmarkCase;
  readonly repetition: number;
  readonly generationMs: number;
  readonly solidVoxels: number;
  readonly airOrFluidVoxels: number;
  readonly fluidVoxels: number;
  readonly airVoxels: number;
  readonly outputBytes: number;
  readonly featureVoxels: number;
  readonly featureCache: FeatureCacheStats | null;
}
export interface PipelineMeasurement extends GenerationMeasurement {
  readonly typedWorkingSetBytes: {
    readonly generation: number;
    readonly lightingVolume: number;
    readonly haloLight: number;
    readonly mesh: number;
    readonly total: number;
  };
  readonly neighbourhoodPreparationMs: number;
  readonly lightingMs: number;
  readonly haloExtractionMs: number;
  readonly meshingMs: number;
  readonly totalMeasuredStagesMs: number;
  readonly quads: number;
  readonly skirtQuads: number;
  readonly meshBytes: number;
  readonly litHaloSamples: number;
  readonly skyEvidence: SkyEvidence;
}
export interface SkyEvidence {
  readonly state: "lit" | "dark-submerged";
  readonly reason: string;
  readonly minimumWaterVoxelsAboveOpenHalo: number | null;
}

/** Darkness is accepted only with a physical water-filtering proof for EVERY
 * open halo sample. Ordinary exposed air still has to receive real skylight. */
export function pipelineSkyEvidence(
  chunk: VoxelChunk,
  layout: WorldColumnLayout,
  litHaloSamples: number,
): SkyEvidence {
  if (litHaloSamples > 0)
    return {
      state: "lit",
      reason: "Solved halo contains skylight",
      minimumWaterVoxelsAboveOpenHalo: null,
    };
  let minimum = Infinity;
  for (let z = -1; z <= 32; z++)
    for (let x = -1; x <= 32; x++) {
      const level = Number(
        chunk.columns[
          (x + 1 + HALO_WIDTH * (z + 1)) * layout.stride + layout.waterLevel
        ],
      );
      for (let y = -1; y < 40; y++) {
        const block = Number(chunk.haloBlocks[haloIndex(x, y, z)]);
        if (BLOCK_REGISTRY[block]?.solid) continue;
        const worldY = (chunk.cy * 32 + y + 0.5) * chunk.spacing;
        const waterAbove = Math.max(
          0,
          Math.ceil((level - worldY) / chunk.spacing) - 1,
        );
        if (
          block !== Block.Water ||
          !Number.isFinite(waterAbove) ||
          waterAbove * Number(BLOCK_REGISTRY[Block.Water]?.lightFiltering) < 15
        )
          throw new Error(
            "Surface benchmark has no skylight without a fully submerged filtering proof",
          );
        minimum = Math.min(minimum, waterAbove);
      }
    }
  if (!Number.isFinite(minimum))
    throw new Error("Dark benchmark has no open halo samples");
  return {
    state: "dark-submerged",
    reason:
      "Every open halo sample is water below enough additional water voxels to extinguish level-15 sunlight",
    minimumWaterVoxelsAboveOpenHalo: minimum,
  };
}
function counts(blocks: Uint16Array): {
  solidVoxels: number;
  airOrFluidVoxels: number;
  fluidVoxels: number;
  airVoxels: number;
} {
  let solidVoxels = 0;
  let fluidVoxels = 0;
  let airVoxels = 0;
  for (const id of blocks) {
    if (BLOCK_REGISTRY[id]?.solid) solidVoxels++;
    else if (BLOCK_REGISTRY[id] && BLOCK_REGISTRY[id]?.fluidKind !== "none")
      fluidVoxels++;
    else if (id === Block.Air) airVoxels++;
    else throw new Error(`Unexpected open benchmark block ${id}`);
  }
  if (solidVoxels === 0 || solidVoxels === blocks.length)
    throw new Error(
      "Benchmark surface case failed to intersect both solid and air/fluid",
    );
  return {
    solidVoxels,
    airOrFluidVoxels: blocks.length - solidVoxels,
    fluidVoxels,
    airVoxels,
  };
}
/** Exact unique ArrayBuffer byte lengths, never estimates for JS objects or references. */
export function typedBufferBytes(value: unknown): number {
  const seen = new Set<object>(),
    buffers = new Set<ArrayBufferLike>();
  function visit(item: unknown): void {
    if (!item || typeof item !== "object" || seen.has(item)) return;
    seen.add(item);
    if (ArrayBuffer.isView(item)) {
      buffers.add(item.buffer);
      return;
    }
    for (const child of Object.values(item)) visit(child);
  }
  visit(value);
  return [...buffers].reduce((sum, b) => sum + b.byteLength, 0);
}
function featureVoxels(chunk: VoxelChunk): number {
  let count = 0;
  if (chunk.featureIds)
    for (let y = 0; y < 32; y++)
      for (let z = 0; z < 32; z++)
        for (let x = 0; x < 32; x++)
          if (chunk.featureIds[haloIndex(x, y, z)] !== 0) count++;
  return count;
}
function checkContext(sample: BenchmarkCase, context: WorldContext): void {
  if (
    sample.world !== context.kind ||
    sample.seed !== context.seed ||
    sample.spacing !== sample.lod + 1
  )
    throw new Error("Benchmark sample and world context differ");
}
export function measureGeneration(
  sample: BenchmarkCase,
  repetition: number,
  context: WorldContext,
): GenerationMeasurement {
  checkContext(sample, context);
  const start = performance.now();
  const chunk = generateWorldChunk(
    context,
    sample.cx,
    sample.cy,
    sample.cz,
    sample.spacing,
  );
  const generationMs = performance.now() - start;
  return {
    sample,
    repetition,
    generationMs,
    ...counts(chunk.blocks),
    outputBytes: typedBufferBytes(chunk),
    featureVoxels: featureVoxels(chunk),
    featureCache: context.featureCacheStats?.() ?? null,
  };
}
/** Timers wrap the real kernels. Counts/provenance/checks stay outside measured intervals. */
export function measurePipeline(
  sample: BenchmarkCase,
  repetition: number,
  context: WorldContext,
): PipelineMeasurement {
  checkContext(sample, context);
  const start = performance.now();
  const chunk = generateWorldChunk(
    context,
    sample.cx,
    sample.cy,
    sample.cz,
    sample.spacing,
  );
  const generated = performance.now();
  const volume = prepareChunkLighting(sample, context);
  const prepared = performance.now();
  solveLight(volume);
  const lit = performance.now();
  const lights = extractHaloLight(volume);
  const extracted = performance.now();
  const mesh = meshChunk(chunk.haloBlocks, lights, chunk.featureIds);
  const meshed = performance.now();
  const meshBytes = typedBufferBytes(mesh),
    outputBytes = typedBufferBytes(chunk),
    lightingBytes = typedBufferBytes(volume);
  const featureCount = featureVoxels(chunk);
  if (sample.category === "dense-ibara" && featureCount === 0)
    throw new Error("Dense Ibara case generated no feature voxels");
  let litHaloSamples = 0;
  for (const value of lights) if (value >>> 12 > 0) litHaloSamples++;
  if (mesh.quads === 0)
    throw new Error("Surface benchmark produced no visible mesh");
  const skyEvidence = pipelineSkyEvidence(
    chunk,
    context.columns,
    litHaloSamples,
  );
  return {
    sample,
    repetition,
    generationMs: generated - start,
    neighbourhoodPreparationMs: prepared - generated,
    lightingMs: lit - prepared,
    haloExtractionMs: extracted - lit,
    meshingMs: meshed - extracted,
    totalMeasuredStagesMs: meshed - start,
    ...counts(chunk.blocks),
    outputBytes,
    featureVoxels: featureCount,
    featureCache: context.featureCacheStats?.() ?? null,
    typedWorkingSetBytes: {
      generation: outputBytes,
      lightingVolume: lightingBytes,
      haloLight: lights.byteLength,
      mesh: meshBytes,
      total: outputBytes + lightingBytes + lights.byteLength + meshBytes,
    },
    quads: mesh.quads,
    skirtQuads: mesh.skirts.indices.length / 6,
    meshBytes,
    litHaloSamples,
    skyEvidence,
  };
}
