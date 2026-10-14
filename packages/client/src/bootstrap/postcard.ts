import {
  type GenerationVariant,
  generationKey,
  generationVariant,
} from "../../../shared/src/world/generation-variant.js";
import { SURFACE_REGIONS } from "../../../shared/src/world/regions.js";
import type { WorldIdentity } from "../../../shared/src/world/types.js";
import { WORLDGEN_VERSION } from "../../../shared/src/worldgen/version.js";
import type { PostcardId, WorldPostcard } from "../game/postcard.js";
import { appRoute } from "./host.js";

export interface StoredPostcard {
  readonly id: "TEST-1";
  readonly seed: number;
  readonly position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly target: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly hours: number;
  readonly radius: number;
}

export function validatePostcard(value: unknown, seed: number): StoredPostcard {
  const camera = value as Partial<StoredPostcard> | null;
  const point = (p: StoredPostcard["position"] | undefined): boolean =>
    !!p && [p.x, p.y, p.z].every(Number.isFinite);
  if (
    camera?.id !== "TEST-1" ||
    camera.seed !== seed ||
    !point(camera.position) ||
    !point(camera.target) ||
    typeof camera.hours !== "number" ||
    camera.hours < 0 ||
    camera.hours > 24 ||
    !Number.isFinite(camera.hours) ||
    typeof camera.radius !== "number" ||
    !Number.isFinite(camera.radius) ||
    camera.radius <= 0 ||
    camera.radius > 512
  )
    throw new Error(`Invalid local TEST-1 camera for seed ${seed}`);
  return camera as StoredPostcard;
}
export interface PostcardSelection {
  readonly initial: WorldPostcard;
  readonly cameras: readonly WorldPostcard[];
}
export function validatePostcardSelection(
  value: unknown,
  id: string,
  seed: number,
  sourceHash: string,
  variant: GenerationVariant = "production",
): PostcardSelection {
  if (!/^[a-f0-9]{64}$/.test(sourceHash))
    throw new Error("Missing postcard source identity");
  if (id === "TEST-1") {
    if (variant !== "production")
      throw new Error("Primitive generation requires a main world");
    const camera = validatePostcard(value, seed);
    const initial: WorldPostcard = {
      ...camera,
      identity: {
        kind: "test",
        seed,
        generation: generationKey(WORLDGEN_VERSION, sourceHash, variant),
      },
    };
    return { initial, cameras: [initial] };
  }
  const hell = id === "HELL-1" || id === "HELL-2";
  const ids = new Set(
    hell
      ? ["HELL-1", "HELL-2"]
      : SURFACE_REGIONS.map((region) => `P12-${region.id}`),
  );
  if (variant !== "production" && variant !== "primitive")
    throw new Error("Unknown generation variant");
  if (!hell && variant !== "production")
    throw new Error("No primitive first-pass postcards");
  if (!ids.has(id)) throw new Error(`Postcard ${id} is unavailable`);
  const key = hell
    ? variant === "primitive"
      ? "phase13Primitive"
      : "phase13"
    : "phase12";
  const manifest = (
    value as Record<
      string,
      {
        schema?: unknown;
        worldKind?: unknown;
        seed?: unknown;
        worldgenVersion?: unknown;
        sourceHash?: unknown;
        resolverHash?: unknown;
        variant?: unknown;
        cameras?: unknown;
      }
    > | null
  )?.[key];
  if (
    manifest?.schema !== 1 ||
    manifest.worldKind !== "main" ||
    manifest.seed !== seed ||
    manifest.worldgenVersion !== WORLDGEN_VERSION ||
    manifest.sourceHash !== sourceHash ||
    (hell &&
      (manifest.variant !== variant ||
        typeof manifest.resolverHash !== "string" ||
        !/^[a-f0-9]{64}$/.test(manifest.resolverHash))) ||
    !Array.isArray(manifest.cameras)
  )
    throw new Error("Main postcard manifest is missing or stale");
  const cameras: WorldPostcard[] = [],
    seen = new Set<string>();
  for (const value of manifest.cameras) {
    const camera = value as Omit<Partial<StoredPostcard>, "id"> & {
      id?: string;
      region?: string;
      kind?: string;
      ungraded?: boolean;
      validatedByResolverHash?: unknown;
      targetFeature?: {
        kind?: unknown;
        featureIds?: unknown;
        calderaId?: unknown;
        bounds?: Record<string, unknown>;
      };
      validation?: { passed?: unknown };
    };
    const point = (p: StoredPostcard["position"] | undefined) =>
      !!p && [p.x, p.y, p.z].every(Number.isFinite);
    if (
      !camera ||
      typeof camera.id !== "string" ||
      !ids.has(camera.id) ||
      seen.has(camera.id) ||
      (hell
        ? camera.region !== "hellscape"
        : camera.id !== `P12-${camera.region}`) ||
      camera.seed !== seed ||
      (camera.kind !== "eye-level" && camera.kind !== "aerial") ||
      (hell
        ? camera.kind !== "eye-level" ||
          camera.validatedByResolverHash !== manifest.resolverHash ||
          !validHellTarget(camera.id, camera.targetFeature)
        : camera.ungraded !== true) ||
      camera.validation?.passed !== true ||
      !point(camera.position) ||
      !point(camera.target) ||
      !Number.isFinite(camera.hours) ||
      Number(camera.hours) < 0 ||
      Number(camera.hours) > 24 ||
      !Number.isFinite(camera.radius) ||
      Number(camera.radius) <= 0 ||
      Number(camera.radius) > 512
    )
      throw new Error("Invalid local first-pass postcard");
    seen.add(camera.id);
    const position = camera.position as StoredPostcard["position"],
      target = camera.target as StoredPostcard["target"];
    if (
      position.x < -22528 ||
      position.x >= 22528 ||
      position.z < -22528 ||
      position.z >= 22528 ||
      Math.hypot(
        target.x - position.x,
        target.y - position.y,
        target.z - position.z,
      ) === 0
    )
      throw new Error("Invalid postcard camera frame");
    cameras.push({
      id: camera.id as PostcardId,
      identity: {
        kind: "main",
        seed,
        generation: generationKey(WORLDGEN_VERSION, sourceHash, variant),
      },
      position: { ...position },
      target: { ...target },
      hours: Number(camera.hours),
      radius: Number(camera.radius),
    });
  }
  const initial = cameras.find((camera) => camera.id === id);
  if (!initial) throw new Error(`Resolved camera ${id} is missing`);
  return { initial, cameras };
}

