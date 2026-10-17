import { z } from "zod";

import { err, ok, type Result } from "@/domain/result";

// Rutas propias de la app que no pueden ser el handle de nadie. La base valida
// la misma lista (`private.is_reserved_handle`); un test verifica que coincidan.
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  "_astro",
  ".well-known",
  "about",
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "contacto",
  "favicon.ico",
  "help",
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
