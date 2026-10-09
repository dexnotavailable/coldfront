import { SURFACE_REGIONS } from "../../../shared/src/world/regions.js";
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
): PostcardSelection {
  if (!/^[a-f0-9]{64}$/.test(sourceHash))
    throw new Error("Missing postcard source identity");
  if (id === "TEST-1") {
    const camera = validatePostcard(value, seed);
    const initial: WorldPostcard = {
      ...camera,
      identity: {
        kind: "test",
        seed,
        generation: `${WORLDGEN_VERSION}:${sourceHash}`,
      },
    };
    return { initial, cameras: [initial] };
  }
  const ids = new Set(SURFACE_REGIONS.map((region) => `P12-${region.id}`));
  if (!ids.has(id)) throw new Error(`Postcard ${id} is unavailable`);
  const manifest = (
    value as {
      phase12?: {
        schema?: unknown;
        worldKind?: unknown;
        seed?: unknown;
        worldgenVersion?: unknown;
        sourceHash?: unknown;
        cameras?: unknown;
      };
    } | null
  )?.phase12;
  if (
    manifest?.schema !== 1 ||
    manifest.worldKind !== "main" ||
    manifest.seed !== seed ||
    manifest.worldgenVersion !== WORLDGEN_VERSION ||
    manifest.sourceHash !== sourceHash ||
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
      validation?: { passed?: unknown };
    };
    const point = (p: StoredPostcard["position"] | undefined) =>
      !!p && [p.x, p.y, p.z].every(Number.isFinite);
    if (
      !camera ||
      typeof camera.id !== "string" ||
      !ids.has(camera.id) ||
      seen.has(camera.id) ||
      camera.id !== `P12-${camera.region}` ||
      camera.seed !== seed ||
      (camera.kind !== "eye-level" && camera.kind !== "aerial") ||
      camera.ungraded !== true ||
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
        generation: `${WORLDGEN_VERSION}:${sourceHash}`,
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
  );
  const kind = query.get("world");
  if (kind !== null && kind !== selection.initial.identity.kind)
    throw new Error("Postcard world selection mismatch");
  return selection;
}
