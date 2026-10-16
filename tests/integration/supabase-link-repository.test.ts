import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from "vitest";

import type { Link } from "@/application/ports/link-repository";
import { parseLinkInput } from "@/domain/link";
import type { Database } from "@/infrastructure/supabase/database.types";
import { SupabaseLinkRepository } from "@/infrastructure/supabase/supabase-link-repository";

const supabase = inject("supabase");
// El miembro del seed: así los tests no tocan los datos del owner.
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";

let client: SupabaseClient<Database>;
let repo: SupabaseLinkRepository;
// El owner tiene su propia sección y su link: los "ajenos" para el miembro.
let ownerClient: SupabaseClient<Database>;
let foreignSectionId: string;
let foreignLinkId: string;

/** Cliente con la sesión real de un usuario del seed (API admin de Supabase local). */
async function clientFor(email: string): Promise<SupabaseClient<Database>> {
  const admin = createClient(supabase.url, supabase.secretKey, { auth: { persistSession: false } });
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;
  const anon = createClient(supabase.url, supabase.publishableKey, {
    auth: { persistSession: false },
  });
  const verified = await anon.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "magiclink",
  });
  if (verified.error || !verified.data.session) throw verified.error ?? new Error("sin sesión");
  return createClient<Database>(supabase.url, supabase.publishableKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${verified.data.session.access_token}` } },
  });
}

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
      .insert({ title: "Del owner" })
      .select("id")
      .single();
    const link = await ownerClient
      .from("links")
      .insert({ title: "Del owner", url: "https://plektia.app/owner", visible: false })
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

  it("crea secciones y links y los lista en orden", async () => {
    const section = await repo.createSection({ title: "Redes", showTitle: true, visible: true });
    expect(section.ok).toBe(true);
    const sectionId = section.ok ? section.value.id : null;
    await newLink("a", sectionId);
    await newLink("b", sectionId);
    await newLink("suelto");

    const own = await repo.listOwn();
    expect(own.sections.map((s) => s.title)).toEqual(["Redes"]);
    expect(
      own.links.filter((l) => l.sectionId === sectionId).map((l) => [l.title, l.position]),
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
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, error: "conflict" }]);

    const { links } = await repo.listOwn();
    const winner = results.find((r) => r.ok);
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
    expect((await repo.listOwn()).links.some((l) => l.id === foreignLinkId)).toBe(false);
  });

  it("reordena 20 links al azar 10 veces sin repetidos ni huecos", async () => {
    const created: Link[] = [];
    for (let i = 0; i < 20; i++) created.push(await newLink(`r${String(i)}`));

    for (let round = 0; round < 10; round++) {
      const { links } = await repo.listOwn();
      const shuffled = [...links].sort(() => Math.random() - 0.5);
      const moved = await repo.moveLinks(
        null,
        shuffled.map((l) => ({ id: l.id, version: l.version })),
      );
      expect(moved).toEqual({ ok: true, value: undefined });

      const after = (await repo.listOwn()).links;
      expect(after.map((l) => l.id)).toEqual(shuffled.map((l) => l.id));
      expect(after.map((l) => l.position)).toEqual([...Array(20).keys()]);
    }
  });

  it("una lista de orden con versiones viejas da conflict", async () => {
    const a = await newLink("a");
    const b = await newLink("b");
    await repo.updateLink(a.id, a.version, { title: "a2" });
    const result = await repo.moveLinks(null, [
      { id: b.id, version: b.version },
      { id: a.id, version: a.version },
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
    expect(links.map((l) => [l.title, l.sectionId, l.position])).toEqual([
      ["suelto", null, 0],
      ["adentro", null, 1],
    ]);
  });

  it("reordena secciones y detecta conflictos", async () => {
    const a = await repo.createSection({ title: "A", showTitle: true, visible: true });
    const b = await repo.createSection({ title: "B", showTitle: true, visible: true });
    if (!a.ok || !b.ok) throw new Error("sin secciones");
    expect(
      await repo.reorderSections([
        { id: b.value.id, version: b.value.version },
        { id: a.value.id, version: a.value.version },
      ]),
    ).toEqual({ ok: true, value: undefined });
    expect((await repo.listOwn()).sections.map((s) => s.title)).toEqual(["B", "A"]);

    expect(await repo.updateSection(a.value.id, a.value.version, { title: "viejo" })).toEqual({
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
});
