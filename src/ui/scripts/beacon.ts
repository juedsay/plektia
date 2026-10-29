// Beacon de estadísticas (SPEC-click-analytics): una visita al cargar y un clic
// al tocar un link. Solo viajan `t`, `h` o `l`, y `s` (la categoría de
// origen): ni referer, ni user agent, ni cookies. La navegación no espera.

import { classifySource } from "@/domain/traffic-source";

const ENDPOINT = "/api/e";

type Payload =
  | { readonly t: "view"; readonly h: string; readonly s: string }
  | { readonly t: "click"; readonly l: string; readonly s: string };

/** Lo que el navegador ofrece para mandar el aviso sin frenar la navegación. */
export interface BeaconTransport {
  sendBeacon?: (url: string, body: string) => boolean;
  fetch: (url: string, init: RequestInit) => Promise<unknown>;
}

export function send(payload: Payload, transport: BeaconTransport): void {
  const body = JSON.stringify(payload);
  // `sendBeacon` con un texto viaja como text/plain, sin cookies de terceros.
  if (transport.sendBeacon?.(ENDPOINT, body)) return;
  void transport
    .fetch(ENDPOINT, {
      method: "POST",
      body,
      keepalive: true,
      credentials: "same-origin",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
    })
    .catch(() => undefined);
}

/** Cuenta la visita y escucha los clics de los links de la página. */
export function mountBeacon(root: HTMLElement, transport: BeaconTransport): void {
  const handle = root.dataset["statsHandle"];
  if (!handle) return;
  const source = classifySource(document.referrer, navigator.userAgent, location.hostname);
  send({ t: "view", h: handle, s: source }, transport);

  // `pointerdown` no: un toque para hacer scroll no es un clic. `auxclick`
  // cubre el botón del medio (abrir en otra pestaña).
  const onClick = (event: MouseEvent) => {
    const link = (event.target as Element | null)?.closest<HTMLElement>("a[data-link-id]");
    const linkId = link?.dataset["linkId"];
    if (linkId) send({ t: "click", l: linkId, s: source }, transport);
  };
  root.addEventListener("click", onClick);
  root.addEventListener("auxclick", onClick);
}
