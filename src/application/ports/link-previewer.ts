import type { Result } from "@/domain/result";

// Vista previa de un artículo (SPEC-link-form, 7c): lo que se toma de su página.

export interface LinkPreview {
  readonly title: string | null;
  readonly description: string | null;
  /** La imagen que declara la página (para 7c-2), o `null`. */
  readonly imageUrl: string | null;
}

/**
 * - `blocked`: el destino no es un sitio público (o es Plektia).
 * - `unreachable`: no respondió, tardó, pesaba demasiado o dio error.
 * - `not_a_page`: respondió algo que no es una página web.
 * - `empty`: la página no tiene título ni descripción.
 */
export type LinkPreviewError = "blocked" | "unreachable" | "not_a_page" | "empty" | "not_an_image";

/** Una imagen del sitio, con el tipo que dicen sus bytes (todavía sin re-codificar). */
export interface PreviewSourceImage {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

export interface LinkPreviewer {
  preview(url: URL): Promise<Result<LinkPreview, LinkPreviewError>>;
  /** La imagen de la vista previa: JPEG, PNG, WebP o GIF por sus bytes, hasta 2 MB. */
  image(url: URL): Promise<Result<PreviewSourceImage, LinkPreviewError>>;
}
