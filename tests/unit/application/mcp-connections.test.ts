import { describe, expect, it, vi } from "vitest";

import {
  listConnections,
  revokeConnection,
  setConnectionPermission,
} from "@/application/mcp/connections";
import type { McpConnections } from "@/application/ports/mcp-connections";
import { err, ok } from "@/domain/result";

const CLIENT = "e0000000-0000-4000-8000-00000000000e";

function fakeConnections() {
  const setPermission = vi.fn<McpConnections["setPermission"]>(() =>
    Promise.resolve(ok(undefined)),
  );
  const revoke = vi.fn<McpConnections["revoke"]>(() => Promise.resolve(ok(undefined)));
  const connections: McpConnections = {
    consentRequest: () => Promise.resolve(err("not_found")),
    saveGrant: () => Promise.resolve(ok(undefined)),
    decide: () => Promise.resolve(err("not_found")),
    lastEdit: () => Promise.resolve(null),
    list: () =>
      Promise.resolve([
        {
          clientId: CLIENT,
          clientName: "Claude",
          redirectHost: "claude.ai",
          canWrite: false,
          createdAt: "2026-10-28T12:00:00Z",
          lastUsedAt: null,
        },
      ]),
    setPermission,
    revoke,
  };
  return { connections, setPermission, revoke };
}

describe("conexiones de IA en el panel", () => {
  it("lista las conexiones activas", async () => {
    const { connections } = fakeConnections();
    expect(await listConnections({ connections })()).toHaveLength(1);
  });

  it("cambia el permiso: write → edición, read → solo lectura", async () => {
    const { connections, setPermission } = fakeConnections();
    expect(
      await setConnectionPermission({ connections })({ clientId: CLIENT, access: "write" }),
    ).toEqual(ok(undefined));
    expect(setPermission).toHaveBeenLastCalledWith(CLIENT, true);
    await setConnectionPermission({ connections })({ clientId: CLIENT, access: "read" });
    expect(setPermission).toHaveBeenLastCalledWith(CLIENT, false);
  });

  it("un permiso o una conexión inválidos no llegan al repositorio", async () => {
    const { connections, setPermission, revoke } = fakeConnections();
    const badAccess = await setConnectionPermission({ connections })({
      clientId: CLIENT,
      access: "admin",
    });
    expect(badAccess.ok).toBe(false);
    const badClient = await revokeConnection({ connections })({ clientId: "../x" });
    expect(badClient.ok).toBe(false);
    expect(setPermission).not.toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
  });

  it("desconectar pasa el id de la app", async () => {
    const { connections, revoke } = fakeConnections();
    expect(await revokeConnection({ connections })({ clientId: CLIENT })).toEqual(ok(undefined));
    expect(revoke).toHaveBeenCalledWith(CLIENT);
  });
});
