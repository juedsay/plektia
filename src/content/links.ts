import type { PublicLink } from "@/application/ports/public-page-reader";
import { parseLinkInput } from "@/domain/link";

// Links escritos a mano en el repo (la landing). Pasan por las
// mismas reglas que los de los usuarios: lo que el panel rechazaría, acá rompe
// el build.

export interface Entry {
  readonly title: string;
  /** URL `https:` o una ruta propia (`/login`); las rutas necesitan descripción. */
  readonly url: string;
  readonly description?: string;
}

// Para validar una ruta propia con las reglas de URL se la monta sobre un origen
// de prueba; a la página llega la ruta tal cual.
const INTERNAL_ORIGIN = "https://plektia.invalid";

export function toLink(entry: Entry, id: string): PublicLink {
  const internal = entry.url.startsWith("/");
  if (internal && (entry.url.startsWith("//") || !entry.description)) {
    throw new Error(`plektia: la ruta "${entry.url}" no es válida o no tiene descripción`);
  }
  const draft = parseLinkInput({
    title: entry.title,
    url: internal ? `${INTERNAL_ORIGIN}${entry.url}` : entry.url,
    description: entry.description ?? null,
  });
  if (!draft.ok) {
    const reasons = Object.values(draft.error.fields).join(" ");
    throw new Error(`plektia: link inválido "${entry.title}": ${reasons}`);
  }
  return {
    id,
    title: draft.value.title,
    url: internal ? entry.url : draft.value.url,
    description: draft.value.description,
    provider: draft.value.provider,
    providerHandle: draft.value.providerHandle,
    placement: "list",
    highlight: "none",
    kind: draft.value.kind,
    previewImagePath: null,
  };
}
