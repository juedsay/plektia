import { useState } from "react";

import { type EditorApi, type PreviewSuggestion, UNREACHABLE } from "./editor-api";

// "Traer vista previa" (SPEC-link-form, 7c): solo cuando el dueño lo pide.
// Propone el título y la descripción del artículo; no guarda nada por sí solo.
interface Props {
  readonly api: EditorApi;
  readonly url: string;
  readonly onSuggestion: (suggestion: PreviewSuggestion) => void;
  /** Para el nombre accesible cuando hay varios en pantalla ("de Mi nota"). */
  readonly label?: string;
}

export function PreviewButton({ api, url, onSuggestion, label }: Props) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ text: string; failed: boolean } | null>(null);

  const bring = async () => {
    if (loading) return;
    setLoading(true);
    setStatus(null);
    const result = await api.fetchPreview(url.trim()).catch(() => UNREACHABLE);
    setLoading(false);
    if (!result.ok) {
      setStatus({ text: result.message, failed: true });
      return;
    }
    onSuggestion(result.value);
    setStatus({ text: "Listo: revisá el título y la descripción.", failed: false });
  };

  return (
    <div className="preview-fetch">
      <button
        type="button"
        className="button is-quiet"
        disabled={loading || url.trim() === ""}
        aria-label={label ? `Traer vista previa de ${label}` : undefined}
        onClick={() => void bring()}
      >
        {loading ? "Trayendo…" : "Traer vista previa"}
      </button>
      <p className={status?.failed ? "field-error" : "field-hint"} role="status">
        {status?.text ?? ""}
      </p>
    </div>
  );
}
