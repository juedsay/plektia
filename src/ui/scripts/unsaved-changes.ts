// Cambios sin guardar de la pantalla Página. Sin JavaScript, "Guardar" va al
// final del formulario. Con JavaScript:
// - la barra flota abajo y aparece solo cuando hay cambios sin guardar
//   (`data-floating` y `data-dirty` en el formulario, el resto es CSS);
// - "Descartar" vuelve el formulario a lo guardado (y la vista previa con él);
// - salir de la pantalla con cambios pide confirmación al navegador.

/** Lo que tiene el formulario ahora. */
function snapshot(form: HTMLFormElement): string {
  return new URLSearchParams(
    [...new FormData(form)].map(([name, value]) => [
      name,
      typeof value === "string" ? value : value.name,
    ]),
  ).toString();
}

/**
 * Lo guardado: los valores con que vino la página del servidor, en el mismo
 * orden que `FormData`. No depende de cuándo carga este script: un cambio hecho
 * antes también cuenta.
 */
function savedSnapshot(form: HTMLFormElement): string {
  const entries: [string, string][] = [];
  for (const element of form.elements) {
    if (element instanceof HTMLInputElement) {
      if (!element.name || element.disabled) continue;
      if (element.type === "checkbox" || element.type === "radio") {
        if (element.defaultChecked) entries.push([element.name, element.value]);
      } else if (element.type !== "submit" && element.type !== "button") {
        entries.push([element.name, element.defaultValue]);
      }
    } else if (element instanceof HTMLTextAreaElement) {
      if (element.name && !element.disabled) entries.push([element.name, element.defaultValue]);
    }
  }
  return new URLSearchParams(entries).toString();
}

export function connectUnsavedChanges(form: HTMLFormElement): void {
  const status = form.querySelector<HTMLElement>("[data-unsaved-status]");
  const discard = form.querySelector<HTMLButtonElement>("[data-discard]");
  const saved = savedSnapshot(form);
  let submitting = false;

  const isDirty = () => snapshot(form) !== saved;
  const update = () => {
    const dirty = isDirty();
    form.toggleAttribute("data-dirty", dirty);
    if (status) status.textContent = dirty ? "Sin guardar" : "";
    if (discard) discard.hidden = !dirty;
  };

  form.setAttribute("data-floating", "");
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  // `reset` corre antes de que el formulario vuelva a sus valores.
  form.addEventListener("reset", () => {
    setTimeout(update, 0);
  });
  discard?.addEventListener("click", () => {
    form.reset();
  });
  form.addEventListener("submit", () => {
    submitting = true;
  });
  window.addEventListener("beforeunload", (event) => {
    if (submitting || !form.isConnected || !isDirty()) return;
    event.preventDefault();
  });
  update();
}
