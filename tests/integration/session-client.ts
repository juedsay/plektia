import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inject } from "vitest";

import type { Database } from "@/infrastructure/supabase/database.types";

const supabase = inject("supabase");

/** Cliente con la sesión real de un usuario del seed (API admin de Supabase local). */
export async function clientFor(email: string): Promise<SupabaseClient<Database>> {
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
  return createClient<Database>(supabase.url, supabase.publishableKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${verified.data.session.access_token}` } },
  });
}
