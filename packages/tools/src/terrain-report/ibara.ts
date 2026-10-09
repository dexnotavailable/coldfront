import { BLOCK_REGISTRY } from "../../../shared/src/blocks/registry.js";
import {
  IBARA_CELL_SIZE,
  IBARA_LANDMARK_CELL_SIZE,
  IBARA_MAX_REACH,
} from "../../../shared/src/features/ibara/cells.js";
import type {
  IbaraCellDiagnostics,
  ThornInstance,
  ThornParameters,
} from "../../../shared/src/features/ibara/types.js";
import {
  WORLD_MAX_XZ,
  WORLD_MAX_Y,
  WORLD_MIN_XZ,
  WORLD_MIN_Y,
} from "../../../shared/src/world/constants.js";
import { Region } from "../../../shared/src/world/regions.js";
import type {
  WorldAreaSampler,
  WorldContext,
  XZBounds,
} from "../../../shared/src/world/types.js";
import { IBARA_SUPPORT } from "../../../shared/src/worldgen/main/ibara-volcanic.js";
import { createRegionWeights } from "../../../shared/src/worldplan/geometry.js";
import type { IbaraReview } from "../terrain-review/source.js";

export interface Band {
  numerator: number;
  denominator: number;
  denominatorPolicy: string;
  share: number | null;
  target: readonly [number, number];
  status: "pass" | "fail" | "unavailable";
}
export function band(
  numerator: number,
  denominator: number,
  target: readonly [number, number],
  denominatorPolicy: string,
): Band {
  if (
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator) ||
    numerator < 0 ||
    denominator < 0 ||
    numerator > denominator
  )
    throw new Error("Invalid count denominator");
  const share = denominator ? numerator / denominator : null;
  return {
    numerator,
    denominator,
    denominatorPolicy,
    share,
    target,
    status:
      share === null
        ? "unavailable"
        : share >= target[0] && share <= target[1]
          ? "pass"
          : "fail",
  };
}

/** Exact nearest neighbour in the horizontal base plane, ties by feature ID.
 * The tree prunes only boxes farther than the current exact squared distance. */
export function nearestNeighbours(parameters: readonly ThornParameters[]) {
  interface Node {
    p: ThornParameters;
    axis: 0 | 2;
    left: Node | null;
    right: Node | null;
  }
  const build = (items: ThornParameters[], depth: number): Node | null => {
    if (!items.length) return null;
    const axis = depth % 2 === 0 ? 0 : 2;
    items.sort((a, b) => a.base[axis] - b.base[axis] || a.id - b.id);
    const middle = Math.floor(items.length / 2);
    return {
      p: items[middle] as ThornParameters,
      axis,
      left: build(items.slice(0, middle), depth + 1),
      right: build(items.slice(middle + 1), depth + 1),
    };
  };
  const tree = build([...parameters], 0);
  return parameters.map((p) => {
    let best: ThornParameters | null = null,
      distance2 = Infinity;
    const visit = (node: Node | null): void => {
      if (!node) return;
      const dx = node.p.base[0] - p.base[0],
        dz = node.p.base[2] - p.base[2];
      const d = dx * dx + dz * dz;
      if (
        node.p.id !== p.id &&
        (d < distance2 || (d === distance2 && (!best || node.p.id < best.id)))
      ) {
        best = node.p;
        distance2 = d;
      }
      const delta = p.base[node.axis] - node.p.base[node.axis];
      visit(delta <= 0 ? node.left : node.right);
      if (delta * delta <= distance2)
        visit(delta <= 0 ? node.right : node.left);
    };
    visit(tree);
    const other = best as ThornParameters | null;
    return {
      id: p.id,
      neighbourId: other?.id ?? null,
      distance: other ? Math.sqrt(distance2) : null,
      different:
        other === null
          ? null
          : Math.abs(p.height - other.height) >= 0.2 * p.height ||
            Math.abs(p.leanDegrees - other.leanDegrees) >= 8 ||
            Math.abs(p.bend - other.bend) >= 0.1 * p.height,
    };
  });
}

export const PARAMETER_WITNESS_SCHEMA = "coldfront.ibara-parameter-witness/1";
export const PARAMETER_WITNESS_FIELDS = [
  "id",
  "baseX_m",
  "baseZ_m",
  "height_m",
  "inclination_deg",
  "unsignedBendAmplitude_m",
  "landmark_0_or_1",
] as const;
/** JSON's shortest decimal representation round-trips finite binary64 numbers.
 * Signed zero needs a sentinel because JSON.stringify(-0) would lose its sign. */
