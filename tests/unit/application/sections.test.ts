import { beforeEach, describe, expect, it } from "vitest";

import type { Section } from "@/application/ports/link-repository";
import { createSection } from "@/application/sections/create-section";
import { deleteSection } from "@/application/sections/delete-section";
import { reorderSections } from "@/application/sections/reorder-sections";
import { updateSection } from "@/application/sections/update-section";
import { LIMITS } from "@/domain/link";

import { InMemoryLinkRepository } from "./fakes/in-memory-link-repository";

let repo: InMemoryLinkRepository;
let deps: { sections: InMemoryLinkRepository };

beforeEach(() => {
  repo = new InMemoryLinkRepository();
  deps = { sections: repo };
});

async function created(title: string): Promise<Section> {
  const result = await createSection(deps)({ title });
  if (!result.ok) throw new Error("no se pudo crear");
  return result.value;
}

describe("createSection", () => {
  it("valida y guarda", async () => {
    expect(await created("  Redes ")).toMatchObject({
      title: "Redes",
      showTitle: true,
      visible: true,
    });
  });

  it("rechaza un título inválido sin tocar el repositorio", async () => {
    expect((await createSection(deps)({ title: "" })).ok).toBe(false);
    expect(repo.sections).toHaveLength(0);
  });

  it("pasado el límite devuelve limit_reached", async () => {
    for (let i = 0; i < LIMITS.sections; i++) await created(`S${String(i)}`);
    expect(await createSection(deps)({ title: "Una más" })).toEqual({
      ok: false,
      error: "limit_reached",
    });
  });

  it("con el id del pedido, repetirlo (doble clic) no la duplica", async () => {
    const input = { id: "5b2c1d0e-3f4a-4b5c-9d6e-7f8091a2b3c4", title: "Redes" };
    const first = await createSection(deps)(input);
    const second = await createSection(deps)(input);
    expect(second).toEqual(first);
    expect(repo.sections).toHaveLength(1);
  });
});

describe("updateSection", () => {
  it("oculta el título", async () => {
    const section = await created("Redes");
    const result = await updateSection(deps)({
      id: section.id,
      version: 1,
      changes: { showTitle: false },
    });
    expect(result.ok && result.value.showTitle).toBe(false);
  });

  it("con una versión vieja da conflict", async () => {
    const section = await created("Redes");
    await updateSection(deps)({ id: section.id, version: 1, changes: { title: "Uno" } });
    const result = await updateSection(deps)({
      id: section.id,
      version: 1,
      changes: { title: "Dos" },
    });
    expect(result).toEqual({ ok: false, error: "conflict" });
  });

  it("valida el id y los cambios", async () => {
    expect((await updateSection(deps)({ id: "x", version: 1, changes: { title: "a" } })).ok).toBe(
      false,
    );
    const section = await created("Redes");
    expect(
      (await updateSection(deps)({ id: section.id, version: 1, changes: { title: "" } })).ok,
    ).toBe(false);
  });
});

describe("deleteSection", () => {
  it("borra la sección", async () => {
    const section = await created("Redes");
    expect(await deleteSection(deps)({ id: section.id, version: 1 })).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it("borrar otra vez la ya borrada (doble pedido) también sale bien", async () => {
    const section = await created("Redes");
    expect((await deleteSection(deps)({ id: section.id, version: 1 })).ok).toBe(true);
    expect(await deleteSection(deps)({ id: section.id, version: 1 })).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it("con una versión vieja no la borra: alguien la cambió", async () => {
    const section = await created("Redes");
    await updateSection(deps)({ id: section.id, version: 1, changes: { title: "Otra" } });
    expect(await deleteSection(deps)({ id: section.id, version: 1 })).toEqual({
      ok: false,
      error: "conflict",
    });
    expect(repo.sections).toHaveLength(1);
  });

  it("valida el comando", async () => {
    expect((await deleteSection(deps)({ id: "x" })).ok).toBe(false);
  });
});

describe("reorderSections", () => {
  it("deja el orden pedido", async () => {
    const sectionA = await created("A");
    const sectionB = await created("B");
    const result = await reorderSections(deps)({
      items: [
        { id: sectionB.id, version: 1 },
        { id: sectionA.id, version: 1 },
      ],
    });
    expect(result.ok).toBe(true);
    expect((await repo.listOwn()).sections.map((section) => section.title)).toEqual(["B", "A"]);
  });

  it("rechaza una lista que no es una lista", async () => {
    expect((await reorderSections(deps)({ items: "todas" })).ok).toBe(false);
  });
});
