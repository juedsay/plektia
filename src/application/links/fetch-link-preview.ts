import type {
  LinkPreview,
  LinkPreviewError,
  LinkPreviewer,
} from "@/application/ports/link-previewer";
import type { RateLimiter } from "@/application/ports/rate-limiter";
import { parseSafeUrl } from "@/domain/safe-url";
import { err, type Result } from "@/domain/result";

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

export const PREVIEW_MESSAGES: Readonly<Record<FetchLinkPreviewError, string>> = {
  invalid_url: "Pegá primero la URL del artículo (https://…).",
  rate_limited: "Pediste muchas vistas previas seguidas. Esperá un minuto y probá de nuevo.",
  blocked: "Esa dirección no es un sitio público: no podemos traer su vista previa.",
  unreachable: "El sitio no respondió a tiempo. Podés escribir el título a mano.",
  not_a_page: "Esa dirección no es una página web.",
  empty: "La página no tiene título ni descripción para mostrar.",
};
