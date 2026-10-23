import { useEffect, useRef } from "react";

/** Tiempo para deshacer (SPEC-admin-panel, aprobado: 6 segundos). */
export const UNDO_WINDOW_MS = 6000;

export interface UndoOffer {
  /** Distingue una oferta de la siguiente (reinicia la cuenta). */
  readonly key: number;
  readonly message: string;
}

interface Props {
  readonly offer: UndoOffer | null;
  readonly onUndo: () => void;
  /** Pasó el tiempo sin deshacer: el cambio queda firme. */
  readonly onExpire: () => void;
}

/**
 * Aviso con "Deshacer" durante 6 s. La cuenta se pausa mientras el aviso tiene
 * el foco o el puntero encima: así da tiempo a llegar con el teclado (WCAG
 * 2.2.1, tiempo ajustable). El mensaje lo anuncia la región en vivo del editor.
 */
export function UndoToast({ offer, onUndo, onExpire }: Props) {
  const remaining = useRef(UNDO_WINDOW_MS);
  const startedAt = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const expire = useRef(onExpire);
  expire.current = onExpire;
  const container = useRef<HTMLDivElement>(null);

  const stop = () => {
    if (timer.current === undefined) return;
    window.clearTimeout(timer.current);
    timer.current = undefined;
    remaining.current -= Date.now() - startedAt.current;
  };

  const start = () => {
    if (timer.current !== undefined) return;
    startedAt.current = Date.now();
    timer.current = window.setTimeout(
      () => {
        timer.current = undefined;
        expire.current();
      },
      Math.max(remaining.current, 0),
    );
  };

  useEffect(() => {
    if (!offer) return;
    remaining.current = UNDO_WINDOW_MS;
    start();
    // Pausa mientras el aviso tiene el puntero encima o el foco adentro.
    const element = container.current;
    const pauseEvents = ["mouseenter", "focusin"] as const;
    const resumeEvents = ["mouseleave", "focusout"] as const;
    for (const name of pauseEvents) element?.addEventListener(name, stop);
    for (const name of resumeEvents) element?.addEventListener(name, start);
    return () => {
      for (const name of pauseEvents) element?.removeEventListener(name, stop);
      for (const name of resumeEvents) element?.removeEventListener(name, start);
      if (timer.current !== undefined) window.clearTimeout(timer.current);
      timer.current = undefined;
    };
    // Cada oferta nueva (otro objeto) reinicia la cuenta.
  }, [offer]);

  if (!offer) return null;
  return (
    <div ref={container} className="undo-toast">
      <p className="undo-toast-message">{offer.message}</p>
      <button type="button" className="undo-toast-button" onClick={onUndo}>
        Deshacer
      </button>
    </div>
  );
}
