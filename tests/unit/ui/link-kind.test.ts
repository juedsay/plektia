import { describe, expect, it } from "vitest";

import { detectLinkKind, kindOf } from "@/ui/view/link-kind";
import { linkMeta } from "@/ui/view/public-link";

describe("detectLinkKind", () => {
  it.each([
    ["https://www.instagram.com/juedsay", "social"],
    ["https://github.com/juedsay", "social"],
    ["https://www.youtube.com/@juedsay", "social"],
    ["https://www.youtube.com/watch?v=aBcDeFgHiJk", "video"],
    ["https://youtu.be/aBcDeFgHiJk", "video"],
    ["https://www.youtube.com/shorts/aBcDeFgHiJk", "video"],
    ["https://vimeo.com/123456", "video"],
    ["https://www.tiktok.com/@juedsay/video/7312345678", "video"],
    ["https://www.instagram.com/reel/Cx12345", "video"],
    ["https://www.twitch.tv/videos/123456", "video"],
    ["https://medium.com/@juedsay/como-testeo-rls", "article"],
    ["https://juedsay.substack.com/p/novedades", "article"],
    ["https://dev.to/juedsay/testing-rls-with-pgtap-1abc", "article"],
    ["https://plektia.app/blog/lanzamiento", "article"],
    ["https://ejemplo.com/como-testeo-rls-con-pgtap", "article"],
    ["https://www.linkedin.com/pulse/mi-nota-juedsay", "article"],
    ["https://plektia.app/", "site"],
    ["https://github.com/juedsay/plektia", "site"],
    ["https://ejemplo.com/contacto", "site"],
    ["mailto:hola@plektia.app", "site"],
    ["no es una url", "site"],
  ] as const)("%s → %s", (url, kind) => {
    expect(detectLinkKind(url)).toBe(kind);
  });

  it("un host que solo se parece no cuenta: youtube.com.evil.com no es un video", () => {
    expect(detectLinkKind("https://youtube.com.evil.com/watch?v=abc")).toBe("site");
  });
});

describe("kindOf", () => {
  it("lo elegido por el dueño gana sobre lo deducido", () => {
    expect(kindOf({ url: "https://plektia.app/", kind: "article" })).toBe("article");
    expect(kindOf({ url: "https://plektia.app/", kind: null })).toBe("site");
  });
});

describe("linkMeta con el tipo", () => {
  it("un artículo o un video lo dicen adelante", () => {
    expect(
      linkMeta({ url: "https://medium.com/@juedsay/como-testeo-rls", description: null }),
    ).toBe("Artículo · medium.com/@juedsay/como-testeo-rls");
    expect(linkMeta({ url: "https://youtu.be/abc", description: "Mi charla", kind: null })).toBe(
      "Video · Mi charla",
    );
  });

  it("un perfil o un sitio, como siempre", () => {
    expect(linkMeta({ url: "https://www.instagram.com/juedsay", description: null })).toBe(
      "@juedsay",
    );
    expect(linkMeta({ url: "https://plektia.app/", description: null, kind: "site" })).toBe(
      "plektia.app",
    );
  });
});
