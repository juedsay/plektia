import { z } from "zod";

import type { InvalidInput } from "@/domain/errors";
import {
  LINK_HIGHLIGHTS,
  LINK_KINDS,
  LINK_PLACEMENTS,
  type LinkHighlight,
  type LinkKind,
  type LinkPlacement,
} from "@/domain/link-presentation";
import { detectProvider, type Provider } from "@/domain/provider";
import { map, type Result } from "@/domain/result";
import { parseSafeUrl } from "@/domain/safe-url";
import { safeLine, validate } from "@/domain/text";

// Link de la página pública (SPEC-links, "Reglas de validación"). La base
// repite las reglas críticas con `check`, por si alguien escribe sin la app.

export const LIMITS = { sections: 30, links: 200, tags: 5 } as const;

export {
  LINK_HIGHLIGHTS,
  LINK_KINDS,
  LINK_PLACEMENTS,
  type LinkHighlight,
  type LinkKind,
  type LinkPlacement,
} from "@/domain/link-presentation";

const Url = z
  .string({ error: "La URL tiene que ser un texto." })
  .refine((value) => parseSafeUrl(value).ok, {
    error:
      "La URL tiene que empezar con https:// o mailto: y no puede incluir usuario ni contraseña.",
  })
  .transform((value) => {
    const parsed = parseSafeUrl(value);
    return parsed.ok ? parsed.value : value;
  });

const Description = z
  .string({ error: "La descripción tiene que ser un texto." })
  .trim()
  .transform((value) => (value === "" ? null : value))
  .pipe(safeLine("La descripción", 120).nullable());

const Tag = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{1,24}$/, {
    error: "Cada etiqueta tiene hasta 24 caracteres: letras sin tilde, números y guiones.",
  });

// El límite va con `.max()` nativo y antes de todo: así zod rechaza una lista
// enorme sin recorrer sus elementos (GHSA-mrhx-c7xc-m3w5; con solo un `refine`
// posterior, cada elemento inválido sumaba un error y agotaba la memoria).
const Tags = z
  .array(Tag, { error: "Las etiquetas tienen que ser una lista." })
  .max(LIMITS.tags, { error: `Un link puede tener hasta ${String(LIMITS.tags)} etiquetas.` })
  .transform((tags) => [...new Set(tags)]);

const SectionId = z.uuid({ error: "La sección no es válida." }).nullable();
const Visible = z.boolean({ error: "La visibilidad tiene que ser sí o no." });
/** `null` es "automático" (se deduce de la URL). */
const Kind = z.enum(LINK_KINDS, { error: "Elegí red social, artículo, video o sitio." }).nullable();

const fields = {
  title: safeLine("El título", 80),
  url: Url,
  description: Description.nullish().transform((value) => value ?? null),
  tags: Tags.default([]),
  sectionId: SectionId.default(null),
  visible: Visible.default(true),
  kind: Kind.default(null),
};

const LinkInputSchema = z.object(fields, { error: "Los datos del link no son válidos." });

const LinkPatchSchema = z
  .object(
    {
      title: fields.title.optional(),
      url: Url.optional(),
      description: Description.nullable().optional(),
      tags: Tags.optional(),
      visible: Visible.optional(),
      kind: Kind.optional(),
      placement: z
        .enum(LINK_PLACEMENTS, { error: "Elegí en la lista, como ícono o en los dos lugares." })
        .optional(),
      highlight: z
        .enum(LINK_HIGHLIGHTS, { error: "Elegí sin destacar, con el acento o arriba de todo." })
        .optional(),
    },
    { error: "Los datos del link no son válidos." },
  )
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), {
    error: "No hay ningún cambio para guardar.",
  });

export interface LinkDraft {
  readonly title: string;
  readonly url: string;
  readonly description: string | null;
  readonly tags: readonly string[];
  readonly sectionId: string | null;
  readonly visible: boolean;
  readonly provider: Provider;
  readonly providerHandle: string | null;
  /** `null`: automático, se deduce de la URL. */
  readonly kind: LinkKind | null;
}

/** Un link nace en la lista y sin destacar; eso se cambia después (36d y 36e). */
export type LinkPatch = Partial<Omit<LinkDraft, "sectionId">> & {
  readonly placement?: LinkPlacement;
  readonly highlight?: LinkHighlight;
};

export function parseLinkInput(raw: unknown): Result<LinkDraft, InvalidInput> {
  return map(validate(LinkInputSchema, raw), (link) => {
    const { provider, handle } = detectProvider(link.url);
    return { ...link, provider, providerHandle: handle };
  });
}

/** Cambio parcial de un link. Si cambia la URL, se vuelve a detectar el proveedor. */
export function parseLinkPatch(raw: unknown): Result<LinkPatch, InvalidInput> {
  return map(validate(LinkPatchSchema, raw), (patch) => {
    const defined = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as LinkPatch;
    if (defined.url === undefined) return defined;
    const { provider, handle } = detectProvider(defined.url);
    return { ...defined, provider, providerHandle: handle };
  });
}
