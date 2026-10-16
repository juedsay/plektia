import type { PublicLink } from "@/application/ports/public-page-reader";
import { type Entry, toLink } from "@/content/links";

// La landing (`/`) se muestra como una página de Plektia: sus salidas son los
// puertos de un banco, unidos por el mismo hilo. Es el ejemplo y el menú a la vez.
const START: readonly Entry[] = [
  { title: "Conocé Plektia", url: "/plektia", description: "Novedades y cómo funciona" },
  { title: "Entrar", url: "/login", description: "Si ya tenés tu invitación" },
];

export function landingLinks(entries: readonly Entry[] = START): PublicLink[] {
  return entries.map((entry, i) => toLink(entry, `landing-${String(i)}`));
}
