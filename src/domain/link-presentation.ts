// Presentación de un link en la página pública (SPEC-appearance, 36d y 36e). Va
// aparte de link.ts (y sin zod) porque la usa la isla del editor, que tiene
// presupuesto de peso.

/** En la lista, solo como ícono en la fila bajo la bio, o en los dos lugares. */
export const LINK_PLACEMENTS = ["list", "icon", "both"] as const;
export type LinkPlacement = (typeof LINK_PLACEMENTS)[number];

/** Sin destacar, con el acento en su lugar, o arriba de todo (hasta `TOP_LINKS_LIMIT`). */
export const LINK_HIGHLIGHTS = ["none", "accent", "top"] as const;
export type LinkHighlight = (typeof LINK_HIGHLIGHTS)[number];

export const TOP_LINKS_LIMIT = 3;

/**
 * Qué es el link (SPEC-link-form, 7b). `null` en un link es "automático": se
 * deduce de la URL al mostrarlo.
 */
export const LINK_KINDS = ["social", "article", "video", "site"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];
