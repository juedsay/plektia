import type { UseCaseError } from "@/application/shared/use-case";
import { errorMessage } from "@/domain/errors";
import type { Result } from "@/domain/result";

// Lo que una Action de formulario le devuelve a la página: si salió bien, o el
// mensaje general y el de cada campo para mostrarlos junto al campo.

export type FormResult<T = undefined> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly message: string;
      readonly fields: Readonly<Record<string, string>>;
      /** Lo que se envió, para volver a mostrarlo en el formulario. */
      readonly values: Readonly<Record<string, string>>;
    };

export function toFormResult<T>(
  result: Result<T, UseCaseError>,
  values: Readonly<Record<string, string>> = {},
): FormResult<T> {
  if (result.ok) return { ok: true, value: result.value };
  const { error } = result;
  if (typeof error === "string") {
    return { ok: false, message: errorMessage(error), fields: {}, values };
  }
  return { ok: false, message: errorMessage(error.kind), fields: error.fields, values };
}

/** Los campos de texto de un formulario, sin los archivos. */
export function formFields(form: FormData): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [name, value] of form) {
    if (typeof value === "string") fields[name] = value;
  }
  return fields;
}
