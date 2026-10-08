import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import { TEXTURE_RECIPES } from "../../../shared/src/blocks/textures/recipes.js";
import type { Raster } from "../terrain-review/output.js";
import type {
  ReviewVoxel,
  TerrainReviewSource,
} from "../terrain-review/source.js";

export type XZ = readonly [number, number];
export interface SectionRequest {
  readonly from: XZ;
  readonly to: XZ;
  readonly yMin: number;
  readonly yMax: number;
  readonly metresPerPixel: number;
  readonly kind: "overview" | "window";
}
export interface SectionMetadata {
  readonly world: string;
  readonly seed: number;
  readonly worldgenVersion: number;
  readonly kind: "overview" | "window";
  readonly from: XZ;
  readonly to: XZ;
  readonly yMin: number;
  readonly yMax: number;
  readonly lengthMetres: number;
  readonly metresPerPixel: number;
  readonly lastColumnMetres: number;
  readonly lastRowMetres: number;
  readonly sampleConvention: "continuous pointwise samples at cell centres; final row/column clipped to requested extent";
  readonly orientation: "from at left; to at right; highest y at top";
  readonly density: Readonly<{
    minimum: number;
    maximum: number;
    positivePixels: number;
  }>;
  readonly fluidPixels: number;
  readonly materials: readonly Readonly<{
    id: number;
    name: string;
    rgb: readonly number[];
    pixels: number;
    sampledAreaSquareMetres: number;
  }>[];
}
const palette: readonly (readonly number[])[] = TEXTURE_RECIPES.map(
  (recipe) => {
    if (recipe.id === Block.Air) return [0, 0, 0];
    if (recipe.id === Block.Water) return [43, 115, 181];
    if (recipe.id === Block.Worldstone) return [36, 37, 44];
    if (recipe.id === Block.DeepStone) return [67, 79, 100];
    return recipe.rgb;
  },
);
export function sectionLength(
  request: Pick<SectionRequest, "from" | "to">,
): number {
  return Math.hypot(
    request.to[0] - request.from[0],
    request.to[1] - request.from[1],
  );
}
export function validateSection(
  request: SectionRequest,
  source: TerrainReviewSource,
): void {
  const values = [
    ...request.from,
    ...request.to,
    request.yMin,
    request.yMax,
    request.metresPerPixel,
  ];
  if (!values.every(Number.isFinite))
    throw new RangeError("Section parameters must be finite");
  if (
    request.metresPerPixel <= 0 ||
    request.yMin >= request.yMax ||
    sectionLength(request) <= 0
  )
    throw new RangeError(
      "Section needs a nonzero line, positive pixel spacing, and ordered height bounds",
    );
  if (request.yMin < source.bounds.minY || request.yMax > source.bounds.maxY)
    throw new RangeError("Section height bounds exceed the world frame");
  for (const point of [request.from, request.to])
    if (point.some((v) => v < source.bounds.minXZ || v > source.bounds.maxXZ))
      throw new RangeError("Section endpoint is outside the world frame");
  if (
    (request.from[0] === source.bounds.maxXZ &&
      request.to[0] === source.bounds.maxXZ) ||
    (request.from[1] === source.bounds.maxXZ &&
      request.to[1] === source.bounds.maxXZ)
  )
    throw new RangeError(
      "A section cannot lie along the excluded upper XZ boundary",
    );
  const width = Math.ceil(sectionLength(request) / request.metresPerPixel),
    height = Math.ceil((request.yMax - request.yMin) / request.metresPerPixel);
  if (width > 16384 || height > 8192 || width * height > 16_777_216)
    throw new RangeError(
      "Section exceeds the image limit; shorten the window or increase pixel spacing",
    );
}
export function renderSection(
  request: SectionRequest,
  source: TerrainReviewSource,
): Raster<SectionMetadata> {
  validateSection(request, source);
  const length = sectionLength(request),
    px = request.metresPerPixel,
    heightMetres = request.yMax - request.yMin;
  const width = Math.ceil(length / px),
    height = Math.ceil(heightMetres / px),
    rgba = new Uint8Array(width * height * 4);
  const counts = new Map<number, { pixels: number; area: number }>(),
    voxel: ReviewVoxel = { block: 0, density: 0, fluid: 0 };
  let densityMin = Infinity,
    densityMax = -Infinity,
    positivePixels = 0,
    fluidPixels = 0;
  for (let col = 0; col < width; col++) {
    const start = col * px,
      end = Math.min(length, (col + 1) * px),
      centre = (start + end) / 2,
      t = centre / length;
    const column = source.column(
      request.from[0] + (request.to[0] - request.from[0]) * t,
      request.from[1] + (request.to[1] - request.from[1]) * t,
    );
    for (let row = 0; row < height; row++) {
      const top = request.yMax - row * px,
        bottom = Math.max(request.yMin, top - px),
        y = (top + bottom) / 2;
      column.writeVoxel(y, voxel);
      if (!Number.isFinite(voxel.density))
        throw new Error("Source returned a non-finite in-bounds density");
      const color = palette[voxel.block],
        definition = BLOCK_REGISTRY[voxel.block];
      if (!color || !definition)
        throw new Error(
          `No registered material colour for block ${voxel.block}`,
        );
      const index = (row * width + col) * 4;
      rgba[index] = Number(color[0]);
      rgba[index + 1] = Number(color[1]);
      rgba[index + 2] = Number(color[2]);
      rgba[index + 3] = 255;
      const count = counts.get(voxel.block) ?? { pixels: 0, area: 0 };
      count.pixels++;
      count.area += (end - start) * (top - bottom);
      counts.set(voxel.block, count);
      densityMin = Math.min(densityMin, voxel.density);
      densityMax = Math.max(densityMax, voxel.density);
      if (voxel.density > 0) positivePixels++;
      if (voxel.fluid !== Block.Air) fluidPixels++;
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
      kind: request.kind,
      from: request.from,
      to: request.to,
      yMin: request.yMin,
      yMax: request.yMax,
      lengthMetres: length,
      metresPerPixel: px,
      lastColumnMetres: length - (width - 1) * px,
      lastRowMetres: heightMetres - (height - 1) * px,
      sampleConvention:
        "continuous pointwise samples at cell centres; final row/column clipped to requested extent",
      orientation: "from at left; to at right; highest y at top",
      density: { minimum: densityMin, maximum: densityMax, positivePixels },
      fluidPixels,
      materials: [...counts]
        .sort((a, b) => a[0] - b[0])
        .map(([id, count]) => ({
          id,
          name: BLOCK_REGISTRY[id]?.name ?? "",
          rgb: palette[id] ?? [],
          pixels: count.pixels,
          sampledAreaSquareMetres: count.area,
        })),
    },
  };
}
/** Window centre is exact; it defines a parallel transect with the overview's bearing. */
export function windowSection(
  overview: SectionRequest,
  centre: XZ,
  length: number,
  px: 1 | 2,
  yMin: number,
  yMax: number,
): SectionRequest {
  if (px !== 1 && px !== 2)
    throw new RangeError("Window pixel spacing must be 1 or 2 metres");
  if (!Number.isFinite(length) || length <= 0 || length > 2000)
    throw new RangeError(
      "Window length must be greater than zero and at most 2000 metres",
    );
  const fullLength = sectionLength(overview);
  if (!(fullLength > 0))
    throw new RangeError("Cannot orient a window along a zero-length overview");
  const dx = (((overview.to[0] - overview.from[0]) / fullLength) * length) / 2,
    dz = (((overview.to[1] - overview.from[1]) / fullLength) * length) / 2;
  return {
    kind: "window",
    from: [centre[0] - dx, centre[1] - dz],
    to: [centre[0] + dx, centre[1] + dz],
    yMin,
    yMax,
    metresPerPixel: px,
  };
}