type ExactOperand = number | "-0";
export type ParameterWitnessRow = readonly [
  number,
  ExactOperand,
  ExactOperand,
  ExactOperand,
  ExactOperand,
  ExactOperand,
  0 | 1,
];
export interface ParameterWitnessIdentity {
  readonly seed: number;
  readonly world: "main";
  readonly region: "hellscape";
  readonly worldgenVersion: number;
  readonly sourceHash: string;
  readonly sourceCommit: string;
  readonly harnessHash: string;
  readonly acceptedPopulationHash: string;
  readonly domain: XZBounds;
}
export interface ParameterWitness {
  readonly schema: typeof PARAMETER_WITNESS_SCHEMA;
  readonly identity: ParameterWitnessIdentity;
  readonly fields: typeof PARAMETER_WITNESS_FIELDS;
  readonly encoding: string;
  readonly policy: string;
  readonly rows: readonly ParameterWitnessRow[];
}
export function createParameterWitness(
  parameters: readonly ThornParameters[],
  identity: ParameterWitnessIdentity,
): ParameterWitness {
  const exact = (n: number): ExactOperand => (Object.is(n, -0) ? "-0" : n);
  const witness: ParameterWitness = {
    schema: PARAMETER_WITNESS_SCHEMA,
    identity,
    fields: PARAMETER_WITNESS_FIELDS,
    encoding:
      "Finite binary64 operands written as unrounded JSON shortest round-trip decimals; the string -0 preserves IEEE754 negative zero. IDs are exact unsigned32 integers. No quantization, rounding or presentation formatting.",
    policy:
      "All final placement-accepted ordinary and landmark parameters in census enumeration order. Nearest search uses every ordinary base in XZ only, excludes self, and resolves equal squared distance by lower unsigned ID. Directed differences use focal height: abs(height-heightN)>=0.2*height OR abs(inclination-inclinationN)>=8 degrees OR abs(unsignedBendAmplitude-unsignedBendAmplitudeN)>=0.1*height. Scalar inclination is from vertical. Landmarks are retained as separately labelled rows and are never nearest candidates. Every receipt parameters.nearestNeighbours[].id and neighbourId references this table's id column. No other geometric operand enters this metric (decision113).",
    rows: parameters.map((p) => [
      p.id,
      exact(p.base[0]),
      exact(p.base[2]),
      exact(p.height),
      exact(p.leanDegrees),
      exact(p.bend),
      p.landmark ? 1 : 0,
    ]),
  };
  decodeParameterWitness(witness);
  return witness;
}
/** Read-only reconstruction of the exact operands; never reconstruct placement. */
export function decodeParameterWitness(witness: ParameterWitness) {
  if (
    witness.schema !== PARAMETER_WITNESS_SCHEMA ||
    JSON.stringify(witness.fields) !== JSON.stringify(PARAMETER_WITNESS_FIELDS)
  )
    throw new Error("Unsupported parameter witness schema/fields");
  const identity = witness.identity;
  if (
    identity?.world !== "main" ||
    identity.region !== "hellscape" ||
    !Number.isInteger(identity.seed) ||
    identity.seed < 0 ||
    identity.seed > 0xffffffff ||
    !Number.isInteger(identity.worldgenVersion) ||
    identity.worldgenVersion < 0 ||
    ![
      identity.sourceHash,
      identity.harnessHash,
      identity.acceptedPopulationHash,
    ].every((v) => /^[a-f0-9]{64}$/.test(v)) ||
    !/^[a-f0-9]{40,64}$/.test(identity.sourceCommit)
  )
    throw new Error("Invalid parameter witness source identity");
  const ids = new Set<number>();
  const decode = (value: ExactOperand): number => {
    if (value === "-0") return -0;
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new Error("Invalid parameter witness operand");
    return value;
  };
  return witness.rows.map((row) => {
    if (
      row.length !== 7 ||
      !Number.isInteger(row[0]) ||
      row[0] <= 0 ||
      row[0] > 0xffffffff ||
      ids.has(row[0]) ||
      (row[6] !== 0 && row[6] !== 1)
    )
      throw new Error("Invalid/duplicate parameter witness ID or row");
    ids.add(row[0]);
    const value = {
      id: row[0],
      baseXMetres: decode(row[1]),
      baseZMetres: decode(row[2]),
      heightMetres: decode(row[3]),
      inclinationDegrees: decode(row[4]),
      unsignedBendAmplitudeMetres: decode(row[5]),
      landmark: row[6] === 1,
    };
    if (!(value.heightMetres > 0) || value.unsignedBendAmplitudeMetres < 0)
      throw new Error("Invalid parameter witness height/bend");
    return value;
  });
}
/** Ensures table/pair population closure and exact saved comparisons. Global
 * neighbour optimality is independently reproducible from the complete table. */
