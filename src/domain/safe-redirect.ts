// Destino después del login (`/login?next=…`). Solo se aceptan rutas internas:
// cualquier otra cosa sería un open redirect hacia un sitio ajeno.

export const DEFAULT_REDIRECT = "/admin";

const MAX_LENGTH = 2048;
// Caracteres de control (incluidos tab y saltos de línea, que el navegador
// descarta al interpretar la URL) y barras invertidas, que trata como `/`.
const FORBIDDEN = /[\u0000-\u001f\u007f\\]/;
const BASE = "https://plektia.invalid";

export function safeRedirectPath(input: unknown): string {
  if (typeof input !== "string" || input.length > MAX_LENGTH) return DEFAULT_REDIRECT;
  // Una sola barra inicial: `//host` es una URL de otro sitio.
  if (!input.startsWith("/") || input.startsWith("//")) return DEFAULT_REDIRECT;
  if (FORBIDDEN.test(input)) return DEFAULT_REDIRECT;

  // Segunda barrera: resuelta contra un origen propio, tiene que seguir en él.
  let url: URL;
  try {
    url = new URL(input, BASE);
  } catch {
    return DEFAULT_REDIRECT;
  }
  if (url.origin !== BASE) return DEFAULT_REDIRECT;

  return input;
}
