// De dónde llega una visita (SPEC-click-analytics, "Cómo se mide"). Se calcula
// en el navegador y solo viaja la categoría: nunca el referer ni el user agent.
// Sin zod: lo usa el script de la página pública.

export const TRAFFIC_SOURCES = [
  "instagram",
  "tiktok",
  "x",
  "youtube",
  "facebook",
  "linkedin",
  "whatsapp",
  "direct",
  "other",
] as const;
export type TrafficSource = (typeof TRAFFIC_SOURCES)[number];

// Los navegadores embebidos de las apps se declaran en el user agent (y suelen
// no mandar referer). El orden importa: Facebook marca también a Instagram.
const IN_APP: readonly [RegExp, TrafficSource][] = [
  [/\bInstagram\b/, "instagram"],
  [/\b(musical_ly|TikTok|BytedanceWebview)\b/i, "tiktok"],
  [/\b(FBAN|FBAV|FB_IAB|FBIOS)\b/, "facebook"],
  [/\bLinkedInApp\b/, "linkedin"],
  [/\bTwitter(Android)?\b/, "x"],
  [/\bWhatsApp\b/, "whatsapp"],
];

const HOSTS: Readonly<Record<string, TrafficSource>> = {
  "instagram.com": "instagram",
  "l.instagram.com": "instagram",
  "tiktok.com": "tiktok",
  "vm.tiktok.com": "tiktok",
  "t.co": "x",
  "x.com": "x",
  "twitter.com": "x",
  "youtube.com": "youtube",
  "m.youtube.com": "youtube",
  "youtu.be": "youtube",
  "facebook.com": "facebook",
  "m.facebook.com": "facebook",
  "l.facebook.com": "facebook",
  "lm.facebook.com": "facebook",
  "fb.com": "facebook",
  "linkedin.com": "linkedin",
  "lnkd.in": "linkedin",
  "whatsapp.com": "whatsapp",
  "web.whatsapp.com": "whatsapp",
  "wa.me": "whatsapp",
};

/**
 * La categoría de origen: primero la app que declara el user agent, después el
 * dominio del referer. Sin referer (o desde el propio sitio) es "direct".
 */
export function classifySource(
  referrer: string,
  userAgent: string,
  ownHost: string,
): TrafficSource {
  for (const [pattern, source] of IN_APP) {
    if (pattern.test(userAgent)) return source;
  }
  if (!referrer) return "direct";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "other";
  }
  if (host === ownHost.toLowerCase().replace(/^www\./, "")) return "direct";
  return HOSTS[host] ?? "other";
}
