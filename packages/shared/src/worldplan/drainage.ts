/**
 * Original implementation derived from Barnes, Lehman & Mulla, Priority-Flood,
 * Computers & Geosciences62(2014), algorithms1 and4, https://arxiv.org/abs/1511.04463.
 * No reference-repository or RichDEM code was read/copied. Two passes deliberately
 * retain both the spill surface and flow directions based on the original DEM.
 * Our secondary heap key is cell index, as required by docs04 section5.4.
 */
export interface DrainageOutlets {
  readonly cells: Uint32Array;
  readonly levels: Float64Array;
}
export interface DrainageResult {
  readonly routingHeight: Float64Array;
  readonly receivers: Int32Array;
  /** FlowDirs pop order; every receiver precedes its child. */
  readonly routingOrder: Uint32Array;
  readonly drainageArea: Float64Array;
}
interface Heap {
  readonly cells: Uint32Array;
  readonly priorities: Float64Array;
  size: number;
}
function before(a: number, b: number, priorities: Float64Array): boolean {
  const av = Number(priorities[a]);
  const bv = Number(priorities[b]);
  return av < bv || (av === bv && a < b);
}
function push(heap: Heap, cell: number): void {
  let at = heap.size++;
  while (at > 0) {
    const parent = Math.floor((at - 1) / 2);
    const previous = Number(heap.cells[parent]);
    if (!before(cell, previous, heap.priorities)) break;
    heap.cells[at] = previous;
    at = parent;
  }
  heap.cells[at] = cell;
}
function pop(heap: Heap): number {
  const result = Number(heap.cells[0]);
  heap.size--;
  if (heap.size === 0) return result;
  const last = Number(heap.cells[heap.size]);
  let at = 0;
  while (2 * at + 1 < heap.size) {
    let child = 2 * at + 1;
    if (
      child + 1 < heap.size &&
      before(
        Number(heap.cells[child + 1]),
        Number(heap.cells[child]),
        heap.priorities,
      )
    )
      child++;
    if (!before(Number(heap.cells[child]), last, heap.priorities)) break;
    heap.cells[at] = Number(heap.cells[child]);
    at = child;
  }
  heap.cells[at] = last;
  return result;
}
// Cardinal neighbours precede diagonals, matching the FlowDirs paper's rule.
const DX = new Int8Array([-1, 1, 0, 0, -1, 1, -1, 1]);
const DZ = new Int8Array([0, 0, -1, 1, -1, -1, 1, 1]);
/**
 * Drain a vertex DEM with optional interior water outlets. Terrain is never
 * modified. Edge vertices are outlets and own half/quarter contributing area.
 * Progress is completed pop operations out of2*N, independent of wall time.
 */
export function buildDrainage(
  terrain: Float64Array,
  width: number,
  depth: number,
  spacing: number,
  outlets?: DrainageOutlets,
  progress?: (completed: number, total: number) => void,
): DrainageResult {
  const count = width * depth;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(depth) ||
    width < 2 ||
    depth < 2 ||
    terrain.length !== count ||
    !(spacing > 0) ||
    !Number.isFinite(spacing)
  )
    throw new RangeError("Invalid drainage grid");
  for (const h of terrain)
    if (!Number.isFinite(h))
      throw new RangeError("Drainage elevations must be finite");
  if (outlets && outlets.cells.length !== outlets.levels.length)
    throw new RangeError("Outlet arrays must have equal length");
  const routingHeight = terrain.slice();
  const originalPriority = terrain.slice();
  const receivers = new Int32Array(count);
  receivers.fill(-2);
  const routingOrder = new Uint32Array(count);
  const seen = new Uint8Array(count);
  const heap: Heap = {
    cells: new Uint32Array(count),
    priorities: routingHeight,
    size: 0,
  };
  const runPass = (fill: boolean): void => {
    const priorities = fill ? routingHeight : originalPriority;
    const active: Heap = { cells: heap.cells, priorities, size: 0 };
    seen.fill(0);
    const addOutlet = (index: number, level: number): void => {
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= count ||
        !Number.isFinite(level)
      )
        throw new RangeError("Invalid drainage outlet");
      if (seen[index]) return;
      priorities[index] = Math.max(Number(terrain[index]), level);
      seen[index] = 1;
      if (!fill) receivers[index] = -1;
      push(active, index);
    };
    for (let z = 0; z < depth; z++)
      for (let x = 0; x < width; x++)
        if (x === 0 || z === 0 || x === width - 1 || z === depth - 1) {
          const index = x + z * width;
          addOutlet(index, Number(terrain[index]));
        }
    if (outlets)
      for (let i = 0; i < outlets.cells.length; i++)
        addOutlet(Number(outlets.cells[i]), Number(outlets.levels[i]));
    let processed = 0;
    while (active.size > 0) {
      const cell = pop(active);
      if (!fill) routingOrder[processed] = cell;
      processed++;
      const x = cell % width;
      const z = Math.floor(cell / width);
      for (let n = 0; n < 8; n++) {
        const nx = x + Number(DX[n]);
        const nz = z + Number(DZ[n]);
        if (nx < 0 || nx >= width || nz < 0 || nz >= depth) continue;
        const neighbour = nx + nz * width;
        if (seen[neighbour]) continue;
        seen[neighbour] = 1;
        if (fill)
          routingHeight[neighbour] = Math.max(
            Number(terrain[neighbour]),
            Number(routingHeight[cell]),
          );
        else receivers[neighbour] = cell;
        push(active, neighbour);
      }
      if (processed % 4096 === 0 || processed === count)
        progress?.((fill ? 0 : count) + processed, 2 * count);
    }
    if (processed !== count)
      throw new Error("Drainage did not cover every grid vertex");
  };
  runPass(true);
  runPass(false);
  const drainageArea = new Float64Array(count);
  for (let z = 0; z < depth; z++)
    for (let x = 0; x < width; x++)
      drainageArea[x + z * width] =
        spacing *
        spacing *
        (x === 0 || x === width - 1 ? 0.5 : 1) *
        (z === 0 || z === depth - 1 ? 0.5 : 1);
  for (let i = count - 1; i >= 0; i--) {
    const cell = Number(routingOrder[i]);
    const receiver = Number(receivers[cell]);
    if (receiver >= 0)
      drainageArea[receiver] =
        Number(drainageArea[receiver]) + Number(drainageArea[cell]);
  }
  return { routingHeight, receivers, routingOrder, drainageArea };
}
