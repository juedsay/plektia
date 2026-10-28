import type { APIContext, MiddlewareNext } from "astro";
import { describe, expect, it, vi } from "vitest";

import type { SessionReader, SessionUser } from "@/application/ports/session-reader";
import { adminGuardMiddleware } from "@/middleware/admin-guard";
import { cacheMiddleware } from "@/middleware/cache";
import { rateLimitMiddleware } from "@/middleware/rate-limit";
import { requestSizeMiddleware } from "@/middleware/request-size";
import { securityHeadersMiddleware } from "@/middleware/security-headers";
import { sessionMiddleware } from "@/middleware/session";

const USER: SessionUser = { id: "u-1", email: "a@b.test" };

function contextFor(path: string, user: SessionUser | null = null): APIContext {
  const url = new URL(path, "https://app.invalid");
  return {
    url,
    request: new Request(url),
    clientAddress: "203.0.113.7",
    cookies: {},
    locals: { user },
  } as unknown as APIContext;
}

const ok: MiddlewareNext = () => Promise.resolve(new Response("ok"));

function readerFor(user: SessionUser | null): SessionReader {
  return { getCurrentUser: () => Promise.resolve(user) };
}

describe("cacheMiddleware", () => {
  it("marca un perfil como público y con su etiqueta", async () => {
    const response = (await cacheMiddleware(contextFor("/juedsay"), ok)) as Response;
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=60, stale-while-revalidate=300",
    );
    expect(response.headers.get("Cache-Tag")).toBe("profile:juedsay");
  });

  it("una ruta de sesión queda privada y sin etiquetas", async () => {
    const tagged: MiddlewareNext = () =>
      Promise.resolve(new Response("ok", { headers: { "Cache-Tag": "x" } }));
    const response = (await cacheMiddleware(contextFor("/login"), tagged)) as Response;
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.has("Cache-Tag")).toBe(false);
  });

  it("si la respuesta pone una cookie, no se cachea", async () => {
    const withCookie: MiddlewareNext = () =>
      Promise.resolve(new Response("ok", { headers: { "Set-Cookie": "a=b" } }));
    const response = (await cacheMiddleware(contextFor("/juedsay"), withCookie)) as Response;
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

describe("securityHeadersMiddleware", () => {
  it("agrega las cabeceras de seguridad a la respuesta", async () => {
    const response = await securityHeadersMiddleware(contextFor("/"), ok);
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("solo la vista previa del panel se puede embeber, y solo en el propio sitio", async () => {
    const preview = (await securityHeadersMiddleware(
      contextFor("/admin/vista-previa"),
      ok,
    )) as Response;
    const panel = (await securityHeadersMiddleware(contextFor("/admin"), ok)) as Response;

    expect(preview.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(preview.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'self'");
    expect(panel.headers.get("X-Frame-Options")).toBe("DENY");
    expect(panel.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });
});

describe("requestSizeMiddleware", () => {
  const postTo = (path: string, contentLength: string | null) => {
    const url = new URL(path, "https://app.invalid");
    const headers = contentLength === null ? undefined : { "content-length": contentLength };
    return {
      url,
      request: new Request(url, { method: "POST", ...(headers ? { headers } : {}) }),
    } as unknown as APIContext;
  };

  it("corta un cuerpo de más con 413 sin llegar a la Action", async () => {
    const next = vi.fn(ok);
    const response = (await requestSizeMiddleware(
      postTo("/_actions/pages.setAvatar", String(10 * 1024 * 1024)),
      next,
    )) as Response;
    expect(response.status).toBe(413);
    expect(next).not.toHaveBeenCalled();
  });

  it("deja pasar lo que entra en el límite", async () => {
    const next = vi.fn(ok);
    await requestSizeMiddleware(postTo("/_actions/links.create", "120"), next);
    expect(next).toHaveBeenCalled();
  });
});

describe("sessionMiddleware", () => {
  it("en la página pública no lee la sesión ni marca la respuesta como privada", async () => {
    const getCurrentUser = vi.fn(() => Promise.resolve(USER));
    const context = contextFor("/juedsay", USER);
    const response = (await sessionMiddleware(() => ({ getCurrentUser }))(context, ok)) as Response;

    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(context.locals.user).toBeNull();
    expect(response.headers.get("Cache-Control")).toBeNull();
  });

  it("en /admin deja el usuario en locals y no permite cachear", async () => {
    const context = contextFor("/admin");
    const response = (await sessionMiddleware(() => readerFor(USER))(context, ok)) as Response;

    expect(context.locals.user).toEqual(USER);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("sin sesión válida, locals.user es null", async () => {
    const context = contextFor("/login");
    await sessionMiddleware(() => readerFor(null))(context, ok);
    expect(context.locals.user).toBeNull();
  });
});

describe("adminGuardMiddleware", () => {
  it("sin sesión redirige al login con la ruta pedida en `next`", async () => {
    const next = vi.fn(ok);
    const response = (await adminGuardMiddleware(contextFor("/admin/links?a=1"), next)) as Response;

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login?next=%2Fadmin%2Flinks%3Fa%3D1");
  });

  it("con sesión deja pasar", async () => {
    const response = (await adminGuardMiddleware(contextFor("/admin", USER), ok)) as Response;
    expect(response.status).toBe(200);
  });

  it("las rutas públicas pasan sin sesión", async () => {
    const response = (await adminGuardMiddleware(contextFor("/juedsay"), ok)) as Response;
    expect(response.status).toBe(200);
  });
});

describe("rateLimitMiddleware", () => {
  it("fuera de /auth no consulta el límite", async () => {
    const allow = vi.fn(() => Promise.resolve(false));
    const response = (await rateLimitMiddleware(() => ({ allow }))(
      contextFor("/login"),
      ok,
    )) as Response;
    expect(allow).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("dentro del límite deja pasar y cuenta por IP y ruta", async () => {
    const allow = vi.fn(() => Promise.resolve(true));
    const response = (await rateLimitMiddleware(() => ({ allow }))(
      contextFor("/auth/login"),
      ok,
    )) as Response;
    expect(allow).toHaveBeenCalledWith("203.0.113.7:/auth/login");
    expect(response.status).toBe(200);
  });

  it("pasado el límite responde 429 sin llegar a la página", async () => {
    const next = vi.fn(ok);
    const limiter = { allow: () => Promise.resolve(false) };
    const response = (await rateLimitMiddleware(() => limiter)(
      contextFor("/auth/callback"),
      next,
    )) as Response;
    expect(next).not.toHaveBeenCalled();
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
  });
});