export function validateWitnessPairClosure(
  witness: ParameterWitness,
  pairs: ReturnType<typeof nearestNeighbours>,
) {
  const rows = decodeParameterWitness(witness),
    ordinary = rows.filter((r) => !r.landmark),
    byId = new Map(ordinary.map((r) => [r.id, r])),
    seen = new Set<number>();
  if (pairs.length !== ordinary.length)
    throw new Error("Witness ordinary/pair denominator mismatch");
  for (const pair of pairs) {
    const a = byId.get(pair.id);
    if (!a || seen.has(pair.id))
      throw new Error("Witness pair has unknown/duplicate focal ID");
    seen.add(pair.id);
    if (pair.neighbourId === null) {
      if (
        ordinary.length !== 1 ||
        pair.distance !== null ||
        pair.different !== null
      )
        throw new Error("Missing witness neighbour");
      continue;
    }
    const b = byId.get(pair.neighbourId);
    if (!b || a.id === b.id)
      throw new Error("Witness pair has unknown/self/landmark neighbour");
    const dx = b.baseXMetres - a.baseXMetres,
      dz = b.baseZMetres - a.baseZMetres;
    const distance = Math.sqrt(dx * dx + dz * dz),
      different =
        Math.abs(a.heightMetres - b.heightMetres) >= 0.2 * a.heightMetres ||
        Math.abs(a.inclinationDegrees - b.inclinationDegrees) >= 8 ||
        Math.abs(
          a.unsignedBendAmplitudeMetres - b.unsignedBendAmplitudeMetres,
        ) >=
          0.1 * a.heightMetres;
    if (distance !== pair.distance || different !== pair.different)
      throw new Error(`Witness operands disagree with pair ${a.id}/${b.id}`);
  }
  return {
    acceptedRows: rows.length,
    ordinaryRows: ordinary.length,
    landmarkRows: rows.length - ordinary.length,
    referencedPairs: pairs.length,
    status: "pass" as const,
  };
}
function histogram(
  parameters: readonly ThornParameters[],
  get: (p: ThornParameters) => number,
  edges: readonly number[],
) {
  return edges.slice(0, -1).map((low, i) => ({
    low,
    high: edges[i + 1] as number,
    count: parameters.filter(
      (p) =>
        get(p) >= low &&
        (i === edges.length - 2
          ? get(p) <= (edges[i + 1] as number)
          : get(p) < (edges[i + 1] as number)),
    ).length,
  }));
}
export function parameterStatistics(parameters: readonly ThornParameters[]) {
  for (const p of parameters)
    if (
      !Number.isSafeInteger(p.id) ||
      p.id <= 0 ||
      !p.base.every(Number.isFinite) ||
      !Number.isFinite(p.height) ||
      p.height <= 0 ||
      !Number.isFinite(p.leanDegrees) ||
      !Number.isFinite(p.bend) ||
      p.bend < 0
    )
      throw new Error(`Invalid accepted parameters for feature ${p.id}`);
  if (new Set(parameters.map((p) => p.id)).size !== parameters.length)
    throw new Error("Duplicate accepted feature IDs in census");
  const ordinary = parameters.filter((p) => !p.landmark),
    landmarks = parameters.filter((p) => p.landmark);
  const n = ordinary.length,
    denominator =
      "all final placement-accepted ordinary thorns, including broken; landmarks excluded and counted separately";
  const count = (predicate: (p: ThornParameters) => boolean) =>
    ordinary.filter(predicate).length;
  const neighbours = nearestNeighbours(ordinary);
  const eligible = count((p) => p.height >= 40);
  const bands = {
    height12to30: band(
      count((p) => p.height >= 12 && p.height <= 30),
      n,
      [0.75, 0.88],
      denominator,
    ),
    heightAtLeast60: band(
      count((p) => p.height >= 60),
      n,
      [0.03, 0.07],
      denominator,
    ),
    leanOutliers: band(
      count((p) => p.leanDegrees >= 45 && p.leanDegrees <= 65),
      n,
      [0.03, 0.07],
      denominator,
    ),
    sCurves: band(
      count((p) => p.sCurve),
      n,
      [0.17, 0.23],
      denominator,
    ),
    hooks: band(
      count((p) => p.hooked),
      n,
      [0.07, 0.13],
      denominator,
    ),
    broken: band(
      count((p) => p.broken),
      n,
      [0.09, 0.15],
      denominator,
    ),
    branched: band(
      count((p) => p.height >= 40 && p.branchCount > 0),
      eligible,
      [0.3, 0.4],
      "all final placement-accepted ordinary thorns with height >=40m, including broken",
    ),
    nearestNeighbour: band(
      neighbours.filter((p) => p.different === true).length,
      n,
      [0.95, 1],
      `${denominator}; singleton has no neighbour and cannot pass`,
    ),
  };
  return {
    accepted: parameters.length,
    ordinary: n,
    landmarks: {
      count: landmarks.length,
      arches: landmarks.filter((p) => p.arch).length,
      colossi: landmarks.filter((p) => !p.arch).length,
      height: histogram(landmarks, (p) => p.height, [220, 250, 300, 350]),
    },
    bands,
    histograms: {
      height: histogram(
        ordinary,
        (p) => p.height,
        [0, 12, 20, 30, 40, 60, 90, 120, 160],
      ),
      leanDegrees: histogram(
        ordinary,
        (p) => p.leanDegrees,
        [0, 5, 15, 25, 35, 45, 55, 65],
      ),
      bendOverHeight: histogram(
        ordinary,
        (p) => p.bend / p.height,
        [0, 0.1, 0.2, 0.3, 0.4],
      ),
      branches: histogram(ordinary, (p) => p.branchCount, [0, 1, 2, 3, 4]),
    },
    nearestNeighbourPolicy:
      "Exact XZ Euclidean nearest ordinary base across all cells and clusters; ties choose smaller ID. Directed comparison uses focal thorn height for both 20% height and 0.1h bend thresholds; lean compares inclination degrees. No landmarks, radius cutoff or cluster restriction.",
    nearestNeighbours: neighbours,
    status: Object.values(bands).every((b) => b.status === "pass")
      ? "pass"
      : "fail",
  };
}

export const CENSUS_BOUNDS: XZBounds = Object.freeze({
  minX: IBARA_SUPPORT.minX - IBARA_MAX_REACH,
  minZ: IBARA_SUPPORT.minZ - IBARA_MAX_REACH,
  maxX: IBARA_SUPPORT.maxX + IBARA_MAX_REACH,
  maxZ: IBARA_SUPPORT.maxZ + IBARA_MAX_REACH,
});
export interface WorkControl {
  readonly signal?: AbortSignal;
  readonly checkpoint?: () => Promise<void>;
}
async function checkpoint(control: WorkControl): Promise<void> {
  control.signal?.throwIfAborted();
  await control.checkpoint?.();
  control.signal?.throwIfAborted();
}
const placementFields = [
  "candidateClusters",
  "rejectedMaskClusters",
  "rejectedWeightClusters",
  "rejectedProximityClusters",
  "acceptedClusters",
  "emptyAcceptedClusters",
  "candidateInstances",
  "rejectedAttemptsInstances",
  "rejectedSpacingInstances",
  "acceptedInstances",
  "candidateAttempts",
  "rejectedWeightAttempts",
  "rejectedLocalSpacingAttempts",
] as const;
export function placementTotals() {
  const counts = Object.fromEntries(
    placementFields.map((field) => [field, 0]),
  ) as Record<(typeof placementFields)[number], number>;
  return { cells: 0, inDomainCells: 0, poissonAtCapCells: 0, ...counts };
}
/** Closure checks expose a counter/parameter mismatch instead of silently dropping
 * rejected candidates or normalizing a distribution to make it pass. */
