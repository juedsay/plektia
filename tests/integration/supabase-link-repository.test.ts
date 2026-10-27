import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Link } from "@/application/ports/link-repository";
import { parseLinkInput } from "@/domain/link";
import type { Database } from "@/infrastructure/supabase/database.types";
import { SupabaseLinkRepository } from "@/infrastructure/supabase/supabase-link-repository";

import { clientFor } from "./session-client";

// El miembro del seed: así los tests no tocan los datos del owner. En el seed,
// la primera página de cada usuario tiene su mismo id.
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";
const OWNER_ID = "11111111-1111-4111-8111-111111111111";

let client: SupabaseClient<Database>;
let repo: SupabaseLinkRepository;
// El owner tiene su propia sección y su link: los "ajenos" para el miembro.
let ownerClient: SupabaseClient<Database>;
let foreignSectionId: string;
let foreignLinkId: string;

async function clean(): Promise<void> {
  await client.from("links").delete().eq("owner_id", MEMBER_ID);
  await client.from("sections").delete().eq("owner_id", MEMBER_ID);
}

async function newLink(title: string, sectionId: string | null = null): Promise<Link> {
  const draft = parseLinkInput({ title, url: `https://plektia.app/${title}`, sectionId });
  if (!draft.ok) throw new Error("draft inválido");
  const result = await repo.createLink(draft.value);
  if (!result.ok) throw new Error(`no se pudo crear: ${result.error}`);
  return result.value;
}

