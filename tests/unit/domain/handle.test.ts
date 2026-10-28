import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  OFFICIAL_HANDLE,
  parseExistingHandle,
  parseHandle,
  RESERVED_HANDLES,
} from "@/domain/handle";

describe("parseHandle", () => {
  it.each([
    ["juedsay", "juedsay"],
    ["ana-23", "ana-23"],
    ["abc", "abc"],
    ["a".repeat(30), "a".repeat(30)],
    // Las URLs no distinguen mayúsculas: /JuedSay es el mismo perfil.
    ["JuedSay", "juedsay"],
    ["  juedsay  ", "juedsay"],
  ])("acepta %j como %j", (input, expected) => {
    const result = parseHandle(input);
    expect(result).toEqual({ ok: true, value: expected });
  });

  it.each([
    ["muy corto", "ab"],
    ["muy largo", "a".repeat(31)],
    ["guion doble", "ana--b"],
    ["guion al principio", "-ana"],
    ["guion al final", "ana-"],
    ["guion bajo", "ana_b"],
    ["punto", "ana.b"],
    ["espacio interno", "ana b"],
    ["letras con tilde", "añá"],
    ["homógrafo cirílico", "juеdsay"],
    ["emoji", "ana😀"],
    ["barra", "ana/b"],
    ["vacío", ""],
  ])("rechaza el formato: %s", (_caso, input) => {
    expect(parseHandle(input)).toEqual({ ok: false, error: "invalid_handle" });
  });

  it.each(["admin", "Admin", "plektia", "login", "api", "auth", "mcp"])(
    "rechaza la ruta reservada %j",
    (input) => {
      expect(parseHandle(input)).toEqual({ ok: false, error: "reserved_handle" });
    },
  );

  it.each([null, undefined, 3, {}])("rechaza valores que no son texto (%j)", (input) => {
    expect(parseHandle(input)).toEqual({ ok: false, error: "invalid_handle" });
  });
});

describe("RESERVED_HANDLES", () => {
  // La base valida lo mismo con `private.is_reserved_handle`. Si una lista cambia
  // y la otra no, un handle podría pasar en un lado y fallar en el otro.
  it("coincide con la lista de la migración de identity", () => {
    const dir = join(import.meta.dirname, "../../../supabase/migrations");
    // La definición vigente es la de la migración más reciente que la (re)crea.
    const file = readdirSync(dir)
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .filter((name) =>
        /create (or replace )?function private\.is_reserved_handle/.test(
          readFileSync(join(dir, name), "utf8"),
        ),
      )
      .at(-1);
    expect(file).toBeDefined();
    const sql = readFileSync(join(dir, file ?? ""), "utf8");
    const block = /is_reserved_handle[\s\S]*?array\[([\s\S]*?)\]/.exec(sql)?.[1] ?? "";
    const fromSql = [...block.matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();

    expect(fromSql.length).toBeGreaterThan(0);
    // El oficial la base no lo frena por lista: lo permite solo a una cuenta owner.
    const reservedForEveryone = [...RESERVED_HANDLES].filter(
      (handle) => handle !== OFFICIAL_HANDLE,
    );
    expect(reservedForEveryone.sort()).toEqual(fromSql);
    expect(RESERVED_HANDLES.has(OFFICIAL_HANDLE)).toBe(true);

    const official = readdirSync(dir)
      .filter((name) => name.endsWith(".sql"))
      .map((name) => readFileSync(join(dir, name), "utf8"))
      .find((text) => text.includes("function private.is_official_handle"));
    expect(official).toContain(`lower(value) = '${OFFICIAL_HANDLE}'`);
  });
});

describe("parseExistingHandle", () => {
  it("acepta el handle oficial, que existe aunque nadie lo pueda pedir", () => {
    expect(parseExistingHandle(" Plektia ")).toEqual({ ok: true, value: OFFICIAL_HANDLE });
    expect(parseHandle(OFFICIAL_HANDLE)).toEqual({ ok: false, error: "reserved_handle" });
  });

  it("los demás, igual que parseHandle", () => {
    expect(parseExistingHandle("juedsay")).toEqual({ ok: true, value: "juedsay" });
    expect(parseExistingHandle("admin")).toEqual({ ok: false, error: "reserved_handle" });
    expect(parseExistingHandle("ab")).toEqual({ ok: false, error: "invalid_handle" });
  });
});
