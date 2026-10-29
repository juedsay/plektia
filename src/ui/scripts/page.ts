// Comportamiento de la página pública: hilo, desplegables y compartir. Sin
// esto la página funciona igual (los links son links); esto es la capa extra.
import { mountBeacon } from "@/ui/scripts/beacon";
import { toggleDisclosure } from "@/ui/scripts/disclosure";
import { liveElapsed } from "@/ui/view/live";
import { shareMessage, shareOrCopy } from "@/ui/scripts/share";
import { mountThread } from "@/ui/scripts/thread";

const patchbay = document.querySelector<HTMLElement>("[data-patchbay]");
// Estadísticas sin cookies: una visita y los clics de los links.
if (patchbay) {
  mountBeacon(patchbay, {
    ...(typeof navigator.sendBeacon === "function"
      ? { sendBeacon: (url: string, body: string) => navigator.sendBeacon(url, body) }
      : {}),
    fetch: (url, init) => fetch(url, init),
  });
}
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
      revealImages(panel);
    });
  }
}

// Cuánto lleva cada directo: se actualiza cada segundo desde su inicio.
for (const clock of document.querySelectorAll<HTMLElement>("[data-live-since]")) {
  const since = clock.dataset["liveSince"] ?? "";
  if (Number.isNaN(Date.parse(since))) continue;
  const render = () => {
    clock.textContent = liveElapsed(since, Date.now());
  };
  render();
  setInterval(render, 1000);
}

/** Las miniaturas se piden recién al abrir el panel (cerrado, no cuesta nada). */
function revealImages(panel: HTMLElement): void {
  for (const image of panel.querySelectorAll<HTMLImageElement>("img[data-src]")) {
    image.src = image.dataset["src"] ?? "";
    image.removeAttribute("data-src");
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

// APIs del navegador envueltas: sueltas pierden su `this` y fallan.
// `typeof … === "function"` y no `in`: una propiedad puede existir sin ser usable.
const nativeShare =
  typeof navigator.share === "function"
    ? { share: (d: ShareData) => navigator.share(d) }
    : undefined;
const clipboard =
  "clipboard" in navigator
    ? { writeText: (text: string) => navigator.clipboard.writeText(text) }
    : undefined;

const shareButton = document.querySelector<HTMLButtonElement>("[data-share]");
const dialog = document.querySelector<HTMLDialogElement>("[data-share-dialog]");
if (shareButton && dialog) mountShareDialog(shareButton, dialog);

/** Ventana de compartir propia: copiar, redes y, si existe, la hoja del sistema. */
function mountShareDialog(trigger: HTMLButtonElement, dialog: HTMLDialogElement): void {
  const data = {
    title: dialog.dataset["shareTitle"] ?? document.title,
    url: dialog.dataset["shareUrl"] ?? location.href,
  };
  const status = dialog.querySelector<HTMLElement>("[data-share-status]");
  const say = (message: string | null) => {
    if (status) status.textContent = message ?? "";
  };

  // "Más opciones" solo si el navegador tiene hoja de compartir.
  const native = dialog.querySelector<HTMLElement>("[data-share-native]");
  if (native && nativeShare) native.hidden = false;

  trigger.addEventListener("click", () => {
    say(null);
    // Safari no le da foco a un botón al tocarlo: sin esto, al cerrar el
    // navegador devolvería el foco al <body>.
    trigger.focus();
    dialog.showModal();
  });
  // El foco vuelve al botón que la abrió (también al cerrar con Esc). En el
  // próximo frame: el navegador restaura el foco después del evento `close`.
  dialog.addEventListener("close", () => {
    requestAnimationFrame(() => {
      trigger.focus();
    });
  });
  dialog.querySelector("[data-share-close]")?.addEventListener("click", () => {
    dialog.close();
  });
  // Tocar el fondo (fuera de la ventana) la cierra.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.querySelector("[data-share-copy]")?.addEventListener("click", () => {
    void shareOrCopy(data, clipboard ? { clipboard } : {}).then((outcome) => {
      say(shareMessage(outcome));
    });
  });
  native?.querySelector("button")?.addEventListener("click", () => {
    if (!nativeShare) return;
    // Si la hoja del sistema falla (no por cancelar), se copia el link y se avisa.
    void shareOrCopy(data, { share: nativeShare.share, ...(clipboard ? { clipboard } : {}) }).then(
      (outcome) => {
        if (outcome === "shared") dialog.close();
        else say(shareMessage(outcome));
      },
    );
  });
}

// Sin la ventana (no debería pasar), el botón cae en la hoja del sistema o copiar.
if (shareButton && !dialog) {
  shareButton.addEventListener("click", () => {
    const data = { title: document.title, url: location.href };
    void shareOrCopy(data, { ...nativeShare, ...(clipboard ? { clipboard } : {}) }).then(
      (outcome) => {
        const message = shareMessage(outcome);
        if (message) notify(message);
      },
    );
  });
}
