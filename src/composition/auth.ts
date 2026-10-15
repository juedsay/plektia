import type { AuthGateway } from "@/application/ports/auth-gateway";
import { err } from "@/domain/result";
import {
  type CookieWriter,
  createSupabaseServerClient,
  type SupabaseConfig,
} from "@/infrastructure/supabase/server-client";
import { SupabaseAuthGateway } from "@/infrastructure/supabase/supabase-auth-gateway";

/** Sin configuración de Supabase, el login responde "no disponible" en vez de romper. */
const unavailable: AuthGateway = {
  startSignIn: () => Promise.resolve(err("auth_unavailable")),
  completeSignIn: () => Promise.resolve(err("sign_in_failed")),
  signOut: () => Promise.resolve(),
};

export function createAuthGateway(
  config: Partial<SupabaseConfig>,
  request: Request,
  cookies: CookieWriter,
): AuthGateway {
  if (!config.url || !config.publishableKey) return unavailable;
  const client = createSupabaseServerClient(
    { url: config.url, publishableKey: config.publishableKey },
    request.headers.get("cookie"),
    cookies,
  );
  return new SupabaseAuthGateway(client.auth);
}
