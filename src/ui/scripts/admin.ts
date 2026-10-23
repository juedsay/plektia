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

// La bio es de una línea: Enter no agrega un salto (el servidor lo rechazaría).
for (const field of document.querySelectorAll<HTMLTextAreaElement>("[data-single-line]")) {
  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter") event.preventDefault();
  });
}

// Contador de caracteres junto al campo ("12 de 160").
for (const field of document.querySelectorAll<HTMLTextAreaElement>("[data-counter]")) {
  const counter = document.getElementById(field.dataset["counter"] ?? "");
  if (!counter) continue;
  const update = () => {
    counter.textContent = `${String(field.value.length)} de ${String(field.maxLength)}`;
  };
  field.addEventListener("input", update);
}
