import { useSortable } from "@dnd-kit/react/sortable";
import { useEffect, useId, useRef, useState } from "react";

import type { Link, Section } from "@/application/ports/link-repository";
import { mediaCapabilities } from "@/domain/link-media";
import { changedFields, inverseChanges } from "@/ui/view/editor-state";
import { linkMeta } from "@/ui/view/public-link";

import type { OfferUndo } from "./Editor";
import { CONFLICT_MESSAGE, type EditorApi, type Failure, UNREACHABLE } from "./editor-api";
import { DragIcon } from "./EditorGroup";
import { MediaSettings } from "./MediaSettings";

interface Props {
  readonly link: Link;
  /** Posición dentro de su grupo y el grupo (para ordenar arrastrando o con el teclado). */
  readonly index: number;
  readonly groupKey: string;
  readonly api: EditorApi;
  readonly onSaved: (link: Link) => void;
  /** Otro lo cambió: el editor recarga los links para mostrar la última versión. */
  readonly onReload: () => Promise<void>;
  /** Borrar: el editor lo saca de la lista y lo envía pasados los 6 s de "Deshacer". */
  readonly onDelete: (link: Link) => void;
  readonly offerUndo: OfferUndo;
  /** Mensaje para la región en vivo ("Guardado"). */
  readonly announce: (message: string) => void;
  /** Cuántos links tiene su grupo y las secciones de la página (para los botones). */
  readonly groupSize: number;
  readonly sections: readonly Section[];
  /**
   * Mover sin arrastrar (la alternativa visible en el celular): a `index`
   * dentro de `sectionId` (`null` es "Sin sección").
   */
  readonly onMove: (link: Link, sectionId: string | null, index: number) => void;
}

/**
 * Un link del editor: en reposo, el título y adónde lleva; al editarlo, la fila
 * se expande en el lugar (sin modal). Cada campo se guarda al salir de él.
 */
