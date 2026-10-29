import type { PublicLink, PublicPage } from "@/application/ports/public-page-reader";
import type { LinkKind } from "@/domain/link-presentation";
import { KIND_NAMES, kindOf } from "@/ui/view/link-kind";
import { socialProfileFor } from "@/ui/view/social-profile";

// Presentación de la página pública: funciones puras, sin DOM, para que los
// componentes Astro solo pinten.

/**
 * Línea secundaria de un link: la descripción; si no hay, el "@usuario" de un
 * perfil en una red social; y si tampoco, su dirección en corto. Un artículo o
 * un video lo dicen adelante ("Artículo · medium.com/…", SPEC-link-form 7b).
 */
export function linkMeta(
  link: Pick<PublicLink, "description" | "url"> & { readonly kind?: LinkKind | null },
): string {
  const kind = kindOf(link);
  const prefix = kind === "article" || kind === "video" ? `${KIND_NAMES[kind]} · ` : "";
  if (link.description) return `${prefix}${link.description}`;
  const username = socialProfileFor(link.url)?.username;
  return username ? `@${username}` : `${prefix}${shortUrl(link.url)}`;
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

/** Los links de la fila de íconos, en el orden de la página (36d). */
export function iconLinksOf(
  page: Pick<PublicPage, "sections" | "unsectionedLinks">,
): readonly PublicLink[] {
  return [...page.sections.flatMap((section) => section.links), ...page.unsectionedLinks].filter(
    (link) => link.placement !== "list",
  );
}

/** Los destacados arriba de todo, en el orden de la página (36e). Un "solo ícono" no va. */
export function topLinksOf(
  page: Pick<PublicPage, "sections" | "unsectionedLinks">,
): readonly PublicLink[] {
  return [...page.sections.flatMap((section) => section.links), ...page.unsectionedLinks].filter(
    (link) => link.highlight === "top" && link.placement !== "icon",
  );
}

/**
 * Los links que van en la lista de su sección: todos menos los que son solo
 * ícono y los que ya están arriba de todo.
 */
export function listedLinks(links: readonly PublicLink[]): readonly PublicLink[] {
  return links.filter((link) => link.placement !== "icon" && link.highlight !== "top");
}

/** Inicial del avatar provisorio: la primera letra visible del nombre. */
export function initialOf(displayName: string): string {
  const [first] = new Intl.Segmenter("es", { granularity: "grapheme" }).segment(displayName.trim());
  return first ? first.segment.toLocaleUpperCase("es") : "?";
}
