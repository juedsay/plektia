// Vista previa como hoja en el celular (pantalla Página). En escritorio la
// vista previa va al lado de los ajustes y esto no hace nada. En pantallas
// angostas, "Vista previa" (sin cambios) o "Ver" (con cambios) la abren desde
// donde se esté, sin volver arriba; se cierra con "Cerrar", tocando afuera o
// con Escape, y el foco vuelve al botón que la abrió. Mientras está abierta, lo
// de atrás queda inerte (ni foco ni lector de pantalla).

/** Desde este ancho, la vista previa va al lado: coincide con admin.css. */
export const SIDE_BY_SIDE_QUERY = "(min-width: 76rem)";

interface Options {
  /** Si la vista previa ya está al lado (escritorio); por defecto, por ancho. */
  readonly sideBySide?: () => boolean;
}

export function connectPreviewSheet(workspace: HTMLElement, options: Options = {}): void {
  const sheet = workspace.querySelector<HTMLElement>("[data-preview-sheet]");
  if (!sheet) return;
  const sideBySide = options.sideBySide ?? (() => window.matchMedia(SIDE_BY_SIDE_QUERY).matches);
  const openers = [...workspace.querySelectorAll<HTMLButtonElement>("[data-open-preview]")];
  const closers = [...workspace.querySelectorAll<HTMLElement>("[data-close-preview]")];
  const closeButton = sheet.querySelector<HTMLButtonElement>("button[data-close-preview]");
  // Lo que queda detrás de la hoja: los hermanos de la hoja y de cada uno de
  // sus contenedores, hasta el body (menos el fondo, que la cierra al tocarlo).
  const behind = () => {
    const elements: HTMLElement[] = [];
    for (let node: HTMLElement | null = sheet; node && node !== document.body;) {
      const parent: HTMLElement | null = node.parentElement;
      for (const sibling of parent?.children ?? []) {
        if (sibling !== node && sibling instanceof HTMLElement && !closers.includes(sibling)) {
          elements.push(sibling);
        }
      }
      node = parent;
    }
    return elements;
  };

  workspace.setAttribute("data-sheet", "");
  for (const element of [...openers, ...closers]) element.hidden = false;

  let opener: HTMLElement | null = null;

  const close = () => {
    if (!sheet.hasAttribute("data-open")) return;
    sheet.removeAttribute("data-open");
    sheet.removeAttribute("role");
    sheet.removeAttribute("aria-modal");
    workspace.removeAttribute("data-sheet-open");
    for (const element of behind()) element.inert = false;
    opener?.focus();
    opener = null;
  };

  const open = (from: HTMLElement) => {
    if (sideBySide()) return;
    opener = from;
    // Abierta es un diálogo; en escritorio es una sección más de la pantalla.
    sheet.setAttribute("data-open", "");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    workspace.setAttribute("data-sheet-open", "");
    for (const element of behind()) element.inert = true;
    closeButton?.focus();
  };

  for (const button of openers) {
    button.addEventListener("click", () => {
      open(button);
    });
  }
  for (const element of closers) element.addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  // Si la pantalla se agranda con la hoja abierta, la vista previa pasa al lado.
  window.matchMedia(SIDE_BY_SIDE_QUERY).addEventListener("change", (event) => {
    if (event.matches) close();
  });
}
