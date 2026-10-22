import { describe, expect, it } from "vitest";

import { displayUrl, shareTargets } from "@/ui/view/share-targets";

const url = "https://app.plektia.workers.dev/juedsay";
const title = "Julián · Plektia";

describe("shareTargets", () => {
  const byId = Object.fromEntries(shareTargets(url, title).map((t) => [t.id, t.href]));

  it("arma la URL de cada destino con el link codificado", () => {
    const encoded = encodeURIComponent(url);
    expect(byId["whatsapp"]).toBe(`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`);
    expect(byId["x"]).toBe(
      `https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encoded}`,
    );
    expect(byId["facebook"]).toBe(`https://www.facebook.com/sharer/sharer.php?u=${encoded}`);
    expect(byId["linkedin"]).toBe(`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`);
    expect(byId["telegram"]).toBe(
      `https://t.me/share/url?url=${encoded}&text=${encodeURIComponent(title)}`,
    );
    expect(byId["email"]).toBe(`mailto:?subject=${encodeURIComponent(title)}&body=${encoded}`);
  });

  it("un título con caracteres especiales no rompe la URL ni inyecta parámetros", () => {
    const targets = shareTargets(url, 'a&b=c "<script>" #x');
    for (const target of targets) {
      expect(target.href).not.toMatch(/[\s"<>#]/);
      expect(target.href).not.toContain("&b=c");
    }
  });

  it("todos van a https, salvo el email", () => {
    for (const target of shareTargets(url, title)) {
      expect(target.href).toMatch(target.id === "email" ? /^mailto:\?/ : /^https:\/\//);
    }
  });
});

describe("displayUrl", () => {
  it.each([
    ["https://app.plektia.workers.dev/juedsay", "app.plektia.workers.dev/juedsay"],
    ["https://app.plektia.workers.dev/", "app.plektia.workers.dev"],
  ])("%s → %s", (input, expected) => {
    expect(displayUrl(input)).toBe(expected);
  });
});
