// Astro Actions del panel (SPEC-admin-panel): cada una llama a un caso de uso
// con la sesión del usuario. Sin API paralela: panel, MCP y tests pasan por las
// mismas funciones. Los formularios funcionan sin JavaScript.
import { ActionError, type ActionAPIContext, defineAction } from "astro:actions";

import { createPage } from "@/application/pages/create-page";
import { selectPage } from "@/application/pages/select-page";
import { updatePageSettings } from "@/application/pages/update-page-settings";
import { formFields, toFormResult } from "@/actions/form-result";
import { adminRepositoriesFor, pageCache } from "@/composition/runtime";

/** Los repositorios del usuario con sesión; sin sesión, la Action no corre. */
function repositoriesOf(context: ActionAPIContext) {
  const { user } = context.locals;
  if (!user) throw new ActionError({ code: "UNAUTHORIZED", message: "Iniciá sesión." });
  return adminRepositoriesFor(context.request, context.cookies, user.id);
}

export const server = {
  pages: {
    /** Elige la página con la que se trabaja (queda como la última usada). */
    select: defineAction({
      accept: "form",
      handler: async (form, context) => {
        const { pages } = repositoriesOf(context);
        return toFormResult(await selectPage({ pages })(formFields(form)));
      },
    }),
    /** Crea una página nueva y pasa a trabajar con ella. */
    create: defineAction({
      accept: "form",
      handler: async (form, context) => {
        const { pages } = repositoriesOf(context);
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
        const { pages } = repositoriesOf(context);
        const values = formFields(form);
        // Un checkbox sin marcar no viaja en el formulario.
        const input = { ...values, showHandle: values["showHandle"] === "on" };
        return toFormResult(await updatePageSettings({ pages, cache: pageCache() })(input), values);
      },
    }),
  },
};
