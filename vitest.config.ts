import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    typecheck: {
      // Corre los `expectTypeOf` como chequeos reales de tipos.
      enabled: true,
      include: ["tests/**/*.test.ts"],
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // Las rutas y la configuración se cubren con E2E (Playwright).
      exclude: ["src/**/*.d.ts", "src/pages/**", "src/middleware.ts", "src/worker.ts"],
      reporter: ["text", "html", "lcov"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        "src/domain/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
        "src/application/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
});
