import { describe, expect, it, vi } from "vitest";

import { SupabaseMcpTokenVerifier, type TokenChecks } from "@/infrastructure/mcp/token-verifier";

const CONFIG = { url: "https://proyecto.supabase.co", publishableKey: "sb_publishable_x" };
const NOW = Date.parse("2026-10-28T12:00:00Z");
const TOKEN = "cabecera.carga.firma";
const USER = "11111111-1111-4111-8111-111111111111";
const CLIENT = "e0000000-0000-4000-8000-00000000000e";

const validClaims = {
  sub: USER,
  iss: "https://proyecto.supabase.co/auth/v1",
  aud: "authenticated",
  exp: NOW / 1000 + 600,
  client_id: CLIENT,
};

function verifierWith(claims: Record<string, unknown> | null, grant: boolean | null = true) {
  const claimsMock = vi.fn(() => Promise.resolve(claims));
  const grantMock = vi.fn(() => Promise.resolve(grant));
  const checks: TokenChecks = { claims: claimsMock, grant: grantMock };
  return {
    verifier: new SupabaseMcpTokenVerifier(CONFIG, checks, () => NOW),
    checks: { claims: claimsMock, grant: grantMock },
  };
}

describe("verificador de tokens de /mcp", () => {
  it("un token válido con grant activo da el usuario, la app y el permiso", async () => {
    const { verifier } = verifierWith(validClaims, false);
    expect(await verifier.verify(TOKEN)).toEqual({
      userId: USER,
      clientId: CLIENT,
      canWrite: false,
      accessToken: TOKEN,
    });
  });

  it.each([
    ["firma inválida (sin claims)", null],
    ["sin client_id: un token del panel", { ...validClaims, client_id: undefined }],
    ["client_id que no es uuid", { ...validClaims, client_id: "cliente" }],
    ["de otro proyecto", { ...validClaims, iss: "https://otro.supabase.co/auth/v1" }],
    ["otra audiencia", { ...validClaims, aud: "anon" }],
    ["vencido", { ...validClaims, exp: NOW / 1000 - 1 }],
    ["sin exp", { ...validClaims, exp: undefined }],
    ["sin usuario", { ...validClaims, sub: "" }],
  ])("rechaza: %s", async (_case, claims) => {
    const { verifier, checks } = verifierWith(claims);
    expect(await verifier.verify(TOKEN)).toBeNull();
    // Sin un token válido, ni se consulta el grant.
    expect(checks.grant).not.toHaveBeenCalled();
  });

  it("acepta aud como lista", async () => {
    const { verifier } = verifierWith({ ...validClaims, aud: ["authenticated"] });
    expect(await verifier.verify(TOKEN)).not.toBeNull();
  });

  it("rechaza si el grant no está activo (revocado o inexistente)", async () => {
    const { verifier } = verifierWith(validClaims, null);
    expect(await verifier.verify(TOKEN)).toBeNull();
  });

  it("lo que no tiene forma de JWT, o es enorme, no llega a Supabase", async () => {
    const { verifier, checks } = verifierWith(validClaims);
    expect(await verifier.verify("no-es-un-jwt")).toBeNull();
    expect(await verifier.verify(`${"a".repeat(9000)}.b.c`)).toBeNull();
    expect(checks.claims).not.toHaveBeenCalled();
  });

  it("ante una falla inesperada, falla cerrado", async () => {
    const checks: TokenChecks = {
      claims: () => Promise.reject(new Error("JWKS caído")),
      grant: () => Promise.resolve(true),
    };
    const verifier = new SupabaseMcpTokenVerifier(CONFIG, checks, () => NOW);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await verifier.verify(TOKEN)).toBeNull();
  });
});
