import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { validatePostcardSelection } from "../../../client/src/bootstrap/postcard.js";
import type { PostcardId } from "../../../client/src/game/postcard.js";
import { Block } from "../../../shared/src/blocks/registry.js";
import type { ThornInstance } from "../../../shared/src/features/ibara/types.js";
import type { Aabb } from "../../../shared/src/sdf/types.js";
import type { GenerationVariant } from "../../../shared/src/world/generation-variant.js";
import type {
  IbaraCalderaData,
  LavaSample,
  XZ,
  XZBounds,
} from "../../../shared/src/world/types.js";
import { createWorldContext } from "../../../shared/src/world/world-context.js";
import { createMainIbaraField } from "../../../shared/src/worldgen/main/features.js";
import {
  createPrimitiveIbaraBatch,
  PRIMITIVE_IBARA_HEIGHT,
  PRIMITIVE_IBARA_RADIUS,
} from "../../../shared/src/worldgen/main/ibara-primitive.js";
import {
  createIbaraAnalytic,
  type IbaraAnalytic,
  PLATE_CELL,
} from "../../../shared/src/worldgen/main/ibara-volcanic.js";
import { createMainField } from "../../../shared/src/worldgen/main/surface.js";
import { WORLDGEN_VERSION } from "../../../shared/src/worldgen/version.js";
import { createLavaSample } from "../../../shared/src/worldplan/lava.js";
import { postcardResolverHash, sourceFingerprints } from "../build/metadata.js";
import {
  type CameraFirstHit,
  cameraFrame,
  cameraPoseRejections,
  type HellCameraValidation,
  type HellTarget,
  inspectHellCamera,
  type MainCameraCandidate,
  supportingVoxelTop,
} from "./geometry.js";
import {
  bankFocusPairs,
  bankPairAdmission,
  ensembleFissureWitnesses,
  ensembleFramingScore,
  FOREST_ENSEMBLE_BUDGET,
  type ForestEnsemble,
  ordinaryForestEnsembles,
} from "./hell-forest-ensemble.js";
import {
  FOREST_CAMERA_PITCHES,
  type FramingLavaWitness,
  type FramingObservation,
  PRODUCTION_CAMERA_BUDGET,
  productionFramingCandidates,
} from "./hell-framing-camera.js";
import { createFramingPreflight } from "./hell-framing-preflight.js";
import {
  PRIMITIVE_CAMERA_BUDGET,
  primitiveCameraRefinements,
} from "./hell-primitive-camera.js";
import {
  type HellReadability,
  inspectHellReadability,
} from "./hell-readability.js";
import {
  createVisibleThornResolver,
  type VisibleThornLookupReceipt,
} from "./hell-visible-instances.js";
import { loadPlan, type MainCameraManifest } from "./main-resolve.js";
import { type CameraQuery, cameraQuery, walkableEye } from "./query.js";

export type HellPostcardId = "HELL-1" | "HELL-2";
export interface ResolvedHellCamera extends MainCameraCandidate {
  readonly id: HellPostcardId;
  readonly region: "hellscape";
  readonly kind: "eye-level";
  readonly seed: number;
  readonly ungraded: true;
  readonly targetFeature: HellTarget;
  readonly validation: HellCameraValidation;
  readonly score: number;
  readonly readability?: HellReadability;
  readonly readabilitySetup?: VisibleThornLookupReceipt;
  readonly lavaWitnesses?: readonly FramingLavaWitness[];
  readonly validatedByResolverHash: string;
  /** A completed optimization search, never a visual acceptance receipt. */
  readonly completedSearch?: {
    readonly schema: 1;
    readonly seed: number;
    readonly worldgenVersion: number;
    readonly sourceHash: string;
    readonly resolverHash: string;
    readonly variant: GenerationVariant;
    readonly selectedViewHash: string;
    readonly fullGridCandidates: number;
    readonly fullGridBudget: 50;
    readonly termination:
      | "composition-goal"
      | "budget"
      | "candidates-exhausted";
  };
  readonly comparison?: {
    readonly productionView: "matched" | "diverged" | "unavailable";
    readonly reason: string;
  };
}
export interface HellCameraManifest {
  readonly schema: 1;
  readonly worldKind: "main";
  readonly seed: number;
  readonly worldgenVersion: number;
  readonly sourceHash: string;
  readonly resolverHash: string;
  readonly variant: GenerationVariant;
  readonly cameras: readonly ResolvedHellCamera[];
  readonly resolution: MainCameraManifest["resolution"];
  readonly attemptsPath: string;
}
type Attempt = Readonly<Record<string, unknown>>;
export type FissureWitness = FramingLavaWitness & {
  readonly ensemble?: ForestEnsemble;
};
/** Actual lava first hits only; a target label or an analytic wet point alone
 * cannot seed a bank pair. The same centre/owner test as the full-grid gate. */
export function observedFissureWitnesses(
  hits: readonly CameraFirstHit[],
  lava: (x: number, z: number) => Readonly<LavaSample>,
): readonly FramingLavaWitness[] {
  const found = new Map<string, FramingLavaWitness>();
  for (const hit of hits) {
    if (hit.block !== Block.Lava) continue;
    const x = Math.floor(hit.x) + 0.5,
      y = Math.floor(hit.y) + 0.5,
      z = Math.floor(hit.z) + 0.5,
      owner = lava(x, z);
    if (
      owner.kind !== "lava" ||
      owner.source !== "fissure" ||
      y <= owner.bed ||
      y > owner.level
    )
      continue;
    const witness = { fissureId: owner.bodyId, x, y, z };
    found.set(`${witness.fissureId}:${x}:${y}:${z}`, witness);
  }
  return [...found.values()].sort(
    (a, b) => a.fissureId - b.fissureId || a.x - b.x || a.z - b.z || a.y - b.y,
  );
}
export interface ForestRoot {
  readonly id: number;
  readonly x: number;
  readonly y?: number;
  readonly z: number;
  readonly height: number;
  readonly radius: number;
}
type RootDisc = Readonly<{ x: number; z: number; radius: number }>;
/** Proposal preference only: exact built contours and occlusion are checked
 * later. Nominal height is deliberately not accepted as geometry evidence. */
