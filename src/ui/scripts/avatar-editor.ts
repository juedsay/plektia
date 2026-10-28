// Editor del avatar en /admin/page (SPEC-admin-panel, "Avatar"): elegir una
// foto, recortarla en cuadrado (arrastrando, con las flechas o con el zoom) y
// subirla re-codificada a 512 × 512. La re-codificación en un <canvas> borra los
// metadatos de la foto (EXIF, ubicación); el servidor igual lo vuelve a validar.
import { actions } from "astro:actions";

import { AVATAR_MAX_BYTES, AVATAR_SIZE } from "@/domain/avatar";
import {
  checkSource,
  type Crop,
  cropSquare,
  ENCODE_QUALITIES,
  initialCrop,
  MAX_ZOOM,
  MIN_ZOOM,
  moveCrop,
  SOURCE_MAX_BYTES,
  sourceErrorMessage,
  zoomCrop,
} from "@/ui/view/avatar-source";

const ZOOM_STEP = 0.1;
/** Cuánto mueven las flechas: una fracción del recorte (con Mayús, más). */
const ARROW_STEP = 0.02;
const ARROW_STEP_LARGE = 0.1;

interface Elements {
  readonly file: HTMLInputElement;
  readonly cropArea: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly zoom: HTMLInputElement;
  readonly save: HTMLButtonElement;
  readonly cancel: HTMLButtonElement;
  readonly error: HTMLElement;
  readonly status: HTMLElement;
  readonly pageId: string;
}

function elementsOf(root: HTMLElement): Elements | null {
  const file = root.querySelector<HTMLInputElement>("[data-avatar-file]");
  const cropArea = root.querySelector<HTMLElement>("[data-avatar-crop]");
  const canvas = root.querySelector<HTMLCanvasElement>("[data-avatar-canvas]");
  const zoom = root.querySelector<HTMLInputElement>("[data-avatar-zoom]");
  const save = root.querySelector<HTMLButtonElement>("[data-avatar-save]");
  const cancel = root.querySelector<HTMLButtonElement>("[data-avatar-cancel]");
  const error = root.querySelector<HTMLElement>("[data-avatar-error]");
  const status = root.querySelector<HTMLElement>("[data-avatar-status]");
  const pageId = root.dataset["pageId"];
  if (!file || !cropArea || !canvas || !zoom || !save || !cancel || !error || !status || !pageId) {
    return null;
  }
  return { file, cropArea, canvas, zoom, save, cancel, error, status, pageId };
}

/** Un <canvas> a un archivo del tipo pedido (o `null` si el navegador no puede). */
function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

/**
 * WebP si el navegador sabe generarlo; si no (Safari devuelve PNG), JPEG. Se baja
 * la calidad hasta que entre en el límite del servidor.
 */
async function encodeAvatar(canvas: HTMLCanvasElement): Promise<File | null> {
  let type: "image/webp" | "image/jpeg" = "image/webp";
  for (const quality of ENCODE_QUALITIES) {
    let blob = await toBlob(canvas, type, quality);
    if (type === "image/webp" && blob?.type !== "image/webp") {
      type = "image/jpeg";
      blob = await toBlob(canvas, type, quality);
    }
    if (blob?.type === type && blob.size <= AVATAR_MAX_BYTES) {
      return new File([blob], type === "image/webp" ? "avatar.webp" : "avatar.jpg", { type });
    }
  }
  return null;
}

