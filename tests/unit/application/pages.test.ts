import { beforeEach, describe, expect, it } from "vitest";

import { createPage } from "@/application/pages/create-page";
import { listPages } from "@/application/pages/list-pages";
import { selectPage } from "@/application/pages/select-page";
import { updatePageSettings } from "@/application/pages/update-page-settings";
import { PAGE_LIMIT } from "@/domain/page";

import { InMemoryPageRepository } from "./fakes/in-memory-page-repository";
import { RecordingPageCache } from "./fakes/recording-page-cache";

let repo: InMemoryPageRepository;
let cache: RecordingPageCache;

beforeEach(() => {
  repo = new InMemoryPageRepository();
  cache = new RecordingPageCache();
});

async function created(handle: string): Promise<string> {
  const result = await createPage({ pages: repo, cache })({ handle, displayName: handle });
  if (!result.ok) throw new Error(`no se pudo crear ${handle}`);
  return result.value.id;
}

describe("createPage", () => {
  it("valida y guarda", async () => {
    const result = await createPage({ pages: repo, cache })({
      handle: "  JuedSay-Pro ",
      displayName: " Juedsay Pro ",
    });
    expect(result).toMatchObject({
      ok: true,
      value: { handle: "juedsay-pro", displayName: "Juedsay Pro" },
    });
  });

  it.each([
    [{ handle: "ab", displayName: "x" }, "handle"],
    [{ handle: "con--doble", displayName: "x" }, "handle"],
    [{ handle: "-borde", displayName: "x" }, "handle"],
    [{ handle: "valido", displayName: "" }, "displayName"],
    [{ handle: "valido", displayName: "Nombre‮" }, "displayName"],
  ])("rechaza %o sin tocar el repositorio", async (input, field) => {
    const result = await createPage({ pages: repo, cache })(input);
    expect(result).toMatchObject({ ok: false, error: { kind: "invalid_input" } });
    if (!result.ok && typeof result.error === "object") {
      expect(Object.keys(result.error.fields)).toEqual([field]);
    }
    expect(repo.pages).toHaveLength(0);
  });

  it("un handle reservado lo dice", async () => {
    const result = await createPage({ pages: repo, cache })({ handle: "Login", displayName: "x" });
    expect(result).toEqual({
      ok: false,
      error: { kind: "invalid_input", fields: { handle: "Ese nombre de usuario está reservado." } },
    });
  });

  it("un handle usado por otra página es un error del campo", async () => {
    repo.takenHandles.add("ocupado");
    const result = await createPage({ pages: repo, cache })({
      handle: "ocupado",
      displayName: "x",
    });
    expect(result).toEqual({
      ok: false,
      error: {
        kind: "invalid_input",
        fields: { handle: "Ese nombre de usuario ya lo usa otra página." },
      },
    });
  });

  it("al crearla purga su handle (pudo quedar un 404 en caché) y el sitio (sitemap)", async () => {
    await created("nueva-pagina");
    expect(cache.purged).toEqual(["profile:nueva-pagina", "site"]);
  });

  it("si no se crea, no purga nada", async () => {
    await createPage({ pages: repo, cache })({ handle: "login", displayName: "x" });
    expect(cache.purged).toEqual([]);
  });

  it(`pasado el límite de ${String(PAGE_LIMIT)} devuelve limit_reached`, async () => {
    for (const handle of ["uno-1", "dos-2", "tres-3"]) await created(handle);
    expect(
      await createPage({ pages: repo, cache })({ handle: "cuatro", displayName: "x" }),
    ).toEqual({
      ok: false,
      error: "limit_reached",
    });
    expect(repo.pages).toHaveLength(PAGE_LIMIT);
  });

  describe("con el id del pedido (doble envío del formulario)", () => {
    const REQUEST_ID = "7d3e2f1a-0b9c-4d8e-a7f6-5e4d3c2b1a09";
    const input = { id: REQUEST_ID, handle: "repetida", displayName: "Repetida" };

    it("el segundo envío devuelve la misma página, sin error de handle ni duplicado", async () => {
      const first = await createPage({ pages: repo, cache })(input);
      const second = await createPage({ pages: repo, cache })(input);
      expect(first).toMatchObject({ ok: true, value: { id: REQUEST_ID } });
      expect(second).toEqual(first);
      expect(repo.pages).toHaveLength(1);
    });

    it("aunque esa página haya completado el límite", async () => {
      await created("uno-1");
      await created("dos-2");
      await createPage({ pages: repo, cache })(input);
      expect(await createPage({ pages: repo, cache })(input)).toMatchObject({
        ok: true,
        value: { id: REQUEST_ID },
      });
    });

    it("si los dos envíos llegan a la vez, el que pierde devuelve la del otro", async () => {
      repo.createdByConcurrentRequest = {
        id: REQUEST_ID,
        handle: "repetida",
        displayName: "Repetida",
        bio: null,
        theme: "tecnico",
        colorMode: "auto",
        accent: "hueso",
        linkShape: "rows",
        nameFont: "bricolage",
        showHandle: true,
        avatarPath: null,
      };
      expect(await createPage({ pages: repo, cache })(input)).toMatchObject({
        ok: true,
        value: { id: REQUEST_ID },
      });
      expect(repo.pages).toHaveLength(1);
    });

    it("un id que no es un UUID se rechaza sin crear nada", async () => {
      const result = await createPage({ pages: repo, cache })({ ...input, id: "no-uuid" });
      expect(result).toMatchObject({ ok: false, error: { kind: "invalid_input" } });
      expect(repo.pages).toHaveLength(0);
    });
  });
});

