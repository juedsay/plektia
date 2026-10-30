import type { Theme } from "@/domain/theme";

import cassette from "./cassette.css?url";
import lomo from "./lomo.css?url";
import punto from "./punto.css?url";
import subte from "./subte.css?url";

// La hoja de estilos de cada variante (SPEC-styles): un archivo propio, con
// nombre por contenido y caché larga, que la página pública enlaza solo si usa
// esa variante. "Técnico" vive en tokens.css y page.css.
export const THEME_STYLESHEETS: Readonly<Partial<Record<Theme, string>>> = {
  punto,
  cassette,
  subte,
  lomo,
};
