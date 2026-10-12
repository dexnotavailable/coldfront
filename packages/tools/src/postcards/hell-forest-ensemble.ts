import { IBARA_CELL_SIZE } from "../../../shared/src/features/ibara/cells.js";
import type {
  ThornInstance,
  ThornParameters,
} from "../../../shared/src/features/ibara/types.js";
import type { XZ } from "../../../shared/src/world/types.js";
import { cameraFrame, type MainCameraCandidate } from "./geometry.js";
import {
  type FramingLavaWitness,
  framingEnvelope,
} from "./hell-framing-camera.js";
import { HELL_READABILITY_LIMITS } from "./hell-readability.js";

/** Parameter nomination only. These ceilings do not add camera-grid slots. */
export const FOREST_ENSEMBLE_BUDGET = Object.freeze({
  cellRadius: 8,
  cells: 289,
  nominations: 32,
  rawWitnessesPerNomination: 24,
  sites: 3,
  siteSeparation: 384,
  witnessesPerSite: 8,
  witnesses: 24,
  rootRadius: 144,
  bankPositionsPerWitness: 40,
  focusMembersPerSite: 40,
  focusPairsPerEye: 3,
});
export type ForestEnsembleMember = Pick<
  ThornParameters,
  | "id"
  | "cellX"
  | "cellZ"
  | "cluster"
  | "base"
  | "height"
  | "baseRadius"
  | "leanDegrees"
  | "bend"
  | "hooked"
  | "broken"
  | "branchCount"
  | "landmark"
  | "arch"
>;
export interface ForestEnsemble {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly hook: ForestEnsembleMember;
  readonly branch: ForestEnsembleMember;
  readonly members: readonly ForestEnsembleMember[];
  readonly score: number;
}
export type EnsembleFissureWitness = FramingLavaWitness & {
  readonly ensemble: ForestEnsemble;
};
export interface BankFocusPair {
  readonly ensemble: ForestEnsemble;
  readonly aim: XZ;
  readonly standOffRisk: number;
}
/** Select at most three source pairs for an already observed bank eye. This
 * replaces the three yaw headings; it does not add camera or ground queries.
 * Parameter risk only nominates; whole built envelopes are required below. */
export function bankFocusPairs(
  site: ForestEnsemble,
  wet: FramingLavaWitness,
  eye: Readonly<{ x: number; y: number; z: number }>,
  instanceFor: (id: number) => ThornInstance | undefined,
): BankFocusPair[] {
  const members = [...site.members]
    .sort((a, b) => a.id - b.id)
    .slice(0, FOREST_ENSEMBLE_BUDGET.focusMembersPerSite)
    .filter(
      (p) =>
        !p.landmark &&
        !p.arch &&
        !p.broken &&
        Math.hypot(p.base[0] - wet.x, p.base[2] - wet.z) <=
          FOREST_ENSEMBLE_BUDGET.rootRadius,
    );
  const hooks = members.filter(
    (p) => p.hooked && p.height >= 18 && p.height <= 60,
  );
  const branches = members.filter((p) => p.branchCount > 0);
  const tangent = Math.tan((35 * Math.PI) / 180);
  const risk = (p: ForestEnsembleMember) => {
    const distance = Math.hypot(p.base[0] - eye.x, p.base[2] - eye.z);
    const clearance = lateralReach(p);
    const rise =
      Math.max(
        Math.abs(p.base[1] - eye.y),
        Math.abs(p.base[1] + p.height - eye.y),
      ) + p.baseRadius;
    const minimum = rise / tangent + clearance;
    const maximum =
      (360 * p.height) / (tangent * HELL_READABILITY_LIMITS.usefulHeight);
    return (
      (Math.max(0, minimum - distance) + Math.max(0, distance - maximum)) /
      p.height
    );
  };
  const choices: {
    hook: ForestEnsembleMember;
    branch: ForestEnsembleMember;
    risk: number;
    alignment: number;
  }[] = [];
  const wetX = wet.x - eye.x,
    wetZ = wet.z - eye.z,
    wetDistance = Math.hypot(wetX, wetZ);
  for (const hook of hooks)
    for (const branch of branches) {
      if (
        hook.id === branch.id ||
        Math.hypot(
          hook.base[0] - branch.base[0],
          hook.base[2] - branch.base[2],
        ) > 110
      )
        continue;
      const dx = (hook.base[0] + branch.base[0]) / 2 - eye.x,
        dz = (hook.base[2] + branch.base[2]) / 2 - eye.z;
      choices.push({
        hook,
        branch,
        risk: risk(hook) + risk(branch),
        alignment:
          1 -
          (dx * wetX + dz * wetZ) /
            Math.max(1, Math.hypot(dx, dz) * wetDistance),
      });
    }
  choices.sort(
    (a, b) =>
      a.risk - b.risk ||
      a.alignment - b.alignment ||
      a.hook.id - b.hook.id ||
      a.branch.id - b.branch.id,
  );
  const unions = new Set<string>();
  return choices
    .filter(({ hook, branch }) => {
      const key = `${Math.min(hook.id, branch.id)}:${Math.max(hook.id, branch.id)}`;
      if (unions.has(key)) return false;
      // The total ordering above retains the lower-ID hook role when both
      // assignments describe the same two dual-family source instances.
      unions.add(key);
      return true;
    })
    .slice(0, FOREST_ENSEMBLE_BUDGET.focusPairsPerEye)
    .flatMap((choice) => {
      const hook = instanceFor(choice.hook.id),
        branch = instanceFor(choice.branch.id);
      if (
        !hook ||
        !branch ||
        hook.parameters.id !== choice.hook.id ||
        branch.parameters.id !== choice.branch.id
      )
        return [];
      const bounds = [
        ...hook.sweeps.slice(0, 1 + hook.parameters.branchCount),
        ...branch.sweeps.slice(0, 1 + branch.parameters.branchCount),
      ].map((s) => s.bounds);
      if (!bounds.length) return [];
      const aim = {
        x:
          (Math.min(...bounds.map((b) => b.minX)) +
            Math.max(...bounds.map((b) => b.maxX))) /
          2,
        z:
          (Math.min(...bounds.map((b) => b.minZ)) +
            Math.max(...bounds.map((b) => b.maxZ))) /
          2,
      };
      return [
        {
          ensemble: {
            ...site,
            members: [...site.members].sort((a, b) => a.id - b.id),
            hook: hook.parameters,
            branch: branch.parameters,
            x: aim.x,
            z: aim.z,
          },
          aim,
          standOffRisk: choice.risk,
        },
      ];
    });
}
/** Applied only after support/body and an actual owned wet first hit have been
 * observed from this same eye. Projection never substitutes for that proof. */
