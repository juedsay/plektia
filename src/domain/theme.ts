import type { Accent, LinkShape, NameFont } from "@/domain/page";

// Estilos de la página pública (SPEC-styles): cuatro familias y diez variantes.
// `pages.theme` guarda la variante; la familia y lo que admite cada una (acentos,
// formas y tipografías) se deducen acá. Una variante se habilita cuando su PR la
// construye: hasta entonces el panel la muestra como "Próximamente".

export const THEME_FAMILIES = ["tecnico", "cercano", "energico", "editorial"] as const;
export type ThemeFamily = (typeof THEME_FAMILIES)[number];

export const THEMES = [
  "tecnico",
  "punto",
  "cassette",
  "corcho",
  "subte",
  "pedalera",
  "bitmap",
  "lomo",
  "manual",
  "sumario",
] as const;
export type Theme = (typeof THEMES)[number];

export interface ThemeRules {
  readonly family: ThemeFamily;
  /** Construida y elegible; si no, "Próximamente". */
  readonly available: boolean;
  /** Si dibuja el hilo entre jacks (la pieza firma de la patchera). */
  readonly thread: boolean;
  /** Los acentos que admite (cada uno con su tono AAA en el CSS de la variante). */
  readonly accents: readonly Accent[];
  readonly defaultAccent: Accent;
  readonly shapes: readonly LinkShape[];
  readonly defaultShape: LinkShape;
  readonly fonts: readonly NameFont[];
  readonly defaultFont: NameFont;
  /** El rótulo automático de la primera sección ("Lado A"), o `null` si no numera. */
  readonly sectionMark: string | null;
}

const ALL_ACCENTS: readonly Accent[] = [
  "hueso",
  "coral",
  "ambar",
  "cielo",
  "lavanda",
  "rosa",
  "turquesa",
  "arena",
];
const ALL_SHAPES: readonly LinkShape[] = ["rows", "cards", "pills"];
const ALL_FONTS: readonly NameFont[] = ["bricolage", "fraunces", "nunito", "space_mono"];

