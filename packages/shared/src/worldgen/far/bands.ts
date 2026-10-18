import type { Aabb } from "../../sdf/types.js";
import {
  WORLD_MAX_XZ,
  WORLD_MAX_Y,
  WORLD_MIN_XZ,
  WORLD_MIN_Y,
  WORLDSTONE_CEILING,
} from "../../world/constants.js";
import type {
  VoxelSample,
  WorldAreaSampler,
  WorldBounds,
  XZBounds,
} from "../../world/types.js";
import type { TreeFeature } from "../test-world.js";
import { farLight } from "./edits.js";
import type {
  FarAreaSampler,
  FarColumnSample,
  FarFluidInterval,
  FarPreparationOptions,
  FarRun,
} from "./types.js";

export interface FarAreaSources {
  readonly area: Pick<
    WorldAreaSampler,
    "columns" | "createColumn" | "sampleColumn"
  >;
  readonly options: FarPreparationOptions;
  readonly featureBounds: readonly Readonly<Aabb>[];
  readonly trees: readonly TreeFeature[];
  readonly terrainHeightIndices: readonly number[];
  readonly displacement: number;
  /** Source proof, not a sampling inference. Disable when underground carvers arrive. */
  readonly solidBase: boolean;
  surfaceBounds(bounds: XZBounds, out: WorldBounds): WorldBounds;
  materialAt(y: number, column: FarColumnSample): number;
  sample(
    x: number,
    y: number,
    z: number,
    out: VoxelSample,
    column: FarColumnSample,
  ): VoxelSample;
  fluids(
    x: number,
    z: number,
    column: FarColumnSample,
    out: FarFluidInterval[],
  ): void;
}
function intersects(a: XZBounds, b: XZBounds): boolean {
  return (
    a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ
  );
}
/** Representation adapter over the existing world functions; no independent terrain recipe. */
export function createFarArea(sources: FarAreaSources): FarAreaSampler {
  const { area, options } = sources;
  if (options.layer !== "surface")
    throw new RangeError(
      "This world has no generated underground far layer yet",
    );
  const s = options.spacing;
  if (![4, 8, 16, 32, 64].includes(s))
    throw new RangeError("Unsupported far spacing");
  const scratch = area.createColumn();
  const bounds: WorldBounds = {
    minSurfaceY: 0,
    maxSurfaceY: 0,
    maxSolidY: 0,
    maxFluidY: -Infinity,
  };
  return {
    columns: area.columns,
    featureBounds: sources.featureBounds,
    createColumn: () => ({
      values: area.createColumn(),
      terrainValues: area.createColumn(),
      heightDelta: 0,
      canopyTop: -Infinity,
      minY: WORLD_MIN_Y,
      maxY: WORLD_MAX_Y,
      certifiedBase: false,
      fluids: [],
    }),
    sampleColumn(x, z, out) {
      area.sampleColumn(x, z, out.values);
      out.terrainValues.set(out.values);
      out.heightDelta = 0;
      out.canopyTop = -Infinity;
      out.fluids.length = 0;
      out.certifiedBase = false;
      out.minY = WORLD_MIN_Y;
      out.maxY = WORLD_MAX_Y;
      if (
        x < WORLD_MIN_XZ ||
        x >= WORLD_MAX_XZ ||
        z < WORLD_MIN_XZ ||
        z >= WORLD_MAX_XZ
      )
        return out;
      if (s >= 8) {
        let peak = -Infinity;
        for (const dz of [-0.25, 0.25])
          for (const dx of [-0.25, 0.25]) {
            area.sampleColumn(x + dx * s, z + dz * s, scratch);
            peak = Math.max(peak, Number(scratch[area.columns.height]));
          }
        out.heightDelta = peak - Number(out.values[area.columns.height]);
        for (const index of sources.terrainHeightIndices)
          out.terrainValues[index] =
            Number(out.terrainValues[index]) + out.heightDelta;
        // The canopy summarizes only actual source trees intersecting this cell.
        // No trunks or crown SDFs are instanced at these levels.
        for (const tree of sources.trees) {
          const dx = Math.max(0, Math.abs(tree.x - x) - s / 2);
          const dz = Math.max(0, Math.abs(tree.z - z) - s / 2);
          if (dx * dx + dz * dz <= tree.crownRadius * tree.crownRadius)
            out.canopyTop = Math.max(
              out.canopyTop,
              tree.crownY + tree.crownHeight,
            );
        }
      }
      const footprint = {
        minX: x - s / 2,
        maxX: x + s / 2,
        minZ: z - s / 2,
        maxZ: z + s / 2,
      };
      sources.surfaceBounds(footprint, bounds);
      let low = bounds.minSurfaceY - Math.max(2 * s, sources.displacement + 16);
      let high = Math.max(
        bounds.maxSurfaceY + Math.max(2 * s, sources.displacement + 8),
        bounds.maxFluidY,
        out.canopyTop,
      );
      for (const feature of sources.featureBounds)
        if (intersects(footprint, feature)) {
          low = Math.min(low, feature.minY - s);
          high = Math.max(high, feature.maxY + s);
        }
      out.certifiedBase = sources.solidBase;
      out.minY = sources.solidBase ? Math.max(WORLD_MIN_Y, low) : WORLD_MIN_Y;
      // Feature bounds and source surface bounds certify air above this band.
      out.maxY = Math.min(WORLD_MAX_Y, high);
      sources.fluids(x, z, out, out.fluids);
      for (const fluid of out.fluids)
        out.maxY = Math.max(out.maxY, Math.min(WORLD_MAX_Y, fluid.top));
      return out;
    },
    sampleVoxel(x, y, z, out, column) {
      // Canopy is an explicit interval in the run assembler. Its known crown
      // boundary must survive even when no vertical centre samples its interior.
      // Keep this signed field entirely owned by ground and volumetric features.
      return sources.sample(x, y, z, out, column);
    },
    baseRuns(_x, _z, top, column) {
      if (!column.certifiedBase || top <= WORLD_MIN_Y) return [];
      const result: FarRun[] = [];
      let bottom = WORLD_MIN_Y;
      // Material ownership follows the same centre samples as an exhaustive
      // column. A certified skip must not move a material boundary at coarse LOD.
      for (const boundary of [
        Math.ceil(WORLDSTONE_CEILING / s - 0.5) * s,
        Math.ceil(-48 / s - 0.5) * s,
        top,
      ]) {
        const end = Math.min(top, boundary);
        if (end > bottom) {
          const block = sources.materialAt(bottom + s / 2, column);
          result.push({
            bottom,
            top: end,
            block,
            light: farLight(block),
            featureId: 0,
            flags: 0,
          });
          bottom = end;
        }
        if (bottom >= top) break;
      }
      return result;
    },
  };
}
