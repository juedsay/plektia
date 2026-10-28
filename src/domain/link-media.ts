import type { Provider } from "@/domain/provider";

// Configuración de medios de un link (SPEC-live-status, historias 1 y 4):
// "Transmito en este canal" y el contenido destacado de YouTube. La base repite
// estas reglas con un trigger, por si alguien escribe sin la app. Este módulo
// no usa zod: lo importa la isla del editor (la validación está en
// link-media-input.ts, que corre en el servidor).

export const FEATURED_MODES = [
  "latest_video",
  "latest_short",
  "latest_stream",
  "pinned",
  "none",
] as const;
export type FeaturedMode = (typeof FEATURED_MODES)[number];

export interface LinkMedia {
  readonly watchLive: boolean;
  readonly featuredMode: FeaturedMode;
  /** ID de 11 caracteres; solo con `featuredMode` "pinned". */
  readonly pinnedVideoId: string | null;
}

/** Lo de un link sin configuración: no se vigila y destaca el último video. */
export const DEFAULT_LINK_MEDIA: LinkMedia = {
  watchLive: false,
  featuredMode: "latest_video",
  pinnedVideoId: null,
};

export interface MediaCapabilities {
  /** Un canal de YouTube, Twitch o Kick: se puede vigilar si está en vivo. */
  readonly canWatchLive: boolean;
  /** Un canal de YouTube: se puede elegir qué contenido destacar. */
  readonly canFeature: boolean;
}

const WATCHABLE: ReadonlySet<Provider> = new Set(["youtube", "twitch", "kick"]);

export function mediaCapabilities(link: {
  readonly provider: Provider;
  readonly providerHandle: string | null;
}): MediaCapabilities {
  const isChannel = link.providerHandle !== null;
  return {
    canWatchLive: isChannel && WATCHABLE.has(link.provider),
    canFeature: isChannel && link.provider === "youtube",
  };
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "m.youtube.com", "music.youtube.com"]);
const VIDEO_PATHS = new Set(["shorts", "live", "embed"]);

/**
 * El ID de un video o Short de YouTube a partir de lo que pega el dueño: la URL
 * (`watch?v=`, `youtu.be/`, `/shorts/`, `/live/`, `/embed/`) o el ID solo.
 * Cualquier otra cosa es `null`: nunca se guarda una URL, solo el ID validado.
 */
export function parseYouTubeVideoId(input: string): string | null {
  const value = input.trim();
  if (VIDEO_ID.test(value)) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const [first = "", second = ""] = url.pathname.split("/").filter(Boolean);
  let candidate: string | null = null;
  if (host === "youtu.be") candidate = first;
  else if (YOUTUBE_HOSTS.has(host)) {
    if (first === "watch") candidate = url.searchParams.get("v");
    else if (VIDEO_PATHS.has(first)) candidate = second;
  }
  return candidate !== null && VIDEO_ID.test(candidate) ? candidate : null;
}

/** Lo que el link admite: pedir otra cosa es un error junto a esa opción. */
export function unsupportedMediaFields(
  media: LinkMedia,
  capabilities: MediaCapabilities,
): Readonly<Record<string, string>> {
  const fields: Record<string, string> = {};
  if (media.watchLive && !capabilities.canWatchLive) {
    fields["watchLive"] = "Solo se vigila un canal de YouTube, Twitch o Kick.";
  }
  if (media.featuredMode !== DEFAULT_LINK_MEDIA.featuredMode && !capabilities.canFeature) {
    fields["featuredMode"] = "El contenido destacado es solo para canales de YouTube.";
  }
  return fields;
}
