import {
  DataTexture,
  type IUniform,
  NearestFilter,
  RedFormat,
  UnsignedByteType,
  Vector2,
} from "three";

export interface FarNearColumn {
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
  readonly ready: boolean;
  readonly drawn: boolean;
}

export const FAR_NEAR_CELL_SIZE = 32;
const MAX_MASK_SIDE = 2048;

/** Shared by the terrain and cap shaders; coordinates are absolute metres. */
export const FAR_NEAR_COVERAGE_GLSL = `
uniform sampler2D uFarNearMask;
uniform vec2 uFarNearMin;
uniform vec2 uFarNearSize;
bool cfNearCovers(vec2 worldXZ) {
  vec2 cell=floor(worldXZ/${FAR_NEAR_CELL_SIZE.toFixed(1)})-uFarNearMin;
  if(any(lessThan(cell,vec2(0.0))) || any(greaterThanEqual(cell,uFarNearSize))) return false;
  return texelFetch(uFarNearMask,ivec2(cell),0).r>0.5;
}`;

function makeTexture(
  data: Uint8Array<ArrayBuffer>,
  width: number,
  height: number,
): DataTexture {
  const texture = new DataTexture(
    data,
    width,
    height,
    RedFormat,
    UnsignedByteType,
  );
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Exact grid-aligned near footprints, never a distance/radius approximation.
 * A caller may mark a column drawn only when its COMPLETE required vertical
 * band is ready and the near pass can draw all of it, including its depth range.
 * At high Command altitude a partially clipped column must remain uncovered.
 * LOD0 (32 m) and LOD1 (64 m) footprints both fit this base-cell mask.
 * The caller owns this resource, sharing it with all far materials and caps.
 */
export class FarTerrainCoverage {
  private data = new Uint8Array(1);
  readonly mask: IUniform<DataTexture> = {
    value: makeTexture(this.data, 1, 1),
  };
  readonly min: IUniform<Vector2> = { value: new Vector2() };
  readonly size: IUniform<Vector2> = { value: new Vector2(1, 1) };
  private signature = "";
  private disposed = false;

  update(columns: readonly FarNearColumn[]): void {
    if (this.disposed) throw new Error("Far coverage disposed");
    const active = columns.filter((column) => column.ready && column.drawn);
    for (const column of active) {
      if (
        ![column.minX, column.minZ, column.maxX, column.maxZ].every(
          (n) => Number.isSafeInteger(n) && n % FAR_NEAR_CELL_SIZE === 0,
        ) ||
        column.maxX <= column.minX ||
        column.maxZ <= column.minZ
      )
        throw new RangeError(
          "Near coverage requires aligned nonempty 32 m footprints",
        );
    }
    // Immutable value comparison avoids uploading the same mask each frame.
    const signature = active
      .map((c) => `${c.minX},${c.minZ},${c.maxX},${c.maxZ}`)
      .sort()
      .join(";");
    if (signature === this.signature) return;
    let minX = 0;
    let minZ = 0;
    let width = 1;
    let height = 1;
    if (active.length) {
      minX = Math.min(...active.map((c) => c.minX)) / FAR_NEAR_CELL_SIZE;
      minZ = Math.min(...active.map((c) => c.minZ)) / FAR_NEAR_CELL_SIZE;
      width =
        Math.max(...active.map((c) => c.maxX)) / FAR_NEAR_CELL_SIZE - minX;
      height =
        Math.max(...active.map((c) => c.maxZ)) / FAR_NEAR_CELL_SIZE - minZ;
    }
    if (width > MAX_MASK_SIDE || height > MAX_MASK_SIDE)
      throw new RangeError(
        "Near coverage mask exceeds canonical-world capacity",
      );
    const data = new Uint8Array(width * height);
    for (const column of active) {
      const x0 = column.minX / FAR_NEAR_CELL_SIZE - minX;
      const x1 = column.maxX / FAR_NEAR_CELL_SIZE - minX;
      const z0 = column.minZ / FAR_NEAR_CELL_SIZE - minZ;
      const z1 = column.maxZ / FAR_NEAR_CELL_SIZE - minZ;
      for (let z = z0; z < z1; z++)
        data.fill(255, z * width + x0, z * width + x1);
    }
    if (width === this.size.value.x && height === this.size.value.y) {
      this.data.set(data);
      this.mask.value.needsUpdate = true;
    } else {
      const previous = this.mask.value;
      this.mask.value = makeTexture(data, width, height);
      this.data = data;
      previous.dispose();
    }
    this.min.value.set(minX, minZ);
    this.size.value.set(width, height);
    this.signature = signature;
  }

  /** CPU oracle for the same half-open mask used by both fragment shaders. */
  covers(x: number, z: number): boolean {
    if (this.disposed || !Number.isFinite(x) || !Number.isFinite(z))
      return false;
    const cx = Math.floor(x / FAR_NEAR_CELL_SIZE) - this.min.value.x;
    const cz = Math.floor(z / FAR_NEAR_CELL_SIZE) - this.min.value.y;
    return (
      cx >= 0 &&
      cz >= 0 &&
      cx < this.size.value.x &&
      cz < this.size.value.y &&
      this.data[cx + cz * this.size.value.x] === 255
    );
  }

  bind(uniforms: Record<string, IUniform>): void {
    uniforms.uFarNearMask = this.mask;
    uniforms.uFarNearMin = this.min;
    uniforms.uFarNearSize = this.size;
  }

  /** CPU data survives context loss. Three uploads it again on the next draw. */
  contextRestored(): void {
    if (this.disposed) throw new Error("Far coverage disposed");
    this.mask.value.needsUpdate = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mask.value.dispose();
    this.data = new Uint8Array(0);
  }
}
