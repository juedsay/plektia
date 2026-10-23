import { useCallback, useState } from "react";

import type { Link, OwnLinks } from "@/application/ports/link-repository";
import { addLink, groupLinks, replaceLink } from "@/ui/view/editor-state";

import { AddLinkForm } from "./AddLinkForm";
import type { EditorApi } from "./editor-api";
import { LinkRow } from "./LinkRow";

interface Props {
  readonly api: EditorApi;
  readonly initialContent: OwnLinks;
}

/**
 * Editor de links de la página elegida (SPEC-admin-panel, "Editor"): agregar,
 * editar en el lugar y mostrar u ocultar. Cada cambio se guarda al instante y
 * se anuncia en una región en vivo.
 */
export function Editor({ api, initialContent }: Props) {
  const [content, setContent] = useState(initialContent);
  const [announcement, setAnnouncement] = useState("");

  const announce = useCallback((message: string) => {
    // Vaciarla antes hace que el lector de pantalla repita un mismo mensaje.
    setAnnouncement("");
    requestAnimationFrame(() => {
      setAnnouncement(message);
    });
  }, []);

  const saved = useCallback((link: Link) => {
    setContent((current) => replaceLink(current, link));
  }, []);

  const created = (link: Link) => {
    setContent((current) => addLink(current, link));
    announce(`${link.title}: agregado`);
  };

  const reload = useCallback(async () => {
    const fresh = await api.list().catch(() => null);
    if (fresh) setContent(fresh);
  }, [api]);

  const groups = groupLinks(content);

  return (
    <div className="editor">
      <AddLinkForm api={api} sections={content.sections} onCreated={created} />

      {groups.map((group) => {
        const headingId = `editor-group-${group.section?.id ?? "sin-seccion"}`;
        return (
          <section key={headingId} className="editor-group" aria-labelledby={headingId}>
            <h2 id={headingId} className="editor-group-title">
              {group.section?.title ?? "Sin sección"}
              {group.section && !group.section.visible && <span className="admin-tag">Oculta</span>}
            </h2>
            {group.links.length > 0 ? (
              <ul className="editor-links">
                {group.links.map((link) => (
                  <LinkRow
                    key={link.id}
                    link={link}
                    api={api}
                    onSaved={saved}
                    onReload={reload}
                    announce={announce}
                  />
                ))}
              </ul>
            ) : (
              <p className="editor-empty">
                {content.links.length === 0
                  ? "Todavía no hay links: agregá el primero con la URL de arriba."
                  : "Sin links en esta sección."}
              </p>
            )}
          </section>
        );
      })}

      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
