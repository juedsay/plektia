import { z } from "zod";

import type { AvatarStorage } from "@/application/ports/avatar-storage";
import type { PageCache } from "@/application/ports/page-cache";
import type { Page, PageReader, PageWriter } from "@/application/ports/page-repository";
import type { UseCaseResult } from "@/application/shared/use-case";
import { AVATAR_MAX_BYTES, avatarErrorMessage, avatarPath, inspectAvatar } from "@/domain/avatar";
import { invalidInput } from "@/domain/errors";
import { err, ok } from "@/domain/result";
import { validate } from "@/domain/text";

const PageIdSchema = z.object(
  { pageId: z.uuid({ error: "El identificador no es válido." }) },
  { error: "Falta la página." },
);

/** La imagen subida: el peso se mira antes de leerla. */
export interface UploadedImage {
  readonly size: number;
  bytes(): Promise<Uint8Array>;
}

interface Deps {
  readonly pages: PageReader & PageWriter;
  readonly avatars: AvatarStorage;
  readonly cache: PageCache;
  /** La cuenta de la sesión: su carpeta del bucket. */
  readonly ownerId: string;
  /** Nombre nuevo para cada archivo (así la caché de un año nunca sirve uno viejo). */
  readonly newFileId?: () => string;
}

/** La página propia de ese id, o `not_found` (también si es de otra cuenta). */
async function ownPage(pages: PageReader, raw: unknown) {
  const target = validate(PageIdSchema, raw);
  if (!target.ok) return target;
  const page = (await pages.listOwn()).find((candidate) => candidate.id === target.value.pageId);
  return page ? ok(page) : err("not_found" as const);
}

/**
 * Cambia el avatar de una página (SPEC-admin-panel, "Avatar"): valida el WebP
 * otra vez con sus bytes, lo sube con un nombre nuevo, lo pone en la página,
 * borra el anterior y purga la página pública.
 */
export function setPageAvatar({
  pages,
  avatars,
  cache,
  ownerId,
  newFileId = () => crypto.randomUUID(),
}: Deps) {
  return async (raw: unknown, image: UploadedImage | null): UseCaseResult<Page> => {
    const page = await ownPage(pages, raw);
    if (!page.ok) return page;
    if (!image) return err(invalidInput({ avatar: "Elegí una imagen." }));

    // Un archivo gigante se rechaza sin leerlo.
    if (image.size > AVATAR_MAX_BYTES) {
      return err(invalidInput({ avatar: avatarErrorMessage("too_large") }));
    }
    const bytes = await image.bytes();
    const inspected = inspectAvatar(bytes);
    if (!inspected.ok) return err(invalidInput({ avatar: avatarErrorMessage(inspected.error) }));

    const path = avatarPath(ownerId, newFileId());
    const uploaded = await avatars.upload(path, bytes);
    if (!uploaded.ok) {
      return err(invalidInput({ avatar: "No pudimos guardar la imagen. Probá de nuevo." }));
    }

    const updated = await pages.setAvatar(page.value.id, path);
    if (!updated.ok) {
      // La página no quedó con el archivo nuevo: no se deja huérfano.
      await avatars.remove(path);
      return updated;
    }
    if (page.value.avatarPath) await avatars.remove(page.value.avatarPath);
    await cache.purgeProfile(updated.value.handle);
    return ok(updated.value);
  };
}

/** Saca el avatar de una página: vuelve la inicial y se borra el archivo. */
export function removePageAvatar({ pages, avatars, cache }: Omit<Deps, "ownerId" | "newFileId">) {
  return async (raw: unknown): UseCaseResult<Page> => {
    const page = await ownPage(pages, raw);
    if (!page.ok) return page;
    // Sin avatar ya: el resultado buscado se cumple (idempotente).
    if (!page.value.avatarPath) return ok(page.value);

    const updated = await pages.setAvatar(page.value.id, null);
    if (!updated.ok) return updated;
    await avatars.remove(page.value.avatarPath);
    await cache.purgeProfile(updated.value.handle);
    return ok(updated.value);
  };
}
