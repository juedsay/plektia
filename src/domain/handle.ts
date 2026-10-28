import { z } from "zod";

import { err, ok, type Result } from "@/domain/result";

/**
 * Handle de la página oficial (`/plektia`). Nadie lo puede pedir (está en la
 * lista de abajo), pero existe en la base a nombre de la cuenta Admin: la base
 * se lo permite solo a una cuenta `owner` (`private.is_official_handle`).
 */
export const OFFICIAL_HANDLE = "plektia";

// Rutas propias de la app que no pueden ser el handle de nadie. La base valida
// la misma lista (`private.is_reserved_handle`), salvo el handle oficial; un
// test verifica que coincidan.
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  "_astro",
  ".well-known",
  "about",
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "avatars",
  "contact",
  "contacto",
  "favicon.ico",
  "help",
  "legal",
  "login",
  "logout",
  "mcp",
  "new",
  "oauth",
  "plektia",
  "privacidad",
  "privacy",
  "robots.txt",
  "settings",
  "signup",
  "sitemap.xml",
  "static",
  "support",
  "terms",
]);

// 3 a 30 caracteres: minúsculas ASCII, números y guiones simples, sin guion al
// borde. Solo ASCII: evita homógrafos (una "е" cirílica que parece una "e").
const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]$/;

export const HandleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(30)
  .regex(HANDLE_PATTERN)
  .brand<"Handle">();

export type Handle = z.infer<typeof HandleSchema>;

export type HandleError = "invalid_handle" | "reserved_handle";

export function parseHandle(input: unknown): Result<Handle, HandleError> {
  const parsed = HandleSchema.safeParse(input);
  if (!parsed.success) return err("invalid_handle");
  if (RESERVED_HANDLES.has(parsed.data)) return err("reserved_handle");
  return ok(parsed.data);
}

/**
 * El handle de una página que puede existir, para leerla: cualquiera que se
 * pueda pedir, más el oficial. Para pedir uno nuevo, `parseHandle`.
 */
export function parseExistingHandle(input: unknown): Result<Handle, HandleError> {
  const parsed = HandleSchema.safeParse(input);
  if (parsed.success && parsed.data === OFFICIAL_HANDLE) return ok(parsed.data);
  return parseHandle(input);
}
