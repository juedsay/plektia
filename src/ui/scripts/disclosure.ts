// Desplegable accesible (último video): un <button> con aria-expanded que abre
// un panel. Al ser un botón nativo, Enter y Espacio funcionan sin código extra.

export interface DisclosureToggle {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
}

export interface DisclosurePanel {
  classList: { toggle(token: string, force: boolean): boolean };
  inert: boolean;
}

/** Abre o cierra; mientras está cerrado, el panel queda fuera del foco (`inert`). */
export function setDisclosure(toggle: DisclosureToggle, panel: DisclosurePanel, open: boolean) {
  toggle.setAttribute("aria-expanded", String(open));
  panel.classList.toggle("is-open", open);
  panel.inert = !open;
}

export function toggleDisclosure(toggle: DisclosureToggle, panel: DisclosurePanel) {
  setDisclosure(toggle, panel, toggle.getAttribute("aria-expanded") !== "true");
}
