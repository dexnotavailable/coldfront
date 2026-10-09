/** Ibara feature placement, docs/04-terrain.md §8.1 and §8.5. */
import { detExp, detPow, detSinCos } from "../../math/det.js";
import { hash2, hash3, hash4, hash5, rand01 } from "../../math/hash.js";
import { fbm2 } from "../../noise/fractal.js";
import { noiseQuantile } from "../../noise/quantiles.js";
import { clamp01, type Vec3 } from "../../sdf/types.js";
import {
  createIbaraNeighbourContrast,
  EMPTY_IBARA_CONTRAST,
  type IbaraContrastPoint,
} from "./neighbour-contrast.js";
import { instantiateThorn } from "./shape.js";
import type {
  IbaraCellDiagnostics,
  IbaraCluster,
  IbaraClusterParameters,
  IbaraEnvironment,
  IbaraNeighbourContrastDiagnostics,
  ThornInstance,
  ThornParameters,
} from "./types.js";

export const IBARA_CELL_SIZE = 192;
export const IBARA_LANDMARK_CELL_SIZE = 1600;
export const IBARA_MAX_REACH = 768;
/** n<=40, radius<22*sqrt(40)<140m, radial draw<1, and the cluster centre
 * lies in its owner cell. This bounds accepted BASES, not swept geometry. */
export const IBARA_ORDINARY_BASE_REACH = 140;
const MASK_LOW = noiseQuantile("fbm2", 0.55),
  MASK_HIGH = noiseQuantile("fbm2", 0.8);
const HEIGHT_TAIL = detPow(12 / 160, 1.82);
interface ClusterCandidate {
  x: number;
  z: number;
  index: number;
  mask: number;
  priority: number;
}
export function ibaraMask(
  environment: IbaraEnvironment,
  x: number,
  z: number,
): number {
  const noise = new Float64Array(3);
  fbm2(environment.seed ^ 0x49ba7a, x / 900, z / 900, noise);
  const t = clamp01((Number(noise[0]) - MASK_LOW) / (MASK_HIGH - MASK_LOW));
  return t * t * (3 - 2 * t) * clamp01(environment.weightAt(x, z));
}
/** P(N >= 3) belongs to bin 3: this is a capped Poisson, not a renormalized truncation. */
export function cappedPoisson(mean: number, u: number): number {
  if (!(mean >= 0 && mean <= 4 && u >= 0 && u < 1))
    throw new RangeError("Invalid Poisson parameters");
  let probability = detExp(-mean),
    cumulative = probability;
  for (let n = 0; n < 3; n++) {
    if (u < cumulative) return n;
    probability *= mean / (n + 1);
    cumulative += probability;
  }
  return 3;
}
/** Collision-free within Kaldmark's bounded world; branch/debris intentionally inherit their parent. */
export function thornFeatureId(
  cellX: number,
  cellZ: number,
  cluster: number,
  index: number,
  landmark = false,
): number {
  if (
    !Number.isInteger(cellX) ||
    !Number.isInteger(cellZ) ||
    cellX < -128 ||
    cellX > 127 ||
    cellZ < -128 ||
    cellZ > 127 ||
    !Number.isInteger(cluster) ||
    cluster < 0 ||
    cluster > 2 ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > 63
  )
    throw new RangeError("Feature coordinate outside packed identity domain");
  return (
    1 +
    (landmark ? 16_777_216 : 0) +
    ((cellZ + 128) * 256 + cellX + 128) * 256 +
    cluster * 64 +
    index
  );
}
function isSmallBlade(
  seed: number,
  height: number,
  landmark: boolean,
): boolean {
  return (
    !landmark &&
    height < 30 &&
    rand01(hash2(seed, 10)) >= 0.12 &&
    rand01(hash2(seed, 23)) < 0.4
  );
}
/** Reconstruct the original category from its packed identity and salted draws.
 * No adjusted inclination, geometry, parameter mutation or neighbour query. */
