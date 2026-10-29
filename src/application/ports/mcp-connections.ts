import type { Result } from "@/domain/result";

// Conexiones de IA del dueño (SPEC-mcp-server): el consentimiento de
// `/oauth/consent` y, más adelante, la lista de `/admin/conexiones`. Siempre con
// la sesión del panel: un cliente MCP no puede autorizarse a sí mismo.

/** Un pedido de autorización que espera la decisión del dueño. */
export interface ConsentRequest {
  readonly authorizationId: string;
  readonly clientId: string;
  /** Lo declara la app al registrarse: no está verificado. */
  readonly clientName: string;
  /** A dónde vuelve la app con el código (lo que conviene mirar). */
  readonly redirectUri: string;
}

/** El dueño ya había autorizado esta app: se vuelve a ella sin preguntar. */
export interface AlreadyDecided {
  readonly redirectUrl: string;
}

export type ConsentError = "not_found" | "forbidden";

export interface McpConnections {
  /** Detalle del pedido, o a dónde volver si ya estaba autorizado. */
  consentRequest(
    authorizationId: string,
  ): Promise<Result<ConsentRequest | AlreadyDecided, ConsentError>>;
  /** Crea o renueva la conexión con el permiso elegido. */
  saveGrant(request: ConsentRequest, canWrite: boolean): Promise<Result<void, ConsentError>>;
  /** Aprueba o rechaza el pedido; devuelve a dónde volver (con el código o el error). */
  decide(authorizationId: string, approve: boolean): Promise<Result<string, ConsentError>>;
}