export function forestFramingScore(
  view: MainCameraCandidate,
  roots: readonly ForestRoot[],
): number {
  const project = cameraFrame(view).project;
  let score = 0,
    largestArea = 0,
    largestComplete = false;
  const sizes = new Set<number>();
  for (const root of roots) {
    const bottom = project({
        x: root.x,
        y: root.y ?? view.position.y - 1.62,
        z: root.z,
      }),
      top = project({
        x: root.x,
        y: (root.y ?? view.position.y - 1.62) + root.height,
        z: root.z,
      });
    if (bottom.depth <= 5 || bottom.x < -160 || bottom.x > 1440) continue;
    const height = Math.abs(top.y - bottom.y),
      width = 2 * root.radius * bottom.pixelsPerMetre;
    const area = Math.min(720, height) * Math.min(1280, width);
    const complete =
      top.y >= 24 &&
      bottom.y <= 696 &&
      bottom.x - width / 2 >= 24 &&
      bottom.x + width / 2 <= 1256;
    if (area > largestArea) {
      largestArea = area;
      largestComplete = complete;
    }
    if (complete && height >= 72) {
      score += Math.min(3, height / 90) * Math.min(1, width / 20);
      sizes.add(root.height < 30 ? 0 : root.height < 60 ? 1 : 2);
    }
  }
  return score + sizes.size * 4 + (largestComplete ? 12 : -20);
}
/** Search objective only (decision115). Geometry alone permits an UNGRADED
 * capture after the bounded search; these diagnostics still guide refinement. */
export function hellSelectionPassed(
  id: HellPostcardId,
  variant: GenerationVariant,
  validation: HellCameraValidation,
  readability?: HellReadability,
): boolean {
  return (
    validation.passed &&
    (id !== "HELL-1" ||
      variant !== "production" ||
      readability?.passed === true)
  );
}
/** Actual family diversity precedes the largest-parent framing bonus. Geometry
 * is always the first ordering key; scores can never rescue an unsafe pose. */
export function compareHellCandidates(
  a: Pick<ResolvedHellCamera, "validation" | "readability" | "score">,
  b: Pick<ResolvedHellCamera, "validation" | "readability" | "score">,
): number {
  const rank = (camera: typeof a): number[] => {
    const read = camera.readability;
    return [
      Number(camera.validation.passed),
      Number(read?.passed === true),
      read
        ? Object.values(read.families).filter((ids) => ids.length > 0).length
        : 0,
      read?.sizeClasses.length ?? 0,
      Number(read?.groundTransition === true),
      camera.score,
    ];
  };
  const left = rank(a),
    right = rank(b);
  for (let i = 0; i < left.length; i++) {
    const difference = Number(left[i]) - Number(right[i]);
    if (difference) return difference;
  }
  return 0;
}
function selectedViewHash(camera: ResolvedHellCamera): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        camera.id,
        camera.region,
        camera.kind,
        camera.seed,
        camera.position.x,
        camera.position.y,
        camera.position.z,
        camera.target.x,
        camera.target.y,
        camera.target.z,
        camera.hours,
        camera.radius,
        camera.terrainUpperBound ?? null,
        camera.targetFeature,
      ]),
    )
    .digest("hex");
}
function completedSearchMatches(
  camera: ResolvedHellCamera,
  manifest: HellCameraManifest | undefined,
  seed: number,
  sourceHash: string,
  resolverHash: string,
  variant: GenerationVariant,
): boolean {
  const search = camera.completedSearch;
  return Boolean(
    search?.schema === 1 &&
      manifest?.resolverHash === resolverHash &&
      camera.validatedByResolverHash === resolverHash &&
      search.seed === seed &&
      search.worldgenVersion === WORLDGEN_VERSION &&
      search.sourceHash === sourceHash &&
      search.resolverHash === resolverHash &&
      search.variant === variant &&
      search.fullGridBudget === 50 &&
      Number.isInteger(search.fullGridCandidates) &&
      search.fullGridCandidates >= 1 &&
      search.fullGridCandidates <= 50 &&
      ["composition-goal", "budget", "candidates-exhausted"].includes(
        search.termination,
      ) &&
      search.selectedViewHash === selectedViewHash(camera),
  );
}
interface ForestCandidate {
  readonly view: MainCameraCandidate;
  readonly targetFeature: HellTarget;
}
/** Only final wet voxel centres owned by this analytic fissure are witnesses.
 * Caldera/channel overrides and sub-voxel wet intervals cannot stand in for it. */
export function nearbyFissureWitnesses(
  anchor: XZ,
  analytic: IbaraAnalytic,
  lava: (x: number, z: number) => Readonly<LavaSample>,
): FissureWitness[] {
  const found = new Map<number, FissureWitness>();
  for (let dz = -10; dz <= 10; dz++)
    for (let dx = -10; dx <= 10; dx++)
      for (const f of analytic.fissures(
        Math.floor(anchor.x / PLATE_CELL) + dx,
        Math.floor(anchor.z / PLATE_CELL) + dz,
      )) {
        if (!f.hot) continue;
        const wet: FissureWitness[] = [];
        for (const t of [0.25, 0.5, 0.75]) {
          const x = Math.floor(f.ax + (f.bx - f.ax) * t) + 0.5,
            z = Math.floor(f.az + (f.bz - f.az) * t) + 0.5;
          const owner = lava(x, z),
            y = Math.floor(owner.level - 0.5) + 0.5;
          if (
            owner.kind === "lava" &&
            owner.source === "fissure" &&
            owner.bodyId === f.id &&
            y > owner.bed &&
            y <= owner.level
          )
            wet.push({ fissureId: f.id, x, y, z });
        }
        const witness = wet[Math.floor(wet.length / 2)];
        if (witness) found.set(f.id, witness);
      }
  return [...found.values()]
    .sort(
      (a, b) =>
        Math.hypot(a.x - anchor.x, a.z - anchor.z) -
          Math.hypot(b.x - anchor.x, b.z - anchor.z) ||
        a.fissureId - b.fissureId,
    )
    .slice(0, 24);
}
export function boundedForestRoots(
  roots: readonly ForestRoot[],
  disc: RootDisc,
): ForestRoot[] {
  return roots
    .filter(
      (root) => Math.hypot(root.x - disc.x, root.z - disc.z) <= disc.radius,
    )
    .sort((a, b) => a.id - b.id);
}
function seesFissure(
  view: MainCameraCandidate,
  witness: FissureWitness,
  query: CameraQuery,
  lava: (x: number, z: number) => Readonly<LavaSample>,
  onFirstHit?: (hit: Attempt) => void,
): boolean {
  const p = view.position,
    dx = witness.x - p.x,
    dy = witness.y - p.y,
    dz = witness.z - p.z,
    length = Math.hypot(dx, dy, dz);
  for (let d = 0.5; d <= length + 0.5; d += 0.5) {
    const t = Math.min(1, d / length),
      x = p.x + dx * t,
      y = p.y + dy * t,
      z = p.z + dz * t,
      hit = query.voxel(x, y, z);
    if (hit.density > 0 || hit.fluid !== 0) {
      const firstHit = {
        distance: Math.min(d, length),
        x: Math.floor(x) + 0.5,
        y: Math.floor(y) + 0.5,
        z: Math.floor(z) + 0.5,
        block: hit.block,
        featureId: hit.featureId ?? null,
      };
      if (hit.block !== Block.Lava) {
        onFirstHit?.({
          ...firstHit,
          kind: hit.featureId ? "feature" : "ground-or-other-fluid",
          visible: false,
        });
        return false;
      }
      const owner = lava(Math.floor(x) + 0.5, Math.floor(z) + 0.5),
        centreY = Math.floor(y) + 0.5;
      const visible =
        owner.kind === "lava" &&
        owner.source === "fissure" &&
        owner.bodyId === witness.fissureId &&
        centreY > owner.bed &&
        centreY <= owner.level;
      onFirstHit?.({ ...firstHit, kind: "lava", owner: { ...owner }, visible });
      return visible;
    }
  }
  onFirstHit?.({ kind: "no-first-hit", visible: false });
  return false;
}
/** Preserve the exact observed voxel, including Y. Older analytic targets keep
 * their original top-wet-centre behavior. Metadata is never a visibility pass. */
