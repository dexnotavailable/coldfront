import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const environment = { ...process.env };
if (process.argv.includes("--site"))
  environment.COLDFRONT_BASE_PATH = "/coldfront/";
// Invoke the installed CLIs with the same Node binary on Windows and Unix.
// Nested npm shells can inherit conflicting Path/PATH entries on Windows.
for (const command of [
  ["node_modules/typescript/bin/tsc", "-p", "packages/shared/tsconfig.json"],
  [
    "node_modules/vite/bin/vite.js",
    "build",
    "--config",
    "packages/client/vite.config.ts",
  ],
]) {
  const [executable, ...args] = command;
  if (!executable) throw new Error("Build command is missing");
  const result = spawnSync(
    process.execPath,
    [join(root, executable), ...args],
    {
      cwd: root,
      env: environment,
      stdio: "inherit",
      windowsHide: true,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
