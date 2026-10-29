// Comandos del CLI (tarea 32c), sin efectos: de los argumentos a qué hacer.

export type Command =
  | { readonly kind: "help"; readonly error?: string }
  | { readonly kind: "login" }
  | { readonly kind: "logout" }
  | { readonly kind: "tools" }
  | { readonly kind: "show"; readonly page?: string }
  | { readonly kind: "stats"; readonly page?: string; readonly days: 7 | 30 | 90 }
  | {
      readonly kind: "add";
      readonly page?: string;
      readonly title: string;
      readonly url: string;
      readonly sectionId?: string;
      readonly description?: string;
    }
  | {
      readonly kind: "visibility";
      readonly page?: string;
      readonly id: string;
      readonly visible: boolean;
    }
  | {
      readonly kind: "delete";
      readonly page?: string;
      readonly id: string;
      readonly confirm?: string;
    };

export const HELP = `Plektia desde la terminal (usa el mismo acceso que Claude: OAuth y permisos).

  pnpm plektia login                       Conectar (abre el navegador)
  pnpm plektia logout                      Olvidar el acceso en esta compu
  pnpm plektia ver                         Tu página, con los ids de cada cosa
  pnpm plektia estadisticas [--dias 30]    Visitas y clics (7, 30 o 90 días)
  pnpm plektia agregar "<título>" <url> [--seccion <id>] [--descripcion "<texto>"]
  pnpm plektia ocultar <id>                Oculta un link o una sección
  pnpm plektia mostrar <id>                Lo vuelve a mostrar
  pnpm plektia borrar <id> [--confirmar "<título exacto>"]
  pnpm plektia herramientas                Lo que permite el servidor

  --pagina <handle>   Otra de tus páginas (si no, la última que usaste)
  PLEKTIA_URL=http://127.0.0.1:4321 para usar un servidor local.`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALUE_FLAGS = new Set(["--pagina", "--dias", "--seccion", "--descripcion", "--confirmar"]);

function split(
  argv: readonly string[],
): { positional: string[]; flags: Map<string, string> } | string {
  const positional: string[] = [];
  const flags = new Map<string, string>();
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index] ?? "";
    if (!argument.startsWith("--")) {
      positional.push(argument);
      continue;
    }
    if (!VALUE_FLAGS.has(argument)) return `Opción desconocida: ${argument}`;
    const value = argv[index + 1];
    if (value === undefined) return `Falta el valor de ${argument}`;
    flags.set(argument, value);
    index++;
  }
  return { positional, flags };
}

export function parseCommand(argv: readonly string[]): Command {
  const parsed = split(argv);
  if (typeof parsed === "string") return { kind: "help", error: parsed };
  const [name, ...rest] = parsed.positional;
  const page = parsed.flags.get("--pagina")?.replace(/^@/, "");
  const withPage = page === undefined ? {} : { page };

  switch (name) {
    case "login":
    case "logout":
      return { kind: name };
    case "herramientas":
      return { kind: "tools" };
    case "ver":
      return { kind: "show", ...withPage };
    case "estadisticas": {
      const days = Number(parsed.flags.get("--dias") ?? "7");
      if (days !== 7 && days !== 30 && days !== 90) {
        return { kind: "help", error: "--dias tiene que ser 7, 30 o 90." };
      }
      return { kind: "stats", ...withPage, days };
    }
    case "agregar": {
      const [title, url] = rest;
      if (!title || !url) return { kind: "help", error: 'Uso: agregar "<título>" <url>' };
      const sectionId = parsed.flags.get("--seccion");
      if (sectionId !== undefined && !UUID.test(sectionId)) {
        return { kind: "help", error: "--seccion es el id de la sección (lo muestra `ver`)." };
      }
      const description = parsed.flags.get("--descripcion");
      return {
        kind: "add",
        ...withPage,
        title,
        url,
        ...(sectionId === undefined ? {} : { sectionId }),
        ...(description === undefined ? {} : { description }),
      };
    }
    case "ocultar":
    case "mostrar":
    case "borrar": {
      const [id] = rest;
      if (!id || !UUID.test(id)) {
        return { kind: "help", error: `Uso: ${name} <id> (el id lo muestra \`ver\`).` };
      }
      if (name === "borrar") {
        const confirm = parsed.flags.get("--confirmar");
        return { kind: "delete", ...withPage, id, ...(confirm === undefined ? {} : { confirm }) };
      }
      return { kind: "visibility", ...withPage, id, visible: name === "mostrar" };
    }
    case undefined:
    case "ayuda":
    case "help":
      return { kind: "help" };
    default:
      return { kind: "help", error: `Comando desconocido: ${name}` };
  }
}

/** Lo que devuelven las herramientas de lectura: el aviso de datos y el JSON. */
export function payloadOf(text: string): unknown {
  const start = text.indexOf("\n");
  return JSON.parse(start === -1 ? text : text.slice(start + 1));
}

export interface PageItem {
  readonly kind: "link" | "section";
  readonly id: string;
  readonly version: number;
  readonly title: string;
}

interface ShownPage {
  sections: {
    id: string;
    version: number;
    title: string;
    links: { id: string; version: number; title: string }[];
  }[];
  unsectioned: { id: string; version: number; title: string }[];
}

/** Busca un link o una sección por id en lo que devolvió `get_page`. */
export function findItem(page: unknown, id: string): PageItem | null {
  const shown = page as ShownPage;
  for (const section of shown.sections) {
    if (section.id === id)
      return { kind: "section", id, version: section.version, title: section.title };
    const link = section.links.find((candidate) => candidate.id === id);
    if (link) return { kind: "link", id, version: link.version, title: link.title };
  }
  const link = shown.unsectioned.find((candidate) => candidate.id === id);
  return link ? { kind: "link", id, version: link.version, title: link.title } : null;
}
