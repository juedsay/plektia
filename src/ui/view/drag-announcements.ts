import { type LinkOrder, placeInOrder, UNSECTIONED_GROUP } from "@/ui/view/editor-state";

// Textos que escucha el lector de pantalla al ordenar arrastrando o con el
// teclado (SPEC-admin-panel, "Accesibilidad"). Puros: la isla solo los conecta.

/** Lo que cada arrastrable lleva en `data`: su título y si es link o sección. */
export interface DragData {
  readonly title: string;
  readonly kind: "link" | "section";
}

export function dragTitle(data: unknown): string {
  return typeof data === "object" &&
    data !== null &&
    "title" in data &&
    typeof data.title === "string"
    ? data.title
    : "el elemento";
}

export function dragKind(data: unknown): DragData["kind"] | undefined {
  if (typeof data !== "object" || data === null || !("kind" in data)) return undefined;
  return data.kind === "link" || data.kind === "section" ? data.kind : undefined;
}

export const DRAG_INSTRUCTIONS =
  "Para mover, presioná Espacio, usá las flechas y presioná Espacio de nuevo para soltar. Escape cancela.";

export function startText(data: unknown): string {
  return `Tomaste ${dragTitle(data)}. Usá las flechas para moverlo.`;
}

export function cancelText(data: unknown): string {
  return `Movimiento cancelado: ${dragTitle(data)} volvió a su lugar.`;
}

interface PositionInput {
  readonly data: unknown;
  /** Lo que informa dnd-kit (puede no seguir los cambios de grupo). */
  readonly index: number;
  readonly group: unknown;
  readonly linkId: string;
  /** El orden del arrastre en curso, si lo hay: manda sobre `index` y `group`. */
  readonly order: LinkOrder | null;
  readonly sectionCount: number;
  readonly groupName: (groupKey: string) => string;
}

/** "Twitch: posición 2 en Redes" o "Sección Redes: posición 1 de 3". */
export function positionText({
  data,
  index,
  group,
  linkId,
  order,
  sectionCount,
  groupName,
}: PositionInput): string {
  const title = dragTitle(data);
  if (dragKind(data) === "section") {
    return `Sección ${title}: posición ${String(index + 1)} de ${String(sectionCount)}`;
  }
  const place = order ? placeInOrder(order, linkId) : null;
  const groupKey = place
    ? (place.sectionId ?? UNSECTIONED_GROUP)
    : typeof group === "string"
      ? group
      : UNSECTIONED_GROUP;
  return `${title}: posición ${String((place?.index ?? index) + 1)} en ${groupName(groupKey)}`;
}
