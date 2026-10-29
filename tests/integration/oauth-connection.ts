import { createHash, randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, inject } from "vitest";

import type { Database } from "@/infrastructure/supabase/database.types";

// Conectar un cliente MCP de prueba contra Supabase local, como lo haría
// Claude: registro dinámico → autorización con PKCE → consentimiento del
// dueño (lo que hace `/oauth/consent`) → token.
const supabase = inject("supabase");
const AUTH = `${supabase.url}/auth/v1`;
const REDIRECT_URI = "http://127.0.0.1:9/callback";

/** Un cliente con la sesión del usuario guardada (los métodos de `auth.oauth` la usan). */
export async function sessionFor(email: string): Promise<SupabaseClient<Database>> {
  const admin = createClient(supabase.url, supabase.secretKey, { auth: { persistSession: false } });
  for (let attempt = 1; ; attempt++) {
    const user = createClient<Database>(supabase.url, supabase.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw link.error;
    const verified = await user.auth.verifyOtp({
      token_hash: link.data.properties.hashed_token,
      type: "magiclink",
    });
    if (verified.data.session) return user;
    if (attempt === 5) throw verified.error ?? new Error("sin sesión");
  }
}

const base64url = (bytes: Buffer) => bytes.toString("base64url");

export interface Connection {
  clientId: string;
  accessToken: string;
}

/** Registra un cliente, lo autoriza con el permiso elegido y canjea el código. */
export async function connect(
  owner: SupabaseClient<Database>,
  canWrite: boolean,
): Promise<Connection> {
  const registered = await fetch(`${AUTH}/oauth/clients/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Cliente de prueba",
      redirect_uris: [REDIRECT_URI],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  });
  expect(registered.status).toBe(201);
  const { client_id: clientId } = await registered.json<{ client_id: string }>();

  const codeVerifier = base64url(randomBytes(32));
  const authorize = new URL(`${AUTH}/oauth/authorize`);
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    code_challenge: base64url(createHash("sha256").update(codeVerifier).digest()),
    code_challenge_method: "S256",
    state: "estado",
  }).toString();
  const toConsent = await fetch(authorize, { redirect: "manual" });
  const consentUrl = new URL(toConsent.headers.get("location") ?? "");
  expect(consentUrl.pathname).toBe("/oauth/consent");
  const authorizationId = consentUrl.searchParams.get("authorization_id") ?? "";

  const details = await owner.auth.oauth.getAuthorizationDetails(authorizationId);
  if (details.error || !("authorization_id" in details.data)) throw new Error("sin detalles");
  expect(details.data.client.id).toBe(clientId);
  expect(details.data.redirect_uri).toBe(REDIRECT_URI);

  const saved = await owner.rpc("mcp_save_grant", {
    p_client_id: clientId,
    p_client_name: details.data.client.name,
    p_redirect_host: new URL(details.data.redirect_uri).host,
    p_can_write: canWrite,
  });
  expect(saved.error).toBeNull();
  const approved = await owner.auth.oauth.approveAuthorization(authorizationId, {
    skipBrowserRedirect: true,
  });
  if (approved.error) throw approved.error;
  const back = new URL(approved.data.redirect_url);
  expect(back.searchParams.get("state")).toBe("estado");

  const token = await fetch(`${AUTH}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: back.searchParams.get("code") ?? "",
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: codeVerifier,
    }),
  });
  expect(token.status).toBe(200);
  const { access_token: accessToken } = await token.json<{ access_token: string }>();
  return { clientId, accessToken };
}
