// Cambios sin guardar de la pantalla Página. La barra de "Guardar" queda fija
// abajo (CSS) y funciona sin JavaScript; con JavaScript, además:
// - avisa cuándo hay cambios sin guardar y habilita "Descartar";
// - "Descartar" vuelve el formulario a lo guardado (y la vista previa con él);
// - salir de la pantalla con cambios pide confirmación al navegador.

/** Lo que tiene el formulario, para comparar con lo guardado. */
function snapshot(form: HTMLFormElement): string {
  return new URLSearchParams(
    [...new FormData(form)].map(([name, value]) => [
      name,
      typeof value === "string" ? value : value.name,
    ]),
  ).toString();
}

export function connectUnsavedChanges(form: HTMLFormElement): void {
  const status = form.querySelector<HTMLElement>("[data-unsaved-status]");
  const discard = form.querySelector<HTMLButtonElement>("[data-discard]");
  const saved = snapshot(form);
  let submitting = false;

  const isDirty = () => snapshot(form) !== saved;
  const update = () => {
    const dirty = isDirty();
    form.toggleAttribute("data-dirty", dirty);
    if (status) status.textContent = dirty ? "Tenés cambios sin guardar." : "";
    if (discard) discard.hidden = !dirty;
  };

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
