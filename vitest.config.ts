import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  test: {
    globals: true,
    environment: "node",
    include: ["src/tests/**/*.test.ts"],

    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/modules/**/*.ts", "src/shared/**/*.ts"],
      exclude: ["src/modules/**/*.types.ts", "src/modules/**/*.routes.ts"],
    },

    // Unit tests run in parallel; integration tests are sequential
    pool: "forks",
    poolOptions: {
      forks: { singleFork: false },
    },
  },
});