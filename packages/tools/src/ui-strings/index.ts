import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export const root = resolve(
  fileURLToPath(new URL("../../../../", import.meta.url)),
);
export interface CatalogueRow {
  kind: "control" | "text" | "binding";
  type: string;
  label: string;
  tooltip: string;
  text: string;
  key: string;
  since: string;
}
export function extractCatalogue(): Record<string, CatalogueRow> {
  return JSON.parse(
    execFileSync(process.execPath, ["docs/tools/ui-catalogue.mjs", "--json"], {
      cwd: root,
      encoding: "utf8",
    }),
  ) as Record<string, CatalogueRow>;
}
export function generatedFiles(): Readonly<Record<string, string>> {
  const rows = extractCatalogue();
  return {
    "strings.gen.json": `${JSON.stringify(rows, null, 2)}\n`,
    "ids.gen.ts": `// Generated from docs/11-interface-catalogue.md. Do not edit.\nexport type CatalogueId =\n${Object.keys(
      rows,
    )
      .map((id) => `  | ${JSON.stringify(id)}`)
      .join("\n")};\n`,
  };
}
export function compareGenerated(
  name: string,
  expected: string,
  actual: string,
): string[] {
  return actual === expected ? [] : [`stale generated file: ${name}`];
}
export function checkFresh(): string[] {
  return Object.entries(generatedFiles()).flatMap(([name, data]) => {
    try {
      return compareGenerated(
        name,
        data,
        readFileSync(resolve(root, "packages/client/src/ui", name), "utf8"),
      );
    } catch {
      return [`missing generated file: ${name}`];
    }
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  mkdirSync(resolve(root, "packages/client/src/ui"), { recursive: true });
  for (const [name, data] of Object.entries(generatedFiles()))
    writeFileSync(resolve(root, "packages/client/src/ui", name), data);
  console.log("Generated catalogue strings and ID types");
}
