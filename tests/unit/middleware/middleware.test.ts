import type { APIContext, MiddlewareNext } from "astro";
import { describe, expect, it, vi } from "vitest";

import type { SessionReader, SessionUser } from "@/application/ports/session-reader";
import { adminGuardMiddleware } from "@/middleware/admin-guard";
import { rateLimitMiddleware } from "@/middleware/rate-limit";
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

describe("securityHeadersMiddleware", () => {
  it("agrega las cabeceras de seguridad a la respuesta", async () => {
    const response = await securityHeadersMiddleware(contextFor("/"), ok);
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("X-Frame-Options")).toBe("DENY");
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
