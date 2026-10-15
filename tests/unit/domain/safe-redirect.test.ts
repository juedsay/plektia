import { describe, expect, it } from "vitest";

import { DEFAULT_REDIRECT, safeRedirectPath } from "@/domain/safe-redirect";

describe("safeRedirectPath", () => {
  it.each([
    "/admin",
    "/admin/links",
    "/admin/links?seccion=redes#top",
    "/juedsay",
    "/admin@evil.com",
    "/%2F%2Fevil.com",
  ])("acepta la ruta interna %j", (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  // Open redirect: cada uno de estos llevaría al usuario a otro sitio (o a
  // ejecutar código) después de iniciar sesión.
  it.each([
    ["URL absoluta", "https://evil.com"],
    ["URL absoluta con http", "http://evil.com/admin"],
    ["protocolo relativo", "//evil.com"],
    ["triple barra", "///evil.com"],
    ["barra invertida tras la barra", "/\\evil.com"],
    ["doble barra invertida", "\\\\evil.com"],
    ["barra invertida y barra", "\\/evil.com"],
    ["esquema javascript", "javascript:alert(1)"],
    ["esquema javascript en mayúsculas", "JaVaScRiPt:alert(1)"],
    ["esquema data", "data:text/html,<script>alert(1)</script>"],
    ["esquema sin barras", "http:evil.com"],
    ["tabulación que el navegador descarta", "/\t/evil.com"],
    ["salto de línea que el navegador descarta", "/\n/evil.com"],
    ["retorno de carro", "/\r/evil.com"],
    ["espacio inicial", " //evil.com"],
    ["carácter nulo", "/admin\u0000"],
    ["ruta relativa sin barra", "evil.com"],
    ["barras de ancho completo", "／／evil.com"],
    ["barra codificada sin barra inicial", "%2F%2Fevil.com"],
    ["texto vacío", ""],
    ["demasiado larga", `/${"a".repeat(2048)}`],
  ])("rechaza %s", (_caso, input) => {
    expect(safeRedirectPath(input)).toBe(DEFAULT_REDIRECT);
  });

  it.each([null, undefined, 42, ["/admin"], { path: "/admin" }])(
    "rechaza valores que no son texto (%j)",
    (input) => {
      expect(safeRedirectPath(input)).toBe(DEFAULT_REDIRECT);
    },
  );

  it("la ruta por defecto es el panel", () => {
    expect(DEFAULT_REDIRECT).toBe("/admin");
  });
});
