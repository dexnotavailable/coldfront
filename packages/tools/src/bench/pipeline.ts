import { performance } from "node:perf_hooks";
import { BLOCK_REGISTRY } from "../../../shared/src/blocks/registry.js";
import { solveLight } from "../../../shared/src/lighting/flood.js";
import { meshChunk } from "../../../shared/src/meshing/greedy.js";
import { generateTestChunk } from "../../../shared/src/worldgen/chunk.js";
import { extractHaloLight, prepareChunkLighting } from "./lighting-input.js";
import type { BenchmarkCase } from "./samples.js";

export interface GenerationMeasurement {
  readonly sample: BenchmarkCase;
  readonly repetition: number;
  readonly generationMs: number;
  readonly solidVoxels: number;
  readonly airOrFluidVoxels: number;
  readonly outputBytes: number;
}
export interface PipelineMeasurement extends GenerationMeasurement {
  readonly neighbourhoodPreparationMs: number;
  readonly lightingMs: number;
  readonly haloExtractionMs: number;
  readonly meshingMs: number;
  readonly totalMeasuredStagesMs: number;
  readonly quads: number;
  readonly skirtQuads: number;
  readonly meshBytes: number;
  readonly litHaloSamples: number;
}
function counts(blocks: Uint16Array): {
  solidVoxels: number;
  airOrFluidVoxels: number;
} {
  let solidVoxels = 0;
  for (const id of blocks) if (BLOCK_REGISTRY[id]?.solid) solidVoxels++;
  if (solidVoxels === 0 || solidVoxels === blocks.length)
    throw new Error(
      "Benchmark surface case failed to intersect both solid and air/fluid",
    );
  return { solidVoxels, airOrFluidVoxels: blocks.length - solidVoxels };
}
export function measureGeneration(
  sample: BenchmarkCase,
  repetition: number,
): GenerationMeasurement {
  const start = performance.now();
  const chunk = generateTestChunk(sample);
  const generationMs = performance.now() - start;
  return {
    sample,
    repetition,
    generationMs,
    ...counts(chunk.blocks),
    outputBytes:
      chunk.blocks.byteLength +
      chunk.haloBlocks.byteLength +
      chunk.density.byteLength +
      chunk.columns.byteLength,
  };
}
/** Timers wrap the real kernels. Counts/provenance/checks stay outside measured intervals. */
export function measurePipeline(
  sample: BenchmarkCase,
  repetition: number,
): PipelineMeasurement {
  const start = performance.now();
  const chunk = generateTestChunk(sample);
  const generated = performance.now();
  const volume = prepareChunkLighting(sample);
  const prepared = performance.now();
  solveLight(volume);
  const lit = performance.now();
  const lights = extractHaloLight(volume);
  const extracted = performance.now();
  const mesh = meshChunk(chunk.haloBlocks, lights);
  const meshed = performance.now();
  let meshBytes = 0;
  for (const part of [...mesh.parts, mesh.skirts])
    meshBytes +=
      part.positions.byteLength +
      part.normals.byteLength +
      part.expansions.byteLength +
      part.packedPositions.byteLength +
      part.surfaces.byteLength +
      part.indices.byteLength;
  let litHaloSamples = 0;
  for (const value of lights) if (value >>> 12 > 0) litHaloSamples++;
  if (mesh.quads === 0 || litHaloSamples === 0)
    throw new Error("Surface benchmark produced no visible mesh or skylight");
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
    outputBytes:
      chunk.blocks.byteLength +
      chunk.haloBlocks.byteLength +
      chunk.density.byteLength +
      chunk.columns.byteLength,
    quads: mesh.quads,
    skirtQuads: mesh.skirts.indices.length / 6,
    meshBytes,
    litHaloSamples,
  };
}
