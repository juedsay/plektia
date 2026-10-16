import type { PublicLink, PublicPage } from "@/application/ports/public-page-reader";

/**
 * JSON para un `<script type="application/ld+json">`. Escapa `<`, `>` y `&`:
 * así un texto del usuario (bio, títulos) no puede cerrar el script e inyectar HTML.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

/** Datos estructurados de un perfil (schema.org `ProfilePage`). */
export function profileJsonLd(page: PublicPage, canonical: URL): Record<string, unknown> {
  const links: PublicLink[] = [
    ...page.sections.flatMap((section) => section.links),
    ...page.unsectionedLinks,
  ];
  // `sameAs`: solo los perfiles propios en otras plataformas, no cualquier link.
  const sameAs = links.filter((link) => link.providerHandle !== null).map((link) => link.url);
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: canonical.href,
    mainEntity: {
      "@type": "Person",
      name: page.displayName,
      ...(page.showHandle ? { alternateName: `@${page.handle}` } : {}),
      ...(page.bio ? { description: page.bio } : {}),
      ...(sameAs.length > 0 ? { sameAs } : {}),
    },
  };
}
