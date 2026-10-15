// Qué rutas necesitan sesión. Pura: el middleware la aplica.

// Rutas que leen la sesión. El resto (la página pública) no la toca: así nunca
// responde con `Set-Cookie` y se puede cachear (ADR 0003).
const SESSION_PREFIXES = ["/admin", "/login", "/auth"] as const;
const PROTECTED_PREFIXES = ["/admin"] as const;

// Astro decodifica la ruta antes de buscar la página: `/%61dmin` llega a
// `/admin`. Se compara la misma forma que va a ver el router.
function normalize(pathname: string): string {
  let decoded: string;
  try {
    decoded = decodeURI(pathname);
  } catch {
    decoded = pathname;
  }
  return decoded.replace(/\/{2,}/g, "/").toLowerCase();
}

function matches(pathname: string, prefixes: readonly string[]): boolean {
  const path = normalize(pathname);
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function usesSession(pathname: string): boolean {
  return matches(pathname, SESSION_PREFIXES);
}

export function requiresSession(pathname: string): boolean {
  return matches(pathname, PROTECTED_PREFIXES);
}

/** `/login?next=…` para volver a la ruta pedida después de entrar. */
export function loginRedirect(pathname: string, search = ""): string {
  return `/login?next=${encodeURIComponent(`${pathname}${search}`)}`;
}
