import type { LinkKind } from "@/domain/link-presentation";
import { socialProfileFor } from "@/ui/view/social-profile";

// Qué es un link (SPEC-link-form, 7b): red social, artículo, video o sitio. Si el
// dueño no lo eligió (`null`), se deduce de la URL acá, al mostrarlo: así la
// regla vive en un solo lugar y los links viejos no necesitan rellenarse. Es una
// suposición razonable, no una certeza: por eso se puede cambiar a mano.

/** Hosts de blogs y newsletters: cualquier ruta es un artículo. */
const ARTICLE_HOSTS = [
  "medium.com",
  "substack.com",
  "dev.to",
  "hashnode.dev",
  "hashnode.com",
  "ghost.io",
];
/** Carpetas que suelen tener artículos. */
const ARTICLE_FOLDERS = new Set([
  "blog",
  "articulos",
  "articulo",
  "articles",
  "article",
  "posts",
  "post",
  "p",
  "notas",
  "pulse",
  "news",
  "noticias",
]);

export function detectLinkKind(rawUrl: string): LinkKind {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "site";
  }
  if (url.protocol !== "https:") return "site";
  if (socialProfileFor(rawUrl)?.username) return "social";
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());
  if (isVideo(host, segments, url)) return "video";
  if (segments.length === 0) return "site";
  if (ARTICLE_HOSTS.some((blog) => host === blog || host.endsWith(`.${blog}`))) return "article";
  if (segments.slice(0, -1).some((segment) => ARTICLE_FOLDERS.has(segment))) return "article";
  // Un "slug" de artículo: varias palabras unidas por guiones.
  const last = segments.at(-1) ?? "";
  return /^[a-z0-9]+(-[a-z0-9]+){2,}(\.html?)?$/.test(last) ? "article" : "site";
}

function isVideo(host: string, segments: readonly string[], url: URL): boolean {
  const [first = "", second = "", third = ""] = segments;
  switch (host) {
    case "youtu.be":
      return first !== "";
    case "youtube.com":
      return (first === "watch" && url.searchParams.has("v")) || ["shorts", "live"].includes(first);
    case "vimeo.com":
      return /^\d+$/.test(first);
    case "tiktok.com":
      return first.startsWith("@") && second === "video" && third !== "";
    case "twitch.tv":
      return second === "clip" || first === "videos";
    case "instagram.com":
      return ["reel", "reels", "tv"].includes(first) && second !== "";
    default:
      return false;
  }
}

/** El tipo que se muestra: el elegido, o el deducido de la URL. */
export function kindOf(link: { readonly url: string; readonly kind?: LinkKind | null }): LinkKind {
  return link.kind ?? detectLinkKind(link.url);
}

export const KIND_NAMES: Readonly<Record<LinkKind, string>> = {
  social: "Red social",
  article: "Artículo",
  video: "Video",
  site: "Sitio",
};
