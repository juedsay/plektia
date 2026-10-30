import { z } from "zod";

import type { ImageStorage } from "@/application/ports/image-storage";
import type { Link, LinkReader, LinkWriter } from "@/application/ports/link-repository";
import type { UseCaseResult } from "@/application/shared/use-case";
import { invalidInput } from "@/domain/errors";
import {
  inspectPreviewImage,
  PREVIEW_IMAGE_MAX_BYTES,
  previewImageErrorMessage,
  previewImagePath,
} from "@/domain/link-preview-image";
import { err, ok } from "@/domain/result";
import { validate } from "@/domain/text";

// Imagen de la vista previa de un artículo (SPEC-link-form, 7c-2): la que el
// panel recortó y re-codificó. Se valida otra vez con sus bytes, se sube con un
// nombre nuevo, se pone en el link y se borra la anterior.

const TargetSchema = z.object(
  {
    id: z.uuid({ error: "El link no es válido." }),
    version: z.coerce.number({ error: "La versión no es válida." }).int().positive(),
  },
  { error: "Falta el link." },
);

/** La imagen subida: el peso se mira antes de leerla. */
export interface UploadedImage {
  readonly size: number;
  bytes(): Promise<Uint8Array>;
}

interface Deps {
  readonly links: LinkReader & LinkWriter;
  readonly images: ImageStorage;
  /** La cuenta de la sesión: su carpeta del bucket. */
  readonly ownerId: string;
  readonly newFileId?: () => string;
}

async function ownLink(links: LinkReader, raw: unknown) {
  const target = validate(TargetSchema, raw);
  if (!target.ok) return target;
  const link = (await links.listOwn()).links.find((candidate) => candidate.id === target.value.id);
  return link ? ok({ link, version: target.value.version }) : err("not_found" as const);
}

export function setLinkPreviewImage({
  links,
  images,
  ownerId,
  newFileId = () => crypto.randomUUID(),
}: Deps) {
  return async (raw: unknown, image: UploadedImage | null): UseCaseResult<Link> => {
    const target = await ownLink(links, raw);
    if (!target.ok) return target;
    if (!image) return err(invalidInput({ image: "Falta la imagen." }));
    // Un archivo gigante se rechaza sin leerlo.
    if (image.size > PREVIEW_IMAGE_MAX_BYTES) {
      return err(invalidInput({ image: previewImageErrorMessage("too_large") }));
    }
    const bytes = await image.bytes();
    const inspected = inspectPreviewImage(bytes);
    if (!inspected.ok) {
      return err(invalidInput({ image: previewImageErrorMessage(inspected.error) }));
    }

    const path = previewImagePath(ownerId, newFileId(), inspected.value.format);
    const uploaded = await images.upload(path, bytes);
    if (!uploaded.ok) {
      return err(invalidInput({ image: "No pudimos guardar la imagen. Probá de nuevo." }));
    }
    const updated = await links.updateLink(target.value.link.id, target.value.version, {
      previewImagePath: path,
    });
    if (!updated.ok) {
      // El link no quedó con el archivo nuevo: no se deja huérfano.
      await images.remove(path);
      return updated;
    }
    const previous = target.value.link.previewImagePath;
    if (previous) await images.remove(previous);
    return ok(updated.value);
  };
}

/** Saca la imagen de un link y borra el archivo; sin imagen ya, no hace nada. */
export function removeLinkPreviewImage({ links, images }: Omit<Deps, "ownerId" | "newFileId">) {
  return async (raw: unknown): UseCaseResult<Link> => {
    const target = await ownLink(links, raw);
    if (!target.ok) return target;
    const previous = target.value.link.previewImagePath;
    if (!previous) return ok(target.value.link);
    const updated = await links.updateLink(target.value.link.id, target.value.version, {
      previewImagePath: null,
    });
    if (!updated.ok) return updated;
    await images.remove(previous);
    return ok(updated.value);
  };
}
