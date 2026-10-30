import type { ImageStorage } from "@/application/ports/image-storage";
import type { LinkReader, LinkWriter } from "@/application/ports/link-repository";
import { alreadyGone } from "@/application/shared/idempotent-delete";
import { parseTarget } from "@/application/shared/target";
import type { UseCaseResult } from "@/application/shared/use-case";

export function deleteLink(deps: {
  links: LinkWriter;
  /**
   * Desde el panel: la imagen de la vista previa del link (SPEC-link-form, 7c-2)
   * se borra con él, así no queda un archivo huérfano en el bucket.
   */
  previewImages?: { readonly reader: LinkReader; readonly storage: ImageStorage };
}) {
  return async (raw: unknown): UseCaseResult<void> => {
    const target = parseTarget(raw);
    if (!target.ok) return target;
    const imagePath = deps.previewImages
      ? (await deps.previewImages.reader.listOwn()).links.find(
          (link) => link.id === target.value.id,
        )?.previewImagePath
      : null;
    const deleted = alreadyGone(await deps.links.deleteLink(target.value.id, target.value.version));
    if (deleted.ok && imagePath) await deps.previewImages?.storage.remove(imagePath);
    return deleted;
  };
}
