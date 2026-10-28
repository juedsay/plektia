import { AVATAR_MAX_BYTES, avatarContentType, inspectAvatar } from "@/domain/avatar";

type Fetch = (input: string) => Promise<Response>;

export interface AvatarImage {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly contentType: string;
}

/**
 * Trae un avatar del bucket público para servirlo desde el propio sitio
 * (`/avatars/...`): la página no pide nada a otro dominio y el tipo lo fija el
 * Worker. Solo rutas con la forma de un avatar llegan a Storage, y lo que vuelve
 * se valida otra vez antes de servirlo (si algo raro quedara en el bucket, no sale).
 */
export function avatarImages(supabaseUrl: string, fetcher: Fetch = (input) => fetch(input)) {
  return async (path: string): Promise<AvatarImage | null> => {
    const contentType = avatarContentType(path);
    if (!contentType) return null;
    const response = await fetcher(
      new URL(`/storage/v1/object/public/avatars/${path}`, supabaseUrl).href,
    );
    if (!response.ok) return null;
    // Se corta antes de leer algo más grande que un avatar.
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > AVATAR_MAX_BYTES) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());
    const inspected = inspectAvatar(bytes);
    // Tiene que ser lo que dice su extensión: un `.jpg` con un WebP adentro no sale.
    if (!inspected.ok || contentType !== typeFor(inspected.value.format)) return null;
    return { bytes, contentType };
  };
}

const typeFor = (format: "webp" | "jpeg") => (format === "webp" ? "image/webp" : "image/jpeg");
