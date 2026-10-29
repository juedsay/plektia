import { randomBytes } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { deleteLinksTitled, signIn } from "./support/session";

// Agregar un link eligiendo la red y escribiendo el usuario (SPEC-link-form, 7a).
// Cuenta del avatar (/avatar-demo), con un título propio para limpiar al final.
test.use({
  extraHTTPHeaders: { "cf-connecting-ip": `2001:db8:0f::${randomBytes(2).toString("hex")}` },
});

const AVATAR_ID = "44444444-4444-4444-8444-444444444444";
const TITLE = "Instagram por usuario";

test("con la red elegida, alcanza el usuario para agregar el perfil", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(context, baseURL ?? "", "avatar@plektia.test");
  try {
    await page.goto("/admin");
    const add = page.locator("form.add-link");
    await add.getByRole("button", { name: "Instagram", exact: true }).click();
    await add.getByLabel("Usuario de Instagram").fill("@plektia.demo");
    await expect(add.getByText("Se va a abrir instagram.com/plektia.demo")).toBeVisible();
    await add.getByLabel("Título").fill(TITLE);
    const results = await new AxeBuilder({ page }).include("form.add-link").analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
    await add.getByRole("button", { name: "Agregar link" }).click();
    await expect(page.locator("[data-editor-status]")).toHaveText(`${TITLE}: agregado`);

    const visitor = await (await browser.newContext({ baseURL })).newPage();
    await visitor.goto("/avatar-demo");
    const link = visitor.getByRole("link", { name: new RegExp(TITLE) });
    await expect(link).toHaveAttribute("href", "https://www.instagram.com/plektia.demo");
    await expect(link).toContainText("@plektia.demo");
    await visitor.context().close();
  } finally {
    await deleteLinksTitled(AVATAR_ID, [TITLE]);
  }
});
