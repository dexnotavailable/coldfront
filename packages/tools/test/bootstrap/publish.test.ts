import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_PUBLIC_FILE_BYTES,
  type PublicationReceipt,
  publishDistribution,
  validateDistribution,
} from "../../src/build/publish.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    const within = relative(tmpdir(), root);
    if (
      isAbsolute(within) ||
      within.startsWith("..") ||
      !within.startsWith("coldfront-publisher-")
    )
      throw new Error("Unsafe fixture cleanup path");
    rmSync(root, { recursive: true, force: true });
  }
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "coldfront-publisher-"));
  roots.push(root);
  const mount = join(root, "WebGL"),
    releases = join(root, "releases");
  const write = (path: string, contents: string): void => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  };
  const dist = (
    revision: number,
  ): { dist: string; expectedSha: string; mount: string; releases: string } => {
    const path = join(root, `dist-${revision}`),
      sha = String(revision).repeat(40);
    write(
      join(path, "index.html"),
      `<!doctype html><html lang="en"><script type="module" src="/coldfront/assets/game-${String(revision).repeat(8)}.js"></script></html>`,
    );
    write(
      join(path, `assets/game-${String(revision).repeat(8)}.js`),
      `export const revision = ${revision};`,
    );
    write(
      join(path, "licenses/index.html"),
      `<html lang="en"><body>Licence ${revision}</body></html>`,
    );
    write(
      join(path, "version.json"),
      JSON.stringify({
        version: "0.1.0",
        basePath: "/coldfront/",
        commit: sha,
        cacheTag: "a".repeat(64),
        buildId: `${sha}-${String(revision).repeat(64)}`,
      }),
    );
    return { dist: path, expectedSha: sha, mount, releases };
  };
  return { root, mount, releases, write, dist };
}
const text = (path: string): string => readFileSync(path, "utf8");

