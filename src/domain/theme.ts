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

/** Una variante que todavía no se construyó: admite lo mismo que técnico hasta entonces. */
const upcoming = (family: ThemeFamily): ThemeRules => ({
  family,
  available: false,
  thread: false,
  accents: ALL_ACCENTS,
  defaultAccent: "hueso",
  shapes: ALL_SHAPES,
  defaultShape: "rows",
  fonts: ALL_FONTS,
  defaultFont: "bricolage",
});

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
  },
  corcho: upcoming("cercano"),
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
  },
  pedalera: upcoming("energico"),
  bitmap: upcoming("energico"),
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
  },
  manual: upcoming("editorial"),
  sumario: upcoming("editorial"),
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