export function connectAvatarEditor(root: HTMLElement) {
  const elements = elementsOf(root);
  if (!elements) return;
  const { file, cropArea, canvas, zoom, save, cancel, error, status, pageId } = elements;
  const context = canvas.getContext("2d");
  if (!context) return;

  let image: ImageBitmap | null = null;
  let crop: Crop | null = null;
  let saving = false;

  const showError = (message: string | null) => {
    error.textContent = message ?? "";
    error.hidden = message === null;
  };

  const draw = () => {
    if (!image || !crop) return;
    const square = cropSquare(image, crop);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      image,
      square.x,
      square.y,
      square.size,
      square.size,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    zoom.value = String(crop.zoom);
  };

  const close = () => {
    image?.close();
    image = null;
    crop = null;
    cropArea.hidden = true;
    file.value = "";
  };

  const openChosenFile = () => {
    void (async () => {
      showError(null);
      const chosen = file.files?.[0];
      if (!chosen) return;
      // Un archivo enorme se rechaza sin leerlo.
      if (chosen.size > SOURCE_MAX_BYTES) {
        showError(sourceErrorMessage("too_heavy"));
        close();
        return;
      }
      const check = checkSource(chosen.size, new Uint8Array(await chosen.arrayBuffer()));
      if (!check.ok) {
        showError(sourceErrorMessage(check.error));
        close();
        return;
      }
      try {
        image?.close();
        image = await createImageBitmap(chosen);
      } catch {
        showError(sourceErrorMessage("not_an_image"));
        close();
        return;
      }
      crop = initialCrop(image);
      zoom.min = String(MIN_ZOOM);
      zoom.max = String(MAX_ZOOM);
      cropArea.hidden = false;
      draw();
      canvas.focus();
      status.textContent = "Foto lista. Movela con las flechas y acercala con más o menos.";
    })();
  };
  file.addEventListener("change", openChosenFile);
  // Si la foto se eligió antes de que cargara este script (conexión lenta), se abre igual.
  if (file.files?.length) openChosenFile();
  root.dataset["ready"] = "";

  zoom.addEventListener("input", () => {
    if (!image || !crop) return;
    crop = zoomCrop(image, crop, Number(zoom.value));
    draw();
  });

  // Arrastrar: la imagen sigue al puntero (el recorte va al revés).
  let dragFrom: { x: number; y: number } | null = null;
  canvas.addEventListener("pointerdown", (event) => {
    dragFrom = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragFrom || !image || !crop) return;
    const scale = cropSquare(image, crop).size / canvas.clientWidth;
    crop = moveCrop(
      image,
      crop,
      -(event.clientX - dragFrom.x) * scale,
      -(event.clientY - dragFrom.y) * scale,
    );
    dragFrom = { x: event.clientX, y: event.clientY };
    draw();
  });
  const endDrag = () => {
    dragFrom = null;
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener("keydown", (event) => {
    if (!image || !crop) return;
    const step = cropSquare(image, crop).size * (event.shiftKey ? ARROW_STEP_LARGE : ARROW_STEP);
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) crop = moveCrop(image, crop, move[0], move[1]);
    else if (event.key === "+" || event.key === "=")
      crop = zoomCrop(image, crop, crop.zoom + ZOOM_STEP);
    else if (event.key === "-") crop = zoomCrop(image, crop, crop.zoom - ZOOM_STEP);
    else if (event.key === "Home") crop = initialCrop(image);
    else return;
    event.preventDefault();
    draw();
  });

  cancel.addEventListener("click", () => {
    close();
    showError(null);
    status.textContent = "Cancelado: el avatar no cambió.";
    file.focus();
  });

  save.addEventListener("click", () => {
    void (async () => {
      // Un solo envío a la vez (doble clic).
      if (saving || !image || !crop) return;
      saving = true;
      save.disabled = true;
      showError(null);
      status.textContent = "Guardando…";
      let leaving = false;

      try {
        const output = document.createElement("canvas");
        output.width = AVATAR_SIZE;
        output.height = AVATAR_SIZE;
        const square = cropSquare(image, crop);
        output
          .getContext("2d")
          ?.drawImage(
            image,
            square.x,
            square.y,
            square.size,
            square.size,
            0,
            0,
            AVATAR_SIZE,
            AVATAR_SIZE,
          );
        const encoded = await encodeAvatar(output);
        if (!encoded) {
          showError("No pudimos preparar la foto en este navegador. Probá con otra.");
          return;
        }

        const form = new FormData();
        form.set("pageId", pageId);
        form.set("avatar", encoded);
        const { data } = await actions.pages.setAvatar(form);
        if (data?.ok) {
          // Se recarga la pantalla con el avatar nuevo.
          leaving = true;
          window.location.assign("/admin/page?avatar");
          return;
        }
        // Sin respuesta (sesión vencida, límite de pedidos): un mensaje general.
        showError(
          data
            ? (data.fields["avatar"] ?? data.message)
            : "No pudimos guardar la foto. Probá de nuevo.",
        );
      } catch {
        // La red se cortó en el medio (o falló el navegador): se puede reintentar.
        showError("No pudimos guardar la foto. Revisá tu conexión y probá de nuevo.");
      } finally {
        // Mientras se recarga la pantalla, el botón sigue deshabilitado.
        if (!leaving) {
          saving = false;
          save.disabled = false;
          status.textContent = "";
        }
      }
    })();
  });
}
