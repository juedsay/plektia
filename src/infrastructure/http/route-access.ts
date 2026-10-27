// Qué rutas leen o exigen sesión (SPEC-identity). Regla de HTTP, pura: la aplican los middlewares.

// Rutas que leen la sesión. El resto (la página pública) no la toca: así nunca
// responde con `Set-Cookie` y se puede cachear (ADR 0003). `/_actions` son las
// Astro Actions que llama el editor del panel: cada una exige sesión.
const SESSION_PREFIXES = ["/admin", "/login", "/auth", "/_actions"] as const;
const PROTECTED_PREFIXES = ["/admin"] as const;
// Acciones de login: las que un atacante repetiría para abusar del proveedor.
const RATE_LIMITED_PREFIXES = ["/auth"] as const;

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

/** La vista previa del panel: la única página que se puede embeber (en el propio sitio). */
const FRAMEABLE_PATHS = ["/admin/vista-previa"] as const;

export function isFrameable(pathname: string): boolean {
  const path = normalize(pathname).replace(/\/$/, "");
  return FRAMEABLE_PATHS.some((frameable) => path === frameable);
}

export function usesSession(pathname: string): boolean {
  return matches(pathname, SESSION_PREFIXES);
}

export function requiresSession(pathname: string): boolean {
  return matches(pathname, PROTECTED_PREFIXES);
}

export function isRateLimited(pathname: string): boolean {
  return matches(pathname, RATE_LIMITED_PREFIXES);
}

/** `/login?next=…` para volver a la ruta pedida después de entrar. */
export function loginRedirect(pathname: string, search = ""): string {
  return `/login?next=${encodeURIComponent(`${pathname}${search}`)}`;
}

/** Vuelta al login con el aviso de "sin acceso", conservando a dónde iba. */
export function loginErrorRedirect(next: string): string {
  return `/login?error=1&next=${encodeURIComponent(next)}`;
}

/** 303: después de un POST, el navegador sigue con un GET. */
export function seeOther(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}
