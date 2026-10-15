import { describe, expect, it } from "vitest";

import { loginRedirect, requiresSession, usesSession } from "@/domain/access";
import { safeRedirectPath } from "@/domain/safe-redirect";

describe("requiresSession", () => {
  it.each(["/admin", "/admin/", "/admin/links", "/ADMIN", "/Admin/links"])("protege %j", (path) => {
    expect(requiresSession(path)).toBe(true);
  });

  // Variantes que el router de Astro resuelve igual que /admin: tienen que
  // quedar protegidas aunque no se escriban así.
  it.each(["/%61dmin", "//admin", "/admin//links", "/%41DMIN/x"])(
    "protege la variante codificada o con barras repetidas %j",
    (path) => {
      expect(requiresSession(path)).toBe(true);
    },
  );

  it.each(["/", "/juedsay", "/administrador", "/login", "/auth/callback", "/admin-x"])(
    "no protege %j",
    (path) => {
      expect(requiresSession(path)).toBe(false);
    },
  );

  it("no falla con una ruta mal codificada", () => {
    expect(requiresSession("/%E0%A4%A")).toBe(false);
  });
});

describe("usesSession", () => {
  it.each(["/admin", "/admin/links", "/login", "/auth/callback", "/auth/logout"])(
    "lee la sesión en %j",
    (path) => {
      expect(usesSession(path)).toBe(true);
    },
  );

  it.each(["/", "/juedsay", "/loginx", "/authors"])("no la lee en la página pública %j", (path) => {
    expect(usesSession(path)).toBe(false);
  });
});

describe("loginRedirect", () => {
  it("codifica la ruta y la consulta en `next`", () => {
    expect(loginRedirect("/admin/links", "?seccion=redes")).toBe(
      "/login?next=%2Fadmin%2Flinks%3Fseccion%3Dredes",
    );
  });

  it("el `next` que genera pasa el filtro de redirección segura", () => {
    const next = new URL(
      loginRedirect("/admin/links", "?a=1"),
      "https://x.invalid",
    ).searchParams.get("next");
    expect(safeRedirectPath(next)).toBe("/admin/links?a=1");
  });
});
