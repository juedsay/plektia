import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import {
  deleteLinksTitled,
  insertUnsectionedLinks,
  resetPagesOf,
  restorePageSettings,
  signIn,
} from "./support/session";

// Panel (SPEC-admin-panel, tarea 18a): marco, selector de página, alta de
// páginas e inicio. Con sesión real del seed; WCAG 2.2 AA.
const AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
// El miembro del seed arranca con una sola página: las altas se prueban con él.
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";

// Varias pruebas cambian datos del miembro (páginas, nombre): todo el archivo va
// en orden, y cada bloque deja todo como estaba.
test.describe.configure({ mode: "serial" });

async function violations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(AA_TAGS).analyze();
  return results.violations.map((violation) => ({
    id: violation.id,
    nodes: violation.nodes.map((node) => node.target.join(" ")),
  }));
}

test.describe("panel: inicio", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL ?? "", "owner@plektia.test");
  });

  test("muestra la página actual, su dirección pública y sus secciones", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.headers()["cache-control"]).toBe("private, no-store");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Julián (dev)");
    await expect(page.getByRole("link", { name: /\/juedsay/ })).toHaveAttribute(
      "href",
      /\/juedsay$/,
    );
    // "Sin sección" está siempre (vacía también): ahí se suelta un link para sacarlo de su sección.
    await expect(page.locator(".editor-group-title")).toHaveText([
      "Redes",
      "Proyectos",
      "Artículos",
      "Sin sección",
    ]);
    await expect(
      page.getByRole("navigation", { name: "Panel" }).getByRole("link", { name: "Inicio" }),
    ).toHaveAttribute("aria-current", "page");
  });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    test(`a ${String(viewport.width)} px no tiene violaciones de axe, con el selector abierto`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/admin");
      expect(await violations(page)).toEqual([]);
      await page.locator("summary", { hasText: "Cambiar de página" }).click();
      await expect(page.getByRole("link", { name: "Nueva página" })).toBeVisible();
      expect(await violations(page)).toEqual([]);
      // Esc lo cierra y el foco vuelve al selector.
      await page.keyboard.press("Escape");
      await expect(page.getByRole("link", { name: "Nueva página" })).toBeHidden();
    });
  }
});