export function bankPairAdmission(
  view: MainCameraCandidate,
  pair: ForestEnsemble,
  wet: FramingLavaWitness,
  instanceFor: (id: number) => ThornInstance | undefined,
) {
  const reasons: string[] = [];
  const hook = instanceFor(pair.hook.id),
    branch = instanceFor(pair.branch.id);
  if (
    !hook ||
    !branch ||
    hook.parameters.id !== pair.hook.id ||
    branch.parameters.id !== pair.branch.id ||
    !hook.parameters.hooked ||
    hook.parameters.broken ||
    hook.parameters.landmark ||
    hook.parameters.arch ||
    branch.parameters.branchCount < 1 ||
    branch.parameters.broken ||
    branch.parameters.landmark ||
    branch.parameters.arch
  )
    reasons.push("source-focus-unavailable-or-broken");
  const forms = [hook, branch].flatMap((instance) =>
    instance
      ? [
          {
            id: instance.parameters.id,
            ...framingEnvelope(view, instance),
            eyeDistance: Math.hypot(
              view.position.x - instance.parameters.base[0],
              view.position.z - instance.parameters.base[2],
            ),
          },
        ]
      : [],
  );
  for (const form of forms)
    if (!form.complete) reasons.push(`focus-${form.id}-cropped`);
    else if (!form.useful) reasons.push(`focus-${form.id}-too-small`);
  const point = cameraFrame(view).project(wet);
  if (
    ![wet.x, wet.y, wet.z].every(
      (value) => Number.isFinite(value) && Number.isInteger(value - 0.5),
    ) ||
    point.depth <= 0 ||
    point.depth > view.radius ||
    point.x < 0 ||
    point.x > 1280 ||
    point.y < 0 ||
    point.y > 720
  )
    reasons.push("wet-point-out-of-frame");
  return { admitted: reasons.length === 0, reasons, forms, wet: point };
}
const distance = (a: XZ, b: XZ) => Math.hypot(a.x - b.x, a.z - b.z);
const base = (p: ForestEnsembleMember): XZ => ({ x: p.base[0], z: p.base[2] });
function hasVocabulary(members: readonly ForestEnsembleMember[]): boolean {
  return (
    members.some((p) => p.broken) &&
    new Set(members.map((p) => (p.height < 30 ? 0 : p.height < 60 ? 1 : 2)))
      .size === 3
  );
}
/** A conservative parameter envelope, including a leaning short body's reach.
 * It ranks proposals; it never certifies a built contour or hides a neighbour. */