describe("listPages", () => {
  it("sin última página usada, la actual es la primera que se creó", async () => {
    const first = await created("primera");
    await created("segunda");
    expect(await listPages({ pages: repo })()).toMatchObject({ currentPageId: first });
  });

  it("abre la última página usada", async () => {
    await created("primera");
    const second = await created("segunda");
    repo.lastUsed = second;
    expect((await listPages({ pages: repo })()).currentPageId).toBe(second);
  });

  it("si la última usada ya no está, vuelve a la primera", async () => {
    const first = await created("primera");
    repo.lastUsed = "00000000-0000-4000-8000-999999999999";
    expect((await listPages({ pages: repo })()).currentPageId).toBe(first);
  });

  it("sin páginas no hay actual", async () => {
    expect(await listPages({ pages: repo })()).toEqual({ pages: [], currentPageId: null });
  });
});

describe("selectPage", () => {
  it("recuerda la página elegida", async () => {
    await created("primera");
    const second = await created("segunda");
    expect(await selectPage({ pages: repo })({ pageId: second })).toEqual({
      ok: true,
      value: undefined,
    });
    expect((await listPages({ pages: repo })()).currentPageId).toBe(second);
  });

  it("rechaza un id inválido sin tocar el repositorio", async () => {
    const result = await selectPage({ pages: repo })({ pageId: "no-es-un-uuid" });
    expect(result.ok).toBe(false);
    expect(repo.lastUsed).toBeNull();
  });

  it("una página que no es propia da not_found", async () => {
    expect(
      await selectPage({ pages: repo })({ pageId: "00000000-0000-4000-8000-999999999999" }),
    ).toEqual({ ok: false, error: "not_found" });
  });
});

describe("updatePageSettings", () => {
  const settings = { displayName: "Julián", bio: "QA", theme: "tecnico", showHandle: false };

  it("guarda la presentación y purga la página pública", async () => {
    const pageId = await created("primera");
    cache.purged.length = 0;
    expect(await updatePageSettings({ pages: repo, cache })({ pageId, ...settings })).toMatchObject(
      {
        ok: true,
        value: { handle: "primera", displayName: "Julián", bio: "QA", showHandle: false },
      },
    );
    expect(cache.purged).toEqual(["profile:primera"]);
  });

  it("valida antes de escribir y no purga", async () => {
    const pageId = await created("primera");
    cache.purged.length = 0;
    const result = await updatePageSettings({ pages: repo, cache })({
      pageId,
      ...settings,
      displayName: "",
    });
    expect(result).toMatchObject({ ok: false, error: { kind: "invalid_input" } });
    expect(repo.pages[0]?.displayName).toBe("primera");
    expect(cache.purged).toEqual([]);
  });

  it("una página que no es propia da not_found", async () => {
    expect(
      await updatePageSettings({ pages: repo, cache })({
        pageId: "00000000-0000-4000-8000-999999999999",
        ...settings,
      }),
    ).toEqual({ ok: false, error: "not_found" });
  });

  it("sin id de página es un error de validación", async () => {
    expect(await updatePageSettings({ pages: repo, cache })(settings)).toMatchObject({
      ok: false,
      error: { kind: "invalid_input", fields: { pageId: expect.any(String) as string } },
    });
  });
});
