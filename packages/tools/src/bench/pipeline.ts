import { performance } from "node:perf_hooks";
import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import { solveLight } from "../../../shared/src/lighting/flood.js";
import { meshChunk } from "../../../shared/src/meshing/greedy.js";
import { HALO_WIDTH } from "../../../shared/src/world/constants.js";
import { haloIndex } from "../../../shared/src/world/coordinates.js";
import type {
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
    else if (id === Block.Water) fluidVoxels++;
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
    outputBytes:
      chunk.blocks.byteLength +
      chunk.haloBlocks.byteLength +
      chunk.density.byteLength +
      chunk.columns.byteLength,
    quads: mesh.quads,
    skirtQuads: mesh.skirts.indices.length / 6,
    meshBytes,
    litHaloSamples,
    skyEvidence,
  };
}
