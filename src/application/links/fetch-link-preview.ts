import type {
  LinkPreview,
  LinkPreviewError,
  LinkPreviewer,
} from "@/application/ports/link-previewer";
import type { RateLimiter } from "@/application/ports/rate-limiter";
import { parseSafeUrl } from "@/domain/safe-url";
import { err, ok, type Result } from "@/domain/result";

// "Traer vista previa" (SPEC-link-form, 7c): solo cuando el dueño lo pide, con
// su propio límite (20 por minuto por cuenta), y solo para una URL https válida.

export type FetchLinkPreviewError = LinkPreviewError | "invalid_url" | "rate_limited";

export function fetchLinkPreview(deps: {
  readonly previewer: LinkPreviewer;
  readonly limiter: RateLimiter;
}) {
  return async (
    ownerId: string,
    raw: unknown,
  ): Promise<Result<LinkPreview, FetchLinkPreviewError>> => {
    const value = typeof raw === "object" && raw !== null && "url" in raw ? raw.url : undefined;
    const url = parseSafeUrl(value);
    if (!url.ok || !url.value.startsWith("https://")) return err("invalid_url");
    if (!(await deps.limiter.allow(`preview:${ownerId}`))) return err("rate_limited");
    return deps.previewer.preview(new URL(url.value));
  };
}

/**
 * La imagen de la vista previa, para que el panel la re-codifique: va como
 * `data:` URL (la CSP del panel admite `data:` en `img-src`, no otros dominios).
 */
export function fetchPreviewImage(deps: {
  readonly previewer: LinkPreviewer;
  readonly limiter: RateLimiter;
}) {
  return async (
    ownerId: string,
    raw: unknown,
  ): Promise<Result<{ readonly dataUrl: string }, FetchLinkPreviewError>> => {
    const value = typeof raw === "object" && raw !== null && "url" in raw ? raw.url : undefined;
    const url = parseSafeUrl(value);
    if (!url.ok || !url.value.startsWith("https://")) return err("invalid_url");
    if (!(await deps.limiter.allow(`preview:${ownerId}`))) return err("rate_limited");
    const image = await deps.previewer.image(new URL(url.value));
    if (!image.ok) return image;
    return ok({ dataUrl: `data:${image.value.contentType};base64,${toBase64(image.value.bytes)}` });
  };
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(binary);
}

export const PREVIEW_MESSAGES: Readonly<Record<FetchLinkPreviewError, string>> = {
  invalid_url: "Pegá primero la URL del artículo (https://…).",
  rate_limited: "Pediste muchas vistas previas seguidas. Esperá un minuto y probá de nuevo.",
  blocked: "Esa dirección no es un sitio público: no podemos traer su vista previa.",
  unreachable: "El sitio no respondió a tiempo. Podés escribir el título a mano.",
  not_a_page: "Esa dirección no es una página web.",
  empty: "La página no tiene título ni descripción para mostrar.",
  not_an_image: "La imagen del artículo no es una JPEG, PNG, WebP o GIF que podamos usar.",
};
