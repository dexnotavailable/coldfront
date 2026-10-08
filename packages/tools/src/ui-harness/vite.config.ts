import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)),
  publicDir: fileURLToPath(new URL("../../../client/public", import.meta.url)),
  resolve: { dedupe: ["preact", "@preact/signals"] },
  server: {
    host: "127.0.0.1",
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    fs: { allow: [fileURLToPath(new URL("../../../../", import.meta.url))] },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  build: {
    outDir: fileURLToPath(
      new URL("../../../../out/ui-harness-dist", import.meta.url),
    ),
    emptyOutDir: true,
  },
});
