import { beforeEach, describe, expect, it, vi } from "vitest";

// Las consultas reales del verificador a Supabase: getClaims (firma con JWKS)
// y `mcp_authorize` con el token del cliente, nunca con otra sesión.
const getClaims = vi.fn();
const rpc = vi.fn();
const createClient = vi.fn((...args: unknown[]) => ({
  args,
  auth: { getClaims },
  rpc,
}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

const { SupabaseMcpTokenVerifier } = await import("@/infrastructure/mcp/token-verifier");

const CONFIG = { url: "https://proyecto.supabase.co", publishableKey: "sb_publishable_x" };
const TOKEN = "cabecera.carga.firma";
const claims = {
  sub: "11111111-1111-4111-8111-111111111111",
  iss: "https://proyecto.supabase.co/auth/v1",
  aud: "authenticated",
  exp: Date.now() / 1000 + 600,
  client_id: "e0000000-0000-4000-8000-00000000000e",
};

describe("consultas del verificador a Supabase", () => {
  beforeEach(() => {
    getClaims.mockReset();
    rpc.mockReset();
    createClient.mockClear();
  });

  it("verifica con el token del cliente y pregunta el grant con ese mismo token", async () => {
    getClaims.mockResolvedValue({ data: { claims }, error: null });
    rpc.mockResolvedValue({ data: true, error: null });
    const caller = await new SupabaseMcpTokenVerifier(CONFIG).verify(TOKEN);
    expect(caller).toMatchObject({ canWrite: true });
    expect(getClaims).toHaveBeenCalledWith(TOKEN);
    expect(rpc).toHaveBeenCalledWith("mcp_authorize", {});
    expect(createClient.mock.calls[0]?.[2]).toMatchObject({
      global: { headers: { Authorization: `Bearer ${TOKEN}` } },
    });
  });

  it("si Supabase rechaza la firma o el grant, no hay acceso", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("firma") });
    expect(await new SupabaseMcpTokenVerifier(CONFIG).verify(TOKEN)).toBeNull();

    getClaims.mockResolvedValue({ data: { claims }, error: null });
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect(await new SupabaseMcpTokenVerifier(CONFIG).verify(TOKEN)).toBeNull();
  });
});
