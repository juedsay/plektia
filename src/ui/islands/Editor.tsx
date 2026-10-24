import { actions } from "astro:actions";
import { useMemo } from "react";

import type { FormResult } from "@/actions/form-result";
import type { Link, OwnLinks } from "@/application/ports/link-repository";

import { Editor } from "./editor/Editor";
import { type EditorApi, UNREACHABLE } from "./editor/editor-api";

// Isla del editor (la única del panel): conecta el componente con las Actions
// de links de la página elegida. La lógica y la interfaz viven en ./editor.

interface Props {
  readonly pageId: string;
  readonly initialContent: OwnLinks;
}

/** El resultado de una Action, o "sin conexión" si la llamada misma falló. */
function resultOf(response: {
  data?: FormResult<Link> | undefined;
  error?: unknown;
}): FormResult<Link> {
  return response.data ?? UNREACHABLE;
}

/** Un borrado que tiene que salir aunque la pestaña se esté cerrando. */
function deleteWithKeepalive(pageId: string, target: { id: string; version: number }) {
  void fetch("/_actions/links.delete", {
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
    delete: async (target) =>
      (await actions.links.delete({ pageId, ...target })).data ?? UNREACHABLE,
    deleteOnExit: (target) => {
      deleteWithKeepalive(pageId, target);
    },
    move: async (sectionId, order) =>
      (await actions.links.move({ pageId, sectionId, items: order })).data ?? UNREACHABLE,
    reorderSections: async (order) =>
      (await actions.sections.reorder({ pageId, items: order })).data ?? UNREACHABLE,
  };
}

export default function EditorIsland({ pageId, initialContent }: Props) {
  const api = useMemo(() => actionsApi(pageId), [pageId]);
  return <Editor api={api} initialContent={initialContent} />;
}
