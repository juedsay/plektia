// Errores esperables de los casos de uso (SPEC-links): valores, no excepciones.
// Los mensajes para el panel y el servidor MCP salen de este único mapa.

export const DOMAIN_ERRORS = [
  "invalid_input",
  "not_found",
  "conflict",
  "limit_reached",
  "forbidden",
] as const;
export type DomainError = (typeof DOMAIN_ERRORS)[number];

const MESSAGES: Readonly<Record<DomainError, string>> = {
  invalid_input: "Revisá los datos: hay campos con errores.",
  not_found: "No encontramos lo que buscabas: puede que se haya borrado.",
  conflict: "Alguien más lo cambió mientras lo editabas. Recargá para ver la última versión.",
  limit_reached: "Llegaste al máximo permitido: borrá algo antes de agregar más.",
  forbidden: "No tenés permiso para hacer eso.",
};

export function errorMessage(error: DomainError): string {
  return MESSAGES[error];
}

/** Error de validación con el mensaje de cada campo (para mostrarlo junto al campo). */
export interface InvalidInput {
  readonly kind: "invalid_input";
  readonly fields: Readonly<Record<string, string>>;
}

export function invalidInput(fields: Readonly<Record<string, string>>): InvalidInput {
  return { kind: "invalid_input", fields };
}
