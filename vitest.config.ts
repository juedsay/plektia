import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Los .tsx son tests de componentes: declaran `@vitest-environment jsdom`.
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    environment: "node",
    typecheck: {
      // Corre los `expectTypeOf` como chequeos reales de tipos.
      enabled: true,
      include: ["tests/**/*.test.{ts,tsx}"],
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // Las rutas y la configuración se cubren con E2E (Playwright).
      exclude: [
        "src/**/*.d.ts",
        "src/pages/**",
        "src/middleware/index.ts",
        "src/composition/runtime.ts",
        "src/worker.ts",
        // Montaje en el DOM: lo cubren los E2E (la lógica vive en módulos puros).
        "src/ui/scripts/page.ts",
        "src/ui/scripts/thread.ts",
        "src/ui/scripts/contact-form.ts",
      ],
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
