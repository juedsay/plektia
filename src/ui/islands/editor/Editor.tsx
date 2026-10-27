import {
  Accessibility,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/dom";
import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Link, OwnLinks, Section } from "@/application/ports/link-repository";
import {
  addLink,
  addSection,
  applyLinkOrder,
  changesNothing,
  groupLinks,
  type LinkOrder,
  linkOrderOf,
  placeInOrder,
  planLinkMove,
  planSectionMove,
  removeLink,
  removeSection,
  restoreSection,
  replaceLink,
  replaceSection,
  UNSECTIONED_GROUP,
} from "@/ui/view/editor-state";

import { AddLinkForm } from "./AddLinkForm";
import { AddSectionForm } from "./AddSectionForm";
import { type EditorApi, type Failure, type SectionChanges, UNREACHABLE } from "./editor-api";
import {
  cancelText,
  DRAG_INSTRUCTIONS,
  dragKind,
  positionText,
  startText,
} from "@/ui/view/drag-announcements";

import { EditorGroup } from "./EditorGroup";
import { LinkRow } from "./LinkRow";
import { SectionSettings } from "./SectionSettings";
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
  /** Lo último que se ve: los movimientos y "Deshacer" parten de acá. */
  const latestContent = useRef(content);
  latestContent.current = content;
  /** Muestra contenido nuevo y lo deja como el último ya mismo (sin esperar al render). */
  const showContent = useCallback((next: OwnLinks) => {
    latestContent.current = next;
    setContent(next);
  }, []);
  /**
   * Fila de las escrituras que dependen de la versión (mover, guardar una
   * sección): cada una sale cuando terminó la anterior y lee las versiones que
   * esa dejó. Así un doble clic no manda dos pedidos con la misma versión.
   */
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve());
  const inOrder = useCallback(<Value,>(write: () => Promise<Value>): Promise<Value> => {
    const next = writeQueue.current.then(write, write);
    writeQueue.current = next.catch(() => undefined);
    return next;
  }, []);
  /**
   * Orden de los links mientras se arrastra uno (como en la guía de listas
   * múltiples de dnd-kit): React dibuja cada paso, así el DOM es siempre suyo.
   */
  const [dragOrder, setDragOrder] = useState<LinkOrder | null>(null);
  /** La sección con las opciones abiertas (una a la vez). */
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  /** El mismo orden, para leerlo sin esperar al render (anuncios y al soltar). */
  const latestDragOrder = useRef<LinkOrder | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [offer, setOffer] = useState<UndoOffer | null>(null);
  const pendingUndo = useRef<PendingUndo | null>(null);
  const offerCount = useRef(0);
  /** Links y secciones borrados que esperan los 6 s: se envían igual si la pestaña se cierra. */
  const pendingDeletes = useRef(new Map<string, Link>());
  const pendingSectionDeletes = useRef(new Map<string, Section>());

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
    // Si ya salió al cerrar la pestaña, no se manda de nuevo.
    if (!pendingDeletes.current.delete(link.id)) return;
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
      for (const section of pendingSectionDeletes.current.values()) {
        api.deleteSectionOnExit({ id: section.id, version: section.version });
      }
      pendingSectionDeletes.current.clear();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
    };
  }, [api]);

  const sectionCreated = (section: Section) => {
    setContent((current) => addSection(current, section));
    announce(`Sección ${section.title}: creada`);
  };

  /**
   * Guarda un cambio de una sección y ofrece deshacerlo; devuelve el error, si lo
   * hay. Va en fila y con la versión de ese momento: un doble clic en "Ocultar
   * sección" no choca consigo mismo (el segundo pedido ya no cambia nada).
   */
  const saveSection = ({ id }: Section, changes: SectionChanges): Promise<Failure | null> =>
    inOrder(async () => {
      const section = latestContent.current.sections.find((item) => item.id === id);
      // Ya está así (el segundo de un doble clic): no se manda nada y el
      // "Deshacer" del primero sigue valiendo.
      if (!section || changesNothing(section, changes)) return null;
      const result = await api
        .updateSection({ id: section.id, version: section.version }, changes)
        .catch(() => UNREACHABLE);
      if (!result.ok) return result;
      showContent(replaceSection(latestContent.current, result.value));
      offerSectionUndo(section, changes, result.value);
      return null;
    });

  const offerSectionUndo = (section: Section, changes: SectionChanges, saved: Section) => {
    announce(`Sección ${saved.title}: guardada`);
    const inverse: SectionChanges = {
      ...(changes.title === undefined ? {} : { title: section.title }),
      ...(changes.showTitle === undefined ? {} : { showTitle: section.showTitle }),
      ...(changes.visible === undefined ? {} : { visible: section.visible }),
    };
    offerUndo(`Sección ${saved.title} guardada`, () =>
      inOrder(async () => {
        const current = latestContent.current.sections.find((item) => item.id === section.id);
        if (!current) return;
        const undone = await api
          .updateSection({ id: current.id, version: current.version }, inverse)
          .catch(() => UNREACHABLE);
        if (undone.ok) {
          showContent(replaceSection(latestContent.current, undone.value));
          announce(`Sección ${undone.value.title}: cambio deshecho`);
        }
      }),
    );
  };

  const requestSectionDelete = (section: Section) => {
    const before = latestContent.current;
    pendingSectionDeletes.current.set(section.id, section);
    setOpenSectionId(null);
    setContent((current) => removeSection(current, section.id));
    announce(
      `Sección ${section.title}: borrada; sus links pasaron a Sin sección. Podés deshacerlo durante 6 segundos.`,
    );
    offerUndo(
      `Sección ${section.title} borrada`,
      () => {
        pendingSectionDeletes.current.delete(section.id);
        setContent((current) => restoreSection(current, before, section.id));
        announce(`Sección ${section.title}: restaurada`);
      },
      () => {
        // Si ya salió al cerrar la pestaña, no se manda de nuevo.
        if (!pendingSectionDeletes.current.delete(section.id)) return;
        void (async () => {
          const result = await api
            .deleteSection({ id: section.id, version: section.version })
            .catch(() => UNREACHABLE);
          if (result.ok) {
            setContent(result.value);
            return;
          }
          setContent((current) => restoreSection(current, before, section.id));
          announce(`No pudimos borrar la sección ${section.title}: ${result.message}`);
        })();
      },
    );
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".add-section input")?.focus();
    });
  };

  /** El nombre de un grupo para los anuncios ("Redes", "Sin sección"). */
  const groupName = (groupKey: string) =>
    groupKey === UNSECTIONED_GROUP
      ? "Sin sección"
      : (latestContent.current.sections.find((section) => section.id === groupKey)?.title ??
        "la sección");

  const groupKeyOf = (link: Link) => link.sectionId ?? UNSECTIONED_GROUP;

  /** Posición de un link dentro de su grupo, en el orden en que se ve. */
  const placeOf = (linkId: string) => {
    for (const group of groupLinks(latestContent.current)) {
      const index = group.links.findIndex((link) => link.id === linkId);
      if (index !== -1) return { sectionId: group.section?.id ?? null, index };
    }
    return null;
  };

  // Los movimientos van en fila (ver `inOrder`): "Subir" dos veces seguidas
  // sube dos lugares, y el segundo parte de las versiones que dejó el primero.
  const moveLink = (linkId: string, sectionId: string | null, index: number) =>
    inOrder(async () => {
      const before = latestContent.current;
      const moved = before.links.find((link) => link.id === linkId);
      const origin = placeOf(linkId);
      const plan = planLinkMove(before, linkId, sectionId, index);
      if (!moved || !origin || !plan) return;
      setContent(plan.content);
      const result = await api.move(plan.sectionId, plan.order).catch(() => UNREACHABLE);
      if (!result.ok) {
        showContent(before);
        announce(`No pudimos mover ${moved.title}: ${result.message}`);
        return;
      }
      showContent(result.value);
      offerUndo(`${moved.title} movido`, () => moveLink(linkId, origin.sectionId, origin.index));
    });

  const moveSection = (sectionId: string, index: number) =>
    inOrder(async () => {
      const before = latestContent.current;
      const sorted = [...before.sections].sort((first, second) => first.position - second.position);
      const originIndex = sorted.findIndex((section) => section.id === sectionId);
      const moved = sorted[originIndex];
      const plan = planSectionMove(before, sectionId, index);
      if (!moved || !plan) return;
      setContent(plan.content);
      const result = await api.reorderSections(plan.order).catch(() => UNREACHABLE);
      if (!result.ok) {
        showContent(before);
        announce(`No pudimos mover la sección ${moved.title}: ${result.message}`);
        return;
      }
      showContent(result.value);
      offerUndo(`Sección ${moved.title} movida`, () => moveSection(sectionId, originIndex));
    });

  /** Anuncios en español para el lector de pantalla (SPEC-admin-panel, "Accesibilidad"). */
  const describePosition = (data: unknown, index: number, group: unknown, linkId: string) =>
    positionText({
      data,
      index,
      group,
      linkId,
      order: latestDragOrder.current,
      sectionCount: latestContent.current.sections.length,
      groupName,
    });

  const announcements = Accessibility.configure({
    screenReaderInstructions: { draggable: DRAG_INSTRUCTIONS },
    announcements: {
      dragstart({ operation: { source } }: DragStartEvent) {
        return source ? startText(source.data) : undefined;
      },
      dragover({ operation: { source } }: DragOverEvent) {
        if (!source || !isSortable(source)) return undefined;
        return describePosition(source.data, source.index, source.group, String(source.id));
      },
      dragend({ operation: { source }, canceled }: DragEndEvent) {
        if (!source) return undefined;
        if (canceled) return cancelText(source.data);
        if (!isSortable(source)) return undefined;
        return `${describePosition(source.data, source.index, source.group, String(source.id))}. Soltado.`;
      },
    },
  });

  const savedGroups = groupLinks(content);
  const savedEmptyGroups = new Set(
    savedGroups
      .filter((group) => group.links.length === 0)
      .map((group) => group.section?.id ?? UNSECTIONED_GROUP),
  );
  const groups = applyLinkOrder(savedGroups, dragOrder);
  const sortedSections = groups.flatMap((group) => (group.section ? [group.section] : []));

  return (
    <div className="editor">
      <AddLinkForm api={api} sections={content.sections} onCreated={created} />
      <AddSectionForm api={api} onCreated={sectionCreated} />

      <DragDropProvider
        plugins={(defaults) => [...defaults, announcements]}
        onDragStart={(event) => {
          if (dragKind(event.operation.source?.data) !== "link") return;
          latestDragOrder.current = linkOrderOf(latestContent.current);
          setDragOrder(latestDragOrder.current);
        }}
        onDragOver={(event) => {
          if (dragKind(event.operation.source?.data) !== "link" || !latestDragOrder.current) return;
          latestDragOrder.current = move(latestDragOrder.current, event);
          setDragOrder(latestDragOrder.current);
        }}
        onDragEnd={(event) => {
          const { source } = event.operation;
          const finalOrder = latestDragOrder.current;
          setDragOrder(null);
          if (event.canceled || !source || !isSortable(source)) return;
          const id = String(source.id);
          if (dragKind(source.data) === "section") {
            void moveSection(id, source.index);
            return;
          }
          const place = finalOrder ? placeInOrder(finalOrder, id) : null;
          if (place) void moveLink(id, place.sectionId, place.index);
        }}
      >
        {groups.map((group, groupIndex) => {
          const groupKey = group.section?.id ?? UNSECTIONED_GROUP;
          // Vacío según lo guardado (no según el arrastre): así no cambia a mitad
          // de un arrastre. La key lo incluye porque dnd-kit 0.5.0 no toma un
          // cambio de prioridad después del primer render: el grupo se vuelve a
          // montar al vaciarse o llenarse.
          const isEmpty = savedEmptyGroups.has(groupKey);
          return (
            <EditorGroup
              key={`${groupKey}:${isEmpty ? "vacio" : "con-links"}`}
              section={group.section}
              index={groupIndex}
              isEmpty={isEmpty}
              settingsOpen={group.section?.id === openSectionId}
              onToggleSettings={() => {
                setOpenSectionId((current) =>
                  current === group.section?.id ? null : (group.section?.id ?? null),
                );
              }}
              settings={
                group.section && (
                  <SectionSettings
                    section={group.section}
                    index={groupIndex}
                    sectionCount={sortedSections.length}
                    onSave={saveSection}
                    onMove={(section, index) => {
                      void moveSection(section.id, index);
                    }}
                    onDelete={requestSectionDelete}
                    onClose={() => {
                      setOpenSectionId(null);
                      requestAnimationFrame(() => {
                        document
                          .querySelector<HTMLElement>(
                            `[aria-labelledby="editor-group-${group.section?.id ?? ""}"] [data-section-options]`,
                          )
                          ?.focus();
                      });
                    }}
                  />
                )
              }
            >
              {group.links.length > 0 ? (
                <ul className="editor-links">
                  {group.links.map((link, linkIndex) => (
                    <LinkRow
                      key={link.id}
                      link={link}
                      index={linkIndex}
                      groupKey={groupKeyOf(link)}
                      api={api}
                      onSaved={saved}
                      onReload={reload}
                      onDelete={requestDelete}
                      offerUndo={offerUndo}
                      announce={announce}
                      groupSize={group.links.length}
                      sections={sortedSections}
                      onMove={(moved, sectionId, index) => {
                        void moveLink(moved.id, sectionId, index);
                      }}
                    />
                  ))}
                </ul>
              ) : (
                <p className="editor-empty">
                  {content.links.length === 0
                    ? "Todavía no hay links: agregá el primero con la URL de arriba."
                    : group.section
                      ? "Sin links en esta sección: podés traer uno arrastrándolo."
                      : "Sin links sueltos: soltá acá un link para sacarlo de su sección."}
                </p>
              )}
            </EditorGroup>
          );
        })}
      </DragDropProvider>

      <UndoToast offer={offer} onUndo={undoOffer} onExpire={expireOffer} />
      <p className="visually-hidden" role="status" aria-live="polite" data-editor-status>
        {announcement}
      </p>
    </div>
  );
}
