// Formulario de contacto en el navegador: validación con las reglas del
// dominio, botón bloqueado mientras envía, avisos que reciben el foco y un
// borrador por pestaña. Sin JavaScript el formulario funciona igual (el
// servidor valida y responde): esto es la capa de guía.
import {
  CONTACT_FIELDS,
  type ContactField,
  type ContactValues,
  DRAFT_KEY,
  parseDraft,
  serializeDraft,
  shouldRestoreDraft,
  validateContact,
  validateField,
} from "@/ui/view/contact-form";

// `sessionStorage` puede no existir o fallar (modo privado, sin permisos): el
// borrador es una comodidad, nunca un requisito.
const storage = {
  read: () => {
    try {
      return sessionStorage.getItem(DRAFT_KEY);
    } catch {
      return null;
    }
  },
  write: (value: string) => {
    try {
      sessionStorage.setItem(DRAFT_KEY, value);
    } catch {
      /* sin borrador */
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* sin borrador */
    }
  },
};

// Envío correcto: el borrador ya no hace falta, y el aviso recibe el foco.
const sent = document.querySelector("[data-contact-sent]");
if (sent) {
  storage.clear();
  sent.querySelector<HTMLElement>("[data-alert]")?.focus();
}

const form = document.querySelector<HTMLFormElement>("[data-contact-form]");
if (form) mountContactForm(form);

function mountContactForm(form: HTMLFormElement): void {
  const controls = Object.fromEntries(
    CONTACT_FIELDS.map((field) => [
      field,
      form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${field}"]`),
    ]),
  ) as Record<ContactField, HTMLInputElement | HTMLTextAreaElement | null>;
  const alert = form.querySelector<HTMLElement>("[data-alert]");
  const alertText = alert?.querySelector<HTMLElement>("[data-alert-text]") ?? null;
  const submit = form.querySelector<HTMLButtonElement>("[data-submit]");
  const counter = form.querySelector<HTMLElement>("[data-count]");
  const submitLabel = submit?.textContent.trim() ?? "Enviar mensaje";

  const values = (): ContactValues => ({
    name: controls.name?.value ?? "",
    email: controls.email?.value ?? "",
    message: controls.message?.value ?? "",
  });

  function showFieldError(field: ContactField, message: string | null): void {
    const control = controls[field];
    const error = form.querySelector<HTMLElement>(`#${field}-error`);
    if (!control || !error) return;
    error.textContent = message ?? "";
    error.hidden = message === null;
    if (message === null) control.removeAttribute("aria-invalid");
    else control.setAttribute("aria-invalid", "true");
  }

  function showAlert(message: string | null): void {
    if (!alert || !alertText) return;
    alertText.textContent = message ?? "";
    alert.hidden = message === null;
  }

  function updateCounter(): void {
    const control = controls.message;
    if (!counter || !control) return;
    const left = control.maxLength - control.value.length;
    counter.textContent =
      left === 1 ? "Queda 1 carácter." : `Quedan ${String(Math.max(0, left))} caracteres.`;
  }

  // Si el servidor rechazó el envío, el aviso ya viene en la página: recibe el foco.
  if (alert && !alert.hidden) alert.focus();

  // Borrador: se restaura solo sobre un formulario vacío (lo del servidor manda).
  const draft = parseDraft(storage.read());
  if (draft && shouldRestoreDraft(values())) {
    for (const field of CONTACT_FIELDS) {
      const control = controls[field];
      if (control) control.value = draft[field];
    }
  }
  updateCounter();

  for (const field of CONTACT_FIELDS) {
    const control = controls[field];
    if (!control) continue;
    // Al salir del campo se valida; mientras escribe, solo se limpia el error
    // cuando ya está bien (no se reta a nadie a mitad de una palabra).
    control.addEventListener("blur", () => {
      if (control.value !== "") showFieldError(field, validateField(field, values()));
    });
    control.addEventListener("input", () => {
      storage.write(serializeDraft(values()));
      if (field === "message") updateCounter();
      if (control.getAttribute("aria-invalid") === "true" && !validateField(field, values())) {
        showFieldError(field, null);
      }
    });
  }

  form.addEventListener("submit", (event) => {
    const errors = validateContact(values());
    for (const field of CONTACT_FIELDS) showFieldError(field, errors[field] ?? null);

    const firstInvalid = CONTACT_FIELDS.find((field) => errors[field]);
    if (firstInvalid) {
      event.preventDefault();
      showAlert("Revisá los campos marcados.");
      controls[firstInvalid]?.focus();
      return;
    }

    const token = form.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]');
    if (!token?.value) {
      event.preventDefault();
      showAlert("Esperá a que termine la verificación de seguridad y volvé a enviar.");
      alert?.focus();
      return;
    }

    // Un solo envío: el botón queda bloqueado hasta que llegue la respuesta.
    showAlert(null);
    if (submit) {
      submit.disabled = true;
      submit.setAttribute("aria-busy", "true");
      submit.textContent = "Enviando…";
    }
  });

  // Al volver con "atrás" el navegador puede mostrar la página congelada con el
  // botón bloqueado: se lo devuelve a su estado normal.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && submit) {
      submit.disabled = false;
      submit.removeAttribute("aria-busy");
      submit.textContent = submitLabel;
    }
  });
}
