import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { deserialize, serialize } from "node:v8";
import type { PostcardId } from "../../../client/src/game/postcard.js";
import { SURFACE_REGIONS } from "../../../shared/src/world/regions.js";
import type {
  SurfaceRegionId,
  WorldContext,
  WorldPlanData,
  XZ,
} from "../../../shared/src/world/types.js";
import { createWorldContext } from "../../../shared/src/world/world-context.js";
import { WORLDGEN_VERSION } from "../../../shared/src/worldgen/version.js";
import {
  buildWorldPlan,
  hydrateWorldPlan,
} from "../../../shared/src/worldplan/index.js";
import { contentHash, sourceFingerprints } from "../build/metadata.js";
import {
  type CameraValidation,
  inspectMainCamera,
  type MainCameraCandidate,
} from "./geometry.js";
import { type CameraQuery, cameraQuery } from "./query.js";

export interface ResolvedMainCamera extends MainCameraCandidate {
  readonly id: `P12-${SurfaceRegionId}`;
  readonly seed: number;
  readonly ungraded: true;
  readonly validation: CameraValidation;
  readonly score: number;
  /** Resolver used for this camera's last validation, including retained entries. */
  readonly validatedByResolverHash?: string;
}
export interface MainCameraManifest {
  readonly schema: 1;
  readonly worldKind: "main";
  readonly seed: number;
  readonly worldgenVersion: number;
  readonly sourceHash: string;
  readonly resolverHash: string;
  readonly cameras: readonly ResolvedMainCamera[];
  readonly resolution: Readonly<{
    planMs: number;
    totalMs: number;
    entries: readonly Readonly<{
      id: PostcardId;
      reused: boolean;
      candidates: number;
      durationMs: number;
    }>[];
  }>;
}
export function firstPassId(region: SurfaceRegionId): `P12-${SurfaceRegionId}` {
  return `P12-${region}`;
}
/** Candidate-placement changes do not invalidate an independent saved view.
 * World identity still must match; requested views are revalidated below. */
