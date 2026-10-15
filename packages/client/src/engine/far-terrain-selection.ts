import {
  WORLD_MAX_XZ,
  WORLD_MAX_Y,
  WORLD_MIN_XZ,
  WORLD_MIN_Y,
} from "../../../shared/src/world/constants.js";
import type { LayerId } from "../../../shared/src/world/types.js";
import {
  farSpacing,
  packFarTileKey,
} from "../../../shared/src/worldgen/far/coordinates.js";
import type { FarTileAddress } from "../../../shared/src/worldgen/far/types.js";

export interface FarBounds {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
}
export interface FarView {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly fovYRadians: number;
  readonly pixelHeight: number;
  readonly reach: number;
  /** Inward-facing planes in absolute world coordinates. */
  readonly planes?: readonly Readonly<{
    x: number;
    y: number;
    z: number;
    constant: number;
  }>[];
}
export interface FarSelectionNode {
  readonly address: FarTileAddress;
  readonly key: number;
  readonly bounds: FarBounds;
  readonly distance: number;
  readonly errorPixels: number;
  readonly children: readonly FarSelectionNode[];
}
export interface FarSelectionPlan {
  readonly layer: LayerId;
  readonly roots: readonly FarSelectionNode[];
  /** Coarse ancestors first so cold views get coverage before refinement. */
  readonly requests: readonly FarSelectionNode[];
  readonly leaves: readonly FarSelectionNode[];
  readonly refined: ReadonlySet<number>;
}
export interface FarSelectionOptions {
  readonly layer: LayerId;
  readonly refinePixels?: number;
  readonly coarsenPixels?: number;
  readonly previouslyRefined?: ReadonlySet<number>;
  readonly heightBounds?: (
    address: FarTileAddress,
  ) => Readonly<{ minY: number; maxY: number }>;
  /** Spacing is a conservative initial proxy, not measured geometric error. */
  readonly errorMetres?: (address: FarTileAddress) => number;
}
export function farTileBounds(
  address: FarTileAddress,
  minY = WORLD_MIN_Y,
  maxY = WORLD_MAX_Y,
): FarBounds {
  const width = 32 * farSpacing(address);
  if (!Number.isFinite(minY) || !Number.isFinite(maxY) || minY > maxY)
    throw new RangeError("Invalid far vertical bounds");
  return {
    minX: address.tx * width,
    minY,
    minZ: address.tz * width,
    maxX: (address.tx + 1) * width,
    maxY,
    maxZ: (address.tz + 1) * width,
  };
}
export function farDistanceToBounds(view: FarView, b: FarBounds): number {
  return Math.hypot(
    Math.max(b.minX - view.x, 0, view.x - b.maxX),
    Math.max(b.minY - view.y, 0, view.y - b.maxY),
    Math.max(b.minZ - view.z, 0, view.z - b.maxZ),
  );
}
function intersectsView(view: FarView, bounds: FarBounds): boolean {
  if (farDistanceToBounds(view, bounds) > view.reach) return false;
  return (view.planes ?? []).every(
    (p) =>
      p.x * (p.x >= 0 ? bounds.maxX : bounds.minX) +
        p.y * (p.y >= 0 ? bounds.maxY : bounds.minY) +
        p.z * (p.z >= 0 ? bounds.maxZ : bounds.minZ) +
        p.constant >=
      0,
  );
}
export function planFarTerrain(
  view: FarView,
  options: FarSelectionOptions,
): FarSelectionPlan {
  const refine = options.refinePixels ?? 2;
  const coarsen = options.coarsenPixels ?? 1.4;
  if (
    ![
      view.x,
      view.y,
      view.z,
      view.fovYRadians,
      view.pixelHeight,
      view.reach,
      refine,
      coarsen,
    ].every(Number.isFinite) ||
    view.fovYRadians <= 0 ||
    view.fovYRadians >= Math.PI ||
    view.pixelHeight <= 0 ||
    view.reach <= 0 ||
    view.reach > 32_768 ||
    coarsen <= 0 ||
    refine < coarsen
  )
    throw new RangeError("Invalid far view");
  for (const plane of view.planes ?? [])
    if (![plane.x, plane.y, plane.z, plane.constant].every(Number.isFinite))
      throw new RangeError("Invalid far frustum");
  const pixels = view.pixelHeight / (2 * Math.tan(view.fovYRadians / 2));
  const requests: FarSelectionNode[] = [];
  const leaves: FarSelectionNode[] = [];
  const refined = new Set<number>();
  const balanceRefinement = new Set<number>();
  const visit = (address: FarTileAddress): FarSelectionNode | null => {
    const height = options.heightBounds?.(address);
    const bounds = farTileBounds(address, height?.minY, height?.maxY);
    if (!intersectsView(view, bounds)) return null;
    const key = packFarTileKey(address);
    const distance = farDistanceToBounds(view, bounds);
    const error = options.errorMetres?.(address) ?? farSpacing(address);
    if (!Number.isFinite(error) || error < 0)
      throw new RangeError("Invalid far geometric error");
    const errorPixels = (error * pixels) / Math.max(distance, 1);
    const children: FarSelectionNode[] = [];
    const split =
      address.lod > 2 &&
      (balanceRefinement.has(key) ||
        errorPixels > (options.previouslyRefined?.has(key) ? coarsen : refine));
    if (split) {
      for (let z = 0; z < 2; z++)
        for (let x = 0; x < 2; x++) {
          const child = visit({
            tx: address.tx * 2 + x,
            tz: address.tz * 2 + z,
            lod: (address.lod - 1) as FarTileAddress["lod"],
          });
          if (child) children.push(child);
        }
      // The parent's conservative box can intersect while all tighter children miss.
      if (!children.length) return null;
    }
    const node = Object.freeze({
      address: Object.freeze({ ...address }),
      key,
      bounds: Object.freeze(bounds),
      distance,
      errorPixels,
      children: Object.freeze(children),
    });
    requests.push(node);
    if (children.length) refined.add(key);
    else leaves.push(node);
    return node;
  };
  const roots: FarSelectionNode[] = [];
  const width = 2048;
  const minX = Math.max(
    WORLD_MIN_XZ / width,
    Math.floor((view.x - view.reach) / width),
  );
  const maxX = Math.min(
    WORLD_MAX_XZ / width - 1,
    Math.floor((view.x + view.reach) / width),
  );
  const minZ = Math.max(
    WORLD_MIN_XZ / width,
    Math.floor((view.z - view.reach) / width),
  );
  const maxZ = Math.min(
    WORLD_MAX_XZ / width - 1,
    Math.floor((view.z + view.reach) / width),
  );
  const populate = () => {
    for (let tz = minZ; tz <= maxZ; tz++)
      for (let tx = minX; tx <= maxX; tx++) {
        const root = visit({ tx, tz, lod: 6 });
        if (root) roots.push(root);
      }
  };
  populate();
  for (;;) {
    const gaps = levelGaps(leaves);
    if (!gaps.length) break;
    for (const [, coarse] of gaps) balanceRefinement.add(coarse.key);
    requests.length = leaves.length = roots.length = 0;
    refined.clear();
    populate();
  }
  requests.sort(
    (a, b) =>
      b.address.lod - a.address.lod ||
      b.errorPixels - a.errorPixels ||
      a.distance - b.distance ||
      a.key - b.key,
  );
  return Object.freeze({
    layer: options.layer,
    roots: Object.freeze(roots),
    requests: Object.freeze(requests),
    leaves: Object.freeze(leaves),
    refined,
  });
}

