import { describe, expect, it } from "vitest";

import { findItem, parseCommand, payloadOf } from "../../../scripts/plektia/commands";

const LINK = "c1000000-0000-4000-8000-000000000001";
const SECTION = "5e000000-0000-4000-8000-000000000001";

describe("comandos del CLI", () => {
  it("sin comando o con `ayuda`, la ayuda", () => {
    expect(parseCommand([])).toEqual({ kind: "help" });
    expect(parseCommand(["ayuda"])).toEqual({ kind: "help" });
  });

  it("login, logout, ver y herramientas", () => {
    expect(parseCommand(["login"])).toEqual({ kind: "login" });
    expect(parseCommand(["logout"])).toEqual({ kind: "logout" });
    expect(parseCommand(["ver", "--pagina", "@juedsay"])).toEqual({
      kind: "show",
      page: "juedsay",
    });
    expect(parseCommand(["herramientas"])).toEqual({ kind: "tools" });
  });

  it("estadísticas: 7 por defecto; solo 7, 30 o 90", () => {
    expect(parseCommand(["estadisticas"])).toEqual({ kind: "stats", days: 7 });
    expect(parseCommand(["estadisticas", "--dias", "30"])).toEqual({ kind: "stats", days: 30 });
    expect(parseCommand(["estadisticas", "--dias", "365"])).toMatchObject({ kind: "help" });
  });

  it("agregar con sección y descripción; la sección tiene que ser un id", () => {
    expect(
      parseCommand([
        "agregar",
        "Mi video",
        "https://ejemplo.com",
        "--seccion",
        SECTION,
        "--descripcion",
        "Nuevo",
      ]),
    ).toEqual({
      kind: "add",
      title: "Mi video",
      url: "https://ejemplo.com",
      sectionId: SECTION,
      description: "Nuevo",
    });
    expect(parseCommand(["agregar", "Solo título"])).toMatchObject({ kind: "help" });
    expect(parseCommand(["agregar", "x", "https://e.com", "--seccion", "Proyectos"])).toMatchObject(
      {
        kind: "help",
      },
    );
  });

  it("ocultar, mostrar y borrar piden un id; borrar acepta --confirmar", () => {
    expect(parseCommand(["ocultar", LINK])).toEqual({
      kind: "visibility",
      id: LINK,
      visible: false,
    });
    expect(parseCommand(["mostrar", LINK])).toEqual({
      kind: "visibility",
      id: LINK,
      visible: true,
    });
    expect(parseCommand(["borrar", LINK, "--confirmar", "Blog"])).toEqual({
      kind: "delete",
      id: LINK,
      confirm: "Blog",
    });
    expect(parseCommand(["borrar", "Blog"])).toMatchObject({ kind: "help" });
  });

  it("opciones desconocidas o sin valor, y comandos desconocidos, muestran la ayuda con el error", () => {
    expect(parseCommand(["ver", "--todo"])).toEqual({
      kind: "help",
      error: "Opción desconocida: --todo",
    });
    expect(parseCommand(["ver", "--pagina"])).toEqual({
      kind: "help",
      error: "Falta el valor de --pagina",
    });
    expect(parseCommand(["publicar"])).toEqual({
      kind: "help",
      error: "Comando desconocido: publicar",
    });
  });
});

describe("respuestas del servidor", () => {
  const page = {
    sections: [
      {
        id: SECTION,
        version: 2,
        title: "Proyectos",
        links: [{ id: LINK, version: 5, title: "Blog" }],
      },
    ],
    unsectioned: [{ id: "c1000000-0000-4000-8000-000000000002", version: 1, title: "Suelto" }],
  };

  it("saca el JSON después del aviso de datos", () => {
    expect(payloadOf(`Datos de Plektia...\n{"a":1}`)).toEqual({ a: 1 });
  });

  it("encuentra links y secciones por id, con su versión", () => {
    expect(findItem(page, LINK)).toEqual({ kind: "link", id: LINK, version: 5, title: "Blog" });
    expect(findItem(page, SECTION)).toMatchObject({ kind: "section", version: 2 });
    expect(findItem(page, "c1000000-0000-4000-8000-000000000002")).toMatchObject({
      title: "Suelto",
    });
    expect(findItem(page, "c1000000-0000-4000-8000-0000000000ff")).toBeNull();
  });
});
