import type {
  LinkPreview,
  LinkPreviewError,
  LinkPreviewer,
} from "@/application/ports/link-previewer";
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
}
