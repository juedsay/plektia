// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FormResult } from "@/actions/form-result";
import type { Link, OwnLinks, Section } from "@/application/ports/link-repository";
import { errorMessage } from "@/domain/errors";
import { Editor } from "@/ui/islands/editor/Editor";
import type {
  EditorApi,
  LinkChanges,
  NewLink,
  SectionChanges,
} from "@/ui/islands/editor/editor-api";
import { UNDO_WINDOW_MS } from "@/ui/islands/editor/UndoToast";

// jsdom no mide ni observa tamaños: dnd-kit usa ResizeObserver para ordenar.
// Se define antes de los imports (vi.hoisted). El arrastre real (mouse, toque y
// teclado) lo prueban los E2E en un navegador.
vi.hoisted(() => {
  globalThis.ResizeObserver = class {
    observe() {
      return undefined;
    }
    unobserve() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const REDES: Section = {
  id: "s-redes",
  title: "Redes",
  showTitle: true,
  visible: true,
  position: 0,
  version: 1,
};

function link(id: string, extra: Partial<Link> = {}): Link {
  return {
    id,
    sectionId: "s-redes",
    title: id,
    url: `https://plektia.app/${id}`,
    description: null,
    provider: "generic",
    providerHandle: null,
    tags: [],
    visible: true,
    position: 0,
    version: 1,
    ...extra,
  };
}

const failure = (message: string, fields: Record<string, string> = {}): FormResult<Link> => ({
  ok: false,
  message,
  fields,
  values: {},
});

/** Servidor falso: guarda lo que se le pidió y responde con versiones nuevas. */
class FakeApi implements EditorApi {
  content: OwnLinks;
  created: NewLink[] = [];
  updates: { id: string; version: number; changes: LinkChanges }[] = [];
  deleted: string[] = [];
  deletedOnExit: string[] = [];
  /** Si está, la próxima escritura responde esto en lugar de guardar. */
  nextFailure: FormResult<Link> | null = null;

  constructor(content: OwnLinks) {
    this.content = content;
  }

  list() {
    return Promise.resolve(this.content);
  }

  create(newLink: NewLink) {
    this.created.push(newLink);
    const failed = this.takeFailure();
    if (failed) return Promise.resolve(failed);
    const created = link(`nuevo-${String(this.created.length)}`, {
      ...newLink,
      position: this.content.links.length,
    });
    this.content = { ...this.content, links: [...this.content.links, created] };
    return Promise.resolve({ ok: true as const, value: created });
  }

  update(target: { id: string; version: number }, changes: LinkChanges) {
    this.updates.push({ ...target, changes });
    const failed = this.takeFailure();
    if (failed) return Promise.resolve(failed);
    return Promise.resolve(this.save(target, changes));
  }

  setVisibility(target: { id: string; version: number }, visible: boolean) {
    const failed = this.takeFailure();
    if (failed) return Promise.resolve(failed);
    return Promise.resolve(this.save(target, { visible }));
  }

  delete(target: { id: string; version: number }): Promise<FormResult<void>> {
    this.deleted.push(target.id);
    this.content = {
      ...this.content,
      links: this.content.links.filter((candidate) => candidate.id !== target.id),
    };
    return Promise.resolve({ ok: true, value: undefined });
  }

  deleteOnExit(target: { id: string; version: number }) {
    this.deletedOnExit.push(target.id);
  }

  moves: { sectionId: string | null; order: string[] }[] = [];

  /** Como la base: deja el grupo en ese orden y sube la versión de lo que se movió. */
  move(sectionId: string | null, order: readonly { id: string; version: number }[]) {
    this.moves.push({ sectionId, order: order.map((item) => item.id) });
    const failed = this.takeFailure();
    if (failed) return Promise.resolve(failed as unknown as FormResult<OwnLinks>);
    const ids = order.map((item) => item.id);
    this.content = {
      ...this.content,
      links: this.content.links.map((candidate) => {
        const position = ids.indexOf(candidate.id);
        return position === -1
          ? candidate
          : { ...candidate, sectionId, position, version: candidate.version + 1 };
      }),
    };
    return Promise.resolve({ ok: true as const, value: this.content });
  }

  sectionsDeleted: string[] = [];

  createSection(title: string): Promise<FormResult<Section>> {
    if (title.trim() === "") {
      return Promise.resolve({
        ok: false,
        message: errorMessage("invalid_input"),
        fields: { title: "El título no puede estar vacío." },
        values: {},
      });
    }
    const created: Section = {
      id: `s-${title.toLowerCase()}`,
      title: title.trim(),
      showTitle: true,
      visible: true,
      position: this.content.sections.length,
      version: 1,
    };
    this.content = { ...this.content, sections: [...this.content.sections, created] };
    return Promise.resolve({ ok: true, value: created });
  }

  updateSection(
    target: { id: string; version: number },
    changes: SectionChanges,
  ): Promise<FormResult<Section>> {
    const current = this.content.sections.find((candidate) => candidate.id === target.id);
    if (!current) return Promise.resolve(failure(errorMessage("not_found")) as never);
    if (current.version !== target.version) {
      return Promise.resolve(failure(errorMessage("conflict")) as never);
    }
    const saved = { ...current, ...changes, version: current.version + 1 };
    this.content = {
      ...this.content,
      sections: this.content.sections.map((candidate) =>
        candidate.id === target.id ? saved : candidate,
      ),
    };
    return Promise.resolve({ ok: true, value: saved });
  }

  deleteSection(target: { id: string; version: number }): Promise<FormResult<OwnLinks>> {
    this.sectionsDeleted.push(target.id);
    this.content = {
      sections: this.content.sections.filter((candidate) => candidate.id !== target.id),
      links: this.content.links.map((candidate) =>
        candidate.sectionId === target.id ? { ...candidate, sectionId: null } : candidate,
      ),
    };
    return Promise.resolve({ ok: true, value: this.content });
  }

  reorderSections(order: readonly { id: string; version: number }[]) {
    const ids = order.map((item) => item.id);
    this.content = {
      ...this.content,
      sections: this.content.sections.map((candidate) => ({
        ...candidate,
        position: ids.indexOf(candidate.id),
      })),
    };
    return Promise.resolve({ ok: true as const, value: this.content });
  }

  /** Como la base: si la versión leída no es la actual, da conflicto. */
  private save(target: { id: string; version: number }, changes: Partial<Link>): FormResult<Link> {
    const { id } = target;
    const current = this.content.links.find((candidate) => candidate.id === id);
    if (!current) return failure(errorMessage("not_found"));
    if (current.version !== target.version) return failure(errorMessage("conflict"));
    const saved = { ...current, ...changes, version: current.version + 1 };
    this.content = {
      ...this.content,
      links: this.content.links.map((candidate) => (candidate.id === id ? saved : candidate)),
    };
    return { ok: true, value: saved };
  }

  private takeFailure() {
    const failed = this.nextFailure;
    this.nextFailure = null;
    return failed;
  }
}

function setup(content: OwnLinks, { fakeTimers = false } = {}) {
  if (fakeTimers) vi.useFakeTimers({ shouldAdvanceTime: true });
  const api = new FakeApi(content);
  render(<Editor api={api} initialContent={content} />);
  const user = userEvent.setup(
    fakeTimers ? { advanceTimers: (milliseconds) => vi.advanceTimersByTime(milliseconds) } : {},
  );
  return { api, user };
}

const TWO_LINKS: OwnLinks = {
  sections: [REDES],
  links: [link("twitch", { title: "Twitch" }), link("youtube", { title: "YouTube", position: 1 })],
};

/** Abre la edición de un link y toca "Borrar link". */
async function deleteLink(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(screen.getByRole("button", { name: `Editar ${title}` }));
  await user.click(screen.getByRole("button", { name: `Borrar link ${title}` }));
}

describe("Editor · agregar", () => {
  it("propone el título desde la URL y lo agrega en su sección", async () => {
    const { api, user } = setup({ sections: [REDES], links: [] });

    await user.type(screen.getByLabelText("URL"), "https://www.instagram.com/juedsay/");
    expect(screen.getByLabelText("Título")).toHaveProperty("value", "Instagram");
    await user.selectOptions(screen.getByLabelText("Sección"), "Redes");
    await user.click(screen.getByRole("button", { name: "Agregar link" }));

    expect(api.created).toEqual([
      { title: "Instagram", url: "https://www.instagram.com/juedsay/", sectionId: "s-redes" },
    ]);
    const redes = screen.getByRole("region", { name: "Redes" });
    expect(within(redes).getByText("Instagram")).toBeTruthy();
    // El formulario queda listo para el siguiente, con el foco en la URL.
    expect(screen.getByLabelText("URL")).toHaveProperty("value", "");
    expect(document.activeElement).toBe(screen.getByLabelText("URL"));
    await waitFor(() => {
      expect(editorStatus()).toBe("Instagram: agregado");
    });
  });

  it("un título escrito a mano no se pisa al cambiar la URL", async () => {
    const { user } = setup({ sections: [], links: [] });
    await user.type(screen.getByLabelText("Título"), "Mi canal");
    await user.type(screen.getByLabelText("URL"), "https://github.com/juedsay");
    expect(screen.getByLabelText("Título")).toHaveProperty("value", "Mi canal");
  });

  it("los errores de validación quedan junto al campo", async () => {
    const { api, user } = setup({ sections: [], links: [] });
    api.nextFailure = failure(errorMessage("invalid_input"), {
      url: "La URL tiene que empezar con https://",
    });
    await user.type(screen.getByLabelText("URL"), "http://inseguro.test");
    await user.click(screen.getByRole("button", { name: "Agregar link" }));

    expect(screen.getByRole("alert").textContent).toBe(errorMessage("invalid_input"));
    expect(screen.getByLabelText("URL").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("La URL tiene que empezar con https://")).toBeTruthy();
  });

  it("sin links, invita a agregar el primero", () => {
    setup({ sections: [], links: [] });
    expect(screen.getByText(/Todavía no hay links/)).toBeTruthy();
  });
});

describe("Editor · editar en el lugar", () => {
  it("abre la fila, guarda al salir del campo y anuncia 'Guardado'", async () => {
    const { api, user } = setup({
      sections: [REDES],
      links: [link("twitch", { title: "Twitch" })],
    });

    await user.click(screen.getByRole("button", { name: "Editar Twitch" }));
    const title = screen.getByLabelText("Título", { selector: "#" + CSS.escape(focusedId()) });
    expect(document.activeElement).toBe(title);
    await user.clear(title);
    await user.type(title, "Twitch en vivo");
    await user.tab();

    expect(api.updates).toEqual([
      { id: "twitch", version: 1, changes: { title: "Twitch en vivo" } },
    ]);
    await waitFor(() => {
      expect(editorStatus()).toBe("Guardado");
    });
    expect(screen.getAllByText("Twitch en vivo").length).toBeGreaterThan(0);
  });

  it("guarda de a uno: dos campos seguidos con el servidor lento no pierden lo escrito", async () => {
    const { api, user } = setup({
      sections: [REDES],
      links: [link("twitch", { title: "Twitch" })],
    });
    // El servidor responde recién cuando el test lo libera.
    const pending: (() => void)[] = [];
    const sent: { version: number; changes: LinkChanges }[] = [];
    const saveNow = api.update.bind(api);
    api.update = (target, changes) => {
      sent.push({ version: target.version, changes });
      return new Promise((resolve) => {
        pending.push(() => {
          void saveNow(target, changes).then(resolve);
        });
      });
    };

    await user.click(screen.getByRole("button", { name: "Editar Twitch" }));
    await user.type(document.activeElement as HTMLElement, " TV");
    await user.tab(); // sale del título: primer guardado, todavía sin respuesta
    await user.type(document.activeElement as HTMLElement, "/nuevo");
    await user.tab(); // sale de la URL: queda en espera, no se manda en paralelo
    expect(sent).toEqual([{ version: 1, changes: { title: "Twitch TV" } }]);

    pending.shift()?.();
    await waitFor(() => {
      expect(sent).toHaveLength(2);
    });
    // El segundo sale con la versión que devolvió el primero.
    expect(sent[1]).toEqual({
      version: 2,
      changes: { url: "https://plektia.app/twitch/nuevo" },
    });
    pending.shift()?.();
    await waitFor(() => {
      expect(api.content.links[0]).toMatchObject({
        title: "Twitch TV",
        url: "https://plektia.app/twitch/nuevo",
        version: 3,
      });
    });
    // Lo escrito sigue en el formulario.
    const panel = document.querySelector(".editor-link-panel:not([hidden])");
    expect(within(panel as HTMLElement).getByLabelText("URL")).toHaveProperty(
      "value",
      "https://plektia.app/twitch/nuevo",
    );
  });

  it("salir de un campo sin cambios no llama al servidor", async () => {
    const { api, user } = setup({
      sections: [REDES],
      links: [link("twitch", { title: "Twitch" })],
    });
    await user.click(screen.getByRole("button", { name: "Editar Twitch" }));
    await user.tab();
    await user.tab();
    expect(api.updates).toEqual([]);
  });

  it("'Listo' cierra la edición y devuelve el foco al botón", async () => {
    const { user } = setup({ sections: [REDES], links: [link("twitch", { title: "Twitch" })] });
    await user.click(screen.getByRole("button", { name: "Editar Twitch" }));
    const done = screen.getByRole("button", { name: "Listo Twitch" });
    expect(done.getAttribute("aria-expanded")).toBe("true");
    await user.click(done);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Editar Twitch" }));
  });

  it("un conflicto de versión ofrece recargar y muestra la última versión", async () => {
    const { api, user } = setup({
      sections: [REDES],
      links: [link("twitch", { title: "Twitch" })],
    });
    await user.click(screen.getByRole("button", { name: "Editar Twitch" }));
    // Mientras tanto, otro (por ejemplo el MCP) lo cambió.
    api.content = {
      sections: [REDES],
      links: [link("twitch", { title: "Twitch (MCP)", version: 2 })],
    };
    const title = screen.getByLabelText("Título", { selector: "#" + CSS.escape(focusedId()) });
    await user.type(title, "!");
    await user.tab();

    expect(screen.getByRole("alert").textContent).toContain(errorMessage("conflict"));
    await user.click(screen.getByRole("button", { name: "Recargar" }));
    await waitFor(() => {
      expect(screen.getByText("Twitch (MCP)")).toBeTruthy();
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Editor · mostrar u ocultar", () => {
  it("oculta un link, lo marca y lo anuncia", async () => {
    const { user } = setup({ sections: [REDES], links: [link("twitch", { title: "Twitch" })] });
    await user.click(screen.getByRole("button", { name: "Ocultar Twitch" }));

    expect(screen.getByText("Oculto")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mostrar Twitch" })).toBeTruthy();
    await waitFor(() => {
      expect(editorStatus()).toBe("Twitch: oculto");
    });
  });

  it("si no hay conexión, lo dice y no cambia nada", async () => {
    const { api, user } = setup({
      sections: [REDES],
      links: [link("twitch", { title: "Twitch" })],
    });
    api.setVisibility = () => Promise.reject(new Error("sin red"));
    await user.click(screen.getByRole("button", { name: "Ocultar Twitch" }));

    expect(screen.getByRole("alert").textContent).toContain("revisá tu conexión");
    expect(screen.queryByText("Oculto")).toBeNull();
  });
});

/** El id del elemento con foco (el campo recién abierto). */
function focusedId(): string {
  return document.activeElement?.id ?? "";
}

describe("Editor · borrar y deshacer", () => {
  it("borrar lo saca al instante, pasa el foco al siguiente y lo envía a los 6 s", async () => {
    const { api, user } = setup(TWO_LINKS, { fakeTimers: true });
    await deleteLink(user, "Twitch");

    expect(screen.queryByText("Twitch")).toBeNull();
    expect(screen.getByText("Twitch borrado")).toBeTruthy();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Editar YouTube" }));
    });
    expect(api.deleted).toEqual([]);

    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    expect(api.deleted).toEqual(["twitch"]);
    await waitFor(() => {
      expect(screen.queryByText("Twitch borrado")).toBeNull();
    });
  });

  it("'Deshacer' lo devuelve a su lugar y no se borra", async () => {
    const { api, user } = setup(TWO_LINKS, { fakeTimers: true });
    await deleteLink(user, "Twitch");
    await user.click(screen.getByRole("button", { name: "Deshacer" }));

    const titles = [...document.querySelectorAll(".editor-link-title")].map(
      (title) => title.textContent,
    );
    expect(titles).toEqual(["Twitch", "YouTube"]);
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 2);
    expect(api.deleted).toEqual([]);
  });

  it("con el foco en el aviso, la cuenta se pausa (tiempo ajustable)", async () => {
    const { api, user } = setup(TWO_LINKS, { fakeTimers: true });
    await deleteLink(user, "Twitch");
    // Después de borrar, el foco pasa al link siguiente (en el próximo cuadro);
    // recién ahí se lleva el foco al aviso, como haría una persona.
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Editar YouTube" }));
    });
    screen.getByRole("button", { name: "Deshacer" }).focus();

    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 2);
    expect(api.deleted).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(screen.getByText("Twitch")).toBeTruthy();
  });

  it("si se cierra la pestaña durante los 6 s, el borrado sale igual (keepalive)", async () => {
    const { api, user } = setup(TWO_LINKS, { fakeTimers: true });
    await deleteLink(user, "Twitch");
    window.dispatchEvent(new Event("pagehide"));
    expect(api.deletedOnExit).toEqual(["twitch"]);
  });

  it("un cambio nuevo deja firme el borrado anterior", async () => {
    const { api, user } = setup(TWO_LINKS, { fakeTimers: true });
    await deleteLink(user, "Twitch");
    await user.click(screen.getByRole("button", { name: "Ocultar YouTube" }));
    await waitFor(() => {
      expect(api.deleted).toEqual(["twitch"]);
    });
    expect(document.querySelector(".undo-toast-message")?.textContent).toBe("YouTube: oculto");
  });

  it("borrar justo después de editar espera el guardado y borra con la versión nueva", async () => {
    const { api, user } = setup(TWO_LINKS, { fakeTimers: true });
    // El servidor responde el guardado recién cuando el test lo libera.
    let releaseSave: () => void = () => undefined;
    const saveNow = api.update.bind(api);
    api.update = (target, changes) =>
      new Promise((resolve) => {
        releaseSave = () => {
          void saveNow(target, changes).then(resolve);
        };
      });

    await user.click(screen.getByRole("button", { name: "Editar Twitch" }));
    await user.type(document.activeElement as HTMLElement, " TV");
    // Tocar "Borrar" saca el foco del título: arranca el guardado.
    await user.click(screen.getByRole("button", { name: "Borrar link Twitch" }));
    // Todavía no se borró: espera a que termine el guardado.
    expect(document.querySelector('[data-link-id="twitch"]')).not.toBeNull();

    releaseSave();
    await waitFor(() => {
      expect(document.querySelector(".undo-toast-message")?.textContent).toBe("Twitch TV borrado");
    });
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    await waitFor(() => {
      expect(api.deleted).toEqual(["twitch"]);
    });
    // Sin conflicto: el link no vuelve.
    expect(screen.queryByText("Twitch TV")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("deshacer una edición vuelve a los valores anteriores con un cambio nuevo", async () => {
    const { api, user } = setup(TWO_LINKS, { fakeTimers: true });
    await user.click(screen.getByRole("button", { name: "Editar Twitch" }));
    await user.type(document.activeElement as HTMLElement, " TV");
    await user.tab();
    await waitFor(() => {
      expect(api.content.links[0]?.title).toBe("Twitch TV");
    });

    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    await waitFor(() => {
      expect(api.content.links[0]).toMatchObject({ title: "Twitch", version: 3 });
    });
    expect(api.updates.at(-1)).toEqual({ id: "twitch", version: 2, changes: { title: "Twitch" } });
  });
});

/** La región en vivo del editor (dnd-kit suma la suya para el arrastre). */
function editorStatus(): string {
  return document.querySelector("[data-editor-status]")?.textContent ?? "";
}

describe("Editor · mover sin arrastrar (botones)", () => {
  const PROYECTOS: Section = { ...REDES, id: "s-proyectos", title: "Proyectos", position: 1 };
  const THREE: OwnLinks = {
    sections: [REDES, PROYECTOS],
    links: [
      link("twitch", { title: "Twitch" }),
      link("youtube", { title: "YouTube", position: 1 }),
      link("github", { title: "GitHub", sectionId: "s-proyectos" }),
    ],
  };
  const titlesIn = (group: string) =>
    [
      ...(screen
        .getByRole("heading", { name: group })
        .closest("section")
        ?.querySelectorAll(".editor-link-title") ?? []),
    ].map((title) => title.textContent);

  it("'Bajar' lo baja un lugar y manda el orden completo del grupo", async () => {
    const { api, user } = setup(THREE, { fakeTimers: true });
    await user.click(screen.getByRole("button", { name: "Editar Twitch" }));
    expect(screen.getByRole("button", { name: "Subir Twitch" })).toHaveProperty("disabled", true);
    await user.click(screen.getByRole("button", { name: "Bajar Twitch" }));

    await waitFor(() => {
      expect(titlesIn("Redes")).toEqual(["YouTube", "Twitch"]);
    });
    expect(api.moves).toEqual([{ sectionId: "s-redes", order: ["youtube", "twitch"] }]);
    expect(document.querySelector(".undo-toast-message")?.textContent).toBe("Twitch movido");
  });

  it("la sección elegida lo lleva al final de esa sección; 'Deshacer' lo devuelve", async () => {
    const { api, user } = setup(THREE, { fakeTimers: true });
    await user.click(screen.getByRole("button", { name: "Editar Twitch" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Sección de Twitch" }),
      "Proyectos",
    );

    await waitFor(() => {
      expect(titlesIn("Proyectos")).toEqual(["GitHub", "Twitch"]);
    });
    expect(api.moves.at(-1)).toEqual({ sectionId: "s-proyectos", order: ["github", "twitch"] });

    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    await waitFor(() => {
      expect(titlesIn("Redes")).toEqual(["Twitch", "YouTube"]);
    });
    expect(api.moves.at(-1)).toEqual({ sectionId: "s-redes", order: ["twitch", "youtube"] });
  });

  it("si el servidor no lo acepta, vuelve a su lugar y lo anuncia", async () => {
    const { api, user } = setup(THREE, { fakeTimers: true });
    await user.click(screen.getByRole("button", { name: "Editar Twitch" }));
    api.nextFailure = failure(errorMessage("conflict"));
    await user.click(screen.getByRole("button", { name: "Bajar Twitch" }));

    await waitFor(() => {
      expect(editorStatus()).toContain("No pudimos mover Twitch");
    });
    expect(titlesIn("Redes")).toEqual(["Twitch", "YouTube"]);
  });
});

describe("Editor · secciones", () => {
  const PROYECTOS: Section = { ...REDES, id: "s-proyectos", title: "Proyectos", position: 1 };
  const CONTENT: OwnLinks = {
    sections: [REDES, PROYECTOS],
    links: [link("twitch", { title: "Twitch" })],
  };
  const sectionTitles = () =>
    [...document.querySelectorAll(".editor-group-title")].map((title) => title.textContent);

  it("crea una sección al final; un nombre vacío se rechaza junto al campo", async () => {
    const { user } = setup(CONTENT);
    await user.click(screen.getByRole("button", { name: "Crear sección" }));
    expect(screen.getByText("El título no puede estar vacío.")).toBeTruthy();

    await user.type(screen.getByLabelText("Nueva sección"), "Artículos");
    await user.click(screen.getByRole("button", { name: "Crear sección" }));
    await waitFor(() => {
      expect(sectionTitles()).toEqual(["Redes", "Proyectos", "Artículos", "Sin sección"]);
    });
    expect(screen.getByLabelText("Nueva sección")).toHaveProperty("value", "");
  });

  it("renombra al salir del campo, oculta y deshace", async () => {
    const { api, user } = setup(CONTENT, { fakeTimers: true });
    await user.click(screen.getByRole("button", { name: "Opciones de la sección Redes" }));
    const name = screen.getByLabelText("Nombre de la sección");
    expect(document.activeElement).toBe(name);
    await user.clear(name);
    await user.type(name, "Mis redes");
    await user.tab();
    await waitFor(() => {
      expect(sectionTitles()[0]).toBe("Mis redes");
    });

    await user.click(screen.getByRole("button", { name: "Ocultar sección" }));
    await waitFor(() => {
      expect(screen.getByText("Oculta")).toBeTruthy();
    });
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    await waitFor(() => {
      expect(api.content.sections[0]?.visible).toBe(true);
    });
  });

  it("'Mostrar el nombre en la página' se guarda al tildar", async () => {
    const { api, user } = setup(CONTENT);
    await user.click(screen.getByRole("button", { name: "Opciones de la sección Redes" }));
    await user.click(screen.getByRole("checkbox", { name: /Mostrar el nombre en la página/ }));
    await waitFor(() => {
      expect(api.content.sections[0]?.showTitle).toBe(false);
    });
  });

  it("'Bajar sección' la mueve y manda el orden completo", async () => {
    const { user } = setup(CONTENT);
    await user.click(screen.getByRole("button", { name: "Opciones de la sección Redes" }));
    expect(screen.getByRole("button", { name: "Subir sección" })).toHaveProperty("disabled", true);
    await user.click(screen.getByRole("button", { name: "Bajar sección" }));
    await waitFor(() => {
      expect(sectionTitles()).toEqual(["Proyectos", "Redes", "Sin sección"]);
    });
  });

  it("borrar la saca al instante, sus links pasan a 'Sin sección' y se envía a los 6 s", async () => {
    const { api, user } = setup(CONTENT, { fakeTimers: true });
    await user.click(screen.getByRole("button", { name: "Opciones de la sección Redes" }));
    await user.click(screen.getByRole("button", { name: "Borrar sección" }));

    expect(sectionTitles()).toEqual(["Proyectos", "Sin sección"]);
    expect(
      screen
        .getByRole("heading", { name: "Sin sección" })
        .closest("section")
        ?.textContent?.includes("Twitch"),
    ).toBe(true);
    expect(api.sectionsDeleted).toEqual([]);

    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    expect(api.sectionsDeleted).toEqual(["s-redes"]);
  });

  it("'Deshacer' la devuelve con sus links y no se borra", async () => {
    const { api, user } = setup(CONTENT, { fakeTimers: true });
    await user.click(screen.getByRole("button", { name: "Opciones de la sección Redes" }));
    await user.click(screen.getByRole("button", { name: "Borrar sección" }));
    await user.click(screen.getByRole("button", { name: "Deshacer" }));

    expect(sectionTitles()).toEqual(["Redes", "Proyectos", "Sin sección"]);
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 2);
    expect(api.sectionsDeleted).toEqual([]);
  });
});
