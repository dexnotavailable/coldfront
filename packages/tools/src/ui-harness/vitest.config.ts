import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["packages/tools/test/ui/**/*.test.ts"],
    maxWorkers: 1,
    environment: "node",
  },
});
