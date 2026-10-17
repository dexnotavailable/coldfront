import { BLOCK_REGISTRY, Block } from "../../blocks/registry.js";
import {
  WORLD_MAX_XZ,
  WORLD_MAX_Y,
  WORLD_MIN_XZ,
  WORLD_MIN_Y,
} from "../../world/constants.js";
import type { FarRun } from "./types.js";

export interface FarVoxelEdit {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly block: number;
}
export interface FarEditSlab {
  readonly bottom: number;
  readonly top: number;
  readonly block: number;
}
/** Snapshot index. Latest edit at a voxel wins before footprint counts are computed. */
export class FarEditIndex {
  private readonly edits = new Map<string, FarVoxelEdit>();
  private readonly levels = new Map<
    number,
    Map<string, readonly FarEditSlab[]>
  >();
  constructor(edits: Iterable<FarVoxelEdit> = []) {
    for (const edit of edits) {
      if (
        ![edit.x, edit.y, edit.z].every(Number.isInteger) ||
        !BLOCK_REGISTRY[edit.block] ||
        edit.x < WORLD_MIN_XZ ||
        edit.x >= WORLD_MAX_XZ ||
        edit.z < WORLD_MIN_XZ ||
        edit.z >= WORLD_MAX_XZ ||
        edit.y < WORLD_MIN_Y ||
        edit.y >= WORLD_MAX_Y
      )
        throw new RangeError("Invalid far edit");
      this.edits.set(`${edit.x},${edit.y},${edit.z}`, { ...edit });
    }
  }
  column(x: number, z: number, spacing: number): readonly FarEditSlab[] {
    if (
      ![4, 8, 16, 32, 64].includes(spacing) ||
      !Number.isFinite(x) ||
      !Number.isFinite(z)
    )
      throw new RangeError("Invalid far edit footprint");
    let level = this.levels.get(spacing);
    if (!level) {
      const buckets = new Map<string, Map<number, Map<number, number>>>();
      for (const edit of this.edits.values()) {
        const key = `${Math.floor(edit.x / spacing)},${Math.floor(edit.z / spacing)}`;
        let ys = buckets.get(key);
        if (!ys) {
          ys = new Map();
          buckets.set(key, ys);
        }
        let counts = ys.get(edit.y);
        if (!counts) {
          counts = new Map();
          ys.set(edit.y, counts);
        }
        counts.set(edit.block, (counts.get(edit.block) ?? 0) + 1);
      }
      level = new Map();
      for (const [key, ys] of buckets) {
        const slabs: FarEditSlab[] = [];
        for (const [y, counts] of ys) {
          let chosen = Block.Air as number,
            best = 0;
          for (const [block, count] of counts)
            if (
              BLOCK_REGISTRY[block]?.solid &&
              (count > best || (count === best && block < chosen))
            ) {
              chosen = block;
              best = count;
            }
          if (best || counts.get(Block.Air) === spacing * spacing)
            slabs.push({ bottom: y, top: y + 1, block: chosen });
        }
        slabs.sort((a, b) => a.bottom - b.bottom);
        level.set(key, slabs);
      }
      this.levels.set(spacing, level);
    }
    return (
      level.get(`${Math.floor(x / spacing)},${Math.floor(z / spacing)}`) ?? []
    );
  }
}
export function farLight(block: number): number {
  const rgb = BLOCK_REGISTRY[block]?.emission ?? [0, 0, 0];
  return 0xf000 | ((rgb[0] ?? 0) << 8) | ((rgb[1] ?? 0) << 4) | (rgb[2] ?? 0);
}
/** Replace a height interval, preserving both surviving pieces and exact edit planes. */
export function replaceFarInterval(
  runs: readonly FarRun[],
  slab: FarEditSlab,
): FarRun[] {
  const result: FarRun[] = [];
  for (const run of runs) {
    if (run.top <= slab.bottom || run.bottom >= slab.top) {
      result.push(run);
      continue;
    }
    if (run.bottom < slab.bottom) result.push({ ...run, top: slab.bottom });
    if (run.top > slab.top) result.push({ ...run, bottom: slab.top });
  }
  if (slab.block !== Block.Air)
    result.push({
      ...slab,
      light: farLight(slab.block),
      featureId: 0,
      flags: 0,
    });
  result.sort(
    (a, b) => a.bottom - b.bottom || a.top - b.top || a.block - b.block,
  );
  return result;
}
