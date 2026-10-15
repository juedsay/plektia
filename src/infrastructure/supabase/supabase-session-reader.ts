import type { SupabaseClient } from "@supabase/supabase-js";

import type { SessionReader, SessionUser } from "@/application/ports/session-reader";

type ClaimsAuth = Pick<SupabaseClient["auth"], "getClaims">;

/**
 * Lee la sesión con `getClaims()`, que verifica la firma del JWT con las claves
 * públicas del proyecto (JWKS) y su vencimiento. Nunca `getSession()`: sus datos
 * salen de la cookie sin verificar.
 */
export class SupabaseSessionReader implements SessionReader {
  constructor(private readonly auth: ClaimsAuth) {}

  async getCurrentUser(): Promise<SessionUser | null> {
    try {
      const { data, error } = await this.auth.getClaims();
      if (error || !data) return null;
      const { sub, email } = data.claims;
      if (typeof sub !== "string" || sub.length === 0) return null;
      return { id: sub, email: typeof email === "string" ? email : null };
    } catch (cause) {
      // Ante cualquier falla inesperada (red, JWKS), sin sesión: falla cerrado.
      console.error("session: no se pudo verificar la sesión", cause);
      return null;
    }
  }
}
