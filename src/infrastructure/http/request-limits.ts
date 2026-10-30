// Cuánto puede pesar el cuerpo de un pedido (regla pura; la aplica un
// middleware). Se mira el `Content-Length` antes de leer nada: un archivo
// gigante o un formulario inflado se cortan sin llegar a la Action.

/** La subida del avatar: la imagen (≤ 200 KB) más el resto del formulario. */
export const AVATAR_UPLOAD_LIMIT = 256 * 1024;
/** La imagen de la vista previa de un artículo (≤ 80 KB) más el formulario. */
export const PREVIEW_IMAGE_UPLOAD_LIMIT = 128 * 1024;
/** Cualquier otro envío (formularios y Actions del panel). */
export const DEFAULT_BODY_LIMIT = 64 * 1024;

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH"]);
const AVATAR_UPLOAD_PATHS = new Set(["/_actions/pages.setavatar"]);

export type BodyCheck = { readonly ok: true } | { readonly ok: false; readonly status: 411 | 413 };

export function checkBodySize(request: {
  method: string;
  pathname: string;
  /** La cabecera tal cual (o `null` si no vino). */
  contentLength: string | null;
  /** Las Actions de formulario también llegan como `?_action=` a la página. */
  search: string;
}): BodyCheck {
  if (!METHODS_WITH_BODY.has(request.method)) return { ok: true };
  // Sin largo declarado no se sabe cuánto va a llegar: se pide que lo declare.
  if (request.contentLength === null) return { ok: false, status: 411 };
  const declared = Number(request.contentLength);
  if (!Number.isSafeInteger(declared) || declared < 0) return { ok: false, status: 411 };

  const path = request.pathname.toLowerCase();
  const action = new URLSearchParams(request.search).get("_action")?.toLowerCase();
  const isAvatarUpload = AVATAR_UPLOAD_PATHS.has(path) || action === "pages.setavatar";
  const isPreviewUpload = path === "/_actions/links.setpreviewimage";
  const limit = isAvatarUpload
    ? AVATAR_UPLOAD_LIMIT
    : isPreviewUpload
      ? PREVIEW_IMAGE_UPLOAD_LIMIT
      : DEFAULT_BODY_LIMIT;
  return declared > limit ? { ok: false, status: 413 } : { ok: true };
}
