import {
  WORLD_MAX_XZ,
  WORLD_MAX_Y,
  WORLD_MIN_XZ,
  WORLD_MIN_Y,
} from "../world/constants.js";
import { REGION_IDS } from "../world/regions.js";
import type {
  IbaraPlanData,
  WorldPlan,
  WorldPlanData,
  XZBounds,
} from "../world/types.js";
import { createMainField } from "../worldgen/main/surface.js";
import { WORLDGEN_VERSION } from "../worldgen/version.js";
import {
  createGeometryWorkspace,
  footprint,
  layerWeights,
  surfaceWeights,
} from "./geometry.js";
import { canonicalPlanGrid, sampleGrid } from "./grid.js";

function finiteBounds(bounds: XZBounds): boolean {
  return (
    !!bounds &&
    [bounds.minX, bounds.minZ, bounds.maxX, bounds.maxZ].every(
      Number.isFinite,
    ) &&
    bounds.minX <= bounds.maxX &&
    bounds.minZ <= bounds.maxZ
  );
}
function withinXZ(outer: XZBounds, inner: XZBounds): boolean {
  return (
    inner.minX >= outer.minX &&
    inner.maxX <= outer.maxX &&
    inner.minZ >= outer.minZ &&
    inner.maxZ <= outer.maxZ
  );
}
// P2 builds <=6 calderas/channels, <=40 vents and <=51 route vertices plus
// each channel's source. At width<=10 and levee<=12, jittered adjacent 64m
// routing vertices occupy <=9 of the lava index's 128m buckets per segment:
// 6*51*9=2754 references. The cap leaves headroom without trusting supplied AABBs.
const MAX_LAVA_INDEX_REFERENCES = 4096;
/** Validate the cloneable local package independently of whole-world generation. */
export function validateIbaraPlanData(data: IbaraPlanData, seed: number): void {
  if (data?.schema !== 1 || data.seed !== seed || !finiteBounds(data.bounds))
    throw new Error("Ibara identity/bounds mismatch");
  if (
    data.bounds.minX >= data.bounds.maxX ||
    data.bounds.minZ >= data.bounds.maxZ ||
    !withinXZ(
      {
        minX: WORLD_MIN_XZ,
        minZ: WORLD_MIN_XZ,
        maxX: WORLD_MAX_XZ,
        maxZ: WORLD_MAX_XZ,
      },
      data.bounds,
    )
  )
    throw new Error("Ibara domain outside supported world");
  if (
    !Array.isArray(data.calderas) ||
    !Array.isArray(data.channels) ||
    !Array.isArray(data.vents)
  )
    throw new Error("Missing Ibara feature tables");
  if (
    data.calderas.length > 6 ||
    data.channels.length > 6 ||
    data.vents.length > 40
  )
    throw new Error("Ibara feature table limit exceeded");
  const ids = new Set<number>();
  const calderas = new Map(data.calderas.map((item) => [item?.id, item]));
  for (const table of [data.calderas, data.channels, data.vents]) {
    let previous = 0;
    for (const item of table) {
      if (
        !item ||
        !Number.isInteger(item.id) ||
        item.id <= previous ||
        item.id > 0x00ffffff ||
        ids.has(item.id)
      )
        throw new Error("Invalid Ibara feature order/identity");
      ids.add(item.id);
      previous = item.id;
      const b = item.bounds;
      if (
        !finiteBounds(b) ||
        !Number.isFinite(b.minY) ||
        !Number.isFinite(b.maxY) ||
        b.minY > b.maxY
      )
        throw new Error("Invalid Ibara feature bounds");
      if (!withinXZ(data.bounds, b))
        throw new Error("Ibara geometry outside local domain");
    }
  }
  const contains = (
    bounds: IbaraPlanData["calderas"][number]["bounds"],
    x: number,
    y: number,
    z: number,
  ): boolean =>
    x >= bounds.minX &&
    x <= bounds.maxX &&
    y >= bounds.minY &&
    y <= bounds.maxY &&
    z >= bounds.minZ &&
    z <= bounds.maxZ;
  for (const c of data.calderas) {
    if (
      ![
        c.x,
        c.z,
        c.radius,
        c.baseY,
        c.floorY,
        c.rimHeight,
        c.rimWidth,
        c.lavaRadius,
        c.lavaLevel,
      ].every(Number.isFinite) ||
      c.radius <= 0 ||
      c.rimHeight <= 0 ||
      c.rimWidth <= 0 ||
      c.lavaRadius <= 0 ||
      c.lavaRadius > c.radius ||
      c.floorY >= c.lavaLevel ||
      c.lavaLevel >= c.baseY ||
      c.id >= 0x10000
    )
      throw new Error("Invalid Ibara caldera geometry");
    const reach = c.radius + c.rimWidth;
    if (
      !contains(c.bounds, c.x - reach, c.floorY, c.z - reach) ||
      !contains(c.bounds, c.x + reach, c.baseY + c.rimHeight, c.z + reach)
    )
      throw new Error("Ibara caldera bounds omit geometry");
  }
  let bucketReferences = 0;
  for (const c of data.channels) {
    const owner = calderas.get(c.calderaId);
    if (
      !owner ||
      c.id < 0x10000 ||
      c.id >= 0x20000 ||
      !(c.points instanceof Float64Array) ||
      c.points.length < 10 ||
      c.points.length > 52 * 5 ||
      c.points.length % 5 !== 0 ||
      !Number.isFinite(c.leveeWidth) ||
      c.leveeWidth <= 0 ||
      c.leveeWidth > 12 ||
      !Number.isFinite(c.leveeHeight) ||
      c.leveeHeight <= 0 ||
      (c.sink !== "basin" && c.sink !== "cooled")
    )
      throw new Error("Invalid Ibara lava channel");
    let level = Infinity;
    for (let i = 0; i < c.points.length; i += 5) {
      const x = Number(c.points[i]),
        z = Number(c.points[i + 1]);
      const bed = Number(c.points[i + 2]),
        next = Number(c.points[i + 3]);
      const width = Number(c.points[i + 4]);
      if (
        ![x, z, bed, next, width].every(Number.isFinite) ||
        width <= 0 ||
        width > 10 ||
        bed >= next ||
        next > level
      )
        throw new Error("Invalid downstream lava geometry/level");
      const padding = width + c.leveeWidth;
      if (
        !contains(c.bounds, x - padding, bed, z - padding) ||
        !contains(c.bounds, x + padding, next + c.leveeHeight, z + padding)
      )
        throw new Error("Ibara channel bounds omit geometry");
      if (
        i === 0 &&
        (x !== owner.x || z !== owner.z || next !== owner.lavaLevel)
      )
        throw new Error("Ibara channel has no connected caldera source");
      // Repeated vertices would introduce a zero-length, ambiguous segment.
      if (i > 0 && x === c.points[i - 5] && z === c.points[i - 4])
        throw new Error("Degenerate Ibara lava segment");
      if (i > 0) {
        // Match createLavaQueries' exact segment padding and bucket arithmetic,
        // but only count its work here. Never allocate a malformed runtime index.
        const pad = Math.max(width, Number(c.points[i - 1])) + c.leveeWidth;
        const segment = {
          minX: Math.min(x, Number(c.points[i - 5])) - pad,
          minZ: Math.min(z, Number(c.points[i - 4])) - pad,
          maxX: Math.max(x, Number(c.points[i - 5])) + pad,
          maxZ: Math.max(z, Number(c.points[i - 4])) + pad,
        };
        if (!withinXZ(c.bounds, segment))
          throw new Error("Ibara channel bounds omit segment");
        const widthInBuckets =
          Math.floor(segment.maxX / 128) - Math.floor(segment.minX / 128) + 1;
        const depthInBuckets =
          Math.floor(segment.maxZ / 128) - Math.floor(segment.minZ / 128) + 1;
        bucketReferences += widthInBuckets * depthInBuckets;
        if (bucketReferences > MAX_LAVA_INDEX_REFERENCES)
          throw new Error("Ibara lava spatial index work limit exceeded");
      }
      level = next;
    }
  }
  for (const v of data.vents) {
    if (
      ![v.x, v.z, v.baseY, v.height, v.radius, v.mouthRadius].every(
        Number.isFinite,
      ) ||
      v.id < 0x20000 ||
      v.id >= 0x30000 ||
      v.height <= 0 ||
      v.radius <= 0 ||
      v.mouthRadius <= 0 ||
      v.mouthRadius >= v.radius
    )
      throw new Error("Invalid Ibara vent geometry");
    if (
      !contains(v.bounds, v.x - v.radius, v.baseY, v.z - v.radius) ||
      !contains(v.bounds, v.x + v.radius, v.baseY + v.height, v.z + v.radius)
    )
      throw new Error("Ibara vent bounds omit geometry");
  }
  const r = data.routing,
    g = r?.grid;
  if (
    g?.spacing !== 64 ||
    !Number.isInteger(g.width) ||
    !Number.isInteger(g.depth) ||
    g.width < 2 ||
    g.depth < 2 ||
    g.width > 705 ||
    g.depth > 705 ||
    g.minX % 64 !== 0 ||
    g.minZ % 64 !== 0 ||
    g.minX !== data.bounds.minX ||
    g.minZ !== data.bounds.minZ ||
    g.minX + (g.width - 1) * 64 !== data.bounds.maxX ||
    g.minZ + (g.depth - 1) * 64 !== data.bounds.maxZ
  )
    throw new Error("Ibara routing grid mismatch");
  const count = g.width * g.depth;
  for (const values of [r.terrain, r.routingHeight, r.drainageArea]) {
    if (!(values instanceof Float64Array) || values.length !== count)
      throw new Error("Ibara Float64 layout mismatch");
    for (const value of values)
      if (!Number.isFinite(value))
        throw new Error("Nonfinite Ibara routing field");
  }
  if (
    !(r.receivers instanceof Int32Array) ||
    !(r.routingOrder instanceof Uint32Array) ||
    !(r.sourceCalderaIds instanceof Uint32Array) ||
    r.receivers.length !== count ||
    r.routingOrder.length !== count ||
    r.sourceCalderaIds.length !== count
  )
    throw new Error("Ibara integer layout mismatch");
  const seen = new Uint8Array(count);
  const sources = new Set<number>();
  for (const cell of r.routingOrder) {
    if (cell >= count || seen[cell])
      throw new Error("Ibara routing order is not a permutation");
    const receiver = Number(r.receivers[cell]);
    if (
      receiver < -1 ||
      receiver >= count ||
      (receiver >= 0 && !seen[receiver])
    )
      throw new Error("Ibara receiver does not precede its child");
    if (
      Number(r.routingHeight[cell]) < Number(r.terrain[cell]) ||
      Number(r.drainageArea[cell]) < 0 ||
      (receiver >= 0 &&
        Number(r.routingHeight[receiver]) > Number(r.routingHeight[cell]))
    )
      throw new Error("Invalid Ibara drainage height/area");
    seen[cell] = 1;
    const source = Number(r.sourceCalderaIds[cell]);
    if (source) {
      const owner = calderas.get(source);
      if (!owner || sources.has(source))
        throw new Error("Unknown/duplicate Ibara source owner");
      const sourceX = Math.round((owner.x - g.minX) / 64);
      const sourceZ = Math.round((owner.z - g.minZ) / 64);
      if (
        sourceX < 0 ||
        sourceX >= g.width ||
        sourceZ < 0 ||
        sourceZ >= g.depth
      )
        throw new Error("Ibara source outside routing grid");
      const expected = sourceX + g.width * sourceZ;
      if (cell !== expected) throw new Error("Misplaced Ibara source owner");
      sources.add(source);
    }
  }
  if (sources.size !== data.calderas.length)
    throw new Error("Missing Ibara caldera routing source");
}
/** Validate clone/cache input before any sampler is exposed. No mutated/corrupt plan fallback. */
export function validateWorldPlanData(data: WorldPlanData): void {
  if (
    data?.schema !== 2 ||
    data.worldgenVersion !== WORLDGEN_VERSION ||
    !Number.isInteger(data.seed) ||
    data.seed < -2147483648 ||
    data.seed > 4294967295
  )
    throw new Error("WorldPlan identity/schema mismatch");
  validateIbaraPlanData(data.ibara, data.seed);
  const expected = canonicalPlanGrid();
  const grid = data.grid;
  if (
    !grid ||
    grid.minX !== expected.minX ||
    grid.minZ !== expected.minZ ||
    grid.width !== expected.width ||
    grid.depth !== expected.depth ||
    grid.spacing !== 64
  )
    throw new Error("WorldPlan grid mismatch");
  const count = grid.width * grid.depth;
  for (const values of [
    data.terrainMacro,
    data.routingHeight,
    data.drainageArea,
  ]) {
    if (!(values instanceof Float64Array) || values.length !== count)
      throw new Error("WorldPlan Float64 layout mismatch");
    for (const value of values)
      if (!Number.isFinite(value)) throw new Error("Nonfinite WorldPlan field");
  }
  if (
    !(data.receivers instanceof Int32Array) ||
    !(data.routingOrder instanceof Uint32Array) ||
    !(data.basinIds instanceof Uint32Array) ||
    data.receivers.length !== count ||
    data.routingOrder.length !== count ||
    data.basinIds.length !== count
  )
    throw new Error("WorldPlan integer layout mismatch");
  const seen = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const cell = Number(data.routingOrder[i]);
    if (cell >= count || seen[cell])
      throw new Error("Routing order is not a permutation");
    const receiver = Number(data.receivers[cell]);
    if (
      receiver < -1 ||
      receiver >= count ||
      (receiver >= 0 && !seen[receiver])
    )
      throw new Error("Receiver does not precede its child");
    seen[cell] = 1;
    if (
      Number(data.routingHeight[cell]) < Number(data.terrainMacro[cell]) ||
      Number(data.drainageArea[cell]) < 0
    )
      throw new Error("Invalid drainage height/area");
  }
  if (!Array.isArray(data.waterBodies))
    throw new Error("Missing body ownership table");
  for (let i = 0; i < data.waterBodies.length; i++) {
    const body = data.waterBodies[i];
    if (
      !body ||
      body.id !== i + 1 ||
      body.kind !== "water" ||
      !Number.isFinite(body.level) ||
      body.level < WORLD_MIN_Y ||
      body.level >= WORLD_MAX_Y
    )
      throw new Error("Invalid water body");
  }
  for (const id of data.basinIds)
    if (id > data.waterBodies.length)
      throw new Error("Unknown water-body owner");
  if (
    !Array.isArray(data.undergroundCells) ||
    data.undergroundCells.length !== 17
  )
    throw new Error("Missing underground layout");
  for (const cell of data.undergroundCells)
    if (
      !Number.isFinite(cell.x) ||
      !Number.isFinite(cell.z) ||
      REGION_IDS.indexOf(cell.region) < 16
    )
      throw new Error("Invalid underground cell");
  if (
    data.sites?.seats.length !== 30 ||
    data.sites.forts.length !== 106 ||
    data.sites.bridges.length !== 3 ||
    data.sites.spawns.length !== 256
  )
    throw new Error("WorldPlan site roster incomplete");
  for (const site of [
    ...data.sites.seats,
    ...data.sites.forts,
    ...data.sites.descents,
    ...data.sites.spawns,
  ])
    if (!Number.isFinite(site.x) || !Number.isFinite(site.z))
      throw new Error("Nonfinite site position");
  for (const bridge of data.sites.bridges)
    if (
      !(bridge.centreline instanceof Float64Array) ||
      bridge.centreline.length < 4 ||
      bridge.centreline.length % 2 ||
      !(bridge.gaps instanceof Float64Array) ||
      bridge.gaps.length < 2 ||
      bridge.gaps.length > 6 ||
      bridge.gaps.length % 2 ||
      !(bridge.halfWidth > 0)
    )
      throw new Error("Invalid bridge descriptor");
}
export function hydrateWorldPlan(data: WorldPlanData): WorldPlan {
  validateWorldPlanData(data);
  const workspace = createGeometryWorkspace();
  const field = createMainField(data, data.sites.bridges, data.ibara);
  return Object.freeze({
    data,
    seed: data.seed,
    worldgenVersion: data.worldgenVersion,
    sites: data.sites,
    surfaceWeights: (x, z, out) =>
      surfaceWeights(data.seed, x, z, out, workspace),
    layerWeights: (layer, x, z, out) =>
      layerWeights(
        data.seed,
        data.undergroundCells,
        layer,
        x,
        z,
        out,
        workspace,
      ),
    footprint: (layer, x, z) => footprint(data.seed, layer, x, z, workspace),
    macroHeight: (x, z) => sampleGrid(data.grid, data.terrainMacro, x, z),
    waterQuery: (x, z, out) => field.waterQuery(x, z, out),
  } satisfies WorldPlan);
}
