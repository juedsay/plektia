import { type SubmitEvent, useId, useRef, useState } from "react";

import type { Link, Section } from "@/application/ports/link-repository";
import { suggestTitle } from "@/ui/view/editor-state";

import { type EditorApi, UNREACHABLE } from "./editor-api";

interface Props {
  readonly api: EditorApi;
  readonly sections: readonly Section[];
  readonly onCreated: (link: Link) => void;
}

/**
 * Agregar un link: se pega la URL y se propone el título a partir de ella (el
 * nombre de la red o el sitio) mientras no se lo escriba a mano.
 */
export function AddLinkForm({ api, sections, onCreated }: Props) {
  const idPrefix = useId();
  const urlInput = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [sectionId, setSectionId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});
  // El id del alta: el mismo en cada reintento de este link, así un pedido
  // repetido no lo duplica (ver requestIdOf). Se renueva al crearlo.
  const requestId = useRef(crypto.randomUUID());
  // Un segundo envío mientras el primero sigue en camino (doble Enter) no sale.
  const inFlight = useRef(false);

  const changeUrl = (value: string) => {
    setUrl(value);
    if (!titleTouched) setTitle(suggestTitle(value));
  };

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    const result = await api
      .create({
        id: requestId.current,
        title,
        url,
        sectionId: sectionId === "" ? null : sectionId,
      })
      .catch(() => UNREACHABLE);
    inFlight.current = false;
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      setFieldErrors(result.fields);
      return;
    }
    requestId.current = crypto.randomUUID();
    onCreated(result.value);
    setUrl("");
    setTitle("");
    setTitleTouched(false);
    setMessage(null);
    setFieldErrors({});
    urlInput.current?.focus();
  };

  const urlId = `${idPrefix}-url`;
  const titleId = `${idPrefix}-title`;
  const sectionFieldId = `${idPrefix}-section`;

  return (
    <form className="add-link" onSubmit={(event) => void submit(event)} noValidate>
      <h2 className="add-link-title">Agregar un link</h2>
      {message && (
        <p className="editor-error" role="alert">
          {message}
        </p>
      )}
      <div className="add-link-fields">
        <div className="field add-link-url">
          <label htmlFor={urlId}>URL</label>
          <input
            ref={urlInput}
            id={urlId}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://"
            value={url}
            onChange={(event) => {
              changeUrl(event.target.value);
            }}
            aria-invalid={fieldErrors["url"] ? true : undefined}
            aria-describedby={fieldErrors["url"] ? `${urlId}-error` : undefined}
          />
          {fieldErrors["url"] && (
            <p className="field-error" id={`${urlId}-error`}>
              {fieldErrors["url"]}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor={titleId}>Título</label>
          <input
            id={titleId}
            autoComplete="off"
            maxLength={80}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setTitleTouched(true);
            }}
            aria-invalid={fieldErrors["title"] ? true : undefined}
            aria-describedby={fieldErrors["title"] ? `${titleId}-error` : undefined}
          />
          {fieldErrors["title"] && (
            <p className="field-error" id={`${titleId}-error`}>
              {fieldErrors["title"]}
            </p>
          )}
        </div>
        {sections.length > 0 && (
          <div className="field">
            <label htmlFor={sectionFieldId}>Sección</label>
            <select
              id={sectionFieldId}
              value={sectionId}
              onChange={(event) => {
                setSectionId(event.target.value);
              }}
            >
              <option value="">Sin sección</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <button type="submit" className="button" disabled={saving}>
        {saving ? "Agregando…" : "Agregar link"}
      </button>
    </form>
  );
}
