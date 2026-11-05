// El limitador local (Miniflare) cuenta por ventanas fijas de un minuto
// alineadas al reloj, no por los últimos 60 s: una ráfaga que cruza el cambio
// de minuto arranca la cuenta de cero a la mitad. Los tests de límites mandan
// su ráfaga entera dentro de una sola ventana.
const LIMIT_WINDOW_MS = 60_000;
/** Lo que tiene que quedar de ventana para arrancar; las ráfagas tardan mucho menos. */
const BURST_ROOM_MS = 15_000;

/** El test puede esperar hasta BURST_ROOM_MS antes de su ráfaga. */
export const LIMIT_TEST_TIMEOUT_MS = 60_000;

export const limitWindowOf = (timestamp: number) => Math.floor(timestamp / LIMIT_WINDOW_MS);

/** Si a la ventana actual le queda poco, espera a que empiece la siguiente. Devuelve la ventana. */
export async function waitForRoomInLimitWindow(): Promise<number> {
  const remainingInWindow = LIMIT_WINDOW_MS - (Date.now() % LIMIT_WINDOW_MS);
  if (remainingInWindow < BURST_ROOM_MS) {
    await new Promise((resolve) => setTimeout(resolve, remainingInWindow + 100));
  }
  return limitWindowOf(Date.now());
}
