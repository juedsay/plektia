import { execSync } from "node:child_process";

import type { TestProject } from "vitest/node";

// Las claves de Supabase local salen de la CLI, no del repo: así no hay
// credenciales (ni siquiera las de desarrollo) commiteadas.
export default function setup(project: TestProject) {
  const status = JSON.parse(
    execSync("pnpm exec supabase status -o json", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  ) as Record<string, string | undefined>;
  const { API_URL, PUBLISHABLE_KEY, SECRET_KEY } = status;
  if (!API_URL || !PUBLISHABLE_KEY || !SECRET_KEY) {
    throw new Error("Supabase local no está levantado: corré `pnpm db:start`.");
  }
  project.provide("supabase", {
    url: API_URL,
    publishableKey: PUBLISHABLE_KEY,
    secretKey: SECRET_KEY,
  });
}

declare module "vitest" {
  export interface ProvidedContext {
    supabase: { url: string; publishableKey: string; secretKey: string };
  }
}