export interface FarCoverage {
  readonly tiles: readonly FarSelectionNode[];
  readonly covered: boolean;
  readonly atTarget: boolean;
  readonly balanced: boolean;
}
interface Edge {
  readonly node: FarSelectionNode;
  readonly start: number;
  readonly end: number;
  readonly positive: boolean;
}
/** Compare only intervals on the same edge line, avoiding an all-tile pair scan. */
function levelGaps(
  tiles: readonly FarSelectionNode[],
): readonly (readonly [FarSelectionNode, FarSelectionNode])[] {
  const lines = new Map<string, Edge[]>();
  const add = (
    key: string,
    node: FarSelectionNode,
    start: number,
    end: number,
    positive: boolean,
  ) => {
    const edge = { node, start, end, positive };
    const line = lines.get(key);
    if (line) line.push(edge);
    else lines.set(key, [edge]);
  };
  for (const node of tiles) {
    const b = node.bounds;
    add(`x:${b.minX}`, node, b.minZ, b.maxZ, false);
    add(`x:${b.maxX}`, node, b.minZ, b.maxZ, true);
    add(`z:${b.minZ}`, node, b.minX, b.maxX, false);
    add(`z:${b.maxZ}`, node, b.minX, b.maxX, true);
  }
  const gaps: [FarSelectionNode, FarSelectionNode][] = [];
  for (const line of lines.values()) {
    const low = line
      .filter((edge) => !edge.positive)
      .sort((a, b) => a.start - b.start);
    const high = line
      .filter((edge) => edge.positive)
      .sort((a, b) => a.start - b.start);
    let i = 0;
    let j = 0;
    while (i < low.length && j < high.length) {
      const a = low[i];
      const b = high[j];
      if (!a || !b) break;
      if (
        Math.min(a.end, b.end) > Math.max(a.start, b.start) &&
        Math.abs(a.node.address.lod - b.node.address.lod) > 1
      )
        gaps.push(
          a.node.address.lod < b.node.address.lod
            ? [a.node, b.node]
            : [b.node, a.node],
        );
      if (a.end <= b.end) i++;
      if (b.end <= a.end) j++;
    }
  }
  return gaps;
}
function containsTile(
  ancestor: FarSelectionNode,
  child: FarSelectionNode,
): boolean {
  return (
    child.bounds.minX >= ancestor.bounds.minX &&
    child.bounds.maxX <= ancestor.bounds.maxX &&
    child.bounds.minZ >= ancestor.bounds.minZ &&
    child.bounds.maxZ <= ancestor.bounds.maxZ
  );
}
function balancePreparedCut(
  input: readonly FarSelectionNode[],
  plan: FarSelectionPlan,
  drawable: (node: FarSelectionNode) => boolean,
): { tiles: readonly FarSelectionNode[]; balanced: boolean } {
  const lookup = new Map(plan.requests.map((node) => [node.key, node]));
  let tiles = input;
  // Each replacement strictly increases a surviving tile's level. Finite tree.
  for (;;) {
    const gaps = levelGaps(tiles);
    if (!gaps.length) return { tiles, balanced: true };
    const replacements = new Map<number, FarSelectionNode>();
    for (const [fine, coarse] of gaps) {
      let address = fine.address;
      while (address.lod < coarse.address.lod - 1)
        address = {
          tx: Math.floor(address.tx / 2),
          tz: Math.floor(address.tz / 2),
          lod: (address.lod + 1) as FarTileAddress["lod"],
        };
      const ancestor = lookup.get(packFarTileKey(address));
      if (ancestor && drawable(ancestor))
        replacements.set(ancestor.key, ancestor);
    }
    if (!replacements.size) return { tiles, balanced: false };
    // Coarse replacements subsume finer ones without overlapping interiors.
    const selected: FarSelectionNode[] = [];
    for (const replacement of [...replacements.values()].sort(
      (a, b) => b.address.lod - a.address.lod,
    ))
      if (!selected.some((ancestor) => containsTile(ancestor, replacement)))
        selected.push(replacement);
    tiles = [
      ...tiles.filter(
        (tile) => !selected.some((ancestor) => containsTile(ancestor, tile)),
      ),
      ...selected,
    ];
  }
}
/** Whole sibling replacement: never expose three children over their parent. */
export function selectFarCoverage(
  plan: FarSelectionPlan,
  drawable: (node: FarSelectionNode) => boolean,
): FarCoverage {
  const visit = (node: FarSelectionNode): FarCoverage => {
    if (node.children.length) {
      const children = node.children.map(visit);
      if (children.every((child) => child.covered))
        return {
          tiles: children.flatMap((child) => child.tiles),
          covered: true,
          atTarget: children.every((child) => child.atTarget),
          balanced: true,
        };
    }
    return drawable(node)
      ? {
          tiles: [node],
          covered: true,
          atTarget: node.children.length === 0,
          balanced: true,
        }
      : { tiles: [], covered: false, atTarget: false, balanced: true };
  };
  const roots = plan.roots.map(visit);
  const balanced = balancePreparedCut(
    roots.flatMap((root) => root.tiles),
    plan,
    drawable,
  );
  const targetKeys = new Set(plan.leaves.map((node) => node.key));
  return {
    ...balanced,
    covered: roots.every((root) => root.covered),
    atTarget:
      balanced.balanced &&
      roots.every((root) => root.atTarget) &&
      balanced.tiles.every((node) => targetKeys.has(node.key)),
  };
}
/** Bits -X,+X,-Z,+Z. Same-level neighbors suppress their entire shared edge. */
export function farSkirtMask(
  node: FarSelectionNode,
  cut: readonly FarSelectionNode[],
): number {
  let mask = 15;
  for (const neighbor of cut) {
    if (neighbor.address.lod !== node.address.lod) continue;
    const dx = neighbor.address.tx - node.address.tx;
    const dz = neighbor.address.tz - node.address.tz;
    if (dz === 0 && dx === -1) mask &= ~1;
    if (dz === 0 && dx === 1) mask &= ~2;
    if (dx === 0 && dz === -1) mask &= ~4;
    if (dx === 0 && dz === 1) mask &= ~8;
  }
  return mask;
}

export interface NearCoverageColumn extends FarBounds {
  readonly ready: boolean;
  readonly drawn: boolean;
}
/** Never substitute a nominal near radius for actual near draw coverage. */
export function nearColumnCoversFar(
  x: number,
  z: number,
  columns: readonly NearCoverageColumn[],
): boolean {
  return columns.some(
    (column) =>
      column.ready &&
      column.drawn &&
      x >= column.minX &&
      x < column.maxX &&
      z >= column.minZ &&
      z < column.maxZ,
  );
}
