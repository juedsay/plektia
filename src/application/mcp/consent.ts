import type {
  AlreadyDecided,
  ConsentError,
  ConsentRequest,
  McpConnections,
} from "@/application/ports/mcp-connections";
import { err, ok, type Result } from "@/domain/result";

// Consentimiento de un cliente MCP (SPEC-mcp-server, historia 1). La decisión
// vuelve a pedir el detalle a Supabase: el nombre, el cliente y el host nunca
// salen del formulario, que cualquiera podría alterar.

/** Lo que forma un id de autorización; cualquier otra cosa ni se consulta. */
const AUTHORIZATION_ID = /^[A-Za-z0-9_-]{8,128}$/;

export type ConsentAccess = "read" | "write";

export interface ConsentDecision {
  readonly authorizationId: string;
  readonly approve: boolean;
  readonly access: ConsentAccess;
}

export function isAuthorizationId(value: unknown): value is string {
  return typeof value === "string" && AUTHORIZATION_ID.test(value);
}

/** Si la app ya estaba autorizada, viene `redirectUrl` y no hay nada que preguntar. */
export const loadConsent =
  (connections: McpConnections) =>
  async (authorizationId: string): Promise<Result<ConsentRequest | AlreadyDecided, ConsentError>> =>
    isAuthorizationId(authorizationId)
      ? connections.consentRequest(authorizationId)
      : err("not_found");

/**
 * Aprobar guarda la conexión primero y después aprueba: si lo segundo falla,
 * queda una conexión sin tokens (inofensiva), nunca tokens sin conexión.
 * Devuelve a dónde volver a la app.
 */
export const decideConsent =
  (connections: McpConnections) =>
  async (decision: ConsentDecision): Promise<Result<string, ConsentError>> => {
    if (!isAuthorizationId(decision.authorizationId)) return err("not_found");
    const request = await connections.consentRequest(decision.authorizationId);
    if (!request.ok) return request;
    if ("redirectUrl" in request.value) return ok(request.value.redirectUrl);

    if (decision.approve) {
      const saved = await connections.saveGrant(request.value, decision.access === "write");
      if (!saved.ok) return saved;
    }
    return connections.decide(decision.authorizationId, decision.approve);
  };
