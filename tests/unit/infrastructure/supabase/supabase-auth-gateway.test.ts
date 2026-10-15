import { describe, expect, it, vi } from "vitest";

import { SupabaseAuthGateway } from "@/infrastructure/supabase/supabase-auth-gateway";

type Auth = ConstructorParameters<typeof SupabaseAuthGateway>[0];

function gateway(overrides: Partial<Record<keyof Auth, unknown>>) {
  return new SupabaseAuthGateway(overrides as unknown as Auth);
}

describe("SupabaseAuthGateway.startSignIn", () => {
  it("pide la URL del proveedor sin redirigir desde el servidor", async () => {
    const signInWithOAuth = vi.fn(() =>
      Promise.resolve({ data: { url: "https://github.com/login/oauth" }, error: null }),
    );
    const result = await gateway({ signInWithOAuth }).startSignIn(
      "github",
      "https://app.invalid/auth/callback",
    );

    expect(result).toEqual({ ok: true, value: "https://github.com/login/oauth" });
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "github",
      options: { redirectTo: "https://app.invalid/auth/callback", skipBrowserRedirect: true },
    });
  });

  it.each([
    { data: { url: null }, error: null },
    { data: { url: null }, error: new Error("proveedor deshabilitado") },
  ])("sin URL del proveedor, el login no está disponible", async (response) => {
    const result = await gateway({ signInWithOAuth: () => Promise.resolve(response) }).startSignIn(
      "google",
      "x",
    );
    expect(result).toEqual({ ok: false, error: "auth_unavailable" });
  });
});

describe("SupabaseAuthGateway.completeSignIn", () => {
  it("canjea el código por la sesión", async () => {
    const exchangeCodeForSession = vi.fn(() => Promise.resolve({ data: {}, error: null }));
    expect(await gateway({ exchangeCodeForSession }).completeSignIn("abc")).toEqual({
      ok: true,
      value: undefined,
    });
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
  });

  it("un código inválido o una cuenta rechazada falla sin detalles", async () => {
    const exchangeCodeForSession = () =>
      Promise.resolve({ data: {}, error: new Error("invalid grant") });
    expect(await gateway({ exchangeCodeForSession }).completeSignIn("abc")).toEqual({
      ok: false,
      error: "sign_in_failed",
    });
  });
});

describe("SupabaseAuthGateway.signOut", () => {
  it("cierra la sesión con el alcance pedido", async () => {
    const signOut = vi.fn(() => Promise.resolve({ error: null }));
    await gateway({ signOut }).signOut("global");
    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("si Supabase falla, lo registra sin romper el logout", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await gateway({ signOut: () => Promise.resolve({ error: new Error("sin red") }) }).signOut(
      "local",
    );
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });
});
