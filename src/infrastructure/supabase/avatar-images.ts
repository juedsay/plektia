import type { AvatarError, AvatarFormat, InspectedAvatar } from "@/domain/avatar";
import { AVATAR_MAX_BYTES, avatarContentType, inspectAvatar } from "@/domain/avatar";
import {
  inspectPreviewImage,
  PREVIEW_IMAGE_MAX_BYTES,
  previewImageContentType,
} from "@/domain/link-preview-image";
import type { Result } from "@/domain/result";

type Fetch = (input: string) => Promise<Response>;

export interface AvatarImage {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly contentType: string;
}

interface BucketRules {
  readonly bucket: string;
  readonly contentTypeOf: (path: string) => string | null;
  readonly maxBytes: number;
  readonly inspect: (bytes: Uint8Array) => Result<InspectedAvatar, AvatarError>;
}

/**
 * Trae una imagen de un bucket público para servirla desde el propio sitio: la
 * página no pide nada a otro dominio y el tipo lo fija el Worker. Solo rutas con
 * la forma esperada llegan a Storage, y lo que vuelve se valida otra vez antes de
 * servirlo (si algo raro quedara en el bucket, no sale).
 */
function bucketImages(rules: BucketRules, supabaseUrl: string, fetcher: Fetch) {
  return async (path: string): Promise<AvatarImage | null> => {
    const contentType = rules.contentTypeOf(path);
    if (!contentType) return null;
    const response = await fetcher(
      new URL(`/storage/v1/object/public/${rules.bucket}/${path}`, supabaseUrl).href,
    );
    if (!response.ok) return null;
    // Se corta antes de leer algo más grande de lo que puede ser.
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > rules.maxBytes) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());
    const inspected = rules.inspect(bytes);
    // Tiene que ser lo que dice su extensión: un `.jpg` con un WebP adentro no sale.
    if (!inspected.ok || contentType !== typeFor(inspected.value.format)) return null;
    return { bytes, contentType };
  };
}

/** Los avatares, para `/avatars/...`. */
export function avatarImages(supabaseUrl: string, fetcher: Fetch = (input) => fetch(input)) {
  return bucketImages(
    {
      bucket: "avatars",
      contentTypeOf: avatarContentType,
      maxBytes: AVATAR_MAX_BYTES,
      inspect: inspectAvatar,
    },
    supabaseUrl,
    fetcher,
  );
}

/** Las imágenes de las vistas previas, para `/link-previews/...` (SPEC-link-form, 7c-2). */
export function linkPreviewImages(supabaseUrl: string, fetcher: Fetch = (input) => fetch(input)) {
  return bucketImages(
    {
      bucket: "link-previews",
      contentTypeOf: previewImageContentType,
      maxBytes: PREVIEW_IMAGE_MAX_BYTES,
      inspect: inspectPreviewImage,
    },
    supabaseUrl,
    fetcher,
  );
}

const typeFor = (format: AvatarFormat) => (format === "webp" ? "image/webp" : "image/jpeg");
