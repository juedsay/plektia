import { execFileSync } from "node:child_process";
import { join } from "node:path";

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

/** Header `Cookie` con una sesión válida del usuario del seed. */
export async function sessionCookieFor(email: string): Promise<string> {
  const supabase = localSupabase();
  const admin = createClient(supabase.url, supabase.secretKey, { auth: { persistSession: false } });
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;

  const anon = createClient(supabase.url, supabase.publishableKey, {
    auth: { persistSession: false },
  });
  const verified = await anon.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "magiclink",
  });
  if (verified.error || !verified.data.session) throw verified.error ?? new Error("sin sesión");

  // Las mismas cookies que escribe la app al terminar el login.
  const jar = new Map<string, string>();
  const client = createSupabaseServerClient(
    { url: supabase.url, publishableKey: supabase.publishableKey },
    null,
    { set: (name, value) => jar.set(name, value) },
  );
  const { error } = await client.auth.setSession(verified.data.session);
  if (error) throw error;
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}