function lateralReach(p: ForestEnsembleMember): number {
  return (
    p.height * Math.sin((p.leanDegrees * Math.PI) / 180) +
    Math.abs(p.bend) +
    2 * p.baseRadius
  );
}
/** Accepted parameters are supplied by the unchanged production field. A fixed
 * cell window reaches different forests instead of taking 24 wet points nearest
 * one anchor. These are ranked nominations, not the final three wet-qualified
 * sites. No saved inventory, seed IDs, geometry construction or ray casts. */
export function ordinaryForestEnsembles(
  anchor: XZ,
  parametersForCell: (x: number, z: number) => readonly ForestEnsembleMember[],
): ForestEnsemble[] {
  const accepted = new Map<number, ForestEnsembleMember>();
  const cellX = Math.floor(anchor.x / IBARA_CELL_SIZE),
    cellZ = Math.floor(anchor.z / IBARA_CELL_SIZE),
    radius = FOREST_ENSEMBLE_BUDGET.cellRadius;
  for (let z = cellZ - radius; z <= cellZ + radius; z++)
    for (let x = cellX - radius; x <= cellX + radius; x++)
      for (const p of parametersForCell(x, z))
        if (!p.landmark && !p.arch) accepted.set(p.id, p);
  const population = [...accepted.values()].sort((a, b) => a.id - b.id);
  const clusters = new Map<string, ForestEnsembleMember[]>();
  for (const p of population) {
    const key = `${p.cellX}:${p.cellZ}:${p.cluster}`;
    const group = clusters.get(key) ?? [];
    group.push(p);
    clusters.set(key, group);
  }
  const choices: ForestEnsemble[] = [];
  for (const [id, members] of clusters) {
    if (!hasVocabulary(members)) continue;
    const hooks = members.filter(
      (p) => p.hooked && !p.broken && p.height >= 18 && p.height <= 60,
    );
    const branches = members.filter((p) => p.branchCount > 0 && !p.broken);
    for (const hook of hooks)
      for (const branch of branches) {
        if (hook.id === branch.id) continue;
        const separation = distance(base(hook), base(branch));
        if (separation > 110) continue;
        const centre = {
          x: (hook.base[0] + branch.base[0]) / 2,
          z: (hook.base[2] + branch.base[2]) / 2,
        };
        // Nearby broad or strongly leaning bodies are a crop/occlusion risk,
        // including short ones. They stay in the population and final frame.
        const crowding = population.reduce((sum, p) => {
          const d = distance(centre, base(p));
          if (d > FOREST_ENSEMBLE_BUDGET.rootRadius) return sum;
          return sum + Math.max(0, lateralReach(p) + 12 - d);
        }, 0);
        choices.push({
          id,
          ...centre,
          hook,
          branch,
          members,
          score:
            -Math.abs(hook.height - 30) -
            Math.abs(branch.height - 50) * 0.5 -
            Math.abs(separation - 60) * 0.3 -
            crowding * 0.2,
        });
      }
  }
  choices.sort(
    (a, b) =>
      b.score - a.score ||
      distance(a, anchor) - distance(b, anchor) ||
      a.hook.id - b.hook.id ||
      a.branch.id - b.branch.id,
  );
  const selected: ForestEnsemble[] = [];
  for (const choice of choices) {
    if (selected.some((site) => site.id === choice.id)) continue;
    selected.push(choice);
    if (selected.length === FOREST_ENSEMBLE_BUDGET.nominations) break;
  }
  return selected;
}
/** Admit at most three distinct sites AFTER an owned wet nomination retains
 * the vocabulary inside its 144 m coverage disc. A dry high-ranked nomination
 * cannot consume a final site slot. Actual first-hit proof still follows. */
