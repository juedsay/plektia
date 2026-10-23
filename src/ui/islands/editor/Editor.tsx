import { useCallback, useEffect, useRef, useState } from "react";

import type { Link, OwnLinks } from "@/application/ports/link-repository";
import { addLink, groupLinks, removeLink, replaceLink } from "@/ui/view/editor-state";

import { AddLinkForm } from "./AddLinkForm";
import { type EditorApi, UNREACHABLE } from "./editor-api";
import { LinkRow } from "./LinkRow";
import { type UndoOffer, UndoToast } from "./UndoToast";

interface Props {
  readonly api: EditorApi;
  readonly initialContent: OwnLinks;
}

/** Un cambio que todavía se puede deshacer. */
interface PendingUndo {
  /** Vuelve atrás (restaura el link o aplica el cambio inverso). */
  readonly undo: () => void | Promise<void>;
  /** Pasó el tiempo (u otro cambio lo reemplazó): el cambio queda firme. */
  readonly commit: () => void;
}

/** Ofrece "Deshacer" para un cambio: lo usa cada fila al guardar. */
export type OfferUndo = (message: string, undo: () => void | Promise<void>) => void;

/**
 * Editor de links de la página elegida (SPEC-admin-panel, "Editor"): agregar,
 * editar en el lugar, mostrar u ocultar y borrar. Cada cambio se guarda al
 * instante, se anuncia en una región en vivo y se puede deshacer durante 6 s.
 * Borrar se confirma recién pasados esos 6 s; si se cierra la pestaña antes,
 * el borrado igual se envía.
 */
export function Editor({ api, initialContent }: Props) {
  const [content, setContent] = useState(initialContent);
  const [announcement, setAnnouncement] = useState("");
  const [offer, setOffer] = useState<UndoOffer | null>(null);
  const pendingUndo = useRef<PendingUndo | null>(null);
  const offerCount = useRef(0);
  /** Links borrados que esperan los 6 s: se envían igual si la pestaña se cierra. */
  const pendingDeletes = useRef(new Map<string, Link>());

  const announce = useCallback((message: string) => {
    // Vaciarla antes hace que el lector de pantalla repita un mismo mensaje.
    setAnnouncement("");
    requestAnimationFrame(() => {
      setAnnouncement(message);
    });
  }, []);

  const offerUndo = useCallback(
    (message: string, undo: () => void | Promise<void>, commit: () => void = () => undefined) => {
      // Una oferta a la vez: la anterior queda firme.
      pendingUndo.current?.commit();
      pendingUndo.current = { undo, commit };
      offerCount.current += 1;
      setOffer({ key: offerCount.current, message });
    },
    [],
  );

  const expireOffer = () => {
    const expired = pendingUndo.current;
    pendingUndo.current = null;
    setOffer(null);
    expired?.commit();
  };

  const undoOffer = () => {
    const undone = pendingUndo.current;
    pendingUndo.current = null;
    setOffer(null);
    void undone?.undo();
  };

  const saved = useCallback((link: Link) => {
    setContent((current) => replaceLink(current, link));
  }, []);

  const created = (link: Link) => {
    setContent((current) => addLink(current, link));
    announce(`${link.title}: agregado`);
  };

  const reload = useCallback(async () => {
    const fresh = await api.list().catch(() => null);
    if (fresh) setContent(fresh);
  }, [api]);

  const restore = (link: Link) => {
    pendingDeletes.current.delete(link.id);
    setContent((current) => addLink(removeLink(current, link.id), link));
  };

  const sendDelete = async (link: Link) => {
    pendingDeletes.current.delete(link.id);
    const result = await api
      .delete({ id: link.id, version: link.version })
      .catch(() => UNREACHABLE);
    if (!result.ok) {
      restore(link);
      announce(`No pudimos borrar ${link.title}: ${result.message}`);
    }
  };

  const requestDelete = (link: Link) => {
    // Tras borrar, el foco pasa al link siguiente (o al anterior, o a agregar).
    const ordered = groupLinks(content).flatMap((group) => group.links);
    const index = ordered.findIndex((candidate) => candidate.id === link.id);
    const neighbour = ordered[index + 1] ?? ordered[index - 1];

    pendingDeletes.current.set(link.id, link);
    setContent((current) => removeLink(current, link.id));
    announce(`${link.title}: borrado. Podés deshacerlo durante 6 segundos.`);
    offerUndo(
      `${link.title} borrado`,
      () => {
        restore(link);
        announce(`${link.title}: restaurado`);
      },
      () => {
        void sendDelete(link);
      },
    );
    requestAnimationFrame(() => {
      const target = neighbour
        ? document.querySelector<HTMLElement>(`[data-link-id="${neighbour.id}"] [data-edit]`)
        : document.querySelector<HTMLElement>(".add-link input");
      target?.focus();
    });
  };

  // Si la pestaña se cierra durante los 6 s, los borrados pendientes se envían
  // igual (`keepalive`).
  useEffect(() => {
    const flush = () => {
      for (const link of pendingDeletes.current.values()) {
        api.deleteOnExit({ id: link.id, version: link.version });
      }
      pendingDeletes.current.clear();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
    };
  }, [api]);

  const groups = groupLinks(content);

  return (
    <div className="editor">
      <AddLinkForm api={api} sections={content.sections} onCreated={created} />

      {groups.map((group) => {
        const headingId = `editor-group-${group.section?.id ?? "sin-seccion"}`;
        return (
          <section key={headingId} className="editor-group" aria-labelledby={headingId}>
            <h2 id={headingId} className="editor-group-title">
              {group.section?.title ?? "Sin sección"}
              {group.section && !group.section.visible && <span className="admin-tag">Oculta</span>}
            </h2>
            {group.links.length > 0 ? (
              <ul className="editor-links">
                {group.links.map((link) => (
                  <LinkRow
                    key={link.id}
                    link={link}
                    api={api}
                    onSaved={saved}
                    onReload={reload}
                    onDelete={requestDelete}
                    offerUndo={offerUndo}
                    announce={announce}
                  />
                ))}
              </ul>
            ) : (
              <p className="editor-empty">
                {content.links.length === 0
                  ? "Todavía no hay links: agregá el primero con la URL de arriba."
                  : "Sin links en esta sección."}
              </p>
            )}
          </section>
        );
      })}

      <UndoToast offer={offer} onUndo={undoOffer} onExpire={expireOffer} />
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
