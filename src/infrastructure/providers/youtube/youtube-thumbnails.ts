import type { SafeFetch } from "@/infrastructure/http/safe-fetch";

// Miniaturas de YouTube servidas desde el propio sitio (`/thumbs/{id}.jpg`): la
// página pública no le pide nada a otro dominio (ni la IP de quien la visita
// llega a Google). Solo IDs válidos salen hacia `i.ytimg.com`, y lo que vuelve
// tiene que ser un JPEG chico antes de servirlo.

export const THUMBNAIL_HOST = "i.ytimg.com";
const FILE = /^([A-Za-z0-9_-]{11})\.jpg$/;
/** `hqdefault` (480 × 360) existe para todo video; pesa unos 20 a 40 KB. */
const MAX_BYTES = 200 * 1024;

export interface Thumbnail {
  readonly bytes: Uint8Array<ArrayBuffer>;
}

/**
 * `fetchBytes` trae el cuerpo binario de una URL de la lista (ver `createSafeFetch`):
 * en el Worker, con la misma barrera de hosts, tiempo y tamaño.
 */
export type BinaryFetch = (
  url: URL,
) => Promise<{ status: number; bytes: Uint8Array<ArrayBuffer> } | null>;

export function youtubeThumbnails(fetchBytes: BinaryFetch) {
  return async (file: string): Promise<Thumbnail | null> => {
    const videoId = FILE.exec(file)?.[1];
    if (!videoId) return null;
    const answer = await fetchBytes(
      new URL(`https://${THUMBNAIL_HOST}/vi/${videoId}/hqdefault.jpg`),
    );
    // Un video borrado devuelve 404 con una imagen gris: no se sirve.
    if (answer?.status !== 200) return null;
    const { bytes } = answer;
    if (bytes.byteLength < 3 || bytes.byteLength > MAX_BYTES) return null;
    // Tiene que ser un JPEG de verdad (FF D8 FF), no lo que diga el header.
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
    return { bytes };
  };
}

/** Un `BinaryFetch` con la barrera de `SafeFetch` (lista de hosts, https, sin redirecciones). */
export function binaryFetchFrom(safeFetch: SafeFetch): BinaryFetch {
  return async (url) => {
    const response = await safeFetch(url, { headers: { Accept: "image/jpeg" } });
    if (!response.ok) return null;
    return { status: response.value.status, bytes: response.value.bytes };
  };
}
