import { CONTACT_LIMITS, parseContactInput } from "@/domain/contact";

// Lógica del formulario de contacto en el navegador, sin DOM: valida con las
// mismas reglas del dominio que el servidor (un solo origen) y maneja el
// borrador. El servidor vuelve a validar todo: esto es para guiar, no para proteger.

export const CONTACT_FIELDS = ["name", "email", "message"] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];
export type ContactValues = Record<ContactField, string>;

/** Error de cada campo inválido; vacío si se puede enviar. */
export function validateContact(values: ContactValues): Partial<Record<ContactField, string>> {
  const result = parseContactInput(values);
  if (result.ok) return {};
  const errors: Partial<Record<ContactField, string>> = {};
  for (const field of CONTACT_FIELDS) {
    const message = result.error.fields[field];
    if (message) errors[field] = message;
  }
  return errors;
}

/** Error de un solo campo (al salir de él), sin marcar los que todavía no tocó. */
export function validateField(field: ContactField, values: ContactValues): string | null {
  return validateContact(values)[field] ?? null;
}

/** Clave del borrador: vive en `sessionStorage`, solo en esta pestaña. */
export const DRAFT_KEY = "plektia:contacto:borrador";

export function serializeDraft(values: ContactValues): string {
  return JSON.stringify(values);
}

/**
 * Lee el borrador guardado. Lo que haya en el storage no se toma a ciegas:
 * otra pestaña o una extensión pudo dejar cualquier cosa.
 */
export function parseDraft(raw: string | null): ContactValues | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  const draft = {} as ContactValues;
  for (const field of CONTACT_FIELDS) {
    const value = record[field];
    if (typeof value !== "string" || value.length > CONTACT_LIMITS[field]) return null;
    draft[field] = value;
  }
  return CONTACT_FIELDS.some((field) => draft[field].trim() !== "") ? draft : null;
}

/** Se restaura solo sobre un formulario vacío: lo que vino del servidor manda. */
export function shouldRestoreDraft(current: ContactValues): boolean {
  return CONTACT_FIELDS.every((field) => current[field] === "");
}
