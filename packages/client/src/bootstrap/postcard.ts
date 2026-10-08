import type { GameOptions } from "../game/create-game.js";
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

/** Never takes camera JSON from URL input: only the locally resolved, bundled seed file. */
export async function loadPostcard(
  query: URLSearchParams,
  seed: number,
  base: string,
): Promise<GameOptions["postcard"]> {
  const id = query.get("postcard");
  if (id === null) return undefined;
  if (id !== "TEST-1")
    throw new Error(`Postcard ${id} is unavailable in phase 1.1`);
  const response = await fetch(
    appRoute(base, `postcards/cameras/seed-${seed}.json`, location.origin),
  );
  if (!response.ok)
    throw new Error(`Local TEST-1 camera missing for seed ${seed}`);
  return validatePostcard(await response.json(), seed);
}
