import { createClient } from "@supabase/supabase-js";

import type { McpCaller, McpTokenVerifier } from "@/application/ports/mcp-auth";
import type { Database } from "@/infrastructure/supabase/database.types";
import type { SupabaseConfig } from "@/infrastructure/supabase/server-client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JWT = /^[\w-]+\.[\w-]+\.[\w-]+$/;
/** Un access token de Supabase ronda 1 KB; algo mucho más grande no es uno. */
const MAX_TOKEN_LENGTH = 8192;

/** Lo que el verificador necesita de Supabase, separado para probarlo sin red. */
export interface TokenChecks {
  /** Verifica firma (JWKS) y vencimiento; devuelve los claims o `null`. */
  claims(accessToken: string): Promise<Record<string, unknown> | null>;
  /** `mcp_authorize` con el token: si el grant está activo, si puede escribir; si no, `null`. */
  grant(accessToken: string): Promise<boolean | null>;
}

/**
 * Verificador de los tokens de `/mcp` (SPEC-mcp-server): firma con el JWKS del
 * proyecto, `iss` del proyecto, `aud = authenticated`, `exp` vigente, claim
 * `client_id` (los tokens de sesión del panel no sirven) y un grant activo.
 */
export class SupabaseMcpTokenVerifier implements McpTokenVerifier {
  private readonly issuer: string;

  constructor(
    config: SupabaseConfig,
    private readonly checks: TokenChecks = supabaseTokenChecks(config),
    private readonly now: () => number = Date.now,
  ) {
    this.issuer = `${config.url.replace(/\/$/, "")}/auth/v1`;
  }

  async verify(accessToken: string): Promise<McpCaller | null> {
    if (accessToken.length > MAX_TOKEN_LENGTH || !JWT.test(accessToken)) return null;
    try {
      const claims = await this.checks.claims(accessToken);
      if (!claims) return null;
      const { sub, iss, aud, exp, client_id: clientId } = claims;
      if (typeof sub !== "string" || !UUID.test(sub)) return null;
      if (iss !== this.issuer) return null;
      const audiences = Array.isArray(aud) ? aud : [aud];
      if (!audiences.includes("authenticated")) return null;
      if (typeof exp !== "number" || exp * 1000 <= this.now()) return null;
      if (typeof clientId !== "string" || !UUID.test(clientId)) return null;

      const canWrite = await this.checks.grant(accessToken);
      if (canWrite === null) return null;
      return { userId: sub, clientId, canWrite, accessToken };
    } catch (cause) {
      console.error("mcp: no se pudo verificar el token", cause);
      return null;
    }
  }
}

function supabaseTokenChecks(config: SupabaseConfig): TokenChecks {
  const clientFor = (accessToken: string) =>
    createClient<Database>(config.url, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
  return {
    async claims(accessToken) {
      const { data, error } = await clientFor(accessToken).auth.getClaims(accessToken);
      return error || !data ? null : data.claims;
    },
    async grant(accessToken) {
      const { data, error } = await clientFor(accessToken).rpc("mcp_authorize", {});
      return error || typeof data !== "boolean" ? null : data;
    },
  };
}