/** Never takes camera JSON from URL input: only the locally resolved, bundled seed file. */
export async function loadPostcard(
  query: URLSearchParams,
  seed: number,
  base: string,
  sourceHash: string,
): Promise<PostcardSelection | undefined> {
  const id = query.get("postcard");
  if (id === null) return undefined;
  const response = await fetch(
    appRoute(base, `postcards/cameras/seed-${seed}.json`, location.origin),
  );
  if (!response.ok)
    throw new Error(`Local postcard cameras missing for seed ${seed}`);
  const selection = validatePostcardSelection(
    await response.json(),
    id,
    seed,
    sourceHash,
    query.get("primitive") === "1" ? "primitive" : "production",
  );
  const kind = query.get("world");
  if (kind !== null && kind !== selection.initial.identity.kind)
    throw new Error("Postcard world selection mismatch");
  return selection;
}

function validHellTarget(id: string, value: unknown): boolean {
  const target = value as {
    kind?: unknown;
    featureIds?: unknown;
    calderaId?: unknown;
    bounds?: Record<string, unknown>;
  } | null;
  if (!target?.bounds) return false;
  const b = target.bounds;
  if (
    ![b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ].every(
      (n) => typeof n === "number" && Number.isFinite(n),
    ) ||
    Number(b.minX) > Number(b.maxX) ||
    Number(b.minY) > Number(b.maxY) ||
    Number(b.minZ) > Number(b.maxZ)
  )
    return false;
  const validId = (n: unknown) =>
    typeof n === "number" && Number.isInteger(n) && n > 0 && n <= 0xffffffff;
  return id === "HELL-1"
    ? target.kind === "thorn-cluster" &&
        Array.isArray(target.featureIds) &&
        target.featureIds.length > 0 &&
        target.featureIds.every(validId) &&
        new Set(target.featureIds).size === target.featureIds.length
    : target.kind === "caldera" && validId(target.calderaId);
}

/** Missing/stale catalogues expose no controls; automatic capture still fails loudly. */
export async function loadPostcardCatalogue(
  identity: WorldIdentity,
  base: string,
  sourceHash: string,
): Promise<readonly WorldPostcard[]> {
  const variant = generationVariant(identity);
  if (
    identity.generation !== generationKey(WORLDGEN_VERSION, sourceHash, variant)
  )
    return [];
  try {
    const response = await fetch(
      appRoute(
        base,
        `postcards/cameras/seed-${identity.seed}.json`,
        location.origin,
      ),
    );
    if (!response.ok) return [];
    const data: unknown = await response.json();
    const ids =
      identity.kind === "test"
        ? ["TEST-1"]
        : [
            ...(variant === "production"
              ? SURFACE_REGIONS.map((region) => `P12-${region.id}`)
              : []),
            "HELL-1",
            "HELL-2",
          ];
    const cameras: WorldPostcard[] = [];
    for (const id of ids) {
      try {
        cameras.push(
          validatePostcardSelection(
            data,
            id,
            identity.seed,
            sourceHash,
            variant,
          ).initial,
        );
      } catch {
        /* Unavailable or stale camera: no invented replacement view. */
      }
    }
    return cameras;
  } catch {
    return [];
  }
}
