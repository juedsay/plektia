import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { join } from "node:path";

import type { BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "../../../src/infrastructure/supabase/server-client";

// No se puede automatizar el login real con GitHub ni Google (SPEC-identity,
// "Testing"): la sesión de prueba sale de la API admin de Supabase local. Este
// camino solo existe en los tests y nunca se despliega.

interface LocalSupabase {
  readonly url: string;
  readonly publishableKey: string;
  readonly secretKey: string;
}

function localSupabase(): LocalSupabase {
  const cli = join(process.cwd(), "node_modules", "supabase", "dist", "supabase.js");
  const status = JSON.parse(
    execFileSync(process.execPath, [cli, "status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  ) as Record<string, string | undefined>;
  const { API_URL, PUBLISHABLE_KEY, SECRET_KEY } = status;
  if (!API_URL || !PUBLISHABLE_KEY || !SECRET_KEY) {
    throw new Error("Supabase local no está levantado: corré `pnpm db:start`.");
  }
  return { url: API_URL, publishableKey: PUBLISHABLE_KEY, secretKey: SECRET_KEY };
}

/** Sesión del usuario por magic link (API admin de Supabase local). */
async function verifiedSession(supabase: LocalSupabase, email: string) {
  const admin = createClient(supabase.url, supabase.secretKey, { auth: { persistSession: false } });
  const anon = createClient(supabase.url, supabase.publishableKey, {
    auth: { persistSession: false },
  });
  // Generar un link invalida el anterior del mismo usuario: si otra prueba en
  // paralelo pidió uno en el medio, se reintenta con uno nuevo.
  for (let attempt = 1; ; attempt++) {
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw link.error;
    const verified = await anon.auth.verifyOtp({
      token_hash: link.data.properties.hashed_token,
      type: "magiclink",
    });
    if (verified.data.session) return verified.data.session;
    if (attempt === 5) throw verified.error ?? new Error("sin sesión");
  }
}

/** Header `Cookie` con una sesión válida del usuario del seed. */
export async function sessionCookieFor(email: string): Promise<string> {
  const supabase = localSupabase();
  const session = await verifiedSession(supabase, email);

  // Las mismas cookies que escribe la app al terminar el login.
  const jar = new Map<string, string>();
  const client = createSupabaseServerClient(
    { url: supabase.url, publishableKey: supabase.publishableKey },
    null,
    { set: (name, value) => jar.set(name, value) },
  );
  const { error } = await client.auth.setSession(session);
  if (error) throw error;
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

/** Inicia sesión en el navegador de la prueba con un usuario del seed. */
export async function signIn(context: BrowserContext, baseURL: string, email: string) {
  const cookie = await sessionCookieFor(email);
  await context.addCookies(
    cookie.split("; ").map((pair) => {
      const separator = pair.indexOf("=");
      return {
        name: pair.slice(0, separator),
        value: pair.slice(separator + 1),
        url: baseURL,
        httpOnly: true,
        sameSite: "Lax" as const,
      };
    }),
  );
}

/** Deja una cuenta del seed con su única página (la de su mismo id) y sin última elegida. */
export async function resetPagesOf(ownerId: string) {
  const supabase = localSupabase();
  const admin = createClient(supabase.url, supabase.secretKey, { auth: { persistSession: false } });
  const removed = await admin.from("pages").delete().eq("owner_id", ownerId).neq("id", ownerId);
  if (removed.error) throw removed.error;
  const reset = await admin.from("profiles").update({ last_page_id: null }).eq("id", ownerId);
  if (reset.error) throw reset.error;
}

/** Restaura la presentación de una página (los tests que la editan la dejan como estaba). */
export async function restorePageSettings(
  pageId: string,
  settings: { display_name: string; bio: string | null; show_handle: boolean },
) {
  const supabase = localSupabase();
  const admin = createClient(supabase.url, supabase.secretKey, { auth: { persistSession: false } });
  const { error } = await admin.from("pages").update(settings).eq("id", pageId);
  if (error) throw error;
}

/** Borra los links de prueba de una página por su título (para dejar todo como estaba). */
export async function deleteLinksTitled(pageId: string, titles: readonly string[]) {
  const supabase = localSupabase();
  const admin = createClient(supabase.url, supabase.secretKey, { auth: { persistSession: false } });
  const { error } = await admin.from("links").delete().eq("page_id", pageId).in("title", titles);
  if (error) throw error;
}

/** Crea links "Sin sección" en una página, en ese orden (para pruebas de ordenar). */
export async function insertUnsectionedLinks(
  ownerId: string,
  pageId: string,
  titles: readonly string[],
) {
  const supabase = localSupabase();
  const admin = createClient(supabase.url, supabase.secretKey, { auth: { persistSession: false } });
  for (const title of titles) {
    const { error } = await admin.from("links").insert({
      owner_id: ownerId,
      page_id: pageId,
      title,
      url: `https://plektia.app/${title.toLowerCase().replace(/ /g, "-")}`,
    });
    if (error) throw error;
  }
}

/** Crea una sección en una página (con la clave de servicio local); devuelve su id. */
export async function insertSection(
  ownerId: string,
  pageId: string,
  title: string,
): Promise<string> {
  const supabase = localSupabase();
  const admin = createClient(supabase.url, supabase.secretKey, { auth: { persistSession: false } });
  const { data, error } = await admin
    .from("sections")
    .insert({ owner_id: ownerId, page_id: pageId, title })
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

/** Borra las secciones de prueba de una página por su título. */
export async function deleteSectionsTitled(pageId: string, titles: readonly string[]) {
  const supabase = localSupabase();
  const admin = createClient(supabase.url, supabase.secretKey, { auth: { persistSession: false } });
  const { error } = await admin.from("sections").delete().eq("page_id", pageId).in("title", titles);
  if (error) throw error;
}

/**
 * Pone un canal "en vivo" como lo dejaría el refresco (con la clave de servicio
 * local): marca "Transmito en este canal" en sus links y guarda su estado.
 * `checkedMinutesAgo` simula cuándo fue la última revisión buena.
 */
export async function setChannelLive(
  provider: "twitch" | "youtube",
  handle: string,
  live: { title: string; startedAt: string; url: string } | null,
  checkedMinutesAgo = 0,
) {
  const supabase = localSupabase();
  const admin = createClient(supabase.url, supabase.secretKey, { auth: { persistSession: false } });
  const links = await admin
    .from("links")
    .select("id")
    .eq("provider", provider)
    .eq("provider_handle", handle);
  if (links.error) throw links.error;
  for (const link of links.data as { id: string }[]) {
    const watched = await admin
      .from("link_media_settings")
      .upsert({ link_id: link.id, watch_live: live !== null }, { onConflict: "link_id" });
    if (watched.error) throw watched.error;
  }
  const channel = await admin
    .from("provider_channels")
    .upsert({ provider, handle }, { onConflict: "provider,handle" })
    .select("id")
    .single<{ id: string }>();
  if (channel.error) throw channel.error;
  const status = await admin.from("channel_status").upsert({
    channel_id: channel.data.id,
    is_live: live !== null,
    live_title: live?.title ?? null,
    live_started_at: live?.startedAt ?? null,
    live_url: live?.url ?? null,
    checked_at: new Date(Date.now() - checkedMinutesAgo * 60_000).toISOString(),
  });
  if (status.error) throw status.error;
}

/** Crea un link en una página (con la clave de servicio local); devuelve su id. */
export async function insertLink(
  ownerId: string,
  pageId: string,
  link: {
    title: string;
    url: string;
    provider: string;
    provider_handle: string | null;
    section_id?: string;
  },
): Promise<string> {
  const supabase = localSupabase();
  const admin = createClient(supabase.url, supabase.secretKey, { auth: { persistSession: false } });
  const { data, error } = await admin
    .from("links")
    .insert({ owner_id: ownerId, page_id: pageId, ...link })
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

/**
 * Crea una página como su dueño (con su sesión, sin la Action del panel: así
 * no cambia cuál es su página actual, que otras pruebas en paralelo usan).
 */
export async function createPageAs(email: string, pageId: string, handle: string) {
  const supabase = localSupabase();
  const session = await verifiedSession(supabase, email);
  const owner = createClient(supabase.url, supabase.publishableKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
  const { error } = await owner
    .from("pages")
    .insert({ id: pageId, owner_id: session.user.id, handle, display_name: "Estadísticas E2E" });
  if (error) throw error;
}

/** Borra una página (y con ella sus links y sus estadísticas). */
export async function deletePage(pageId: string) {
  const supabase = localSupabase();
  const admin = createClient(supabase.url, supabase.secretKey, { auth: { persistSession: false } });
  const { error } = await admin.from("pages").delete().eq("id", pageId);
  if (error) throw error;
}

/** Visitas y clics de hoy (UTC) de una página y de un link. */
export async function statsToday(pageId: string, linkId: string) {
  const supabase = localSupabase();
  const admin = createClient(supabase.url, supabase.secretKey, { auth: { persistSession: false } });
  const day = new Date().toISOString().slice(0, 10);
  const page = await admin
    .from("stats_daily")
    .select("views, clicks")
    .eq("page_id", pageId)
    .eq("day", day)
    .maybeSingle<{ views: number; clicks: number }>();
  const link = await admin
    .from("link_stats_daily")
    .select("clicks")
    .eq("link_id", linkId)
    .eq("day", day)
    .maybeSingle<{ clicks: number }>();
  if (page.error) throw page.error;
  if (link.error) throw link.error;
  return {
    views: page.data?.views ?? 0,
    clicks: page.data?.clicks ?? 0,
    linkClicks: link.data?.clicks ?? 0,
  };
}

export const OAUTH_REDIRECT_URI = "http://127.0.0.1:9/callback";

/**
 * Un cliente MCP que se registra (DCR) y pide autorización con PKCE, como hace
 * Claude. Devuelve el `authorization_id` con el que Supabase manda al consentimiento.
 */
export async function startOAuthAuthorization(clientName: string) {
  const supabase = localSupabase();
  const auth = `${supabase.url}/auth/v1`;
  const registered = await fetch(`${auth}/oauth/clients/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: clientName,
      redirect_uris: [OAUTH_REDIRECT_URI],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  });
  if (!registered.ok) throw new Error(`registro OAuth: ${String(registered.status)}`);
  const { client_id: clientId } = await registered.json<{ client_id: string }>();

  const codeVerifier = randomBytes(32).toString("base64url");
  const authorize = new URL(`${auth}/oauth/authorize`);
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: OAUTH_REDIRECT_URI,
    code_challenge: createHash("sha256").update(codeVerifier).digest("base64url"),
    code_challenge_method: "S256",
    state: "estado-e2e",
  }).toString();
  const toConsent = await fetch(authorize, { redirect: "manual" });
  const location = new URL(toConsent.headers.get("location") ?? "", supabase.url);
  const authorizationId = location.searchParams.get("authorization_id");
  if (!authorizationId) throw new Error(`autorización OAuth sin id: ${location.href}`);
  return { clientId, codeVerifier, authorizationId };
}

/** La conexión guardada al consentir (o `null`). */
export async function grantOf(clientId: string) {
  const supabase = localSupabase();
  const admin = createClient(supabase.url, supabase.secretKey, { auth: { persistSession: false } });
  const { data, error } = await admin
    .from("mcp_grants")
    .select("client_name, redirect_host, can_write, revoked_at")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Un cliente MCP ya conectado: autoriza por API (lo mismo que hace
 * `/oauth/consent`) y canjea el código. Devuelve el access token y el cliente.
 */
export async function connectMcpClient(email: string, canWrite: boolean) {
  const supabase = localSupabase();
  const { clientId, codeVerifier, authorizationId } = await startOAuthAuthorization("E2E MCP");
  const session = await verifiedSession(supabase, email);
  const owner = createClient(supabase.url, supabase.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await owner.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  // Como la pantalla de consentimiento: primero el detalle (ata el pedido al usuario).
  const details = await owner.auth.oauth.getAuthorizationDetails(authorizationId);
  if (details.error) throw details.error;
  const saved = await owner.rpc("mcp_save_grant", {
    p_client_id: clientId,
    p_client_name: "E2E MCP",
    p_redirect_host: new URL(OAUTH_REDIRECT_URI).host,
    p_can_write: canWrite,
  });
  if (saved.error) throw saved.error;
  const approved = await owner.auth.oauth.approveAuthorization(authorizationId, {
    skipBrowserRedirect: true,
  });
  if (approved.error) throw approved.error;
  const code = new URL(approved.data.redirect_url).searchParams.get("code") ?? "";
  const token = await fetch(`${supabase.url}/auth/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: OAUTH_REDIRECT_URI,
      client_id: clientId,
      code_verifier: codeVerifier,
    }),
  });
  if (!token.ok) throw new Error(`token OAuth: ${String(token.status)}`);
  const { access_token: accessToken } = await token.json<{ access_token: string }>();
  /** Revoca la conexión desde el panel (lo que hará `/admin/conexiones`). */
  const revoke = async () => {
    await owner.rpc("mcp_revoke_grant", { p_client_id: clientId });
    await owner.auth.oauth.revokeGrant({ clientId });
  };
  return { clientId, accessToken, revoke };
}
