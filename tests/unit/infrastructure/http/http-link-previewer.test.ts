import { describe, expect, it } from "vitest";

import { err, ok } from "@/domain/result";
import { HttpLinkPreviewer } from "@/infrastructure/http/http-link-previewer";
import type { OpenWebFetch } from "@/infrastructure/http/open-web-fetch";

import { PNG_SIGNATURE, SVG_WITH_SCRIPT } from "../../../support/webp";

const answering =
  (bytes: Uint8Array, contentType = "image/png"): OpenWebFetch =>
  (url) =>
    Promise.resolve(ok({ finalUrl: url, contentType, bytes: Uint8Array.from(bytes) }));

describe("HttpLinkPreviewer", () => {
  it("toma los og:* de la página", async () => {
    const html = new TextEncoder().encode('<head><meta property="og:title" content="Nota"></head>');
    const previewer = new HttpLinkPreviewer(answering(html, "text/html"));
    expect(await previewer.preview(new URL("https://ejemplo.com/nota"))).toEqual(
      ok({ title: "Nota", description: null, imageUrl: null }),
    );
  });

  it("una página sin título ni descripción es `empty`", async () => {
    const previewer = new HttpLinkPreviewer(
      answering(new TextEncoder().encode("<p>"), "text/html"),
    );
    expect(await previewer.preview(new URL("https://ejemplo.com/"))).toEqual(err("empty"));
  });

  it("la imagen sale con el tipo de sus bytes, no el de la cabecera", async () => {
    const previewer = new HttpLinkPreviewer(answering(PNG_SIGNATURE, "image/jpeg"));
    const result = await previewer.image(new URL("https://ejemplo.com/a.jpg"));
    expect(result.ok && result.value.contentType).toBe("image/png");
  });

  it("un SVG que dice ser imagen no se usa", async () => {
    const previewer = new HttpLinkPreviewer(answering(SVG_WITH_SCRIPT, "image/svg+xml"));
    expect(await previewer.image(new URL("https://ejemplo.com/a.svg"))).toEqual(
      err("not_an_image"),
    );
  });

  it("un destino bloqueado se informa como tal", async () => {
    const previewer = new HttpLinkPreviewer(() => Promise.resolve(err("blocked")));
    expect(await previewer.image(new URL("https://ejemplo.com/a.png"))).toEqual(err("blocked"));
    expect(await previewer.preview(new URL("https://ejemplo.com/"))).toEqual(err("blocked"));
  });
});
