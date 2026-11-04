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
 * Cookies que ya se escribieron en este pedido, por su `CookieWriter` (uno por
 * pedido). Un pedido del panel arma más de un cliente (el middleware de sesión
 * y la Action): si el primero renueva la sesión vencida, el segundo tiene que
 * ver los tokens nuevos. Si leyera solo los del pedido, intentaría renovar otra
 * vez con un refresh token ya usado, y con la rotación de Supabase eso puede
 * fallar y dejar la escritura con un token vencido.
 */
const writtenThisRequest = new WeakMap<CookieWriter, Map<string, string>>();

/** Anota lo que se escribió (un valor vacío o `maxAge` 0 es borrar la cookie). */
export function rememberWrittenCookies(
  cookies: CookieWriter,
  toSet: readonly { name: string; value: string; options: CookieOptions }[],
): void {
  const written = writtenThisRequest.get(cookies) ?? new Map<string, string>();
  for (const { name, value, options } of toSet) {
    written.set(name, options.maxAge === 0 ? "" : value);
  }
  writtenThisRequest.set(cookies, written);
}

/** Las cookies del pedido, con lo escrito en este mismo pedido por encima. */
export function cookiesOfRequest(
  cookieHeader: string | null,
  cookies: CookieWriter,
): { name: string; value: string }[] {
  const current = new Map(
    parseCookieHeader(cookieHeader ?? "").map(({ name, value }) => [name, value]),
  );
  for (const [name, value] of writtenThisRequest.get(cookies) ?? []) {
    if (value === "") current.delete(name);
    else current.set(name, value);
  }
  return [...current].map(([name, value]) => ({ name, value }));
}

/**
 * Cliente de Supabase para un pedido. Solo existe del lado del servidor: el
 * navegador nunca maneja tokens, así que las cookies pueden ser `HttpOnly`.
 * Cada pedido arma sus propios clientes (lo exige @supabase/ssr para no mezclar
 * sesiones), y todos ven la sesión ya renovada en ese pedido.
 */
export function createSupabaseServerClient(
  config: SupabaseConfig,
  cookieHeader: string | null,
  cookies: CookieWriter,
): SupabaseClient<Database> {
  return createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookiesOfRequest(cookieHeader, cookies),
      setAll: (toSet) => {
        rememberWrittenCookies(cookies, toSet);
        for (const { name, value, options } of toSet) {
          cookies.set(name, value, secureCookieAttributes(options));
        }
      },
    },
  });
}