export function targetFissureVisible(
  view: MainCameraCandidate,
  target: HellTarget,
  query: CameraQuery,
  lava: (x: number, z: number) => Readonly<LavaSample>,
): boolean {
  if (
    target.kind !== "thorn-cluster" ||
    !target.rootDisc ||
    target.fissureId === undefined
  )
    return false;
  const disc = target.rootDisc,
    observed = target.observedFissurePoint;
  if (
    observed !== undefined &&
    (!observed ||
      typeof observed !== "object" ||
      ![observed.x, observed.y, observed.z].every(
        (value) => Number.isFinite(value) && Number.isInteger(value - 0.5),
      ) ||
      observed.x !== disc.x ||
      observed.z !== disc.z)
  )
    return false;
  const owner = lava(disc.x, disc.z);
  const y = observed?.y ?? Math.floor(owner.level - 0.5) + 0.5;
  if (
    owner.kind !== "lava" ||
    owner.source !== "fissure" ||
    owner.bodyId !== target.fissureId ||
    y <= owner.bed ||
    y > owner.level
  )
    return false;
  if (
    observed &&
    query.voxel(observed.x, observed.y, observed.z).block !== Block.Lava
  )
    return false;
  return seesFissure(
    view,
    { fissureId: target.fissureId, x: disc.x, y, z: disc.z },
    query,
    lava,
  );
}
/** A bounded local forest is rooted within144m of a verified hot fissure.
 * Cheap proposals only reject; every survivor still needs the full64x36 grid. */
