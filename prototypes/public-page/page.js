import { mountThread } from "./thread.js";

const patchbay = document.querySelector("[data-patchbay]");
// El hilo se calcula con las fuentes ya cargadas para no medir posiciones viejas.
document.fonts.ready.then(() => mountThread(patchbay));

// Último video: disclosure accesible con panel animado.
for (const toggle of document.querySelectorAll("[data-latest-toggle]")) {
  const panel = document.getElementById(toggle.getAttribute("aria-controls"));
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    panel.classList.toggle("is-open", open);
    panel.inert = !open;
  });
}

// Tiempo en vivo: se actualiza cada segundo desde el inicio del stream.
for (const clock of document.querySelectorAll("[data-live-since]")) {
  // "demo" simula un stream que empezó hace 1:24:05 (dato sintético del prototipo).
  const since = clock.dataset.liveSince === "demo" ? Date.now() - 5045000 : Date.parse(clock.dataset.liveSince);
  const render = () => {
    const total = Math.max(0, Math.floor((Date.now() - since) / 1000));
    const h = Math.floor(total / 3600);
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    clock.textContent = `${h}:${m}:${s}`;
    clock.setAttribute("datetime", `PT${h}H${m}M${s}S`);
  };
  render();
  setInterval(render, 1000);
}

// Compartir: hoja nativa si existe; si no, copia el link y avisa.
const toast = document.querySelector("[data-toast]");
let toastTimer;
function notify(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

document.querySelector("[data-share]").addEventListener("click", async () => {
  const data = { title: document.title, url: location.href };
  if (navigator.share) {
    try {
      await navigator.share(data);
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(data.url);
    notify("Link copiado");
  } catch {
    notify("No se pudo copiar el link. Copialo desde la barra de direcciones.");
  }
});
