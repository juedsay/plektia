import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "@/infrastructure/supabase/database.types";
import { SupabaseUserDirectory } from "@/infrastructure/supabase/supabase-user-directory";

// La traducción del adaptador: filas ↔ entidades y errores ↔ `forbidden`. Que
// las funciones hagan lo que deben lo prueban pgTAP y la integración.

interface Response {
  readonly data: unknown;
  readonly error: { code: string; message: string } | null;
}

function directoryAnswering(response: Response) {
  const builder: Record<string, unknown> = {
    then: (resolve: (value: Response) => unknown) => resolve(response),
  };
  for (const method of ["select", "eq", "maybeSingle"]) builder[method] = () => builder;
  const client = {
    from: () => builder,
    rpc: () => Promise.resolve(response),
  } as unknown as SupabaseClient<Database>;
  return new SupabaseUserDirectory(client, "u-1");
}

const ok = (data: unknown): Response => ({ data, error: null });
const fail = (code: string): Response => ({ data: null, error: { code, message: code } });

describe("SupabaseUserDirectory", () => {
  it("convierte las filas de la lista", async () => {
    const directory = directoryAnswering(
      ok([
        {
          email: "ana@ejemplo.com",
          handle: "ana",
          role: "member",
          status: "active",
          invited_at: "2026-10-28T00:00:00Z",
          last_sign_in_at: null,
        },
      ]),
    );
    expect(await directory.list()).toEqual({
      ok: true,
      value: [
        {
          email: "ana@ejemplo.com",
          handle: "ana",
          role: "member",
          status: "active",
          invitedAt: "2026-10-28T00:00:00Z",
          lastSignInAt: null,
        },
      ],
    });
  });

  it("42501 es forbidden en las tres funciones", async () => {
    const directory = directoryAnswering(fail("42501"));
    expect(await directory.list()).toEqual({ ok: false, error: "forbidden" });
    expect(await directory.invite("a@b.c", "abc")).toEqual({ ok: false, error: "forbidden" });
    expect(await directory.revoke("a@b.c")).toEqual({ ok: false, error: "forbidden" });
  });

  it("un error desconocido no se esconde: se lanza", async () => {
    await expect(directoryAnswering(fail("08006")).list()).rejects.toThrow(/08006/);
    await expect(directoryAnswering(fail("08006")).currentAccount()).rejects.toThrow(/08006/);
  });

  it("una respuesta con otra forma no se cree: se lanza", async () => {
    await expect(directoryAnswering(ok("otra-cosa")).invite("a@b.c", "abc")).rejects.toThrow();
    await expect(directoryAnswering(ok([])).revoke("a@b.c")).rejects.toThrow();
  });

  it("lee la cuenta de la sesión, o null si no tiene perfil", async () => {
    expect(
      await directoryAnswering(ok({ role: "owner", disabled: false })).currentAccount(),
    ).toEqual({
      role: "owner",
      disabled: false,
    });
    expect(await directoryAnswering(ok(null)).currentAccount()).toBeNull();
  });

  it("traduce invitar y quitar el acceso", async () => {
    expect(await directoryAnswering(ok("handle_taken")).invite("a@b.c", "abc")).toEqual({
      ok: true,
      value: "handle_taken",
    });
    expect(
      await directoryAnswering(ok([{ status: "revoked", handles: ["ana"] }])).revoke("a@b.c"),
    ).toEqual({ ok: true, value: { status: "revoked", handles: ["ana"] } });
  });
});
