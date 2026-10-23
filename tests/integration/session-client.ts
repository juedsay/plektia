import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inject } from "vitest";

import type { Database } from "@/infrastructure/supabase/database.types";

const supabase = inject("supabase");

/** Cliente con la sesión real de un usuario del seed (API admin de Supabase local). */
export async function clientFor(email: string): Promise<SupabaseClient<Database>> {
  const admin = createClient(supabase.url, supabase.secretKey, { auth: { persistSession: false } });
  const anon = createClient(supabase.url, supabase.publishableKey, {
    auth: { persistSession: false },
  });
  // Generar un link invalida el anterior del mismo usuario: si otro archivo de
  // tests en paralelo pidió uno en el medio, se reintenta con uno nuevo.
  for (let attempt = 1; ; attempt++) {
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw link.error;
    const verified = await anon.auth.verifyOtp({
      token_hash: link.data.properties.hashed_token,
      type: "magiclink",
    });
    const session = verified.data.session;
    if (session) {
      return createClient<Database>(supabase.url, supabase.publishableKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${session.access_token}` } },
      });
    }
    if (attempt === 5) throw verified.error ?? new Error("sin sesión");
  }
}
