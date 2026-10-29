import { describe, expect, it } from "vitest";

import type { PublicPage, PublicPageReader } from "@/application/ports/public-page-reader";
import { getPublicPage } from "@/application/public/get-public-page";
import type { Handle } from "@/domain/handle";

const page: PublicPage = {
  handle: "juedsay",
  displayName: "Julián",
  showHandle: true,
  bio: null,
  avatarPath: null,
  theme: "tecnico",
  colorMode: "auto",
  accent: "hueso",
  linkShape: "rows",
  nameFont: "bricolage",
  sections: [],
  unsectionedLinks: [],
};

/** Lector falso que recuerda con qué handles lo llamaron. */
class FakeReader implements PublicPageReader {
  readonly calls: Handle[] = [];
  constructor(private readonly result: PublicPage | null) {}

  getByHandle(handle: Handle): Promise<PublicPage | null> {
    this.calls.push(handle);
    return Promise.resolve(this.result);
  }
}

describe("getPublicPage", () => {
  it("devuelve la página del handle, normalizado", async () => {
    const pages = new FakeReader(page);
    expect(await getPublicPage({ pages })("JuedSay")).toEqual({ ok: true, value: page });
    expect(pages.calls).toEqual(["juedsay"]);
  });

  it("la página oficial se lee de la base aunque su handle esté reservado", async () => {
    const pages = new FakeReader({ ...page, handle: "plektia" });
    expect((await getPublicPage({ pages })("plektia")).ok).toBe(true);
    expect(pages.calls).toEqual(["plektia"]);
  });

  it("un perfil que no existe da not_found", async () => {
    expect(await getPublicPage({ pages: new FakeReader(null) })("nadie")).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it.each(["admin", "a", "con espacios", "../etc/passwd", "", null])(
    "un handle inválido o reservado (%j) no llega a la base",
    async (handle) => {
      const pages = new FakeReader(page);
      expect(await getPublicPage({ pages })(handle)).toEqual({ ok: false, error: "not_found" });
      expect(pages.calls).toEqual([]);
    },
  );
});
