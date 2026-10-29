import type { WriteError } from "@/application/ports/link-repository";
import type { ColorMode } from "@/domain/page";
import type { Result } from "@/domain/result";

// Preferencias de la cuenta (SPEC-appearance): por ahora, el modo del panel.
// Solo las ve y las cambia su dueño, desde el panel.

export interface AccountPreferences {
  /** `auto` si nunca eligió. */
  panelMode(): Promise<ColorMode>;
  /** Repetirlo deja lo mismo. */
  setPanelMode(mode: ColorMode): Promise<Result<void, WriteError>>;
}
