import { z } from "zod";

import type { Connection, McpConnections } from "@/application/ports/mcp-connections";
import type { UseCaseResult } from "@/application/shared/use-case";
import { validate } from "@/domain/text";

// Conexiones de IA en el panel (SPEC-mcp-server, historia 4): ver cada app,
// cambiarle el permiso o desconectarla. La revocación corta el acceso en la
// llamada siguiente: `/mcp` revisa el grant en cada pedido.

const ConnectionTarget = z.object(
  { clientId: z.uuid({ error: "La conexión no es válida." }) },
  { error: "Falta la conexión." },
);

const PermissionChange = z.object(
  {
    clientId: z.uuid({ error: "La conexión no es válida." }),
    access: z.enum(["read", "write"], { error: "Elegí solo lectura o lectura y edición." }),
  },
  { error: "Falta la conexión." },
);

export function listConnections(deps: { connections: McpConnections }) {
  return (): Promise<readonly Connection[]> => deps.connections.list();
}

/** `{ clientId, access }`: `read` o `write`. */
export function setConnectionPermission(deps: { connections: McpConnections }) {
  return async (raw: unknown): UseCaseResult<void> => {
    const change = validate(PermissionChange, raw);
    if (!change.ok) return change;
    return deps.connections.setPermission(change.value.clientId, change.value.access === "write");
  };
}

/** `{ clientId }`: desconecta la app. Repetirlo (doble clic) no da error. */
export function revokeConnection(deps: { connections: McpConnections }) {
  return async (raw: unknown): UseCaseResult<void> => {
    const target = validate(ConnectionTarget, raw);
    if (!target.ok) return target;
    return deps.connections.revoke(target.value.clientId);
  };
}
