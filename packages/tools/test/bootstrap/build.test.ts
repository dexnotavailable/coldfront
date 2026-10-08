import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { validatePostcard } from "../../../client/src/bootstrap/postcard.js";
import { contentHash, sourceFingerprints } from "../../src/build/metadata.js";

function removeFixture(path: string): void {
  const inside = relative(tmpdir(), path);
  if (
    inside.startsWith("..") ||
    isAbsolute(inside) ||
    !inside.startsWith("coldfront-fingerprint-")
  )
    throw new Error("Refusing to remove an unexpected fixture path");
  rmSync(path, { recursive: true, force: true });
}

describe("build and postcard boundaries", () => {
  it("hashes source content and file names consistently across line endings", () => {
    const dir = mkdtempSync(join(tmpdir(), "coldfront-fingerprint-"));
    try {
      const source = join(dir, "registry.ts");
      writeFileSync(source, "one\r\ntwo\r\n");
      const first = contentHash(dir, [source]);
      writeFileSync(source, "one\ntwo\n");
      expect(contentHash(dir, [source])).toBe(first);
      writeFileSync(source, "one\nthree\n");
      expect(contentHash(dir, [source])).not.toBe(first);
      const renamed = join(dir, "worldgen.ts");
      writeFileSync(renamed, "one\ntwo\n");
      expect(contentHash(dir, [renamed])).not.toBe(first);
    } finally {
      removeFixture(dir);
    }
  });
  it("hashes binary assets losslessly instead of decoding invalid UTF8", () => {
    const root = mkdtempSync(join(tmpdir(), "coldfront-fingerprint-"));
    try {
      const path = join(root, "proof.jpg");
      writeFileSync(path, new Uint8Array([255]));
      const first = contentHash(root, [path]);
      writeFileSync(path, new Uint8Array([254]));
      expect(contentHash(root, [path])).not.toBe(first);
    } finally {
      removeFixture(root);
    }
  });
  it("preserves saved edits through meshing/light changes while tracking registry and worldgen changes", () => {
    const root = mkdtempSync(join(tmpdir(), "coldfront-fingerprint-"));
    const write = (path: string, contents: string): void => {
      const file = join(root, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, contents);
    };
    try {
      for (const path of [
        "packages/shared/src/blocks/registry.ts",
        "packages/shared/src/worldgen/terrain.ts",
        "packages/shared/src/worldplan/drainage.ts",
        "packages/shared/src/math/hash.ts",
        "packages/shared/src/noise/noise.ts",
        "packages/shared/src/world/constants.ts",
        "packages/shared/src/meshing/mesh.ts",
        "packages/shared/src/lighting/light.ts",
        "packages/client/src/main.tsx",
        "packages/client/public/_headers",
        "packages/tools/src/build/client.ts",
        "packages/tools/postcards/cameras/seed-1.json",
        "packages/client/index.html",
        "packages/client/vite.config.ts",
        "packages/client/package.json",
        "THIRD_PARTY_NOTICES.md",
        "package.json",
        "package-lock.json",
      ])
        write(path, "initial");
      const first = sourceFingerprints(root);
      write("packages/shared/src/meshing/mesh.ts", "mesh fix");
      const mesh = sourceFingerprints(root);
      expect(mesh.cacheTag).toBe(first.cacheTag);
      expect(mesh.releaseHash).not.toBe(first.releaseHash);
      write("packages/shared/src/lighting/light.ts", "lighting fix");
      const light = sourceFingerprints(root);
      expect(light.cacheTag).toBe(first.cacheTag);
      expect(light.releaseHash).not.toBe(mesh.releaseHash);
      write("packages/shared/src/blocks/registry.ts", "new registry");
      const registry = sourceFingerprints(root);
      expect(registry.cacheTag).not.toBe(first.cacheTag);
      write("packages/shared/src/worldgen/terrain.ts", "new terrain");
      expect(sourceFingerprints(root).cacheTag).not.toBe(registry.cacheTag);
      const terrain = sourceFingerprints(root);
      write(
        "packages/shared/src/worldplan/drainage.ts",
        "new immutable plan input",
      );
      expect(sourceFingerprints(root).cacheTag).not.toBe(terrain.cacheTag);
      expect(sourceFingerprints(root, "/coldfront/").cacheTag).toBe(
        sourceFingerprints(root).cacheTag,
      );
      expect(sourceFingerprints(root, "/coldfront/").releaseHash).not.toBe(
        sourceFingerprints(root).releaseHash,
      );
    } finally {
      removeFixture(root);
    }
  });
  it("rejects another seed, malformed cameras and invalid load radii", () => {
    const camera = {
      id: "TEST-1",
      seed: 1,
      position: { x: 3, y: 4, z: 5 },
      target: { x: 0, y: 0, z: 0 },
      hours: 17.25,
      radius: 160,
    };
    expect(validatePostcard(camera, 1)).toEqual(camera);
    expect(() => validatePostcard(camera, 2)).toThrow();
    expect(() =>
      validatePostcard({ ...camera, position: { x: Infinity, y: 0, z: 0 } }, 1),
    ).toThrow();
    expect(() => validatePostcard({ ...camera, radius: 1e10 }, 1)).toThrow();
  });
});
