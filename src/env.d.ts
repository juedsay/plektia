import type { SessionUser } from "@/application/ports/session-reader";

declare global {
  namespace Cloudflare {
    interface Env {
      /** Secreto de Turnstile (`wrangler secret put`); en local, la clave de prueba. */
      TURNSTILE_SECRET_KEY: string;
    }
  }
  namespace App {
    interface Locals {
      /** Usuario con sesión verificada; `null` fuera de las rutas que leen la sesión. */
      user: SessionUser | null;
    }
  }
}

export {};
