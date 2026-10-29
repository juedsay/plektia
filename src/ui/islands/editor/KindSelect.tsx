import { LINK_KINDS, type LinkKind } from "@/domain/link-presentation";
import { detectLinkKind, KIND_NAMES } from "@/ui/view/link-kind";

// Tipo de link (SPEC-link-form, 7b): "Automático" muestra lo que se deduce de la
// URL; elegir otro lo fija. El valor vacío es `null` (automático).
interface Props {
  readonly id: string;
  readonly url: string;
  readonly value: LinkKind | null;
  readonly onChange: (kind: LinkKind | null) => void;
  readonly label?: string;
  readonly disabled?: boolean;
}

export function KindSelect({ id, url, value, onChange, label, disabled }: Props) {
  return (
    <div className="field">
      <label htmlFor={id}>Tipo</label>
      <select
        id={id}
        aria-label={label}
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => {
          const choice = event.target.value;
          onChange(choice === "" ? null : (choice as LinkKind));
        }}
      >
        <option value="">Automático ({KIND_NAMES[detectLinkKind(url)]})</option>
        {LINK_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {KIND_NAMES[kind]}
          </option>
        ))}
      </select>
    </div>
  );
}
