import { describe, expect, it } from "vitest";

import { robotsTxt, sitemapXml } from "@/ui/view/sitemap";

const origin = "https://app.plektia.workers.dev";

describe("sitemapXml", () => {
  it("lista la landing, la página oficial y un /{handle} por perfil", () => {
    const xml = sitemapXml(origin, ["juedsay", "otra"]);
    expect([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])).toEqual([
      "https://app.plektia.workers.dev/",
      "https://app.plektia.workers.dev/plektia",
      "https://app.plektia.workers.dev/contacto",
      "https://app.plektia.workers.dev/juedsay",
      "https://app.plektia.workers.dev/otra",
    ]);
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
  });

  it("escapa lo que no es XML válido", () => {
    expect(sitemapXml("https://a.test", ["x&y"])).toContain("https://a.test/x&amp;y");
  });
});

describe("robotsTxt", () => {
  it("deja afuera el panel y el login, y apunta al sitemap", () => {
    const robots = robotsTxt(origin);
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /login");
    expect(robots).toContain("Sitemap: https://app.plektia.workers.dev/sitemap.xml");
  });
});
