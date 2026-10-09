import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validatePostcardSelection } from "../../../client/src/bootstrap/postcard.js";
import type {
  PostcardId,
  WorldPostcard,
} from "../../../client/src/game/postcard.js";
import { sourceFingerprints } from "../build/metadata.js";
import {
  type MainCameraManifest,
  parsePostcardIds,
  type ResolvedMainCamera,
  resolveMainCameras,
} from "./main-resolve.js";
import { type PostcardCamera, resolveTestCamera } from "./resolve.js";
export interface PreparedPostcards {
  readonly ids: readonly PostcardId[];
  readonly seed: number;
  readonly world: "main" | "test";
  readonly sourceHash: string;
  readonly path: string;
  readonly cameras: readonly WorldPostcard[];
  readonly definitions: readonly (PostcardCamera | ResolvedMainCamera)[];
  readonly receipt: string;
  readonly resolution: MainCameraManifest["resolution"] | null;
}
const pending = new Map<string, Promise<PreparedPostcards>>();
export function postcardArguments(args: readonly string[]) {
  const flag = (name: string): string | null => {
    const at = args.indexOf(name);
    if (at < 0) return null;
    const value = args[at + 1];
    if (value === undefined || value.startsWith("--"))
      throw new Error(`Missing value for ${name}`);
    return value;
  };
  const seed = Number(flag("--seed") ?? "1");
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("Postcard seed must be an unsigned32-bit integer");
  const ids = parsePostcardIds(flag("--phase"), flag("--only"));
  return {
    seed,
    ids,
    world: (ids[0] === "TEST-1" ? "test" : "main") as "test" | "main",
  };
}
/** Resolver entry is separate from capture: --resolve-only never starts a browser.
 * The runner invokes it before Vite computes source metadata and serves cameras. */
export function preparePostcards(
  args = process.argv.slice(2),
  root = process.cwd(),
): Promise<PreparedPostcards> {
  const { seed, ids, world } = postcardArguments(args),
    key = JSON.stringify([root, seed, ids]);
  const old = pending.get(key);
  if (old) return old;
  const operation = (async () => {
    const started = performance.now(),
      sourceHash = sourceFingerprints(root).cacheTag;
    const output = resolve(root, "out/postcards/resolution");
    await mkdir(output, { recursive: true });
    const receipt = resolve(output, `${world}-s${seed}-${Date.now()}.json`);
    try {
      let resolution: MainCameraManifest["resolution"] | null = null;
      let definitions: readonly (PostcardCamera | ResolvedMainCamera)[];
      if (world === "test") definitions = [await resolveTestCamera(seed, root)];
      else {
        const main = await resolveMainCameras(seed, root, ids);
        resolution = main.resolution;
        definitions = main.cameras;
      }
      const path = resolve(
        root,
        "packages/tools/postcards/cameras",
        `seed-${seed}.json`,
      );
      const document = JSON.parse(await readFile(path, "utf8")) as unknown;
      const selected = validatePostcardSelection(
        document,
        ids[0] as string,
        seed,
        sourceHash,
      );
      const cameras = ids.map((id) => {
        const camera = selected.cameras.find((item) => item.id === id);
        if (!camera) throw new Error(`Missing resolved ${id}`);
        return camera;
      });
      await writeFile(
        receipt,
        JSON.stringify(
          {
            seed,
            ids,
            world,
            sourceHash,
            resolution,
            totalMs: performance.now() - started,
            cameras,
            definitions,
            status: "resolved",
          },
          null,
          2,
        ),
      );
      return {
        ids,
        seed,
        world,
        sourceHash,
        path,
        cameras,
        definitions,
        receipt,
        resolution,
      };
    } catch (error) {
      await writeFile(
        receipt,
        JSON.stringify(
          {
            seed,
            ids,
            world,
            sourceHash,
            failure: String(error),
            totalMs: performance.now() - started,
            status: "failed",
          },
          null,
          2,
        ),
      );
      throw error;
    }
  })();
  pending.set(key, operation);
  return operation;
}
