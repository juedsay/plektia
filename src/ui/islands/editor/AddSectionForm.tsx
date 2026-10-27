import { type SubmitEvent, useId, useRef, useState } from "react";

import type { Section } from "@/application/ports/link-repository";

import { type EditorApi, UNREACHABLE } from "./editor-api";

interface Props {
  readonly api: EditorApi;
  readonly onCreated: (section: Section) => void;
}

/** Nueva sección: un nombre y va al final (después se ordena arrastrando). */
export function AddSectionForm({ api, onCreated }: Props) {
  const idPrefix = useId();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Como en AddLinkForm: el mismo id en cada reintento y un solo envío a la vez.
  const requestId = useRef(crypto.randomUUID());
  const inFlight = useRef(false);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    const result = await api.createSection(title, requestId.current).catch(() => UNREACHABLE);
    inFlight.current = false;
    setSaving(false);
    if (!result.ok) {
      setError(result.fields["title"] ?? result.message);
      return;
    }
    requestId.current = crypto.randomUUID();
    setTitle("");
    setError(null);
    onCreated(result.value);
  };

  const inputId = `${idPrefix}-title`;
  return (
    <form className="add-section" onSubmit={(event) => void submit(event)} noValidate>
      <div className="field">
        <label htmlFor={inputId}>Nueva sección</label>
        <div className="add-section-row">
          <input
            id={inputId}
            maxLength={40}
            autoComplete="off"
            placeholder="Por ejemplo: Redes"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
          />
          <button type="submit" className="button is-quiet" disabled={saving}>
            {saving ? "Creando…" : "Crear sección"}
          </button>
        </div>
        {error && (
          <p className="field-error" id={`${inputId}-error`} role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
