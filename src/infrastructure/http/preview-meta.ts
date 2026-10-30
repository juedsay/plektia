import { toSafeLine } from "@/domain/text";

// Lo que se toma de la página de un artículo (SPEC-link-form, 7c): solo
// `og:title`, `og:description` y `og:image` (con `twitter:*` y `<title>` de
// respaldo). Se buscan etiquetas `<meta>` con expresiones acotadas, sin armar un
// DOM, y antes se sacan comentarios, scripts y estilos para que un `<meta>`
// escrito ahí adentro no cuente. El texto sale como una línea segura y cortada.

export const PREVIEW_TITLE_MAX = 80;
export const PREVIEW_DESCRIPTION_MAX = 120;

export interface PreviewMeta {
  readonly title: string | null;
  readonly description: string | null;
  /** URL absoluta `https:` de la imagen, o `null`. */
  readonly imageUrl: string | null;
}

const NOISE = /<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script\s*>|<style\b[\s\S]*?<\/style\s*>/gi;
const META_TAG = /<meta\b[^>]*>/gi;
const ATTRIBUTE = /([a-zA-Z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
const TITLE_TAG = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i;

export function parsePreviewMeta(html: string, pageUrl: URL): PreviewMeta {
  const clean = html.replace(NOISE, " ");
  // Lo que importa está en el <head>: lo demás no se recorre.
  const headEnd = clean.search(/<\/head\s*>|<body\b/i);
  const head = headEnd === -1 ? clean : clean.slice(0, headEnd);

  const meta = new Map<string, string>();
  for (const [tag] of head.matchAll(META_TAG)) {
    const attributes = new Map<string, string>();
    for (const match of tag.matchAll(ATTRIBUTE)) {
      const name = (match[1] ?? "").toLowerCase();
      if (!attributes.has(name)) attributes.set(name, match[2] ?? match[3] ?? match[4] ?? "");
    }
    const key = (attributes.get("property") ?? attributes.get("name") ?? "").toLowerCase();
    const content = attributes.get("content");
    if (key && content !== undefined && !meta.has(key)) meta.set(key, decodeEntities(content));
  }

  const titleTag = TITLE_TAG.exec(head)?.[1];
  const title =
    meta.get("og:title") ?? meta.get("twitter:title") ?? (titleTag ? decodeEntities(titleTag) : "");
  const description =
    meta.get("og:description") ?? meta.get("twitter:description") ?? meta.get("description") ?? "";
  const image = meta.get("og:image") ?? meta.get("og:image:url") ?? meta.get("twitter:image");

  return {
    title: toSafeLine(title, PREVIEW_TITLE_MAX),
    description: toSafeLine(description, PREVIEW_DESCRIPTION_MAX),
    imageUrl: image ? absoluteHttps(image.trim(), pageUrl) : null,
  };
}

function absoluteHttps(value: string, base: URL): string | null {
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

const NAMED: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
};

/** Entidades HTML comunes y numéricas; un código inválido se descarta. */
export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (whole, entity: string) => {
    if (entity.startsWith("#")) {
      const code =
        entity[1]?.toLowerCase() === "x"
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code)
        : "";
    }
    return NAMED[entity.toLowerCase()] ?? whole;
  });
}
