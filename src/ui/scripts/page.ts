// Comportamiento de la página pública: hilo, desplegables y compartir. Sin
// esto la página funciona igual (los links son links); esto es la capa extra.
import { toggleDisclosure } from "@/ui/scripts/disclosure";
import { shareMessage, shareOrCopy } from "@/ui/scripts/share";
import { mountThread } from "@/ui/scripts/thread";

const patchbay = document.querySelector<HTMLElement>("[data-patchbay]");
// El hilo se calcula con las fuentes ya cargadas para no medir posiciones viejas.
if (patchbay) {
  void document.fonts.ready.then(() => {
    mountThread(patchbay);
  });
}

for (const toggle of document.querySelectorAll<HTMLButtonElement>("[data-disclosure]")) {
  const panel = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
  if (panel) {
    toggle.addEventListener("click", () => {
      toggleDisclosure(toggle, panel);
    });
  }
}

const toast = document.querySelector<HTMLElement>("[data-toast]");
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function notify(message: string): void {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2400);
}

const shareButton = document.querySelector<HTMLButtonElement>("[data-share]");
shareButton?.addEventListener("click", () => {
  const data = { title: document.title, url: location.href };
  const api = {
    // Se pasan envueltas: sueltas pierden su `this` y fallan.
    ...("share" in navigator ? { share: (d: ShareData) => navigator.share(d) } : {}),
    ...("clipboard" in navigator
      ? { clipboard: { writeText: (text: string) => navigator.clipboard.writeText(text) } }
      : {}),
  };
  void shareOrCopy(data, api).then((outcome) => {
    const message = shareMessage(outcome);
    if (message) notify(message);
  });
});
