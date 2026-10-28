import { z } from "zod";

import type { InvalidInput } from "@/domain/errors";
import { FEATURED_MODES, type LinkMedia, parseYouTubeVideoId } from "@/domain/link-media";
import { map, type Result } from "@/domain/result";
import { validate } from "@/domain/text";

// Validación de la configuración de medios que llega del panel (SPEC-live-status).

const LinkMediaInputSchema = z
  .object(
    {
      watchLive: z.boolean({ error: "Transmitir en el canal tiene que ser sí o no." }),
      featuredMode: z.enum(FEATURED_MODES, { error: "Elegí qué contenido destacar." }),
      pinnedVideo: z
        .string({ error: "El video fijado tiene que ser un texto." })
        .max(2048, { error: "La URL del video es demasiado larga." })
        .nullish(),
    },
    { error: "La configuración del link no es válida." },
  )
  .transform((input, context) => {
    if (input.featuredMode !== "pinned") {
      return { watchLive: input.watchLive, featuredMode: input.featuredMode, pinnedVideoId: null };
    }
    const pinnedVideoId = parseYouTubeVideoId(input.pinnedVideo ?? "");
    if (pinnedVideoId === null) {
      context.addIssue({
        code: "custom",
        path: ["pinnedVideo"],
        message: "Pegá el link de un video o Short de YouTube.",
      });
      return z.NEVER;
    }
    return { watchLive: input.watchLive, featuredMode: input.featuredMode, pinnedVideoId };
  });

/**
 * `{ watchLive, featuredMode, pinnedVideo? }` → la configuración completa, que
 * reemplaza la anterior (así repetir el pedido deja lo mismo).
 */
export function parseLinkMediaInput(raw: unknown): Result<LinkMedia, InvalidInput> {
  return map(validate(LinkMediaInputSchema, raw), (media): LinkMedia => media);
}
