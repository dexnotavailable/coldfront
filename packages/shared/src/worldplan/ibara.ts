import { hash3, hash4, rand01 } from "../math/hash.js";
import type {
  IbaraCalderaData,
  IbaraLavaChannelData,
  IbaraPlanData,
  IbaraRoutingData,
  IbaraVentData,
  WorldBounds,
  WorldPlanData,
  XZBounds,
} from "../world/types.js";
import { createIbaraGround } from "../worldgen/main/ibara-ground.js";
import {
  calderaHeight,
  createIbaraAnalytic,
  IBARA_SUPPORT,
  type PlainSample,
  safelyInsideIbara,
} from "../worldgen/main/ibara-volcanic.js";
import type { MainField } from "../worldgen/main/surface.js";
import { buildDrainage } from "./drainage.js";

/** Coordinates of the local drainage graph, with independent +/-24 m jitter.
 * Boundary nodes stay on the domain boundary. The regular array is topology,
 * not a DEM to be interpolated into render heights. */
export function ibaraRoutingPoint(
  seed: number,
  grid: IbaraRoutingData["grid"],
  cell: number,
  out: Float64Array,
): Float64Array {
  const x = cell % grid.width;
  const z = Math.floor(cell / grid.width);
  out[0] =
    grid.minX +
    x * 64 +
    (x === 0 || x === grid.width - 1
      ? 0
      : 48 * (rand01(hash4(seed ^ 0x14a734, x, z, 0)) - 0.5));
  out[1] =
    grid.minZ +
    z * 64 +
    (z === 0 || z === grid.depth - 1
      ? 0
      : 48 * (rand01(hash4(seed ^ 0x14a734, x, z, 1)) - 0.5));
  return out;
}
function boundsRecord(): WorldBounds {
  return { minSurfaceY: 0, maxSurfaceY: 0, maxSolidY: 0, maxFluidY: -Infinity };
}
/** Pure data builder. Its field MUST be the pre-Ibara field. No global array is
 * borrowed as scratch, and no routing spill heights are used as rendered ground. */
