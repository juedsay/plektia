import { type CookieOptions, createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/infrastructure/supabase/database.types";

export interface SupabaseConfig {
  readonly url: string;
  readonly publishableKey: string;
}

export interface CookieAttributes {
  readonly httpOnly: true;
  readonly secure: true;
  readonly sameSite: "lax";
  readonly path: "/";
  readonly maxAge?: number;
  readonly expires?: Date;
}

export interface CookieWriter {
  set(name: string, value: string, options: CookieAttributes): void;
}

/**
 * Atributos de las cookies de sesión. Los de seguridad son fijos, sin importar
 * lo que pida la librería; de ella solo se toma la duración.
 */
export function secureCookieAttributes(options: CookieOptions): CookieAttributes {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    ...(options.maxAge === undefined ? {} : { maxAge: options.maxAge }),
    ...(options.expires === undefined ? {} : { expires: options.expires }),
  };
}

/**
 * Cliente de Supabase para un pedido. Solo existe del lado del servidor: el
 * navegador nunca maneja tokens, así que las cookies pueden ser `HttpOnly`.
 * Se crea uno por pedido (lo exige @supabase/ssr para no mezclar sesiones).
 */
export function createSupabaseServerClient(
  config: SupabaseConfig,
  cookieHeader: string | null,
  cookies: CookieWriter,
): SupabaseClient<Database> {
  return createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll: () => parseCookieHeader(cookieHeader ?? ""),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) {
          cookies.set(name, value, secureCookieAttributes(options));
        }
      },
    },
  });
}
