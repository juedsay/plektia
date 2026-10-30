import type {
  LinkPreview,
  LinkPreviewError,
  LinkPreviewer,
  PreviewSourceImage,
} from "@/application/ports/link-previewer";
import { PREVIEW_SOURCE_MAX_BYTES, sniffImageType } from "@/domain/link-preview-image";
import { err, ok, type Result } from "@/domain/result";
import type { OpenWebFetch } from "@/infrastructure/http/open-web-fetch";
import { parsePreviewMeta } from "@/infrastructure/http/preview-meta";

/** Lo que se lee de la página: el `<head>` entra de sobra. */
const HTML_MAX_BYTES = 512 * 1024;

/** Lee la página del artículo con el fetch de la web abierta y toma sus `og:*`. */
export class HttpLinkPreviewer implements LinkPreviewer {
  constructor(private readonly openWeb: OpenWebFetch) {}

  async preview(url: URL): Promise<Result<LinkPreview, LinkPreviewError>> {
    const page = await this.openWeb(url, {
      accept: "text/html,application/xhtml+xml",
      types: ["text/html", "application/xhtml+xml"],
      maxBytes: HTML_MAX_BYTES,
    });
    if (!page.ok) {
      if (page.error === "blocked") return err("blocked");
      return err(page.error === "wrong_type" ? "not_a_page" : "unreachable");
    }
    const html = new TextDecoder().decode(page.value.bytes);
    const meta = parsePreviewMeta(html, page.value.finalUrl);
    if (!meta.title && !meta.description) return err("empty");
    return ok(meta);
  }

  async image(url: URL): Promise<Result<PreviewSourceImage, LinkPreviewError>> {
    const file = await this.openWeb(url, {
      accept: "image/webp,image/png,image/jpeg,image/gif",
      types: ["image/"],
      maxBytes: PREVIEW_SOURCE_MAX_BYTES,
    });
    if (!file.ok) {
      if (file.error === "blocked") return err("blocked");
      return err(file.error === "wrong_type" ? "not_an_image" : "unreachable");
    }
    // El tipo lo dicen los bytes, no la cabecera del sitio.
    const contentType = sniffImageType(file.value.bytes);
    return contentType ? ok({ bytes: file.value.bytes, contentType }) : err("not_an_image");
  }
}
