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
  cameraFrame,
  cameraPoseRejections,
  type HellCameraValidation,
  type HellTarget,
  inspectHellCamera,
  type MainCameraCandidate,
} from "./geometry.js";
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
  readonly validatedByResolverHash: string;
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
export interface FissureWitness {
  readonly fissureId: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
export interface ForestRoot {
  readonly id: number;
  readonly x: number;
  readonly z: number;
  readonly height: number;
  readonly radius: number;
}
type RootDisc = Readonly<{ x: number; z: number; radius: number }>;
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
      if (hit.block !== Block.Lava) return false;
      const owner = lava(Math.floor(x) + 0.5, Math.floor(z) + 0.5),
        centreY = Math.floor(y) + 0.5;
      return (
        owner.kind === "lava" &&
        owner.source === "fissure" &&
        owner.bodyId === witness.fissureId &&
        centreY > owner.bed &&
        centreY <= owner.level
      );
    }
  }
  return false;
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
): ForestCandidate[] {
  const groups = new Map<
    number,
    {
      view: MainCameraCandidate;
      disc: RootDisc;
      witness: FissureWitness;
      score: number;
      attempt: number;
    }[]
  >();
  let attempt = 0;
  for (const witness of witnesses) {
    const disc = { x: witness.x, z: witness.z, radius: 144 };
    let roots: readonly ForestRoot[] | undefined;
    for (const radius of [3, 5, 8, 12, 20])
      for (let k = 0; k < 8; k++) {
        const angle = (k * Math.PI) / 4,
          x = Math.floor(witness.x + Math.cos(angle) * radius) + 0.5,
          z = Math.floor(witness.z + Math.sin(angle) * radius) + 0.5;
        const y = Math.ceil(groundHeight(x, z) - 0.5) + 1.62;
        for (const turn of [-0.6, 0, 0.6])
          for (const pitch of [4.25, 7, 9]) {
            const yaw = Math.atan2(witness.x - x, witness.z - z) + turn;
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
            const identity = {
              stage: "preflight",
              id: "HELL-1",
              attempt: attempt++,
              fissureId: witness.fissureId,
              rootDisc: disc,
              view,
            };
            const reject = (reason: string) =>
              record({ ...identity, status: "rejected", reason });
            const frame = cameraFrame(view);
            if (frame.sunOffsetDegrees < 60 || frame.sunOffsetDegrees > 150) {
              reject("dusk-light");
              continue;
            }
            // A positive ground density is a safe rejection even before additive
            // thorns are queried. This does not accept/approximate a final ray hit.
            let groundBlocked = false;
            for (const sx of [-0.578125, 0, 0.578125])
              for (const sy of [-7 / 12, 0, 7 / 12]) {
                if (groundBlocked) break;
                const ray = frame.ray(sx, sy);
                for (let d = 1; d < 5; d++)
                  if (
                    Math.floor(y + ray.y * d) + 0.5 <
                    groundHeight(
                      Math.floor(x + ray.x * d) + 0.5,
                      Math.floor(z + ray.z * d) + 0.5,
                    )
                  ) {
                    groundBlocked = true;
                    break;
                  }
              }
            if (groundBlocked) {
              reject("central-ground");
              continue;
            }
            if (!walkableEye(query, x, y, z)) {
              reject("body-or-support");
              continue;
            }
            if (!seesFissure(view, witness, query, lava)) {
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
            const score = tall.reduce((sum, root) => {
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
                      (root.radius * root.height) / (distance * distance + 64),
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
            const group = groups.get(witness.fissureId) ?? [];
            group.push({
              view,
              disc,
              witness,
              score,
              attempt: identity.attempt,
            });
            groups.set(witness.fissureId, group);
          }
      }
  }
  // Round-robin actual fissure patches: one very dense patch must not consume
  // all50 views while failing the unchanged sky-fraction gate.
  for (const group of groups.values())
    group.sort((a, b) => b.score - a.score || a.attempt - b.attempt);
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
      });
      if (candidates.length === 50) break;
    }
    if (!found) break;
  }
  record({
    stage: "proposal-summary",
    id: "HELL-1",
    proposals: attempt,
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
  const record = (event: Attempt): void =>
    appendFileSync(
      attemptsPath,
      `${JSON.stringify({ schema: 1, seed, variant, sourceHash, resolverHash, ...event })}\n`,
    );
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
  const analytic = createIbaraAnalytic(seed);
  const environment = {
    seed,
    surfaceAt: ground.height,
    weightAt: analytic.weight,
    lavaAt: ground.lavaAt,
  };
  const features =
    variant === "production" ? createMainIbaraField(field) : null;
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
          .map((thorn) => ({ id: thorn.parameters.id, bounds: thorn.bounds }))
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
      let comparison: ResolvedHellCamera["comparison"],
        best: ResolvedHellCamera | undefined;
      const inspect = (
        view: MainCameraCandidate,
        targetFeature: HellTarget,
      ): ResolvedHellCamera => {
        record({
          stage: "validation-started",
          id,
          view,
          targetFeature,
          grid: { width: 64, height: 36 },
        });
        const caldera =
          targetFeature.kind === "caldera"
            ? plan.ibara.calderas.find((c) => c.id === targetFeature.calderaId)
            : undefined;
        const validation = inspectHellCamera(view, query, {
          target: targetFeature,
          lava,
          ...(caldera ? { caldera } : {}),
        });
        record({
          stage: "validation-complete",
          id,
          view,
          targetFeature,
          validation,
        });
        return {
          ...view,
          id,
          region: "hellscape",
          kind: "eye-level",
          seed,
          ungraded: true,
          targetFeature,
          validation,
          score:
            (validation.passed ? 100 : 0) +
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
          const checked = inspect(match, target);
          comparison = {
            productionView: checked.validation.passed ? "matched" : "diverged",
            reason: checked.validation.passed
              ? "Production eye/target passed the actual primitive field"
              : `Production eye/target failed primitive validation: ${JSON.stringify(checked.validation)}`,
          };
          if (checked.validation.passed) best = { ...checked, comparison };
        } else
          comparison = {
            productionView: "unavailable",
            reason: "No matching source-bound production camera",
          };
      }
      if (!best) {
        const previous = cameras.get(id);
        if (previous) {
          const checked = inspect(previous, previous.targetFeature);
          if (checked.validation.passed) best = checked;
        }
      }
      const reused = Boolean(best);
      let inspected = 0;
      if (!best) {
        const candidates: ForestCandidate[] = [];
        if (id === "HELL-1") {
          const anchor = context.regionAnchor("hellscape");
          if (!anchor) throw new Error("Missing Ibara anchor");
          const witnesses = nearbyFissureWitnesses(anchor, analytic, lava);
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
        for (const { view, targetFeature: target } of candidates) {
          const checked = inspect(view, target);
          inspected++;
          if (!best || checked.score > best.score) best = checked;
        }
      }
      if (!best?.validation.passed)
        throw new Error(
          `No ${id}/${variant} camera passed geometry; attempts:${attemptsPath}: ${JSON.stringify(best)}`,
        );
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
