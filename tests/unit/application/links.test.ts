import { beforeEach, describe, expect, it } from "vitest";

import { createLink } from "@/application/links/create-link";
import { deleteLink } from "@/application/links/delete-link";
import { moveLinks } from "@/application/links/move-links";
import { setLinkVisibility } from "@/application/links/set-link-visibility";
import { updateLink } from "@/application/links/update-link";
import type { Link } from "@/application/ports/link-repository";
import { LIMITS } from "@/domain/link";

import { InMemoryLinkRepository } from "./fakes/in-memory-link-repository";

let repo: InMemoryLinkRepository;
let deps: { links: InMemoryLinkRepository };

beforeEach(() => {
  repo = new InMemoryLinkRepository();
  deps = { links: repo };
});

async function created(input: Record<string, unknown>): Promise<Link> {
  const result = await createLink(deps)(input);
  if (!result.ok) throw new Error(`no se pudo crear: ${JSON.stringify(result.error)}`);
  return result.value;
}

describe("createLink", () => {
  it("valida, detecta el proveedor y guarda", async () => {
    const link = await created({ title: "Twitch", url: "https://twitch.tv/juedsay" });
    expect(link).toMatchObject({ provider: "twitch", providerHandle: "juedsay", version: 1 });
    expect(repo.links).toHaveLength(1);
  });

  it("no llega al repositorio con datos inválidos", async () => {
    const result = await createLink(deps)({ title: "XSS", url: "javascript:alert(1)" });
    expect(result.ok).toBe(false);
    if (!result.ok && typeof result.error === "object")
      expect(result.error.fields["url"]).toBeDefined();
    expect(repo.links).toHaveLength(0);
  });

  it("pasado el límite devuelve limit_reached", async () => {
    for (let i = 0; i < LIMITS.links; i++)
      await created({ title: `L${String(i)}`, url: "https://plektia.app" });
    const result = await createLink(deps)({ title: "Uno más", url: "https://plektia.app" });
    expect(result).toEqual({ ok: false, error: "limit_reached" });
  });
});

describe("updateLink", () => {
  it("aplica el cambio y vuelve a detectar el proveedor", async () => {
    const link = await created({ title: "Canal", url: "https://plektia.app" });
    const result = await updateLink(deps)({
      id: link.id,
      version: link.version,
      changes: { url: "https://www.youtube.com/@juedsay" },
    });
    expect(result.ok && result.value).toMatchObject({
      provider: "youtube",
      providerHandle: "@juedsay",
      version: 2,
    });
  });

  it("dos ediciones con la misma versión: la segunda da conflict (no pisa a la primera)", async () => {
    const link = await created({ title: "Canal", url: "https://plektia.app" });
    const update = updateLink(deps);
    const first = await update({
      id: link.id,
      version: link.version,
      changes: { title: "Desde el panel" },
    });
    const second = await update({
      id: link.id,
      version: link.version,
      changes: { title: "Desde el MCP" },
    });
    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, error: "conflict" });
    expect(repo.links[0]?.title).toBe("Desde el panel");
  });

  it.each([
    ["sin id", { version: 1, changes: { title: "x" } }, "id"],
    ["con un id inválido", { id: "1 or 1=1", version: 1, changes: { title: "x" } }, "id"],
    [
      "sin versión",
      { id: "00000000-0000-4000-8000-000000000001", changes: { title: "x" } },
      "version",
    ],
    [
      "con versión 0",
      { id: "00000000-0000-4000-8000-000000000001", version: 0, changes: { title: "x" } },
      "version",
    ],
    [
      "sin cambios",
      { id: "00000000-0000-4000-8000-000000000001", version: 1, changes: {} },
      "_form",
    ],
    [
      "con un cambio inválido",
      { id: "00000000-0000-4000-8000-000000000001", version: 1, changes: { url: "data:x" } },
      "url",
    ],
  ])("rechaza un comando %s", async (_caso, input, field) => {
    const result = await updateLink(deps)(input);
    expect(result.ok).toBe(false);
    if (!result.ok && typeof result.error === "object")
      expect(Object.keys(result.error.fields)).toContain(field);
  });

  it("un link que no existe da not_found", async () => {
    const result = await updateLink(deps)({
      id: "00000000-0000-4000-8000-0000000000ff",
      version: 1,
      changes: { title: "x" },
    });
    expect(result).toEqual({ ok: false, error: "not_found" });
  });
});

describe("setLinkVisibility", () => {
  it("oculta un link", async () => {
    const link = await created({ title: "Canal", url: "https://plektia.app" });
    const result = await setLinkVisibility(deps)({ id: link.id, version: 1, visible: false });
    expect(result.ok && result.value.visible).toBe(false);
  });

  it("exige un booleano", async () => {
    const link = await created({ title: "Canal", url: "https://plektia.app" });
    const result = await setLinkVisibility(deps)({ id: link.id, version: 1, visible: "no" });
    expect(result.ok).toBe(false);
  });

  it("valida el id", async () => {
    expect((await setLinkVisibility(deps)({ id: "x", version: 1, visible: true })).ok).toBe(false);
  });
});

describe("deleteLink", () => {
  it("borra con la versión correcta y da conflict con una vieja", async () => {
    const link = await created({ title: "Canal", url: "https://plektia.app" });
    await updateLink(deps)({ id: link.id, version: 1, changes: { title: "Otro" } });
    expect(await deleteLink(deps)({ id: link.id, version: 1 })).toEqual({
      ok: false,
      error: "conflict",
    });
    expect(await deleteLink(deps)({ id: link.id, version: 2 })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(repo.links).toHaveLength(0);
  });

  it("valida el comando", async () => {
    expect((await deleteLink(deps)({})).ok).toBe(false);
  });
});

describe("moveLinks", () => {
  it("deja el grupo en el orden pedido", async () => {
    const linkA = await created({ title: "A", url: "https://plektia.app/a" });
    const linkB = await created({ title: "B", url: "https://plektia.app/b" });
    const result = await moveLinks(deps)({
      sectionId: null,
      items: [
        { id: linkB.id, version: linkB.version },
        { id: linkA.id, version: linkA.version },
      ],
    });
    expect(result.ok).toBe(true);
    const { links } = await repo.listOwn();
    expect(links.map((link) => link.title)).toEqual(["B", "A"]);
  });

  it.each([
    ["una sección inválida", { sectionId: "x", items: [] }],
    ["sin lista", { sectionId: null }],
    [
      "ids repetidos",
      {
        sectionId: null,
        items: [
          { id: "00000000-0000-4000-8000-000000000001", version: 1 },
          { id: "00000000-0000-4000-8000-000000000001", version: 1 },
        ],
      },
    ],
  ])("rechaza %s", async (_caso, input) => {
    expect((await moveLinks(deps)(input)).ok).toBe(false);
  });

  it("una lista incompleta la rechaza el repositorio", async () => {
    const linkA = await created({ title: "A", url: "https://plektia.app/a" });
    await created({ title: "B", url: "https://plektia.app/b" });
    const result = await moveLinks(deps)({
      sectionId: null,
      items: [{ id: linkA.id, version: linkA.version }],
    });
    expect(result).toEqual({ ok: false, error: "invalid_input" });
  });
});