export function buildIbaraPlan(
  basePlan: Pick<WorldPlanData, "seed" | "grid">,
  baseField: MainField,
): IbaraPlanData {
  const seed = basePlan.seed;
  if (baseField.data.seed !== seed)
    throw new Error("Ibara field/plan seed mismatch");
  const analytic = createIbaraAnalytic(seed);
  const plain: PlainSample = { offset: 0, tag: "base", weight: 0 };
  const grid = basePlan.grid;
  // Interval bounds on the sector/ring blend and bounded warp, never a sparse
  // mask scan that could miss a supported pocket between sample positions.
  const bounds: XZBounds = {
    minX: Math.max(grid.minX, IBARA_SUPPORT.minX),
    minZ: Math.max(grid.minZ, IBARA_SUPPORT.minZ),
    maxX: Math.min(grid.minX + (grid.width - 1) * 64, IBARA_SUPPORT.maxX),
    maxZ: Math.min(grid.minZ + (grid.depth - 1) * 64, IBARA_SUPPORT.maxZ),
  };
  if (bounds.minX >= bounds.maxX || bounds.minZ >= bounds.maxZ)
    throw new Error("WorldPlan has no Ibara routing domain");
  const candidates: { x: number; z: number; key: number }[] = [];
  for (
    let z = Math.ceil(bounds.minZ / 512);
    z <= Math.floor(bounds.maxZ / 512);
    z++
  ) {
    for (
      let x = Math.ceil(bounds.minX / 512);
      x <= Math.floor(bounds.maxX / 512);
      x++
    ) {
      const wx = x * 512 + 256 * (rand01(hash4(seed, x, z, 191)) - 0.5);
      const wz = z * 512 + 256 * (rand01(hash4(seed, x, z, 193)) - 0.5);
      if (
        safelyInsideIbara(wx, wz, 640) &&
        wx > bounds.minX + 600 &&
        wx < bounds.maxX - 600 &&
        wz > bounds.minZ + 600 &&
        wz < bounds.maxZ - 600
      )
        candidates.push({ x: wx, z: wz, key: hash4(seed, x, z, 197) });
    }
  }
  candidates.sort((a, b) => a.key - b.key || a.x - b.x || a.z - b.z);
  const count = 3 + (hash3(seed, 137, 911) % 4);
  const calderas: IbaraCalderaData[] = [];
  for (const candidate of candidates) {
    const id = calderas.length + 1;
    const radius = 150 + 300 * rand01(hash4(seed, id, 811, 1));
    const rimWidth = 32 + radius * 0.24;
    const reach = radius + rimWidth;
    if (
      calderas.some((c) => {
        const dx = candidate.x - c.x;
        const dz = candidate.z - c.z;
        const separation = reach + c.radius + c.rimWidth + 280;
        return dx * dx + dz * dz < separation * separation;
      })
    )
      continue;
    const baseY =
      baseField.height(candidate.x, candidate.z) +
      analytic.plain(candidate.x, candidate.z, plain).offset;
    const rimHeight = 40 + 80 * rand01(hash4(seed, id, 811, 2));
    const floorY = baseY - 18 - 24 * rand01(hash4(seed, id, 811, 3));
    const lavaLevel = baseY - 4 - 5 * rand01(hash4(seed, id, 811, 4));
    calderas.push({
      id,
      x: candidate.x,
      z: candidate.z,
      radius,
      rimWidth,
      baseY,
      floorY,
      rimHeight,
      lavaRadius: radius * (0.48 + 0.12 * rand01(hash4(seed, id, 811, 5))),
      lavaLevel,
      bounds: {
        minX: candidate.x - reach,
        maxX: candidate.x + reach,
        minZ: candidate.z - reach,
        maxZ: candidate.z + reach,
        minY: floorY,
        maxY: baseY + rimHeight,
      },
    });
    if (calderas.length === count) break;
  }
  if (calderas.length !== count)
    throw new Error("Ibara domain cannot fit its required calderas");
  const localGrid = {
    minX: bounds.minX,
    minZ: bounds.minZ,
    spacing: 64 as const,
    width: Math.round((bounds.maxX - bounds.minX) / 64) + 1,
    depth: Math.round((bounds.maxZ - bounds.minZ) / 64) + 1,
  };
  const n = localGrid.width * localGrid.depth;
  const terrain = new Float64Array(n);
  const position = new Float64Array(2);
  for (let i = 0; i < n; i++) {
    ibaraRoutingPoint(seed, localGrid, i, position);
    const x = Number(position[0]);
    const z = Number(position[1]);
    let h = baseField.height(x, z) + analytic.plain(x, z, plain).offset;
    for (const c of calderas) h = calderaHeight(c, x, z, h);
    // Sub-grid cracks and vents do not divert the 64 m drainage topology.
    terrain[i] = h;
  }
  const drainage = buildDrainage(terrain, localGrid.width, localGrid.depth, 64);
  const sourceCalderaIds = new Uint32Array(n);
  const routes: number[][] = [];
  const active = new Uint8Array(n);
  const levels = new Float64Array(n).fill(Infinity);
  for (const c of calderas) {
    const source =
      Math.round((c.x - localGrid.minX) / 64) +
      localGrid.width * Math.round((c.z - localGrid.minZ) / 64);
    sourceCalderaIds[source] = c.id;
    levels[source] = c.lavaLevel;
    const path: number[] = [];
    let cell = source;
    const limit = 28 + (hash3(seed, c.id, 71) % 24);
    while (cell >= 0 && path.length < limit) {
      ibaraRoutingPoint(seed, localGrid, cell, position);
      const x = Number(position[0]);
      const z = Number(position[1]);
      if (
        path.length > 1 &&
        (!safelyInsideIbara(x, z, 48) ||
          x <= bounds.minX + 64 ||
          x >= bounds.maxX - 64 ||
          z <= bounds.minZ + 64 ||
          z >= bounds.maxZ - 64)
      )
        break;
      path.push(cell);
      active[cell] = 1;
      cell = Number(drainage.receivers[cell]);
    }
    if (path.length < 2)
      throw new Error("Caldera has no descending route to a closed sink");
    routes.push(path);
  }
  // A fixed upstream-first reduction makes shared receiver vertices agree.
  // Inside a source bowl/rim keep its head until the outlet notch has escaped;
  // afterwards lava only descends. Priority-Flood spill heights are NOT levels.
  for (let order = n - 1; order >= 0; order--) {
    const cell = Number(drainage.routingOrder[order]);
    if (!active[cell]) continue;
    ibaraRoutingPoint(seed, localGrid, cell, position);
    const x = Number(position[0]);
    const z = Number(position[1]);
    let limit = Number(terrain[cell]) - 1.5;
    for (const c of calderas) {
      const dx = x - c.x;
      const dz = z - c.z;
      const r = c.radius + c.rimWidth + 64;
      if (dx * dx + dz * dz < r * r) limit = c.lavaLevel;
    }
    levels[cell] = Math.min(Number(levels[cell]), limit);
    const receiver = Number(drainage.receivers[cell]);
    if (receiver >= 0 && active[receiver])
      levels[receiver] = Math.min(
        Number(levels[receiver]),
        Number(levels[cell]),
      );
  }
  const channels: IbaraLavaChannelData[] = [];
  for (let k = 0; k < calderas.length; k++) {
    const c = calderas[k] as IbaraCalderaData;
    const route = routes[k] as number[];
    const points = new Float64Array((route.length + 1) * 5);
    const width = Math.min(
      10,
      2 +
        Math.sqrt(
          Number(drainage.drainageArea[Number(route[route.length - 1])]),
        ) /
          220,
    );
    points.set([c.x, c.z, c.lavaLevel - 5, c.lavaLevel, width]);
    let low = c.lavaLevel - 5;
    let high = c.lavaLevel;
    let ax = c.x;
    let az = c.z;
    let bx = c.x;
    let bz = c.z;
    for (let i = 0; i < route.length; i++) {
      const cell = Number(route[i]);
      ibaraRoutingPoint(seed, localGrid, cell, position);
      const x = Number(position[0]);
      const z = Number(position[1]);
      const level = Number(levels[cell]);
      const bed = level - 3 - 4 * rand01(hash3(seed ^ 0x624a11, cell, 81));
      points.set([x, z, bed, level, width], (i + 1) * 5);
      ax = Math.min(ax, x);
      az = Math.min(az, z);
      bx = Math.max(bx, x);
      bz = Math.max(bz, z);
      low = Math.min(low, bed);
      high = Math.max(high, level);
    }
    const leveeWidth = 6 + 6 * rand01(hash3(seed, c.id, 83));
    const leveeHeight = 1.5 + 2.5 * rand01(hash3(seed, c.id, 89));
    const padding = width + leveeWidth;
    const channelBounds = {
      minX: ax - padding,
      minZ: az - padding,
      maxX: bx + padding,
      maxZ: bz + padding,
    };
    const baseBounds = baseField.surfaceBounds(channelBounds, boundsRecord());
    channels.push({
      id: 0x10000 + c.id,
      calderaId: c.id,
      points,
      leveeWidth,
      leveeHeight,
      sink: "cooled",
      bounds: {
        ...channelBounds,
        minY: Math.min(low, baseBounds.minSurfaceY - 10),
        maxY: Math.max(
          high + leveeHeight,
          baseBounds.maxSurfaceY + 4,
          ...calderas
            .filter(
              (item) =>
                item.bounds.minX <= channelBounds.maxX &&
                item.bounds.maxX >= channelBounds.minX &&
                item.bounds.minZ <= channelBounds.maxZ &&
                item.bounds.maxZ >= channelBounds.minZ,
            )
            .map((item) => item.bounds.maxY),
        ),
      },
    });
  }
  const routing: IbaraRoutingData = {
    grid: localGrid,
    terrain,
    ...drainage,
    sourceCalderaIds,
  };
  const partial: IbaraPlanData = {
    schema: 1,
    seed,
    bounds,
    calderas,
    channels,
    vents: [],
    routing,
  };
  const preVent = createIbaraGround(baseField, partial);
  const vents: IbaraVentData[] = [];
  const targetVents = 24 + (hash3(seed, 877, 7) % 17);
  for (const p of candidates) {
    const radius = 5 + 8 * rand01(hash3(p.key, 8, 1));
    if (
      calderas.some((c) => {
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        return (
          dx * dx + dz * dz <
          (c.radius + c.rimWidth + 60) * (c.radius + c.rimWidth + 60)
        );
      }) ||
      channels.some(
        (c) =>
          p.x + radius >= c.bounds.minX &&
          p.x - radius <= c.bounds.maxX &&
          p.z + radius >= c.bounds.minZ &&
          p.z - radius <= c.bounds.maxZ,
      )
    )
      continue;
    // A vent's footprint replaces tiny analytic cracks. Use the crack-free
    // plain as its foundation; the final analytic query excludes its bounds.
    const baseY =
      baseField.height(p.x, p.z) + analytic.plain(p.x, p.z, plain).offset;
    const height = 3 + 7 * rand01(hash3(p.key, 8, 2));
    const finalBase = Math.max(baseY, preVent.height(p.x, p.z));
    const area = {
      minX: p.x - radius,
      minZ: p.z - radius,
      maxX: p.x + radius,
      maxZ: p.z + radius,
    };
    const baseBounds = baseField.surfaceBounds(area, boundsRecord());
    vents.push({
      id: 0x20000 + vents.length + 1,
      x: p.x,
      z: p.z,
      baseY: finalBase,
      height,
      radius,
      mouthRadius: radius * 0.18,
      bounds: {
        ...area,
        minY: Math.min(finalBase, baseBounds.minSurfaceY),
        maxY: Math.max(finalBase + height, baseBounds.maxSurfaceY + 4),
      },
    });
    if (vents.length === targetVents) break;
  }
  return { ...partial, vents };
}
