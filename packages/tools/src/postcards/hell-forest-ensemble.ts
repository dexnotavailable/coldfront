import { IBARA_CELL_SIZE } from "../../../shared/src/features/ibara/cells.js";
import type { ThornParameters } from "../../../shared/src/features/ibara/types.js";
import type { XZ } from "../../../shared/src/world/types.js";
import { cameraFrame, type MainCameraCandidate } from "./geometry.js";
import type { FramingLavaWitness } from "./hell-framing-camera.js";

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
/** Use conservative envelopes to prefer stand-off and complete ensemble
 * framing. The full grid and built-spine readability remain the proof. */
export function ensembleFramingScore(
  view: MainCameraCandidate,
  site: ForestEnsemble,
): number {
  const frame = cameraFrame(view);
  let score = 0;
  for (const p of [site.hook, site.branch]) {
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
    score += Math.max(-60, Math.min(60, margin)) + (margin >= 24 ? 40 : 0);
  }
  return score;
}
