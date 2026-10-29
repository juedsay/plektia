import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, inject, it } from "vitest";

import type { Database } from "@/infrastructure/supabase/database.types";
import { SupabaseMcpTokenVerifier } from "@/infrastructure/mcp/token-verifier";

import { connect, sessionFor } from "./oauth-connection";

const supabase = inject("supabase");

// Flujo OAuth completo de un cliente MCP contra Supabase local (tarea 30,
// SPEC-mcp-server): registro dinámico → autorización con PKCE → consentimiento
// del dueño (lo que hará `/oauth/consent`) → token → verificador de `/mcp`.
describe("OAuth de los clientes MCP", () => {
  const verifier = new SupabaseMcpTokenVerifier({
    url: supabase.url,
    publishableKey: supabase.publishableKey,
  });
  let owner: SupabaseClient<Database>;

  beforeAll(async () => {
    owner = await sessionFor("member@plektia.test");
  });

  it("registro → consentimiento → token: el verificador lo acepta con el permiso elegido", async () => {
    const { clientId, accessToken } = await connect(owner, false);
    const caller = await verifier.verify(accessToken);
    expect(caller).toMatchObject({ clientId, canWrite: false });

    // Con ese token, la base deja leer pero no escribir directo.
    const asClient = createClient<Database>(supabase.url, supabase.publishableKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const pages = await asClient.from("pages").select("id").limit(1);
    expect(pages.error).toBeNull();
    const direct = await asClient
      .from("pages")
      .update({ bio: "por la puerta de atrás" })
      .eq("owner_id", caller?.userId ?? "")
      .select("id");
    expect(direct.data).toEqual([]);
  });

  it("un token alterado o la sesión del panel no sirven", async () => {
    const { accessToken } = await connect(owner, true);
    const [header = "", payload = "", signature = ""] = accessToken.split(".");
    const flipped = `${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;
    expect(await verifier.verify(`${header}.${payload}.${flipped}`)).toBeNull();

    const panel = await owner.auth.getSession();
    expect(await verifier.verify(panel.data.session?.access_token ?? "")).toBeNull();
  });

  it("revocar desde el panel corta el acceso en la siguiente verificación", async () => {
    const { clientId, accessToken } = await connect(owner, true);
    expect(await verifier.verify(accessToken)).toMatchObject({ canWrite: true });

    const revoked = await owner.rpc("mcp_revoke_grant", { p_client_id: clientId });
    expect(revoked.data).toBe(true);
    const supabaseRevoked = await owner.auth.oauth.revokeGrant({ clientId });
    expect(supabaseRevoked.error).toBeNull();

    expect(await verifier.verify(accessToken)).toBeNull();
  });
});
