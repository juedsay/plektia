import { parseHandle } from "@/domain/handle";
import { usesSession } from "@/infrastructure/http/route-access";

// Qué se cachea en la caché del Worker y con qué etiquetas (SPEC-public-page,
// "Render y caché"; ADR 0003). Regla pura: la aplica un middleware. Lo que no
// está acá explícitamente no se cachea.

export interface CachePolicy {
  readonly cacheControl: string;
  /** `Cache-Tag`: lo que permite purgar en bloque (al editar un perfil, por ejemplo). */
  readonly tags: readonly string[];
}

export const NO_STORE: CachePolicy = { cacheControl: "private, no-store", tags: [] };

/** Etiqueta de un perfil: la purga al editarlo borra todas sus variantes. */
export function profileTag(handle: string): string {
  return `profile:${handle.toLowerCase()}`;
}

/** Páginas propias de Plektia, sin datos de la base. */
const SITE_PAGES = new Set(["/", "/plektia", "/legal/privacy", "/sitemap.xml", "/robots.txt"]);
const SITE_TAG = "site";

// Formularios con estado (Turnstile, avisos de envío) o pasos del login: nunca.
const PRIVATE_PATHS = new Set(["/contact", "/contacto"]);

export function cachePolicy(request: {
  pathname: string;
  method: string;
  status: number;
  setsCookie: boolean;
}): CachePolicy {
  const { pathname, method, status, setsCookie } = request;
  if (method !== "GET" && method !== "HEAD") return NO_STORE;
  if (setsCookie || usesSession(pathname) || PRIVATE_PATHS.has(pathname)) return NO_STORE;
  if (status >= 500 || (status >= 300 && status < 400)) return NO_STORE;

  if (SITE_PAGES.has(pathname) && status === 200) {
    return { cacheControl: "public, max-age=300, stale-while-revalidate=3600", tags: [SITE_TAG] };
  }

  // `/{handle}`: la página de un perfil, o el 404 de un handle que todavía no
  // existe (con la misma etiqueta, así crear el perfil también lo purga).
  const segment = /^\/([^/]+)$/.exec(pathname)?.[1];
  const handle = segment ? parseHandle(decodeSafe(segment)) : null;
  if (handle?.ok && (status === 200 || status === 404)) {
    return {
      cacheControl:
        status === 200 ? "public, max-age=60, stale-while-revalidate=300" : "public, max-age=60",
      tags: [profileTag(handle.value)],
    };
  }

  if (status === 404) return { cacheControl: "public, max-age=60", tags: [SITE_TAG] };
  return NO_STORE;
}

function decodeSafe(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
