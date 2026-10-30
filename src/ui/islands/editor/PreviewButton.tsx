import { useState } from "react";

import { type PreviewCandidate, reencodePreviewImage } from "@/ui/view/preview-image";

import { type EditorApi, type PreviewSuggestion, UNREACHABLE } from "./editor-api";

// "Traer vista previa" (SPEC-link-form, 7c): solo cuando el dueño lo pide.
// Propone el título y la descripción del artículo y, si tiene imagen, la trae,
// la re-codifica acá y la ofrece. No guarda nada por sí solo.
interface Props {
  readonly api: EditorApi;
  readonly url: string;
  readonly onSuggestion: (suggestion: PreviewSuggestion) => void;
  /** La imagen ya re-codificada, lista para mostrar y guardar. */
  readonly onImage?: (candidate: PreviewCandidate) => void;
  /** Para el nombre accesible cuando hay varios en pantalla ("de Mi nota"). */
  readonly label?: string;
}

export function PreviewButton({ api, url, onSuggestion, onImage, label }: Props) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ text: string; failed: boolean } | null>(null);

  const bring = async () => {
    if (loading) return;
    setLoading(true);
    setStatus(null);
    const result = await api.fetchPreview(url.trim()).catch(() => UNREACHABLE);
    if (!result.ok) {
      setLoading(false);
      setStatus({ text: result.message, failed: true });
      return;
    }
    onSuggestion(result.value);
    const withImage =
      onImage && result.value.imageUrl ? await bringImage(result.value.imageUrl) : null;
    setLoading(false);
    setStatus({
      text:
        withImage === false
          ? "Listo: revisá el título y la descripción. La imagen no se pudo usar."
          : withImage
            ? "Listo: revisá el título, la descripción y la imagen."
            : "Listo: revisá el título y la descripción.",
      failed: false,
    });
  };

  /** `true` si la ofreció, `false` si no se pudo usar. */
  const bringImage = async (imageUrl: string): Promise<boolean> => {
    const image = await api.fetchPreviewImage(imageUrl).catch(() => UNREACHABLE);
    if (!image.ok) return false;
    const candidate = await reencodePreviewImage(image.value.dataUrl);
    if (!candidate) return false;
    onImage?.(candidate);
    return true;
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
