import { BLOCK_REGISTRY } from "../../../shared/src/blocks/registry.js";
import {
  WORLD_MAX_XZ,
  WORLD_MIN_XZ,
} from "../../../shared/src/world/constants.js";
import { REGION_IDS } from "../../../shared/src/world/regions.js";
import type {
  SurfaceRegionId,
  WorldContext,
  WorldKind,
} from "../../../shared/src/world/types.js";
import { createWorldContext } from "../../../shared/src/world/world-context.js";
import {
  buildWorldPlan,
  createRegionWeights,
} from "../../../shared/src/worldplan/index.js";

export type WorldResolver = (world: WorldKind, seed: number) => WorldContext;

/** Run-owned cache: at most one plan per requested seed, no global retained state. */
export function createWorldResolver(): WorldResolver {
  const contexts = new Map<string, WorldContext>();
  return (world, seed) => {
    const key = `${world}:${seed}`;
    let context = contexts.get(key);
    if (!context) {
      context = createWorldContext(
        world === "main"
          ? { kind: world, seed, plan: buildWorldPlan(seed) }
          : { kind: world, seed },
      );
      contexts.set(key, context);
    }
    return context;
  };
}

export interface SurfaceAddress {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
}

/**
 * Fixed, spatially spread candidate lattice, filtered by actual dominant region.
 * The centre column must contain both solid and open/fluid core samples. This
 * avoids all-air/all-solid chunks when a flat surface lies on a chunk boundary.
 * Each candidate prepares its feature area once, never once per voxel.
 */
export function regionSurfaceAddresses(
  context: WorldContext,
  region: SurfaceRegionId,
  lod: 0 | 1,
  count: number,
): SurfaceAddress[] {
  if (context.kind !== "main" || !Number.isInteger(count) || count < 1)
    throw new Error(
      "Regional samples require a main context and positive count",
    );
  const spacing = lod === 0 ? 1 : 2;
  const width = 32 * spacing;
  const weights = createRegionWeights();
  const column = context.createColumn();
  const voxel = { density: 0, block: 0, fluid: 0 };
  const addresses: SurfaceAddress[] = [];
  const seen = new Set<string>();
  const anchor = context.regionAnchor(region);
  if (!anchor) throw new Error(`Missing main region anchor: ${region}`);
  const gridWidth = (WORLD_MAX_XZ - WORLD_MIN_XZ) / 512;
  const gridCount = gridWidth * gridWidth;
  // 2053 is coprime to 88², so every lattice cell is visited exactly once.
  for (let i = -1; i < gridCount && addresses.length < count; i++) {
    const cell = (i * 2053 + 1237 + gridCount) % gridCount;
    const px = i < 0 ? anchor.x : WORLD_MIN_XZ + (cell % gridWidth) * 512 + 256;
    const pz =
      i < 0
        ? anchor.z
        : WORLD_MIN_XZ + Math.floor(cell / gridWidth) * 512 + 256;
    const cx = Math.floor(px / width);
    const cz = Math.floor(pz / width);
    const key = `${cx},${cz}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const x = (cx * 32 + 16.5) * spacing;
    const z = (cz * 32 + 16.5) * spacing;
    context.surfaceWeights(x, z, weights);
    if (REGION_IDS[Number(weights.ids[0])] !== region) continue;
    context.sampleColumn(x, z, column);
    const height = Number(column[context.columns.height]);
    const cy = Math.floor(height / width);
    const area = context.prepareArea({ minX: x, minZ: z, maxX: x, maxZ: z });
    const bottom = area.sampleVoxel(
      x,
      (cy * 32 + 0.5) * spacing,
      z,
      voxel,
      column,
    ).block;
    const top = area.sampleVoxel(
      x,
      (cy * 32 + 31.5) * spacing,
      z,
      voxel,
      column,
    ).block;
    if (!BLOCK_REGISTRY[bottom]?.solid || BLOCK_REGISTRY[top]?.solid) continue;
    addresses.push({ cx, cy, cz });
  }
  if (addresses.length !== count)
    throw new Error(
      `Only ${addresses.length}/${count} meaningful ${region} LOD${lod} samples`,
    );
  return addresses;
}
