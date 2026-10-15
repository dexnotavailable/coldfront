import { BLOCK_REGISTRY, Block } from "../blocks/registry.js";
import { WORLD_MIN_Y } from "../world/constants.js";
import { readFarRun, resolveFarLimits } from "../worldgen/far/columns.js";
import { farColumnIndex, farSpacing } from "../worldgen/far/coordinates.js";
import {
  FarCapacityError,
  type FarLimits,
  type FarMeshPart,
  type FarRun,
  type FarStatistics,
  type FarTileMesh,
  type FarTileRuns,
} from "../worldgen/far/types.js";

interface Builder {
  p: number[];
  n: number[];
  e: number[];
  s: number[];
  f: number[];
  i: number[];
}
const builder = (): Builder => ({ p: [], n: [], e: [], s: [], f: [], i: [] });
function finish(b: Builder): FarMeshPart {
  return {
    positions: new Float32Array(b.p),
    normals: new Float32Array(b.n),
    expansions: new Int8Array(b.e),
    surfaces: new Float32Array(b.s),
    featureIdParts: new Uint16Array(b.f),
    indices: new Uint32Array(b.i),
  };
}
function renderClass(block: number): number {
  const definition = BLOCK_REGISTRY[block];
  return definition?.renderType === "cutout"
    ? 1
    : definition?.renderType === "translucent"
      ? 2
      : definition?.renderType === "fluid"
        ? definition.fluidKind === "lava"
          ? 4
          : 3
        : 0;
}
function visible(a: number, b: number): boolean {
  return (
    a !== Block.Air &&
    !BLOCK_REGISTRY[b]?.opaque &&
    (a !== b || Boolean(BLOCK_REGISTRY[a]?.opaque))
  );
}
function coord(
  axis: number,
  c: number,
  u: number,
  v: number,
): [number, number, number] {
  return axis === 0 ? [c, u, v] : axis === 1 ? [v, c, u] : [u, v, c];
}
function emit(
  b: Builder,
  axis: number,
  sign: number,
  c: number,
  u: number,
  v: number,
  width: number,
  height: number,
  run: FarRun,
): void {
  const base = b.p.length / 3;
  const normal = coord(axis, sign, 0, 0);
  const corners = [
    [u, v],
    [u + width, v],
    [u + width, v + height],
    [u, v + height],
  ];
  for (let k = 0; k < 4; k++) {
    const corner = corners[k] as number[];
    b.p.push(...coord(axis, c, Number(corner[0]), Number(corner[1])));
    b.n.push(...normal);
    b.e.push(...coord(axis, 0, k === 0 || k === 3 ? -1 : 1, k < 2 ? -1 : 1));
    // Coarse faces do not use BFS; upward sky is full, RGB retains source emission.
    b.s.push(
      run.block,
      3,
      axis === 1 && sign > 0 ? run.light | 0xf000 : run.light,
    );
    b.f.push(run.featureId & 0xffff, run.featureId >>> 16);
  }
  const triangles = sign > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
  for (const index of triangles) b.i.push(base + index);
}
/** Split by neighbour intervals. Returns exposed faces and culled seam intervals. */
export function farSideIntervals(
  run: FarRun,
  neighbours: readonly FarRun[],
): { visible: [number, number][]; hidden: [number, number][] } {
  const exposed: [number, number][] = [],
    hidden: [number, number][] = [];
  let at = run.bottom;
  for (const other of neighbours) {
    if (other.top <= at || other.bottom >= run.top) continue;
    if (other.bottom > at) exposed.push([at, Math.min(run.top, other.bottom)]);
    const bottom = Math.max(at, other.bottom),
      top = Math.min(run.top, other.top);
    if (top > bottom)
      (visible(run.block, other.block) ? exposed : hidden).push([bottom, top]);
    at = Math.max(at, top);
    if (at >= run.top) break;
  }
  if (at < run.top) exposed.push([at, run.top]);
  return { visible: exposed, hidden };
}
export function meshFarTile(
  tile: FarTileRuns,
  limits: Partial<FarLimits> = {},
): FarTileMesh {
  const cap = resolveFarLimits(limits),
    spacing = farSpacing(tile.address);
  if (
    tile.offsets.length !== 1157 ||
    tile.words.length % 4 !== 0 ||
    Number(tile.offsets[1156]) * 4 !== tile.words.length
  )
    throw new RangeError("Invalid far run buffers");
  const parts = Array.from({ length: 5 }, builder);
  const skirts = Array.from({ length: 4 }, () =>
    Array.from({ length: 5 }, builder),
  );
  const statistics: FarStatistics = {
    ...tile.statistics,
    quads: 0,
    skirtQuads: 0,
    typedArrayBytes: 0,
  };
  const columns: FarRun[][] = [];
  for (let ci = 0; ci < 1156; ci++) {
    const runs: FarRun[] = [];
    const begin = Number(tile.offsets[ci]),
      end = Number(tile.offsets[ci + 1]);
    if (begin > end || end * 4 > tile.words.length)
      throw new RangeError("Invalid far offsets");
    let lastTop = -Infinity;
    for (let i = begin; i < end; i++) {
      const run = readFarRun(tile, i);
      if (
        run.top <= run.bottom ||
        run.bottom < lastTop ||
        !BLOCK_REGISTRY[run.block] ||
        run.block === Block.Air
      )
        throw new RangeError("Invalid far run ordering");
      lastTop = run.top;
      runs.push(run);
    }
    columns.push(runs);
  }
  const add = (
    target: Builder,
    axis: number,
    sign: number,
    c: number,
    u: number,
    v: number,
    width: number,
    height: number,
    run: FarRun,
    skirt = false,
  ): void => {
    if (statistics.quads + statistics.skirtQuads >= cap.quads)
      throw new FarCapacityError("quads", cap.quads, { ...statistics });
    if (skirt) statistics.skirtQuads++;
    else statistics.quads++;
    emit(target, axis, sign, c, u, v, width, height, run);
  };
  for (let z = 0; z < 32; z++)
    for (let x = 0; x < 32; x++) {
      const runs = columns[farColumnIndex(x, z)] as FarRun[];
      for (let i = 0; i < runs.length; i++) {
        const run = runs[i] as FarRun,
          kind = renderClass(run.block),
          target = parts[kind] as Builder;
        const below = runs[i - 1],
          above = runs[i + 1];
        if (
          !below ||
          below.top !== run.bottom ||
          visible(run.block, below.block)
        )
          add(
            target,
            1,
            -1,
            run.bottom - WORLD_MIN_Y,
            z * spacing,
            x * spacing,
            spacing,
            spacing,
            run,
          );
        if (
          !above ||
          above.bottom !== run.top ||
          visible(run.block, above.block)
        )
          add(
            target,
            1,
            1,
            run.top - WORLD_MIN_Y,
            z * spacing,
            x * spacing,
            spacing,
            spacing,
            run,
          );
        for (let side = 0; side < 4; side++) {
          const nx = x + (side === 0 ? -1 : side === 1 ? 1 : 0);
          const nz = z + (side === 2 ? -1 : side === 3 ? 1 : 0);
          const intervals = farSideIntervals(
            run,
            columns[farColumnIndex(nx, nz)] as FarRun[],
          );
          const axis = side < 2 ? 0 : 2,
            sign = side % 2 === 0 ? -1 : 1;
          const c =
            (side < 2 ? x + (sign > 0 ? 1 : 0) : z + (sign > 0 ? 1 : 0)) *
            spacing;
          const draw = (
            b: Builder,
            bottom: number,
            top: number,
            skirt: boolean,
          ): void => {
            if (axis === 0)
              add(
                b,
                axis,
                sign,
                c,
                bottom - WORLD_MIN_Y,
                z * spacing,
                top - bottom,
                spacing,
                run,
                skirt,
              );
            else
              add(
                b,
                axis,
                sign,
                c,
                x * spacing,
                bottom - WORLD_MIN_Y,
                spacing,
                top - bottom,
                run,
                skirt,
              );
          };
          for (const [bottom, top] of intervals.visible)
            draw(target, bottom, top, false);
          if (
            (side === 0 && x === 0) ||
            (side === 1 && x === 31) ||
            (side === 2 && z === 0) ||
            (side === 3 && z === 31)
          )
            for (const [bottom, top] of intervals.hidden)
              draw(
                (skirts[side] as Builder[])[kind] as Builder,
                bottom,
                top,
                true,
              );
        }
      }
    }
  const output = parts.map(finish),
    seamOutput = skirts.map((side) => side.map(finish));
  for (const part of [...output, ...seamOutput.flat()])
    statistics.typedArrayBytes +=
      part.positions.byteLength +
      part.normals.byteLength +
      part.expansions.byteLength +
      part.surfaces.byteLength +
      part.featureIdParts.byteLength +
      part.indices.byteLength;
  return {
    parts: output,
    skirts: seamOutput,
    quads: statistics.quads + statistics.skirtQuads,
    statistics: Object.freeze(statistics),
  };
}