export function retainedMainCameras(
  old: MainCameraManifest | undefined,
  seed: number,
  sourceHash: string,
): ResolvedMainCamera[] {
  if (
    old?.schema !== 1 ||
    old.worldKind !== "main" ||
    old.seed !== seed ||
    old.worldgenVersion !== WORLDGEN_VERSION ||
    old.sourceHash !== sourceHash ||
    !/^[a-f0-9]{64}$/.test(old.resolverHash) ||
    !Array.isArray(old.cameras)
  )
    return [];
  return SURFACE_REGIONS.flatMap((region) => {
    const matching = old.cameras.filter(
      (camera) => camera?.id === firstPassId(region.id),
    );
    const camera = matching[0];
    if (
      matching.length !== 1 ||
      !camera ||
      camera.region !== region.id ||
      camera.seed !== seed ||
      (camera.kind !== "aerial" && camera.kind !== "eye-level")
    )
      return [];
    return [
      {
        ...camera,
        validatedByResolverHash:
          camera.validatedByResolverHash ?? old.resolverHash,
      },
    ];
  });
}
export function mainCameraCandidate(
  region: SurfaceRegionId,
  anchor: XZ,
  candidate: number,
  context: Pick<WorldContext, "conservativeBounds">,
  query: CameraQuery,
): MainCameraCandidate | null {
  const kind = candidate < 25 ? "eye-level" : "aerial";
  const index = candidate % 25,
    // Blackwater's bridge anchor is beside the Nadir escarpment. A wider
    // search can clear that bound's footprint without lowering its true height.
    offset = (index % 5) * (region === "blackwater" ? 128 : 12),
    direction = index * 2.399963229728653;
  const x = anchor.x + Math.cos(direction) * offset,
    z = anchor.z + Math.sin(direction) * offset;
  if (
    x < -22527 ||
    x > 22527 ||
    z < -22527 ||
    z > 22527 ||
    query.region(x, z) !== region
  )
    return null;
  const bounds = context.conservativeBounds(
    { minX: x - 320, minZ: z - 320, maxX: x + 320, maxZ: z + 320 },
    { minSurfaceY: 0, maxSurfaceY: 0, maxSolidY: 0, maxFluidY: -Infinity },
  );
  const upper = Math.max(bounds.maxSolidY, bounds.maxFluidY),
    y = kind === "eye-level" ? query.ground(x, z) + 1.62 : upper + 24;
  const yaw = (index * Math.PI * 2) / 25;
  return {
    region,
    kind,
    position: { x, y, z },
    target: {
      x: x + Math.sin(yaw) * 64,
      y: y - Math.tan((9 * Math.PI) / 180) * 64,
      z: z - Math.cos(yaw) * 64,
    },
    hours: 17.25,
    radius: 320,
    ...(kind === "aerial" ? { terrainUpperBound: upper } : {}),
  };
}
function cameraScore(
  view: MainCameraCandidate,
  validation: CameraValidation,
): number {
  return (
    (validation.passed ? 100 : 0) +
    validation.featureFraction * 20 -
    Math.abs(validation.skyFraction - 0.38) * 10 +
    (view.kind === "eye-level" ? 2 : 0)
  );
}
export function revalidateMainCamera(
  previous: ResolvedMainCamera,
  query: CameraQuery,
  resolverHash: string,
): ResolvedMainCamera | null {
  const validation = inspectMainCamera(previous, query);
  return validation.passed
    ? {
        ...previous,
        validation,
        score: cameraScore(previous, validation),
        validatedByResolverHash: resolverHash,
      }
    : null;
}
export function parsePostcardIds(
  phase: string | null,
  only: string | null,
): readonly PostcardId[] {
  if (phase !== null && phase !== "1.1" && phase !== "1.2")
    throw new Error(`Unsupported postcard phase ${phase}`);
  const known: PostcardId[] = [
    "TEST-1",
    ...SURFACE_REGIONS.map((region) => firstPassId(region.id)),
  ];
  const ids = only
    ? only.split(",")
    : phase === "1.2"
      ? known.slice(1)
      : ["TEST-1"];
  if (
    !ids.length ||
    ids.some((id) => !known.includes(id as PostcardId)) ||
    new Set(ids).size !== ids.length
  )
    throw new Error("Unknown or duplicate postcard ID");
  if (phase === "1.1" && ids.some((id) => id !== "TEST-1"))
    throw new Error("Main postcards require phase1.2");
  if (ids.includes("TEST-1") && ids.length > 1)
    throw new Error("Capture test and main worlds in separate runs");
  return ids as PostcardId[];
}
async function loadPlan(
  seed: number,
  sourceHash: string,
  root: string,
): Promise<WorldPlanData> {
  const path = resolve(
    root,
    "out/postcards/plans",
    `main-s${seed}-${sourceHash}.bin`,
  );
  try {
    const bytes = await readFile(path),
      cached = deserialize(bytes) as {
        seed: number;
        sourceHash: string;
        worldgenVersion: number;
        data: WorldPlanData;
        checksum: string;
      };
    if (
      cached.seed === seed &&
      cached.sourceHash === sourceHash &&
      cached.worldgenVersion === WORLDGEN_VERSION &&
      createHash("sha256").update(serialize(cached.data)).digest("hex") ===
        cached.checksum
    ) {
      hydrateWorldPlan(cached.data);
      return cached.data;
    }
  } catch {
    /* A corrupt/stale optional tool cache is rebuilt explicitly. */
  }
  const data = buildWorldPlan(seed);
  hydrateWorldPlan(data);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    serialize({
      seed,
      sourceHash,
      worldgenVersion: WORLDGEN_VERSION,
      data,
      checksum: createHash("sha256").update(serialize(data)).digest("hex"),
    }),
  );
  return data;
}
export async function resolveMainCameras(
  seed: number,
  root = process.cwd(),
  requested: readonly PostcardId[] = SURFACE_REGIONS.map((region) =>
    firstPassId(region.id),
  ),
): Promise<MainCameraManifest> {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("Postcard seed must be an unsigned32-bit integer");
  const started = performance.now();
  const sourceHash = sourceFingerprints(root).cacheTag;
  const resolverHash = contentHash(
    root,
    ["query.ts", "geometry.ts", "main-resolve.ts"].map((name) =>
      resolve(root, "packages/tools/src/postcards", name),
    ),
  );
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
    /* New seed manifest. */
  }
  const old = document.phase12 as MainCameraManifest | undefined;
  const planStart = performance.now(),
    plan = await loadPlan(seed, sourceHash, root);
  const context = createWorldContext({ kind: "main", seed, plan });
  const planMs = performance.now() - planStart;
  const query = cameraQuery(context),
    cameras = new Map(
      retainedMainCameras(old, seed, sourceHash).map((camera) => [
        camera.id,
        camera,
      ]),
    ),
    entries: {
      id: PostcardId;
      reused: boolean;
      candidates: number;
      durationMs: number;
    }[] = [];
  const orderedCameras = (): ResolvedMainCamera[] =>
    context.regions.flatMap((region) => {
      const camera = cameras.get(firstPassId(region.id));
      return camera ? [camera] : [];
    });
  const persist = async (): Promise<void> => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(
      path,
      `${JSON.stringify({ ...document, phase12: { schema: 1, worldKind: "main", seed, worldgenVersion: WORLDGEN_VERSION, sourceHash, resolverHash, cameras: orderedCameras() } }, null, 2)}\n`,
    );
  };
  for (const region of context.regions) {
    const id = firstPassId(region.id),
      begin = performance.now();
    // Keep compatible other-region entries without pretending they were validated
    // in a selected-only run. Every camera actually captured is validated below.
    if (!requested.includes(id)) continue;
    const anchor = context.regionAnchor(region.id);
    if (!anchor) throw new Error(`No main anchor for ${region.id}`);
    const previous = cameras.get(id);
    if (previous) {
      try {
        if (
          previous.region !== region.id ||
          previous.seed !== seed ||
          (previous.kind !== "aerial" && previous.kind !== "eye-level")
        )
          throw new Error("Camera definition mismatch");
        const revalidated = revalidateMainCamera(previous, query, resolverHash);
        if (revalidated) {
          cameras.set(id, revalidated);
          entries.push({
            id,
            reused: true,
            candidates: 0,
            durationMs: performance.now() - begin,
          });
          await persist();
          query.clear();
          continue;
        }
      } catch {
        /* A malformed stored camera is re-resolved, never trusted. */
      }
      console.log(`Stored ${id} failed geometric validation; resolving again`);
    }
    console.log(`Resolving ${id}:50 candidate cameras`);
    let best: ResolvedMainCamera | undefined;
    for (let candidate = 0; candidate < 50; candidate++) {
      const view = mainCameraCandidate(
        region.id,
        anchor,
        candidate,
        context,
        query,
      );
      if (!view) continue;
      const validation = inspectMainCamera(view, query);
      const score = cameraScore(view, validation);
      const checked: ResolvedMainCamera = {
        ...view,
        id,
        seed,
        ungraded: true,
        validation,
        score,
        validatedByResolverHash: resolverHash,
      };
      if (!best || checked.score > best.score) best = checked;
    }
    if (!best?.validation.passed)
      throw new Error(
        `No ${id} camera passed geometry: ${JSON.stringify(best)}`,
      );
    cameras.set(id, best);
    entries.push({
      id,
      reused: false,
      candidates: 50,
      durationMs: performance.now() - begin,
    });
    await persist();
    query.clear();
  }
  const manifest: MainCameraManifest = {
    schema: 1,
    worldKind: "main",
    seed,
    worldgenVersion: WORLDGEN_VERSION,
    sourceHash,
    resolverHash,
    cameras: orderedCameras(),
    resolution: { planMs, totalMs: performance.now() - started, entries },
  };
  // Timing receipts are private; committed camera data stays deterministic.
  await persist();
  return manifest;
}