test.describe("panel: páginas de una cuenta", () => {
  test.beforeAll(async () => {
    await resetPagesOf(MEMBER_ID);
  });

  test.afterAll(async () => {
    await resetPagesOf(MEMBER_ID);
  });

  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL ?? "", "member@plektia.test");
  });

  test("un handle reservado se rechaza junto al campo, sin perder lo escrito", async ({ page }) => {
    await page.goto("/admin/pages/new");
    await page.getByLabel("Dirección").fill("login");
    await page.getByLabel("Nombre", { exact: true }).fill("Mi segunda");
    await page.getByRole("button", { name: "Crear página" }).click();

    await expect(page.getByRole("alert")).toBeFocused();
    await expect(page.getByText("Ese nombre de usuario está reservado.")).toBeVisible();
    await expect(page.getByLabel("Dirección")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Mi segunda");
    expect(await violations(page)).toEqual([]);
  });

  test("crea una página, pasa a trabajar con ella y se ve en su /{handle}", async ({ page }) => {
    await page.goto("/admin/pages/new");
    await page.getByLabel("Dirección").fill("miembro-segunda");
    await page.getByLabel("Nombre", { exact: true }).fill("Mi segunda");
    await page.getByRole("button", { name: "Crear página" }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mi segunda");
    await expect(page.getByText(/Todavía no hay links/)).toBeVisible();
    const publicPage = await page.request.get("/miembro-segunda");
    expect(publicPage.status()).toBe(200);
  });

  test("el selector cambia de página y la recuerda al volver", async ({ page }) => {
    await page.goto("/admin");
    await page.locator("summary", { hasText: "Cambiar de página" }).click();
    await page.getByRole("button", { name: /Miembro Demo/ }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Miembro Demo");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Miembro Demo");
  });

  test("con 3 páginas, el alta avisa el límite en lugar del formulario", async ({ page }) => {
    await page.goto("/admin/pages/new");
    await page.getByLabel("Dirección").fill("miembro-tercera");
    await page.getByLabel("Nombre", { exact: true }).fill("Mi tercera");
    await page.getByRole("button", { name: "Crear página" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mi tercera");

    await page.goto("/admin/pages/new");
    await expect(page.getByRole("alert")).toContainText("Llegaste al máximo de 3 páginas.");
    await expect(page.getByLabel("Dirección")).toHaveCount(0);
    await page.locator("summary", { hasText: "Cambiar de página" }).click();
    await expect(page.getByRole("link", { name: "Nueva página" })).toHaveCount(0);
  });
});

test.describe("panel: presentación de la página (/admin/page)", () => {
  // La página del miembro tiene su mismo id; se restaura como en el seed.
  const restore = () =>
    restorePageSettings(MEMBER_ID, {
      display_name: "Miembro Demo",
      bio: "Perfil de prueba con 50 links para medir el rendimiento.",
      show_handle: true,
    });

  test.beforeAll(async () => {
    await resetPagesOf(MEMBER_ID);
    await restore();
  });

  test.afterAll(restore);

  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL ?? "", "member@plektia.test");
  });

  test("muestra lo guardado y los temas que todavía no están", async ({ page }) => {
    await page.goto("/admin/page");
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Miembro Demo");
    await expect(page.getByLabel("Bio")).toHaveValue(
      "Perfil de prueba con 50 links para medir el rendimiento.",
    );
    await expect(page.getByRole("radio", { name: /Técnico/ })).toBeChecked();
    await expect(page.getByRole("radio", { name: /Cercano/ })).toBeDisabled();
    await expect(page.getByRole("checkbox", { name: /Mostrar @miembro-demo/ })).toBeChecked();
    expect(await violations(page)).toEqual([]);
  });

  test("un nombre vacío se rechaza junto al campo y no se guarda", async ({ page }) => {
    await page.goto("/admin/page");
    await page.getByLabel("Nombre", { exact: true }).fill("");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByRole("alert")).toBeFocused();
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(await violations(page)).toEqual([]);
    await page.goto("/miembro-demo");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Miembro Demo");
  });

  test("guardar cambia la página pública al instante", async ({ page }) => {
    await page.goto("/admin/page");
    await page.getByLabel("Nombre", { exact: true }).fill("Miembro Editado");
    await page.getByLabel("Bio").fill("Bio nueva");
    await page.getByRole("checkbox", { name: /Mostrar @miembro-demo/ }).uncheck();
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page).toHaveURL(/\/admin\/page\?guardado$/);
    await expect(page.getByRole("status")).toContainText("Guardado");
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Miembro Editado");

    await page.goto("/miembro-demo");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Miembro Editado");
    await expect(page.getByText("Bio nueva")).toBeVisible();
    await expect(page.locator(".identity").getByText("@miembro-demo")).toHaveCount(0);
  });
});

