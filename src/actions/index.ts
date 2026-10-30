// Astro Actions del panel (SPEC-admin-panel): cada una llama a un caso de uso
// con la sesión del usuario. Sin API paralela: panel, MCP y tests pasan por las
// mismas funciones. Los formularios funcionan sin JavaScript; las de links las
// llama la isla del editor (JSON).
import {
  removeLinkPreviewImage,
  setLinkPreviewImage,
} from "@/application/links/link-preview-image";
import { PREVIEW_MESSAGES } from "@/application/links/fetch-link-preview";
import { ActionError, type ActionAPIContext, defineAction } from "astro:actions";
import { z } from "zod";

import { inviteUser, revokeUser } from "@/application/admin/users";
import { revokeConnection, setConnectionPermission } from "@/application/mcp/connections";
import { decideConsent } from "@/application/mcp/consent";
import { createLink } from "@/application/links/create-link";
import type { OwnLinks } from "@/application/ports/link-repository";
import { deleteLink } from "@/application/links/delete-link";
import { getLinkMedia, setLinkMedia } from "@/application/links/link-media";
import { moveLinks } from "@/application/links/move-links";
import { setLinkVisibility } from "@/application/links/set-link-visibility";
import { updateLink } from "@/application/links/update-link";

import { createPage } from "@/application/pages/create-page";
import { createSection } from "@/application/sections/create-section";
import { deleteSection } from "@/application/sections/delete-section";
import { reorderSections } from "@/application/sections/reorder-sections";
import { updateSection } from "@/application/sections/update-section";
import { selectPage } from "@/application/pages/select-page";
import { removePageAvatar, setPageAvatar } from "@/application/pages/set-page-avatar";
import { updatePageSettings } from "@/application/pages/update-page-settings";
import { formFields, toFormResult } from "@/actions/form-result";
import { ok } from "@/domain/result";
import {
  actionsRateLimiter,
  adminRepositoriesFor,
  linkPreview,
  linkPreviewSourceImage,
  liveCheckNow,
  pageCache,
} from "@/composition/runtime";

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
    media: repositories.mediaOf(pageId),
    /** La cuenta de la sesión y su carpeta del bucket de vistas previas. */
    ownerId: repositories.ownerId,
    previewImages: repositories.previewImages,
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
        const { links, previewImages, purge } = await linksOfPage(context, input);
        const deleted = await deleteLink({
          links,
          previewImages: { reader: links, storage: previewImages },
        })(input);
        if (deleted.ok) await purge();
        return toFormResult(deleted);
      },
    }),
    /**
     * `{ pageId, sectionId, items }`: deja un grupo (sección o "Sin sección") en
     * ese orden, trayendo links de otros grupos. Devuelve el contenido nuevo:
     * mover cambia la versión de cada link que se corrió.
     */
    move: defineAction({
      accept: "json",
      handler: async (input: unknown, context) => {
        const { links, purge } = await linksOfPage(context, input);
        const moved = await moveLinks({ links })(input);
        if (!moved.ok) return toFormResult<OwnLinks>(moved);
        await purge();
        return toFormResult(ok(await links.listOwn()));
      },
    }),
    /**
     * `{ url }`: el título y la descripción de un artículo, para proponerlos en
     * el panel (SPEC-link-form, 7c). No guarda nada; solo el dueño, y con límite.
     */
    fetchPreview: defineAction({
      accept: "json",
      handler: async (input: unknown, context) => {
        const { ownerId } = await repositoriesOf(context);
        const preview = await linkPreview(new URL(context.request.url).hostname)(ownerId, input);
        if (preview.ok) {
          return {
            ok: true as const,
            value: {
              title: preview.value.title,
              description: preview.value.description,
              imageUrl: preview.value.imageUrl,
            },
          };
        }
        return {
          ok: false as const,
          message: PREVIEW_MESSAGES[preview.error],
          fields: {},
          values: {},
        };
      },
    }),
    /**
     * `{ url }`: la imagen de la vista previa como `data:` URL, para que el panel
     * la recorte y la re-codifique (7c-2). No guarda nada.
     */
    fetchPreviewImage: defineAction({
      accept: "json",
      handler: async (input: unknown, context) => {
        const { ownerId } = await repositoriesOf(context);
        const image = await linkPreviewSourceImage(new URL(context.request.url).hostname)(
          ownerId,
          input,
        );
        if (image.ok) return { ok: true as const, value: image.value };
        return {
          ok: false as const,
          message: PREVIEW_MESSAGES[image.error],
          fields: {},
          values: {},
        };
      },
    }),
    /**
     * `{ pageId, id, version, image }`: la imagen ya re-codificada (480 × 252).
     * Se vuelve a validar con sus bytes antes de guardarla.
     */
    setPreviewImage: defineAction({
      accept: "form",
      handler: async (form, context) => {
        const values = formFields(form);
        const { links, ownerId, previewImages, purge } = await linksOfPage(context, values);
        const file = form.get("image");
        const image =
          file instanceof File && file.size > 0
            ? { size: file.size, bytes: async () => new Uint8Array(await file.arrayBuffer()) }
            : null;
        const updated = await setLinkPreviewImage({ links, images: previewImages, ownerId })(
          values,
          image,
        );
        if (updated.ok) await purge();
        return toFormResult(updated);
      },
    }),
    /** `{ pageId, id, version }`: saca la imagen de la vista previa y borra el archivo. */
    removePreviewImage: defineAction({
      accept: "json",
      handler: async (input: unknown, context) => {
        const { links, previewImages, purge } = await linksOfPage(context, input);
        const updated = await removeLinkPreviewImage({ links, images: previewImages })(input);
        if (updated.ok) await purge();
        return toFormResult(updated);
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
    /** `{ pageId, linkId }`: "Transmito en este canal" y el contenido destacado. */
    getMedia: defineAction({
      accept: "json",
      handler: async (input: unknown, context) => {
        const { media } = await linksOfPage(context, input);
        return toFormResult(await getLinkMedia({ media })(input));
      },
    }),
    /**
     * `{ pageId, linkId, watchLive, featuredMode, pinnedVideo? }`: guarda la
     * configuración completa (repetir el pedido deja lo mismo).
     */
    setMedia: defineAction({
      accept: "json",
      handler: async (input: unknown, context) => {
        const { media, purge } = await linksOfPage(context, input);
        const saved = await setLinkMedia({ media })(input);
        if (saved.ok) await purge();
        return toFormResult(saved);
      },
    }),
  },
  sections: {
    /** `{ pageId, title, showTitle?, visible? }`: una sección nueva, al final. */
    create: defineAction({
      accept: "json",
      handler: async (input: unknown, context) => {
        const { links, purge } = await linksOfPage(context, input);
        const created = await createSection({ sections: links })(input);
        if (created.ok) await purge();
        return toFormResult(created);
      },
    }),
    /** `{ pageId, id, version, changes }`: renombrar, ocultar o mostrar el título. */
    update: defineAction({
      accept: "json",
      handler: async (input: unknown, context) => {
        const { links, purge } = await linksOfPage(context, input);
        const updated = await updateSection({ sections: links })(input);
        if (updated.ok) await purge();
        return toFormResult(updated);
      },
    }),
    /**
     * `{ pageId, id, version }`: borra la sección; sus links pasan a "Sin sección".
     * Devuelve el contenido nuevo (los links cambian de grupo y de versión).
     */
    delete: defineAction({
      accept: "json",
      handler: async (input: unknown, context) => {
        const { links, purge } = await linksOfPage(context, input);
        const deleted = await deleteSection({ sections: links })(input);
        if (!deleted.ok) return toFormResult<OwnLinks>(deleted);
        await purge();
        return toFormResult(ok(await links.listOwn()));
      },
    }),
    /** `{ pageId, items }`: el orden completo de las secciones. Devuelve el contenido nuevo. */
    reorder: defineAction({
      accept: "json",
      handler: async (input: unknown, context) => {
        const { links, purge } = await linksOfPage(context, input);
        const reordered = await reorderSections({ sections: links })(input);
        if (!reordered.ok) return toFormResult<OwnLinks>(reordered);
        await purge();
        return toFormResult(ok(await links.listOwn()));
      },
    }),
  },
  live: {
    /**
     * "Comprobar ahora": revisa ya los canales vigilados de la cuenta. Una vez
     * por minuto; repetirlo dentro del minuto no vuelve a gastar cuota.
     */
    checkNow: defineAction({
      accept: "form",
      handler: async (_form, context) => {
        const { ownerId } = await repositoriesOf(context);
        const checked = await liveCheckNow()(ownerId);
        if (checked.ok) return { ok: true as const, value: checked.value.checked };
        return {
          ok: false as const,
          message:
            checked.error === "rate_limited"
              ? "Ya lo pediste hace menos de un minuto. Probá de nuevo en un rato."
              : "La revisión en vivo todavía no está configurada.",
          fields: {},
          values: {},
        };
      },
    }),
  },
  users: {
    /**
     * `{ email, handle }`: invita a una persona (como `member`). Solo un owner:
     * la base lo verifica dentro de la función; si no, `forbidden`.
     */
    invite: defineAction({
      accept: "form",
      handler: async (form, context) => {
        const { users } = await repositoriesOf(context);
        const values = formFields(form);
        return toFormResult(await inviteUser({ users })(values), values);
      },
    }),
    /** `{ email }`: quita el acceso (la invitación y, si existe, la cuenta). */
    revoke: defineAction({
      accept: "form",
      handler: async (form, context) => {
        const { users } = await repositoriesOf(context);
        return toFormResult(await revokeUser({ users, cache: pageCache() })(formFields(form)));
      },
    }),
  },
  connections: {
    /** `{ clientId, access }`: solo lectura (`read`) o lectura y edición (`write`). */
    setPermission: defineAction({
      accept: "form",
      handler: async (form, context) => {
        const { connections } = await repositoriesOf(context);
        return toFormResult(await setConnectionPermission({ connections })(formFields(form)));
      },
    }),
    /** `{ clientId }`: desconecta la app; su próxima llamada a `/mcp` da 401. */
    revoke: defineAction({
      accept: "form",
      handler: async (form, context) => {
        const { connections } = await repositoriesOf(context);
        return toFormResult(await revokeConnection({ connections })(formFields(form)));
      },
    }),
  },
  oauth: {
    /**
     * `{ authorization_id, decision, access }`: aprobar o rechazar una app de IA
     * en `/oauth/consent`. El permiso por defecto es solo lectura. Devuelve a
     * dónde volver a la app (la página la redirige).
     */
    decide: defineAction({
      accept: "form",
      handler: async (form, context) => {
        const { connections } = await repositoriesOf(context);
        const values = formFields(form);
        const decided = await decideConsent(connections)({
          authorizationId: values["authorization_id"] ?? "",
          approve: values["decision"] === "approve",
          access: values["access"] === "write" ? "write" : "read",
        });
        if (decided.ok) return { ok: true as const, value: { redirectUrl: decided.value } };
        return {
          ok: false as const,
          message:
            decided.error === "forbidden"
              ? "Tu cuenta no puede autorizar apps."
              : "Este pedido ya no es válido. Volvé a conectar la app desde el principio.",
          fields: {},
          values: {},
        };
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
    /**
     * `{ pageId, avatar }`: el WebP de 512 × 512 que el panel recortó en el
     * navegador. Se vuelve a validar con sus bytes antes de guardarlo.
     */
    setAvatar: defineAction({
      accept: "form",
      handler: async (form, context) => {
        const { ownerId, pages, avatars } = await repositoriesOf(context);
        const file = form.get("avatar");
        const image =
          file instanceof File && file.size > 0
            ? { size: file.size, bytes: async () => new Uint8Array(await file.arrayBuffer()) }
            : null;
        return toFormResult(
          await setPageAvatar({ pages, avatars, cache: pageCache(), ownerId })(
            formFields(form),
            image,
          ),
        );
      },
    }),
    /** `{ pageId }`: saca el avatar (vuelve la inicial). */
    removeAvatar: defineAction({
      accept: "form",
      handler: async (form, context) => {
        const { pages, avatars } = await repositoriesOf(context);
        return toFormResult(
          await removePageAvatar({ pages, avatars, cache: pageCache() })(formFields(form)),
        );
      },
    }),
    /** Guarda el nombre, la bio, el tema, el modo (claro, oscuro o automático) y el @handle. */
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
