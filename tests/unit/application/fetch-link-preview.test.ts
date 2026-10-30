import { describe, expect, it } from "vitest";

import { fetchLinkPreview } from "@/application/links/fetch-link-preview";
import type { LinkPreviewer } from "@/application/ports/link-previewer";
import { ok } from "@/domain/result";

const previewer = (): LinkPreviewer & { asked: string[] } => {
  const asked: string[] = [];
  return {
    asked,
    preview: (url) => {
      asked.push(url.href);
      return Promise.resolve(ok({ title: "Nota", description: null, imageUrl: null }));
    },
  };
};
const limiter = (allow: boolean) => ({ allow: () => Promise.resolve(allow) });

describe("fetchLinkPreview", () => {
  it("pide la vista previa de una URL https válida", async () => {
    const fake = previewer();
    const result = await fetchLinkPreview({ previewer: fake, limiter: limiter(true) })("u1", {
      url: "https://ejemplo.com/nota",
    });
    expect(result).toEqual({
      ok: true,
      value: { title: "Nota", description: null, imageUrl: null },
    });
    expect(fake.asked).toEqual(["https://ejemplo.com/nota"]);
  });

  it.each([{}, { url: 3 }, { url: "mailto:a@b.co" }, { url: "javascript:alert(1)" }])(
    "%o no es una URL válida y no pide nada",
    async (input) => {
      const fake = previewer();
      const result = await fetchLinkPreview({ previewer: fake, limiter: limiter(true) })(
        "u1",
        input,
      );
      expect(result).toEqual({ ok: false, error: "invalid_url" });
      expect(fake.asked).toEqual([]);
    },
  );

  it("con el límite agotado no pide nada", async () => {
    const fake = previewer();
    const result = await fetchLinkPreview({ previewer: fake, limiter: limiter(false) })("u1", {
      url: "https://ejemplo.com/nota",
    });
    expect(result).toEqual({ ok: false, error: "rate_limited" });
    expect(fake.asked).toEqual([]);
  });
});