export function LinkRow({
  link,
  index,
  groupKey,
  api,
  onSaved,
  onReload,
  onDelete,
  offerUndo,
  announce,
  groupSize,
  sections,
  onMove,
}: Props) {
  const { ref, handleRef, isDragging } = useSortable({
    id: link.id,
    index,
    group: groupKey,
    type: "link",
    accept: "link",
    data: { title: link.title, kind: "link" },
  });
  const idPrefix = useId();
  const editButton = useRef<HTMLButtonElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => draftOf(link));
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);

  // Los guardados van de a uno: si se sale de un campo mientras otro se está
  // guardando, se guarda después, con la versión que devolvió el anterior. Las
  // referencias tienen siempre lo último (el link guardado y lo escrito).
  const latestLink = useRef(link);
  const latestDraft = useRef(draft);
  const saving = useRef(false);
  const saveAgain = useRef(false);
  const pendingSave = () => saveAgain.current;
  /** El guardado en curso: "Borrar" lo espera para borrar con la versión nueva. */
  const runningSave = useRef<Promise<void> | null>(null);
  /** Se pidió borrar: lo que termine de guardarse no ofrece su propio "Deshacer". */
  const deleting = useRef(false);

  // Si el link cambió desde afuera (al recargar tras un conflicto) y no se está
  // editando, el formulario muestra la versión nueva. Mientras se edita, lo
  // escrito no se pisa.
  useEffect(() => {
    latestLink.current = link;
    if (editing) return;
    const fresh = draftOf(link);
    latestDraft.current = fresh;
    setDraft(fresh);
  }, [link, editing]);

  // Al abrir la edición, el foco va al primer campo.
  useEffect(() => {
    if (editing) titleInput.current?.focus();
  }, [editing]);

  const updateDraft = (next: Draft) => {
    latestDraft.current = next;
    setDraft(next);
  };

  /** Toma un resultado bueno: el link nuevo es la base del próximo guardado. */
  const accept = (saved: Link, message: string) => {
    latestLink.current = saved;
    setFailure(null);
    onSaved(saved);
    announce(message);
  };

  /** Acepta un cambio y ofrece deshacerlo: vuelve a `before` con un cambio nuevo. */
  const acceptUndoable = (before: Link, saved: Link, message: string) => {
    accept(saved, message);
    if (deleting.current) return;
    offerUndo(message, async () => {
      const changes = inverseChanges(before, saved);
      if (Object.keys(changes).length === 0) return;
      const current = latestLink.current;
      const result = await api
        .update({ id: current.id, version: current.version }, changes)
        .catch(() => UNREACHABLE);
      if (result.ok) {
        // Lo deshecho también se ve en el formulario, si está abierto.
        const restored = draftOf(result.value);
        latestDraft.current = restored;
        setDraft(restored);
        accept(result.value, `${result.value.title}: cambio deshecho`);
      } else setFailure(result);
    });
  };

  const save = async () => {
    // Con un conflicto pendiente no se guarda nada hasta recargar: si no, el
    // cambio viejo pisaría la versión nueva.
    if (failure?.message === CONFLICT_MESSAGE) return;
    if (saving.current) {
      saveAgain.current = true;
      return;
    }
    saving.current = true;
    setBusy(true);
    runningSave.current = saveInOrder();
    await runningSave.current;
  };

  /** Guarda lo pendiente de a un pedido por vez, hasta que no quede nada. */
  const saveInOrder = async () => {
    try {
      do {
        saveAgain.current = false;
        const base = latestLink.current;
        const changes = changedFields(base, latestDraft.current);
        if (Object.keys(changes).length === 0) break;
        const result = await api
          .update({ id: base.id, version: base.version }, changes)
          .catch(() => UNREACHABLE);
        if (!result.ok) {
          setFailure(result);
          break;
        }
        acceptUndoable(base, result.value, "Guardado");
        // Se lee de nuevo: otro campo pudo pedir guardar mientras se esperaba.
      } while (pendingSave());
    } finally {
      saving.current = false;
      runningSave.current = null;
      setBusy(false);
    }
  };

  const requestDelete = async () => {
    deleting.current = true;
    // Si salir del campo disparó un guardado, se espera: el borrado sale con la
    // versión que devuelva (si no, daría conflicto y volvería un link viejo).
    await runningSave.current;
    onDelete(latestLink.current);
  };

  const toggleVisibility = async () => {
    const base = latestLink.current;
    setBusy(true);
    const result = await api
      .setVisibility({ id: base.id, version: base.version }, !base.visible)
      .catch(() => UNREACHABLE);
    setBusy(false);
    if (result.ok) {
      acceptUndoable(base, result.value, `${base.title}: ${base.visible ? "oculto" : "visible"}`);
    } else setFailure(result);
  };

  const reload = async () => {
    await onReload();
    setFailure(null);
    setEditing(false);
    editButton.current?.focus();
  };

  const finishEditing = () => {
    setEditing(false);
    editButton.current?.focus();
  };

  // El nombre accesible repite el título: con varios links, "Editar" solo no alcanza.
  const visibilityVerb = link.visible ? "Ocultar" : "Mostrar";
  const editVerb = editing ? "Listo" : "Editar";
  const isConflict = failure?.message === CONFLICT_MESSAGE;
  const fieldError = (name: string) => failure?.fields[name];
  const panelId = `${idPrefix}-panel`;
  const meta = linkMeta(link);
  const capabilities = mediaCapabilities(link);

  return (
    <li
      ref={ref}
      className={`editor-link${link.visible ? "" : " is-hidden"}${isDragging ? " is-dragging" : ""}`}
      aria-busy={busy || undefined}
      data-link-id={link.id}
    >
      <div className="editor-link-row">
        <button
          ref={handleRef}
          type="button"
          className="drag-handle"
          aria-label={`Mover ${link.title}`}
        >
          <DragIcon />
        </button>
        <div className="editor-link-text">
          <span className="editor-link-title">{link.title}</span>
          <span className="editor-link-meta">
            {!link.visible && <span className="admin-tag">Oculto</span>}
            {meta}
          </span>
        </div>
        <div className="editor-link-actions">
          <button
            type="button"
            className="editor-action"
            onClick={() => void toggleVisibility()}
            disabled={busy}
            aria-label={`${visibilityVerb} ${link.title}`}
          >
            {visibilityVerb}
          </button>
          <button
            ref={editButton}
            type="button"
            className="editor-action"
            data-edit
            aria-label={`${editVerb} ${link.title}`}
            aria-expanded={editing}
            aria-controls={panelId}
            onClick={() => {
              if (editing) finishEditing();
              else setEditing(true);
            }}
          >
            {editVerb}
          </button>
        </div>
      </div>

      {failure && (
        <div className="editor-error" role="alert">
          <p>{failure.message}</p>
          {isConflict && (
            <button type="button" className="button is-quiet" onClick={() => void reload()}>
              Recargar
            </button>
          )}
        </div>
      )}

      <div className="editor-link-panel" id={panelId} hidden={!editing}>
        {editing && (
          <>
            <div className="field">
              <label htmlFor={`${idPrefix}-title`}>Título</label>
              <input
                ref={titleInput}
                id={`${idPrefix}-title`}
                maxLength={80}
                value={draft.title}
                onChange={(event) => {
                  updateDraft({ ...draft, title: event.target.value });
                }}
                onBlur={() => void save()}
                aria-invalid={fieldError("title") ? true : undefined}
                aria-describedby={fieldError("title") ? `${idPrefix}-title-error` : undefined}
              />
              {fieldError("title") && (
                <p className="field-error" id={`${idPrefix}-title-error`}>
                  {fieldError("title")}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor={`${idPrefix}-url`}>URL</label>
              <input
                id={`${idPrefix}-url`}
                type="url"
                inputMode="url"
                value={draft.url}
                onChange={(event) => {
                  updateDraft({ ...draft, url: event.target.value });
                }}
                onBlur={() => void save()}
                aria-invalid={fieldError("url") ? true : undefined}
                aria-describedby={fieldError("url") ? `${idPrefix}-url-error` : undefined}
              />
              {fieldError("url") && (
                <p className="field-error" id={`${idPrefix}-url-error`}>
                  {fieldError("url")}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor={`${idPrefix}-description`}>Descripción</label>
              <input
                id={`${idPrefix}-description`}
                maxLength={120}
                value={draft.description}
                onChange={(event) => {
                  updateDraft({ ...draft, description: event.target.value });
                }}
                onBlur={() => void save()}
                aria-invalid={fieldError("description") ? true : undefined}
                aria-describedby={`${idPrefix}-description-hint${
                  fieldError("description") ? ` ${idPrefix}-description-error` : ""
                }`}
              />
              <p className="field-hint" id={`${idPrefix}-description-hint`}>
                Opcional. Se ve debajo del título.
              </p>
              {fieldError("description") && (
                <p className="field-error" id={`${idPrefix}-description-error`}>
                  {fieldError("description")}
                </p>
              )}
            </div>
            {(capabilities.canWatchLive || capabilities.canFeature) && (
              <MediaSettings
                // Otro canal (o proveedor): la configuración se vuelve a leer.
                key={`${link.provider}:${link.providerHandle ?? ""}`}
                linkId={link.id}
                linkTitle={link.title}
                capabilities={capabilities}
                api={api}
                announce={announce}
              />
            )}
            <fieldset className="editor-link-place">
              <legend>Lugar</legend>
              <button
                type="button"
                className="editor-action"
                disabled={index === 0}
                aria-label={`Subir ${link.title}`}
                onClick={() => {
                  onMove(latestLink.current, link.sectionId, index - 1);
                }}
              >
                Subir
              </button>
              <button
                type="button"
                className="editor-action"
                disabled={index >= groupSize - 1}
                aria-label={`Bajar ${link.title}`}
                onClick={() => {
                  onMove(latestLink.current, link.sectionId, index + 1);
                }}
              >
                Bajar
              </button>
              {sections.length > 0 && (
                <label className="editor-link-section">
                  <span>Sección</span>
                  <select
                    aria-label={`Sección de ${link.title}`}
                    value={link.sectionId ?? ""}
                    onChange={(event) => {
                      // Va al final de la sección elegida.
                      onMove(
                        latestLink.current,
                        event.target.value || null,
                        Number.MAX_SAFE_INTEGER,
                      );
                    }}
                  >
                    <option value="">Sin sección</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </fieldset>
            <div className="editor-link-danger">
              <button
                type="button"
                className="button is-quiet"
                aria-label={`Borrar link ${link.title}`}
                onClick={() => void requestDelete()}
              >
                Borrar link
              </button>
            </div>
          </>
        )}
      </div>
    </li>
  );
}

interface Draft {
  title: string;
  url: string;
  description: string;
}

function draftOf(link: Link): Draft {
  return { title: link.title, url: link.url, description: link.description ?? "" };
}