export const THEME_RULES: Readonly<Record<Theme, ThemeRules>> = {
  tecnico: {
    family: "tecnico",
    available: true,
    thread: true,
    accents: ALL_ACCENTS,
    defaultAccent: "hueso",
    shapes: ALL_SHAPES,
    defaultShape: "rows",
    fonts: ALL_FONTS,
    defaultFont: "bricolage",
    sectionMark: null,
  },
  // Lanas teñidas: terracota por defecto; los links son retazos, nunca filas sueltas.
  punto: {
    family: "cercano",
    available: true,
    thread: false,
    accents: ["coral", "ambar", "turquesa", "lavanda", "rosa", "arena"],
    defaultAccent: "coral",
    shapes: ["cards", "pills"],
    defaultShape: "cards",
    fonts: ["fraunces", "nunito", "bricolage"],
    defaultFont: "fraunces",
    sectionMark: null,
  },
  // Carátula de cassette: tinta azul por defecto; el rojo es de los carretes (en vivo).
  cassette: {
    family: "cercano",
    available: true,
    thread: false,
    accents: ["cielo", "ambar", "turquesa", "lavanda", "hueso"],
    defaultAccent: "cielo",
    shapes: ["rows", "cards"],
    defaultShape: "rows",
    fonts: ["nunito", "bricolage", "space_mono"],
    defaultFont: "nunito",
    sectionMark: "Lado A",
  },
  // Tablero de corcho: chinches azules por defecto; el rojo es del hilo y el amarillo, del en vivo.
  corcho: {
    family: "cercano",
    available: true,
    thread: false,
    accents: ["cielo", "turquesa", "lavanda", "rosa", "hueso"],
    defaultAccent: "cielo",
    shapes: ["cards", "rows"],
    defaultShape: "cards",
    fonts: ["nunito", "bricolage", "fraunces"],
    defaultFont: "nunito",
    sectionMark: null,
  },
  // Plano de subte: coral como línea por defecto; el ámbar queda para el en vivo.
  subte: {
    family: "energico",
    available: true,
    thread: false,
    accents: ["coral", "cielo", "turquesa", "lavanda", "rosa"],
    defaultAccent: "coral",
    shapes: ["rows", "cards"],
    defaultShape: "rows",
    fonts: ["bricolage", "nunito", "space_mono"],
    defaultFont: "bricolage",
    sectionMark: "L1",
  },
  // Pedalera: pisadores verdes por defecto; el rojo es del LED encendido (en vivo).
  pedalera: {
    family: "energico",
    available: true,
    thread: false,
    accents: ["turquesa", "ambar", "cielo", "lavanda", "hueso"],
    defaultAccent: "turquesa",
    shapes: ["cards", "rows"],
    defaultShape: "cards",
    fonts: ["bricolage", "nunito", "space_mono"],
    defaultFont: "bricolage",
    sectionMark: null,
  },
  // Afiche de 8 bits: barras azules por defecto; el rosa es de la etiqueta "EN VIVO".
  bitmap: {
    family: "energico",
    available: true,
    thread: false,
    accents: ["cielo", "turquesa", "ambar", "lavanda", "hueso"],
    defaultAccent: "cielo",
    shapes: ["rows", "cards"],
    defaultShape: "rows",
    fonts: ["bricolage", "space_mono", "nunito"],
    defaultFont: "bricolage",
    sectionMark: null,
  },
  // Libro cosido: tinta azul por defecto; el rojo queda para la cinta (en vivo).
  lomo: {
    family: "editorial",
    available: true,
    thread: false,
    accents: ["cielo", "turquesa", "lavanda", "arena", "hueso"],
    defaultAccent: "cielo",
    shapes: ["rows", "cards"],
    defaultShape: "rows",
    fonts: ["fraunces", "bricolage"],
    defaultFont: "fraunces",
    sectionMark: "I",
  },
  // Manual de consulta: lo destacado en azul por defecto; el rojo es del sello (en vivo).
  manual: {
    family: "editorial",
    available: true,
    thread: false,
    accents: ["cielo", "ambar", "turquesa", "lavanda", "hueso"],
    defaultAccent: "cielo",
    shapes: ["rows", "cards"],
    defaultShape: "rows",
    fonts: ["bricolage", "fraunces", "nunito"],
    defaultFont: "bricolage",
    sectionMark: null,
  },
  // Sumario de revista: folios destacados en azul por defecto; el rojo es del folio en vivo.
  sumario: {
    family: "editorial",
    available: true,
    thread: false,
    accents: ["cielo", "ambar", "turquesa", "lavanda", "hueso"],
    defaultAccent: "cielo",
    shapes: ["rows", "cards"],
    defaultShape: "rows",
    fonts: ["fraunces", "bricolage", "nunito"],
    defaultFont: "fraunces",
    sectionMark: null,
  },
};

export const AVAILABLE_THEMES: readonly Theme[] = THEMES.filter(
  (theme) => THEME_RULES[theme].available,
);

export function isAvailableTheme(value: string): value is Theme {
  return (AVAILABLE_THEMES as readonly string[]).includes(value);
}

/**
 * Lo que la página usa de verdad: lo que eligió el dueño si la variante lo
 * admite; si no, lo de la variante (sin tocar lo guardado).
 */
export function effectiveAppearance(
  theme: Theme,
  chosen: { readonly accent: Accent; readonly linkShape: LinkShape; readonly nameFont: NameFont },
): { accent: Accent; linkShape: LinkShape; nameFont: NameFont } {
  const rules = THEME_RULES[theme];
  return {
    accent: rules.accents.includes(chosen.accent) ? chosen.accent : rules.defaultAccent,
    linkShape: rules.shapes.includes(chosen.linkShape) ? chosen.linkShape : rules.defaultShape,
    nameFont: rules.fonts.includes(chosen.nameFont) ? chosen.nameFont : rules.defaultFont,
  };
}
