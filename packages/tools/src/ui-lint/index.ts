import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "preact";
import { renderToString } from "preact-render-to-string";
import { galleryFixtures } from "../../../client/src/ui/gallery/registry";
import { worldEvidence } from "../../../client/src/ui/gallery/world-evidence";
import { catalogue, currentId } from "../../../client/src/ui/t";
import { checkFresh, root } from "../ui-strings/index";
import { inspectSsr, scanCss, scanTs } from "./checks";
import { checkWorldEvidence } from "./world-evidence";

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(resolve(dir, entry.name))
      : [resolve(dir, entry.name)],
  );
}
export function lintUi() {
  const errors = checkFresh();
  const covered = new Set<string>();
  const worldFixtureIds = new Set<string>();
  const fixtures: Record<string, string[]> = {};
  for (const file of files(resolve(root, "packages/client/src/ui"))) {
    if (file.endsWith(".gen.ts") || file.endsWith(".json")) continue;
    const source = readFileSync(file, "utf8");
    const findings = file.endsWith(".css")
      ? scanCss(file, source)
      : /\.tsx?$/.test(file)
        ? scanTs(file, source)
        : [];
    errors.push(
      ...findings.map(
        (item) => `${item.file}:${item.line} ${item.rule}: ${item.detail}`,
      ),
    );
  }
  for (const fixture of galleryFixtures) {
    const html = renderToString(createElement(fixture.render, {}));
    const inspected = inspectSsr(html);
    for (const match of html.matchAll(/data-world-evidence="([^"]+)"/g))
      worldFixtureIds.add(match[1]!);
    errors.push(...inspected.errors.map((error) => `${fixture.id}: ${error}`));
    fixtures[fixture.id] = inspected.ids;
    if (fixture.kind === "screen")
      for (const id of inspected.ids) covered.add(id);
  }
  const world = checkWorldEvidence(worldEvidence, root, worldFixtureIds);
  errors.push(...world.errors);
  for (const row of world.covered) covered.add(row);
  const missing = Object.entries(catalogue)
    .filter(
      ([id, row]) =>
        currentId(id) && row.kind !== "binding" && !covered.has(id),
    )
    .map(([id]) => id);
  return {
    errors,
    missing,
    fixtures,
    bindingRows: Object.entries(catalogue)
      .filter(([id, row]) => currentId(id) && row.kind === "binding")
      .map(([id]) => id),
    pendingEngineRows: ["hud.outline", "hud.silhouette", "hud.ghost"].filter(
      (id) => missing.includes(id),
    ),
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = lintUi();
  mkdirSync(resolve(root, "out/ui"), { recursive: true });
  writeFileSync(
    resolve(root, "out/ui/lint.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  for (const error of result.errors) console.error(error);
  console.log(
    `${Object.keys(result.fixtures).length} gallery states; ${result.missing.length} current rows missing; ${result.bindingRows.length} binding rows; binding registry validation runs in npm test`,
  );
  if (
    result.errors.length ||
    (process.argv.includes("--complete") && result.missing.length)
  )
    process.exitCode = 1;
}
