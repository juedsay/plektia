import { describe, expect, it, vi } from "vitest";

import { decideConsent, isAuthorizationId, loadConsent } from "@/application/mcp/consent";
import type { ConsentRequest, McpConnections } from "@/application/ports/mcp-connections";
import { err, ok } from "@/domain/result";

const ID = "auth_0123456789abcdef";
const REQUEST: ConsentRequest = {
  authorizationId: ID,
  clientId: "e0000000-0000-4000-8000-00000000000e",
  clientName: "Claude",
  redirectUri: "https://claude.ai/api/mcp/auth_callback",
};

function connectionsWith(overrides: Partial<McpConnections> = {}) {
  const calls: string[] = [];
  const saveGrantMock = vi.fn((request: ConsentRequest, canWrite: boolean) => {
    calls.push(`guardar ${request.clientId} ${String(canWrite)}`);
    return Promise.resolve(ok(undefined));
  });
  const decideMock = vi.fn((id: string, approve: boolean) => {
    calls.push(`${approve ? "aprobar" : "rechazar"} ${id}`);
    return Promise.resolve(
      ok(`https://claude.ai/cb?${approve ? "code=x" : "error=access_denied"}`),
    );
  });
  const connections: McpConnections = {
    consentRequest: (id: string) => {
      calls.push(`detalle ${id}`);
      return Promise.resolve(ok(REQUEST));
    },
    saveGrant: saveGrantMock,
    decide: decideMock,
    ...overrides,
  };
  return Object.assign(connections, { calls, saveGrantMock, decideMock });
}

describe("consentimiento de apps de IA", () => {
  it("un id con forma rara ni se consulta", async () => {
    const connections = connectionsWith();
    expect(isAuthorizationId("../../admin")).toBe(false);
    expect(isAuthorizationId("corto")).toBe(false);
    expect(await loadConsent(connections)("<script>")).toEqual(err("not_found"));
    expect(connections.calls).toEqual([]);
  });

  it("aprobar guarda la conexión con el permiso elegido y después aprueba", async () => {
    const connections = connectionsWith();
    const result = await decideConsent(connections)({
      authorizationId: ID,
      approve: true,
      access: "write",
    });
    expect(result).toEqual(ok("https://claude.ai/cb?code=x"));
    expect(connections.calls).toEqual([
      `detalle ${ID}`,
      `guardar ${REQUEST.clientId} true`,
      `aprobar ${ID}`,
    ]);
  });

  it("el cliente y el host salen de Supabase, no del formulario", async () => {
    const connections = connectionsWith();
    await decideConsent(connections)({ authorizationId: ID, approve: true, access: "read" });
    expect(connections.saveGrantMock).toHaveBeenCalledWith(REQUEST, false);
  });

  it("rechazar no guarda nada", async () => {
    const connections = connectionsWith();
    const result = await decideConsent(connections)({
      authorizationId: ID,
      approve: false,
      access: "write",
    });
    expect(result).toEqual(ok("https://claude.ai/cb?error=access_denied"));
    expect(connections.saveGrantMock).not.toHaveBeenCalled();
  });

  it("si no se pudo guardar la conexión, no aprueba (nunca tokens sin conexión)", async () => {
    const connections = connectionsWith({
      saveGrant: () => Promise.resolve(err("forbidden")),
    });
    const result = await decideConsent(connections)({
      authorizationId: ID,
      approve: true,
      access: "read",
    });
    expect(result).toEqual(err("forbidden"));
    expect(connections.decideMock).not.toHaveBeenCalled();
  });

  it("si ya estaba autorizada, vuelve a la app sin tocar nada", async () => {
    const connections = connectionsWith({
      consentRequest: () => Promise.resolve(ok({ redirectUrl: "https://claude.ai/cb?code=y" })),
    });
    const result = await decideConsent(connections)({
      authorizationId: ID,
      approve: true,
      access: "write",
    });
    expect(result).toEqual(ok("https://claude.ai/cb?code=y"));
    expect(connections.saveGrantMock).not.toHaveBeenCalled();
    expect(connections.decideMock).not.toHaveBeenCalled();
  });

  it("un pedido vencido o ya usado no sigue", async () => {
    const connections = connectionsWith({
      consentRequest: () => Promise.resolve(err("not_found")),
    });
    expect(
      await decideConsent(connections)({ authorizationId: ID, approve: true, access: "read" }),
    ).toEqual(err("not_found"));
    expect(connections.saveGrantMock).not.toHaveBeenCalled();
  });
});
