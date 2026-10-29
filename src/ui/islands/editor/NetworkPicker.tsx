import { useEffect, useRef, useState } from "react";

import { NETWORK_ICON_PATHS } from "@/ui/view/network-icons";
import { networkLabel, type SocialNetwork } from "@/ui/view/social-profile";

// Qué se agrega (SPEC-link-form, 7a): una red, para escribir solo el usuario, u
// "Otro link", para pegar una URL. Botones con `aria-pressed` (un grupo de
// opciones excluyentes que se usa con Tab y Enter o Espacio). Cada uno con el
// logo y el nombre de la red.

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
          <NetworkGlyph network={network} />
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
        <LinkGlyph />
        <span>Otro link</span>
      </button>
    </div>
  );
}

function NetworkGlyph({ network }: { readonly network: SocialNetwork }) {
  const path = NETWORK_ICON_PATHS[network];
  if (!path) {
    // LinkedIn: sin logo en simple-icons, un "in" genérico.
    return (
      <span className="network-glyph network-glyph-text" aria-hidden="true">
        in
      </span>
    );
  }
  return (
    <svg className="network-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d={path} />
    </svg>
  );
}

function LinkGlyph() {
  return (
    <svg
      className="network-glyph"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" />
    </svg>
  );
}
