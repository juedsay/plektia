import type { SessionUser } from "@/application/ports/session-reader";

declare global {
  namespace App {
    interface Locals {
      /** Usuario con sesión verificada; `null` fuera de las rutas que leen la sesión. */
      user: SessionUser | null;
    }
  }
}

export {};
