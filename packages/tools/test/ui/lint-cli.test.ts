import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("runs the real UI lint CLI through a junction with the same output and validation status", () => {
  const root = realpathSync(
    fileURLToPath(new URL("../../../../", import.meta.url)),
  );
  const output = resolve(root, "out");
  mkdirSync(output, { recursive: true });
  const temporary = mkdtempSync(resolve(output, "ui-lint-cli-"));
  const alias = resolve(temporary, "checkout");
  symlinkSync(root, alias, "junction");
  try {
    const cli = resolve(root, "node_modules/tsx/dist/cli.mjs");
    const run = (checkout: string) =>
      spawnSync(
        process.execPath,
        [
          cli,
          "--tsconfig",
          resolve(root, "packages/tools/tsconfig.json"),
          resolve(checkout, "packages/tools/src/ui-lint/index.ts"),
          "--complete",
        ],
        { cwd: root, encoding: "utf8", timeout: 20_000, windowsHide: true },
      );
    const physical = run(root),
      linked = run(alias);
    expect(physical.error).toBeUndefined();
    expect(linked.error).toBeUndefined();
    expect([0, 1]).toContain(physical.status);
    expect(physical.stdout).toMatch(
      /\d+ gallery states; \d+ current rows missing/,
    );
    expect(linked.stdout).toBe(physical.stdout);
    expect(linked.stderr).toBe(physical.stderr);
    expect(linked.status).toBe(physical.status);
  } finally {
    // Remove only this test's newly created alias, without recursive traversal.
    if (process.platform === "win32") rmdirSync(alias);
    else unlinkSync(alias);
    rmdirSync(temporary);
  }
});
