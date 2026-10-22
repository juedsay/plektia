// Destinos de la ventana de compartir. Son links comunes que se abren al
// tocarlos: la página no le pide nada a ningún tercero al cargar.

export type ShareTargetId = "whatsapp" | "x" | "facebook" | "linkedin" | "telegram" | "email";

export interface ShareTarget {
  readonly id: ShareTargetId;
  readonly label: string;
  readonly href: string;
}

/** URL de cada destino con el link y el texto codificados (nada se interpola crudo). */
export function shareTargets(url: string, title: string): ShareTarget[] {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const both = encodeURIComponent(`${title} ${url}`);
  return [
    { id: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${both}` },
    { id: "x", label: "X", href: `https://x.com/intent/post?text=${t}&url=${u}` },
    {
      id: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    },
    { id: "telegram", label: "Telegram", href: `https://t.me/share/url?url=${u}&text=${t}` },
    { id: "email", label: "Email", href: `mailto:?subject=${t}&body=${u}` },
  ];
}

/** `https://app.plektia.workers.dev/juedsay` → `app.plektia.workers.dev/juedsay`. */
export function displayUrl(url: string): string {
  const parsed = new URL(url);
  const path = parsed.pathname === "/" ? "" : parsed.pathname;
  return `${parsed.host}${path}`;
}
