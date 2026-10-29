import { describe, expect, it } from "vitest";

import {
  isFrameable,
  isRateLimited,
  loginErrorRedirect,
  loginRedirect,
  requiresSession,
  seeOther,
  usesSession,
} from "@/infrastructure/http/route-access";
import { safeRedirectPath } from "@/infrastructure/http/safe-redirect";

describe("isFrameable", () => {
  it("solo la vista previa del panel, como la ve el router", () => {
    expect(isFrameable("/admin/vista-previa")).toBe(true);
    expect(isFrameable("/admin/vista-previa/")).toBe(true);
    expect(isFrameable("/Admin/Vista-Previa")).toBe(true);
    expect(isFrameable("//admin//%76ista-previa")).toBe(true);
  });

  it("ninguna otra ruta, ni las que empiezan igual", () => {
    for (const path of ["/", "/admin", "/admin/page", "/admin/vista-previa/x", "/vista-previa"]) {
      expect(isFrameable(path)).toBe(false);
    }
  });
});

describe("requiresSession", () => {
  it.each(["/admin", "/admin/", "/admin/links", "/ADMIN", "/Admin/links", "/oauth/consent"])(
    "protege %j",
    (path) => {
      expect(requiresSession(path)).toBe(true);
    },
  );

  // Variantes que el router de Astro resuelve igual que /admin: tienen que
  // quedar protegidas aunque no se escriban así.
  it.each(["/%61dmin", "//admin", "/admin//links", "/%41DMIN/x"])(
    "protege la variante codificada o con barras repetidas %j",
    (path) => {
      expect(requiresSession(path)).toBe(true);
    },
  );

  it.each([
    "/",
    "/juedsay",
    "/administrador",
    "/login",
    "/auth/callback",
    "/admin-x",
    "/.well-known/oauth-protected-resource",
  ])("no protege %j", (path) => {
    expect(requiresSession(path)).toBe(false);
  });

  it("no falla con una ruta mal codificada", () => {
    expect(requiresSession("/%E0%A4%A")).toBe(false);
  });
});

describe("usesSession", () => {
  it.each([
    "/admin",
    "/admin/links",
    "/login",
    "/auth/callback",
    "/auth/logout",
    "/_actions/links.create",
  ])("lee la sesión en %j", (path) => {
    expect(usesSession(path)).toBe(true);
  });

  it.each(["/", "/juedsay", "/loginx", "/authors", "/_actionsx"])(
    "no la lee en la página pública %j",
    (path) => {
      expect(usesSession(path)).toBe(false);
    },
  );
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

describe("isRateLimited", () => {
  it.each(["/auth/login", "/auth/callback", "/AUTH/logout"])("limita %j", (path) => {
    expect(isRateLimited(path)).toBe(true);
  });

  it.each(["/login", "/admin", "/", "/authors"])("no limita %j", (path) => {
    expect(isRateLimited(path)).toBe(false);
  });
});

describe("loginErrorRedirect y seeOther", () => {
  it("vuelve al login con el aviso y el destino codificado", () => {
    expect(loginErrorRedirect("/admin/links")).toBe("/login?error=1&next=%2Fadmin%2Flinks");
  });

  it("seeOther responde 303 con el destino", () => {
    const response = seeOther("/login");
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/login");
  });
});
