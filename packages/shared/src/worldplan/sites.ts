import { detSinCos } from "../math/det.js";
import { hash3, hash4, rand01 } from "../math/hash.js";
import { REGION_IDS, Region } from "../world/regions.js";
import type {
  BridgeSite,
  DescentSite,
  FortSite,
  LayerId,
  RegionId,
  SeatSite,
  SpawnSite,
  SurfaceRegionId,
  UndergroundCell,
  UndergroundLayer,
  WorldSites,
} from "../world/types.js";
import { MAIN_TREE_CELL, mainTreeInCell } from "../worldgen/main/features.js";
import { MainColumn, type MainField } from "../worldgen/main/surface.js";
import type { TreeFeature } from "../worldgen/test-world.js";
import {
  createGeometryWorkspace,
  createRegionWeights,
  footprint,
  layerRadii,
  layerWeights,
  SURFACE_WARP_MAX_DISTANCE,
  surfaceInteriorDistance,
  surfaceWeights,
  undergroundLayerForIndex,
} from "./geometry.js";
import type { GeographyData } from "./grid.js";

const SEAT_REGIONS = new Uint8Array([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 17, 18, 19, 20, 21, 22, 23, 24,
  25, 26, 27, 28, 29, 30, 31, 32,
]);
export function generalsForRegion(region: number): number {
  return region < 8 || (region >= 16 && region < 24)
    ? 3
    : region === Region.Nadir
      ? 6
      : 4;
}
function regionLayer(region: number): LayerId {
  return region < 16 ? "surface" : undergroundLayerForIndex(region);
}
function squaredDistance(
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const x = ax - bx;
  const z = az - bz;
  return x * x + z * z;
}
interface DescentRule {
  readonly type: string;
  readonly from: number;
  readonly to: readonly number[];
  readonly generic: boolean;
  readonly exempt: boolean;
}
export const DESCENT_RULES: readonly DescentRule[] = Object.freeze([
  { type: "cenote", from: 5, to: [21], generic: true, exempt: false },
  { type: "bog_hole", from: 6, to: [22], generic: true, exempt: false },
  { type: "lake_trench", from: 7, to: [23], generic: true, exempt: false },
  { type: "mine_mouth", from: 2, to: [17], generic: true, exempt: false },
  { type: "surface_crevasse", from: 1, to: [16], generic: true, exempt: false },
  { type: "lava_tube", from: 9, to: [19], generic: true, exempt: false },
  { type: "geode_breach", from: 10, to: [18], generic: true, exempt: false },
  { type: "boneyard_pit", from: 4, to: [20], generic: true, exempt: false },
  { type: "delvers_road", from: 17, to: [25], generic: false, exempt: false },
  { type: "frost_crevasse", from: 16, to: [24], generic: true, exempt: false },
  { type: "crystal_pipe", from: 18, to: [26], generic: true, exempt: false },
  { type: "magma_tube", from: 19, to: [27], generic: true, exempt: false },
  { type: "root_shaft", from: 21, to: [27], generic: true, exempt: false },
  { type: "drowned_falls", from: 23, to: [28], generic: true, exempt: false },
  { type: "sundering", from: 11, to: [28], generic: false, exempt: true },
  {
    type: "great_shear",
    from: 27,
    to: [29, 30, 31],
    generic: false,
    exempt: true,
  },
  { type: "leyfall", from: 26, to: [30], generic: false, exempt: false },
  { type: "deep_lift", from: 25, to: [29], generic: false, exempt: false },
  { type: "throat", from: 29, to: [32], generic: false, exempt: true },
  { type: "throat", from: 30, to: [32], generic: false, exempt: true },
  { type: "throat", from: 31, to: [32], generic: false, exempt: true },
]);
export function descentCount(seed: number, rule: number): number {
  return (DESCENT_RULES[rule] as DescentRule).generic
    ? 2 + (hash3(seed, rule, 0x47b2) % 3)
    : 1;
}
/** Geometry-only classifiers; no cavern or descent carving is implied by these sites. */
export function createSiteClassifier(
  seed: number,
  cells: readonly UndergroundCell[],
): (region: number, x: number, z: number) => boolean {
  const weights = createRegionWeights();
  const workspace = createGeometryWorkspace();
  return (region, x, z) => {
    if (region < 16) surfaceWeights(seed, x, z, weights, workspace);
    else {
      const layer = undergroundLayerForIndex(region);
      if (footprint(seed, layer, x, z, workspace) < 0.5) return false;
      layerWeights(seed, cells, layer, x, z, weights, workspace);
    }
    return weights.count > 0 && weights.ids[0] === region;
  };
}
function seatsAndForts(
  seed: number,
  geography: GeographyData,
  field: MainField,
  cells: readonly UndergroundCell[],
): {
  seats: SeatSite[];
  forts: FortSite[];
} {
  const seats: SeatSite[] = [];
  const forts: FortSite[] = [];
  const belongs = createSiteClassifier(seed, cells);
  const sc = new Float64Array(2);
  for (const region of SEAT_REGIONS) {
    let centreX: number;
    let centreZ: number;
    let radius: number;
    if (region < 16) {
      centreX = Number(geography.surfaceCentres[2 * region]);
      centreZ = Number(geography.surfaceCentres[2 * region + 1]);
      radius = Math.max(
        0,
        surfaceInteriorDistance(region, centreX, centreZ) -
          SURFACE_WARP_MAX_DISTANCE,
      );
    } else {
      const cell = cells[region - 16] as UndergroundCell;
      centreX = cell.x;
      centreZ = cell.z;
      const r = Math.sqrt(centreX * centreX + centreZ * centreZ);
      const [inner, outer] = layerRadii(cell.layer);
      radius = Math.min(
        inner === 0 ? Infinity : r - inner - 600,
        outer - r - 600,
      );
      for (const other of cells)
        if (other !== cell && other.layer === cell.layer)
          radius = Math.min(
            radius,
            Math.sqrt(squaredDistance(cell.x, cell.z, other.x, other.z)) / 2 -
              700,
          );
    }
    let x = centreX;
    let z = centreZ;
    let score = -Infinity;
    if (region === Region.Nadir || region === Region.Throne) {
      x = 0;
      z = 0;
    } else {
      if (!(radius > 0))
        throw new Error(
          `No conservative Seat radius for ${REGION_IDS[region]}`,
        );
      for (let candidate = 0; candidate < 384; candidate++) {
        const distance =
          0.4 * radius * Math.sqrt(rand01(hash4(seed, region, candidate, 1)));
        detSinCos(2 * Math.PI * rand01(hash4(seed, region, candidate, 2)), sc);
        const px = centreX + distance * Number(sc[0]);
        const pz = centreZ + distance * Number(sc[1]);
        if (!belongs(region, px, pz)) continue;
        // Phase1.2 uses actual surface uplift extremity, also for deep XZ markers;
        // it does not invent a cavern floor which has not been implemented.
        const elevation = field.height(px, pz);
        const candidateScore = Math.abs(
          elevation - field.height(centreX, centreZ),
        );
        if (candidateScore > score) {
          score = candidateScore;
          x = px;
          z = pz;
        }
      }
      if (!Number.isFinite(score))
        throw new Error(`No Seat inside ${REGION_IDS[region]}`);
    }
    if (!belongs(region, x, z))
      throw new Error(`Seat region mismatch: ${REGION_IDS[region]}`);
    const seat: SeatSite = Object.freeze({
      id: `seat-${REGION_IDS[region]}`,
      region: REGION_IDS[region] as RegionId,
      layer: regionLayer(region),
      x,
      z,
    });
    seats.push(seat);
    const count = generalsForRegion(region);
    const selected: FortSite[] = [];
    for (
      let candidate = 0;
      candidate < 2048 && selected.length < count;
      candidate++
    ) {
      const distance = 800 + 700 * rand01(hash4(seed, region, candidate, 3));
      detSinCos(2 * Math.PI * rand01(hash4(seed, region, candidate, 4)), sc);
      const px = x + distance * Number(sc[0]);
      const pz = z + distance * Number(sc[1]);
      if (
        !belongs(region, px, pz) ||
        selected.some(
          (site) => squaredDistance(px, pz, site.x, site.z) < 200 * 200,
        )
      )
        continue;
      selected.push(
        Object.freeze({
          id: `fort-${REGION_IDS[region]}-${selected.length + 1}`,
          seatId: seat.id,
          region: seat.region,
          layer: seat.layer,
          x: px,
          z: pz,
        }),
      );
    }
    if (selected.length !== count)
      throw new Error(`Missing general forts for ${seat.region}`);
    forts.push(...selected);
  }
  return { seats, forts };
}
function descentSites(
  seed: number,
  cells: readonly UndergroundCell[],
  seats: readonly SeatSite[],
): DescentSite[] {
  interface Candidate {
    readonly x: number;
    readonly z: number;
    readonly regions: Int16Array;
    readonly clear: boolean;
    readonly priority: number;
  }
  const candidates: Candidate[] = [];
  const weights = createRegionWeights();
  const workspace = createGeometryWorkspace();
  const layers: readonly UndergroundLayer[] = [
    "upper_deep",
    "undercrown",
    "maw",
    "pit",
  ];
  for (let z = -21000; z <= 21000; z += 256)
    for (let x = -21000; x <= 21000; x += 256) {
      if (x * x + z * z > 21500 * 21500) continue;
      const regions = new Int16Array(5).fill(-1);
      surfaceWeights(seed, x, z, weights, workspace);
      regions[0] = Number(weights.ids[0]);
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i] as UndergroundLayer;
        if (footprint(seed, layer, x, z, workspace) < 0.5) continue;
        layerWeights(seed, cells, layer, x, z, weights, workspace);
        if (weights.count) regions[i + 1] = Number(weights.ids[0]);
      }
      const clear = seats.every(
        (seat) => squaredDistance(x, z, seat.x, seat.z) >= 1500 * 1500,
      );
      candidates.push({ x, z, regions, clear, priority: hash3(seed, x, z) });
    }
  const layerIndex = (region: number): number =>
    region < 16 ? 0 : region < 24 ? 1 : region < 29 ? 2 : region < 32 ? 3 : 4;
  const result: DescentSite[] = [];
  for (let ruleIndex = 0; ruleIndex < DESCENT_RULES.length; ruleIndex++) {
    const rule = DESCENT_RULES[ruleIndex] as DescentRule;
    const count = descentCount(seed, ruleIndex);
    const matching = candidates.filter(
      (candidate) =>
        candidate.regions[layerIndex(rule.from)] === rule.from &&
        rule.to.includes(
          Number(candidate.regions[layerIndex(Number(rule.to[0]))]),
        ) &&
        (rule.exempt || candidate.clear),
    );
    matching.sort(
      (a, b) =>
        hash3(seed ^ ruleIndex, a.priority, ruleIndex) -
          hash3(seed ^ ruleIndex, b.priority, ruleIndex) ||
        a.x - b.x ||
        a.z - b.z,
    );
    const selected: DescentSite[] = [];
    for (const candidate of matching) {
      if (
        selected.some(
          (site) =>
            squaredDistance(candidate.x, candidate.z, site.x, site.z) <
            600 * 600,
        )
      )
        continue;
      const to = Number(candidate.regions[layerIndex(Number(rule.to[0]))]);
      selected.push(
        Object.freeze({
          id: `${rule.type}-${REGION_IDS[rule.from]}-${selected.length + 1}`,
          type: rule.type,
          from: REGION_IDS[rule.from] as RegionId,
          to: REGION_IDS[to] as RegionId,
          fromLayer: regionLayer(rule.from),
          toLayer: regionLayer(to) as UndergroundLayer,
          x: candidate.x,
          z: candidate.z,
        }),
      );
      if (selected.length === count) break;
    }
    if (selected.length !== count)
      throw new Error(
        `Descent overlap/clearance unsatisfied: ${rule.type} (${selected.length}/${count}; candidates=${matching.length})`,
      );
    result.push(...selected);
  }
  result.push(
    Object.freeze({
      id: "nadir-stair",
      type: "nadir_stair",
      from: "nadir",
      to: "throne",
      fromLayer: "surface",
      toLayer: "pit",
      x: 0,
      z: 0,
    }),
  );
  return result;
}
function spawnSites(
  seed: number,
  field: MainField,
  seats: readonly SeatSite[],
): SpawnSite[] {
  interface Candidate {
    readonly x: number;
    readonly z: number;
    readonly height: number;
    readonly region: number;
    readonly priority: number;
  }
  const candidates: Candidate[] = [];
  const column = field.createColumn();
  const treeColumn = field.createColumn();
  const treeCache = new Map<number, TreeFeature | null>();
  const treeAt = (cx: number, cz: number): TreeFeature | null => {
    const key = cx + 1024 + 2048 * (cz + 1024);
    if (treeCache.has(key)) return treeCache.get(key) ?? null;
    const tree = mainTreeInCell(field, cx, cz, treeColumn);
    treeCache.set(key, tree);
    return tree;
  };
  const grid = field.data.grid;
  const preference = new Uint8Array([0, 6, 5, 7, 4, 2, 3, 1]);
  for (let iz = 1; iz < grid.depth - 1; iz++)
    for (let ix = 1; ix < grid.width - 1; ix++) {
      const x = grid.minX + ix * 64 + 0.5;
      const z = grid.minZ + iz * 64 + 0.5;
      const radius2 = x * x + z * z;
      if (
        radius2 < 16000 * 16000 ||
        radius2 > 21000 * 21000 ||
        seats.some(
          (seat) => squaredDistance(x, z, seat.x, seat.z) < 3000 * 3000,
        )
      )
        continue;
      let water = false;
      for (let dz = -4; dz <= 4 && !water; dz++)
        for (let dx = -4; dx <= 4; dx++) {
          if (dx * dx + dz * dz > 21) continue;
          const nx = ix + dx;
          const nz = iz + dz;
          if (nx < 0 || nz < 0 || nx >= grid.width || nz >= grid.depth)
            continue;
          if (field.data.basinIds[nx + nz * grid.width]) {
            water = true;
            break;
          }
        }
      if (!water) continue;
      field.sampleColumn(x, z, column);
      const region = Number(column[MainColumn.DominantRegion]);
      const h = Number(column[MainColumn.Height]);
      const dx = Number(column[MainColumn.Dx]);
      const dz = Number(column[MainColumn.Dz]);
      if (
        region >= 8 ||
        h <= Number(column[MainColumn.WaterLevel]) + 1 ||
        dx * dx + dz * dz > 0.35 * 0.35
      )
        continue;
      const cx = Math.floor(x / MAIN_TREE_CELL);
      const cz = Math.floor(z / MAIN_TREE_CELL);
      let blocked = false;
      let timber = false;
      for (let rz = -1; rz <= 1; rz++)
        for (let rx = -1; rx <= 1; rx++) {
          const tree = treeAt(cx + rx, cz + rz);
          if (!tree) continue;
          const distance = squaredDistance(x, z, tree.x, tree.z);
          if (distance < (tree.crownRadius + 1) * (tree.crownRadius + 1))
            blocked = true;
          if (distance <= 300 * 300) timber = true;
        }
      if (blocked) continue;
      for (let radius = 2; radius <= 8 && !timber; radius++)
        for (let rz = -radius; rz <= radius && !timber; rz++)
          for (let rx = -radius; rx <= radius; rx++) {
            if (Math.abs(rx) !== radius && Math.abs(rz) !== radius) continue;
            const tree = treeAt(cx + rx, cz + rz);
            if (tree && squaredDistance(x, z, tree.x, tree.z) <= 300 * 300) {
              timber = true;
              break;
            }
          }
      if (!timber) continue;
      candidates.push({
        x,
        z,
        height: h,
        region,
        priority: hash3(seed ^ 0x9e3779b9, ix, iz),
      });
    }
  candidates.sort(
    (a, b) =>
      Number(preference[a.region]) - Number(preference[b.region]) ||
      a.priority - b.priority ||
      a.x - b.x ||
      a.z - b.z,
  );
  const result: SpawnSite[] = [];
  const selected = new Set<Candidate>();
  const perRegion = new Uint16Array(8);
  for (const maximum of [64, 256])
    for (const candidate of candidates) {
      if (result.length === 256) break;
      if (
        selected.has(candidate) ||
        Number(perRegion[candidate.region]) >= maximum
      )
        continue;
      selected.add(candidate);
      perRegion[candidate.region] = Number(perRegion[candidate.region]) + 1;
      result.push(
        Object.freeze({
          id: `spawn-${candidate.x}-${candidate.z}`,
          region: REGION_IDS[candidate.region] as SurfaceRegionId,
          x: candidate.x,
          z: candidate.z,
          surfaceY: candidate.height,
          rank: result.length,
        }),
      );
    }
  if (result.length !== 256)
    throw new Error(
      `Only ${result.length}/256 safe spawn candidates; eligible=${candidates.length}`,
    );
  return result;
}
/** Sites consume geography/hydrology/vegetation, but never alter them or create a cyclic dependency. */
export function buildSites(
  seed: number,
  geography: GeographyData,
  field: MainField,
  cells: readonly UndergroundCell[],
  bridges: readonly BridgeSite[],
): WorldSites {
  const { seats, forts } = seatsAndForts(seed, geography, field, cells);
  const descents = descentSites(seed, cells, seats);
  const spawns = spawnSites(seed, field, seats);
  if (seats.length !== 30 || forts.length !== 106)
    throw new Error("Site roster totals differ from docs02");
  return Object.freeze({
    seats: Object.freeze(seats),
    forts: Object.freeze(forts),
    descents: Object.freeze(descents),
    bridges,
    spawns: Object.freeze(spawns),
  });
}
