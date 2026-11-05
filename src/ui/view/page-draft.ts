// Vista previa con cambios sin guardar (pantalla Página). El formulario manda
// lo que tiene en la URL de `/admin/vista-previa`; la vista previa lo aplica
// sobre la página recién leída, con las mismas reglas que al guardar. Nada se
// escribe: lo que no pasa la validación se muestra como está guardado.
import type { PublicPage } from "@/application/ports/public-page-reader";
import { parsePageSettings, type PageSettings } from "@/domain/page";

/** Marca de la URL: con ella, la vista previa usa los campos de abajo. */
export const DRAFT_PARAM = "borrador";

/** Los campos del formulario que cambian cómo se ve la página. */
export const DRAFT_FIELDS = [
  "displayName",
  "bio",
  "theme",
  "colorMode",
  "accent",
  "linkShape",
  "nameFont",
  "showHandle",
] as const satisfies readonly (keyof PageSettings)[];

type DraftField = (typeof DRAFT_FIELDS)[number];

/** La URL de la vista previa con lo que tiene el formulario. */
export function draftPreviewUrl(base: string, form: FormData): string {
  const search = new URLSearchParams({ [DRAFT_PARAM]: "" });
  for (const field of DRAFT_FIELDS) {
    const value = form.get(field);
    if (typeof value === "string") search.set(field, value);
  }
  return `${base}?${search.toString()}`;
}

/** Lo guardado de la página, con la misma forma que manda el formulario. */
function savedFields(page: PublicPage): Record<DraftField, string> {
  return {
    displayName: page.displayName,
    bio: page.bio ?? "",
    theme: page.theme,
    colorMode: page.colorMode,
    accent: page.accent,
    linkShape: page.linkShape,
    nameFont: page.nameFont,
    showHandle: page.showHandle ? "on" : "",
  };
}

/**
 * La página con los cambios del borrador. Un campo que no pasa la validación
 * (un nombre vacío mientras se escribe) queda como está guardado.
 */
export function withDraft(page: PublicPage, search: URLSearchParams): PublicPage {
  if (!search.has(DRAFT_PARAM)) return page;
  const saved = savedFields(page);
  const draft: Record<DraftField, string> = { ...saved };
  for (const field of DRAFT_FIELDS) {
    // Un checkbox sin marcar no viaja: sin `showHandle` en el borrador, es "no".
    draft[field] = search.get(field) ?? (field === "showHandle" ? "" : saved[field]);
  }

  const parse = (values: Record<DraftField, string>) =>
    parsePageSettings({ ...values, showHandle: values.showHandle === "on" });
  let parsed = parse(draft);
  if (!parsed.ok) {
    for (const field of DRAFT_FIELDS) {
      if (field in parsed.error.fields) draft[field] = saved[field];
    }
    parsed = parse(draft);
  }
  return parsed.ok ? { ...page, ...parsed.value } : page;
}
