import { describe, expect, it } from "vitest";

import {
  createSupabaseServerClient,
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
