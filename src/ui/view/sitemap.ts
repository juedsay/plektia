/** Páginas propias de Plektia que siempre van al sitemap. */
export const SITE_PAGES = ["/", "/plektia", "/contact", "/legal/privacy"] as const;

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Sitemap XML con las páginas de Plektia y un `/{handle}` por perfil. */
export function sitemapXml(origin: string, handles: readonly string[]): string {
  const urls = [...SITE_PAGES, ...handles.map((handle) => `/${handle}`)]
    .map((path) => `  <url><loc>${escapeXml(new URL(path, origin).href)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** robots.txt: todo indexable salvo el panel y el login, con el sitemap. */
export function robotsTxt(origin: string): string {
  return [
    "User-agent: *",
    "Disallow: /admin",
    "Disallow: /auth",
    "Disallow: /login",
    "",
    `Sitemap: ${new URL("/sitemap.xml", origin).href}`,
    "",
  ].join("\n");
}
