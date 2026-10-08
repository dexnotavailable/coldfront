import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/shared/test/**/*.test.ts"],
    environment: "node",
    maxWorkers: 1,
    testTimeout: 120_000,
  },
});
