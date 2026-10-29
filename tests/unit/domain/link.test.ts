import { describe, expect, it } from "vitest";

import { LIMITS, parseLinkInput, parseLinkPatch } from "@/domain/link";

const valid = { title: "Mi canal", url: "https://www.youtube.com/@juedsay" };

describe("parseLinkInput", () => {
  it("normaliza y completa los valores por defecto, con el proveedor detectado", () => {
    expect(parseLinkInput({ ...valid, title: "  Mi canal  " })).toEqual({
      ok: true,
      value: {
        title: "Mi canal",
        url: "https://www.youtube.com/@juedsay",
        description: null,
        tags: [],
        sectionId: null,
        visible: true,
        provider: "youtube",
        providerHandle: "@juedsay",
      },
    });
  });

  it("guarda las etiquetas en minúsculas y sin repetir", () => {
    const result = parseLinkInput({ ...valid, tags: ["Gaming", "gaming", " vivo "] });
    expect(result.ok && result.value.tags).toEqual(["gaming", "vivo"]);
  });

  it("una lista enorme de etiquetas inválidas se rechaza sin recorrerla (GHSA-mrhx-c7xc-m3w5)", () => {
    const huge = Array.from({ length: 100_000 }, () => "NO VÁLIDA");
    const startedAt = performance.now();
    const result = parseLinkInput({ ...valid, tags: huge });
    expect(result).toMatchObject({ ok: false, error: { kind: "invalid_input" } });
    if (!result.ok) {
      // Un solo error para el campo (no uno por elemento) y rápido.
      expect(Object.keys(result.error.fields)).toEqual(["tags"]);
      expect(result.error.fields["tags"]).toBe("Un link puede tener hasta 5 etiquetas.");
    }
    expect(performance.now() - startedAt).toBeLessThan(250);
  });

  it("una descripción vacía queda como null", () => {
    const result = parseLinkInput({ ...valid, description: "   " });
    expect(result.ok && result.value.description).toBeNull();
  });

  it("acepta una sección por su id", () => {
    const sectionId = "3f0c7c4e-2a8f-4f63-9a3c-1f7f3d1e2b10";
    const result = parseLinkInput({ ...valid, sectionId });
    expect(result.ok && result.value.sectionId).toBe(sectionId);
  });

  it.each([
    ["título vacío", { ...valid, title: "   " }, "title"],
    ["título largo", { ...valid, title: "a".repeat(81) }, "title"],
    ["título con salto de línea", { ...valid, title: "Mi\ncanal" }, "title"],
    ["título con carácter nulo", { ...valid, title: "Mi\u0000canal" }, "title"],
    ["título con texto invertido (RLO)", { ...valid, title: "factura\u202efdp.exe" }, "title"],
    ["título con caracteres invisibles", { ...valid, title: "Mi\u200bcanal" }, "title"],
    ["URL javascript", { ...valid, url: "javascript:alert(1)" }, "url"],
    ["URL con credenciales", { ...valid, url: "https://a:b@evil.com" }, "url"],
    ["descripción larga", { ...valid, description: "a".repeat(121) }, "description"],
    ["demasiadas etiquetas", { ...valid, tags: ["a", "b", "c", "d", "e", "f"] }, "tags"],
    ["etiqueta con espacios internos", { ...valid, tags: ["en vivo"] }, "tags"],
    ["etiqueta larga", { ...valid, tags: ["a".repeat(25)] }, "tags"],
    ["sección que no es un uuid", { ...valid, sectionId: "1; drop table links" }, "sectionId"],
    ["visibilidad que no es booleana", { ...valid, visible: "sí" }, "visible"],
  ])("rechaza %s, con el error en el campo", (_caso, input, field) => {
    const result = parseLinkInput(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("invalid_input");
      expect(Object.keys(result.error.fields)).toContain(field);
    }
  });

  it("los errores vienen en español", () => {
    const result = parseLinkInput({ title: "", url: "javascript:alert(1)" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.fields["title"]).toBe("El título no puede estar vacío.");
      expect(result.error.fields["url"]).toBe(
        "La URL tiene que empezar con https:// o mailto: y no puede incluir usuario ni contraseña.",
      );
    }
  });

  it.each([null, undefined, "texto", 42, []])(
    "rechaza una entrada que no es un objeto (%j)",
    (input) => {
      expect(parseLinkInput(input).ok).toBe(false);
    },
  );

  it("ignora campos que no son del link (owner_id, id, version)", () => {
    const result = parseLinkInput({ ...valid, owner_id: "otro", id: "x", version: 9 });
    expect(result.ok && Object.keys(result.value)).not.toContain("owner_id");
  });

  it("documenta los límites del spec", () => {
    expect(LIMITS).toEqual({ sections: 30, links: 200, tags: 5 });
  });
});

describe("parseLinkPatch", () => {
  it("acepta un cambio parcial y vuelve a detectar el proveedor si cambia la URL", () => {
    expect(parseLinkPatch({ url: "https://twitch.tv/JueDsay" })).toEqual({
      ok: true,
      value: { url: "https://twitch.tv/JueDsay", provider: "twitch", providerHandle: "juedsay" },
    });
  });

  it("un cambio sin URL no toca el proveedor", () => {
    expect(parseLinkPatch({ title: "Nuevo" })).toEqual({ ok: true, value: { title: "Nuevo" } });
  });

  it("un cambio vacío es inválido", () => {
    const result = parseLinkPatch({});
    expect(result.ok).toBe(false);
  });

  it("valida igual que la creación", () => {
    expect(parseLinkPatch({ url: "data:text/html,x" }).ok).toBe(false);
  });

  it("cambia dónde se ve el link, solo entre los lugares conocidos", () => {
    expect(parseLinkPatch({ placement: "both" })).toEqual({
      ok: true,
      value: { placement: "both" },
    });
    const result = parseLinkPatch({ placement: "sidebar" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.error.fields)).toEqual(["placement"]);
  });
});
