import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { type BuildMetadata, sourceFiles } from "./metadata.js";

export interface PublicArtifact {
  readonly path: string;
  readonly content: string;
  readonly type: string;
}
interface PackageManifest {
  name: string;
  version: string;
  license?: string;
  dependencies?: Record<string, string>;
}

function packageDirectory(name: string, from: string): string {
  let at = from;
  for (;;) {
    const candidate = join(at, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return candidate;
    const parent = dirname(at);
    if (parent === at) throw new Error(`Installed package missing: ${name}`);
    at = parent;
  }
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/** Actual installed runtime notices, plus separately shipped MPL source files. */
export function publicArtifacts(
  root: string,
  metadata: BuildMetadata,
): PublicArtifact[] {
  const artifacts: PublicArtifact[] = [];
  const notices = readFileSync(join(root, "THIRD_PARTY_NOTICES.md"), "utf8");
  artifacts.push({
    path: "licenses/THIRD_PARTY_NOTICES.md",
    content: notices,
    type: "text/plain",
  });
  const sections = [notices];
  const visited = new Set<string>();
  const collect = (directory: string): void => {
    const manifest = JSON.parse(
      readFileSync(join(directory, "package.json"), "utf8"),
    ) as PackageManifest;
    const identity = `${manifest.name}@${manifest.version}`;
    if (visited.has(identity)) return;
    visited.add(identity);
    const files = readdirSync(directory).filter((name) =>
      /^(licen[cs]e|copying|ofl|notice)([.-]|$)/i.test(name),
    );
    if (!files.length)
      throw new Error(`No upstream notice in runtime package ${identity}`);
    sections.push(`\n## ${identity} (${manifest.license ?? "see notice"})\n`);
    for (const name of files) {
      const content = readFileSync(join(directory, name), "utf8");
      sections.push(content);
      artifacts.push({
        path: `licenses/npm/${identity.replaceAll("/", "-")}/${name}`,
        content,
        type: "text/plain",
      });
    }
    for (const name of Object.keys(manifest.dependencies ?? {}).sort())
      collect(packageDirectory(name, directory));
  };
  const client = JSON.parse(
    readFileSync(join(root, "packages/client/package.json"), "utf8"),
  ) as PackageManifest;
  for (const name of Object.keys(client.dependencies ?? {}).sort())
    collect(packageDirectory(name, join(root, "packages/client")));
  const mplLinks: string[] = [];
  for (const file of [
    ...sourceFiles(join(root, "packages/shared/src")),
    ...sourceFiles(join(root, "packages/client/src")),
  ]) {
    const source = readFileSync(file, "utf8");
    if (!/MPL-2\.0|Mozilla Public License/.test(source)) continue;
    const path = `licenses/source/${relative(root, file).replaceAll("\\", "/")}`;
    artifacts.push({ path, content: source, type: "text/plain" });
    sections.push(`\nMPL source: ${path}\n`);
    mplLinks.push(
      `<p><a href="${path.slice("licenses/".length)}">${escapeHtml(relative(root, file).replaceAll("\\", "/"))}</a></p>`,
    );
  }
  artifacts.push({
    path: "licenses/index.html",
    content: `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Licences · COLDFRONT</title><body><h1>Licences</h1>${mplLinks.join("")}<pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(sections.join("\n"))}</pre></body></html>`,
    type: "text/html",
  });
  artifacts.push({
    path: "version.json",
    content: `${JSON.stringify(metadata, null, 2)}\n`,
    type: "application/json",
  });
  for (const file of sourceFiles(
    join(root, "packages/tools/postcards/cameras"),
  )) {
    if (/^seed-\d+\.json$/.test(basename(file)))
      artifacts.push({
        path: `postcards/cameras/${basename(file)}`,
        content: readFileSync(file, "utf8"),
        type: "application/json",
      });
  }
  return artifacts;
}