export function ibaraNormalInclinationFloor(
  worldSeed: number,
  point: Pick<IbaraContrastPoint, "id" | "height" | "landmark">,
): 5 | 18 {
  if (point.landmark) return 5;
  const word = point.id - 1,
    cell = Math.floor(word / 256),
    seed = hash5(
      worldSeed,
      (cell % 256) - 128,
      Math.floor(cell / 256) - 128,
      Math.floor((word % 256) / 64),
      word % 64,
    );
  return isSmallBlade(seed, point.height, false) ? 18 : 5;
}
function candidates(
  environment: IbaraEnvironment,
  cellX: number,
  cellZ: number,
): readonly ClusterCandidate[] {
  const mask = ibaraMask(
    environment,
    (cellX + 0.5) * IBARA_CELL_SIZE,
    (cellZ + 0.5) * IBARA_CELL_SIZE,
  );
  const count = cappedPoisson(
    1.2 * mask,
    rand01(hash3(environment.seed ^ 0x5a7a16, cellX, cellZ)),
  );
  const result: ClusterCandidate[] = [];
  for (let i = 0; i < count; i++) {
    const x =
      (cellX + rand01(hash4(environment.seed ^ 0x1261, cellX, cellZ, i))) *
      IBARA_CELL_SIZE;
    const z =
      (cellZ + rand01(hash4(environment.seed ^ 0x7a32, cellX, cellZ, i))) *
      IBARA_CELL_SIZE;
    result.push({
      x,
      z,
      index: i,
      mask: ibaraMask(environment, x, z),
      priority: hash4(environment.seed ^ 0x195e, cellX, cellZ, i),
    });
  }
  return result;
}
function clusterRejection(
  environment: IbaraEnvironment,
  cx: number,
  cz: number,
  candidate: ClusterCandidate,
): "mask" | "weight" | "proximity" | null {
  if (candidate.mask <= 0) return "mask";
  if (environment.weightAt(candidate.x, candidate.z) <= 0.1) return "weight";
  for (let z = cz - 1; z <= cz + 1; z++)
    for (let x = cx - 1; x <= cx + 1; x++) {
      for (const other of candidates(environment, x, z)) {
        if (
          other.mask <= 0 ||
          (x === cx && z === cz && other.index === candidate.index)
        )
          continue;
        const higher =
          other.priority > candidate.priority ||
          (other.priority === candidate.priority &&
            (z < cz ||
              (z === cz &&
                (x < cx || (x === cx && other.index < candidate.index)))));
        if (!higher) continue;
        const dx = other.x - candidate.x,
          dz = other.z - candidate.z;
        if (dx * dx + dz * dz < 48 * 48) return "proximity";
      }
    }
  return null;
}
function parameters(
  environment: IbaraEnvironment,
  cx: number,
  cz: number,
  cluster: number,
  index: number,
  base: Vec3,
  centreX: number,
  centreZ: number,
  clusterRadius: number,
  landmark: boolean,
): ThornParameters {
  const seed = hash5(environment.seed, cx, cz, cluster, index);
  const draw = (salt: number): number => rand01(hash2(seed, salt));
  const arch = landmark && draw(6) < 0.3;
  const h = landmark
    ? 220 + 130 * draw(1)
    : 12 * detPow(1 - draw(1) * (1 - HEIGHT_TAIL), -1 / 1.82);
  const broken = !landmark && draw(10) < 0.12;
  // Give a bounded small-member subset a readable blade at 1m without changing height counts.
  const smallBlade = isSmallBlade(seed, h, landmark);
  const r0 = landmark
    ? 18 + 12 * draw(2)
    : Math.max(
        1.6,
        h *
          ((smallBlade || broken ? 0.12 : 0.07) +
            (smallBlade || broken ? 0.04 : 0.09) * draw(2)),
      );
  const trig = new Float64Array(2);
  detSinCos(draw(3) * 2 * Math.PI, trig);
  // A single hashed fallback is shared by the cluster, including an adapter
  // which reports a zero-distance hot interior with no defined outward normal.
  const clusterDirection = new Float64Array(2);
  detSinCos(
    rand01(hash4(environment.seed, cx, cz, cluster)) * 2 * Math.PI,
    clusterDirection,
  );
  let flowX = Number(clusterDirection[1]),
    flowZ = Number(clusterDirection[0]);
  const lava = new Float64Array([Infinity, 0, 0]);
  if (environment.lavaAt) {
    environment.lavaAt(centreX, centreZ, lava);
    const nx = Number(lava[1]),
      nz = Number(lava[2]);
    const length = Math.sqrt(nx * nx + nz * nz);
    if (
      Number.isFinite(Number(lava[0])) &&
      Number.isFinite(length) &&
      length > 1e-5
    ) {
      flowX = nx / length;
      flowZ = nz / length;
    }
    // Material proximity is local to this thorn; flow remains cluster-coherent.
    environment.lavaAt(base[0], base[2], lava);
  }
  flowX += (0.6 * (base[0] - centreX)) / clusterRadius + 0.3 * Number(trig[1]);
  flowZ += (0.6 * (base[2] - centreZ)) / clusterRadius + 0.3 * Number(trig[0]);
  const norm = Math.sqrt(flowX * flowX + flowZ * flowZ);
  flowX /= norm;
  flowZ /= norm;
  const lean =
    draw(4) < 0.05
      ? 45 + 20 * draw(5)
      : (smallBlade ? 18 : 5) + (smallBlade ? 17 : 30) * draw(5) * draw(5);
  const nearLava = Number(lava[0]) < 70;
  return {
    id: thornFeatureId(cx, cz, cluster, index, landmark),
    cellX: cx,
    cellZ: cz,
    cluster,
    index,
    base,
    height: h,
    baseRadius: r0,
    flowX,
    flowZ,
    leanDegrees: lean,
    bend:
      h * ((smallBlade ? 0.18 : 0.03) + (smallBlade ? 0.17 : 0.32) * draw(7)),
    sCurve: !arch && draw(8) < 0.2,
    hooked: !arch && draw(9) < 0.1,
    broken,
    breakT: 0.45 + 0.35 * draw(11),
    branchCount:
      h >= 40 && !arch && draw(12) < 0.35 ? 1 + Math.floor(3 * draw(13)) : 0,
    facets:
      r0 < 4
        ? 3 + Math.floor(2 * draw(14))
        : r0 < 10
          ? 4 + Math.floor(3 * draw(14))
          : 5 + Math.floor(4 * draw(14)),
    facetiness: smallBlade || broken ? 1 : 0.68 + draw(15) * 0.32,
    twist: (draw(16) * 2 * Math.PI) / 3,
    phase: draw(17) * 2 * Math.PI,
    exponent: 0.5 + 0.9 * draw(18),
    core: draw(19) < 0.57 ? "obsidian" : "basalt",
    crust:
      nearLava && draw(20) < 0.4
        ? "ember"
        : draw(21) < 0.15
          ? "brimstone"
          : "none",
    nearLava,
    landmark,
    arch,
    archSpan: 80 + draw(22) * 120,
  };
}
type MutableDiagnostics = {
  -readonly [Key in keyof IbaraCellDiagnostics]: IbaraCellDiagnostics[Key];
};
function newCellDiagnostics(
  cellX: number,
  cellZ: number,
  landmark: boolean,
): MutableDiagnostics {
  return {
    cellX,
    cellZ,
    landmark,
    inDomain:
      Number.isInteger(cellX) &&
      Number.isInteger(cellZ) &&
      cellX >= -128 &&
      cellX <= 127 &&
      cellZ >= -128 &&
      cellZ <= 127,
    poissonAtCap: false,
    candidateClusters: 0,
    rejectedMaskClusters: 0,
    rejectedWeightClusters: 0,
    rejectedProximityClusters: 0,
    acceptedClusters: 0,
    emptyAcceptedClusters: 0,
    candidateInstances: 0,
    rejectedAttemptsInstances: 0,
    rejectedSpacingInstances: 0,
    acceptedInstances: 0,
    candidateAttempts: 0,
    rejectedWeightAttempts: 0,
    rejectedLocalSpacingAttempts: 0,
  };
}
/** Empty snapshot used when the field rejects an out-of-domain cell. */
export function emptyIbaraCellDiagnostics(
  cellX: number,
  cellZ: number,
  landmark: boolean,
): IbaraCellDiagnostics {
  return Object.freeze(newCellDiagnostics(cellX, cellZ, landmark));
}
export interface IbaraPlacementCell {
  readonly clusters: readonly IbaraClusterParameters[];
  readonly diagnostics: IbaraCellDiagnostics;
  readonly contrast: IbaraNeighbourContrastDiagnostics;
}
function localParametersIbaraCell(
  environment: IbaraEnvironment,
  cellX: number,
  cellZ: number,
): IbaraPlacementCell {
  const clusters: IbaraClusterParameters[] = [];
  const diagnostics = newCellDiagnostics(cellX, cellZ, false);
  const localCandidates = candidates(environment, cellX, cellZ);
  diagnostics.candidateClusters = localCandidates.length;
  diagnostics.poissonAtCap = localCandidates.length === 3;
  for (const candidate of localCandidates) {
    const rejection = clusterRejection(environment, cellX, cellZ, candidate);
    if (rejection === "mask") diagnostics.rejectedMaskClusters++;
    if (rejection === "weight") diagnostics.rejectedWeightClusters++;
    if (rejection === "proximity") diagnostics.rejectedProximityClusters++;
    if (rejection !== null) continue;
    diagnostics.acceptedClusters++;
    const n = Math.round(6 + 34 * candidate.mask);
    diagnostics.candidateInstances += n;
    const radius =
      (15 +
        7 *
          rand01(
            hash4(environment.seed ^ 0x195a, cellX, cellZ, candidate.index),
          )) *
      Math.sqrt(n);
    const accepted: ThornParameters[] = [];
    const trig = new Float64Array(2);
    // Hash priority gives each cluster a stable internal packing order, independent of chunk queries.
    const order = Array.from({ length: n }, (_, index) => index);
    order.sort(
      (a, b) =>
        hash5(environment.seed, cellX, cellZ, candidate.index, b) -
          hash5(environment.seed, cellX, cellZ, candidate.index, a) || a - b,
    );
    for (const i of order) {
      const previousCount = accepted.length;
      for (let attempt = 0; attempt < 8; attempt++) {
        diagnostics.candidateAttempts++;
        const word = hash5(
          environment.seed ^ 0x19427,
          cellX,
          cellZ,
          candidate.index * 64 + i,
          attempt,
        );
        detSinCos(rand01(word) * 2 * Math.PI, trig);
        // Area density fades toward the edge while the full disc remains reachable.
        const radial = rand01(hash2(word, 1));
        const distance = radius * detPow(radial, 0.75);
        const x = candidate.x + Number(trig[1]) * distance,
          z = candidate.z + Number(trig[0]) * distance;
        if (environment.weightAt(x, z) < 0.2) {
          diagnostics.rejectedWeightAttempts++;
          continue;
        }
        const p = parameters(
          environment,
          cellX,
          cellZ,
          candidate.index,
          i,
          [x, environment.surfaceAt(x, z), z],
          candidate.x,
          candidate.z,
          radius,
          false,
        );
        let clear = true;
        for (const other of accepted) {
          const dx = x - other.base[0],
            dz = z - other.base[2],
            spacing = 0.8 * (p.baseRadius + other.baseRadius);
          if (dx * dx + dz * dz < spacing * spacing) {
            clear = false;
            break;
          }
        }
        if (clear) {
          accepted.push(p);
          break;
        }
        diagnostics.rejectedLocalSpacingAttempts++;
      }
      if (accepted.length === previousCount)
        diagnostics.rejectedAttemptsInstances++;
    }
    accepted.sort((a, b) => a.index - b.index);
    const thorns = accepted;
    diagnostics.acceptedInstances += thorns.length;
    clusters.push({
      cellX,
      cellZ,
      index: candidate.index,
      x: candidate.x,
      z: candidate.z,
      mask: candidate.mask,
      radius,
      thorns,
    });
  }
  return {
    clusters,
    diagnostics: Object.freeze(diagnostics),
    contrast: EMPTY_IBARA_CONTRAST,
  };
}
/** Radius bound from h < 160 and r0 <= .16h; ordinary clusters reach at
 * most 22sqrt(40) beyond their owning cell. Thus a two-cell halo contains
 * every possible conflicting ordinary base, including across negative cells. */
