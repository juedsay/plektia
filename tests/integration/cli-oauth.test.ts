import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import { afterAll, describe, expect, inject, it } from "vitest";

import { SupabaseMcpTokenVerifier } from "@/infrastructure/mcp/token-verifier";
import { protectedResourceMetadata } from "@/infrastructure/mcp/resource-metadata";

import { CredentialsFile, FileOAuthProvider } from "../../scripts/plektia/credentials";
import { sessionFor } from "./oauth-connection";

// El login del CLI (tarea 32c) contra Supabase local: el proveedor del CLI con
// el `auth()` del SDK hace el registro dinámico y PKCE; la aprobación la hace
// el dueño (por API, lo que haría `/oauth/consent`). El servidor de Plektia no
// corre acá: sus metadatos los sirve un `fetch` de prueba.
const supabase = inject("supabase");
const SERVER = "https://plektia.test";
const directory = mkdtempSync(join(tmpdir(), "plektia-cli-"));

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

const fetchWithMetadata: typeof fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input.toString());
  if (url.origin === SERVER && url.pathname.startsWith("/.well-known/oauth-protected-resource")) {
    return Promise.resolve(Response.json(protectedResourceMetadata(SERVER, supabase.url)));
  }
  return fetch(input, init);
};

describe("login del CLI", () => {
  it("registra la app, autoriza con PKCE y guarda un token que /mcp acepta", async () => {
    const credentials = new CredentialsFile(directory);
    let authorizationUrl: URL | null = null;
    const provider = new FileOAuthProvider(SERVER, credentials, (url) => {
      authorizationUrl = url;
    });
    const options = { serverUrl: `${SERVER}/mcp`, fetchFn: fetchWithMetadata };

    expect(await auth(provider, options)).toBe("REDIRECT");
    expect(provider.clientInformation()?.client_id).toMatch(/^[0-9a-f-]{36}$/);
    const opened = authorizationUrl as URL | null;
    expect(opened?.searchParams.get("code_challenge_method")).toBe("S256");
    expect(opened?.searchParams.get("state")).toBe(provider.pendingState);

    // Supabase manda al consentimiento; el dueño aprueba.
    const toConsent = await fetch(opened ?? "", { redirect: "manual" });
    const authorizationId =
      new URL(toConsent.headers.get("location") ?? "", supabase.url).searchParams.get(
        "authorization_id",
      ) ?? "";
    const owner = await sessionFor("admin@plektia.test");
    const details = await owner.auth.oauth.getAuthorizationDetails(authorizationId);
    if (details.error || !("authorization_id" in details.data)) throw new Error("sin detalles");
    await owner.rpc("mcp_save_grant", {
      p_client_id: details.data.client.id,
      p_client_name: details.data.client.name,
      p_redirect_host: new URL(details.data.redirect_uri).host,
      p_can_write: false,
    });
    const approved = await owner.auth.oauth.approveAuthorization(authorizationId, {
      skipBrowserRedirect: true,
    });
    if (approved.error) throw approved.error;
    const back = new URL(approved.data.redirect_url);
    expect(back.searchParams.get("state")).toBe(provider.pendingState);

    expect(
      await auth(provider, { ...options, authorizationCode: back.searchParams.get("code") ?? "" }),
    ).toBe("AUTHORIZED");
    const accessToken = provider.tokens()?.access_token ?? "";
    const verifier = new SupabaseMcpTokenVerifier({
      url: supabase.url,
      publishableKey: supabase.publishableKey,
    });
    expect(await verifier.verify(accessToken)).toMatchObject({ canWrite: false });

    // Las credenciales quedan solo para el usuario (en Windows el modo no aplica).
    if (process.platform !== "win32") {
      expect(statSync(credentials.path).mode & 0o077).toBe(0);
    }
    expect(credentials.forget(SERVER)).toBe(true);
    expect(provider.tokens()).toBeUndefined();
  });
});
