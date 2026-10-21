import type { PublicPage } from "@/application/ports/public-page-reader";
import { type Entry, toLink } from "@/content/links";

// Página oficial de Plektia (`/plektia`), como `linktr.ee/linktree`: el mismo
// diseño que la de un usuario. El contenido vive acá hasta que el registro abra
// (v2) y pase a la base. Se valida con las mismas reglas que los links de los
// usuarios: un título o una URL que no pasarían el panel tampoco pasan acá.

interface SectionEntry {
  readonly title: string;
  readonly links: readonly Entry[];
}

const SECTIONS: readonly SectionEntry[] = [
  {
    title: "Novedades",
    links: [
      {
        title: "Ya está la página pública",
        url: "/",
        description: "El diseño de la patchera, con el hilo",
      },
    ],
  },
  {
    title: "Sobre Plektia",
    links: [
      { title: "Qué es Plektia", url: "/", description: "Todos tus links, unidos por un hilo" },
      {
        title: "Contacto",
        url: "/contact",
        description: "Pedí tu invitación o escribinos",
      },
      { title: "Entrar", url: "/login", description: "Si ya tenés tu invitación" },
    ],
  },
];

/** Arma la página oficial; falla en el build si algún link no es válido. */
export function buildPlektiaPage(sections: readonly SectionEntry[] = SECTIONS): PublicPage {
  return {
    handle: "plektia",
    displayName: "Plektia",
    showHandle: true,
    bio: "Todos tus links, unidos por un hilo.",
    avatarPath: null,
    theme: "tecnico",
    sections: sections.map((section, s) => ({
      id: `plektia-${String(s)}`,
      title: section.title,
      showTitle: true,
      links: section.links.map((entry, l) => toLink(entry, `plektia-${String(s)}-${String(l)}`)),
    })),
    unsectionedLinks: [],
  };
}
