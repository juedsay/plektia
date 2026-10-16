import { createClient } from "@supabase/supabase-js";

import type { PublicPageReader } from "@/application/ports/public-page-reader";
import type { Database } from "@/infrastructure/supabase/database.types";
import type { SupabaseConfig } from "@/infrastructure/supabase/server-client";
import { SupabasePublicPageReader } from "@/infrastructure/supabase/supabase-public-page-reader";

/**
 * Lector de páginas públicas: lee como un visitante (clave pública, sin cookies
 * ni sesión), así la página nunca depende de quién la pide. A diferencia de la
 * sesión, sin configuración no hay un "modo apagado" razonable: falla claro en
 * vez de mostrar un 404 a todo el mundo.
 */
export function createPublicPageReader(config: Partial<SupabaseConfig>): PublicPageReader {
  if (!config.url || !config.publishableKey) {
    throw new Error("public-page: falta SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY");
  }
  const client = createClient<Database>(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return new SupabasePublicPageReader(client);
}
