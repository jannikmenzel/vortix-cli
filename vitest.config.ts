import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@core": path.resolve(import.meta.dirname, "src/core"),
      "@checks": path.resolve(import.meta.dirname, "src/checks"),
      "@adapters": path.resolve(import.meta.dirname, "src/adapters"),
      "@commands": path.resolve(import.meta.dirname, "src/commands"),
      "@dynamic": path.resolve(import.meta.dirname, "src/dynamic"),
      "@utils": path.resolve(import.meta.dirname, "src/utils"),
    },
  },
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