export const IBARA_PLACEMENT_NEIGHBOUR_CELLS = 2;
export interface IbaraPlacement {
  cell(cellX: number, cellZ: number): readonly IbaraClusterParameters[];
  inspectCell(cellX: number, cellZ: number): IbaraPlacementCell;
  readonly cachedCellCount: number;
}
export function createIbaraPlacement(
  environment: IbaraEnvironment,
  capacity = 256,
): IbaraPlacement {
  if (!Number.isInteger(capacity) || capacity < 1)
    throw new RangeError("Invalid placement cache capacity");
  const cache = new Map<number, IbaraPlacementCell>();
  const originals = new Map<number, IbaraPlacementCell>();
  // A cell inspection may follow p->partner->incoming->nearest, at most 3*192m
  // from an owned base. With <140m base support this spans owner cells +/-5;
  // their two-cell placement halos span +/-7: <=121 original /225 raw cells.
  // Keep this bounded working set only for the current synchronous inspection,
  // so a deliberately tiny persistent cache does not repeatedly rebuild it.
  let workingRaw: Map<number, IbaraPlacementCell> | undefined;
  let workingOriginals: Map<number, IbaraPlacementCell> | undefined;
  const raw = (x: number, z: number): IbaraPlacementCell => {
    if (!Number.isInteger(x) || !Number.isInteger(z))
      throw new RangeError("Feature cells must be integers");
    if (x < -128 || x > 127 || z < -128 || z > 127)
      return {
        clusters: [],
        diagnostics: emptyIbaraCellDiagnostics(x, z, false),
        contrast: EMPTY_IBARA_CONTRAST,
      };
    const key = (z + 128) * 256 + x + 128;
    const working = workingRaw?.get(key);
    if (working) return working;
    const old = cache.get(key);
    if (old) {
      cache.delete(key);
      cache.set(key, old);
      workingRaw?.set(key, old);
      return old;
    }
    const value = localParametersIbaraCell(environment, x, z);
    workingRaw?.set(key, value);
    cache.set(key, value);
    if (cache.size > capacity) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return value;
  };
  const priority = (p: ThornParameters): number =>
    hash2(environment.seed ^ 0x71baca, p.id);
  // This layer never calls contrast. Spatial contrast queries can therefore
  // request adjacent accepted cells without recursive adjusted-neighbour work.
  const originalCell = (cellX: number, cellZ: number): IbaraPlacementCell => {
    if (!Number.isInteger(cellX) || !Number.isInteger(cellZ))
      throw new RangeError("Feature cells must be integers");
    if (cellX < -128 || cellX > 127 || cellZ < -128 || cellZ > 127)
      return raw(cellX, cellZ);
    const key = (cellZ + 128) * 256 + cellX + 128;
    const working = workingOriginals?.get(key);
    if (working) return working;
    const old = originals.get(key);
    if (old) {
      originals.delete(key);
      originals.set(key, old);
      workingOriginals?.set(key, old);
      return old;
    }
    const local = raw(cellX, cellZ);
    if (local.clusters.length === 0) {
      workingOriginals?.set(key, local);
      return local;
    }
    const neighbours: ThornParameters[] = [];
    for (
      let z = cellZ - IBARA_PLACEMENT_NEIGHBOUR_CELLS;
      z <= cellZ + IBARA_PLACEMENT_NEIGHBOUR_CELLS;
      z++
    )
      for (
        let x = cellX - IBARA_PLACEMENT_NEIGHBOUR_CELLS;
        x <= cellX + IBARA_PLACEMENT_NEIGHBOUR_CELLS;
        x++
      )
        for (const cluster of raw(x, z).clusters)
          neighbours.push(...cluster.thorns);
    let rejectedSpacingInstances = 0;
    const clusters = local.clusters.map((cluster) => ({
      ...cluster,
      thorns: cluster.thorns.filter((p) => {
        const rank = priority(p);
        for (const other of neighbours) {
          if (
            other.id === p.id ||
            (other.cellX === p.cellX &&
              other.cellZ === p.cellZ &&
              other.cluster === p.cluster)
          )
            continue;
          const otherRank = priority(other);
          if (otherRank < rank || (otherRank === rank && other.id > p.id))
            continue;
          const dx = p.base[0] - other.base[0],
            dz = p.base[2] - other.base[2];
          const minimum = 0.8 * (p.baseRadius + other.baseRadius);
          if (dx * dx + dz * dz < minimum * minimum) {
            rejectedSpacingInstances++;
            return false;
          }
        }
        return true;
      }),
    }));
    const result: IbaraPlacementCell = {
      clusters,
      diagnostics: Object.freeze({
        ...local.diagnostics,
        rejectedSpacingInstances,
        acceptedInstances:
          local.diagnostics.acceptedInstances - rejectedSpacingInstances,
        emptyAcceptedClusters: clusters.filter(
          (cluster) => cluster.thorns.length === 0,
        ).length,
      }),
      contrast: EMPTY_IBARA_CONTRAST,
    };
    originals.set(key, result);
    workingOriginals?.set(key, result);
    if (originals.size > capacity) {
      const oldest = originals.keys().next().value;
      if (oldest !== undefined) originals.delete(oldest);
    }
    return result;
  };
  const contrast = createIbaraNeighbourContrast(
    (x, z, radius) => {
      const result: ThornParameters[] = [];
      // Every base in the query disk must have an owner cell intersecting the
      // disk's AABB expanded by the proven <140m placement support. Querying
      // those original cells is complete at cell edges and in negative space.
      const minX = Math.max(
          -128,
          Math.floor(
            (x - radius - IBARA_ORDINARY_BASE_REACH) / IBARA_CELL_SIZE,
          ),
        ),
        maxX = Math.min(
          127,
          Math.floor(
            (x + radius + IBARA_ORDINARY_BASE_REACH) / IBARA_CELL_SIZE,
          ),
        ),
        minZ = Math.max(
          -128,
          Math.floor(
            (z - radius - IBARA_ORDINARY_BASE_REACH) / IBARA_CELL_SIZE,
          ),
        ),
        maxZ = Math.min(
          127,
          Math.floor(
            (z + radius + IBARA_ORDINARY_BASE_REACH) / IBARA_CELL_SIZE,
          ),
        );
      for (let cellZ = minZ; cellZ <= maxZ; cellZ++)
        for (let cellX = minX; cellX <= maxX; cellX++)
          for (const cluster of originalCell(cellX, cellZ).clusters)
            for (const p of cluster.thorns) {
              const dx = p.base[0] - x,
                dz = p.base[2] - z;
              if (dx * dx + dz * dz <= radius * radius) result.push(p);
            }
      return result;
    },
    capacity * 64,
    (point) => ibaraNormalInclinationFloor(environment.seed, point),
  );
  const inspectCell = (cellX: number, cellZ: number): IbaraPlacementCell => {
    const previousRaw = workingRaw,
      previousOriginals = workingOriginals;
    workingRaw = new Map();
    workingOriginals = new Map();
    try {
      const original = originalCell(cellX, cellZ);
      if (original.clusters.length === 0) return original;
      const adjusted = contrast.apply(
        original.clusters.flatMap((c) => c.thorns),
      );
      const byId = new Map(adjusted.parameters.map((p) => [p.id, p]));
      return {
        clusters: original.clusters.map((cluster) => ({
          ...cluster,
          thorns: cluster.thorns.map((p) => byId.get(p.id) ?? p),
        })),
        diagnostics: original.diagnostics,
        contrast: adjusted.diagnostics,
      };
    } finally {
      workingRaw = previousRaw;
      workingOriginals = previousOriginals;
    }
  };
  return {
    get cachedCellCount(): number {
      return cache.size;
    },
    cell: (cellX, cellZ) => inspectCell(cellX, cellZ).clusters,
    inspectCell,
  };
}
/** Final accepted parameters, without any spine construction. */
export function parametersIbaraCell(
  environment: IbaraEnvironment,
  cellX: number,
  cellZ: number,
): readonly IbaraClusterParameters[] {
  return createIbaraPlacement(environment).cell(cellX, cellZ);
}
export function parametersIbaraLandmarks(
  environment: IbaraEnvironment,
  cellX: number,
  cellZ: number,
): readonly ThornParameters[] {
  return inspectIbaraLandmarks(environment, cellX, cellZ).parameters;
}
export function inspectIbaraLandmarks(
  environment: IbaraEnvironment,
  cellX: number,
  cellZ: number,
): {
  readonly parameters: readonly ThornParameters[];
  readonly diagnostics: IbaraCellDiagnostics;
} {
  const size = IBARA_LANDMARK_CELL_SIZE;
  const count = cappedPoisson(
    (size * size) / 2_500_000,
    rand01(hash3(environment.seed ^ 0x71a9ad, cellX, cellZ)),
  );
  const diagnostics = newCellDiagnostics(cellX, cellZ, true);
  diagnostics.candidateClusters = count;
  diagnostics.poissonAtCap = count === 3;
  const result: ThornParameters[] = [];
  for (let i = 0; i < count; i++) {
    const x =
      (cellX + rand01(hash4(environment.seed ^ 0x4142, cellX, cellZ, i))) *
      size;
    const z =
      (cellZ + rand01(hash4(environment.seed ^ 0x8142, cellX, cellZ, i))) *
      size;
    if (environment.weightAt(x, z) < 0.85) {
      diagnostics.rejectedWeightClusters++;
      continue;
    }
    diagnostics.acceptedClusters++;
    diagnostics.candidateInstances++;
    diagnostics.acceptedInstances++;
    result.push(
      parameters(
        environment,
        cellX,
        cellZ,
        i,
        0,
        [x, environment.surfaceAt(x, z), z],
        x,
        z,
        size,
        true,
      ),
    );
  }
  return { parameters: result, diagnostics: Object.freeze(diagnostics) };
}

/** Compatibility asset entry points; the field uses the cheap functions above. */
export function instantiateIbaraCell(
  environment: IbaraEnvironment,
  cellX: number,
  cellZ: number,
): readonly IbaraCluster[] {
  return parametersIbaraCell(environment, cellX, cellZ).map((cluster) => ({
    ...cluster,
    thorns: cluster.thorns.map((p) => instantiateThorn(p, environment)),
  }));
}
export function instantiateIbaraLandmarks(
  environment: IbaraEnvironment,
  cellX: number,
  cellZ: number,
): readonly ThornInstance[] {
  return parametersIbaraLandmarks(environment, cellX, cellZ).map((p) =>
    instantiateThorn(p, environment),
  );
}
