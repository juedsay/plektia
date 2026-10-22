// Red social y usuario de un link, para mostrar el ícono y "@usuario" en la
// página pública. Es presentación: no reemplaza a `detectProvider` (dominio),
// que solo marca los canales que `live-status` puede vigilar.

export const SOCIAL_NETWORKS = [
  "instagram",
  "linkedin",
  "twitch",
  "github",
  "youtube",
  "x",
  "tiktok",
  "kick",
  "facebook",
  "threads",
  "bluesky",
] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export interface SocialProfile {
  readonly network: SocialNetwork;
  /** Nombre visible de la red ("LinkedIn"), para el texto alternativo del ícono. */
  readonly label: string;
  /** Usuario sin "@", o `null` si el link es de la red pero no a un perfil. */
  readonly username: string | null;
}

interface NetworkRule {
  readonly network: SocialNetwork;
  readonly label: string;
  readonly hosts: readonly string[];
  /** Extrae el usuario de los segmentos de la ruta, o `null` si no es un perfil. */
  readonly usernameFrom: (segments: readonly string[]) => string | null;
}

/** Un único segmento que cumple el formato y no es una ruta propia de la red. */
function singleSegment(pattern: RegExp, reserved: readonly string[] = []) {
  return (segments: readonly string[]) => {
    const [first = ""] = segments;
    return segments.length === 1 && pattern.test(first) && !reserved.includes(first.toLowerCase())
      ? first
      : null;
  };
}

/** Un único segmento que empieza con "@" (TikTok, Threads): se devuelve sin la arroba. */
function atSegment(pattern: RegExp) {
  return (segments: readonly string[]) => {
    const [first = ""] = segments;
    return segments.length === 1 && first.startsWith("@") && pattern.test(first.slice(1))
      ? first.slice(1)
      : null;
  };
}

/** Un prefijo fijo seguido del usuario: `/in/{usuario}`, `/profile/{usuario}`. */
function afterPrefix(prefix: string, pattern: RegExp) {
  return (segments: readonly string[]) => {
    const [first = "", second = ""] = segments;
    return segments.length === 2 && first === prefix && pattern.test(second) ? second : null;
  };
}

const RULES: readonly NetworkRule[] = [
  {
    network: "instagram",
    label: "Instagram",
    hosts: ["instagram.com"],
    usernameFrom: singleSegment(/^[A-Za-z0-9._]{1,30}$/, [
      "p",
      "reel",
      "reels",
      "explore",
      "stories",
      "accounts",
      "direct",
      "tv",
    ]),
  },
  {
    network: "linkedin",
    label: "LinkedIn",
    hosts: ["linkedin.com"],
    usernameFrom: afterPrefix("in", /^[A-Za-z0-9_-]{3,100}$/),
  },
  {
    network: "twitch",
    label: "Twitch",
    hosts: ["twitch.tv"],
    usernameFrom: singleSegment(/^[A-Za-z0-9_]{1,25}$/, [
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
    ]),
  },
  {
    network: "github",
    label: "GitHub",
    hosts: ["github.com"],
    usernameFrom: singleSegment(/^[A-Za-z0-9-]{1,39}$/, [
      "features",
      "explore",
      "topics",
      "marketplace",
      "pricing",
      "sponsors",
      "settings",
      "login",
      "about",
      "orgs",
    ]),
  },
  {
    network: "youtube",
    label: "YouTube",
    hosts: ["youtube.com"],
    usernameFrom: atSegment(/^[A-Za-z0-9._-]{3,30}$/),
  },
  {
    network: "x",
    label: "X",
    hosts: ["x.com", "twitter.com"],
    usernameFrom: singleSegment(/^[A-Za-z0-9_]{1,15}$/, [
      "home",
      "explore",
      "i",
      "search",
      "settings",
      "intent",
      "share",
      "hashtag",
      "messages",
      "notifications",
    ]),
  },
  {
    network: "tiktok",
    label: "TikTok",
    hosts: ["tiktok.com"],
    usernameFrom: atSegment(/^[A-Za-z0-9._]{2,24}$/),
  },
  {
    network: "kick",
    label: "Kick",
    hosts: ["kick.com"],
    usernameFrom: singleSegment(/^[A-Za-z0-9_-]{1,30}$/, ["categories", "browse", "following"]),
  },
  {
    network: "facebook",
    label: "Facebook",
    hosts: ["facebook.com"],
    usernameFrom: singleSegment(/^[A-Za-z0-9.]{5,50}$/, [
      "groups",
      "pages",
      "events",
      "watch",
      "marketplace",
      "share",
      "sharer",
      "gaming",
    ]),
  },
  {
    network: "threads",
    label: "Threads",
    hosts: ["threads.net", "threads.com"],
    usernameFrom: atSegment(/^[A-Za-z0-9._]{1,30}$/),
  },
  {
    network: "bluesky",
    label: "Bluesky",
    hosts: ["bsky.app"],
    usernameFrom: afterPrefix("profile", /^[A-Za-z0-9.-]{3,253}$/),
  },
];

/** Prefijos de host que no cambian la red (`www.instagram.com`, `m.facebook.com`). */
const HOST_PREFIXES = /^(www|m|mobile)\./;

/** Red social de un link (por host exacto) y, si apunta a un perfil, su usuario. */
export function socialProfileFor(rawUrl: string): SocialProfile | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(HOST_PREFIXES, "");
  const rule = RULES.find((candidate) => candidate.hosts.includes(host));
  if (!rule) return null;
  const segments = url.pathname.split("/").filter(Boolean).map(decodeSegment);
  return { network: rule.network, label: rule.label, username: rule.usernameFrom(segments) };
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
