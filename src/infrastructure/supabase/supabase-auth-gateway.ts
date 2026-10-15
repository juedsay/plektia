import type { SupabaseClient } from "@supabase/supabase-js";

import type { AuthGateway, OAuthProvider, SignOutScope } from "@/application/ports/auth-gateway";
import { err, ok, type Result } from "@/domain/result";

type Auth = Pick<SupabaseClient["auth"], "signInWithOAuth" | "exchangeCodeForSession" | "signOut">;

/** OAuth con PKCE: el verificador viaja en una cookie HttpOnly, nunca en la URL. */
export class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly auth: Auth) {}

  async startSignIn(
    provider: OAuthProvider,
    callbackUrl: string,
  ): Promise<Result<string, "auth_unavailable">> {
    const { data, error } = await this.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl, skipBrowserRedirect: true },
    });
    if (error || !data.url) return err("auth_unavailable");
    return ok(data.url);
  }

  async completeSignIn(code: string): Promise<Result<void, "sign_in_failed">> {
    const { error } = await this.auth.exchangeCodeForSession(code);
    return error ? err("sign_in_failed") : ok(undefined);
  }

  async signOut(scope: SignOutScope): Promise<void> {
    const { error } = await this.auth.signOut({ scope });
    // Aunque falle en el servidor, @supabase/ssr ya borró las cookies locales.
    if (error) console.error("auth: el cierre de sesión falló en Supabase", error.message);
  }
}
