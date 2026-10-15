import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Tests contra Supabase local (`pnpm db:start`). Van aparte de `pnpm test`
// porque necesitan Docker; en la CI corren en el job de base de datos.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    environment: "node",
    testTimeout: 20_000,
  },
});
