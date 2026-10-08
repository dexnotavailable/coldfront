import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type {
  WorldEvidenceManifest,
  WorldHudRow,
} from "../../../client/src/ui/gallery/world-evidence";

function safePath(base: string, path: string): string {
  const full = resolve(base, path);
  const rel = relative(base, full);
  if (
    isAbsolute(path) ||
    path.includes(":") ||
    rel === ".." ||
    rel.startsWith("../") ||
    rel.startsWith("..\\")
  )
    throw new Error(`Evidence path escapes its root: ${path}`);
  return full;
}
function digest(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
function sources(base: string, dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(dir, entry.name);
    return entry.isDirectory()
      ? sources(base, full)
      : /\.(?:ts|js|mjs)$/.test(entry.name)
        ? [relative(base, full).replaceAll("\\", "/")]
        : [];
  });
}
interface Telemetry {
  ready?: boolean;
  rendered?: { outline?: boolean; ghost?: boolean; silhouette?: boolean };
  target?: { distance?: number } | null;
  ghost?: unknown;
}
interface RunReceipt {
  errors?: unknown[];
  results?: { name: string; telemetry: Telemetry }[];
}
/** Reads encoded dimensions without loading a native image codec in Node-only checks. */
export function evidenceImageSize(bytes: Buffer): {
  format: "png" | "jpeg";
  width: number;
  height: number;
} {
  if (
    bytes.length >= 24 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.toString("ascii", 12, 16) === "IHDR"
  )
    return {
      format: "png",
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset < bytes.length) {
      if (bytes[offset++] !== 0xff) throw new Error("Malformed JPEG marker");
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (
        marker === 0x01 ||
        (marker !== undefined && marker >= 0xd0 && marker <= 0xd8)
      )
        continue;
      if (offset + 2 > bytes.length) break;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length)
        throw new Error("Truncated JPEG segment");
      if (
        marker !== undefined &&
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      ) {
        if (length < 8) throw new Error("Truncated JPEG frame");
        return {
          format: "jpeg",
          height: bytes.readUInt16BE(offset + 3),
          width: bytes.readUInt16BE(offset + 5),
        };
      }
      offset += length;
    }
  }
  throw new Error(
    "World evidence must be an encoded PNG or JPEG with dimensions",
  );
}
export function checkWorldEvidence(
  manifest: WorldEvidenceManifest,
  repo: string,
  renderedFixtureIds: ReadonlySet<string>,
): { errors: string[]; covered: WorldHudRow[] } {
  const errors: string[] = [];
  const covered = new Set<WorldHudRow>();
  if (manifest.version !== 1)
    return { errors: ["Unsupported world evidence schema"], covered: [] };
  const publicRoot = resolve(repo, "packages/client/public");
  const seen = new Set<string>();
  for (const item of manifest.cases) {
    try {
      if (!/^[a-z0-9-]+$/.test(item.id) || seen.has(item.id))
        throw new Error("Invalid/duplicate world fixture ID");
      seen.add(item.id);
      if (!renderedFixtureIds.has(item.id))
        throw new Error("World evidence image is absent from the SSR gallery");
      if (!item.rows.length) throw new Error("World evidence has no HUD rows");
      for (const [path, hash] of [
        [item.image, item.imageSha256],
        [item.telemetry, item.telemetrySha256],
        [item.runReceipt, item.runReceiptSha256],
      ]) {
        if (
          !path ||
          !hash ||
          !/^[a-f0-9]{64}$/i.test(hash) ||
          digest(safePath(publicRoot, path)) !== hash.toLowerCase()
        )
          throw new Error(`Missing or changed world evidence: ${path}`);
      }
      const pixels = readFileSync(safePath(publicRoot, item.image));
      const dimensions = evidenceImageSize(pixels);
      if (dimensions.width !== 1280 || dimensions.height !== 720)
        throw new Error("World evidence must be1280x720");
      if (dimensions.format === "jpeg") {
        const encoding = item.encoding;
        if (
          !encoding ||
          encoding.sourceFormat !== "png" ||
          encoding.format !== "jpeg" ||
          encoding.encoder !== "sharp" ||
          !/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(encoding.encoderVersion) ||
          encoding.quality !== 85 ||
          encoding.width !== 1280 ||
          encoding.height !== 720 ||
          encoding.resized !== false ||
          !/^[a-f0-9]{64}$/i.test(encoding.sourceImageSha256) ||
          !encoding.sourceImage.startsWith("out/engine/") ||
          !encoding.sourceImage.endsWith(".png")
        )
          throw new Error(
            "JPEG evidence is missing explicit conversion provenance",
          );
        const original = safePath(repo, encoding.sourceImage);
        if (
          existsSync(original) &&
          digest(original) !== encoding.sourceImageSha256.toLowerCase()
        )
          throw new Error("Original PNG does not match JPEG provenance");
      }
      const telemetry = JSON.parse(
        readFileSync(safePath(publicRoot, item.telemetry), "utf8"),
      ) as Telemetry;
      const run = JSON.parse(
        readFileSync(safePath(publicRoot, item.runReceipt), "utf8"),
      ) as RunReceipt;
      if (
        !Array.isArray(run.errors) ||
        run.errors.length ||
        !run.results?.some(
          (result) =>
            result.name === item.id &&
            isDeepStrictEqual(result.telemetry, telemetry),
        )
      )
        throw new Error(
          "Driver receipt does not match this successful capture",
        );
      if (!telemetry.ready) throw new Error("World capture was not ready");
      const captured = new Map(
        item.sources.map((source) => [
          source.path.replaceAll("\\", "/"),
          source.sha256,
        ]),
      );
      if (!captured.size)
        throw new Error("No renderer source snapshot recorded");
      for (const [path, hash] of captured) {
        if (
          !/^[a-f0-9]{64}$/i.test(hash) ||
          digest(safePath(repo, path)) !== hash.toLowerCase()
        )
          throw new Error(`Stale renderer evidence: ${path}`);
      }
      for (const prefix of [
        "packages/client/src/engine",
        "packages/client/src/game",
        "packages/client/src/dev",
        "packages/shared/src",
      ]) {
        for (const path of sources(repo, resolve(repo, prefix)))
          if (!captured.has(path))
            throw new Error(`Source snapshot omits ${path}`);
      }
      for (const row of item.rows) {
        if (!["hud.outline", "hud.ghost", "hud.silhouette"].includes(row))
          throw new Error(`Not a world HUD row: ${row}`);
        const key = row.slice(4) as keyof NonNullable<Telemetry["rendered"]>;
        if (!telemetry.rendered?.[key])
          throw new Error(`Capture did not draw ${row}`);
        if (
          row !== "hud.silhouette" &&
          (!(Number(telemetry.target?.distance) > 0) ||
            !(Number(telemetry.target?.distance) <= 5))
        )
          throw new Error("World target is outside creative reach");
        if (row === "hud.ghost" && !telemetry.ghost)
          throw new Error("Capture has no actual placement ghost");
      }
      for (const row of item.rows) covered.add(row);
    } catch (error) {
      errors.push(`${item.id}: ${String(error)}`);
    }
  }
  return { errors, covered: [...covered] };
}
