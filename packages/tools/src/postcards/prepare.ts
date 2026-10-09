import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validatePostcardSelection } from "../../../client/src/bootstrap/postcard.js";
import type { TerrainViewMode } from "../../../client/src/engine/terrain-material.js";
import type {
  PostcardId,
  WorldPostcard,
} from "../../../client/src/game/postcard.js";
import type { GenerationVariant } from "../../../shared/src/world/generation-variant.js";
import { sourceFingerprints } from "../build/metadata.js";
import { type ResolvedHellCamera, resolveHellCameras } from "./hell-resolve.js";
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
  readonly phase: "1.1" | "1.2" | "1.3";
  readonly variant: GenerationVariant;
  readonly view: TerrainViewMode;
  readonly sourceHash: string;
  readonly path: string;
  readonly cameras: readonly WorldPostcard[];
  readonly definitions: readonly (
    | PostcardCamera
    | ResolvedMainCamera
    | ResolvedHellCamera
  )[];
  readonly receipt: string;
  readonly resolution: MainCameraManifest["resolution"] | null;
}
const pending = new Map<string, Promise<PreparedPostcards>>();
export function postcardArguments(
  args: readonly string[],
): Pick<
  PreparedPostcards,
  "seed" | "ids" | "phase" | "variant" | "view" | "world"
> {
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
  const variant: GenerationVariant = args.includes("--primitive")
    ? "primitive"
    : "production";
  const view = flag("--view") ?? "normal";
  if (view !== "normal" && view !== "clay" && view !== "features")
    throw new Error("Postcard view must be normal, clay or features");
  const phase = ids[0]?.startsWith("HELL-")
    ? "1.3"
    : ids[0] === "TEST-1"
      ? "1.1"
      : "1.2";
  if (variant === "primitive" && phase !== "1.3")
    throw new Error("Primitive postcards require phase1.3 HELL views");
  return {
    seed,
    ids,
    phase,
    variant,
    view,
    world: (ids[0] === "TEST-1" ? "test" : "main") as "test" | "main",
  };
}
export function postcardOutputStem(
  id: string,
  seed: number,
  variant: GenerationVariant,
  view: TerrainViewMode,
  sourceHash: string,
): string {
  if (!/^[a-f0-9]{64}$/.test(sourceHash))
    throw new Error("Missing postcard source identity");
  return `${id}-s${seed}-${variant}-${view}-${sourceHash}`;
}
/** Resolver entry is separate from capture: --resolve-only never starts a browser.
 * The runner invokes it before Vite computes source metadata and serves cameras. */
export function preparePostcards(
  args = process.argv.slice(2),
  root = process.cwd(),
): Promise<PreparedPostcards> {
  const { seed, ids, world, phase, variant, view } = postcardArguments(args),
    sourceHash = sourceFingerprints(root).cacheTag,
    key = JSON.stringify([root, seed, ids, variant, view, sourceHash]);
  const old = pending.get(key);
  if (old) return old;
  const operation = (async () => {
    const started = performance.now();
    const output = resolve(root, "out/postcards/resolution");
    await mkdir(output, { recursive: true });
    const receipt = resolve(
      output,
      `${postcardOutputStem(`${world}-phase${phase}`, seed, variant, view, sourceHash)}-${Date.now()}.json`,
    );
    try {
      let resolution: MainCameraManifest["resolution"] | null = null;
      let resolutionAttempts: string | null = null;
      let definitions: readonly (
        | PostcardCamera
        | ResolvedMainCamera
        | ResolvedHellCamera
      )[];
      if (world === "test") definitions = [await resolveTestCamera(seed, root)];
      else if (phase === "1.3") {
        const hell = await resolveHellCameras(seed, root, ids, variant);
        resolution = hell.resolution;
        resolutionAttempts = hell.attemptsPath;
        definitions = hell.cameras;
      } else {
        const main = await resolveMainCameras(seed, root, ids);
        resolution = main.resolution;
        definitions = main.cameras;
      }
      const path = resolve(
        root,
        "packages/tools/postcards/cameras",
        `seed-${seed}.json`,
      );
      // Resolvers persist JSON; finish with the repository's pinned formatter so
      // repeated preparation preserves the camera bytes used by build metadata.
      const serialized = await readFile(path, "utf8");
      const formatted = execFileSync(
        process.execPath,
        [
          resolve(root, "node_modules/@biomejs/biome/bin/biome"),
          "format",
          "--stdin-file-path",
          path,
        ],
        { cwd: root, input: serialized, encoding: "utf8", windowsHide: true },
      );
      if (formatted !== serialized) await writeFile(path, formatted);
      const document = JSON.parse(formatted) as unknown;
      const selected = validatePostcardSelection(
        document,
        ids[0] as string,
        seed,
        sourceHash,
        variant,
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
            phase,
            variant,
            view,
            sourceHash,
            resolution,
            resolutionAttempts,
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
        phase,
        variant,
        view,
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
            phase,
            variant,
            view,
            sourceHash,
            failure: String(error),
            totalMs: performance.now() - started,
            status: "failed",
          },
          null,
          2,
        ),
      );
      pending.delete(key);
      throw error;
    }
  })();
  pending.set(key, operation);
  return operation;
}
