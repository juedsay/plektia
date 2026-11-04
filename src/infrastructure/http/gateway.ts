// Puerta de entrada del Worker (ADR 0003): corre en cada pedido, sin caché, y
// le pasa el pedido a la app cacheada. Acá se decide la clave de caché: los
// parámetros de seguimiento que agregan las redes (utm, fbclid…) no cambian la
// página, así que no pueden partir la caché en una entrada por clic.

/** Parámetros de seguimiento que se ignoran en la clave de caché. */
const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
  "dclid",
  "msclkid",
  "igshid",
  "igsh",
  "ttclid",
  "twclid",
  "li_fat_id",
  "mc_cid",
  "mc_eid",
  "_ga",
  "_gl",
]);

const isTracking = (name: string) =>
  name.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.has(name.toLowerCase());

/** El país del visitante viaja en este encabezado: `request.cf` no cruza a la app. */
export const COUNTRY_HEADER = "x-plektia-country";

/**
 * La clave de caché de un pedido sin los parámetros de seguimiento, o `null`
 * si no hay nada que sacar (entonces vale la clave de siempre). Solo GET y
 * HEAD: lo demás nunca se cachea.
 */
export function cacheKeyFor(method: string, url: URL): string | null {
  if (method !== "GET" && method !== "HEAD") return null;
  const kept = [...url.searchParams].filter(([name]) => !isTracking(name));
  if (kept.length === [...url.searchParams].length) return null;
  const search = new URLSearchParams(kept).toString();
  return url.pathname + (search ? `?${search}` : "");
}

/**
 * El pedido que recibe la app: el mismo, con el país de Cloudflare en
 * `COUNTRY_HEADER`. El valor que mande el visitante se descarta siempre, así
 * nadie lo falsea.
 */
export function forwardedRequest(request: Request, country: unknown): Request {
  const forwarded = new Request(request);
  forwarded.headers.delete(COUNTRY_HEADER);
  if (typeof country === "string" && /^[A-Z]{2}$/.test(country)) {
    forwarded.headers.set(COUNTRY_HEADER, country);
  }
  return forwarded;
}
