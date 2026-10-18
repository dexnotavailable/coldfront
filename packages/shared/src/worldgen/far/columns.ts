import { BLOCK_REGISTRY, Block } from "../../blocks/registry.js";
import {
  WORLD_MAX_XZ,
  WORLD_MAX_Y,
  WORLD_MIN_XZ,
  WORLD_MIN_Y,
} from "../../world/constants.js";
import { sampleCenter } from "../../world/coordinates.js";
import type { VoxelSample, WorldContext } from "../../world/types.js";
import {
  decodeFarY,
  FAR_COLUMN_COUNT,
  farColumnIndex,
  farSpacing,
  quantizeFarY,
} from "./coordinates.js";
import { FarEditIndex, farLight, replaceFarInterval } from "./edits.js";
import {
  DEFAULT_FAR_LIMITS,
  type FarAreaSampler,
  FarCapacityError,
  type FarLimits,
  type FarRun,
  type FarStatistics,
  type FarTileRequest,
  type FarTileRuns,
} from "./types.js";

export function resolveFarLimits(limits: Partial<FarLimits> = {}): FarLimits {
  const result = { ...DEFAULT_FAR_LIMITS, ...limits };
  for (const value of Object.values(result))
    if (!Number.isSafeInteger(value) || value < 1)
      throw new RangeError("Far capacities must be positive safe integers");
  return result;
}
export function readFarRun(tile: FarTileRuns, index: number): FarRun {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index * 4 + 3 >= tile.words.length
  )
    throw new RangeError("Invalid far run index");
  const word = Number(tile.words[4 * index]),
    surface = Number(tile.words[4 * index + 1]);
  return {
    bottom: decodeFarY(word & 0xffff),
    top: decodeFarY(word >>> 16),
    block: surface & 0xffff,
    light: surface >>> 16,
    featureId: Number(tile.words[4 * index + 2]),
    flags: Number(tile.words[4 * index + 3]),
  };
}
/** Density crossings use binary64 until the final 1/16m run encoding. */
export function farZeroCrossing(
  y0: number,
  d0: number,
  y1: number,
  d1: number,
): number {
  if (!Number.isFinite(d0) || !Number.isFinite(d1))
    throw new RangeError("Nonfinite interior density crossing");
  if (d0 === d1) throw new RangeError("Unbracketed density crossing");
  return y0 + ((y1 - y0) * d0) / (d0 - d1);
}
/** Add an owned interval only where the previously assembled volume is empty. */
function unoccupiedIntervals(
  bottom: number,
  top: number,
  occupied: readonly FarRun[],
): [number, number][] {
  let pieces: [number, number][] = top > bottom ? [[bottom, top]] : [];
  for (const run of occupied) {
    const next: [number, number][] = [];
    for (const [low, high] of pieces) {
      if (run.top <= low || run.bottom >= high) next.push([low, high]);
      else {
        if (low < run.bottom) next.push([low, run.bottom]);
        if (run.top < high) next.push([run.top, high]);
      }
    }
    pieces = next;
  }
  return pieces;
}
export function generateFarTile(
  context: WorldContext,
  request: FarTileRequest,
  edits = new FarEditIndex(),
  limits: Partial<FarLimits> = {},
): FarTileRuns {
  const s = farSpacing(request.address);
  if (!context.prepareFarArea)
    throw new Error("World context has no far sampling adapter");
  const { tx, tz } = request.address;
  // Include complete halo footprints: canopy summaries may see an off-centre
  // tree beyond a halo centre. Adjacent tiles must collect the same contributors.
  const area = context.prepareFarArea(
    {
      minX: sampleCenter(tx, -1, s) - s / 2,
      maxX: sampleCenter(tx, 32, s) + s / 2,
      minZ: sampleCenter(tz, -1, s) - s / 2,
      maxZ: sampleCenter(tz, 32, s) + s / 2,
    },
    { spacing: s, layer: request.layer },
  );
  return generateFarTileFromArea(area, request, edits, limits);
}
/** Public pure kernel also accepts synthetic volume samplers for topology tests. */
export function generateFarTileFromArea(
  area: FarAreaSampler,
  request: FarTileRequest,
  edits = new FarEditIndex(),
  limits: Partial<FarLimits> = {},
): FarTileRuns {
  const cap = resolveFarLimits(limits),
    s = farSpacing(request.address);
  if (!Number.isSafeInteger(request.revision) || request.revision < 0)
    throw new RangeError("Invalid far revision");
  const statistics: FarStatistics = {
    densityCalls: 0,
    columns: 0,
    runs: 0,
    quads: 0,
    skirtQuads: 0,
    typedArrayBytes: 0,
  };
  const offsets = new Uint32Array(FAR_COLUMN_COUNT + 1);
  // A single reusable vertical scratch column; never a full 3D tile volume.
  const count = (WORLD_MAX_Y - WORLD_MIN_Y) / s;
  const density = new Float64Array(count),
    blocks = new Uint16Array(count),
    features = new Uint32Array(count);
  const words = new Uint32Array(cap.runs * 4);
  const column = area.createColumn();
  const voxel: VoxelSample = { density: 0, block: Block.Air, fluid: Block.Air };
  const sample = (x: number, y: number, z: number): VoxelSample => {
    if (++statistics.densityCalls > cap.densityCalls)
      throw new FarCapacityError("densityCalls", cap.densityCalls, {
        ...statistics,
      });
    area.sampleVoxel(x, y, z, voxel, column);
    if (!Number.isFinite(voxel.density))
      throw new RangeError("Nonfinite density inside canonical far column");
    if (
      !BLOCK_REGISTRY[voxel.block] ||
      (voxel.density > 0 &&
        (voxel.block === Block.Air ||
          BLOCK_REGISTRY[voxel.block]?.renderType === "fluid"))
    )
      throw new RangeError("Far sample has inconsistent solid occupancy");
    return voxel;
  };
  for (let z = -1; z <= 32; z++)
    for (let x = -1; x <= 32; x++) {
      const ci = farColumnIndex(x, z);
      offsets[ci] = statistics.runs;
      const wx = sampleCenter(request.address.tx, x, s),
        wz = sampleCenter(request.address.tz, z, s);
      statistics.columns++;
      if (
        wx < WORLD_MIN_XZ ||
        wx >= WORLD_MAX_XZ ||
        wz < WORLD_MIN_XZ ||
        wz >= WORLD_MAX_XZ
      )
        continue;
      area.sampleColumn(wx, wz, column);
      const first = column.certifiedBase
        ? Math.max(0, Math.floor((column.minY - WORLD_MIN_Y) / s) - 1)
        : 0;
      const last = Math.min(
        count - 1,
        Math.ceil((column.maxY - WORLD_MIN_Y) / s) + 1,
      );
      if (![column.minY, column.maxY].every(Number.isFinite) || first > last)
        throw new RangeError("Invalid far sampling band");
      for (let i = first; i <= last; i++) {
        sample(wx, WORLD_MIN_Y + (i + 0.5) * s, wz);
        density[i] = voxel.density;
        blocks[i] =
          voxel.density > 0 &&
          BLOCK_REGISTRY[voxel.block]?.renderType !== "fluid"
            ? voxel.block
            : Block.Air;
        features[i] = voxel.featureId ?? 0;
      }
      if (last < count - 1 && Number(blocks[last]) !== Block.Air)
        throw new Error("Far upper band missed occupied terrain");
      let runs: FarRun[] = [
        ...area.baseRuns(wx, wz, WORLD_MIN_Y + first * s, column),
      ];
      for (let i = first; i <= last; i++) {
        const block = Number(blocks[i]);
        if (block === Block.Air) continue;
        const y = WORLD_MIN_Y + (i + 0.5) * s,
          d = Number(density[i]);
        const bottom =
          i === first
            ? WORLD_MIN_Y + first * s
            : Number(blocks[i - 1]) !== Block.Air
              ? y - s / 2
              : farZeroCrossing(y - s, Number(density[i - 1]), y, d);
        const top =
          i === last
            ? WORLD_MAX_Y
            : Number(blocks[i + 1]) !== Block.Air
              ? y + s / 2
              : farZeroCrossing(y, d, y + s, Number(density[i + 1]));
        const run = {
          bottom,
          top,
          block,
          light: farLight(block),
          featureId: Number(features[i]),
          flags: 0,
        };
        const skin = Math.min(1 / 16, (top - bottom) / 2);
        // Retain the source's actual surface material (snow/soil/thorn tips),
        // rather than colouring a coarse cap from a sample many metres below it.
        // This is a material-only 1/16m subdivision; crossing geometry is unchanged.
        if (i > first && Number(blocks[i - 1]) === Block.Air && skin > 0) {
          sample(wx, bottom + skin / 2, wz);
          if (
            voxel.density > 0 &&
            (voxel.block !== block || (voxel.featureId ?? 0) !== run.featureId)
          ) {
            runs.push({
              ...run,
              top: bottom + skin,
              block: voxel.block,
              light: farLight(voxel.block),
              featureId: voxel.featureId ?? 0,
            });
            run.bottom += skin;
          }
        }
        let topSkin: FarRun | undefined;
        if (i < last && Number(blocks[i + 1]) === Block.Air && skin > 0) {
          sample(wx, top - skin / 2, wz);
          if (
            voxel.density > 0 &&
            (voxel.block !== block || (voxel.featureId ?? 0) !== run.featureId)
          ) {
            topSkin = {
              ...run,
              bottom: top - skin,
              block: voxel.block,
              light: farLight(voxel.block),
              featureId: voxel.featureId ?? 0,
            };
            run.top -= skin;
          }
        }
        if (run.top > run.bottom) runs.push(run);
        if (topSkin) runs.push(topSkin);
      }
      // The actual-tree summary has a known analytic interval. Inserting it
      // directly retains thin canopies between vertical centres and avoids
      // interpolating a leaf sample against unrelated negative ground density.
      // Existing volumetric features keep their materials and feature identity.
      const canopyBottom = Number(column.terrainValues[area.columns.height]);
      if (Number.isFinite(column.canopyTop) && column.canopyTop > canopyBottom)
        for (const [bottom, top] of unoccupiedIntervals(
          canopyBottom,
          column.canopyTop,
          runs,
        ))
          runs.push({
            bottom,
            top,
            block: Block.Leaves,
            light: farLight(Block.Leaves),
            featureId: 0,
            flags: 0,
          });
      // Owned fluid levels stay flat. Solid geometry, including overhangs, wins.
      for (const fluid of column.fluids) {
        for (const [bottom, top] of unoccupiedIntervals(
          fluid.bottom,
          fluid.top,
          runs,
        ))
          runs.push({
            bottom,
            top,
            block: fluid.block,
            light: farLight(fluid.block),
            featureId: 0,
            flags: 0,
          });
      }
      for (const slab of edits.column(wx, wz, s))
        runs = replaceFarInterval(runs, slab);
      runs.sort(
        (a, b) => a.bottom - b.bottom || a.top - b.top || a.block - b.block,
      );
      for (const run of runs) {
        const bottom = quantizeFarY(run.bottom),
          top = quantizeFarY(run.top);
        if (top <= bottom) continue;
        const n = statistics.runs,
          previous = (n - 1) * 4;
        if (
          n > Number(offsets[ci]) &&
          Number(words[previous]) >>> 16 === bottom &&
          Number(words[previous + 1]) ===
            (run.block | (run.light << 16)) >>> 0 &&
          Number(words[previous + 2]) === run.featureId &&
          Number(words[previous + 3]) === run.flags
        ) {
          words[previous] = (Number(words[previous]) & 0xffff) | (top << 16);
          continue;
        }
        if (n >= cap.runs)
          throw new FarCapacityError("runs", cap.runs, { ...statistics });
        words[n * 4] = bottom | (top << 16);
        words[n * 4 + 1] = run.block | (run.light << 16);
        words[n * 4 + 2] = run.featureId;
        words[n * 4 + 3] = run.flags;
        statistics.runs++;
      }
    }
  offsets[FAR_COLUMN_COUNT] = statistics.runs;
  const packed = words.slice(0, statistics.runs * 4);
  statistics.typedArrayBytes = offsets.byteLength + packed.byteLength;
  return {
    ...request,
    offsets,
    words: packed,
    statistics: Object.freeze({ ...statistics }),
  };
}
