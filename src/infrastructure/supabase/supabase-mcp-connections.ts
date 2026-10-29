import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AlreadyDecided,
  Connection,
  ConsentError,
  ConsentRequest,
  McpConnections,
} from "@/application/ports/mcp-connections";
import { err, ok, type Result } from "@/domain/result";
import type { Database } from "@/infrastructure/supabase/database.types";

type Client = SupabaseClient<Database>;

/**
 * Conexiones de IA con el cliente de la sesión del panel: `auth.oauth` habla con
 * el servidor OAuth de Supabase y `mcp_save_grant` solo acepta la sesión propia
 * (sin `client_id`).
 */
export class SupabaseMcpConnections implements McpConnections {
  constructor(private readonly client: Client) {}

  async consentRequest(
    authorizationId: string,
  ): Promise<Result<ConsentRequest | AlreadyDecided, ConsentError>> {
    const { data, error } = await this.client.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error) return err(error.status === 403 ? "forbidden" : "not_found");
    if (!("authorization_id" in data)) return ok({ redirectUrl: data.redirect_url });
    return ok({
      authorizationId: data.authorization_id,
      clientId: data.client.id,
      clientName: data.client.name,
      redirectUri: data.redirect_uri,
    });
  }

  async saveGrant(request: ConsentRequest, canWrite: boolean): Promise<Result<void, ConsentError>> {
    const { error } = await this.client.rpc("mcp_save_grant", {
      p_client_id: request.clientId,
      // Lo que se guarda tiene que pasar los checks de la tabla.
      p_client_name: request.clientName.trim().slice(0, 100) || "App sin nombre",
      p_redirect_host: new URL(request.redirectUri).host,
      p_can_write: canWrite,
    });
    if (!error) return ok(undefined);
    if (error.code === "42501") return err("forbidden");
    throw new Error(`mcp: no se pudo guardar la conexión (${error.code}): ${error.message}`);
  }

  async decide(authorizationId: string, approve: boolean): Promise<Result<string, ConsentError>> {
    const options = { skipBrowserRedirect: true };
    const { data, error } = approve
      ? await this.client.auth.oauth.approveAuthorization(authorizationId, options)
      : await this.client.auth.oauth.denyAuthorization(authorizationId, options);
    if (error) return err("not_found");
    return ok(data.redirect_url);
  }

  async list(): Promise<readonly Connection[]> {
    const { data, error } = await this.client
      .from("mcp_grants")
      .select("client_id, client_name, redirect_host, can_write, created_at, last_used_at")
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`mcp: no se pudieron leer las conexiones (${error.code})`);
    return data.map((row) => ({
      clientId: row.client_id,
      clientName: row.client_name,
      redirectHost: row.redirect_host,
      canWrite: row.can_write,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    }));
  }

  async setPermission(clientId: string, canWrite: boolean): Promise<Result<void, ConsentError>> {
    // La RLS deja cambiar solo las propias y activas, y solo desde el panel.
    const { data, error } = await this.client
      .from("mcp_grants")
      .update({ can_write: canWrite })
      .eq("client_id", clientId)
      .select("client_id");
    if (error) return err(error.code === "42501" ? "forbidden" : "not_found");
    return data.length > 0 ? ok(undefined) : err("not_found");
  }

  async revoke(clientId: string): Promise<Result<void, ConsentError>> {
    // Primero el grant: desde ese momento `/mcp` rechaza el token. Después
    // Supabase invalida los refresh tokens; si ya no lo tenía, no importa.
    const { error } = await this.client.rpc("mcp_revoke_grant", { p_client_id: clientId });
    if (error) return err(error.code === "42501" ? "forbidden" : "not_found");
    const revoked = await this.client.auth.oauth.revokeGrant({ clientId });
    if (revoked.error) {
      console.warn("mcp: Supabase no revocó el grant OAuth", revoked.error.message);
    }
    return ok(undefined);
  }
}
