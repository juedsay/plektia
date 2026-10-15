import { describe, expect, it } from "vitest";

import { buildSql, parseArgs } from "../../../scripts/allow-user";

describe("parseArgs", () => {
  it("normaliza email y handle, con rol member por defecto y destino local", () => {
    expect(parseArgs([" Ana@Example.COM ", "Ana-23"])).toEqual({
      email: "ana@example.com",
      handle: "ana-23",
      role: "member",
      prod: false,
    });
  });

  it("acepta --role y --prod en cualquier orden", () => {
    expect(parseArgs(["--prod", "a@b.co", "--role", "owner", "juedsay"])).toEqual({
      email: "a@b.co",
      handle: "juedsay",
      role: "owner",
      prod: true,
    });
  });

  it.each([
    [[], "Uso:"],
    [["a@b.co"], "Uso:"],
    [["no-es-email", "ana"], "Email inválido"],
    [["a'b@c.co", "ana"], "Email inválido"],
    [["a@b.co", "ab"], "Handle inválido"],
    [["a@b.co", "ana--b"], "Handle inválido"],
    [["a@b.co", "ana", "--role", "admin"], "Rol inválido"],
  ])("rechaza %j", (argv, message) => {
    expect(parseArgs(argv)).toEqual(expect.stringContaining(message));
  });
});

describe("buildSql", () => {
  it("encierra cada valor en comillas dólar con la etiqueta", () => {
    const sql = buildSql({ email: "a@b.co", handle: "ana", role: "member", prod: false }, "t1");
    expect(sql).toContain(
      "values ($t1$a@b.co$t1$, $t1$ana$t1$, $t1$member$t1$::public.user_role);",
    );
  });

  it("usa una etiqueta aleatoria distinta cada vez", () => {
    const invite = { email: "a@b.co", handle: "ana", role: "member", prod: false } as const;
    expect(buildSql(invite)).not.toBe(buildSql(invite));
  });
});