export function forestSceneCandidates(
  witnesses: readonly FissureWitness[],
  query: CameraQuery,
  lava: (x: number, z: number) => Readonly<LavaSample>,
  groundHeight: (x: number, z: number) => number,
  rootsFor: (disc: RootDisc) => readonly ForestRoot[],
  targetFor: (disc: RootDisc, fissureId: number) => HellTarget,
  record: (event: Attempt) => void,
  formAware = false,
  instanceFor?: (id: number) => ThornInstance | undefined,
): ForestCandidate[] {
  const groups = new Map<
    string,
    {
      view: MainCameraCandidate;
      disc: RootDisc;
      witness: FissureWitness;
      score: number;
      attempt: number;
    }[]
  >();
  let attempt = 0,
    bankEyes = 0,
    bankWetRays = 0;
  for (const witness of witnesses) {
    const disc = { x: witness.x, z: witness.z, radius: 144 };
    let roots: readonly ForestRoot[] | undefined;
    let ensembleLoaded = false;
    const ensemble = formAware ? witness.ensemble : undefined;
    if (ensemble && !instanceFor)
      throw Error("Bank pairing requires source instances");
    for (const radius of [3, 5, 8, 12, 20])
      for (let k = 0; k < 8; k++) {
        const angle = (k * Math.PI) / 4,
          x = Math.floor(witness.x + Math.cos(angle) * radius) + 0.5,
          z = Math.floor(witness.z + Math.sin(angle) * radius) + 0.5;
        const y = Math.ceil(groundHeight(x, z) - 0.5) + 1.62;
        let headings: { yaw: number; pair?: ForestEnsemble; risk?: number }[];
        if (ensemble && instanceFor) {
          const bankView: MainCameraCandidate = {
            region: "hellscape",
            kind: "eye-level",
            position: { x, y, z },
            target: { x: witness.x, y, z: witness.z },
            hours: 17.25,
            radius: 512,
          };
          bankEyes++;
          const supported = walkableEye(query, x, y, z);
          let firstHit: Attempt | undefined;
          let wetVisible = false;
          if (supported) {
            bankWetRays++;
            wetVisible = seesFissure(bankView, witness, query, lava, (hit) => {
              firstHit = hit;
            });
          }
          record({
            stage: "ensemble-bank-observation",
            id: "HELL-1",
            ensembleId: ensemble.id,
            fissureId: witness.fissureId,
            eye: bankView.position,
            wet: { x: witness.x, y: witness.y, z: witness.z },
            supported,
            wetVisible,
            firstHit,
            status: !supported
              ? "rejected-body-or-support"
              : !wetVisible
                ? "rejected-wet-first-hit"
                : "observed-owned-wet",
          });
          if (!supported || !wetVisible) continue;
          if (!ensembleLoaded) {
            targetFor(disc, witness.fissureId);
            ensembleLoaded = true;
          }
          const pairs = bankFocusPairs(
            ensemble,
            witness,
            bankView.position,
            instanceFor,
          );
          headings = pairs.map((pair) => ({
            yaw: Math.atan2(pair.aim.x - x, pair.aim.z - z),
            pair: pair.ensemble,
            risk: pair.standOffRisk,
          }));
          record({
            stage: "ensemble-bank-focus-pairs",
            id: "HELL-1",
            ensembleId: ensemble.id,
            eye: bankView.position,
            pairs: pairs.map((pair) => ({
              focusIds: [pair.ensemble.hook.id, pair.ensemble.branch.id],
              aim: pair.aim,
              standOffRisk: pair.standOffRisk,
            })),
            limit: 3,
          });
        } else
          headings = [-0.6, 0, 0.6].map((turn) => ({
            yaw: Math.atan2(witness.x - x, witness.z - z) + turn,
          }));
        for (const heading of headings)
          for (const pitch of FOREST_CAMERA_PITCHES) {
            const yaw = heading.yaw;
            const view: MainCameraCandidate = {
              region: "hellscape",
              kind: "eye-level",
              position: { x, y, z },
              target: {
                x: x + Math.sin(yaw) * 64,
                y: y - Math.tan((pitch * Math.PI) / 180) * 64,
                z: z + Math.cos(yaw) * 64,
              },
              hours: 17.25,
              radius: 512,
            };
            const pairing =
              heading.pair && instanceFor
                ? bankPairAdmission(view, heading.pair, witness, instanceFor)
                : undefined;
            const identity = {
              stage: "preflight",
              id: "HELL-1",
              attempt: attempt++,
              fissureId: witness.fissureId,
              ...(witness.ensemble ? { ensembleId: witness.ensemble.id } : {}),
              rootDisc: disc,
              view,
              ...(pairing
                ? {
                    bankPairFraming: pairing,
                    sourceFocusIds: [
                      heading.pair?.hook.id,
                      heading.pair?.branch.id,
                    ],
                    standOffRisk: heading.risk,
                  }
                : {}),
            };
            const reject = (reason: string) =>
              record({ ...identity, status: "rejected", reason });
            if (pairing && !pairing.admitted) {
              reject(`bank-pair-frame:${pairing.reasons.join(",")}`);
              continue;
            }
            const frame = cameraFrame(view);
            if (frame.sunOffsetDegrees < 60 || frame.sunOffsetDegrees > 150) {
              reject("dusk-light");
              continue;
            }
            // Decision114: only raised ground can reject here. Lower ordinary
            // cells are deferred to actual support/body and full preflight;
            // this cheap proposal check never grants a floor exception itself.
            let groundBlocked = false;
            for (const sx of [-0.578125, 0, 0.578125])
              for (const sy of [-7 / 12, 0, 7 / 12]) {
                if (groundBlocked) break;
                const ray = frame.ray(sx, sy);
                for (let d = 1; d < 5; d++) {
                  const groundY = groundHeight(
                    Math.floor(x + ray.x * d) + 0.5,
                    Math.floor(z + ray.z * d) + 0.5,
                  );
                  if (
                    Math.ceil(groundY - 0.5) > supportingVoxelTop(y) &&
                    Math.floor(y + ray.y * d) + 0.5 < groundY
                  ) {
                    groundBlocked = true;
                    break;
                  }
                }
              }
            if (groundBlocked) {
              reject("central-ground");
              continue;
            }
            if (!ensemble && !walkableEye(query, x, y, z)) {
              reject("body-or-support");
              continue;
            }
            if (!ensemble && !seesFissure(view, witness, query, lava)) {
              reject("fissure-occluded");
              continue;
            }
            const rejections = cameraPoseRejections(view, query);
            if (rejections.length) {
              reject(rejections.join(","));
              continue;
            }
            if (query.region(x, z) !== "hellscape") {
              reject("wrong-region");
              continue;
            }
            roots ??= boundedForestRoots(rootsFor(disc), disc);
            const tall = roots.filter((root) => root.height >= 16);
            if (tall.length < 3) {
              reject("sparse-local-forest");
              continue;
            }
            const score = formAware
              ? forestFramingScore(view, tall) +
                (witness.ensemble
                  ? ensembleFramingScore(
                      view,
                      heading.pair ?? witness.ensemble,
                      instanceFor,
                    )
                  : 0)
              : tall.reduce((sum, root) => {
                  const dx = root.x - x,
                    dz = root.z - z,
                    distance = Math.hypot(dx, dz),
                    facing =
                      (dx * Math.sin(yaw) + dz * Math.cos(yaw)) /
                      Math.max(distance, 1);
                  return (
                    sum +
                    (facing > 0.3
                      ? Math.min(
                          0.5,
                          (root.radius * root.height) /
                            (distance * distance + 64),
                        )
                      : 0)
                  );
                }, 0);
            record({
              ...identity,
              status: "eligible-for-full-grid",
              rootCount: roots.length,
              tallRootCount: tall.length,
              selectionScore: score,
            });
            const groupKey = witness.ensemble?.id ?? String(witness.fissureId);
            const group = groups.get(groupKey) ?? [];
            group.push({
              view,
              disc,
              witness: heading.pair
                ? { ...witness, ensemble: heading.pair }
                : witness,
              score,
              attempt: identity.attempt,
            });
            groups.set(groupKey, group);
          }
      }
  }
  // Production round-robins distinct ensembles; primitive keeps fissure patches.
  // Within a site, prefer new eye positions before spending slots on another
  // yaw/pitch at the same bank. Neither rule adds full-grid slots.
  for (const group of groups.values())
    group.sort((a, b) => b.score - a.score || a.attempt - b.attempt);
  for (const group of groups.values()) {
    if (!group[0]?.witness.ensemble) continue;
    const seen = new Set<string>();
    const unique: typeof group = [],
      duplicate: typeof group = [];
    for (const candidate of group) {
      const p = candidate.view.position,
        key = `${p.x},${p.y},${p.z}`;
      (seen.has(key) ? duplicate : unique).push(candidate);
      seen.add(key);
    }
    group.splice(0, group.length, ...unique, ...duplicate);
  }
  const candidates: ForestCandidate[] = [];
  for (let round = 0; candidates.length < 50; round++) {
    let found = false;
    for (const group of groups.values()) {
      const candidate = group[round];
      if (!candidate) continue;
      found = true;
      const targetFeature = targetFor(
        candidate.disc,
        candidate.witness.fissureId,
      );
      candidates.push({ view: candidate.view, targetFeature });
      record({
        stage: "selected-for-full-grid",
        id: "HELL-1",
        ordinal: candidates.length,
        proposal: candidate.attempt,
        view: candidate.view,
        targetFeature,
        ...(candidate.witness.ensemble
          ? {
              sourceFocusIds: [
                candidate.witness.ensemble.hook.id,
                candidate.witness.ensemble.branch.id,
              ],
            }
          : {}),
      });
      if (candidates.length === 50) break;
    }
    if (!found) break;
  }
  record({
    stage: "proposal-summary",
    id: "HELL-1",
    proposals: attempt,
    bankEyes,
    bankWetRays,
    fissurePatches: groups.size,
    fullGridCandidates: candidates.length,
  });
  return candidates;
}
const union = (bounds: readonly Readonly<Aabb>[]): Aabb => ({
  minX: Math.min(...bounds.map((b) => b.minX)),
  minY: Math.min(...bounds.map((b) => b.minY)),
  minZ: Math.min(...bounds.map((b) => b.minZ)),
  maxX: Math.max(...bounds.map((b) => b.maxX)),
  maxY: Math.max(...bounds.map((b) => b.maxY)),
  maxZ: Math.max(...bounds.map((b) => b.maxZ)),
});
/** Cluster addresses come from accepted production instances, never an invented
 * anchor or region label. Canonical IDs order ties independent of cache order. */
