import { useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import type { ReactNode } from "react";

import type { Section } from "@/application/ports/link-repository";
import { UNSECTIONED_GROUP } from "@/ui/view/editor-state";

/** Los grupos reciben links aunque estén vacíos; los links ganan si se superponen. */
const GROUP_COLLISION_PRIORITY = 1;

interface Props {
  /** `null` es "Sin sección": no se ordena entre las secciones, pero recibe links. */
  readonly section: Section | null;
  readonly index: number;
  readonly children: ReactNode;
}

/** Un grupo del editor: una sección (que se puede ordenar) o "Sin sección". */
export function EditorGroup({ section, index, children }: Props) {
  return section ? (
    <SortableSection section={section} index={index}>
      {children}
    </SortableSection>
  ) : (
    <UnsectionedGroup>{children}</UnsectionedGroup>
  );
}

function SortableSection({
  section,
  index,
  children,
}: {
  readonly section: Section;
  readonly index: number;
  readonly children: ReactNode;
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: section.id,
    index,
    type: "section",
    accept: ["link", "section"],
    collisionPriority: GROUP_COLLISION_PRIORITY,
    data: { title: section.title, kind: "section" },
  });
  const headingId = `editor-group-${section.id}`;
  return (
    <section
      ref={ref}
      className={`editor-group${isDragging ? " is-dragging" : ""}`}
      aria-labelledby={headingId}
    >
      {/* El asa va fuera del título: así el nombre del título es solo el de la sección. */}
      <div className="editor-group-header">
        <button
          ref={handleRef}
          type="button"
          className="drag-handle"
          aria-label={`Mover sección ${section.title}`}
        >
          <DragIcon />
        </button>
        <h2 id={headingId} className="editor-group-title">
          {section.title}
          {!section.visible && <span className="admin-tag">Oculta</span>}
        </h2>
      </div>
      {children}
    </section>
  );
}

function UnsectionedGroup({ children }: { readonly children: ReactNode }) {
  const { ref } = useDroppable({
    id: UNSECTIONED_GROUP,
    type: "group",
    accept: "link",
    collisionPriority: GROUP_COLLISION_PRIORITY,
  });
  const headingId = `editor-group-${UNSECTIONED_GROUP}`;
  return (
    <section ref={ref} className="editor-group" aria-labelledby={headingId}>
      <div className="editor-group-header">
        <h2 id={headingId} className="editor-group-title">
          Sin sección
        </h2>
      </div>
      {children}
    </section>
  );
}

/** Seis puntos: el asa para arrastrar (o mover con el teclado). */
export function DragIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}
