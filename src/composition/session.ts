import type { SessionReader } from "@/application/ports/session-reader";
import {
  type CookieWriter,
  createSupabaseServerClient,
  type SupabaseConfig,
} from "@/infrastructure/supabase/server-client";
import { SupabaseSessionReader } from "@/infrastructure/supabase/supabase-session-reader";

const noSession: SessionReader = { getCurrentUser: () => Promise.resolve(null) };

/** Arma el lector de sesión de un pedido. Sin configuración, nadie tiene sesión. */
export function createSessionReader(
  config: Partial<SupabaseConfig>,
  request: Request,
  cookies: CookieWriter,
): SessionReader {
  if (!config.url || !config.publishableKey) return noSession;
  const client = createSupabaseServerClient(
    { url: config.url, publishableKey: config.publishableKey },
    request.headers.get("cookie"),
    cookies,
  );
  return new SupabaseSessionReader(client.auth);
}