test.describe("panel: editor de links", () => {
  // Links de prueba en la página del miembro; se borran al terminar.
  const TITLES = ["Canal de prueba", "Canal de prueba editado", "Para borrar", "Para salir"];

  test.beforeAll(async () => {
    await resetPagesOf(MEMBER_ID);
    await deleteLinksTitled(MEMBER_ID, TITLES);
  });

  test.afterAll(async () => {
    await deleteLinksTitled(MEMBER_ID, TITLES);
  });

  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL ?? "", "member@plektia.test");
  });

  test("agrega un link, lo edita en el lugar y lo oculta; la página pública lo refleja", async ({
    page,
  }) => {
    await page.goto("/admin");
    const add = page.locator("form.add-link");
    await add.getByLabel("URL").fill("https://www.twitch.tv/canal-de-prueba");
    await expect(add.getByLabel("Título")).toHaveValue("Twitch");
    await add.getByLabel("Título").fill("Canal de prueba");
    await add.getByRole("button", { name: "Agregar link" }).click();

    await expect(page.locator("[data-editor-status]")).toHaveText("Canal de prueba: agregado");
    await expect(add.getByLabel("URL")).toBeFocused();
    expect(await (await page.request.get("/miembro-demo")).text()).toContain("Canal de prueba");

    await page.getByRole("button", { name: "Editar Canal de prueba" }).click();
    const title = page.locator(".editor-link-panel:not([hidden])").getByLabel("Título");
    await expect(title).toBeFocused();
    await title.fill("Canal de prueba editado");
    await title.press("Tab");
    await expect(page.locator("[data-editor-status]")).toHaveText("Guardado");
    expect(await violations(page)).toEqual([]);

    await page.getByRole("button", { name: "Ocultar Canal de prueba editado" }).click();
    await expect(
      page.getByRole("button", { name: "Mostrar Canal de prueba editado" }),
    ).toBeVisible();
    const publicHtml = await (await page.request.get("/miembro-demo")).text();
    expect(publicHtml).not.toContain("Canal de prueba");

    // Al recargar, el editor muestra lo guardado.
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Mostrar Canal de prueba editado" }),
    ).toBeVisible();
  });

  /** Agrega un link desde el editor y espera que quede guardado. */
  async function addLinkTitled(page: Page, title: string) {
    const add = page.locator("form.add-link");
    await add
      .getByLabel("URL")
      .fill(`https://plektia.app/${title.toLowerCase().replace(/ /g, "-")}`);
    await add.getByLabel("Título").fill(title);
    await add.getByRole("button", { name: "Agregar link" }).click();
    await expect(page.getByRole("button", { name: `Editar ${title}` })).toBeVisible();
  }

  test("borrar ofrece deshacer durante 6 s; deshacer lo deja como estaba", async ({ page }) => {
    await page.goto("/admin");
    await addLinkTitled(page, "Para borrar");

    await page.getByRole("button", { name: "Editar Para borrar" }).click();
    await page.getByRole("button", { name: "Borrar link Para borrar" }).click();
    await expect(page.getByRole("button", { name: "Editar Para borrar" })).toHaveCount(0);
    await expect(page.locator(".undo-toast")).toContainText("Para borrar borrado");
    expect(await violations(page)).toEqual([]);

    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(page.getByRole("button", { name: "Editar Para borrar" })).toBeVisible();
    await page.waitForTimeout(6500);
    await page.reload();
    await expect(page.getByRole("button", { name: "Editar Para borrar" })).toBeVisible();
  });

  test("pasados los 6 s se borra de verdad y deja de verse en la página pública", async ({
    page,
  }) => {
    await page.goto("/admin");
    await page.getByRole("button", { name: "Editar Para borrar" }).click();
    await page.getByRole("button", { name: "Borrar link Para borrar" }).click();
    await expect(page.locator(".undo-toast")).toBeHidden({ timeout: 10_000 });

    await expect
      .poll(async () => (await page.request.get("/miembro-demo")).text())
      .not.toContain("Para borrar");
    await page.reload();
    await expect(page.getByRole("button", { name: "Editar Para borrar" })).toHaveCount(0);
  });

  test("si se sale de la página durante los 6 s, el borrado se envía igual", async ({ page }) => {
    await page.goto("/admin");
    await addLinkTitled(page, "Para salir");
    await page.getByRole("button", { name: "Editar Para salir" }).click();
    await page.getByRole("button", { name: "Borrar link Para salir" }).click();
    await page.goto("/admin/page");

    await expect
      .poll(async () => (await page.request.get("/miembro-demo")).text())
      .not.toContain("Para salir");
  });

  test("una URL insegura se rechaza junto al campo", async ({ page }) => {
    await page.goto("/admin");
    const add = page.locator("form.add-link");
    await add.getByLabel("URL").fill("http://inseguro.test");
    await add.getByLabel("Título").fill("Canal de prueba");
    await add.getByRole("button", { name: "Agregar link" }).click();

    await expect(add.getByRole("alert")).toBeVisible();
    await expect(add.getByLabel("URL")).toHaveAttribute("aria-invalid", "true");
  });
});