export function ensembleFissureWitnesses(
  sites: readonly ForestEnsemble[],
  witnessesFor: (anchor: XZ) => readonly FramingLavaWitness[],
  record: (event: Readonly<Record<string, unknown>>) => void = () => {},
): EnsembleFissureWitness[] {
  const used = new Set<number>();
  const accepted: ForestEnsemble[] = [];
  const groups: EnsembleFissureWitness[][] = [];
  const cache = new Map<string, readonly FramingLavaWitness[]>();
  for (const [nomination, ensemble] of sites
    .slice(0, FOREST_ENSEMBLE_BUDGET.nominations)
    .entries()) {
    const key = `${ensemble.x},${ensemble.z}`;
    const cached = cache.get(key);
    const raw =
      cached ??
      witnessesFor(ensemble).slice(
        0,
        FOREST_ENSEMBLE_BUDGET.rawWitnessesPerNomination,
      );
    cache.set(key, raw);
    const predicates = raw.map((witness) => {
      const within = (p: ForestEnsembleMember) =>
        distance(witness, base(p)) <= FOREST_ENSEMBLE_BUDGET.rootRadius;
      const members = ensemble.members.filter(within);
      return {
        witness,
        hookWithin144: within(ensemble.hook),
        branchWithin144: within(ensemble.branch),
        brokenWithin144: members.some((p) => p.broken),
        allSizesWithin144:
          new Set(
            members.map((p) => (p.height < 30 ? 0 : p.height < 60 ? 1 : 2)),
          ).size === 3,
      };
    });
    const qualified = predicates
      .filter(
        (p) =>
          p.hookWithin144 &&
          p.branchWithin144 &&
          p.brokenWithin144 &&
          p.allSizesWithin144,
      )
      .map((p) => p.witness)
      .sort(
        (a, b) =>
          distance(a, ensemble) - distance(b, ensemble) ||
          a.fissureId - b.fissureId ||
          a.x - b.x ||
          a.z - b.z ||
          a.y - b.y,
      )
      .map((witness) => ({ ...witness, ensemble }));
    const nearby = accepted.some(
      (site) =>
        site.id === ensemble.id ||
        distance(site, ensemble) < FOREST_ENSEMBLE_BUDGET.siteSeparation,
    );
    record({
      stage: "forest-ensemble-wet-admission",
      nomination,
      ensembleId: ensemble.id,
      centre: { x: ensemble.x, z: ensemble.z },
      cachedWitnessQuery: cached !== undefined,
      rawWitnesses: raw.length,
      qualifiedWitnesses: qualified.length,
      predicatePassCounts: {
        hookWithin144: predicates.filter((p) => p.hookWithin144).length,
        branchWithin144: predicates.filter((p) => p.branchWithin144).length,
        brokenWithin144: predicates.filter((p) => p.brokenWithin144).length,
        allSizesWithin144: predicates.filter((p) => p.allSizesWithin144).length,
      },
      status: !qualified.length
        ? "rejected-no-joint-witness"
        : nearby
          ? "rejected-near-accepted-site"
          : "admitted",
    });
    if (!qualified.length || nearby) continue;
    accepted.push(ensemble);
    groups.push(qualified);
    if (accepted.length === FOREST_ENSEMBLE_BUDGET.sites) break;
  }
  const selected: EnsembleFissureWitness[] = [];
  for (let round = 0; round < FOREST_ENSEMBLE_BUDGET.witnessesPerSite; round++)
    for (const group of groups) {
      while (
        group.length &&
        used.has((group[0] as FramingLavaWitness).fissureId)
      )
        group.shift();
      const witness = group.shift();
      if (!witness) continue;
      used.add(witness.fissureId);
      selected.push(witness);
    }
  return selected;
}
/** Production uses whole built envelopes to prefer stand-off and complete
 * ensemble framing; parameter-only callers retain a conservative fallback.
 * Ranking is not visibility proof: full-grid readability still follows. */
export function ensembleFramingScore(
  view: MainCameraCandidate,
  site: ForestEnsemble,
  instanceFor?: (id: number) => ThornInstance | undefined,
): number {
  const frame = cameraFrame(view);
  let score = 0;
  for (const p of [site.hook, site.branch]) {
    if (instanceFor) {
      const instance = instanceFor(p.id);
      if (!instance)
        throw Error(`Missing source-bound ensemble instance: ${p.id}`);
      // Whole built spine, hook return and branches with their actual radii.
      // A deeply cropped ordinary root must not tie a modest near miss at -60.
      const { margin } = framingEnvelope(view, instance);
      score += Number.isFinite(margin)
        ? Math.min(60, margin) + (margin >= 24 ? 40 : 0)
        : -1_000_000;
      continue;
    }
    const radius = lateralReach(p),
      bottom = p.base[1],
      top = bottom + p.height;
    let margin = Infinity;
    for (const x of [p.base[0] - radius, p.base[0] + radius])
      for (const z of [p.base[2] - radius, p.base[2] + radius])
        for (const y of [bottom, top]) {
          const point = frame.project({ x, y, z });
          margin = Math.min(
            margin,
            point.depth <= 5
              ? -720
              : Math.min(point.x, 1280 - point.x, point.y, 720 - point.y),
          );
        }
    score += Math.min(60, margin) + (margin >= 24 ? 40 : 0);
  }
  return score;
}
