import type { PublicLink } from "@/application/ports/public-page-reader";
import { socialProfileFor } from "@/ui/view/social-profile";

// Presentación de la página pública: funciones puras, sin DOM, para que los
// componentes Astro solo pinten.

/**
 * Línea secundaria de un link: la descripción; si no hay, el "@usuario" de un
 * perfil en una red social; y si tampoco, su dirección en corto.
 */
export function linkMeta(link: Pick<PublicLink, "description" | "url">): string {
  if (link.description) return link.description;
  const username = socialProfileFor(link.url)?.username;
  return username ? `@${username}` : shortUrl(link.url);
}

/** `https://www.youtube.com/@juedsay/` → `youtube.com/@juedsay`; `mailto:a@b.c` → `a@b.c`. */
export function shortUrl(raw: string): string {
  const url = new URL(raw);
  if (url.protocol === "mailto:") return url.pathname;
  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "");
  return `${host}${path}`;
}

/**
 * `rel="me"`: el link apunta a un perfil o canal propio (tiene handle del
 * proveedor o es el perfil de una red social), no a un contenido suelto. Sirve
 * para la verificación cruzada (Mastodon, buscadores).
 */
export function isProfileLink(link: Pick<PublicLink, "providerHandle" | "url">): boolean {
  return link.providerHandle !== null || Boolean(socialProfileFor(link.url)?.username);
}

/** Inicial del avatar provisorio: la primera letra visible del nombre. */
export function initialOf(displayName: string): string {
  const [first] = new Intl.Segmenter("es", { granularity: "grapheme" }).segment(displayName.trim());
  return first ? first.segment.toLocaleUpperCase("es") : "?";
}
