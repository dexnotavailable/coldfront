import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { PNG } from "pngjs";

export interface Raster<T> {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
  readonly metadata: T;
}
export function encodeRaster<T>(raster: Raster<T>): Buffer {
  if (raster.rgba.byteLength !== raster.width * raster.height * 4)
    throw new Error("RGBA buffer does not match the raster dimensions");
  const png = new PNG({ width: raster.width, height: raster.height });
  png.data = Buffer.from(
    raster.rgba.buffer,
    raster.rgba.byteOffset,
    raster.rgba.byteLength,
  );
  return PNG.sync.write(png, { colorType: 6, inputColorType: 6 });
}
export async function sourceHashes(
  root: string,
): Promise<readonly { path: string; sha256: string }[]> {
  async function walk(path: string): Promise<string[]> {
    const entries = await readdir(path, { withFileTypes: true });
    return (
      await Promise.all(
        entries.map((e) =>
          e.isDirectory()
            ? walk(join(path, e.name))
            : Promise.resolve([join(path, e.name)]),
        ),
      )
    ).flat();
  }
  const dirs = [
    "packages/shared/src",
    "packages/tools/src/terrain-review",
    "packages/tools/src/atlas",
    "packages/tools/src/slice",
  ];
  const files = (await Promise.all(dirs.map((d) => walk(resolve(root, d)))))
    .flat()
    .filter((p) => p.endsWith(".ts"))
    .sort();
  return Promise.all(
    files.map(async (path) => ({
      path: relative(root, path).replaceAll("\\", "/"),
      sha256: createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
    })),
  );
}
export async function writeRaster<T>(
  root: string,
  imagePath: string,
  raster: Raster<T>,
  timingMs: number,
  sources: readonly { path: string; sha256: string }[],
): Promise<string> {
  const encodeStart = performance.now(),
    bytes = encodeRaster(raster),
    encodeMs = performance.now() - encodeStart;
  const writeStart = performance.now(),
    target = resolve(root, imagePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
  const imageWriteMs = performance.now() - writeStart;
  const receipt = target.replace(/\.png$/i, ".json");
  let commit: string | null = null;
  try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch {
    /* Source hashes remain authoritative outside a checkout. */
  }
  const pngjs = createRequire(import.meta.url)("pngjs/package.json") as {
    version: string;
  };
  await writeFile(
    receipt,
    `${JSON.stringify({ schema: "coldfront.terrain-review/1", createdUtc: new Date().toISOString(), commit, image: relative(root, target).replaceAll("\\", "/"), imageSha256: createHash("sha256").update(bytes).digest("hex"), width: raster.width, height: raster.height, encoder: { name: "pngjs", version: pngjs.version }, timings: { samplingMs: timingMs, encodeMs, imageWriteMs }, sampling: raster.metadata, sources }, null, 2)}\n`,
  );
  return receipt;
}
