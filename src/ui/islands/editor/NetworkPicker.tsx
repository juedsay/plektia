import { useEffect, useRef, useState } from "react";

import { networkLabel, type SocialNetwork } from "@/ui/view/social-profile";

// Qué se agrega (SPEC-link-form, 7a): una red, para escribir solo el usuario, u
// "Otro link", para pegar una URL. Botones con `aria-pressed` (un grupo de
// opciones excluyentes que se usa con Tab y Enter o Espacio). Van con el nombre
// y sin logo: los logos no entran en el presupuesto de la isla (120 KB).

export type LinkSource = SocialNetwork | "other";

/** A la vista; el resto, en "Más…". */
const MAIN_NETWORKS: readonly SocialNetwork[] = [
  "instagram",
  "youtube",
  "tiktok",
  "x",
  "twitch",
  "github",
];
const MORE_NETWORKS: readonly SocialNetwork[] = [
  "kick",
  "linkedin",
  "facebook",
  "threads",
  "bluesky",
];

interface Props {
  readonly value: LinkSource;
  readonly onChange: (source: LinkSource) => void;
}

export function NetworkPicker({ value, onChange }: Props) {
  // "Más…" queda abierto si la red elegida está ahí.
  const [showMore, setShowMore] = useState(() => MORE_NETWORKS.includes(value as SocialNetwork));
  const networks = showMore ? [...MAIN_NETWORKS, ...MORE_NETWORKS] : MAIN_NETWORKS;
  // "Más…" desaparece al abrirse: el foco pasa a la primera red que apareció.
  const firstMore = useRef<HTMLButtonElement>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (revealed) firstMore.current?.focus();
  }, [revealed]);

  return (
    <div className="network-picker" role="group" aria-label="Qué querés agregar">
      {networks.map((network) => (
        <button
          key={network}
          ref={network === MORE_NETWORKS[0] ? firstMore : undefined}
          type="button"
          className="network-option"
          aria-pressed={value === network}
          onClick={() => {
            onChange(network);
          }}
        >
          <span>{networkLabel(network)}</span>
        </button>
      ))}
      {!showMore && (
        <button
          type="button"
          className="network-option"
          aria-expanded="false"
          onClick={() => {
            setShowMore(true);
            setRevealed(true);
          }}
        >
          <span>Más…</span>
        </button>
      )}
      <button
        type="button"
        className="network-option"
        aria-pressed={value === "other"}
        onClick={() => {
          onChange("other");
        }}
      >
        <span>Otro link</span>
      </button>
    </div>
  );
}
