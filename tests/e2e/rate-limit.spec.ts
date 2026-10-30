import { expect, test } from "@playwright/test";

import {
  LIMIT_TEST_TIMEOUT_MS,
  limitWindowOf,
  waitForRoomInLimitWindow,
} from "./support/rate-limit-window";

// El límite cuenta por IP y ruta, y aplica a todo /auth/*. Se prueba con una
// ruta propia (no existe: responde 404 mientras haya cupo) para no consumir el
// cupo de /auth/callback que usan los otros tests. Corre en su propio proyecto,
// al final (playwright.config.ts). Los 12 pedidos van dentro de una sola
// ventana del limitador: si cruzaran el cambio de minuto, el 11 pasaría.
test("las acciones de login se limitan a 10 por minuto", async ({ request }) => {
  test.setTimeout(LIMIT_TEST_TIMEOUT_MS);
  const path = `/auth/limite-${String(Date.now())}`;
  const statuses: number[] = [];
  const windowAtStart = await waitForRoomInLimitWindow();
  for (let i = 0; i < 12; i++) {
    const response = await request.get(path, { maxRedirects: 0 });
    statuses.push(response.status());
  }
  expect(limitWindowOf(Date.now()), "los 12 pedidos caen en una sola ventana").toBe(windowAtStart);
  expect(statuses.slice(0, 10).every((status) => status !== 429)).toBe(true);
  expect(statuses.slice(10)).toEqual([429, 429]);
});
