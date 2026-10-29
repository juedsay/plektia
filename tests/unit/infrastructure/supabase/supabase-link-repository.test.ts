import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { LinkDraft } from "@/domain/link";
import type { Database } from "@/infrastructure/supabase/database.types";
import { SupabaseLinkRepository } from "@/infrastructure/supabase/supabase-link-repository";

// Lo que prueba este archivo es la traducción del adaptador: filas ↔ entidades
// y errores de la base ↔ errores del dominio. Que las consultas hagan lo que
// deben contra Postgres lo prueban los tests de integración.

interface Response {
  readonly data: unknown;
  readonly error: { code: string; message: string } | null;
}

/** Cliente falso: cada consulta (from/rpc) consume la siguiente respuesta. */
function repoAnswering(...responses: Response[]) {
  const queue = [...responses];
  const next = (): Response => queue.shift() ?? { data: null, error: null };
  const query = (response: Response) => {
    const builder: Record<string, unknown> = {
      then: (resolve: (value: Response) => unknown) => resolve(response),
    };
    for (const method of [
      "select",
      "insert",
      "update",
      "delete",
      "eq",
      "order",
      "single",
      "maybeSingle",
    ]) {
      builder[method] = () => builder;
    }
    return builder;
  };
  const client = {
    from: () => query(next()),
    rpc: () => Promise.resolve(next()),
  } as unknown as SupabaseClient<Database>;
  return new SupabaseLinkRepository(client, "page-id");
}

const ok = (data: unknown): Response => ({ data, error: null });
const fail = (code: string): Response => ({
  data: null,
  error: { code, message: `error ${code}` },
});

const linkRow = {
  id: "l1",
  section_id: "s1",
  title: "Canal",
  url: "https://plektia.app",
  description: null,
  provider: "youtube",
  provider_handle: "@juedsay",
  tags: ["vivo"],
  visible: true,
  position: 0,
  version: 3,
};
const sectionRow = {
  id: "s1",
  title: "Redes",
  show_title: false,
  visible: true,
  position: 0,
  version: 1,
};

const draft: LinkDraft = {
  title: "Canal",
  url: "https://plektia.app",
  description: null,
  tags: [],
  sectionId: null,
  visible: true,
  provider: "generic",
  providerHandle: null,
  kind: null,
};

describe("SupabaseLinkRepository · lecturas", () => {
  it("convierte las filas a entidades", async () => {
    const own = await repoAnswering(ok([sectionRow]), ok([linkRow])).listOwn();
    expect(own.sections).toEqual([
      { id: "s1", title: "Redes", showTitle: false, visible: true, position: 0, version: 1 },
    ]);
    expect(own.links[0]).toEqual({
      id: "l1",
      sectionId: "s1",
      title: "Canal",
      url: "https://plektia.app",
      description: null,
      provider: "youtube",
      providerHandle: "@juedsay",
      tags: ["vivo"],
      visible: true,
      position: 0,
      version: 3,
    });
  });

  it.each([
    ["las secciones", [fail("XX000"), ok([])]],
    ["los links", [ok([]), fail("XX000")]],
  ])("un error leyendo %s es inesperado y se lanza", async (_caso, responses) => {
    await expect(repoAnswering(...responses).listOwn()).rejects.toThrow(/XX000/);
  });
});

describe("SupabaseLinkRepository · errores de la base", () => {
  it.each([
    ["PL400", "invalid_input"],
    ["PL404", "not_found"],
    ["PL409", "conflict"],
    ["PL429", "limit_reached"],
    ["42501", "forbidden"],
    ["23514", "invalid_input"],
    ["23503", "not_found"],
    ["23P01", "conflict"],
    ["23505", "conflict"],
  ])("%s se traduce a %s", async (code, error) => {
    expect(await repoAnswering(fail(code)).createLink(draft)).toEqual({ ok: false, error });
  });

  it("un error desconocido no se esconde: se lanza", async () => {
    await expect(repoAnswering(fail("08006")).createLink(draft)).rejects.toThrow(/08006/);
  });
});

describe("SupabaseLinkRepository · altas repetidas (con el id del pedido)", () => {
  it("si el link ya existe con ese id, lo devuelve en lugar del error", async () => {
    const result = await repoAnswering(fail("23505"), ok(linkRow)).createLink(draft, "l1");
    expect(result).toMatchObject({ ok: true, value: { id: "l1", version: 3 } });
  });

  it("si el id lo usa algo ajeno (no está en esta página), es conflicto", async () => {
    expect(await repoAnswering(fail("23505"), ok(null)).createLink(draft, "l1")).toEqual({
      ok: false,
      error: "conflict",
    });
  });

  it("con el límite completo por ese mismo alta, también devuelve el existente", async () => {
    const result = await repoAnswering(fail("PL429"), ok(linkRow)).createLink(draft, "l1");
    expect(result).toMatchObject({ ok: true, value: { id: "l1" } });
  });

  it("si falla la búsqueda del existente, el error no se esconde", async () => {
    await expect(
      repoAnswering(fail("23505"), fail("08006")).createLink(draft, "l1"),
    ).rejects.toThrow(/08006/);
  });

  it("lo mismo con las secciones", async () => {
    const sectionDraft = { title: "Redes", showTitle: false, visible: true };
    expect(
      await repoAnswering(fail("23505"), ok(sectionRow)).createSection(sectionDraft, "s1"),
    ).toMatchObject({ ok: true, value: { id: "s1" } });
    expect(await repoAnswering(fail("23505"), ok(null)).createSection(sectionDraft, "s1")).toEqual({
      ok: false,
      error: "conflict",
    });
    await expect(
      repoAnswering(fail("23505"), fail("08006")).createSection(sectionDraft, "s1"),
    ).rejects.toThrow(/08006/);
  });
});

