import { err, ok, type Result } from "@/domain/result";

// URL de un link (SPEC-links, "Reglas de validación"). Solo `https:` y `mailto:`:
// cualquier otro esquema (javascript:, data:, vbscript:, file:…) puede ejecutar
// código o filtrar datos al hacer clic. La base repite la regla con un `check`.

export const MAX_URL_LENGTH = 2048;
const ALLOWED_PROTOCOLS = new Set(["https:", "mailto:"]);
// El navegador descarta tabs y saltos de línea al leer una URL: `java\tscript:`
// termina siendo `javascript:`. Se rechaza cualquier carácter de control.
// eslint-disable-next-line no-control-regex -- detectar caracteres de control es el objetivo.
const CONTROL = /[\u0000-\u001f\u007f]/;
const AUTHORITY_WITH_AT = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*@/i;

/** La URL normalizada (esquema y host en minúsculas, dominios en punycode) o `invalid_url`. */
export function parseSafeUrl(input: unknown): Result<string, "invalid_url"> {
  if (typeof input !== "string") return err("invalid_url");
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH || CONTROL.test(trimmed)) {
    return err("invalid_url");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return err("invalid_url");
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return err("invalid_url");
  // `https://google.com@evil.com` lleva a evil.com: credenciales embebidas = phishing.
  // Se mira el texto original, porque `new URL` borra un `:@` vacío al normalizar.
  if (url.username !== "" || url.password !== "" || AUTHORITY_WITH_AT.test(trimmed)) {
    return err("invalid_url");
  }
  if (url.protocol === "https:" && url.hostname === "") return err("invalid_url");
  if (url.protocol === "mailto:" && !url.pathname.includes("@")) return err("invalid_url");

  const normalized = url.href;
  return normalized.length > MAX_URL_LENGTH ? err("invalid_url") : ok(normalized);
}
