// Mejoras del panel sobre HTML que ya funciona sin JavaScript: el selector de
// página se cierra con Esc (y el foco vuelve a su botón) o tocando afuera, y un
// aviso de error que llega del servidor recibe el foco para que se anuncie.

document.querySelector<HTMLElement>(".admin-main .alert:not([hidden])")?.focus();

for (const switcher of document.querySelectorAll<HTMLDetailsElement>("[data-switcher]")) {
  const summary = switcher.querySelector("summary");

  switcher.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !switcher.open) return;
    switcher.open = false;
    summary?.focus();
  });

  document.addEventListener("click", (event) => {
    if (switcher.open && event.target instanceof Node && !switcher.contains(event.target)) {
      switcher.open = false;
    }
  });
}
