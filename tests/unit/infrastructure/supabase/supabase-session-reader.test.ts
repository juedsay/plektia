import { afterEach, describe, expect, it, vi } from "vitest";

import { SupabaseSessionReader } from "@/infrastructure/supabase/supabase-session-reader";

type GetClaims = ConstructorParameters<typeof SupabaseSessionReader>[0]["getClaims"];

function readerReturning(result: Awaited<ReturnType<GetClaims>>) {
  return new SupabaseSessionReader({ getClaims: () => Promise.resolve(result) });
}

function claims(values: Record<string, unknown>) {
  return {
    data: { claims: values, header: {}, signature: new Uint8Array() },
    error: null,
  } as unknown as Awaited<ReturnType<GetClaims>>;
}

describe("SupabaseSessionReader", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("devuelve el id y el email de los claims verificados", async () => {
    const reader = readerReturning(claims({ sub: "u-1", email: "a@b.test" }));
    expect(await reader.getCurrentUser()).toEqual({ id: "u-1", email: "a@b.test" });
  });

  it("sin email en los claims, el email es null", async () => {
    expect(await readerReturning(claims({ sub: "u-1" })).getCurrentUser()).toEqual({
      id: "u-1",
      email: null,
    });
  });

  it.each([{}, { sub: "" }, { sub: 42 }])(
    "sin un `sub` válido no hay sesión (%j)",
    async (values) => {
      expect(await readerReturning(claims(values)).getCurrentUser()).toBeNull();
    },
  );

  it("si getClaims informa un error no hay sesión", async () => {
    const result = { data: null, error: new Error("firma inválida") } as unknown as Awaited<
      ReturnType<GetClaims>
    >;
    expect(await readerReturning(result).getCurrentUser()).toBeNull();
  });

  it("si getClaims lanza una excepción, falla cerrado y lo registra", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reader = new SupabaseSessionReader({
      getClaims: () => Promise.reject(new Error("sin red")),
    });
    expect(await reader.getCurrentUser()).toBeNull();
    expect(log).toHaveBeenCalledOnce();
  });
});
