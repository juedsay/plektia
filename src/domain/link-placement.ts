// Dónde se muestra un link en la página pública (SPEC-appearance, 36d): en la
// lista, solo como ícono en la fila bajo la bio, o en los dos lugares. Va aparte
// de link.ts (y sin zod) porque lo usa la isla del editor, que tiene presupuesto.

export const LINK_PLACEMENTS = ["list", "icon", "both"] as const;
export type LinkPlacement = (typeof LINK_PLACEMENTS)[number];
