// Compartir: hoja nativa si existe; si no, copia el link. Las APIs del navegador
// llegan inyectadas, así se prueba sin DOM.

export interface ShareApi {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText(text: string): Promise<void> };
}

/** `cancelled`: la persona cerró la hoja nativa; no hay nada que avisar. */
export type ShareOutcome = "shared" | "cancelled" | "copied" | "failed";

export async function shareOrCopy(
  data: { title: string; url: string },
  api: ShareApi,
): Promise<ShareOutcome> {
  if (api.share) {
    try {
      await api.share(data);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Otro error (permiso, contexto inseguro): se intenta copiar.
    }
  }
  try {
    if (!api.clipboard) return "failed";
    await api.clipboard.writeText(data.url);
    return "copied";
  } catch {
    return "failed";
  }
}

/** Aviso para cada resultado; `null` cuando no hace falta avisar nada. */
export function shareMessage(outcome: ShareOutcome): string | null {
  switch (outcome) {
    case "copied":
      return "Link copiado";
    case "failed":
      return "No se pudo copiar el link. Copialo desde la barra de direcciones.";
    default:
      return null;
  }
}
