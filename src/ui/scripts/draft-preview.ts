// Vista previa en vivo de la pantalla Página: cada cambio del formulario se ve
// en el marco sin guardar nada (src/ui/view/page-draft.ts). Sin JavaScript, la
// vista previa muestra lo guardado.
import { draftPreviewUrl } from "@/ui/view/page-draft";

/** Cuánto se espera a que se deje de escribir antes de recargar el marco. */
export const DRAFT_DELAY_MS = 250;

const PREVIEW_PATH = "/admin/vista-previa";

interface Options {
  /** Carga la URL en el marco; por defecto, sin sumar pasos al "atrás" del navegador. */
  readonly load?: (frame: HTMLIFrameElement, url: string) => void;
}

const replaceInFrame = (frame: HTMLIFrameElement, url: string) => {
  if (frame.contentWindow) frame.contentWindow.location.replace(url);
  else frame.src = url;
};

export function connectDraftPreview(
  form: HTMLFormElement,
  frame: HTMLIFrameElement,
  { load = replaceInFrame }: Options = {},
): () => void {
  let pending: ReturnType<typeof setTimeout> | undefined;
  let shown = "";

  const refresh = () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      const url = draftPreviewUrl(PREVIEW_PATH, new FormData(form));
      if (url === shown) return;
      shown = url;
      load(frame, url);
    }, DRAFT_DELAY_MS);
  };

  form.addEventListener("input", refresh);
  form.addEventListener("change", refresh);
  return refresh;
}
