import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import type { BuildMetadata } from "./metadata.js";

export const MAX_PUBLIC_FILE_BYTES = 25 * 1024 * 1024;
export const DEPLOYMENT = Object.freeze({
  mount: "D:/Dex/GameDev/Deploy/COLDFRONT/WebGL",
  releases: "D:/Dex/GameDev/Deploy/COLDFRONT/releases",
});
interface FileProof {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}
export interface DistributionProof {
  readonly root: string;
  readonly metadata: BuildMetadata;
  readonly files: readonly FileProof[];
  readonly manifestHash: string;
}
export interface PublishOptions {
  readonly dist: string;
  readonly expectedSha: string;
  readonly mount: string;
  readonly releases: string;
}
export interface PublicationReceipt {
  readonly id: string;
  readonly expectedSha: string;
  readonly buildId: string;
  readonly manifestHash: string;
  readonly files: readonly FileProof[];
  readonly mount: string;
  readonly release: string;
  readonly previous: string;
  readonly previousFiles: { path: string; existed: boolean }[];
  readonly startedAt: string;
  status:
    | "staged"
    | "publishing-assets"
    | "entry-promoted"
    | "published"
    | "failed-before-entry"
    | "interrupted-after-entry";
  entryPromoted: boolean;
  metadataPromoted: boolean;
  failure?: string;
}
export interface PublishHooks {
  /** Fault injection for temporary fixture tests only; the CLI never supplies hooks. */
  afterAsset?: (path: string) => void;
  beforeEntry?: () => void;
  afterEntry?: () => void;
}
const sha256 = (bytes: Uint8Array | string): string =>
  createHash("sha256").update(bytes).digest("hex");
const samePath = (a: string, b: string): boolean =>
  process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
