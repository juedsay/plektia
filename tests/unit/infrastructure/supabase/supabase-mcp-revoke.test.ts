import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/infrastructure/supabase/database.types";
import { SupabaseMcpConnections } from "@/infrastructure/supabase/supabase-mcp-connections";

const CLIENT = "10000000-0000-4000-8000-00000000000a";

/** Un cliente que responde la revocación de Supabase y la del grant como se le pida. */
function connectionsWith(options: {
  supabaseError?: { status: number; message: string } | null;
  grantError?: { code: string } | null;
}) {
  const calls: string[] = [];
  const revokeGrant = vi.fn(() => {
    calls.push("supabase");
    return Promise.resolve({ data: null, error: options.supabaseError ?? null });
  });
  const rpc = vi.fn(() => {
    calls.push("grant");
    return Promise.resolve({ data: true, error: options.grantError ?? null });
  });
  const client = { auth: { oauth: { revokeGrant } }, rpc } as unknown as SupabaseClient<Database>;
  return { connections: new SupabaseMcpConnections(client), calls, rpc };
}

describe("SupabaseMcpConnections.revoke", () => {
  it("primero Supabase (olvida el consentimiento), después el grant", async () => {
    const { connections, calls } = connectionsWith({});
    expect(await connections.revoke(CLIENT)).toEqual({ ok: true, value: undefined });
    expect(calls).toEqual(["supabase", "grant"]);
  });

  it("si Supabase falla, no corta el grant: la conexión sigue y se puede reintentar", async () => {
    const { connections, rpc } = connectionsWith({
      supabaseError: { status: 500, message: "caído" },
    });
    await expect(connections.revoke(CLIENT)).rejects.toThrow(/Supabase no revocó/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("si Supabase ya no la tenía (404), igual corta el grant", async () => {
    const { connections, calls } = connectionsWith({
      supabaseError: { status: 404, message: "no existe" },
    });
    expect(await connections.revoke(CLIENT)).toEqual({ ok: true, value: undefined });
    expect(calls).toEqual(["supabase", "grant"]);
  });

  it("sin permiso para el grant, forbidden", async () => {
    const { connections } = connectionsWith({ grantError: { code: "42501" } });
    expect(await connections.revoke(CLIENT)).toEqual({ ok: false, error: "forbidden" });
  });
});
