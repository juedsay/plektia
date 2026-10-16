// Proveedor de un link a partir de su URL (SPEC-links, "Detección de proveedor").
// Solo compara el host exacto (con o sin `www.`): `youtube.com.evil.com` es
// genérico. El `handle` es el canal que `live-status` puede vigilar; resolver un
// `@handle` al ID `UC…` le toca a él, porque necesita la API de YouTube.

export const PROVIDERS = [
  "generic",
  "youtube",
  "twitch",
  "kick",
  "whatsapp",
  "github",
  "instagram",
] as const;
export type Provider = (typeof PROVIDERS)[number];

export interface DetectedProvider {
  readonly provider: Provider;
  readonly handle: string | null;
}

const HOSTS: Readonly<Record<string, Exclude<Provider, "generic">>> = {
  "youtube.com": "youtube",
  "twitch.tv": "twitch",
  "kick.com": "kick",
  "wa.me": "whatsapp",
  "whatsapp.com": "whatsapp",
  "api.whatsapp.com": "whatsapp",
  "github.com": "github",
  "instagram.com": "instagram",
};

const YOUTUBE_HANDLE = /^@[A-Za-z0-9._-]{3,30}$/;
const YOUTUBE_CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const TWITCH_LOGIN = /^[a-z0-9_]{1,25}$/;
const KICK_SLUG = /^[a-z0-9_-]{1,30}$/;
// Rutas de Twitch que no son canales.
const TWITCH_RESERVED = new Set([
  "directory",
  "videos",
  "search",
  "settings",
  "subscriptions",
  "inventory",
  "wallet",
  "drops",
  "downloads",
  "jobs",
  "turbo",
  "p",
]);

const GENERIC: DetectedProvider = { provider: "generic", handle: null };

export function detectProvider(rawUrl: string): DetectedProvider {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return GENERIC;
  }
  if (url.protocol !== "https:") return GENERIC;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const provider = HOSTS[host];
  if (!provider) return GENERIC;

  const segments = url.pathname.split("/").filter(Boolean);
  return { provider, handle: handleFor(provider, segments) };
}

function handleFor(provider: Provider, segments: readonly string[]): string | null {
  const [first = "", second = ""] = segments;
  switch (provider) {
    case "youtube":
      if (YOUTUBE_HANDLE.test(first)) return first;
      if (first === "channel" && YOUTUBE_CHANNEL_ID.test(second)) return second;
      return null;
    case "twitch": {
      const login = first.toLowerCase();
      return segments.length === 1 && TWITCH_LOGIN.test(login) && !TWITCH_RESERVED.has(login)
        ? login
        : null;
    }
    case "kick": {
      const slug = first.toLowerCase();
      return segments.length === 1 && KICK_SLUG.test(slug) ? slug : null;
    }
    default:
      return null;
  }
}
