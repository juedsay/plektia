// Vista previa del inicio del panel (SPEC-admin-panel). Sin JavaScript, el editor
// y la vista previa se ven uno debajo del otro; con JavaScript:
// - la vista previa se recarga después de cada cambio guardado (el evento lo
//   emite la isla del editor), y
// - en el celular, "Editar" y "Vista previa" son pestañas (en escritorio se ven
//   las dos, una al lado de la otra, y las pestañas no se muestran).
import { PAGE_CHANGED_EVENT } from "@/ui/view/page-changed";

/** Cuánto se espera a que terminen los cambios seguidos antes de recargar. */
export const RELOAD_DELAY_MS = 150;

interface Options {
  /** Recarga el marco; por defecto, conservando hasta dónde se había bajado. */
  readonly reload?: (frame: HTMLIFrameElement) => void;
}

const reloadInPlace = (frame: HTMLIFrameElement) => {
  frame.contentWindow?.location.reload();
};

export function connectLivePreview(root: HTMLElement, { reload = reloadInPlace }: Options = {}) {
  const frame = root.querySelector<HTMLIFrameElement>("[data-preview-frame]");
  if (frame) {
    let pending: ReturnType<typeof setTimeout> | undefined;
    document.addEventListener(PAGE_CHANGED_EVENT, () => {
      clearTimeout(pending);
      pending = setTimeout(() => {
        reload(frame);
      }, RELOAD_DELAY_MS);
    });
  }

  const tablist = root.querySelector<HTMLElement>("[role='tablist']");
  const tabs = [...root.querySelectorAll<HTMLButtonElement>("[role='tab']")];
  const [firstTab] = tabs;
  if (!tablist || !firstTab) return;

  const select = (selected: HTMLButtonElement, moveFocus: boolean) => {
    for (const tab of tabs) {
      const isSelected = tab === selected;
      tab.setAttribute("aria-selected", String(isSelected));
      tab.tabIndex = isSelected ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute("aria-controls") ?? "");
      panel?.toggleAttribute("data-inactive", !isSelected);
    }
    if (moveFocus) selected.focus();
  };

  tablist.hidden = false;
  select(firstTab, false);

  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener("click", () => {
      select(tab, false);
    });
    tab.addEventListener("keydown", (event) => {
      const last = tabs.length - 1;
      const target =
        event.key === "ArrowRight"
          ? tabs[index === last ? 0 : index + 1]
          : event.key === "ArrowLeft"
            ? tabs[index === 0 ? last : index - 1]
            : event.key === "Home"
              ? tabs[0]
              : event.key === "End"
                ? tabs[last]
                : undefined;
      if (!target) return;
      event.preventDefault();
      select(target, true);
    });
  }
}
