import { REGION_IDS } from "../../../shared/src/world/regions.js";
import type {
  RegionWeights,
  SurfaceRegionId,
  WorldContext,
  XZ,
} from "../../../shared/src/world/types.js";
import type { MapFrame, MapRequest } from "../contracts/game-ui.js";
import { insideXZ } from "./destination.js";
export interface MapSamplingReport {
  readonly width: number;
  readonly height: number;
  readonly sampledPixels: number;
  readonly wallMs: number;
  readonly samplingMs: number;
  readonly yieldWaitMs: number;
  readonly yieldCount: number;
  readonly maxSliceMs: number;
  readonly cancelled: boolean;
  readonly names: readonly Readonly<{
    regionId: SurfaceRegionId;
    x: number;
    z: number;
  }>[];
}

const weights = (): RegionWeights => ({
  count: 0,
  ids: new Uint8Array(REGION_IDS.length),
  weights: new Float64Array(REGION_IDS.length),
});
export function regionAt(
  context: WorldContext,
  x: number,
  z: number,
): SurfaceRegionId | null {
  if (!context.regions.length) return null;
  const found = context.surfaceWeights(x, z, weights());
  let best = -Infinity,
    id: SurfaceRegionId | null = null;
  for (let i = 0; i < found.count; i++)
    if ((found.weights[i] as number) > best) {
      best = found.weights[i] as number;
      id =
        context.regions.find((region) => region.index === found.ids[i])?.id ??
        null;
    }
  return id;
}
export function topRegions(
  context: WorldContext,
  x: number,
  z: number,
): { regionId: SurfaceRegionId; weight: number }[] {
  const value = context.surfaceWeights(x, z, weights());
  return (
    Array.from({ length: value.count }, (_, i) => ({
      regionId: context.regions.find((r) => r.index === value.ids[i])?.id,
      weight: value.weights[i] as number,
    }))
      .filter(
        (value): value is { regionId: SurfaceRegionId; weight: number } =>
          value.regionId !== undefined && value.weight > 0,
      )
      // Stable sort preserves shared ids order on exact ties, matching regionAt.
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
  );
}
/** Shared anchors lie in their own territory, including the annular regions.
 * Safe standing/flight height is resolved against exact voxels plus local edits. */
export function regionViewpoints(
  context: WorldContext,
): ReadonlyMap<SurfaceRegionId, XZ> {
  const points = new Map<SurfaceRegionId, XZ>();
  for (const region of context.regions) {
    const point = context.regionAnchor(region.id);
    if (
      !point ||
      !insideXZ(point.x, point.z) ||
      regionAt(context, point.x, point.z) !== region.id
    )
      throw new Error(`No verified viewpoint for ${region.id}`);
    points.set(region.id, { ...point });
  }
  return points;
}
export async function mapFrame(
  context: WorldContext,
  request: MapRequest,
  names: ReadonlyMap<SurfaceRegionId, XZ>,
  current: () => boolean,
  report?: (report: MapSamplingReport) => void,
): Promise<MapFrame | null> {
  let { width, height } = request;
  const requested = { ...request.bounds };
  let bounds = requested;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 4096 ||
    height > 4096 ||
    width * height > 4_194_304 ||
    !Object.values(bounds).every(Number.isFinite) ||
    bounds.maxX <= bounds.minX ||
    bounds.maxZ <= bounds.minZ
  )
    throw new RangeError("Invalid map viewport");
  bounds = {
    minX: Math.max(-22528, requested.minX),
    minZ: Math.max(-22528, requested.minZ),
    maxX: Math.min(22528, requested.maxX),
    maxZ: Math.min(22528, requested.maxZ),
  };
  if (bounds.minX >= bounds.maxX || bounds.minZ >= bounds.maxZ)
    throw new RangeError("Map viewport outside world frame");
  width = Math.max(
    1,
    Math.round(
      (width * (bounds.maxX - bounds.minX)) / (requested.maxX - requested.minX),
    ),
  );
  height = Math.max(
    1,
    Math.round(
      (height * (bounds.maxZ - bounds.minZ)) /
        (requested.maxZ - requested.minZ),
    ),
  );
  const started = performance.now();
  let sliceStart = started,
    samplingMs = 0,
    yieldWaitMs = 0,
    yieldCount = 0,
    sampledPixels = 0,
    maxSliceMs = 0;
  const closeSlice = (): void => {
    const duration = performance.now() - sliceStart;
    samplingMs += duration;
    maxSliceMs = Math.max(maxSliceMs, duration);
  };
  const finish = (cancelled: boolean): void => {
    closeSlice();
    report?.({
      width,
      height,
      sampledPixels,
      wallMs: performance.now() - started,
      samplingMs,
      yieldWaitMs,
      yieldCount,
      maxSliceMs,
      cancelled,
      names: [...names].map(([regionId, point]) => ({ regionId, ...point })),
    });
  };
  const rgba = new Uint8ClampedArray(width * height * 4),
    c = context.createColumn(),
    w = weights();
  const water = { bodyId: 0, kind: "none" as "none" | "water", level: 0 };
  for (let row = 0; row < height; row++) {
    if (!current()) {
      finish(true);
      return null;
    }
    const z =
      bounds.minZ + ((row + 0.5) / height) * (bounds.maxZ - bounds.minZ);
    for (let col = 0; col < width; col++) {
      const x =
          bounds.minX + ((col + 0.5) / width) * (bounds.maxX - bounds.minX),
        i = (col + row * width) * 4;
      if (!insideXZ(x, z)) continue;
      context.sampleColumn(x, z, c);
      context.surfaceWeights(x, z, w);
      context.waterQuery(x, z, water);
      let r = 111,
        g = 130,
        b = 82;
      if (context.regions.length) {
        r = g = b = 0;
        for (let k = 0; k < w.count; k++) {
          const region = context.regions.find(
            (item) => item.index === w.ids[k],
          );
          if (!region) continue;
          r += region.color[0] * (w.weights[k] as number);
          g += region.color[1] * (w.weights[k] as number);
          b += region.color[2] * (w.weights[k] as number);
        }
      }
      if (
        water.kind === "water" &&
        water.level > (c[context.columns.height] as number)
      ) {
        r = 49;
        g = 85;
        b = 108;
      }
      const gx = c[context.columns.gradientX] as number,
        gz = c[context.columns.gradientZ] as number;
      const shade = Math.max(
        0.55,
        Math.min(1.16, 0.86 + (-gx * 0.35 - gz * 0.45) / Math.hypot(gx, 1, gz)),
      );
      rgba[i] = r * shade;
      rgba[i + 1] = g * shade;
      rgba[i + 2] = b * shade;
      rgba[i + 3] = 255;
      sampledPixels++;
    }
    // Yield between small strips so a superseding viewport/session can cancel.
    if (row % 4 === 3) {
      closeSlice();
      const yielded = performance.now();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      yieldWaitMs += performance.now() - yielded;
      yieldCount++;
      sliceStart = performance.now();
    }
  }
  const valid = current();
  finish(!valid);
  return valid
    ? {
        ...request,
        width,
        height,
        bounds: { ...bounds },
        rgba,
        names: [...names].map(([regionId, point]) => ({ regionId, ...point })),
      }
    : null;
}
