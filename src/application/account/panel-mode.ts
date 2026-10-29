import { z } from "zod";

import type { AccountPreferences } from "@/application/ports/account-preferences";
import type { UseCaseResult } from "@/application/shared/use-case";
import { COLOR_MODES } from "@/domain/page";
import { validate } from "@/domain/text";

const PanelModeInput = z.object(
  { panelMode: z.enum(COLOR_MODES, { error: "Elegí automático, oscuro o claro." }) },
  { error: "Falta el modo." },
);

/** `{ panelMode }`: el modo del panel de la cuenta, en cualquier dispositivo. */
export function setPanelMode(deps: { preferences: AccountPreferences }) {
  return async (raw: unknown): UseCaseResult<void> => {
    const input = validate(PanelModeInput, raw);
    if (!input.ok) return input;
    return deps.preferences.setPanelMode(input.value.panelMode);
  };
}