function inside(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return (
    path === "" ||
    (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`))
  );
}
function safeDirectory(path: string, create: boolean): void {
  if (!existsSync(path)) {
    if (!create) throw new Error(`Directory missing: ${path}`);
    const parent = dirname(path);
    if (parent === path) throw new Error(`Invalid directory root: ${path}`);
    safeDirectory(parent, true);
    mkdirSync(path);
  }
  const stat = lstatSync(path);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    !samePath(realpathSync(path), resolve(path))
  )
    throw new Error(`Directory must not traverse a link: ${path}`);
}
function safeFilePath(path: string): void {
  const segments = path.split("/");
  for (const segment of segments) {
    if (
      !segment ||
      segment.startsWith(".") ||
      /[\\:]/.test(segment) ||
      [...segment].some((character) => character.charCodeAt(0) < 32) ||
      /[. ]$/.test(segment) ||
      /^(con|prn|aux|nul|com[0-9\u00b9\u00b2\u00b3]|lpt[0-9\u00b9\u00b2\u00b3]|conin\$|conout\$)(\.|$)/i.test(
        segment,
      )
    )
      throw new Error(`Hidden or unsafe public path: ${path}`);
    if (
      /(^|[-_. ])(secrets?|credentials?|tokens?|passwords?|passwd|cookies?|auth)([-_. ]|$)|^id_(rsa|dsa|ecdsa|ed25519)|\.(pem|key|p12|pfx|kdbx)$/i.test(
        segment,
      )
    )
      throw new Error(`Credential-like public path: ${path}`);
  }
  if (
    /^(packages|src|node_modules)\//.test(path) ||
    /^(package(-lock)?\.json|AGENTS\.md|CLAUDE\.md|tsconfig\.json)$/i.test(path)
  )
    throw new Error(`Source checkout file in distribution: ${path}`);
}
function walk(root: string, prefix = ""): string[] {
  return readdirSync(join(root, prefix), { withFileTypes: true })
    .flatMap((entry) => {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      safeFilePath(path);
      const stat = lstatSync(join(root, path));
      if (stat.isSymbolicLink())
        throw new Error(`Symlink in distribution: ${path}`);
      if (stat.isDirectory()) return walk(root, path);
      if (!stat.isFile()) throw new Error(`Non-file in distribution: ${path}`);
      if (stat.size > MAX_PUBLIC_FILE_BYTES)
        throw new Error(`Public file exceeds 25 MiB: ${path}`);
      return [path];
    })
    .sort();
}
function rejectWindowsHidden(root: string, files: readonly string[]): void {
  if (process.platform !== "win32") return;
  const paths = new Set<string>([root]);
  for (const file of files) {
    let path = join(root, file);
    while (inside(root, path)) {
      paths.add(path);
      if (samePath(path, root)) break;
      path = dirname(path);
    }
  }
  // Paths travel as JSON through stdin, never as interpolated shell code.
  const output = execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$paths = [Console]::In.ReadToEnd() | ConvertFrom-Json; foreach ($path in $paths) { $item = Get-Item -Force -LiteralPath $path -ErrorAction Stop; if (($item.Attributes -band [IO.FileAttributes]::Hidden) -ne 0) { [Console]::WriteLine($path) } }",
    ],
    { input: JSON.stringify([...paths]), encoding: "utf8", windowsHide: true },
  ).trim();
  if (output) throw new Error(`Hidden Windows file or directory: ${output}`);
}
function references(path: string, source: string): string[] {
  const found: string[] = [];
  if (/\.html?$/.test(path)) {
    for (const tag of source.matchAll(
      /<(?:script|link|img|source|video|audio)\b[^>]*>/gi,
    )) {
      for (const attribute of tag[0].matchAll(
        /\b(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi,
      ))
        if (attribute[1]) found.push(attribute[1]);
    }
  }
  if (path.endsWith(".css")) {
    for (const match of source.matchAll(
      /url\(\s*["']?([^\s"')]+)["']?\s*\)|@import\s+["']([^"']+)["']/g,
    ))
      if (match[1] ?? match[2]) found.push((match[1] ?? match[2]) as string);
  }
  if (/\.[cm]?js$/.test(path)) {
    const ast = ts.createSourceFile(
      path,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    const visit = (node: ts.Node): void => {
      if (
        ts.isStringLiteralLike(node) &&
        node.text.startsWith("/coldfront/assets/") &&
        !node.text.endsWith("/")
      )
        found.push(node.text);
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteralLike(node.moduleSpecifier)
      )
        found.push(node.moduleSpecifier.text);
      if (
        (ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ImportKeyword) ||
        (ts.isNewExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "URL")
      ) {
        const value = node.arguments?.[0];
        if (value && ts.isStringLiteralLike(value)) found.push(value.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  return found;
}
function assertReferences(files: readonly FileProof[], root: string): void {
  const paths = new Set(files.map((file) => file.path));
  for (const file of files) {
    if (!/\.(html?|css|[cm]?js)$/.test(file.path)) continue;
    for (const reference of references(
      file.path,
      readFileSync(join(root, file.path), "utf8"),
    )) {
      if (/^(data:|blob:|#)/i.test(reference)) continue;
      const url = new URL(
        reference,
        `https://coldfront.invalid/coldfront/${file.path}`,
      );
      if (
        url.origin !== "https://coldfront.invalid" ||
        !url.pathname.startsWith("/coldfront/")
      )
        throw new Error(
          `Non-local asset reference in ${file.path}: ${reference}`,
        );
      const path = decodeURIComponent(url.pathname.slice("/coldfront/".length));
      if (!paths.has(path.endsWith("/") ? `${path}index.html` : path))
        throw new Error(
          `Missing referenced asset in ${file.path}: ${reference}`,
        );
    }
  }
}
export function validateDistribution(
  dist: string,
  expectedSha: string,
): DistributionProof {
  if (!/^[a-f0-9]{40,64}$/.test(expectedSha))
    throw new Error("Expected a full Git SHA");
  const root = resolve(dist);
  safeDirectory(root, false);
  const names = walk(root);
  rejectWindowsHidden(root, names);
  if (!names.includes("index.html") || !names.includes("version.json"))
    throw new Error("Distribution requires index.html and version.json");
  const metadata = JSON.parse(
    readFileSync(join(root, "version.json"), "utf8"),
  ) as BuildMetadata;
  if (
    metadata.commit !== expectedSha ||
    metadata.basePath !== "/coldfront/" ||
    typeof metadata.version !== "string" ||
    !metadata.version ||
    !/^[a-f0-9]{64}$/.test(metadata.cacheTag) ||
    metadata.buildId !==
      `${expectedSha}-${metadata.buildId?.slice(expectedSha.length + 1)}` ||
    !/^[a-f0-9]{64}$/.test(metadata.buildId.slice(expectedSha.length + 1))
  )
    throw new Error(
      "Distribution metadata does not match the expected site release",
    );
  const files = names.map((path) => {
    const bytes = readFileSync(join(root, path));
    return { path, bytes: bytes.byteLength, sha256: sha256(bytes) };
  });
  assertReferences(files, root);
  return { root, metadata, files, manifestHash: sha256(JSON.stringify(files)) };
}
function assertFileBytes(path: string, proof: FileProof): void {
  if (lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile())
    throw new Error(`Expected an ordinary file: ${path}`);
  const bytes = readFileSync(path);
  if (bytes.byteLength !== proof.bytes || sha256(bytes) !== proof.sha256)
    throw new Error(`Immutable file bytes differ: ${path}`);
}
function immutable(path: string): boolean {
  return (
    path.startsWith("assets/") &&
    ![".html", ".htm", ".json"].includes(extname(path)) &&
    /-[A-Za-z0-9_-]{8,}\.[^.]+$/.test(basename(path))
  );
}
function atomicWrite(path: string, bytes: Uint8Array | string): void {
  safeDirectory(dirname(path), true);
  if (
    existsSync(path) &&
    (lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile())
  )
    throw new Error(`Unsafe replacement target: ${path}`);
  const temp = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  const descriptor = openSync(temp, "wx");
  try {
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  renameSync(temp, path);
}
function verifiedPayload(proof: DistributionProof, releases: string): string {
  const manifest = `${JSON.stringify({ metadata: proof.metadata, files: proof.files, manifestHash: proof.manifestHash }, null, 2)}\n`;
  const release = join(
    releases,
    `${proof.metadata.commit.slice(0, 12)}-${proof.manifestHash.slice(0, 20)}`,
  );
  const payload = join(release, "dist");
  if (existsSync(release)) {
    safeDirectory(payload, false);
    const manifestPath = join(release, "manifest.json");
    assertFileBytes(manifestPath, {
      path: "manifest.json",
      bytes: Buffer.byteLength(manifest),
      sha256: sha256(manifest),
    });
    if (
      JSON.stringify(walk(payload)) !==
      JSON.stringify(proof.files.map((file) => file.path))
    )
      throw new Error("Existing immutable release has a different file set");
    for (const file of proof.files)
      assertFileBytes(join(payload, file.path), file);
    return release;
  }
  const staging = join(releases, `.staging-${randomUUID()}`);
  safeDirectory(join(staging, "dist"), true);
  for (const file of proof.files) {
    const destination = join(staging, "dist", file.path);
    safeDirectory(dirname(destination), true);
    writeFileSync(destination, readFileSync(join(proof.root, file.path)), {
      flag: "wx",
    });
    assertFileBytes(destination, file);
  }
  writeFileSync(join(staging, "manifest.json"), manifest, { flag: "wx" });
  renameSync(staging, release);
  return release;
}
export function publishDistribution(
  options: PublishOptions,
  hooks: PublishHooks = {},
): { receipt: string; release: string } {
  const proof = validateDistribution(options.dist, options.expectedSha);
  const mount = resolve(options.mount),
    releases = resolve(options.releases);
  if (
    inside(proof.root, mount) ||
    inside(mount, proof.root) ||
    inside(releases, mount) ||
    inside(mount, releases) ||
    inside(proof.root, releases) ||
    inside(releases, proof.root)
  )
    throw new Error(
      "Distribution, release store and mount must be separate directories",
    );
  // Validate every collision before copying any files into the live mount.
  if (existsSync(mount)) safeDirectory(mount, false);
  for (const file of proof.files) {
    const destination = join(mount, file.path);
    if (existsSync(dirname(destination)))
      safeDirectory(dirname(destination), false);
    if (existsSync(destination)) {
      if (
        lstatSync(destination).isSymbolicLink() ||
        !lstatSync(destination).isFile()
      )
        throw new Error(`Unsafe existing asset: ${file.path}`);
      if (immutable(file.path)) assertFileBytes(destination, file);
    }
  }
  safeDirectory(releases, true);
  const lockPath = join(releases, ".publish.lock");
  const lock = openSync(lockPath, "wx");
  const owner = `${process.pid}:${randomUUID()}`;
  writeFileSync(lock, owner);
  try {
    return promote(proof, mount, releases, hooks);
  } finally {
    closeSync(lock);
    if (readFileSync(lockPath, "utf8") === owner) unlinkSync(lockPath);
  }
}
function promote(
  proof: DistributionProof,
  mount: string,
  releases: string,
  hooks: PublishHooks,
): { receipt: string; release: string } {
  const release = verifiedPayload(proof, releases);
  const id = randomUUID();
  const previous = join(releases, "rollback", id);
  const receiptPath = join(releases, "receipts", `${id}.json`);
  const receipt: PublicationReceipt = {
    id,
    expectedSha: proof.metadata.commit,
    buildId: proof.metadata.buildId,
    manifestHash: proof.manifestHash,
    files: proof.files,
    mount,
    release,
    previous,
    previousFiles: [],
    startedAt: new Date().toISOString(),
    status: "staged",
    entryPromoted: false,
    metadataPromoted: false,
  };
  const saveReceipt = (): void =>
    atomicWrite(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  for (const file of proof.files.filter((file) => !immutable(file.path))) {
    const source = join(mount, file.path);
    const existed = existsSync(source);
    receipt.previousFiles.push({ path: file.path, existed });
    if (existed) atomicWrite(join(previous, file.path), readFileSync(source));
  }
  saveReceipt();
  const changedMutable: string[] = [];
  try {
    receipt.status = "publishing-assets";
    saveReceipt();
    for (const file of proof.files) {
      if (file.path === "index.html" || file.path === "version.json") continue;
      const destination = join(mount, file.path);
      if (!existsSync(destination) || !immutable(file.path)) {
        atomicWrite(
          destination,
          readFileSync(join(release, "dist", file.path)),
        );
        if (!immutable(file.path)) changedMutable.push(file.path);
      }
      assertFileBytes(destination, file);
      hooks.afterAsset?.(file.path);
    }
    hooks.beforeEntry?.();
    atomicWrite(
      join(mount, "index.html"),
      readFileSync(join(release, "dist/index.html")),
    );
    receipt.entryPromoted = true;
    receipt.status = "entry-promoted";
    saveReceipt();
    hooks.afterEntry?.();
    atomicWrite(
      join(mount, "version.json"),
      readFileSync(join(release, "dist/version.json")),
    );
    receipt.metadataPromoted = true;
    receipt.status = "published";
    saveReceipt();
    return { receipt: receiptPath, release };
  } catch (error) {
    receipt.status = receipt.entryPromoted
      ? "interrupted-after-entry"
      : "failed-before-entry";
    receipt.failure = error instanceof Error ? error.message : String(error);
    if (!receipt.entryPromoted) {
      for (const path of changedMutable) {
        if (receipt.previousFiles.find((file) => file.path === path)?.existed)
          atomicWrite(join(mount, path), readFileSync(join(previous, path)));
      }
    }
    saveReceipt();
    throw error;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const value = (name: string): string | undefined => {
    const index = process.argv.indexOf(name);
    return index < 0 ? undefined : process.argv[index + 1];
  };
  const dist = value("--dist"),
    expectedSha = value("--expected-sha");
  if (!dist || !expectedSha)
    throw new Error(
      "Required: --dist <verified client dist> --expected-sha <full Git SHA>",
    );
  if (process.platform !== "win32")
    throw new Error(
      "The operator command targets the configured Windows COLDFRONT mount; fixture APIs remain portable",
    );
  console.log(
    JSON.stringify(
      publishDistribution({
        dist,
        expectedSha,
        mount: DEPLOYMENT.mount,
        releases: DEPLOYMENT.releases,
      }),
      null,
      2,
    ),
  );
}
