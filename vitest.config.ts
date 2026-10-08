import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  test: {
    include: [
      "packages/shared/test/**/*.test.ts",
      "packages/tools/test/**/*.test.ts",
    ],
    environment: "node",
    maxWorkers: 1,
    testTimeout: 120_000,
  },
});