export function thornClusterTargets(
  instances: readonly ThornInstance[],
): HellTarget[] {
  const groups = new Map<string, ThornInstance[]>();
  for (const thorn of instances) {
    const p = thorn.parameters,
      key = `${p.landmark}:${p.cellX}:${p.cellZ}:${p.cluster}`;
    groups.set(key, [...(groups.get(key) ?? []), thorn]);
  }
  return [...groups.values()]
    .filter((group) => group.length >= 2)
    .map((group) => ({
      kind: "thorn-cluster" as const,
      featureIds: group
        .map((thorn) => thorn.parameters.id)
        .sort((a, b) => a - b),
      bounds: union(group.map((thorn) => thorn.bounds)),
    }))
    .sort(
      (a, b) =>
        b.featureIds.length - a.featureIds.length ||
        Number(a.featureIds[0]) - Number(b.featureIds[0]),
    );
}
export function hellCameraCandidate(
  target: HellTarget,
  candidate: number,
  query: CameraQuery,
): MainCameraCandidate | null {
  const b = target.bounds,
    x0 = (b.minX + b.maxX) / 2,
    z0 = (b.minZ + b.maxZ) / 2;
  const theta = (candidate % 25) * 2.399963229728653;
  const reach = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2;
  const radius =
    target.kind === "caldera"
      ? reach * (candidate < 25 ? 1 : 0.985)
      : reach + (candidate < 25 ? 48 : 96);
  const x = x0 + Math.cos(theta) * radius,
    z = z0 + Math.sin(theta) * radius;
  if (query.region(x, z) !== "hellscape") return null;
  const interval = query.bounds({
    minX: x - 1,
    minZ: z - 1,
    maxX: x + 1,
    maxZ: z + 1,
  });
  const feet = query.walkableFeet(
    x,
    z,
    interval.minSurfaceY - 2,
    interval.maxSolidY + 1,
  );
  if (feet === null) return null;
  const y = feet + 1.62,
    distance = Math.hypot(x0 - x, z0 - z);
  if (distance < 1) return null;
  return {
    region: "hellscape",
    kind: "eye-level",
    position: { x, y, z },
    target: { x: x0, y: y - Math.tan((9 * Math.PI) / 180) * distance, z: z0 },
    hours: 17.25,
    radius: 512,
  };
}
export function compatibleHellManifest(
  value: HellCameraManifest | undefined,
  seed: number,
  sourceHash: string,
  variant: GenerationVariant,
): value is HellCameraManifest {
  return (
    value?.schema === 1 &&
    value.worldKind === "main" &&
    value.seed === seed &&
    value.worldgenVersion === WORLDGEN_VERSION &&
    value.sourceHash === sourceHash &&
    value.variant === variant &&
    /^[a-f0-9]{64}$/.test(value.resolverHash) &&
    Array.isArray(value.cameras)
  );
}
export function retainedHellCameras(
  value: HellCameraManifest | undefined,
  seed: number,
  sourceHash: string,
  variant: GenerationVariant,
): ResolvedHellCamera[] {
  if (!compatibleHellManifest(value, seed, sourceHash, variant)) return [];
  const member = variant === "primitive" ? "phase13Primitive" : "phase13";
  return (["HELL-1", "HELL-2"] as const).flatMap((id) => {
    const matching = value.cameras.filter((camera) => camera?.id === id);
    if (matching.length !== 1) return [];
    try {
      validatePostcardSelection(
        { [member]: { ...value, cameras: matching } },
        id,
        seed,
        sourceHash,
        variant,
      );
      return matching;
    } catch {
      return [];
    }
  });
}
/** Source-bound offline search only. Ordinary browser play only loads its result. */
export async function resolveHellCameras(
  seed: number,
  root = process.cwd(),
  requested: readonly PostcardId[] = ["HELL-1", "HELL-2"],
  variant: GenerationVariant = "production",
): Promise<HellCameraManifest> {
  if (
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff ||
    (variant !== "production" && variant !== "primitive") ||
    !requested.length ||
    new Set(requested).size !== requested.length ||
    requested.some((id) => id !== "HELL-1" && id !== "HELL-2")
  )
    throw new Error("Invalid HELL camera request");
  const started = performance.now(),
    sourceHash = sourceFingerprints(root).cacheTag;
  const resolverHash = postcardResolverHash(root, "1.3");
  const attemptsPath = resolve(
    root,
    "out/postcards/attempts",
    `hell-s${seed}-${variant}-${sourceHash}-${resolverHash}-${Date.now()}.jsonl`,
  );
  await mkdir(dirname(attemptsPath), { recursive: true });
  let rememberGeometryPreflight: ((event: Attempt) => void) | undefined;
  const record = (event: Attempt): void => {
    rememberGeometryPreflight?.(event);
    appendFileSync(
      attemptsPath,
      `${JSON.stringify({ schema: 1, seed, variant, sourceHash, resolverHash, ...event })}\n`,
    );
  };
  record({ stage: "started", requested });
  const path = resolve(
    root,
    "packages/tools/postcards/cameras",
    `seed-${seed}.json`,
  );
  let document: Record<string, unknown> = {};
  try {
    document = JSON.parse(await readFile(path, "utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    /* New manifest. */
  }
  const member = variant === "primitive" ? "phase13Primitive" : "phase13";
  const old = document[member] as HellCameraManifest | undefined;
  const production = document.phase13 as HellCameraManifest | undefined;
  const planStart = performance.now(),
    plan = await loadPlan(seed, sourceHash, root);
  const context = createWorldContext({ kind: "main", seed, plan, variant });
  const field = createMainField(plan, plan.sites.bridges, plan.ibara),
    ground = field.ibara;
  if (!ground) throw new Error("HELL cameras require volcanic ownership");
  const planMs = performance.now() - planStart,
    query = cameraQuery(context),
    lavaSample = createLavaSample();
  const lava = (x: number, z: number) => ground.lavaQuery(x, z, lavaSample);
  const framingPreflight = createFramingPreflight(
    (view) => cameraPoseRejections(view, query),
    (view, target) => {
      const reasons: string[] = [];
      if (query.region(view.position.x, view.position.z) !== "hellscape")
        return ["wrong-region"];
      if (target.kind === "thorn-cluster") {
        const disc = target.rootDisc;
        if (!disc || target.fissureId === undefined)
          reasons.push("no-named-fissure-witness");
        else if (!targetFissureVisible(view, target, query, lava))
          reasons.push("fissure-occluded");
      }
      return reasons;
    },
  );
  if (variant === "production")
    rememberGeometryPreflight = framingPreflight.remember;
  const analytic = createIbaraAnalytic(seed);
  const environment = {
    seed,
    surfaceAt: ground.height,
    weightAt: analytic.weight,
    lavaAt: ground.lavaAt,
  };
  const features =
    variant === "production" ? createMainIbaraField(field) : null;
  const instanceCache = new Map<number, ThornInstance>();
  const resolveVisible = features
    ? createVisibleThornResolver(features, instanceCache)
    : null;
  const primitive = (bounds: XZBounds): HellTarget => {
    const batch = createPrimitiveIbaraBatch(environment, bounds, 1);
    return {
      kind: "thorn-cluster",
      featureIds: batch.instances
        .map((cone) => cone.featureId)
        .sort((a, b) => a - b),
      bounds: batch.instances.length
        ? union(batch.instances.map((cone) => cone.bounds))
        : { ...bounds, minY: -1536, maxY: 1024 },
    };
  };
  const patchCache = new Map<string, HellTarget>();
  const forestTarget = (disc: RootDisc, fissureId: number): HellTarget => {
    const key = `${disc.x},${disc.z},${disc.radius},${fissureId}`;
    const cached = patchCache.get(key);
    if (cached) return cached;
    const bounds = {
      minX: disc.x - disc.radius,
      maxX: disc.x + disc.radius,
      minZ: disc.z - disc.radius,
      maxZ: disc.z + disc.radius,
      minY: -1536,
      maxY: 1024,
    };
    const instances = features
      ? features
          .collect(bounds, 1)
          .filter(
            (thorn) =>
              Math.hypot(
                thorn.parameters.base[0] - disc.x,
                thorn.parameters.base[2] - disc.z,
              ) <= disc.radius,
          )
          .map((thorn) => {
            instanceCache.set(thorn.parameters.id, thorn);
            return { id: thorn.parameters.id, bounds: thorn.bounds };
          })
      : createPrimitiveIbaraBatch(environment, bounds, 1)
          .instances.filter(
            (cone) =>
              Math.hypot(cone.x - disc.x, cone.z - disc.z) <= disc.radius,
          )
          .map((cone) => ({ id: cone.featureId, bounds: cone.bounds }));
    const target: HellTarget = {
      kind: "thorn-cluster",
      featureIds: instances.map((item) => item.id).sort((a, b) => a - b),
      bounds: instances.length
        ? union(instances.map((item) => item.bounds))
        : bounds,
      rootDisc: disc,
      fissureId,
    };
    patchCache.set(key, target);
    return target;
  };
  const rootsFor = (disc: RootDisc): readonly ForestRoot[] => {
    const roots: ForestRoot[] = [];
    if (features) {
      for (
        let z = Math.floor(disc.z / 192) - 1;
        z <= Math.floor(disc.z / 192) + 1;
        z++
      )
        for (
          let x = Math.floor(disc.x / 192) - 1;
          x <= Math.floor(disc.x / 192) + 1;
          x++
        )
          for (const p of features.parametersForCell(x, z))
            roots.push({
              id: p.id,
              x: p.base[0],
              y: p.base[1],
              z: p.base[2],
              height: p.height,
              radius: p.baseRadius,
            });
    } else
      for (const cone of createPrimitiveIbaraBatch(
        environment,
        {
          minX: disc.x - disc.radius,
          maxX: disc.x + disc.radius,
          minZ: disc.z - disc.radius,
          maxZ: disc.z + disc.radius,
        },
        1,
      ).instances)
        roots.push({
          id: cone.featureId,
          x: cone.x,
          z: cone.z,
          height: PRIMITIVE_IBARA_HEIGHT,
          radius: PRIMITIVE_IBARA_RADIUS,
        });
    return roots;
  };
  const cameras = new Map<HellPostcardId, ResolvedHellCamera>();
  for (const camera of retainedHellCameras(old, seed, sourceHash, variant))
    cameras.set(camera.id, camera);
  const entries: {
    id: PostcardId;
    reused: boolean;
    candidates: number;
    durationMs: number;
  }[] = [];
  const ordered = () =>
    (["HELL-1", "HELL-2"] as const).flatMap((id) =>
      // Do not certify an unrequested retained view against a newer resolver.
      cameras.get(id)?.validatedByResolverHash === resolverHash
        ? [cameras.get(id) as ResolvedHellCamera]
        : [],
    );
  const persist = async () => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(
      path,
      `${JSON.stringify({ ...document, [member]: { schema: 1, worldKind: "main", seed, worldgenVersion: WORLDGEN_VERSION, sourceHash, resolverHash, variant, cameras: ordered() } }, null, 2)}\n`,
    );
  };
  try {
    for (const id of requested as readonly HellPostcardId[]) {
      const begin = performance.now();
      // Saved-view and primitive-comparison checks spend the same fifty-view
      // budget as new coarse/refined candidates. Count at the actual call site.
      const fullGridBudget = 50;
      let inspected = 0;
      let reused = false;
      let comparison: ResolvedHellCamera["comparison"],
        best: ResolvedHellCamera | undefined;
      const inspect = (
        view: MainCameraCandidate,
        targetFeature: HellTarget,
        purpose: "candidate" | "retained" | "comparison" = "candidate",
      ): ResolvedHellCamera => {
        if (inspected >= fullGridBudget)
          throw new Error(`Full-grid inspection budget exhausted for ${id}`);
        const fullGridOrdinal = ++inspected;
        record({
          stage: "validation-started",
          id,
          purpose,
          fullGridOrdinal,
          fullGridBudget,
          view,
          targetFeature,
          grid: { width: 64, height: 36 },
        });
        const caldera =
          targetFeature.kind === "caldera"
            ? plan.ibara.calderas.find((c) => c.id === targetFeature.calderaId)
            : undefined;
        const needsReadability = id === "HELL-1" && variant === "production";
        const hits: CameraFirstHit[] = [];
        const validation = inspectHellCamera(view, query, {
          target: targetFeature,
          lava,
          ...(caldera ? { caldera } : {}),
          ...(needsReadability
            ? { onHit: (hit: CameraFirstHit) => hits.push(hit) }
            : {}),
        });
        let readability: HellReadability | undefined;
        let readabilitySetup: VisibleThornLookupReceipt | undefined;
        const lavaWitnesses =
          needsReadability && validation.passed
            ? observedFissureWitnesses(hits, lava)
            : undefined;
        if (
          needsReadability &&
          validation.passed &&
          resolveVisible &&
          targetFeature.kind === "thorn-cluster"
        ) {
          // Resolve source-bound metadata for the same bounded visible parents
          // that will be inspected, even when rooted outside the target disc.
          const visible = resolveVisible(hits);
          readabilitySetup = visible.receipt;
          readability = inspectHellReadability(
            view,
            visible.instances,
            hits,
            query,
          );
        }
        record({
          stage: "validation-complete",
          id,
          purpose,
          fullGridOrdinal,
          fullGridBudget,
          view,
          targetFeature,
          validation,
          ...(readability ? { readability } : {}),
          ...(readabilitySetup ? { readabilitySetup } : {}),
          ...(lavaWitnesses ? { lavaWitnesses } : {}),
        });
        return {
          // The input can be a saved result from another resolver or variant.
          // Copy only pose inputs; all derived evidence below is fresh.
          position: view.position,
          target: view.target,
          hours: view.hours,
          radius: view.radius,
          ...(view.terrainUpperBound === undefined
            ? {}
            : { terrainUpperBound: view.terrainUpperBound }),
          id,
          region: "hellscape",
          kind: "eye-level",
          seed,
          ungraded: true,
          targetFeature,
          validation,
          ...(readability ? { readability } : {}),
          ...(readabilitySetup ? { readabilitySetup } : {}),
          ...(lavaWitnesses ? { lavaWitnesses } : {}),
          score:
            (validation.passed ? (needsReadability ? 1000 : 100) : 0) +
            (readability?.score ?? 0) +
            validation.targetFraction * 20 +
            validation.lavaFraction * 5 -
            Math.abs(validation.skyFraction - 0.38) * 10,
          validatedByResolverHash: resolverHash,
          ...(comparison ? { comparison } : {}),
        };
      };
      if (variant === "primitive") {
        const match = retainedHellCameras(
          production,
          seed,
          sourceHash,
          "production",
        ).find((c) => c.id === id);
        if (match) {
          const target =
            match.targetFeature.kind === "thorn-cluster"
              ? match.targetFeature.rootDisc &&
                match.targetFeature.fissureId !== undefined
                ? forestTarget(
                    match.targetFeature.rootDisc,
                    match.targetFeature.fissureId,
                  )
                : primitive(match.targetFeature.bounds)
              : match.targetFeature;
          const checked = inspect(match, target, "comparison");
          comparison = {
            productionView: checked.validation.passed ? "matched" : "diverged",
            reason: checked.validation.passed
              ? "Production eye/target passed the actual primitive field"
              : `Production eye/target failed primitive validation: ${JSON.stringify(checked.validation)}`,
          };
          if (checked.validation.passed) {
            best = { ...checked, comparison };
            reused = true;
          }
        } else
          comparison = {
            productionView: "unavailable",
            reason: "No matching source-bound production camera",
          };
      }
      if (!best) {
        const previous = cameras.get(id);
        if (previous) {
          const checked = inspect(previous, previous.targetFeature, "retained");
          if (checked.validation.passed) {
            const needsSearch = id === "HELL-1" && variant === "production";
            const searchMatches = completedSearchMatches(
              previous,
              old,
              seed,
              sourceHash,
              resolverHash,
              variant,
            );
            reused = !needsSearch || searchMatches;
            best = searchMatches
              ? {
                  ...checked,
                  ...(previous.completedSearch
                    ? { completedSearch: previous.completedSearch }
                    : {}),
                }
              : checked;
            record({
              stage: "retained-search",
              id,
              reused,
              completedSearchMatched: searchMatches,
            });
          }
        }
      }
      const revalidationCandidates = inspected;
      if (!reused) {
        const candidates: ForestCandidate[] = [];
        if (id === "HELL-1") {
          const anchor = context.regionAnchor("hellscape");
          if (!anchor) throw new Error("Missing Ibara anchor");
          const sites = features
            ? ordinaryForestEnsembles(anchor, features.parametersForCell)
            : [];
          if (features)
            record({
              stage: "forest-ensemble-nominations",
              id,
              budget: FOREST_ENSEMBLE_BUDGET,
              sites,
            });
          const witnesses = features
            ? ensembleFissureWitnesses(
                sites,
                (site) => nearbyFissureWitnesses(site, analytic, lava),
                (event) => record({ id, ...event }),
              )
            : nearbyFissureWitnesses(anchor, analytic, lava);
          if (features)
            record({
              stage: "forest-ensemble-shortlist",
              id,
              budget: FOREST_ENSEMBLE_BUDGET,
              sites: [
                ...new Map(
                  witnesses.flatMap((witness) =>
                    witness.ensemble
                      ? [[witness.ensemble.id, witness.ensemble] as const]
                      : [],
                  ),
                ).values(),
              ],
            });
          record({ stage: "fissure-witnesses", id, witnesses });
          candidates.push(
            ...forestSceneCandidates(
              witnesses,
              query,
              lava,
              ground.height,
              rootsFor,
              forestTarget,
              record,
              variant === "production",
              (featureId) => instanceCache.get(featureId),
            ),
          );
        } else {
          const choices = plan.ibara.calderas.map(calderaTarget);
          for (
            let candidate = 0;
            candidate < 50 && choices.length;
            candidate++
          ) {
            const targetFeature = choices[
                candidate % Math.min(5, choices.length)
              ] as HellTarget,
              view = hellCameraCandidate(targetFeature, candidate, query);
            const reasons = view
              ? cameraPoseRejections(view, query)
              : ["no-standing-surface"];
            record({
              stage: "preflight",
              id,
              candidate,
              view,
              targetFeature,
              status: reasons.length ? "rejected" : "eligible-for-full-grid",
              reasons,
            });
            if (view && !reasons.length)
              candidates.push({ view, targetFeature });
          }
        }
        console.log(
          `Resolving ${id}/${variant}:${candidates.length} preflight survivors; attempts:${attemptsPath}`,
        );
        const primitiveForest = id === "HELL-1" && variant === "primitive";
        const productionForest = id === "HELL-1" && variant === "production";
        const observations: FramingObservation[] = [];
        const coarse = primitiveForest
          ? candidates.slice(0, PRIMITIVE_CAMERA_BUDGET.coarse)
          : productionForest
            ? candidates.slice(0, PRODUCTION_CAMERA_BUDGET.coarse)
            : candidates;
        for (const { view, targetFeature: target } of coarse) {
          if (inspected >= fullGridBudget) break;
          const checked = inspect(view, target);
          observations.push({
            view,
            targetFeature: target,
            validation: checked.validation,
            ...(checked.readability
              ? { readability: checked.readability }
              : {}),
            ...(checked.lavaWitnesses
              ? { lavaWitnesses: checked.lavaWitnesses }
              : {}),
          });
          if (!best || compareHellCandidates(checked, best) > 0) best = checked;
        }
        if (productionForest) {
          const refinements =
            best &&
            hellSelectionPassed(id, variant, best.validation, best.readability)
              ? []
              : productionFramingCandidates(
                  observations,
                  (featureId) => instanceCache.get(featureId),
                  ground.height,
                  framingPreflight.inspect,
                  (event) => record({ id, ...event }),
                  (disc, fissureId, witness) => {
                    const target = forestTarget(disc, fissureId);
                    if (target.kind !== "thorn-cluster")
                      throw new Error("Bank pair needs a forest target");
                    return {
                      ...target,
                      observedFissurePoint: {
                        x: witness.x,
                        y: witness.y,
                        z: witness.z,
                      },
                    };
                  },
                );
          let traced = 0,
            fallback = 0;
          for (const refinement of refinements) {
            if (inspected >= fullGridBudget) break;
            // The exact view and target passed unchanged preflight before
            // the final eighteen-slot selection. Full inspection still follows.
            record({
              stage: "production-framing-validation-selected",
              id,
              ...refinement,
            });
            const checked = inspect(refinement.view, refinement.targetFeature);
            traced++;
            if (!best || compareHellCandidates(checked, best) > 0)
              best = checked;
          }
          for (const { view, targetFeature } of candidates.slice(
            coarse.length,
          )) {
            if (
              inspected >= fullGridBudget ||
              (best &&
                hellSelectionPassed(
                  id,
                  variant,
                  best.validation,
                  best.readability,
                ))
            )
              break;
            const checked = inspect(view, targetFeature);
            fallback++;
            if (!best || compareHellCandidates(checked, best) > 0)
              best = checked;
          }
          record({
            stage: "production-framing-summary",
            id,
            revalidationCandidates,
            coarseCandidates: observations.length,
            proposedRefinements: refinements.length,
            tracedRefinements: traced,
            fallbackCoarseCandidates: fallback,
            fullGridCandidates: inspected,
            fullGridBudget,
          });
        }
        if (primitiveForest) {
          const refinements = best?.validation.passed
            ? []
            : primitiveCameraRefinements(observations);
          let traced = 0,
            fallback = 0;
          for (const refinement of refinements) {
            if (inspected >= fullGridBudget) break;
            const reasons = cameraPoseRejections(refinement.view, query);
            record({
              stage: "primitive-refinement-preflight",
              id,
              ...refinement,
              status: reasons.length ? "rejected" : "eligible-for-full-grid",
              reasons,
            });
            if (reasons.length) continue;
            const checked = inspect(refinement.view, refinement.targetFeature);
            traced++;
            if (!best || compareHellCandidates(checked, best) > 0)
              best = checked;
          }
          // When there are too few near misses, or a turn fails preflight,
          // spend unused slots on the remaining original coarse proposals.
          // This is still one shared budget, never fifty PLUS refinement.
          for (const { view, targetFeature } of candidates.slice(
            coarse.length,
          )) {
            if (inspected >= fullGridBudget || best?.validation.passed) break;
            const checked = inspect(view, targetFeature);
            fallback++;
            if (!best || compareHellCandidates(checked, best) > 0)
              best = checked;
          }
          record({
            stage: "primitive-refinement-summary",
            id,
            revalidationCandidates,
            coarseCandidates: observations.length,
            proposedRefinements: refinements.length,
            tracedRefinements: traced,
            fallbackCoarseCandidates: fallback,
            fullGridCandidates: inspected,
            fullGridBudget,
          });
        }
      }
      record({
        stage: "inspection-summary",
        id,
        revalidationCandidates,
        fullGridCandidates: inspected,
        fullGridBudget,
      });
      if (!best?.validation.passed)
        throw new Error(
          `No ${id}/${variant} camera passed geometry; attempts:${attemptsPath}: ${JSON.stringify(best)}`,
        );
      if (!reused) {
        best = {
          ...best,
          completedSearch: {
            schema: 1,
            seed,
            worldgenVersion: WORLDGEN_VERSION,
            sourceHash,
            resolverHash,
            variant,
            selectedViewHash: selectedViewHash(best),
            fullGridCandidates: inspected,
            fullGridBudget: 50,
            termination: hellSelectionPassed(
              id,
              variant,
              best.validation,
              best.readability,
            )
              ? "composition-goal"
              : inspected === fullGridBudget
                ? "budget"
                : "candidates-exhausted",
          },
        };
      }
      record({
        stage: "selected-ungraded",
        id,
        reused,
        completedSearch: best.completedSearch,
        compositionPassed: best.readability?.passed,
        compositionReasons: best.readability?.reasons,
      });
      cameras.set(id, best);
      entries.push({
        id,
        reused,
        candidates: inspected,
        durationMs: performance.now() - begin,
      });
      await persist();
      query.clear();
    }
    record({
      stage: "completed",
      cameras: ordered().map((camera) => camera.id),
      elapsedMs: performance.now() - started,
    });
    return {
      schema: 1,
      worldKind: "main",
      seed,
      worldgenVersion: WORLDGEN_VERSION,
      sourceHash,
      resolverHash,
      variant,
      cameras: ordered(),
      resolution: { planMs, totalMs: performance.now() - started, entries },
      attemptsPath,
    };
  } catch (error) {
    record({
      stage: "failed",
      error: String(error),
      elapsedMs: performance.now() - started,
    });
    throw new Error(`${String(error)}; attempts:${attemptsPath}`);
  }
}
function calderaTarget(c: IbaraCalderaData): HellTarget {
  // Candidate placement follows the actual rim radius, not the wider displaced bound.
  return {
    kind: "caldera",
    calderaId: c.id,
    bounds: {
      ...c.bounds,
      minX: c.x - c.radius,
      maxX: c.x + c.radius,
      minZ: c.z - c.radius,
      maxZ: c.z + c.radius,
    },
  };
}
