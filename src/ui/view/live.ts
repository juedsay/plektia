// Presentación del aviso "En vivo" de la página pública. Pura: la usan el
// componente (al renderizar) y el script que actualiza el reloj cada segundo.

/** Cuánto lleva el directo: "1:24:05" (nunca negativo). */
export function liveElapsed(startedAt: string, now: number): string {
  const total = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${String(hours)}:${minutes}:${seconds}`;
}
