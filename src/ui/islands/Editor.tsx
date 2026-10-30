import { actions } from "astro:actions";
import { useMemo } from "react";

import type { FormResult } from "@/actions/form-result";
import type { OwnLinks } from "@/application/ports/link-repository";
import { PAGE_CHANGED_EVENT } from "@/ui/view/page-changed";

import { Editor } from "./editor/Editor";
import { type EditorApi, UNREACHABLE } from "./editor/editor-api";

// Isla del editor (la única del panel): conecta el componente con las Actions
// de links de la página elegida. La lógica y la interfaz viven en ./editor.

interface Props {
  readonly pageId: string;
  readonly initialContent: OwnLinks;
  readonly sectionMark: string | null;
}

/**
 * El resultado de una Action que cambia la página, o "sin conexión" si la
 * llamada misma falló. Si se guardó, avisa a la vista previa para que se recargue.
 */
function resultOf<Value>(response: {
  data?: FormResult<Value> | undefined;
  error?: unknown;
}): FormResult<Value> {
  const result = response.data ?? UNREACHABLE;
  if (result.ok) document.dispatchEvent(new Event(PAGE_CHANGED_EVENT));
  return result;
}

/** Un borrado que tiene que salir aunque la pestaña se esté cerrando. */
function deleteWithKeepalive(
  action: "links.delete" | "sections.delete",
  pageId: string,
  target: { id: string; version: number },
) {
  void fetch(`/_actions/${action}`, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pageId, ...target }),
  }).catch(() => undefined);
}

function actionsApi(pageId: string): EditorApi {
  return {
    list: async () => (await actions.links.list({ pageId })).data ?? null,
    create: async (link) => resultOf(await actions.links.create({ pageId, ...link })),
    update: async (target, changes) =>
      resultOf(await actions.links.update({ pageId, ...target, changes })),
    setVisibility: async (target, visible) =>
      resultOf(await actions.links.setVisibility({ pageId, ...target, visible })),
    delete: async (target) => resultOf(await actions.links.delete({ pageId, ...target })),
    deleteOnExit: (target) => {
      deleteWithKeepalive("links.delete", pageId, target);
    },
    move: async (sectionId, order) =>
      resultOf(await actions.links.move({ pageId, sectionId, items: order })),
    reorderSections: async (order) =>
      resultOf(await actions.sections.reorder({ pageId, items: order })),
    createSection: async (title, id) =>
      resultOf(await actions.sections.create({ pageId, id, title })),
    updateSection: async (target, changes) =>
      resultOf(await actions.sections.update({ pageId, ...target, changes })),
    deleteSection: async (target) => resultOf(await actions.sections.delete({ pageId, ...target })),
    deleteSectionOnExit: (target) => {
      deleteWithKeepalive("sections.delete", pageId, target);
    },
    getMedia: async (linkId) =>
      (await actions.links.getMedia({ pageId, linkId })).data ?? UNREACHABLE,
    setMedia: async (linkId, settings) =>
      resultOf(await actions.links.setMedia({ pageId, linkId, ...settings })),
    fetchPreview: async (url) => resultOf(await actions.links.fetchPreview({ url })),
    fetchPreviewImage: async (url) => resultOf(await actions.links.fetchPreviewImage({ url })),
    setPreviewImage: async (target, image) => {
      const form = new FormData();
      form.set("pageId", pageId);
      form.set("id", target.id);
      form.set("version", String(target.version));
      form.set(
        "image",
        new File([image], image.type === "image/webp" ? "preview.webp" : "preview.jpg", {
          type: image.type,
        }),
      );
      return resultOf(await actions.links.setPreviewImage(form));
    },
    lastAppEdit: async (linkId) =>
      (await actions.links.lastAppEdit({ id: linkId }).catch(() => null))?.data?.value ?? null,
    removePreviewImage: async (target) =>
      resultOf(await actions.links.removePreviewImage({ pageId, ...target })),
  };
}

export default function EditorIsland({ pageId, initialContent, sectionMark }: Props) {
  const api = useMemo(() => actionsApi(pageId), [pageId]);
  return <Editor api={api} initialContent={initialContent} sectionMark={sectionMark} />;
}