describe("bounded distribution publisher (temporary roots only)", () => {
  it("publishes a first release with immutable payload and a checksum receipt", () => {
    const files = fixture(),
      options = files.dist(1);
    const result = publishDistribution(options);
    const receipt = JSON.parse(text(result.receipt)) as PublicationReceipt;
    expect(receipt.status).toBe("published");
    expect(receipt.entryPromoted && receipt.metadataPromoted).toBe(true);
    expect(receipt.manifestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(text(join(files.mount, "index.html"))).toBe(
      text(join(options.dist, "index.html")),
    );
    expect(text(join(result.release, "dist/version.json"))).toBe(
      text(join(options.dist, "version.json")),
    );
    expect(existsSync(join(files.releases, ".publish.lock"))).toBe(false);
  });
  it("updates the entry while keeping old hashed assets and previous entry/metadata snapshots", () => {
    const files = fixture(),
      first = files.dist(1);
    publishDistribution(first);
    const oldEntry = text(join(files.mount, "index.html")),
      oldVersion = text(join(files.mount, "version.json"));
    const result = publishDistribution(files.dist(2));
    const receipt = JSON.parse(text(result.receipt)) as PublicationReceipt;
    expect(existsSync(join(files.mount, "assets/game-11111111.js"))).toBe(true);
    expect(existsSync(join(files.mount, "assets/game-22222222.js"))).toBe(true);
    expect(text(join(receipt.previous, "index.html"))).toBe(oldEntry);
    expect(text(join(receipt.previous, "version.json"))).toBe(oldVersion);
    expect(text(join(files.mount, "version.json"))).toContain('"commit":"2222');
  });
  it.each([
    "wrong-sha",
    "wrong-base",
    "missing-asset",
    "hidden",
    "credential",
    "oversize",
    "symlink",
  ])("rejects %s without changing the prior entry", (reason) => {
    const files = fixture();
    publishDistribution(files.dist(1));
    const oldEntry = text(join(files.mount, "index.html")),
      oldVersion = text(join(files.mount, "version.json"));
    const next = files.dist(2);
    if (reason === "wrong-sha") next.expectedSha = "f".repeat(40);
    if (reason === "wrong-base") {
      const metadata = JSON.parse(text(join(next.dist, "version.json"))) as {
        basePath: string;
      };
      metadata.basePath = "/";
      files.write(join(next.dist, "version.json"), JSON.stringify(metadata));
    }
    if (reason === "missing-asset")
      files.write(
        join(next.dist, "index.html"),
        '<script src="/coldfront/assets/missing-11111111.js"></script>',
      );
    if (reason === "hidden") files.write(join(next.dist, ".env"), "fixture");
    if (reason === "credential")
      files.write(join(next.dist, "credential.json"), "fixture");
    if (reason === "oversize") {
      const path = join(next.dist, "large.bin");
      files.write(path, "");
      truncateSync(path, MAX_PUBLIC_FILE_BYTES + 1);
    }
    if (reason === "symlink")
      symlinkSync(
        join(next.dist, "assets"),
        join(next.dist, "linked-assets"),
        "junction",
      );
    expect(() => publishDistribution(next)).toThrow();
    expect(text(join(files.mount, "index.html"))).toBe(oldEntry);
    expect(text(join(files.mount, "version.json"))).toBe(oldVersion);
  });
  it("detects missing static JS/CSS dependencies", () => {
    const files = fixture(),
      options = files.dist(1);
    files.write(
      join(options.dist, "assets/game-11111111.js"),
      'import("./missing.js");',
    );
    expect(() =>
      validateDistribution(options.dist, options.expectedSha),
    ).toThrow("Missing referenced asset");
    files.write(
      join(options.dist, "assets/game-11111111.js"),
      "export const ok = true;",
    );
    files.write(
      join(options.dist, "assets/style-11111111.css"),
      '@font-face { src: url("./missing.woff2"); }',
    );
    expect(() =>
      validateDistribution(options.dist, options.expectedSha),
    ).toThrow("Missing referenced asset");
  });
  it("rejects changed bytes at an immutable filename before entry promotion", () => {
    const files = fixture(),
      first = files.dist(1);
    publishDistribution(first);
    const entry = text(join(files.mount, "index.html"));
    files.write(
      join(first.dist, "assets/game-11111111.js"),
      "changed bytes under old hash",
    );
    expect(() => publishDistribution(first)).toThrow(
      "Immutable file bytes differ",
    );
    expect(text(join(files.mount, "index.html"))).toBe(entry);
  });
  it("an interrupted asset stage never exposes the next entry or metadata", () => {
    const files = fixture();
    publishDistribution(files.dist(1));
    const entry = text(join(files.mount, "index.html")),
      version = text(join(files.mount, "version.json"));
    const licences = text(join(files.mount, "licenses/index.html"));
    expect(() =>
      publishDistribution(files.dist(2), {
        afterAsset: (path) => {
          expect(text(join(files.mount, "version.json"))).toBe(version);
          if (path === "licenses/index.html")
            throw new Error("fixture interruption");
        },
      }),
    ).toThrow("fixture interruption");
    expect(text(join(files.mount, "index.html"))).toBe(entry);
    expect(text(join(files.mount, "version.json"))).toBe(version);
    expect(text(join(files.mount, "licenses/index.html"))).toBe(licences);
    const receipts = readdirSync(join(files.releases, "receipts")).map(
      (name) =>
        JSON.parse(
          text(join(files.releases, "receipts", name)),
        ) as PublicationReceipt,
    );
    expect(
      receipts.some(
        (receipt) =>
          receipt.status === "failed-before-entry" && !receipt.entryPromoted,
      ),
    ).toBe(true);
  });
  it("does not delete another publisher's lock or change the current entry", () => {
    const files = fixture();
    publishDistribution(files.dist(1));
    const entry = text(join(files.mount, "index.html"));
    files.write(join(files.releases, ".publish.lock"), "another operator");
    expect(() => publishDistribution(files.dist(2))).toThrow();
    expect(text(join(files.releases, ".publish.lock"))).toBe(
      "another operator",
    );
    expect(text(join(files.mount, "index.html"))).toBe(entry);
  });
  it("holds version until entry promotion, recording recoverable interruption between them", () => {
    const files = fixture();
    publishDistribution(files.dist(1));
    const version = text(join(files.mount, "version.json"));
    const next = files.dist(2);
    expect(() =>
      publishDistribution(next, {
        afterEntry: () => {
          throw new Error("metadata pending");
        },
      }),
    ).toThrow("metadata pending");
    expect(text(join(files.mount, "index.html"))).toBe(
      text(join(next.dist, "index.html")),
    );
    expect(text(join(files.mount, "version.json"))).toBe(version);
    const receipts = readdirSync(join(files.releases, "receipts")).map(
      (name) =>
        JSON.parse(
          text(join(files.releases, "receipts", name)),
        ) as PublicationReceipt,
    );
    expect(
      receipts.some(
        (receipt) =>
          receipt.status === "interrupted-after-entry" &&
          receipt.entryPromoted &&
          !receipt.metadataPromoted,
      ),
    ).toBe(true);
    publishDistribution(next);
    expect(text(join(files.mount, "version.json"))).toBe(
      text(join(next.dist, "version.json")),
    );
  });
});
