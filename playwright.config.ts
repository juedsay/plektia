import { randomBytes } from "node:crypto";

import { defineConfig, devices } from "@playwright/test";

const PORT = 4322;
const isCI = Boolean(process.env["CI"]);
// Con E2E_BASE_URL los tests corren contra un deploy (p. ej. después de publicar)
// en lugar de levantar el build local.
const remoteBaseURL = process.env["E2E_BASE_URL"];
// IP propia de cada corrida (rango de documentación 2001:db8::/32): el límite de
// login cuenta por IP y su estado local sobrevive a los reinicios del servidor.
// En Cloudflare esta cabecera la reescribe la red y no se puede falsificar.
const runIp = `2001:db8::${randomBytes(2).toString("hex")}:${randomBytes(2).toString("hex")}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: remoteBaseURL ?? `http://127.0.0.1:${String(PORT)}`,
    extraHTTPHeaders: { "cf-connecting-ip": runIp },
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /(rate-limit|csrf)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        // En local se usa Edge (firmado): el control de aplicaciones de Windows
        // bloquea el Chromium descargado por Playwright. La CI usa ese Chromium.
        ...(isCI ? {} : { channel: "msedge" }),
      },
    },
    {
      // Agota el límite de login de la IP: corre cuando el resto terminó.
      name: "rate-limit",
      testMatch: /rate-limit\.spec\.ts/,
      dependencies: ["chromium"],
      use: { ...devices["Desktop Chrome"], ...(isCI ? {} : { channel: "msedge" }) },
    },
    {
      // Último de todos: ver el comentario en csrf.spec.ts.
      name: "csrf",
      testMatch: /csrf\.spec\.ts/,
      dependencies: ["rate-limit"],
      use: { ...devices["Desktop Chrome"], ...(isCI ? {} : { channel: "msedge" }) },
    },
  ],
  // Los E2E corren contra el build de producción, no contra el servidor de desarrollo.
  ...(remoteBaseURL
    ? {}
    : {
        webServer: {
          command: `pnpm build && pnpm exec astro preview --host 127.0.0.1 --port ${String(PORT)}`,
          url: `http://127.0.0.1:${String(PORT)}`,
          // Siempre un servidor nuevo: tras el test de CSRF el simulador local
          // queda inestable (ver tests/e2e/csrf.spec.ts).
          reuseExistingServer: false,
          timeout: 180_000,
        },
      }),
});
