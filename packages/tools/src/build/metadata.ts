import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";

export interface BuildMetadata {
  readonly version: string;
  readonly basePath: string;
  readonly commit: string;
  readonly cacheTag: string;
  readonly buildId: string;
}

export function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

/** Stable across Windows/Unix checkouts; includes paths to detect renames. */
export function contentHash(root: string, files: readonly string[]): string {
  const hash = createHash("sha256");
  const entries = files
    .map((file) => ({ file, path: relative(root, file).replaceAll("\\", "/") }))
    .sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    );
  for (const { file, path } of entries) {
    hash.update(path);
    hash.update("\0");
    const bytes = readFileSync(file);
    const text =
      /\.(?:[cm]?tsx?|[cm]?jsx?|css|json|html?|md|txt|svg|ya?ml|toml|xml|wgsl|glsl|vert|frag|csv)$/i.test(
        extname(file),
      ) || basename(file) === "_headers";
    hash.update(text ? bytes.toString("utf8").replaceAll("\r\n", "\n") : bytes);
    hash.update("\0");
  }
  return hash.digest("hex");
}

/** Save compatibility follows docs04 section3: worldgen/registry, never rendering. */
export function sourceFingerprints(
  root: string,
  basePath = "/",
): { cacheTag: string; releaseHash: string } {
  const sharedRoot = join(root, "packages/shared/src");
  // These cover current imports; new deterministic worldgen input modules belong here.
  const worldInputs = ["worldgen", "math", "noise", "world", "sdf"].flatMap(
    (directory) => {
      const path = join(sharedRoot, directory);
      return existsSync(path) ? sourceFiles(path) : [];
    },
  );
  worldInputs.push(join(sharedRoot, "blocks/registry.ts"));
  const cacheTag = contentHash(root, worldInputs);
  const shared = sourceFiles(join(root, "packages/shared/src"));
  const authored = [
    ...shared,
    ...sourceFiles(join(root, "packages/client/src")),
    ...sourceFiles(join(root, "packages/client/public")),
    ...sourceFiles(join(root, "packages/tools/src/build")),
    ...sourceFiles(join(root, "packages/tools/postcards/cameras")),
    join(root, "packages/client/index.html"),
    join(root, "packages/client/vite.config.ts"),
    join(root, "packages/client/package.json"),
    join(root, "THIRD_PARTY_NOTICES.md"),
    join(root, "package.json"),
    join(root, "package-lock.json"),
  ];
  return {
    cacheTag,
    releaseHash: createHash("sha256")
      .update(`${basePath}\0${contentHash(root, authored)}`)
      .digest("hex"),
  };
}

export function buildMetadata(root: string, basePath = "/"): BuildMetadata {
  const manifest = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
  ) as { version: string };
  const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  if (!/^[a-f0-9]{40,64}$/.test(commit))
    throw new Error("Missing actual Git SHA");
  const { cacheTag, releaseHash } = sourceFingerprints(root, basePath);
  return Object.freeze({
    version: manifest.version,
    basePath,
    commit,
    cacheTag,
    buildId: `${commit}-${releaseHash}`,
  });
}