export function accumulatePlacement(
  out: ReturnType<typeof placementTotals>,
  cell: IbaraCellDiagnostics,
  acceptedCount: number,
): void {
  for (const field of placementFields)
    if (!Number.isSafeInteger(cell[field]) || cell[field] < 0)
      throw new Error(`Invalid placement count ${field}`);
  const rejectedClusters =
    cell.rejectedMaskClusters +
    cell.rejectedWeightClusters +
    cell.rejectedProximityClusters;
  if (
    cell.candidateClusters !== rejectedClusters + cell.acceptedClusters ||
    cell.emptyAcceptedClusters > cell.acceptedClusters ||
    cell.candidateInstances !==
      cell.rejectedAttemptsInstances +
        cell.rejectedSpacingInstances +
        cell.acceptedInstances ||
    cell.acceptedInstances !== acceptedCount
  )
    throw new Error(
      `Placement closure failed at ${cell.cellX},${cell.cellZ},${cell.landmark}`,
    );
  if (cell.landmark) {
    if (
      cell.candidateAttempts !== 0 ||
      cell.rejectedWeightAttempts !== 0 ||
      cell.rejectedLocalSpacingAttempts !== 0 ||
      cell.candidateInstances !== cell.acceptedClusters
    )
      throw new Error("Landmark attempt/slot denominator mismatch");
  } else if (
    cell.candidateAttempts !==
    cell.rejectedWeightAttempts +
      cell.rejectedLocalSpacingAttempts +
      cell.acceptedInstances +
      cell.rejectedSpacingInstances
  )
    throw new Error("Ordinary attempt closure failed");
  out.cells++;
  out.inDomainCells += Number(cell.inDomain);
  out.poissonAtCapCells += Number(cell.poissonAtCap);
  for (const field of placementFields) out[field] += cell[field];
}
/** Enumerate owning cells, never spatial collect(): no 4096-cell batch guard is removed. */
export async function censusParameters(
  review: Pick<IbaraReview, "features">,
  control: WorkControl = {},
) {
  const parameters: ThornParameters[] = [],
    cells = { ordinary: 0, landmark: 0 };
  const ordinary = placementTotals(),
    landmarks = placementTotals();
  for (const landmark of [false, true]) {
    const size = landmark ? IBARA_LANDMARK_CELL_SIZE : IBARA_CELL_SIZE;
    for (
      let z = Math.floor(CENSUS_BOUNDS.minZ / size);
      z <= Math.floor(CENSUS_BOUNDS.maxZ / size);
      z++
    ) {
      await checkpoint(control);
      for (
        let x = Math.floor(CENSUS_BOUNDS.minX / size);
        x <= Math.floor(CENSUS_BOUNDS.maxX / size);
        x++
      ) {
        const found = review.features.parametersForCell(x, z, landmark);
        const diagnostic = review.features.diagnosticsForCell(x, z, landmark);
        if (
          diagnostic.cellX !== x ||
          diagnostic.cellZ !== z ||
          diagnostic.landmark !== landmark
        )
          throw new Error("Placement diagnostic ownership mismatch");
        accumulatePlacement(
          landmark ? landmarks : ordinary,
          diagnostic,
          found.length,
        );
        for (const p of found) {
          if (p.landmark !== landmark || p.cellX !== x || p.cellZ !== z)
            throw new Error(
              "Production enumeration returned inconsistent ownership",
            );
          if (
            !(
              p.base[0] >= WORLD_MIN_XZ &&
              p.base[0] < WORLD_MAX_XZ &&
              p.base[2] >= WORLD_MIN_XZ &&
              p.base[2] < WORLD_MAX_XZ
            )
          )
            throw new Error(
              "Accepted production base lies outside census world domain",
            );
          parameters.push(p);
        }
        if (landmark) cells.landmark++;
        else cells.ordinary++;
      }
    }
  }
  return {
    parameters,
    cells,
    bounds: CENSUS_BOUNDS,
    policy:
      "Whole production hellscape population: every owner cell in shared IBARA_SUPPORT expanded by shared IBARA_MAX_REACH, including blend placements and neighbouring owners. Half-open world base membership only; no size/shape reclassification. Ordinary and landmark owner grids enumerated separately. No curve construction.",
    placement: {
      ordinary,
      landmarks,
      candidates: ordinary.candidateInstances + landmarks.candidateClusters,
      accepted: parameters.length,
      skipped:
        ordinary.rejectedAttemptsInstances +
        ordinary.rejectedSpacingInstances +
        landmarks.rejectedWeightClusters,
      policy:
        "Cell-owned pre-LOD snapshots from production placement, never neighbour-probe/lifetime counters. Ordinary candidateInstances are slots AFTER surviving cluster gates; exhausted8-attempt and cross-cell/cluster-spacing skips close against acceptedInstances. Cluster gate rejects are separately reported. Landmark candidateClusters are pre-weight-gate slots (one possible landmark each); their rejectedWeightClusters are landmark skips. Landmark candidateInstances are post-gate and have no attempt search. Aggregate candidates combines ordinary post-cluster slots and landmark pre-weight slots; populations remain disjoint above. Every closure is checked against parametersForCell length.",
      capPolicy:
        "poissonAtCapCells counts draws in the N>=3 Poisson bucket; production caps them to3. The unknown discarded Poisson tail count is not measured or invented. Curve/geometry failures are separate tip-stage records.",
    },
  };
}

