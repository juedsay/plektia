import { z } from "zod";

// Formas de las respuestas de la YouTube Data API v3 que usa el adaptador. Solo
// los campos que se leen; el resto se ignora. Una respuesta que no encaja es
// `invalid_response` (la API cambió o no es la API).

export const ChannelsResponse = z.object({
  items: z.array(z.object({ id: z.string() })).optional(),
});

export const PlaylistItemsResponse = z.object({
  nextPageToken: z.string().optional(),
  items: z
    .array(
      z.object({
        snippet: z.object({ title: z.string(), publishedAt: z.string().optional() }).optional(),
        contentDetails: z.object({
          videoId: z.string(),
          videoPublishedAt: z.string().optional(),
        }),
        status: z.object({ privacyStatus: z.string() }).optional(),
      }),
    )
    .optional(),
});

export const VideosResponse = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        snippet: z
          .object({
            title: z.string(),
            publishedAt: z.string(),
            liveBroadcastContent: z.string().optional(),
          })
          .optional(),
        contentDetails: z.object({ duration: z.string().optional() }).optional(),
        status: z.object({ privacyStatus: z.string() }).optional(),
        liveStreamingDetails: z
          .object({
            actualStartTime: z.string().optional(),
            actualEndTime: z.string().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

export const ErrorResponse = z.object({
  error: z.object({
    code: z.number().optional(),
    errors: z.array(z.object({ reason: z.string().optional() })).optional(),
  }),
});

export type PlaylistItem = NonNullable<z.infer<typeof PlaylistItemsResponse>["items"]>[number];
export type VideoItem = NonNullable<z.infer<typeof VideosResponse>["items"]>[number];

const ISO_DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

/** `PT1H2M3S` → 3723. `null` si no es una duración ISO 8601 de la API. */
export function parseIsoDuration(value: string | undefined): number | null {
  if (!value) return null;
  const match = ISO_DURATION.exec(value);
  if (!match) return null;
  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(days) * 86400 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}
