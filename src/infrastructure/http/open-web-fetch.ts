import { err, ok, type Result } from "@/domain/result";
import { isTimeout, readLimited } from "@/infrastructure/http/safe-fetch";

// Pedidos a la web abierta (SPEC-link-form, 7c): la vista previa de un artículo
// que eligió el dueño. A diferencia de `safe-fetch` no hay lista de hosts, así
// que se valida cada destino: solo https al puerto 443, sin credenciales, sin IPs
// ni nombres internos, y nunca el propio Plektia. Las redirecciones se siguen a
// mano (hasta 3) y cada una se vuelve a validar. La primera barrera contra SSRF
// sigue siendo `global_fetch_strictly_public` en wrangler.jsonc.

export type OpenWebError =
  | "blocked"
  | "too_many_redirects"
  | "timeout"
  | "too_large"
  | "network"
  | "http_error"
  | "wrong_type";

export interface OpenWebResponse {
  /** Adónde se llegó después de las redirecciones (para resolver rutas relativas). */
  readonly finalUrl: URL;
  readonly contentType: string;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

export interface OpenWebOptions {
  /** Hosts exactos que no se piden nunca (el propio sitio). */
  readonly blockedHosts: readonly string[];
  /** Dominios que no se piden, con sus subdominios (`workers.dev`). */
  readonly blockedDomains?: readonly string[];
  readonly userAgent: string;
  readonly timeoutMs?: number;
  readonly maxRedirects?: number;
  /** En los tests, un servidor falso; en el Worker, el `fetch` global. */
  readonly fetcher?: typeof fetch;
}

export type OpenWebFetch = (
  url: URL,
  expect: { readonly accept: string; readonly types: readonly string[]; readonly maxBytes: number },
) => Promise<Result<OpenWebResponse, OpenWebError>>;

/** Terminaciones que nunca son un sitio público. */
const PRIVATE_SUFFIXES = [
  "localhost",
  "local",
  "internal",
  "test",
  "invalid",
  "arpa",
  "example",
  "onion",
  "home",
  "lan",
  "corp",
];

/** Si se puede pedir: https, puerto 443, sin credenciales, y un nombre público. */
export function isOpenWebTarget(
  url: URL,
  options: Pick<OpenWebOptions, "blockedHosts" | "blockedDomains">,
): boolean {
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return false;
  if (url.port !== "" && url.port !== "443") return false;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  // IPv6 entre corchetes, o IPv4 (el parser de URL ya normaliza 0x7f.1 y 2130706433).
  if (host.startsWith("[") || /^\d+(\.\d+){3}$/.test(host)) return false;
  // Un nombre sin punto ("intranet") es interno.
  if (!host.includes(".")) return false;
  const lastLabel = host.slice(host.lastIndexOf(".") + 1);
  if (PRIVATE_SUFFIXES.includes(lastLabel)) return false;
  if (options.blockedHosts.some((blocked) => blocked.toLowerCase() === host)) return false;
  return !(options.blockedDomains ?? []).some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_REDIRECTS = 3;

export function createOpenWebFetch(options: OpenWebOptions): OpenWebFetch {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  // Envuelto: en Workers, `fetch` guardado y llamado como método pierde su `this`.
  const fetcher = options.fetcher ?? ((input, init) => fetch(input, init));

  return async (start, expect) => {
    // Un solo reloj para todo el recorrido, redirecciones incluidas.
    const signal = AbortSignal.timeout(timeoutMs);
    let url = start;
    for (let hop = 0; ; hop += 1) {
      if (!isOpenWebTarget(url, options)) return err("blocked");
      let response: Response;
      try {
        response = await fetcher(url, {
          method: "GET",
          // Sin cookies ni cabeceras del usuario: solo lo mínimo.
          headers: { Accept: expect.accept, "User-Agent": options.userAgent },
          redirect: "manual",
          credentials: "omit",
          signal,
        });
      } catch (error) {
        return err(isTimeout(error) ? "timeout" : "network");
      }

      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location || hop >= maxRedirects) return err("too_many_redirects");
        try {
          url = new URL(location, url);
        } catch {
          return err("network");
        }
        continue;
      }

      if (response.status < 200 || response.status >= 300) {
        await response.body?.cancel();
        return err("http_error");
      }
      const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
      if (!expect.types.some((type) => contentType.startsWith(type))) {
        await response.body?.cancel();
        return err("wrong_type");
      }
      const declared = Number(response.headers.get("content-length") ?? "0");
      if (declared > expect.maxBytes) {
        await response.body?.cancel();
        return err("too_large");
      }
      try {
        const bytes = await readLimited(response, expect.maxBytes);
        if (bytes === null) return err("too_large");
        return ok({ finalUrl: url, contentType, bytes });
      } catch (error) {
        return err(isTimeout(error) ? "timeout" : "network");
      }
    }
  };
}
