import { z } from "zod";

import type { LinkMediaRepository, LinkMediaView } from "@/application/ports/link-media-repository";
import type { UseCaseResult } from "@/application/shared/use-case";
import { invalidInput } from "@/domain/errors";
import {
  type LinkMedia,
  mediaCapabilities,
  parseLinkMediaInput,
  unsupportedMediaFields,
} from "@/domain/link-media";
import { err, ok } from "@/domain/result";
import { validate } from "@/domain/text";

const LinkTarget = z.object(
  { linkId: z.uuid({ error: "El link no es válido." }) },
  { error: "Falta el link." },
);

/** `{ linkId }`: la configuración de medios de un link de la página. */
export function getLinkMedia(deps: { media: LinkMediaRepository }) {
  return async (raw: unknown): UseCaseResult<LinkMediaView> => {
    const target = validate(LinkTarget, raw);
    if (!target.ok) return target;
    const view = await deps.media.read(target.value.linkId);
    return view ? ok(view) : err("not_found");
  };
}

/**
 * `{ linkId, watchLive, featuredMode, pinnedVideo? }`: guarda la configuración
 * completa. Cada opción, solo si el link la admite (un canal de YouTube, Twitch
 * o Kick).
 */
export function setLinkMedia(deps: { media: LinkMediaRepository }) {
  return async (raw: unknown): UseCaseResult<LinkMedia> => {
    const target = validate(LinkTarget, raw);
    if (!target.ok) return target;
    const media = parseLinkMediaInput(raw);
    if (!media.ok) return media;

    const view = await deps.media.read(target.value.linkId);
    if (!view) return err("not_found");
    const unsupported = unsupportedMediaFields(media.value, mediaCapabilities(view));
    if (Object.keys(unsupported).length > 0) return err(invalidInput(unsupported));

    return deps.media.save(target.value.linkId, media.value);
  };
}
