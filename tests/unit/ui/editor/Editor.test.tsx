// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type { FormResult } from "@/actions/form-result";
import type { Link, OwnLinks, Section } from "@/application/ports/link-repository";
import { errorMessage } from "@/domain/errors";
import { Editor } from "@/ui/islands/editor/Editor";
import type { EditorApi, LinkChanges, NewLink } from "@/ui/islands/editor/editor-api";

afterEach(cleanup);

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

function setup(content: OwnLinks) {
  const api = new FakeApi(content);
  render(<Editor api={api} initialContent={content} />);
  return { api, user: userEvent.setup() };
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
      expect(screen.getByRole("status").textContent).toBe("Instagram: agregado");
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
      expect(screen.getByRole("status").textContent).toBe("Guardado");
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
      expect(screen.getByRole("status").textContent).toBe("Twitch: oculto");
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
