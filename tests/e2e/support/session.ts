import { execFileSync } from "node:child_process";
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
