// Astro Actions del panel (SPEC-admin-panel): cada una llama a un caso de uso
// con la sesión del usuario. Sin API paralela: panel, MCP y tests pasan por las
// mismas funciones. Los formularios funcionan sin JavaScript; las de links las
// llama la isla del editor (JSON).
import { ActionError, type ActionAPIContext, defineAction } from "astro:actions";
import { z } from "zod";

import { createLink } from "@/application/links/create-link";
import { deleteLink } from "@/application/links/delete-link";
import { setLinkVisibility } from "@/application/links/set-link-visibility";
import { updateLink } from "@/application/links/update-link";

import { createPage } from "@/application/pages/create-page";
import { selectPage } from "@/application/pages/select-page";
import { updatePageSettings } from "@/application/pages/update-page-settings";
import { formFields, toFormResult } from "@/actions/form-result";
import { actionsRateLimiter, adminRepositoriesFor, pageCache } from "@/composition/runtime";

/**
 * Los repositorios del usuario con sesión. Sin sesión la Action no corre, y
 * cada usuario tiene un límite de pedidos por minuto (scripts o abuso).
 */
async function repositoriesOf(context: ActionAPIContext) {
  const { user } = context.locals;
  if (!user) throw new ActionError({ code: "UNAUTHORIZED", message: "Iniciá sesión." });
  if (!(await actionsRateLimiter().allow(user.id))) {
    throw new ActionError({
      code: "TOO_MANY_REQUESTS",
      message: "Demasiados cambios seguidos. Esperá un minuto y probá de nuevo.",
    });
  }
  return adminRepositoriesFor(context.request, context.cookies, user.id);
}

const PageTarget = z.object({ pageId: z.uuid() });

/**
 * Los links de una página de la sesión. El `pageId` llega del editor: si no es
 * una página propia, la RLS y el trigger de dueño rechazan cada escritura.
 */
async function linksOfPage(context: ActionAPIContext, input: unknown) {
  // Primero la sesión y el límite: sin sesión, nada más se mira.
  const repositories = await repositoriesOf(context);
  const target = PageTarget.safeParse(input);
  if (!target.success) {
    throw new ActionError({ code: "BAD_REQUEST", message: "Falta la página." });
  }
  const { pageId } = target.data;
  return {
    links: repositories.linksOf(pageId),
    /** Purga la página pública después de un cambio (se ve al instante). */
    purge: async () => {
      const page = (await repositories.pages.listOwn()).find(
        (candidate) => candidate.id === pageId,
      );
      if (page) await pageCache().purgeProfile(page.handle);
    },
  };
}

export const server = {
  links: {
    /** Las secciones y los links de la página, en orden (para recargar tras un conflicto). */
    list: defineAction({
      accept: "json",
      handler: async (input: unknown, context) => {
        const { links } = await linksOfPage(context, input);
        return links.listOwn();
      },
    }),
    create: defineAction({
      accept: "json",
      handler: async (input: unknown, context) => {
        const { links, purge } = await linksOfPage(context, input);
        const created = await createLink({ links })(input);
        if (created.ok) await purge();
        return toFormResult(created);
      },
    }),
    /** `{ pageId, id, version, changes }`: guarda lo que cambió de un link. */
    update: defineAction({
      accept: "json",
      handler: async (input: unknown, context) => {
        const { links, purge } = await linksOfPage(context, input);
        const updated = await updateLink({ links })(input);
        if (updated.ok) await purge();
        return toFormResult(updated);
      },
    }),
    /**
     * `{ pageId, id, version }`: borra un link. El editor la llama pasados los 6 s
     * de "Deshacer" (o al cerrar la pestaña, con `keepalive`).
     */
    delete: defineAction({
      accept: "json",
      handler: async (input: unknown, context) => {
        const { links, purge } = await linksOfPage(context, input);
        const deleted = await deleteLink({ links })(input);
        if (deleted.ok) await purge();
        return toFormResult(deleted);
      },
    }),
    /** `{ pageId, id, version, visible }`: mostrar u ocultar en la página pública. */
    setVisibility: defineAction({
      accept: "json",
      handler: async (input: unknown, context) => {
        const { links, purge } = await linksOfPage(context, input);
        const updated = await setLinkVisibility({ links })(input);
        if (updated.ok) await purge();
        return toFormResult(updated);
      },
    }),
  },
  pages: {
    /** Elige la página con la que se trabaja (queda como la última usada). */
    select: defineAction({
      accept: "form",
      handler: async (form, context) => {
        const { pages } = await repositoriesOf(context);
        return toFormResult(await selectPage({ pages })(formFields(form)));
      },
    }),
    /** Crea una página nueva y pasa a trabajar con ella. */
    create: defineAction({
      accept: "form",
      handler: async (form, context) => {
        const { pages } = await repositoriesOf(context);
        const values = formFields(form);
        const created = await createPage({ pages, cache: pageCache() })(values);
        if (created.ok) await selectPage({ pages })({ pageId: created.value.id });
        return toFormResult(created, values);
      },
    }),
    /** Guarda el nombre, la bio, el tema y si se muestra el @handle. */
    update: defineAction({
      accept: "form",
      handler: async (form, context) => {
        const { pages } = await repositoriesOf(context);
        const values = formFields(form);
        // Un checkbox sin marcar no viaja en el formulario.
        const input = { ...values, showHandle: values["showHandle"] === "on" };
        return toFormResult(await updatePageSettings({ pages, cache: pageCache() })(input), values);
      },
    }),
  },
};
