import type { Raster } from "../terrain-review/output.js";
import {
  createSurfaceSample,
  type TerrainReviewSource,
} from "../terrain-review/source.js";

export interface AtlasBounds {
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
}
export interface AtlasRequest {
  readonly width: number;
  readonly height: number;
  readonly bounds: AtlasBounds;
  readonly heightMin: number;
  readonly heightMax: number;
  readonly relief: number;
}
export const HEIGHT_RAMP = [
  { t: 0, rgb: [67, 100, 63] },
  { t: 0.25, rgb: [95, 133, 76] },
  { t: 0.5, rgb: [145, 164, 99] },
  { t: 0.75, rgb: [186, 181, 132] },
  { t: 1, rgb: [221, 213, 176] },
] as const;
export interface AtlasMetadata {
  readonly world: string;
  readonly seed: number;
  readonly worldgenVersion: number;
  readonly layer: "surface";
  readonly mode: "height";
  readonly bounds: AtlasBounds;
  readonly metresPerPixel: Readonly<{ x: number; z: number }>;
  readonly orientation: "north (-z) at top; east (+x) at right";
  readonly sampleConvention: "pixel centres; half-open bounds; terrain height excludes canopy";
  readonly shading: Readonly<{
    verticalExaggeration: number;
    lightDirection: readonly number[];
    ambient: number;
  }>;
  readonly heightRamp: readonly Readonly<{
    height: number;
    rgb: readonly number[];
  }>[];
  readonly statistics: Readonly<{
    minHeight: number;
    maxHeight: number;
    meanHeight: number;
    waterPixels: number;
    waterShare: number;
    dryBelowDatumPixels: number;
    rampClippedLow: number;
    rampClippedHigh: number;
  }>;
}
function positiveInt(v: number, name: string): void {
  if (!Number.isInteger(v) || v < 1 || v > 8192)
    throw new RangeError(`${name} must be an integer from 1 to 8192`);
}
export function validateAtlas(
  request: AtlasRequest,
  source: TerrainReviewSource,
): void {
  positiveInt(request.width, "Width");
  positiveInt(request.height, "Height");
  if (request.width * request.height > 16_777_216)
    throw new RangeError(
      "Atlas exceeds the 16-million-pixel limit; split the bounds",
    );
  const b = request.bounds;
  if (
    ![
      b.minX,
      b.minZ,
      b.maxX,
      b.maxZ,
      request.heightMin,
      request.heightMax,
      request.relief,
    ].every(Number.isFinite)
  )
    throw new RangeError("Atlas parameters must be finite");
  if (
    b.minX >= b.maxX ||
    b.minZ >= b.maxZ ||
    b.minX < source.bounds.minXZ ||
    b.minZ < source.bounds.minXZ ||
    b.maxX > source.bounds.maxXZ ||
    b.maxZ > source.bounds.maxXZ
  )
    throw new RangeError(
      "Atlas bounds must be ordered and inside the world frame",
    );
  const dx = (b.maxX - b.minX) / request.width,
    dz = (b.maxZ - b.minZ) / request.height;
  if (Math.abs(dx - dz) > 1e-9 * Math.max(dx, dz))
    throw new RangeError(
      "Atlas pixels must cover equal metres in X and Z; match --size WxH to the bounds",
    );
  if (request.heightMin >= request.heightMax)
    throw new RangeError("Height-ramp minimum must be below its maximum");
  if (request.relief < 0 || request.relief > 64)
    throw new RangeError("Hillshade relief must be from 0 to 64");
}
function landColor(
  height: number,
  minimum: number,
  maximum: number,
  out: number[],
): void {
  const t = Math.max(0, Math.min(1, (height - minimum) / (maximum - minimum)));
  let index = 0;
  while (
    index < HEIGHT_RAMP.length - 2 &&
    t > Number(HEIGHT_RAMP[index + 1]?.t)
  )
    index++;
  const a = HEIGHT_RAMP[index],
    b = HEIGHT_RAMP[index + 1];
  if (!a || !b) throw new Error("Invalid height ramp");
  const f = (t - a.t) / (b.t - a.t);
  for (let channel = 0; channel < 3; channel++)
    out[channel] =
      Number(a.rgb[channel]) +
      (Number(b.rgb[channel]) - Number(a.rgb[channel])) * f;
}
/** Rasterizes the source through its surface interface, without touching chunks or a renderer. */
export function renderAtlas(
  request: AtlasRequest,
  source: TerrainReviewSource,
): Raster<AtlasMetadata> {
  validateAtlas(request, source);
  const { width, height, bounds } = request,
    dx = (bounds.maxX - bounds.minX) / width,
    dz = (bounds.maxZ - bounds.minZ) / height;
  const rgba = new Uint8Array(width * height * 4),
    sample = createSurfaceSample(),
    color = [0, 0, 0];
  const light = [-0.5, Math.SQRT1_2, -0.5] as const;
  let minHeight = Infinity,
    maxHeight = -Infinity,
    sum = 0,
    waterPixels = 0,
    dryBelowDatumPixels = 0,
    rampClippedLow = 0,
    rampClippedHigh = 0;
  for (let row = 0; row < height; row++) {
    const z = bounds.minZ + (row + 0.5) * dz;
    for (let col = 0; col < width; col++) {
      const x = bounds.minX + (col + 0.5) * dx;
      source.writeSurface(x, z, sample);
      if (
        !Number.isFinite(sample.height) ||
        !Number.isFinite(sample.dx) ||
        !Number.isFinite(sample.dz) ||
        (sample.waterLevel !== null && !Number.isFinite(sample.waterLevel))
      )
        throw new Error("Source returned an invalid surface sample");
      minHeight = Math.min(minHeight, sample.height);
      maxHeight = Math.max(maxHeight, sample.height);
      sum += sample.height;
      if (sample.height < request.heightMin) rampClippedLow++;
      if (sample.height > request.heightMax) rampClippedHigh++;
      let shade: number;
      if (sample.waterLevel !== null && sample.height < sample.waterLevel) {
        waterPixels++;
        const depth = Math.min(1, (sample.waterLevel - sample.height) / 6);
        color[0] = 100 - depth * 55;
        color[1] = 158 - depth * 65;
        color[2] = 179 - depth * 50;
        shade = 1;
      } else {
        if (sample.height < 0) dryBelowDatumPixels++;
        landColor(sample.height, request.heightMin, request.heightMax, color);
        const nx = -sample.dx * request.relief,
          nz = -sample.dz * request.relief,
          inverseLength = 1 / Math.sqrt(nx * nx + 1 + nz * nz);
        shade =
          0.55 +
          0.45 *
            Math.max(
              0,
              (nx * light[0] + light[1] + nz * light[2]) * inverseLength,
            );
      }
      const i = (row * width + col) * 4;
      for (let channel = 0; channel < 3; channel++)
        rgba[i + channel] = Math.max(
          0,
          Math.min(255, Math.round(Number(color[channel]) * shade)),
        );
      rgba[i + 3] = 255;
    }
  }
  return {
    width,
    height,
    rgba,
    metadata: {
      world: source.world,
      seed: source.seed,
      worldgenVersion: source.version,
      layer: "surface",
      mode: "height",
      bounds,
      metresPerPixel: { x: dx, z: dz },
      orientation: "north (-z) at top; east (+x) at right",
      sampleConvention:
        "pixel centres; half-open bounds; terrain height excludes canopy",
      shading: {
        verticalExaggeration: request.relief,
        lightDirection: light,
        ambient: 0.55,
      },
      heightRamp: HEIGHT_RAMP.map((stop) => ({
        height:
          request.heightMin + stop.t * (request.heightMax - request.heightMin),
        rgb: stop.rgb,
      })),
      statistics: {
        minHeight,
        maxHeight,
        meanHeight: sum / (width * height),
        waterPixels,
        waterShare: waterPixels / (width * height),
        dryBelowDatumPixels,
        rampClippedLow,
        rampClippedHigh,
      },
    },
  };
}
