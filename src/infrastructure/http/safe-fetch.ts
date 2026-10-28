import { err, ok, type Result } from "@/domain/result";

// Pedidos a APIs de terceros (SPEC-live-status, "Seguridad"): solo a hosts de
// una lista fija, por https, sin seguir redirecciones, con tiempo y tamaño
// máximos. Es la segunda barrera contra SSRF (la primera es
// `global_fetch_strictly_public` en wrangler.jsonc).

export type SafeFetchError = "host_not_allowed" | "redirect" | "timeout" | "too_large" | "network";

export interface SafeResponse {
  readonly status: number;
  /** El cuerpo como texto (UTF-8). */
  readonly body: string;
  /** El cuerpo tal cual (para imágenes). */
  readonly bytes: Uint8Array<ArrayBuffer>;
}

export interface SafeFetchOptions {
  /** Hosts exactos permitidos (sin comodines). */
  readonly allowedHosts: readonly string[];
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  /** En los tests, un servidor falso; en el Worker, el `fetch` global. */
  readonly fetcher?: typeof fetch;
}

export type SafeFetch = (
  url: URL,
  init?: { readonly headers?: Readonly<Record<string, string>> },
) => Promise<Result<SafeResponse, SafeFetchError>>;

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_BYTES = 1024 * 1024;

export function createSafeFetch(options: SafeFetchOptions): SafeFetch {
  const allowed = new Set(options.allowedHosts.map((host) => host.toLowerCase()));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  // Envuelto: en Workers, `fetch` guardado y llamado como método pierde su `this`.
  const fetcher = options.fetcher ?? ((input, init) => fetch(input, init));

  return async (url, init) => {
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.port !== "" ||
      !allowed.has(url.hostname.toLowerCase())
    ) {
      return err("host_not_allowed");
    }

    let response: Response;
    try {
      response = await fetcher(url, {
        method: "GET",
        headers: { Accept: "application/json", ...init?.headers },
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      return err(isTimeout(error) ? "timeout" : "network");
    }

    // Ninguna API de la lista redirige: una redirección es un error, no se sigue.
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      return err("redirect");
    }

    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > maxBytes) {
      await response.body?.cancel();
      return err("too_large");
    }

    try {
      const bytes = await readLimited(response, maxBytes);
      if (bytes === null) return err("too_large");
      return ok({ status: response.status, body: new TextDecoder().decode(bytes), bytes });
    } catch (error) {
      return err(isTimeout(error) ? "timeout" : "network");
    }
  };
}

/** Lee el cuerpo cortando en `maxBytes` (el `content-length` puede mentir o faltar). */
async function readLimited(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!response.body) return new Uint8Array(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function isTimeout(error: unknown): boolean {
  return (
    error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")
  );
}
