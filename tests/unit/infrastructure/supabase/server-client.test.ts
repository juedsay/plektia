import { describe, expect, it } from "vitest";

import {
  cookiesOfRequest,
  createSupabaseServerClient,
  rememberWrittenCookies,
  secureCookieAttributes,
} from "@/infrastructure/supabase/server-client";

describe("secureCookieAttributes", () => {
  it("fuerza HttpOnly, Secure, SameSite=Lax y Path=/ aunque la librería pida otra cosa", () => {
    expect(
      secureCookieAttributes({
        httpOnly: false,
        secure: false,
        sameSite: "none",
        path: "/x",
        domain: "evil.test",
      }),
    ).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("conserva la duración de la cookie", () => {
    const expires = new Date("2027-01-01T00:00:00Z");
    expect(secureCookieAttributes({ maxAge: 3600, expires })).toMatchObject({
      maxAge: 3600,
      expires,
    });
  });
});

describe("createSupabaseServerClient", () => {
  it("crea un cliente sin tocar la red ni escribir cookies", () => {
    const written: string[] = [];
    const client = createSupabaseServerClient(
      { url: "https://proyecto.supabase.invalid", publishableKey: "sb_publishable_test" },
      null,
      { set: (name) => written.push(name) },
    );
    expect(client.auth).toBeDefined();
    expect(written).toEqual([]);
  });
});

describe("cookiesOfRequest: la sesión renovada en el pedido la ven todos sus clientes", () => {
  const header = "sb-proyecto-auth-token=viejo; tema=oscuro";

  it("sin escrituras, son las del pedido", () => {
    expect(cookiesOfRequest(header, { set: () => undefined })).toEqual([
      { name: "sb-proyecto-auth-token", value: "viejo" },
      { name: "tema", value: "oscuro" },
    ]);
  });

  it("lo que otro cliente escribió en el mismo pedido gana sobre lo que trajo el pedido", () => {
    const cookies = { set: () => undefined };
    rememberWrittenCookies(cookies, [
      { name: "sb-proyecto-auth-token", value: "renovado", options: { maxAge: 3600 } },
    ]);
    expect(cookiesOfRequest(header, cookies)).toContainEqual({
      name: "sb-proyecto-auth-token",
      value: "renovado",
    });
  });

  it("una cookie borrada (maxAge 0) ya no se lee", () => {
    const cookies = { set: () => undefined };
    rememberWrittenCookies(cookies, [
      { name: "sb-proyecto-auth-token", value: "", options: { maxAge: 0 } },
    ]);
    expect(cookiesOfRequest(header, cookies)).toEqual([{ name: "tema", value: "oscuro" }]);
  });

  it("las escrituras de un pedido no se mezclan con las de otro", () => {
    const first = { set: () => undefined };
    rememberWrittenCookies(first, [
      { name: "sb-proyecto-auth-token", value: "de-otro", options: {} },
    ]);
    expect(cookiesOfRequest(header, { set: () => undefined })).toContainEqual({
      name: "sb-proyecto-auth-token",
      value: "viejo",
    });
  });
});
