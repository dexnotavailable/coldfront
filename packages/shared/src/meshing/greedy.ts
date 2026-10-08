/**
 * 32-bit port of cgerikj/binary-greedy-meshing v1 face-mask/greedy kernels.
 * Source f88305d0a027ca4bb6cd44b10322b87f4a98e912, MIT, Erik Johansson 2020.
 * Full licence is in LICENSE.binary-greedy-meshing. Adaptations: separate
 * border bits for the full 32-cell row, ordered AO and packed-light merge keys,
 * four draw classes, typed-array output. No BigInt or floating-point masks.
 */
import { BLOCK_REGISTRY, Block } from "../blocks/registry.js";
import { haloIndex } from "../world/coordinates.js";

export interface MeshPart {
  readonly positions: Float32Array;
  readonly normals: Int8Array;
  readonly expansions: Int8Array;
  /** x:6 y:6 z:6, exactly representable by a float attribute. */
  readonly packedPositions: Float32Array;
  /** block, AO (0..3), packed sky/R/G/B light (four nibbles). */
  readonly surfaces: Float32Array;
  readonly indices: Uint32Array;
}
export interface ChunkMesh {
  readonly parts: readonly MeshPart[];
  readonly skirts: MeshPart;
  readonly quads: number;
}
interface Builder {
  p: number[];
  n: number[];
  e: number[];
  packed: number[];
  s: number[];
  i: number[];
}
const makeBuilder = (): Builder => ({
  p: [],
  n: [],
  e: [],
  packed: [],
  s: [],
  i: [],
});
function finish(b: Builder): MeshPart {
  return {
    positions: new Float32Array(b.p),
    normals: new Int8Array(b.n),
    expansions: new Int8Array(b.e),
    packedPositions: new Float32Array(b.packed),
    surfaces: new Float32Array(b.s),
    indices: new Uint32Array(b.i),
  };
}
export function vertexAO(side1: number, side2: number, corner: number): number {
  return side1 && side2 ? 0 : 3 - side1 - side2 - corner;
}
export function runMask(start: number, length: number): number {
  return length === 32 ? 0xffffffff : (((1 << length) - 1) << start) >>> 0;
}
function opaque(id: number): number {
  return BLOCK_REGISTRY[id]?.opaque ? 1 : 0;
}
function renderClass(id: number): number {
  const kind = BLOCK_REGISTRY[id]?.renderType;
  return kind === "cutout"
    ? 1
    : kind === "translucent"
      ? 2
      : kind === "fluid"
        ? 3
        : 0;
}
/** u cross v = axis. This also fixes the AO tuple order for all six faces. */
function coord(
  axis: number,
  c: number,
  u: number,
  v: number,
): [number, number, number] {
  return axis === 0 ? [c, u, v] : axis === 1 ? [v, c, u] : [u, v, c];
}
function index(axis: number, c: number, u: number, v: number): number {
  return axis === 0
    ? haloIndex(c, u, v)
    : axis === 1
      ? haloIndex(v, c, u)
      : haloIndex(u, v, c);
}
function visible(a: number, b: number): boolean {
  if (a === Block.Air) return false;
  if (opaque(b)) return false;
  return a !== b || opaque(a) === 1;
}
function emit(
  b: Builder,
  axis: number,
  sign: number,
  c: number,
  u: number,
  v: number,
  w: number,
  h: number,
  block: number,
  ao: number,
  light: number,
): void {
  const corners = [
    [u, v],
    [u + w, v],
    [u + w, v + h],
    [u, v + h],
  ];
  const base = b.p.length / 3;
  const normal = coord(axis, sign, 0, 0);
  for (let k = 0; k < 4; k++) {
    const corner = corners[k] as number[];
    const p = coord(axis, c, corner[0] as number, corner[1] as number);
    b.p.push(...p);
    b.n.push(...normal);
    b.e.push(...coord(axis, 0, k === 0 || k === 3 ? -1 : 1, k < 2 ? -1 : 1));
    b.packed.push(
      (p[0] as number) | ((p[1] as number) << 6) | ((p[2] as number) << 12),
    );
    b.s.push(block, (ao >>> (k * 2)) & 3, light);
  }
  const flip =
    (ao & 3) + ((ao >>> 4) & 3) > ((ao >>> 2) & 3) + ((ao >>> 6) & 3);
  const tris = flip ? [0, 1, 3, 1, 2, 3] : [0, 1, 2, 0, 2, 3];
  for (let k = 0; k < 6; k += 3) {
    if (sign > 0)
      b.i.push(
        base + (tris[k] as number),
        base + (tris[k + 1] as number),
        base + (tris[k + 2] as number),
      );
    else
      b.i.push(
        base + (tris[k] as number),
        base + (tris[k + 2] as number),
        base + (tris[k + 1] as number),
      );
  }
}
/** Halo dimensions and indexing are the foundation's 34 x 41 x 34 contract. */
export function meshChunk(blocks: Uint16Array, lights: Uint16Array): ChunkMesh {
  const builders = [makeBuilder(), makeBuilder(), makeBuilder(), makeBuilder()];
  const skirts = makeBuilder();
  const rowMasks = new Uint32Array(32);
  const faceKeys = new Uint32Array(1024);
  const faceLights = new Uint16Array(1024);
  const faces = new Uint32Array(32 * 32 * 2);
  let quads = 0;
  for (let axis = 0; axis < 3; axis++) {
    // Ported bit-parallel culling: the 32 core bits have independent end masks.
    faces.fill(0);
    for (let v = 0; v < 32; v++)
      for (let u = 0; u < 32; u++) {
        let occupied = 0;
        for (let c = 0; c < 32; c++)
          if (opaque(blocks[index(axis, c, u, v)] as number))
            occupied = (occupied | (1 << c)) >>> 0;
        const low = opaque(blocks[index(axis, -1, u, v)] as number);
        const high = opaque(blocks[index(axis, 32, u, v)] as number);
        faces[u + v * 32] =
          (occupied & ~((occupied >>> 1) | (high << 31))) >>> 0;
        faces[u + v * 32 + 1024] = (occupied & ~((occupied << 1) | low)) >>> 0;
      }
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? 1 : -1;
      for (let c = 0; c < 32; c++) {
        rowMasks.fill(0);
        for (let v = 0; v < 32; v++)
          for (let u = 0; u < 32; u++) {
            const bi = index(axis, c, u, v),
              ni = index(axis, c + sign, u, v);
            const block = blocks[bi] as number,
              neighbour = blocks[ni] as number;
            if (block === 0) continue;
            const show = opaque(block)
              ? (((faces[u + 32 * v + side * 1024] as number) >>> c) & 1) !== 0
              : visible(block, neighbour);
            if (!show) {
              // Preserve the exact culled border face for a future LOD seam draw.
              if (
                ((c === 0 && sign < 0) || (c === 31 && sign > 0)) &&
                opaque(block) &&
                opaque(neighbour)
              )
                emit(
                  skirts,
                  axis,
                  sign,
                  c + (sign > 0 ? 1 : 0),
                  u,
                  v,
                  1,
                  1,
                  block,
                  255,
                  lights[ni] as number,
                );
              continue;
            }
            let ao = 0;
            for (let k = 0; k < 4; k++) {
              const du = k === 0 || k === 3 ? -1 : 1,
                dv = k < 2 ? -1 : 1;
              const a = opaque(
                blocks[index(axis, c + sign, u + du, v)] as number,
              );
              const d = opaque(
                blocks[index(axis, c + sign, u, v + dv)] as number,
              );
              const corner = opaque(
                blocks[index(axis, c + sign, u + du, v + dv)] as number,
              );
              ao |= vertexAO(a, d, corner) << (2 * k);
            }
            const fi = u + 32 * v;
            faceKeys[fi] = (block << 8) | ao;
            faceLights[fi] = lights[ni] as number;
            rowMasks[v] = ((rowMasks[v] as number) | (1 << u)) >>> 0;
          }
        // Greedy rectangles over bit planes. Ordered four-corner AO/light are
        // exact equality keys; variant/tint deliberately never enter this key.
        for (let v = 0; v < 32; v++)
          while (rowMasks[v]) {
            const bits = rowMasks[v] as number;
            const u = 31 - Math.clz32(bits & -bits);
            const key = faceKeys[u + v * 32] as number,
              light = faceLights[u + v * 32] as number;
            let w = 1;
            while (
              u + w < 32 &&
              (bits >>> (u + w)) & 1 &&
              faceKeys[u + w + v * 32] === key &&
              faceLights[u + w + v * 32] === light
            )
              w++;
            const mask = runMask(u, w);
            let h = 1;
            outer: while (
              v + h < 32 &&
              ((rowMasks[v + h] as number) & mask) >>> 0 === mask
            ) {
              for (let j = 0; j < w; j++)
                if (
                  faceKeys[u + j + (v + h) * 32] !== key ||
                  faceLights[u + j + (v + h) * 32] !== light
                )
                  break outer;
              h++;
            }
            for (let j = 0; j < h; j++)
              rowMasks[v + j] = ((rowMasks[v + j] as number) & ~mask) >>> 0;
            const block = key >>> 8;
            emit(
              builders[renderClass(block)] as Builder,
              axis,
              sign,
              c + (sign > 0 ? 1 : 0),
              u,
              v,
              w,
              h,
              block,
              key & 255,
              light,
            );
            quads++;
          }
      }
    }
  }
  return { parts: builders.map(finish), skirts: finish(skirts), quads };
}
