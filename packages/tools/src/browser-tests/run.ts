import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createServer,
  type PreviewServer,
  preview,
  type ViteDevServer,
} from "vite";

const mode = process.argv[2] ?? "browser";
if (
  mode !== "browser" &&
  mode !== "postcards" &&
  mode !== "phase12" &&
  mode !== "phase13"
)
  throw new Error("Expected browser, phase12, phase13 or postcards");
const urlIndex = process.argv.indexOf("--url");
const existing = process.env.CF_URL;
let server: ViteDevServer | PreviewServer | null = null;
let resolveOnly = false;
if (mode === "postcards") {
  const prepared = await (
    await import("../postcards/prepare.js")
  ).preparePostcards();
  resolveOnly = process.argv.includes("--resolve-only");
  if (resolveOnly)
    console.log(
      JSON.stringify({
        manifest: prepared.path,
        resolutionReceipt: prepared.receipt,
        ids: prepared.ids,
      }),
    );
}
try {
  if (!resolveOnly) {
    if (urlIndex >= 0) process.env.CF_URL = process.argv[urlIndex + 1];
    if (!process.env.CF_URL) {
      if (process.argv.includes("--preview")) {
        const metadata = JSON.parse(
          await readFile(resolve("packages/client/dist/version.json"), "utf8"),
        ) as { basePath?: unknown };
        if (
          typeof metadata.basePath !== "string" ||
          !metadata.basePath.startsWith("/")
        )
          throw new Error(
            "Built version.json is missing basePath; rebuild before preview tests",
          );
        server = await preview({
          root: resolve("packages/client"),
          base: metadata.basePath,
          preview: { host: "127.0.0.1", port: 0, strictPort: false },
        });
      } else {
        server = await createServer({
          root: resolve("packages/client"),
          server: { host: "127.0.0.1", port: 0, strictPort: false },
        });
        await server.listen();
      }
      const url = server.resolvedUrls?.local[0];
      if (!url) throw new Error("Vite did not expose a local URL");
      process.env.CF_URL = url;
    }
    if (mode === "postcards") await import("../postcards/capture.js");
    else if (mode === "phase12") await import("./phase12.js");
    else if (mode === "phase13") await import("./phase13.js");
    else {
      await import("./smoke.js");
      await import("./drive.js");
    }
  }
} finally {
  await server?.close();
  if (existing === undefined) delete process.env.CF_URL;
  else process.env.CF_URL = existing;
}