test.describe("panel: ordenar links y secciones (tarea 20)", () => {
  const TITLES = ["Orden A", "Orden B"];

  test.beforeAll(async () => {
    await resetPagesOf(MEMBER_ID);
    await deleteLinksTitled(MEMBER_ID, TITLES);
    await insertUnsectionedLinks(MEMBER_ID, MEMBER_ID, TITLES);
  });

  test.afterAll(async () => {
    await deleteLinksTitled(MEMBER_ID, TITLES);
  });

  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL ?? "", "member@plektia.test");
  });

  /** Los títulos de un grupo del editor, en el orden en que se ven. */
  const titlesIn = (page: Page, group: string) =>
    page
      .locator("section.editor-group")
      .filter({ has: page.getByRole("heading", { name: group, exact: true }) })
      .locator(".editor-link-title")
      .allTextContents();

  test("con el teclado: Espacio, flechas y Espacio, con anuncios", async ({ page }) => {
    await page.goto("/admin");
    expect(await titlesIn(page, "Sin sección")).toEqual(["Orden A", "Orden B"]);

    const handle = page.getByRole("button", { name: "Mover Orden B" });
    await expect(handle).toHaveAttribute("aria-roledescription", "draggable");
    await handle.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowUp");
    await expect(page.getByText(/Orden B: posición 1 en Sin sección/).first()).toBeAttached();
    await page.keyboard.press("Space");

    await expect(page.locator(".undo-toast")).toContainText("Orden B movido");
    await expect.poll(() => titlesIn(page, "Sin sección")).toEqual(["Orden B", "Orden A"]);

    await page.reload();
    expect(await titlesIn(page, "Sin sección")).toEqual(["Orden B", "Orden A"]);
    const publicHtml = await (await page.request.get("/miembro-demo")).text();
    expect(publicHtml.indexOf("Orden B")).toBeLessThan(publicHtml.indexOf("Orden A"));
  });

  test("con el mouse: lleva un link a otra sección", async ({ page }) => {
    // La CSP no se viola al arrastrar (los estilos de dnd-kit van por hash).
    const cspViolations: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("Content Security Policy")) cspViolations.push(message.text());
    });
    await page.goto("/admin");
    const handle = page.getByRole("button", { name: "Mover Orden A" });
    const target = page
      .locator("section.editor-group")
      .filter({ has: page.getByRole("heading", { name: "Sección 5", exact: true }) })
      .locator(".editor-link")
      .last();
    // La isla ya se hidrató cuando dnd-kit marca el asa como arrastrable.
    await expect(handle).toHaveAttribute("aria-roledescription", "draggable");
    // El destino (la última sección) queda justo arriba de "Sin sección": entran juntos.
    await handle.scrollIntoViewIfNeeded();
    const from = await handle.boundingBox();
    const to = await target.boundingBox();
    if (!from || !to) throw new Error("sin posiciones para arrastrar");

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + 30, to.y + to.height / 2, { steps: 20 });
    await page.mouse.move(to.x + 30, to.y + to.height / 3, { steps: 5 });
    await page.mouse.up();

    await expect(page.locator(".undo-toast")).toContainText("Orden A movido");
    expect(cspViolations).toEqual([]);
    await page.reload();
    expect(await titlesIn(page, "Sección 5")).toContain("Orden A");
    expect(await titlesIn(page, "Sin sección")).toEqual(["Orden B"]);
    expect(await violations(page)).toEqual([]);
  });

  test("con 'Sin sección' vacía, se puede soltar ahí un link para sacarlo de su sección", async ({
    page,
  }) => {
    await page.goto("/admin");
    // Primero se lleva el último link suelto a una sección, con el selector.
    await page.getByRole("button", { name: "Editar Orden B" }).click();
    await page
      .getByRole("combobox", { name: "Sección de Orden B" })
      .selectOption({ label: "Sección 5" });
    await expect.poll(() => titlesIn(page, "Sin sección")).toEqual([]);
    await expect(page.getByText(/Sin links sueltos/)).toBeVisible();

    // Después se arrastra de vuelta a "Sin sección", que quedó vacía.
    const handle = page.getByRole("button", { name: "Mover Orden B" });
    await expect(handle).toHaveAttribute("aria-roledescription", "draggable");
    await handle.scrollIntoViewIfNeeded();
    const target = page.getByText(/Sin links sueltos/);
    const from = await handle.boundingBox();
    const to = await target.boundingBox();
    if (!from || !to) throw new Error("sin posiciones para arrastrar");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + 20, to.y + to.height / 2, { steps: 20 });
    await page.mouse.move(to.x + 30, to.y + to.height / 2, { steps: 5 });
    await page.mouse.up();

    await expect.poll(() => titlesIn(page, "Sin sección")).toEqual(["Orden B"]);
    await page.reload();
    expect(await titlesIn(page, "Sin sección")).toEqual(["Orden B"]);
  });

  test("las secciones se ordenan con el teclado", async ({ page }) => {
    await page.goto("/admin");
    const sectionTitles = () => page.locator("section.editor-group h2").allTextContents();
    expect((await sectionTitles()).slice(0, 2)).toEqual(["Sección 1", "Sección 2"]);

    const handle = page.getByRole("button", { name: "Mover sección Sección 2" });
    await expect(handle).toHaveAttribute("aria-roledescription", "draggable");
    await handle.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowUp");
    // Se suelta cuando el lector de pantalla ya anunció la posición nueva.
    await expect(page.getByText("Sección Sección 2: posición 1 de 5").first()).toBeAttached();
    await page.keyboard.press("Space");

    await expect(page.locator(".undo-toast")).toContainText("Sección Sección 2 movida");
    // "Deshacer" la deja como estaba (y así la página del seed no cambia).
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect
      .poll(async () => (await sectionTitles()).slice(0, 2))
      .toEqual(["Sección 1", "Sección 2"]);
  });
});