/** Inspect measured radius tables on every production sweep, including branch/debris tips. */
export function inspectTips(instance: ThornInstance) {
  return [...instance.sweeps, ...instance.debris].map((sweep, index) => {
    const limit = Math.max(1.5, 0.04 * sweep.spine.length);
    return {
      id: instance.parameters.id,
      sweep: index,
      kind: index < instance.sweeps.length ? "live" : "debris",
      length: sweep.spine.length,
      thinLength: sweep.thinTipLength,
      limit,
      capped: sweep.spine.capped,
      pass:
        !sweep.spine.capped &&
        Number.isFinite(sweep.thinTipLength) &&
        sweep.thinTipLength >= 0 &&
        sweep.spine.length > 0 &&
        Number.isFinite(sweep.spine.length) &&
        sweep.thinTipLength <= limit + 1e-9,
    };
  });
}
export async function censusTips(
  parameters: readonly ThornParameters[],
  instantiate: (p: ThornParameters) => ThornInstance,
  control: WorkControl = {},
) {
  let checkedInstances = 0,
    checkedSweeps = 0,
    cappedSweeps = 0,
    maximumThinLength = 0,
    maximumLimitRatio = 0;
  const failures: ReturnType<typeof inspectTips> = [],
    constructionFailures: { id: number; error: string }[] = [];
  for (const p of parameters) {
    if ((checkedInstances + constructionFailures.length) % 16 === 0)
      await checkpoint(control);
    try {
      const instance = instantiate(p);
      const tips = inspectTips(instance);
      if (!tips.length) throw new Error("Accepted instance contains no sweeps");
      checkedInstances++;
      for (const tip of tips) {
        checkedSweeps++;
        cappedSweeps += Number(tip.capped);
        maximumThinLength = Math.max(maximumThinLength, tip.thinLength);
        maximumLimitRatio = Math.max(
          maximumLimitRatio,
          tip.thinLength / tip.limit,
        );
        if (!tip.pass) failures.push(tip);
      }
    } catch (error) {
      constructionFailures.push({ id: p.id, error: String(error) });
    }
  }
  return {
    policy:
      "All accepted ordinary and landmark instances, main/branch/debris sweeps; measured production thinTipLength from actual interpolated radius table. Broken/capped/construction failures remain in population.",
    expectedInstances: parameters.length,
    checkedInstances,
    checkedSweeps,
    cappedSweeps,
    maximumThinLength,
    maximumLimitRatio,
    failures,
    constructionFailures,
    status:
      parameters.length > 0 &&
      checkedInstances === parameters.length &&
      !failures.length &&
      !constructionFailures.length
        ? "pass"
        : "fail",
  };
}

export interface CoverageAccumulator {
  samples: number;
  weight: number;
  thornWeight: number;
  denseWeight: number;
  dominantSamples: number;
  dominantThorns: number;
  dominantDense: number;
}
export function accumulateCoverage(
  out: CoverageAccumulator,
  weight: number,
  mask: number,
  dominant: boolean,
): void {
  if (
    !Number.isFinite(weight) ||
    !Number.isFinite(mask) ||
    weight < 0 ||
    weight > 1 ||
    mask < 0 ||
    mask > weight + 1e-12
  )
    throw new Error("Invalid production feature mask");
  out.samples++;
  out.weight += weight;
  const thorn = mask > 0,
    dense = weight > 0 && mask >= weight * (1 - 1e-12);
  if (thorn) out.thornWeight += weight;
  if (dense) out.denseWeight += weight;
  if (dominant) {
    out.dominantSamples++;
    out.dominantThorns += Number(thorn);
    out.dominantDense += Number(dense);
  }
}
export function coverageSummary(out: CoverageAccumulator) {
  return {
    ...out,
    denominatorPolicy:
      "Sampled XZ domain specified by caller; weighted shares divide by summed live hellscape weight. Dominant shares separately divide by points whose authoritative dominant region is hellscape. Thorn means production mask>0; dense means its noise factor is saturated (mask/weight>=1-1e-12). These are mask coverage, not projected geometry footprint.",
    weighted: {
      thorn: out.weight ? out.thornWeight / out.weight : null,
      dense: out.weight ? out.denseWeight / out.weight : null,
    },
    dominant: {
      thorn: out.dominantSamples
        ? out.dominantThorns / out.dominantSamples
        : null,
      dense: out.dominantSamples
        ? out.dominantDense / out.dominantSamples
        : null,
    },
    approximateTargets: { thorn: 0.45, dense: 0.2 },
    targetPolicy:
      "Approximate design references; no undocumented numeric tolerance or pass band invented.",
  };
}
export async function sampleCoverage(
  review: IbaraReview,
  spacing: number,
  control: WorkControl = {},
) {
  if (!Number.isInteger(spacing) || spacing < 8 || spacing > 256)
    throw new Error("Coverage spacing must be an integer 8..256m");
  const out: CoverageAccumulator = {
    samples: 0,
    weight: 0,
    thornWeight: 0,
    denseWeight: 0,
    dominantSamples: 0,
    dominantThorns: 0,
    dominantDense: 0,
  };
  const candidates: { x: number; z: number }[] = [],
    weights = createRegionWeights();
  const bounds = IBARA_SUPPORT;
  for (let z = bounds.minZ + spacing / 2; z < bounds.maxZ; z += spacing) {
    await checkpoint(control);
    for (let x = bounds.minX + spacing / 2; x < bounds.maxX; x += spacing) {
      review.context.surfaceWeights(x, z, weights);
      const dominant = weights.ids[0] === Region.Hellscape;
      accumulateCoverage(
        out,
        review.environment.weightAt(x, z),
        review.mask(x, z),
        dominant,
      );
      if (dominant) candidates.push({ x, z });
    }
  }
  return {
    bounds,
    spacing,
    policy:
      "Cell-centred regular XZ lattice over production support; coverage is a spatial sample, never a full voxel census.",
    ...coverageSummary(out),
    candidates,
  };
}

