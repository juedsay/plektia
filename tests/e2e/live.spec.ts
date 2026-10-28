import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { deleteLinksTitled, insertLink, setChannelLive, signIn } from "./support/session";

// "En vivo" (tarea 26c, SPEC-live-status). El estado lo prepara la prueba como
// lo dejaría el refresco; las páginas se piden con un `?` propio para no
// compartir caché con otros archivos que corren en paralelo.
const LIVE = {
  title: "Programando Plektia",
  startedAt: new Date(Date.now() - (60 * 60 + 24 * 60 + 5) * 1000).toISOString(),
  url: "https://www.twitch.tv/juedsay",
};

test.describe.configure({ mode: "serial" });

test.describe("aviso en vivo", () => {
  test.afterAll(async () => {
    await setChannelLive("twitch", "juedsay", null);
  });

  test("un canal vigilado en vivo se marca, con el título y un reloj que avanza", async ({
    page,
  }) => {
    await setChannelLive("twitch", "juedsay", LIVE);
    await page.goto("/juedsay?e2e=en-vivo");
    const twitch = page.locator(".port", { hasText: "Twitch" });
    await expect(twitch).toHaveClass(/is-live/);
    await expect(twitch.locator(".port-meta")).toContainText("En vivo");
    await expect(twitch.locator(".port-meta")).toContainText("Programando Plektia");

    const clock = twitch.locator(".live-time");
    await expect(clock).toHaveText(/^1:2\d:\d{2}$/);
    const before = await clock.textContent();
    await expect(clock).not.toHaveText(before ?? "", { timeout: 3000 });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  test("si la última revisión es de hace más de 25 minutos, no se anuncia", async ({ page }) => {
    await setChannelLive("twitch", "juedsay", LIVE, 30);
    await page.goto("/juedsay?e2e=datos-viejos");
    const twitch = page.locator(".port", { hasText: "Twitch" });
    await expect(twitch).not.toHaveClass(/is-live/);
    await expect(twitch.locator(".port-meta")).toHaveText("Streams de código en vivo");
  });
});

// "Comprobar ahora" con la cuenta del avatar (seed): ningún otro archivo toca
// sus links. Sin credenciales de proveedores (CI) avisa que no está
// configurado; con credenciales (local), revisa y la segunda vez frena.
const AVATAR_ID = "44444444-4444-4444-8444-444444444444";
const CHANNEL_TITLE = "Canal para comprobar";

test.describe("comprobar ahora", () => {
  test.beforeAll(async () => {
    await deleteLinksTitled(AVATAR_ID, [CHANNEL_TITLE]);
    await insertLink(AVATAR_ID, AVATAR_ID, {
      title: CHANNEL_TITLE,
      url: "https://www.twitch.tv/canal_e2e",
      provider: "twitch",
      provider_handle: "canal_e2e",
    });
  });

  test.afterAll(async () => {
    await deleteLinksTitled(AVATAR_ID, [CHANNEL_TITLE]);
  });

  test("el botón aparece con un canal, envía una sola vez y avisa el resultado", async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL ?? "", "avatar@plektia.test");
    await page.goto("/admin");
    const button = page.getByRole("button", { name: "Comprobar ahora si estoy en vivo" });
    await expect(button).toBeVisible();

    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });
    await button.dblclick();
    const done = page.getByRole("status").filter({ hasText: "revisamos tus canales" });
    const notConfigured = page
      .getByRole("alert")
      .filter({ hasText: "todavía no está configurada" });
    await expect(done.or(notConfigured)).toBeVisible();
    expect(posts).toHaveLength(1);

    if (await done.isVisible()) {
      await expect(page).toHaveURL(/\/admin\?comprobado$/);
      await page.getByRole("button", { name: "Comprobar ahora si estoy en vivo" }).click();
      await expect(page.getByRole("alert")).toContainText("hace menos de un minuto");
    }
  });
});
