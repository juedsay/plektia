// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import type { PublicPage } from "@/application/ports/public-page-reader";
import { DRAFT_PARAM, draftPreviewUrl, withDraft } from "@/ui/view/page-draft";

const PAGE: PublicPage = {
  handle: "juedsay",
  displayName: "Julián",
  showHandle: true,
  bio: "Hola",
  avatarPath: null,
  theme: "tecnico",
  colorMode: "auto",
  accent: "hueso",
  linkShape: "rows",
  nameFont: "bricolage",
  sections: [],
  unsectionedLinks: [],
};

const draft = (values: Record<string, string>) =>
  new URLSearchParams({ [DRAFT_PARAM]: "", ...values });

describe("withDraft", () => {
  it("sin la marca de borrador, la página como está guardada", () => {
    expect(withDraft(PAGE, new URLSearchParams({ theme: "punto" }))).toBe(PAGE);
  });

  it("aplica lo que trae el formulario", () => {
    const shown = withDraft(
      PAGE,
      draft({
        displayName: "Juli",
        bio: "Otra bio",
        theme: "punto",
        colorMode: "dark",
        accent: "coral",
        linkShape: "pills",
        nameFont: "fraunces",
        showHandle: "on",
      }),
    );
    expect(shown).toMatchObject({
      displayName: "Juli",
      bio: "Otra bio",
      theme: "punto",
      colorMode: "dark",
      accent: "coral",
      linkShape: "pills",
      nameFont: "fraunces",
      showHandle: true,
    });
    expect(shown.handle).toBe("juedsay");
  });

  it("un checkbox sin marcar no viaja: oculta el @handle", () => {
    expect(withDraft(PAGE, draft({ theme: "tecnico" })).showHandle).toBe(false);
  });

  it("un campo inválido queda como está guardado; el resto se aplica", () => {
    const shown = withDraft(PAGE, draft({ displayName: "", theme: "punto", showHandle: "on" }));
    expect(shown.displayName).toBe("Julián");
    expect(shown.theme).toBe("punto");
  });

  it("un estilo que no existe o no está disponible no se aplica", () => {
    expect(withDraft(PAGE, draft({ theme: "inventado", showHandle: "on" })).theme).toBe("tecnico");
  });

  it("una bio vacía la saca", () => {
    expect(withDraft(PAGE, draft({ bio: "", showHandle: "on" })).bio).toBeNull();
  });
});

describe("draftPreviewUrl", () => {
  it("lleva la marca y solo los campos que cambian cómo se ve", () => {
    const form = new FormData();
    form.set("pageId", "11111111-1111-4111-8111-111111111111");
    form.set("theme", "punto");
    form.set("displayName", "Juli & co");
    const url = new URL(draftPreviewUrl("/admin/vista-previa", form), "https://plektia.test");
    expect(url.pathname).toBe("/admin/vista-previa");
    expect(url.searchParams.has(DRAFT_PARAM)).toBe(true);
    expect(url.searchParams.get("theme")).toBe("punto");
    expect(url.searchParams.get("displayName")).toBe("Juli & co");
    expect(url.searchParams.has("pageId")).toBe(false);
  });
});
