import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { publicArtifacts } from "../tools/src/build/artifacts.js";
import {
  type BuildMetadata,
  buildMetadata,
} from "../tools/src/build/metadata.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const headers = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

function releaseArtifacts(metadata: BuildMetadata, base: string): Plugin {
  return {
    name: "coldfront-release-artifacts",
    generateBundle() {
      for (const artifact of publicArtifacts(root, metadata))
        this.emitFile({
          type: "asset",
          fileName: artifact.path,
          source: artifact.content,
        });
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        let route = url.pathname;
        if (route.startsWith(base)) route = route.slice(base.length);
        else route = route.replace(/^\//, "");
        if (route === "licenses/") route += "index.html";
        if (
          !(
            route === "version.json" ||
            route.startsWith("licenses/") ||
            route.startsWith("postcards/cameras/")
          )
        )
          return next();
        const artifact = publicArtifacts(root, metadata).find(
          (item) => item.path === route,
        );
        if (!artifact) {
          response.statusCode = 404;
          response.end();
          return;
        }
        response.setHeader("Content-Type", `${artifact.type}; charset=utf-8`);
        response.setHeader("Cache-Control", "no-store");
        response.end(artifact.content);
      });
    },
  };
}

export default defineConfig(({ isPreview }) => {
  const base: unknown = isPreview
    ? (
        JSON.parse(
          readFileSync(new URL("./dist/version.json", import.meta.url), "utf8"),
        ) as { basePath?: unknown }
      ).basePath
    : (process.env.COLDFRONT_BASE_PATH ?? "/");
  if (typeof base !== "string" || !/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base))
    throw new Error(
      "COLDFRONT_BASE_PATH must be an absolute local path with a trailing slash; preview requires valid built version.json",
    );
  const metadata = buildMetadata(root, base);
  return {
    root: fileURLToPath(new URL("./", import.meta.url)),
    base,
    plugins: [releaseArtifacts(metadata, base)],
    define: { __CF_BUILD__: JSON.stringify(metadata) },
    resolve: { dedupe: ["preact", "@preact/signals"] },
    oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
    server: { host: "127.0.0.1", headers, fs: { allow: [root] } },
    preview: { host: "127.0.0.1", headers },
    build: { outDir: "dist", emptyOutDir: true },
  };
});