// `/_actions/*` son las Astro Actions del panel: solo POST, solo con sesión y
// nunca en caché. Sin sesión no hacen nada, aunque se conozca el nombre.
test.describe("Actions del panel (/_actions)", () => {
  // Las de links reciben JSON (el editor); las de páginas, formularios.
  const payload = { pageId: MEMBER_ID, title: "x", url: "https://plektia.app", handle: "x-x-x" };
  for (const action of ["links.list", "links.create", "links.update", "pages.create"]) {
    test(`${action} sin sesión responde 401 y no se cachea`, async ({ request, baseURL }) => {
      const body = action.startsWith("pages.") ? { form: payload } : { data: payload };
      const response = await request.post(`/_actions/${action}`, {
        ...body,
        headers: { origin: baseURL ?? "" },
      });
      expect(response.status()).toBe(401);
      expect(response.headers()["cache-control"]).toBe("private, no-store");
    });
  }

  test("sin sesión, la sesión se revisa antes que los datos (401, no 400)", async ({
    request,
    baseURL,
  }) => {
    const response = await request.post("/_actions/links.delete", {
      data: {},
      headers: { origin: baseURL ?? "" },
    });
    expect(response.status()).toBe(401);
  });

  test("por GET no se pueden llamar", async ({ request }) => {
    const response = await request.get("/_actions/links.list");
    expect(response.ok()).toBe(false);
  });

  test("una Action que no existe no revela nada", async ({ request, baseURL }) => {
    const response = await request.post("/_actions/admin.deleteEverything", {
      data: {},
      headers: { origin: baseURL ?? "" },
    });
    expect(response.status()).toBe(404);
  });

  test("con sesión, la página de otra cuenta no se puede escribir", async ({
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL ?? "", "member@plektia.test");
    const OWNER_PAGE_ID = "11111111-1111-4111-8111-111111111111";
    const response = await context.request.post("/_actions/links.create", {
      data: { pageId: OWNER_PAGE_ID, title: "Colado", url: "https://plektia.app" },
      headers: { origin: baseURL ?? "" },
    });
    // Astro serializa el resultado (devalue): `ok` es false, con el mensaje de "no existe".
    const body = await response.text();
    expect(body).toContain('{"ok":1,');
    expect(body).toContain(",false,");
    expect(body).toContain("No encontramos lo que buscabas");
    const ownerPage = await context.request.get("/juedsay");
    expect(await ownerPage.text()).not.toContain("Colado");
  });
});
