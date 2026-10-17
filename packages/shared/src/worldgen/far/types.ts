import type { Aabb } from "../../sdf/types.js";
import type {
  LayerId,
  VoxelSample,
  WorldColumnLayout,
  XZBounds,
} from "../../world/types.js";

export type FarLod = 2 | 3 | 4 | 5 | 6;
export interface FarTileAddress {
  readonly tx: number;
  readonly tz: number;
  readonly lod: FarLod;
}
export interface FarTileRequest {
  readonly address: FarTileAddress;
  readonly layer: LayerId;
  readonly revision: number;
}
export interface FarLimits {
  readonly densityCalls: number;
  readonly runs: number;
  readonly quads: number;
}
export const DEFAULT_FAR_LIMITS: Readonly<FarLimits> = Object.freeze({
  densityCalls: 1_000_000,
  runs: 65_536,
  quads: 65_536,
});
export interface FarStatistics {
  densityCalls: number;
  columns: number;
  runs: number;
  quads: number;
  skirtQuads: number;
  typedArrayBytes: number;
}
export class FarCapacityError extends Error {
  override readonly name = "FarCapacityError";
  constructor(
    readonly capacity: keyof FarLimits,
    readonly limit: number,
    readonly statistics: Readonly<FarStatistics>,
  ) {
    super(`Far tile ${capacity} capacity ${limit} exceeded`);
  }
}
export interface FarRun {
  bottom: number;
  top: number;
  block: number;
  light: number;
  featureId: number;
  flags: number;
}
/** Heights are metres here; the transfer representation below uses biased Y16. */
export interface FarFluidInterval {
  readonly bottom: number;
  readonly top: number;
  readonly block: number;
}
export interface FarColumnSample {
  readonly values: Float64Array;
  readonly terrainValues: Float64Array;
  heightDelta: number;
  canopyTop: number;
  minY: number;
  maxY: number;
  /** True only while the source certifies constant-material ground below minY. */
  certifiedBase: boolean;
  readonly fluids: FarFluidInterval[];
}
export interface FarAreaSampler {
  readonly columns: WorldColumnLayout;
  readonly featureBounds: readonly Readonly<Aabb>[];
  createColumn(): FarColumnSample;
  sampleColumn(x: number, z: number, out: FarColumnSample): FarColumnSample;
  sampleVoxel(
    x: number,
    y: number,
    z: number,
    out: VoxelSample,
    column: FarColumnSample,
  ): VoxelSample;
  /** Certified intervals only. Their top must equal the supplied top. */
  baseRuns(
    x: number,
    z: number,
    top: number,
    column: FarColumnSample,
  ): readonly FarRun[];
}
export interface FarPreparationOptions {
  readonly spacing: number;
  readonly layer: LayerId;
}
export type PrepareFarArea = (
  bounds: XZBounds,
  options: FarPreparationOptions,
) => FarAreaSampler;
export interface FarTileRuns extends FarTileRequest {
  /** x-fastest 34x34 columns, including local -1 and 32 halo columns. */
  readonly offsets: Uint32Array;
  /** Four words/run: bottom16|top16<<16, block16|light16<<16, featureId, flags. */
  readonly words: Uint32Array;
  readonly statistics: Readonly<FarStatistics>;
}
export interface FarMeshPart {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly expansions: Int8Array;
  readonly surfaces: Float32Array;
  readonly featureIdParts: Uint16Array;
  readonly indices: Uint32Array;
}
/** Side order -X,+X,-Z,+Z; class order opaque,cutout,translucent,water,lava. */
export interface FarTileMesh {
  readonly parts: readonly FarMeshPart[];
  readonly skirts: readonly (readonly FarMeshPart[])[];
  readonly quads: number;
  readonly statistics: Readonly<FarStatistics>;
}
