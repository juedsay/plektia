// Mejoras del panel sobre HTML que ya funciona sin JavaScript: el selector de
// página se cierra con Esc (y el foco vuelve a su botón) o tocando afuera, y un
// aviso de error que llega del servidor recibe el foco para que se anuncie.

import { connectLivePreview } from "@/ui/scripts/live-preview";

document.querySelector<HTMLElement>(".admin-main .alert:not([hidden])")?.focus();

const workspace = document.querySelector<HTMLElement>("[data-workspace]");
if (workspace) connectLivePreview(workspace);

// Acento, forma y tipografía siguen al estilo elegido (/admin/page).
const themeOptions = document.querySelector<HTMLFormElement>("form[data-theme-options]");
if (themeOptions) {
  void import("@/ui/scripts/theme-options").then(({ connectThemeOptions }) => {
    connectThemeOptions(themeOptions);
  });
}

// Avisa los cambios sin guardar y deja descartarlos.
if (themeOptions) {
  void import("@/ui/scripts/unsaved-changes").then(({ connectUnsavedChanges }) => {
    connectUnsavedChanges(themeOptions);
  });
}

// En el celular, la vista previa de la pantalla Página es una hoja.
const sheetWorkspace = document.querySelector<HTMLElement>(
  "[data-workspace]:has([data-preview-sheet])",
);
if (sheetWorkspace) {
  void import("@/ui/scripts/preview-sheet").then(({ connectPreviewSheet }) => {
    connectPreviewSheet(sheetWorkspace);
  });
}

// Atajos a las partes de la pantalla Página: marcan dónde se está.
const shortcuts = document.querySelector<HTMLElement>("[data-section-shortcuts]");
if (shortcuts) {
  void import("@/ui/scripts/section-shortcuts").then(({ connectSectionShortcuts }) => {
    connectSectionShortcuts(shortcuts);
  });
}

// Y cada cambio se ve en la vista previa antes de guardar.
const draftFrame = document.querySelector<HTMLIFrameElement>("iframe[data-draft-preview]");
if (themeOptions && draftFrame) {
  void import("@/ui/scripts/draft-preview").then(({ connectDraftPreview }) => {
    connectDraftPreview(themeOptions, draftFrame);
  });
}

// El editor del avatar solo se carga en la pantalla que lo tiene (/admin/page).
const avatarEditor = document.querySelector<HTMLElement>("[data-avatar-editor]");
if (avatarEditor) {
  void import("@/ui/scripts/avatar-editor").then(({ connectAvatarEditor }) => {
    connectAvatarEditor(avatarEditor);
  });
}

for (const switcher of document.querySelectorAll<HTMLDetailsElement>("[data-switcher]")) {
  const summary = switcher.querySelector("summary");

  switcher.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !switcher.open) return;
    switcher.open = false;
    summary?.focus();
  });

  document.addEventListener("click", (event) => {
    if (switcher.open && event.target instanceof Node && !switcher.contains(event.target)) {
      switcher.open = false;
    }
  });
}

// La bio es de una línea: Enter no agrega un salto (el servidor lo rechazaría).
for (const field of document.querySelectorAll<HTMLTextAreaElement>("[data-single-line]")) {
  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter") event.preventDefault();
  });
}

// Contador de caracteres junto al campo ("12 de 160").
for (const field of document.querySelectorAll<HTMLTextAreaElement>("[data-counter]")) {
  const counter = document.getElementById(field.dataset["counter"] ?? "");
  if (!counter) continue;
  const update = () => {
    counter.textContent = `${String(field.value.length)} de ${String(field.maxLength)}`;
  };
  field.addEventListener("input", update);
}

// "Comprobar ahora": un solo envío. Un segundo clic llegaría como otro pedido,
// el límite de una vez por minuto lo rechazaría y taparía el resultado del primero.
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-live-check]")) {
  // La marca se pone en el mismo evento: un doble clic dispara el segundo
  // `submit` antes de que el botón llegue a deshabilitarse.
  let sent = false;
  button.form?.addEventListener("submit", (event) => {
    if (sent) {
      event.preventDefault();
      return;
    }
    sent = true;
    // En el próximo frame: deshabilitarlo antes cancelaría el envío en curso.
    requestAnimationFrame(() => {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "Comprobando…";
    });
  });
}

// "Copiar link" (estadísticas sin datos): copia y lo anuncia.
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
  const status = button.parentElement?.querySelector<HTMLElement>("[data-copy-status]");
  button.addEventListener("click", () => {
    const text = button.dataset["copy"] ?? "";
    navigator.clipboard.writeText(text).then(
      () => {
        if (status) status.textContent = "Link copiado.";
      },
      () => {
        if (status) status.textContent = "No pudimos copiar: seleccioná el link y copialo a mano.";
      },
    );
  });
}
