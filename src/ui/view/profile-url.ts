import { networkLabel, type SocialNetwork, socialProfileFor } from "@/ui/view/social-profile";

// Armar el link de un perfil a partir del usuario (SPEC-link-form, 7a): el dueño
// elige la red y escribe `juedsay`, `@juedsay` o pega la URL de su perfil. La URL
// armada tiene que volver a reconocerse como ese perfil con las mismas reglas de
// `social-profile` (ida y vuelta), así los formatos viven en un solo lugar. El
// servidor no cambia: recibe la URL y la valida como cualquier otra.

/** Plantilla de cada red: el prefijo que se muestra y la URL completa. */
const TEMPLATES: Readonly<Record<SocialNetwork, { prefix: string; base: string }>> = {
  instagram: { prefix: "instagram.com/", base: "https://www.instagram.com/" },
  youtube: { prefix: "youtube.com/@", base: "https://www.youtube.com/@" },
  tiktok: { prefix: "tiktok.com/@", base: "https://www.tiktok.com/@" },
  x: { prefix: "x.com/", base: "https://x.com/" },
  twitch: { prefix: "twitch.tv/", base: "https://www.twitch.tv/" },
  kick: { prefix: "kick.com/", base: "https://kick.com/" },
  github: { prefix: "github.com/", base: "https://github.com/" },
  linkedin: { prefix: "linkedin.com/in/", base: "https://www.linkedin.com/in/" },
  facebook: { prefix: "facebook.com/", base: "https://www.facebook.com/" },
  threads: { prefix: "threads.net/@", base: "https://www.threads.net/@" },
  bluesky: { prefix: "bsky.app/profile/", base: "https://bsky.app/profile/" },
};

/** Lo que se ve delante del campo "Usuario" (`instagram.com/`). */
export function profilePrefix(network: SocialNetwork): string {
  return TEMPLATES[network].prefix;
}

export type ProfileUrl =
  | { readonly ok: true; readonly url: string; readonly username: string }
  | { readonly ok: false; readonly message: string };

/** El link del perfil de `input` en `network`, o por qué no se pudo armar. */
export function profileUrlFor(network: SocialNetwork, input: string): ProfileUrl {
  const label = networkLabel(network);
  const value = input.trim();
  if (value === "") return { ok: false, message: `Escribí tu usuario de ${label}.` };

  if (looksLikeUrl(value)) {
    const pasted = socialProfileFor(value.startsWith("https://") ? value : `https://${value}`);
    if (pasted && pasted.network !== network) {
      return {
        ok: false,
        message: `Ese link es de ${pasted.label}: elegí ${pasted.label} o pegalo en "Otro link".`,
      };
    }
    if (!pasted?.username) {
      return { ok: false, message: `Ese link no es de un perfil de ${label}.` };
    }
    return built(network, pasted.username);
  }
  return built(network, value.replace(/^@/, ""));
}

function built(network: SocialNetwork, username: string): ProfileUrl {
  const url = `${TEMPLATES[network].base}${encodeURIComponent(username)}`;
  const parsed = socialProfileFor(url);
  // Ida y vuelta: si las reglas de la red no lo reconocen como ese usuario, no es válido.
  if (parsed?.network !== network || parsed.username?.toLowerCase() !== username.toLowerCase()) {
    return {
      ok: false,
      message: `"${username}" no parece un usuario de ${networkLabel(network)}. Revisalo o pegá el link de tu perfil.`,
    };
  }
  return { ok: true, url, username };
}

/** Un link pegado (con esquema o con dominio y ruta), no un usuario suelto. */
function looksLikeUrl(value: string): boolean {
  return /^[a-z]+:\/\//i.test(value) || /^[\w.-]+\.[a-z]{2,}\//i.test(value);
}