describe("SupabaseLinkRepository contra Supabase local", () => {
  beforeAll(async () => {
    client = await clientFor("member@plektia.test");
    repo = new SupabaseLinkRepository(client, MEMBER_ID);

    ownerClient = await clientFor("owner@plektia.test");
    const section = await ownerClient
      .from("sections")
      .insert({ page_id: OWNER_ID, title: "Del owner" })
      .select("id")
      .single();
    const link = await ownerClient
      .from("links")
      .insert({
        page_id: OWNER_ID,
        title: "Del owner",
        url: "https://plektia.app/owner",
        visible: false,
      })
      .select("id")
      .single();
    if (section.error || link.error) {
      throw new Error(
        `no se pudieron crear los datos del owner: ${(section.error ?? link.error)?.message ?? ""}`,
      );
    }
    foreignSectionId = section.data.id;
    foreignLinkId = link.data.id;
  });

  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await ownerClient.from("links").delete().eq("id", foreignLinkId);
    await ownerClient.from("sections").delete().eq("id", foreignSectionId);
  });

  describe("altas idempotentes (el id lo elige el panel)", () => {
    const LINK_ID = "c0ffee00-0000-4000-8000-000000000001";
    const SECTION_ID = "c0ffee00-0000-4000-8000-000000000002";

    it("el mismo alta de link dos veces devuelve el mismo link y no lo duplica", async () => {
      const draft = parseLinkInput({ title: "Una vez", url: "https://plektia.app/una-vez" });
      if (!draft.ok) throw new Error("draft inválido");
      const first = await repo.createLink(draft.value, LINK_ID);
      const second = await repo.createLink(draft.value, LINK_ID);
      expect(first).toMatchObject({ ok: true, value: { id: LINK_ID } });
      expect(second).toEqual(first);
      expect((await repo.listOwn()).links.filter((link) => link.id === LINK_ID)).toHaveLength(1);
    });

    it("la misma alta de sección dos veces devuelve la misma sección", async () => {
      const draft = { title: "Una vez", showTitle: true, visible: true };
      const first = await repo.createSection(draft, SECTION_ID);
      const second = await repo.createSection(draft, SECTION_ID);
      expect(first).toMatchObject({ ok: true, value: { id: SECTION_ID } });
      expect(second).toEqual(first);
      expect((await repo.listOwn()).sections).toHaveLength(1);
    });

    it("un id que ya usa algo de otra cuenta es conflicto, sin revelarlo", async () => {
      const draft = parseLinkInput({ title: "Robado", url: "https://plektia.app/robado" });
      if (!draft.ok) throw new Error("draft inválido");
      expect(await repo.createLink(draft.value, foreignLinkId)).toEqual({
        ok: false,
        error: "conflict",
      });
    });
  });

  it("crea secciones y links y los lista en orden", async () => {
    const section = await repo.createSection({ title: "Redes", showTitle: true, visible: true });
    expect(section.ok).toBe(true);
    const sectionId = section.ok ? section.value.id : null;
    await newLink("a", sectionId);
    await newLink("b", sectionId);
    await newLink("suelto");

    const own = await repo.listOwn();
    expect(own.sections.map((section) => section.title)).toEqual(["Redes"]);
    expect(
      own.links
        .filter((link) => link.sectionId === sectionId)
        .map((link) => [link.title, link.position]),
    ).toEqual([
      ["a", 0],
      ["b", 1],
    ]);
  });

  it("dos ediciones con la misma versión: la segunda da conflict y no pisa a la primera", async () => {
    const link = await newLink("concurrente");
    const [panel, mcp] = await Promise.all([
      repo.updateLink(link.id, link.version, { title: "desde el panel" }),
      repo.updateLink(link.id, link.version, { title: "desde el MCP" }),
    ]);
    const results = [panel, mcp];
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, error: "conflict" }]);

    const { links } = await repo.listOwn();
    const winner = results.find((result) => result.ok);
    expect(links[0]?.title).toBe(winner?.ok ? winner.value.title : "?");
    expect(links[0]?.version).toBe(2);
  });

  it("un id inexistente da not_found (no conflict)", async () => {
    const result = await repo.updateLink("00000000-0000-4000-8000-000000000000", 1, { title: "x" });
    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("no puede tocar los links de otro usuario (aunque sepa el id): para él no existen", async () => {
    expect(await repo.updateLink(foreignLinkId, 1, { title: "x" })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await repo.deleteLink(foreignLinkId, 1)).toEqual({ ok: false, error: "not_found" });
    const { data } = await ownerClient
      .from("links")
      .select("title")
      .eq("id", foreignLinkId)
      .single();
    expect(data?.title).toBe("Del owner");
  });

  it("no puede meter un link en la sección de otro usuario", async () => {
    const draft = parseLinkInput({
      title: "colado",
      url: "https://plektia.app",
      sectionId: foreignSectionId,
    });
    if (!draft.ok) throw new Error("draft inválido");
    expect(await repo.createLink(draft.value)).toEqual({ ok: false, error: "not_found" });
  });

  it("no ve los links ocultos de otro usuario ni los suma a los suyos", async () => {
    const { data } = await client.from("links").select("id").eq("id", foreignLinkId);
    expect(data).toEqual([]);
    expect((await repo.listOwn()).links.some((link) => link.id === foreignLinkId)).toBe(false);
  });

  it("reordena 20 links al azar 10 veces sin repetidos ni huecos", async () => {
    const created: Link[] = [];
    for (let i = 0; i < 20; i++) created.push(await newLink(`r${String(i)}`));

    for (let round = 0; round < 10; round++) {
      const { links } = await repo.listOwn();
      const shuffled = [...links].sort(() => Math.random() - 0.5);
      const moved = await repo.moveLinks(
        null,
        shuffled.map((link) => ({ id: link.id, version: link.version })),
      );
      expect(moved).toEqual({ ok: true, value: undefined });

      const after = (await repo.listOwn()).links;
      expect(after.map((link) => link.id)).toEqual(shuffled.map((link) => link.id));
      expect(after.map((link) => link.position)).toEqual([...Array(20).keys()]);
    }
  });

  it("una lista de orden con versiones viejas da conflict", async () => {
    const linkA = await newLink("a");
    const linkB = await newLink("b");
    await repo.updateLink(linkA.id, linkA.version, { title: "a2" });
    const result = await repo.moveLinks(null, [
      { id: linkB.id, version: linkB.version },
      { id: linkA.id, version: linkA.version },
    ]);
    expect(result).toEqual({ ok: false, error: "conflict" });
  });

  it("al borrar una sección sus links pasan a 'Sin sección'", async () => {
    const section = await repo.createSection({ title: "Temporal", showTitle: true, visible: true });
    if (!section.ok) throw new Error("sin sección");
    await newLink("suelto");
    await newLink("adentro", section.value.id);

    expect(await repo.deleteSection(section.value.id, section.value.version)).toEqual({
      ok: true,
      value: undefined,
    });
    const { links, sections } = await repo.listOwn();
    expect(sections).toHaveLength(0);
    expect(links.map((link) => [link.title, link.sectionId, link.position])).toEqual([
      ["suelto", null, 0],
      ["adentro", null, 1],
    ]);
  });

  it("reordena secciones y detecta conflictos", async () => {
    const sectionA = await repo.createSection({ title: "A", showTitle: true, visible: true });
    const sectionB = await repo.createSection({ title: "B", showTitle: true, visible: true });
    if (!sectionA.ok || !sectionB.ok) throw new Error("sin secciones");
    expect(
      await repo.reorderSections([
        { id: sectionB.value.id, version: sectionB.value.version },
        { id: sectionA.value.id, version: sectionA.value.version },
      ]),
    ).toEqual({ ok: true, value: undefined });
    expect((await repo.listOwn()).sections.map((section) => section.title)).toEqual(["B", "A"]);

    expect(
      await repo.updateSection(sectionA.value.id, sectionA.value.version, { title: "viejo" }),
    ).toEqual({
      ok: false,
      error: "conflict",
    });
  });

  it("una URL peligrosa la frena la base aunque se saltee el dominio", async () => {
    const result = await repo.createLink({
      title: "XSS",
      url: "javascript:alert(1)",
      description: null,
      tags: [],
      sectionId: null,
      visible: true,
      provider: "generic",
      providerHandle: null,
    });
    expect(result).toEqual({ ok: false, error: "invalid_input" });
  });

  it("dos páginas de la misma cuenta: cada una con sus secciones y sus links", async () => {
    const page = await client
      .from("pages")
      .insert({ handle: "miembro-demo-dos", display_name: "Segunda" })
      .select("id")
      .single();
    if (page.error) throw new Error(`no se pudo crear la página: ${page.error.message}`);
    const secondRepo = new SupabaseLinkRepository(client, page.data.id);
    try {
      await newLink("de-la-primera");
      const section = await secondRepo.createSection({
        title: "Trabajo",
        showTitle: true,
        visible: true,
      });
      if (!section.ok) throw new Error("sin sección");
      const draft = parseLinkInput({
        title: "de-la-segunda",
        url: "https://plektia.app/segunda",
        sectionId: section.value.id,
      });
      if (!draft.ok) throw new Error("draft inválido");
      expect((await secondRepo.createLink(draft.value)).ok).toBe(true);

      const first = await repo.listOwn();
      const second = await secondRepo.listOwn();
      expect(first.links.map((link) => link.title)).toEqual(["de-la-primera"]);
      expect(first.sections).toEqual([]);
      expect(second.links.map((link) => [link.title, link.position])).toEqual([
        ["de-la-segunda", 0],
      ]);
      expect(second.sections.map((sectionOfPage) => sectionOfPage.title)).toEqual(["Trabajo"]);

      // Atado a una página, el repositorio no edita ni borra lo de otra página
      // de la misma cuenta, aunque la RLS (por dueño) lo permitiría.
      const [linkOfFirstPage] = first.links;
      if (!linkOfFirstPage) throw new Error("sin link en la primera página");
      expect(
        await secondRepo.updateLink(linkOfFirstPage.id, linkOfFirstPage.version, { title: "x" }),
      ).toEqual({ ok: false, error: "not_found" });
      expect(await secondRepo.deleteLink(linkOfFirstPage.id, linkOfFirstPage.version)).toEqual({
        ok: false,
        error: "not_found",
      });
      const [sectionOfSecondPage] = second.sections;
      if (!sectionOfSecondPage) throw new Error("sin sección en la segunda página");
      expect(await repo.deleteSection(sectionOfSecondPage.id, sectionOfSecondPage.version)).toEqual(
        { ok: false, error: "not_found" },
      );
      expect((await repo.listOwn()).links.map((link) => link.title)).toEqual(["de-la-primera"]);

      // La sección de una página no sirve para un link de la otra.
      const crossed = parseLinkInput({
        title: "cruzado",
        url: "https://plektia.app/cruzado",
        sectionId: section.value.id,
      });
      if (!crossed.ok) throw new Error("draft inválido");
      expect(await repo.createLink(crossed.value)).toEqual({ ok: false, error: "not_found" });
    } finally {
      await client.from("pages").delete().eq("id", page.data.id);
    }
  });

  it("no puede escribir en la página de otro usuario", async () => {
    const foreignRepo = new SupabaseLinkRepository(client, OWNER_ID);
    expect(
      await foreignRepo.createSection({ title: "Colada", showTitle: true, visible: true }),
    ).toEqual({ ok: false, error: "not_found" });
    expect((await foreignRepo.listOwn()).links.some((link) => link.id === foreignLinkId)).toBe(
      false,
    );
  });
});
