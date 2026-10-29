import { describe, expect, it } from "vitest";

import type { PublicPage } from "@/application/ports/public-page-reader";
import { jsonLd, profileJsonLd } from "@/ui/view/seo";

const link = (url: string, providerHandle: string | null) => ({
  id: "3f0c7c4e-2a8f-4f63-9a3c-1f7f3d1e2b11",
  title: "x",
  url,
  description: null,
  provider: "generic" as const,
  providerHandle,
});

const page: PublicPage = {
  handle: "juedsay",
  displayName: "Julián",
  showHandle: true,
  bio: "Streams y código",
  avatarPath: null,
  theme: "tecnico",
  colorMode: "auto",
  accent: "hueso",
  linkShape: "rows",
  sections: [
    {
      id: "s",
      title: "Redes",
      showTitle: true,
      links: [
        link("https://www.twitch.tv/juedsay", "juedsay"),
        link("https://plektia.app/a", null),
      ],
    },
  ],
  unsectionedLinks: [link("https://github.com/juedsay", "juedsay")],
};
const canonical = new URL("https://app.plektia.workers.dev/juedsay");

describe("jsonLd", () => {
  it("un texto del usuario no puede cerrar el script", () => {
    const out = jsonLd({ bio: "</script><script>alert(1)</script> & <b>" });
    expect(out).not.toMatch(/[<>&]/);
    expect(JSON.parse(out)).toEqual({ bio: "</script><script>alert(1)</script> & <b>" });
  });
});

describe("profileJsonLd", () => {
  it("describe a la persona con sus perfiles en otras plataformas", () => {
    expect(profileJsonLd(page, canonical)).toEqual({
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      url: "https://app.plektia.workers.dev/juedsay",
      mainEntity: {
        "@type": "Person",
        name: "Julián",
        alternateName: "@juedsay",
        description: "Streams y código",
        sameAs: ["https://www.twitch.tv/juedsay", "https://github.com/juedsay"],
      },
    });
  });

  it("sin bio, sin perfiles y con el handle oculto, omite esos campos", () => {
    const bare = { ...page, bio: null, showHandle: false, sections: [], unsectionedLinks: [] };
    expect(profileJsonLd(bare, canonical)["mainEntity"]).toEqual({
      "@type": "Person",
      name: "Julián",
    });
  });
});
