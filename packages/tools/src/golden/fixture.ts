import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { contentHash, sourceFiles } from "../build/metadata.js";
import {
  currentGoldenContract,
  type GoldenCase,
  type GoldenFixture,
  goldenCases,
} from "./core.js";

export const REPO_ROOT = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
export const GOLDEN_PATH = fileURLToPath(
  new URL("../../../shared/test/golden/worldgen.json", import.meta.url),
);

/** Output provenance only: source-only edits do not force a baseline rewrite when bytes are unchanged. */
export function goldenSourceProvenance(): GoldenFixture["provenance"] {
  const sourceHash = contentHash(
    REPO_ROOT,
    sourceFiles(
      fileURLToPath(new URL("../../../shared/src/", import.meta.url)),
    ),
  );
  return {
    sourceHash,
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).trim(),
    nodeVersion: process.version,
  };
}
export function validateFixture(
  value: unknown,
  cases: readonly GoldenCase[] = goldenCases(),
): GoldenFixture {
  if (!value || typeof value !== "object")
    throw new Error("Golden fixture is not an object");
  const fixture = value as GoldenFixture;
  for (const [key, expected] of Object.entries(currentGoldenContract()))
    if ((fixture as unknown as Record<string, unknown>)[key] !== expected)
      throw new Error(
        `Golden ${key} differs; review generation/version changes and run golden:update`,
      );
  if (
    !Array.isArray(fixture.records) ||
    fixture.records.length !== cases.length
  )
    throw new Error(`Golden fixture must contain all ${cases.length} cases`);
  for (let i = 0; i < cases.length; i++) {
    const row = fixture.records[i];
    if (!row || JSON.stringify(row.sample) !== JSON.stringify(cases[i]))
      throw new Error(
        `Golden sample set differs at ${i}; review the dataset before updating`,
      );
    for (const field of ["blocks", "haloBlocks", "density", "columns"] as const)
      if (
        typeof row.hashes?.[field] !== "string" ||
        !/^[a-f0-9]{64}$/.test(row.hashes[field])
      )
        throw new Error(`Invalid SHA-256: ${row.sample.id}.${field}`);
  }
  if (
    !fixture.provenance ||
    !/^[a-f0-9]{64}$/.test(fixture.provenance.sourceHash) ||
    !/^[a-f0-9]{40,64}$/.test(fixture.provenance.sourceCommit) ||
    typeof fixture.provenance.nodeVersion !== "string"
  )
    throw new Error("Golden source provenance is missing");
  return fixture;
}
export async function readGoldenFixture(
  path = GOLDEN_PATH,
  cases: readonly GoldenCase[] = goldenCases(),
): Promise<GoldenFixture> {
  return validateFixture(
    JSON.parse(await readFile(path, "utf8")) as unknown,
    cases,
  );
}
export async function writeGoldenFixture(
  fixture: GoldenFixture,
  path = GOLDEN_PATH,
  cases: readonly GoldenCase[] = goldenCases(),
): Promise<void> {
  validateFixture(fixture, cases);
  await writeFile(path, `${JSON.stringify(fixture, null, 2)}\n`);
}
