// Genera `.dev.vars` (ignorado por git) con los datos de Supabase local, para
// `pnpm dev`, `pnpm preview` y los E2E. Requiere `pnpm db:start`.
//
//   pnpm env:local
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const cli = join(process.cwd(), "node_modules", "supabase", "dist", "supabase.js");
const status = JSON.parse(
  execFileSync(process.execPath, [cli, "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }),
) as Record<string, string | undefined>;

const { API_URL, PUBLISHABLE_KEY, SECRET_KEY } = status;
if (!API_URL || !PUBLISHABLE_KEY || !SECRET_KEY) {
  console.error("Supabase local no está levantado: corré `pnpm db:start`.");
  process.exit(1);
}

const vars = {
  SUPABASE_URL: API_URL,
  SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
  // Clave de servicio de Supabase LOCAL (solo la usa `ingest-client.ts`).
  SUPABASE_SECRET_KEY: SECRET_KEY,
  // Claves de prueba públicas de Turnstile: siempre aprueban. Las reales van
  // como secreto del Worker en producción.
  // https://developers.cloudflare.com/turnstile/troubleshooting/testing/
  TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
};
writeFileSync(
  ".dev.vars",
  `${Object.entries(vars)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")}\n`,
  { mode: 0o600 },
);
console.warn("`.dev.vars` generado con Supabase local.");