describe("SupabaseLinkRepository · links", () => {
  it("crea un link", async () => {
    const result = await repoAnswering(ok(linkRow)).createLink(draft);
    expect(result.ok && result.value.id).toBe("l1");
  });

  it("crea un link con el id del pedido", async () => {
    const result = await repoAnswering(ok(linkRow)).createLink(draft, "l1");
    expect(result.ok && result.value.id).toBe("l1");
  });

  it("actualiza cuando la versión coincide", async () => {
    const result = await repoAnswering(ok([linkRow])).updateLink("l1", 2, {
      title: "Canal",
      url: "https://plektia.app",
      description: null,
      tags: [],
      visible: true,
      provider: "generic",
      providerHandle: null,
    });
    expect(result.ok && result.value.version).toBe(3);
  });

  it("0 filas y el link existe: conflict", async () => {
    expect(
      await repoAnswering(ok([]), ok({ id: "l1" })).updateLink("l1", 1, { title: "x" }),
    ).toEqual({
      ok: false,
      error: "conflict",
    });
  });

  it("0 filas y el link no existe: not_found", async () => {
    expect(await repoAnswering(ok([]), ok(null)).updateLink("l1", 1, { title: "x" })).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("si falla la verificación posterior, se lanza", async () => {
    await expect(
      repoAnswering(ok([]), fail("XX000")).updateLink("l1", 1, { title: "x" }),
    ).rejects.toThrow();
  });

  it("un error de la base al actualizar se traduce", async () => {
    expect(await repoAnswering(fail("23514")).updateLink("l1", 1, { title: "x" })).toEqual({
      ok: false,
      error: "invalid_input",
    });
  });

  it("borra, y distingue conflict de not_found", async () => {
    expect(await repoAnswering(ok([{ id: "l1" }])).deleteLink("l1", 1)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await repoAnswering(ok([]), ok({ id: "l1" })).deleteLink("l1", 1)).toEqual({
      ok: false,
      error: "conflict",
    });
    expect(await repoAnswering(fail("42501")).deleteLink("l1", 1)).toEqual({
      ok: false,
      error: "forbidden",
    });
  });

  it("mueve links y traduce los rechazos de la RPC", async () => {
    expect(await repoAnswering(ok(null)).moveLinks(null, [{ id: "l1", version: 1 }])).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await repoAnswering(fail("PL400")).moveLinks("s1", [])).toEqual({
      ok: false,
      error: "invalid_input",
    });
  });
});

describe("SupabaseLinkRepository · secciones", () => {
  const sectionDraft = { title: "Redes", showTitle: true, visible: true };

  it("crea y traduce el límite", async () => {
    expect((await repoAnswering(ok(sectionRow)).createSection(sectionDraft)).ok).toBe(true);
    expect(await repoAnswering(fail("PL429")).createSection(sectionDraft)).toEqual({
      ok: false,
      error: "limit_reached",
    });
  });

  it("actualiza y detecta conflictos", async () => {
    const patch = { title: "Redes", showTitle: true, visible: false };
    expect((await repoAnswering(ok([sectionRow])).updateSection("s1", 1, patch)).ok).toBe(true);
    expect(await repoAnswering(ok([]), ok({ id: "s1" })).updateSection("s1", 1, patch)).toEqual({
      ok: false,
      error: "conflict",
    });
    expect(await repoAnswering(fail("42501")).updateSection("s1", 1, patch)).toEqual({
      ok: false,
      error: "forbidden",
    });
  });

  it("borra y detecta lo que no existe", async () => {
    expect(await repoAnswering(ok([{ id: "s1" }])).deleteSection("s1", 1)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await repoAnswering(ok([]), ok(null)).deleteSection("s1", 1)).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await repoAnswering(fail("PL409")).deleteSection("s1", 1)).toEqual({
      ok: false,
      error: "conflict",
    });
  });

  it("reordena y traduce los rechazos", async () => {
    expect(await repoAnswering(ok(null)).reorderSections([{ id: "s1", version: 1 }])).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await repoAnswering(fail("PL409")).reorderSections([])).toEqual({
      ok: false,
      error: "conflict",
    });
  });
});
