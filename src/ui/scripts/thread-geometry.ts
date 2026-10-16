// Geometría del hilo de la patchera (DESIGN.md): funciones puras, sin DOM, para
// poder probar con miles de semillas que el hilo nunca entra en la columna del
// texto. `thread.ts` mide el layout, llama acá y pinta el resultado.

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Curva Bézier cúbica: desde, dos controles y hasta. */
export interface Cubic {
  readonly from: Point;
  readonly c1: Point;
  readonly c2: Point;
  readonly to: Point;
}

export type Random = () => number;

/** PRNG con semilla (mulberry32): una semilla nueva por carga cambia la forma. */
export function mulberry32(seed: number): Random {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Desvíos aleatorios de una visita: no cambian al redibujar (resize, tensado). */
export interface ThreadShape {
  /** Por tramo: dos desvíos que dan curvas en C o en S, hacia cualquier lado. */
  readonly bends: readonly (readonly [number, number])[];
  readonly lead: readonly [number, number];
  readonly tail: readonly [number, number];
}

export function randomShape(random: Random, jacks: number): ThreadShape {
  // Nunca cerca de cero, para que ningún tramo quede recto.
  const bend = () => (random() < 0.5 ? -1 : 1) * (0.6 + random() * 0.4);
  return {
    bends: Array.from({ length: jacks }, () => [bend(), bend()] as const),
    lead: [random() * 2 - 1, random()],
    tail: [random() * 2 - 1, random() * 2 - 1],
  };
}

/** Hasta dónde puede ir el centro del trazo: a la izquierda el borde, a la derecha el texto. */
export interface Bounds {
  readonly minX: number;
  readonly maxX: number;
}

/** Respiro entre el hilo y la columna del texto, además del medio ancho del trazo. */
export const TEXT_GAP = 8;

/**
 * Límites para el centro del trazo, a partir de dónde empieza el texto. A la
 * izquierda puede asomar hasta 16 px sobre el margen de la página.
 */
export function boundsFor(jackX: number, textLeft: number, strokeWidth: number): Bounds {
  return {
    minX: -16 + strokeWidth / 2,
    maxX: Math.max(jackX, textLeft - TEXT_GAP - strokeWidth / 2),
  };
}

// Alcance del nudo del inicio hacia cada lado (ver `knotPath`).
const KNOT_RIGHT = 11;
const KNOT_LEFT = 4;

export interface Thread {
  /** Punto donde nace el hilo, con el nudo. */
  readonly start: Point;
  readonly lead: Cubic;
  /** `segments[i]` une el jack `i` con el `i + 1`. */
  readonly segments: readonly Cubic[];
  readonly tail: Cubic;
}

/**
 * Curvas del hilo. Una Bézier se aleja a lo sumo 3/4 de sus puntos de control,
 * por eso los controles pueden pasar un poco el margen (×1.3) sin que el trazo
 * lo cruce. `tension[i]` (0 a 1) estira el tramo que llega al jack `i`.
 */
export function buildThread(
  points: readonly Point[],
  bounds: Bounds,
  shape: ThreadShape,
  tension: readonly number[],
): Thread | null {
  const [first] = points;
  if (!first) return null;
  const last = points[points.length - 1] ?? first;

  const right = Math.max(4, (bounds.maxX - first.x) * 1.3);
  const left = Math.min(right * 1.15, first.x - bounds.minX);
  const sway = (v: number, size: number) => (v < 0 ? v * left : v * right) * size;
  const at = (x: number, y: number): Point => ({ x, y });

  // El nudo asoma a los costados del inicio: el inicio se corre para que entre.
  const startX = clamp(
    first.x + sway(shape.lead[0], 0.8),
    bounds.minX + KNOT_LEFT,
    bounds.maxX - KNOT_RIGHT,
  );
  const start = at(startX, first.y - 26 - shape.lead[1] * 8);
  const lead: Cubic = {
    from: start,
    c1: at(start.x + sway(-shape.lead[0], 0.6), start.y + 10),
    c2: at(first.x + sway(shape.lead[0], 0.5), first.y - 8),
    to: first,
  };

  const segments: Cubic[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] ?? first;
    const b = points[i] ?? first;
    const dy = b.y - a.y;
    const [bendA, bendB] = shape.bends[i] ?? [1, 1];
    const size = Math.min(1, 0.45 + dy / 220) * (tension[i] ?? 1);
    segments.push({
      from: a,
      c1: at(a.x + sway(bendA, size), a.y + dy * 0.35),
      c2: at(b.x + sway(bendB, size), b.y - dy * 0.35),
      to: b,
    });
  }

  const tail: Cubic = {
    from: last,
    c1: at(last.x + sway(shape.tail[0], 0.6), last.y + 12),
    c2: at(last.x + sway(shape.tail[1], 0.8), last.y + 18),
    to: at(last.x + sway(shape.tail[0], 0.4), last.y + 30),
  };

  return { start, lead, segments, tail };
}

/** Punto de la curva en `t` (0 a 1). */
export function pointAt(curve: Cubic, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * curve.from.x + b * curve.c1.x + c * curve.c2.x + d * curve.to.x,
    y: a * curve.from.y + b * curve.c1.y + c * curve.c2.y + d * curve.to.y,
  };
}

const n = (value: number) => String(Math.round(value * 100) / 100);
const curveTo = (c: Cubic) =>
  `C${n(c.c1.x)} ${n(c.c1.y)} ${n(c.c2.x)} ${n(c.c2.y)} ${n(c.to.x)} ${n(c.to.y)}`;

/** Trazo continuo del hilo entero, para el atributo `d`. */
export function threadPath(thread: Thread): string {
  const curves = [thread.lead, ...thread.segments, thread.tail];
  return `M${n(thread.start.x)} ${n(thread.start.y)}${curves.map(curveTo).join("")}`;
}

/**
 * Tramos encendidos: los que llegan a un jack en vivo (`live[i]`). Cada uno es
 * un subtrazo propio, porque pueden no ser consecutivos.
 */
export function livePath(thread: Thread, live: readonly boolean[]): string {
  let d = live[0] ? `M${n(thread.start.x)} ${n(thread.start.y)}${curveTo(thread.lead)}` : "";
  thread.segments.forEach((segment, i) => {
    if (live[i + 1]) d += `M${n(segment.from.x)} ${n(segment.from.y)}${curveTo(segment)}`;
  });
  return d;
}

/** Nudo simple al inicio: un lazo cerrado sobre sí mismo y la punta deshilachada. */
export function knotPath(start: Point): string {
  const { x, y } = start;
  return `M${n(x)} ${n(y)}c5 -7 11 -1 6 5c-4 5 -10 0 -6 -5M${n(x)} ${n(y)}l-4 -5M${n(x)} ${n(y)}l1 -6.5`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
