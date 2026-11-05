// Opciones que siguen al estilo (SPEC-styles) en la pantalla Página. Sin
// JavaScript, el servidor muestra solo lo que admite el estilo guardado. Con
// JavaScript, al elegir otro estilo:
// - acento, forma y tipografía muestran solo lo que admite el nuevo;
// - si lo elegido no aplica, se marca la opción por defecto del estilo;
// - volver a un estilo que sí lo admite recupera lo que había elegido el dueño.
import { isAvailableTheme, THEME_RULES, type ThemeRules } from "@/domain/theme";

interface Group {
  readonly name: "accent" | "linkShape" | "nameFont";
  readonly allowed: (rules: ThemeRules) => readonly string[];
  readonly fallback: (rules: ThemeRules) => string;
}

const GROUPS: readonly Group[] = [
  { name: "accent", allowed: (rules) => rules.accents, fallback: (rules) => rules.defaultAccent },
  { name: "linkShape", allowed: (rules) => rules.shapes, fallback: (rules) => rules.defaultShape },
  { name: "nameFont", allowed: (rules) => rules.fonts, fallback: (rules) => rules.defaultFont },
];

/** Lo que queda marcado en un grupo: lo que eligió el dueño si el estilo lo admite. */
export function optionFor(group: Group["name"], theme: string, chosen: string): string | null {
  if (!isAvailableTheme(theme)) return null;
  const rules = THEME_RULES[theme];
  const spec = GROUPS.find((candidate) => candidate.name === group);
  if (!spec) return null;
  return spec.allowed(rules).includes(chosen) ? chosen : spec.fallback(rules);
}

export function connectThemeOptions(form: HTMLFormElement): void {
  const radios = (name: string) => [
    ...form.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${name}"]`),
  ];

  // Lo último que eligió el dueño en cada grupo (lo guardado, al entrar). Marcar
  // una opción desde acá no dispara `change`, así que no lo pisa.
  const chosen = new Map<string, string>();
  for (const group of GROUPS) {
    const initial =
      form.getAttribute(`data-chosen-${group.name}`) ??
      radios(group.name).find((radio) => radio.checked)?.value;
    if (initial) chosen.set(group.name, initial);
  }

  const apply = (theme: string) => {
    if (!isAvailableTheme(theme)) return;
    const rules = THEME_RULES[theme];
    for (const group of GROUPS) {
      const allowed = group.allowed(rules);
      const wanted = optionFor(group.name, theme, chosen.get(group.name) ?? "");
      for (const radio of radios(group.name)) {
        const label = radio.closest("label");
        if (label) label.hidden = !allowed.includes(radio.value);
        radio.checked = radio.value === wanted;
      }
    }
  };

  form.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "radio") return;
    if (target.name === "theme") {
      apply(target.value);
    } else if (GROUPS.some((group) => group.name === target.name)) {
      chosen.set(target.name, target.value);
    }
  });
}