type Voxel = readonly [number, number, number];
const directions: readonly Voxel[] = [
  [-1, 0, 0],
  [1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
  [0, 0, -1],
  [0, 0, 1],
];
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
export interface ComponentQuery {
  solid(x: number, y: number, z: number): boolean;
  grounded(x: number, y: number, z: number): boolean;
}
/** A boundary hit is unresolved, never floating. Tracing continues into neighbours
 * until proven terrain attachment, a completely closed component, or the explicit cap. */
export function traceComponent(
  start: Voxel,
  query: ComponentQuery,
  maxVoxels: number,
  knownGround = new Set<string>(),
  signal?: AbortSignal,
) {
  if (!Number.isInteger(maxVoxels) || maxVoxels < 1)
    throw new Error("Invalid component voxel cap");
  const visited = new Set<string>(),
    queue: Voxel[] = [start];
  let minimum = start,
    head = 0,
    status: "grounded" | "floating" | "capped" = "floating";
  visited.add(key(...start));
  while (head < queue.length) {
    if (head % 1024 === 0) signal?.throwIfAborted();
    const [x, y, z] = queue[head++] as Voxel;
    if (query.grounded(x, y, z) || knownGround.has(key(x, y, z))) {
      status = "grounded";
      break;
    }
    if (
      x < minimum[0] ||
      (x === minimum[0] &&
        (y < minimum[1] || (y === minimum[1] && z < minimum[2])))
    )
      minimum = [x, y, z];
    for (const [dx, dy, dz] of directions) {
      const nx = x + dx,
        ny = y + dy,
        nz = z + dz,
        k = key(nx, ny, nz);
      if (visited.has(k) || !query.solid(nx, ny, nz)) continue;
      if (visited.size >= maxVoxels)
        return { status: "capped" as const, visited, minimum };
      visited.add(k);
      queue.push([nx, ny, nz]);
    }
  }
  if (status === "grounded") for (const k of visited) knownGround.add(k);
  return { status, visited, minimum };
}

/** Bounded production sampler with tile and column LRUs; never calls context
 * point sampling per voxel (which would repeatedly rebuild feature batches). */
function spatialSampler(context: WorldContext) {
  const areas = new Map<string, WorldAreaSampler>();
  const columns = new Map<
    string,
    {
      area: WorldAreaSampler;
      data: Float64Array;
      solidBelow: number;
      top: number;
    }
  >();
  const voxel = { density: 0, block: 0, fluid: 0 };
  function column(x: number, z: number) {
    const k = `${x},${z}`,
      old = columns.get(k);
    if (old) {
      columns.delete(k);
      columns.set(k, old);
      return old;
    }
    const tx = Math.floor(x / 32),
      tz = Math.floor(z / 32),
      tile = `${tx},${tz}`;
    let area = areas.get(tile);
    if (!area) {
      area = context.prepareArea(
        {
          minX: tx * 32,
          minZ: tz * 32,
          maxX: tx * 32 + 32,
          maxZ: tz * 32 + 32,
        },
        1,
      );
      areas.set(tile, area);
      if (areas.size > 16) areas.delete(areas.keys().next().value as string);
    }
    const data = area.sampleColumn(x + 0.5, z + 0.5, area.createColumn());
    const sky = area.skyInput(
      x + 0.5,
      z + 0.5,
      { solidBelowY: 0, highestFilterY: 0 },
      data,
    );
    const made = {
      area,
      data,
      solidBelow: sky.solidBelowY,
      top: Math.min(WORLD_MAX_Y - 1, Math.ceil(sky.highestFilterY) + 1),
    };
    columns.set(k, made);
    if (columns.size > 4096)
      columns.delete(columns.keys().next().value as string);
    return made;
  }
  function block(x: number, y: number, z: number) {
    if (
      x < WORLD_MIN_XZ ||
      z < WORLD_MIN_XZ ||
      x >= WORLD_MAX_XZ ||
      z >= WORLD_MAX_XZ ||
      y >= WORLD_MAX_Y
    )
      return 0;
    const c = column(x, z);
    return c.area.sampleVoxel(x + 0.5, y + 0.5, z + 0.5, voxel, c.data).block;
  }
  return {
    column,
    block,
    solid: (x: number, y: number, z: number) =>
      BLOCK_REGISTRY[block(x, y, z)]?.solid === true,
    grounded: (x: number, y: number, z: number) =>
      y + 0.5 <= column(x, z).solidBelow,
    density(x: number, y: number, z: number) {
      const c = column(Math.floor(x), Math.floor(z));
      return c.area.sampleVoxel(x, y, z, voxel).density;
    },
    resident() {
      return {
        preparedAreas: areas.size,
        columns: columns.size,
        typedColumnBytes: [...columns.values()].reduce(
          (sum, c) => sum + c.data.byteLength,
          0,
        ),
        featureCounts: context.featureCacheStats?.() ?? null,
      };
    },
  };
}

export async function sampleSpatial(
  context: WorldContext,
  candidates: readonly { x: number; z: number }[],
  patchCount: number,
  maxComponentVoxels: number,
  control: WorkControl = {},
) {
  if (!Number.isInteger(patchCount) || patchCount < 1 || patchCount > 100)
    throw new Error("Spatial patches must be 1..100");
  if (!candidates.length)
    throw new Error("No dominant hellscape points for spatial sampling");
  const selected = Array.from(
    { length: Math.min(patchCount, candidates.length) },
    (_, i) =>
      candidates[
        Math.floor(
          ((i + 0.5) * candidates.length) /
            Math.min(patchCount, candidates.length),
        )
      ] as { x: number; z: number },
  );
  const patches: { cx: number; cy: number; cz: number }[] = [],
    slopeBins = [0, 0, 0],
    componentRows: {
      start: Voxel;
      status: string;
      examined: number;
      minimum: Voxel;
    }[] = [];
  let surfaceCells = 0,
    walkable = 0,
    missingSurfaces = 0,
    invalidNormals = 0,
    spires = 0,
    floating = 0,
    unresolved = 0;
  const seenChunks = new Set<string>();
  for (const point of selected) {
    await checkpoint(control);
    const sampler = spatialSampler(context),
      cx = Math.floor(point.x / 32),
      cz = Math.floor(point.z / 32);
    const initial = sampler.column(cx * 32 + 16, cz * 32 + 16),
      cy = Math.floor(Number(initial.data[context.columns.height]) / 32);
    if (seenChunks.has(`${cx},${cy},${cz}`)) continue;
    seenChunks.add(`${cx},${cy},${cz}`);
    patches.push({ cx, cy, cz });
    const heights = new Map<string, number | null>();
    const top = (x: number, z: number) => {
      const k = `${x},${z}`;
      if (heights.has(k)) return heights.get(k) ?? null;
      const c = sampler.column(x, z);
      for (
        let y = c.top;
        y >= Math.max(WORLD_MIN_Y, Math.floor(c.solidBelow) - 1);
        y--
      )
        if (sampler.solid(x, y, z)) {
          heights.set(k, y);
          return y;
        }
      heights.set(k, null);
      return null;
    };
    for (let z = cz * 32; z < cz * 32 + 32; z++) {
      await checkpoint(control);
      for (let x = cx * 32; x < cx * 32 + 32; x++) {
        const y = top(x, z);
        if (y === null) {
          missingSurfaces++;
          continue;
        }
        surfaceCells++;
        // Top voxel's continuous zero crossing; density normals include thorns,
        // never use height-field gradients for the final surface slope.
        let low = y + 0.5,
          high = y + 1.5;
        for (let i = 0; i < 8; i++) {
          const mid = (low + high) / 2;
          if (sampler.density(x + 0.5, mid, z + 0.5) > 0) low = mid;
          else high = mid;
        }
        const sy = (low + high) / 2,
          gx =
            sampler.density(x + 1, sy, z + 0.5) -
            sampler.density(x, sy, z + 0.5),
          gy =
            sampler.density(x + 0.5, sy + 0.5, z + 0.5) -
            sampler.density(x + 0.5, sy - 0.5, z + 0.5),
          gz =
            sampler.density(x + 0.5, sy, z + 1) -
            sampler.density(x + 0.5, sy, z);
        if (
          ![gx, gy, gz].every(Number.isFinite) ||
          Math.hypot(gx, gy, gz) === 0 ||
          !(sampler.density(x + 0.5, y + 0.5, z + 0.5) > 0) ||
          sampler.density(x + 0.5, y + 1.5, z + 0.5) > 0
        )
          invalidNormals++;
        else {
          const angle =
            (Math.atan2(Math.hypot(gx, gz), Math.abs(gy)) * 180) / Math.PI;
          const bin = angle < 30 ? 0 : angle <= 50 ? 1 : 2;
          slopeBins[bin] = (slopeBins[bin] as number) + 1;
        }
        const neighbours = [
          top(x - 1, z),
          top(x + 1, z),
          top(x, z - 1),
          top(x, z + 1),
        ];
        if (
          neighbours.every((h) => h !== null && Math.abs(h - y) <= 1) &&
          sampler.block(x, y + 1, z) === 0 &&
          sampler.block(x, y + 2, z) === 0
        )
          walkable++;
      }
    }
    const seen = new Set<string>(),
      grounded = new Set<string>();
    for (let z = cz * 32; z < cz * 32 + 32; z++) {
      await checkpoint(control);
      for (let x = cx * 32; x < cx * 32 + 32; x++)
        for (let y = cy * 32; y < cy * 32 + 32; y++) {
          if (!sampler.solid(x, y, z)) continue;
          // One-block sticks: >=3 vertically contiguous solids with four open
          // horizontal neighbours. Own the top voxel to avoid chunk duplicates.
          if (!sampler.solid(x, y + 1, z)) {
            let length = 0,
              yy = y;
            while (
              yy >= WORLD_MIN_Y &&
              sampler.solid(x, yy, z) &&
              !sampler.solid(x - 1, yy, z) &&
              !sampler.solid(x + 1, yy, z) &&
              !sampler.solid(x, yy, z - 1) &&
              !sampler.solid(x, yy, z + 1)
            ) {
              length++;
              yy--;
            }
            if (length >= 3) spires++;
          }
          const k = key(x, y, z);
          if (seen.has(k) || sampler.grounded(x, y, z)) continue;
          const row = traceComponent(
            [x, y, z],
            sampler,
            maxComponentVoxels,
            grounded,
            control.signal,
          );
          for (const k of row.visited) seen.add(k);
          if (row.status === "capped") unresolved++;
          const m = row.minimum,
            owns =
              m[0] >= cx * 32 &&
              m[0] < cx * 32 + 32 &&
              m[1] >= cy * 32 &&
              m[1] < cy * 32 + 32 &&
              m[2] >= cz * 32 &&
              m[2] < cz * 32 + 32;
          if (row.status === "floating" && owns) floating++;
          if (row.status !== "grounded")
            componentRows.push({
              start: [x, y, z],
              status: row.status,
              examined: row.visited.size,
              minimum: row.minimum,
            });
        }
    }
  }
  return {
    policy:
      "Deterministic evenly spaced selections in z-major order of dominant-hellscape coverage lattice; each is a 32x32 surface patch at 1m and one ground-intersecting 32^3 component/spire core. Topmost collidable voxel plus two-block clearance; four cardinal 1m rises. Density central-difference normals at bisected top crossing, not macro gradients. This sampled ground-band diagnostic is not a whole-region or all-height voxel census.",
    patches,
    surfaceCells,
    missingSurfaces,
    invalidNormals,
    slopes: {
      lessThan30: slopeBins[0],
      from30to50: slopeBins[1],
      greaterThan50: slopeBins[2],
      denominator: surfaceCells - invalidNormals,
    },
    walkable: band(
      walkable,
      surfaceCells,
      [0.15, 1],
      "all resolved topmost surface cells of listed 1m patches, including fluid-covered surfaces as nonwalkable",
    ),
    components: {
      policy:
        "6-connected solids traced beyond core boundaries to a production proven-all-solid ground bound or complete closure. Canonical lexicographic minimum owns each closed floater. Capped traces are unresolved and never counted as floaters; reported floater rate is a lower bound when capped.",
      maxComponentVoxels,
      chunks: patches.length,
      floating,
      per100Chunks: patches.length ? (floating * 100) / patches.length : null,
      unresolved,
      rows: componentRows,
    },
    spires: {
      policy:
        "Vertical run >=3 solids with all four horizontal neighbours open; count only when the run top belongs to the sampled chunk core, inspect outside boundaries.",
      count: spires,
      per100Chunks: patches.length ? (spires * 100) / patches.length : null,
    },
    status:
      unresolved || missingSurfaces || invalidNormals || surfaceCells === 0
        ? "incomplete"
        : walkable / surfaceCells >= 0.15
          ? "pass"
          : "fail",
  };
}

/** Actual topology records and invariant failures, never target counts presented as observations. */
export function topologyStatistics(plan: IbaraReview["plan"]) {
  const failures: string[] = [],
    ids = new Set(plan.calderas.map((c) => c.id));
  const channels = plan.channels.map((channel) => {
    const p = channel.points;
    let length = 0,
      rises = 0,
      invalidBeds = 0;
    if (!ids.has(channel.calderaId))
      failures.push(
        `channel ${channel.id}: unknown caldera ${channel.calderaId}`,
      );
    for (let i = 0; i < p.length; i += 5) {
      if (!(Number(p[i + 2]) < Number(p[i + 3]))) invalidBeds++;
      if (i >= 5) {
        length += Math.hypot(
          Number(p[i]) - Number(p[i - 5]),
          Number(p[i + 1]) - Number(p[i - 4]),
        );
        if (Number(p[i + 3]) > Number(p[i - 2]) + 1e-9) rises++;
      }
    }
    if (rises || invalidBeds || p.length < 10 || p.length % 5)
      failures.push(`channel ${channel.id}: malformed/rising/invalid bed`);
    return {
      id: channel.id,
      calderaId: channel.calderaId,
      vertices: p.length / 5,
      length,
      sink: channel.sink,
      rises,
      invalidBeds,
    };
  });
  const routing = plan.routing,
    position = new Int32Array(routing.receivers.length).fill(-1);
  for (let i = 0; i < routing.routingOrder.length; i++) {
    const node = Number(routing.routingOrder[i]);
    if (node < 0 || node >= position.length || position[node] !== -1)
      failures.push(`routing order invalid at ${i}`);
    else position[node] = i;
  }
  let outlets = 0,
    linked = 0,
    invalidReceivers = 0;
  for (let i = 0; i < routing.receivers.length; i++) {
    const r = Number(routing.receivers[i]);
    if (r === -1) outlets++;
    else if (
      r < 0 ||
      r >= position.length ||
      Number(position[r]) >= Number(position[i])
    )
      invalidReceivers++;
    else linked++;
  }
  if (invalidReceivers || position.some((v) => v < 0))
    failures.push("routing receiver order invalid or incomplete");
  return {
    calderas: plan.calderas.map((c) => ({
      id: c.id,
      x: c.x,
      z: c.z,
      diameter: 2 * c.radius,
      rimHeight: c.rimHeight,
      lavaLevel: c.lavaLevel,
    })),
    channels,
    vents: plan.vents.length,
    routing: { grid: routing.grid, outlets, linked, invalidReceivers },
    failures,
    status: failures.length ? "fail" : "pass",
  };
}
