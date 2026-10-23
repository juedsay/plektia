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

function actionsApi(pageId: string): EditorApi {
  return {
    list: async () => (await actions.links.list({ pageId })).data ?? null,
    create: async (link) => resultOf(await actions.links.create({ pageId, ...link })),
    update: async (target, changes) =>
      resultOf(await actions.links.update({ pageId, ...target, changes })),
    setVisibility: async (target, visible) =>
      resultOf(await actions.links.setVisibility({ pageId, ...target, visible })),
  };
}

export default function EditorIsland({ pageId, initialContent }: Props) {
  const api = useMemo(() => actionsApi(pageId), [pageId]);
  return <Editor api={api} initialContent={initialContent} />;
}
