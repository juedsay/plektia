import type { Result } from "@/domain/result";

// Inicio y cierre de sesión con un proveedor OAuth (SPEC-identity, "Flujo de
// login"). Las páginas de auth dependen de este puerto, no de Supabase.

export const OAUTH_PROVIDERS = ["github", "google"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export type SignOutScope = "local" | "global";

export interface AuthGateway {
  /** URL del proveedor a la que se manda al usuario. Guarda el verificador PKCE en una cookie. */
  startSignIn(
    provider: OAuthProvider,
    callbackUrl: string,
  ): Promise<Result<string, "auth_unavailable">>;
  /** Canjea el código del callback por la sesión (cookies). */
  completeSignIn(code: string): Promise<Result<void, "sign_in_failed">>;
  /** `local`: este dispositivo. `global`: todos los dispositivos. */
  signOut(scope: SignOutScope): Promise<void>;
}
