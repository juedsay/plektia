import type { FormResult } from "@/actions/form-result";
import type { Link, OwnLinks, Section } from "@/application/ports/link-repository";
import { errorMessage } from "@/domain/errors";

// Lo que el editor le pide al servidor. En el navegador son las Actions de
// links (Editor.tsx); en los tests de componentes, un servidor falso.

export interface NewLink {
  readonly title: string;
  readonly url: string;
  readonly sectionId: string | null;
}

export interface LinkChanges {
  readonly title?: string;
  readonly url?: string;
  readonly description?: string | null;
  /** Solo para "Deshacer" un mostrar u ocultar. */
  readonly visible?: boolean;
}

export interface EditorApi {
  list(): Promise<OwnLinks | null>;
  create(link: NewLink): Promise<FormResult<Link>>;
  update(target: { id: string; version: number }, changes: LinkChanges): Promise<FormResult<Link>>;
  setVisibility(
    target: { id: string; version: number },
    visible: boolean,
  ): Promise<FormResult<Link>>;
  delete(target: { id: string; version: number }): Promise<FormResult<void>>;
  /** Borra al cerrar la pestaña: el pedido sigue aunque la página se descargue. */
  deleteOnExit(target: { id: string; version: number }): void;
  /** Deja un grupo en ese orden (trayendo links de otros); devuelve el contenido nuevo. */
  move(
    sectionId: string | null,
    order: readonly { id: string; version: number }[],
  ): Promise<FormResult<OwnLinks>>;
  reorderSections(order: readonly { id: string; version: number }[]): Promise<FormResult<OwnLinks>>;
  createSection(title: string): Promise<FormResult<Section>>;
  updateSection(
    target: { id: string; version: number },
    changes: SectionChanges,
  ): Promise<FormResult<Section>>;
  /** Borra la sección (sus links pasan a "Sin sección"); devuelve el contenido nuevo. */
  deleteSection(target: { id: string; version: number }): Promise<FormResult<OwnLinks>>;
}

export interface SectionChanges {
  readonly title?: string;
  readonly showTitle?: boolean;
  readonly visible?: boolean;
}

/** Un resultado que salió mal: el mensaje general y el de cada campo. */
export type Failure = Extract<FormResult<never>, { ok: false }>;

/** Un fallo de red o del servidor, con el mismo formato que un error esperable. */
export const UNREACHABLE: FormResult<never> = {
  ok: false,
  message: "No pudimos guardar: revisá tu conexión y probá de nuevo.",
  fields: {},
  values: {},
};

/** Si el error es de versión ("otro lo cambió"): se ofrece recargar ese link. */
export const CONFLICT_MESSAGE = errorMessage("conflict");
