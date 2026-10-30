import { useEffect, useId, useRef, useState } from "react";

import type { Section } from "@/application/ports/link-repository";

import type { Failure, SectionChanges } from "./editor-api";

interface Props {
  readonly section: Section;
  /** Posición entre las secciones y cuántas hay (para "Subir" y "Bajar"). */
  readonly index: number;
  readonly sectionCount: number;
  /** El rótulo automático del estilo ("Lado A"); `null` si el estilo no numera. */
  readonly sectionMark: string | null;
  /** Guarda un cambio; devuelve el error (para mostrarlo junto al campo) o `null`. */
  readonly onSave: (section: Section, changes: SectionChanges) => Promise<Failure | null>;
  readonly onMove: (section: Section, index: number) => void;
  readonly onDelete: (section: Section) => void;
  readonly onClose: () => void;
}

/**
 * Opciones de una sección, en el lugar (sin modal): nombre, mostrar el título,
 * ocultar la sección, subir o bajar y borrar. Cada cambio se guarda al toque o
 * al salir del campo.
 */
export function SectionSettings({
  section,
  index,
  sectionCount,
  sectionMark,
  onSave,
  onMove,
  onDelete,
  onClose,
}: Props) {
  const idPrefix = useId();
  const titleInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(section.title);
  const [label, setLabel] = useState(section.label ?? "");
  const [failure, setFailure] = useState<Failure | null>(null);

  useEffect(() => {
    titleInput.current?.focus();
  }, []);

  // Si la sección cambió desde afuera (deshacer, recargar), se muestra lo nuevo.
  useEffect(() => {
    setTitle(section.title);
  }, [section.title]);

  useEffect(() => {
    setLabel(section.label ?? "");
  }, [section.label]);

  const save = async (changes: SectionChanges) => {
    setFailure(await onSave(section, changes));
  };

  const saveTitle = () => {
    if (title.trim() === section.title) return;
    void save({ title });
  };

  const saveLabel = () => {
    const trimmed = label.trim();
    if (trimmed === (section.label ?? "")) return;
    void save({ label: trimmed === "" ? null : trimmed });
  };

  const titleError = failure?.fields["title"];
  const labelError = failure?.fields["label"];

  return (
    <div className="section-settings" id={`${idPrefix}-settings`}>
      {failure && (
        <p className="editor-error" role="alert">
          {failure.message}
        </p>
      )}
      <div className="field">
        <label htmlFor={`${idPrefix}-title`}>Nombre de la sección</label>
        <input
          ref={titleInput}
          id={`${idPrefix}-title`}
          maxLength={40}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          onBlur={saveTitle}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? `${idPrefix}-title-error` : undefined}
        />
        {titleError && (
          <p className="field-error" id={`${idPrefix}-title-error`}>
            {titleError}
          </p>
        )}
      </div>

      {sectionMark !== null && (
        <div className="field">
          <label htmlFor={`${idPrefix}-label`}>Rótulo</label>
          <input
            id={`${idPrefix}-label`}
            maxLength={16}
            placeholder={sectionMark}
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
            }}
            onBlur={saveLabel}
            aria-invalid={labelError ? true : undefined}
            aria-describedby={`${idPrefix}-label-hint${labelError ? ` ${idPrefix}-label-error` : ""}`}
          />
          <p className="field-hint" id={`${idPrefix}-label-hint`}>
            Va antes del nombre, en lugar del que pone el estilo (como “{sectionMark}”). Vacío,
            vuelve el del estilo.
          </p>
          {labelError && (
            <p className="field-error" id={`${idPrefix}-label-error`}>
              {labelError}
            </p>
          )}
        </div>
      )}

      <label className="choice">
        <input
          type="checkbox"
          checked={section.showTitle}
          onChange={(event) => void save({ showTitle: event.target.checked })}
        />
        <span className="choice-name">Mostrar el nombre en la página</span>
        <span className="choice-hint">Si no, sus links se ven sin el título encima.</span>
      </label>

      <div className="section-settings-actions">
        <button
          type="button"
          className="editor-action"
          onClick={() => void save({ visible: !section.visible })}
        >
          {section.visible ? "Ocultar sección" : "Mostrar sección"}
        </button>
        <button
          type="button"
          className="editor-action"
          disabled={index === 0}
          onClick={() => {
            onMove(section, index - 1);
          }}
        >
          Subir sección
        </button>
        <button
          type="button"
          className="editor-action"
          disabled={index >= sectionCount - 1}
          onClick={() => {
            onMove(section, index + 1);
          }}
        >
          Bajar sección
        </button>
        <button type="button" className="editor-action" onClick={onClose}>
          Listo
        </button>
      </div>

      <div className="editor-link-danger">
        <button
          type="button"
          className="button is-quiet"
          onClick={() => {
            onDelete(section);
          }}
        >
          Borrar sección
        </button>
        <p className="field-hint">Sus links pasan a “Sin sección”; no se borran.</p>
      </div>
    </div>
  );
}
