import { isAvatarPath } from "@/domain/avatar";

type Fetch = (input: string) => Promise<Response>;

/**
 * Trae un avatar del bucket público para servirlo desde el propio sitio
 * (`/avatars/...`): la página no pide nada a otro dominio y el tipo lo fija el
 * Worker. Solo rutas con la forma de un avatar: nada de pedir otra cosa a Storage.
 */
export function avatarImages(supabaseUrl: string, fetcher: Fetch = (input) => fetch(input)) {
  return async (path: string): Promise<ReadableStream<Uint8Array> | null> => {
    if (!isAvatarPath(path)) return null;
    const response = await fetcher(
      new URL(`/storage/v1/object/public/avatars/${path}`, supabaseUrl).href,
    );
    return response.ok ? response.body : null;
  };
}
