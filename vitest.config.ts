import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // интеграционные тесты работают с одной тестовой БД — без параллелизма между файлами
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
