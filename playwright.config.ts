import { defineConfig, devices } from "@playwright/test";

const PORT = 4322;
const isCI = Boolean(process.env["CI"]);
// Con E2E_BASE_URL los tests corren contra un deploy (p. ej. después de publicar)
// en lugar de levantar el build local.
const remoteBaseURL = process.env["E2E_BASE_URL"];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: remoteBaseURL ?? `http://127.0.0.1:${String(PORT)}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // En local se usa Edge (firmado): el control de aplicaciones de Windows
        // bloquea el Chromium descargado por Playwright. La CI usa ese Chromium.
        ...(isCI ? {} : { channel: "msedge" }),
      },
    },
  ],
  // Los E2E corren contra el build de producción, no contra el servidor de desarrollo.
  ...(remoteBaseURL
    ? {}
    : {
        webServer: {
          command: `pnpm build && pnpm exec astro preview --host 127.0.0.1 --port ${String(PORT)}`,
          url: `http://127.0.0.1:${String(PORT)}`,
          reuseExistingServer: !isCI,
          timeout: 180_000,
        },
      }),
});
