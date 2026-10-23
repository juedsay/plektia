import { useEffect, useId, useRef, useState } from "react";

import type { Link } from "@/application/ports/link-repository";
import { changedFields } from "@/ui/view/editor-state";
import { linkMeta } from "@/ui/view/public-link";

import { CONFLICT_MESSAGE, type EditorApi, type Failure, UNREACHABLE } from "./editor-api";

interface Props {
  readonly link: Link;
  readonly api: EditorApi;
  readonly onSaved: (link: Link) => void;
  /** Otro lo cambió: el editor recarga los links para mostrar la última versión. */
  readonly onReload: () => Promise<void>;
  /** Mensaje para la región en vivo ("Guardado"). */
  readonly announce: (message: string) => void;
}

/**
 * Un link del editor: en reposo, el título y adónde lleva; al editarlo, la fila
 * se expande en el lugar (sin modal). Cada campo se guarda al salir de él.
 */
export function LinkRow({ link, api, onSaved, onReload, announce }: Props) {
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

  /** Guarda un resultado bueno: el link nuevo es la base del próximo guardado. */
  const accept = (saved: Link, message: string) => {
    latestLink.current = saved;
    setFailure(null);
    onSaved(saved);
    announce(message);
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
        accept(result.value, "Guardado");
        // Se lee de nuevo: otro campo pudo pedir guardar mientras se esperaba.
      } while (pendingSave());
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  const toggleVisibility = async () => {
    const base = latestLink.current;
    setBusy(true);
    const result = await api
      .setVisibility({ id: base.id, version: base.version }, !base.visible)
      .catch(() => UNREACHABLE);
    setBusy(false);
    if (result.ok) accept(result.value, `${base.title}: ${base.visible ? "oculto" : "visible"}`);
    else setFailure(result);
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

  return (
    <li className={`editor-link${link.visible ? "" : " is-hidden"}`} aria-busy={busy || undefined}>
      <div className="editor-link-row">
        <span className="admin-jack" aria-hidden="true" />
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
