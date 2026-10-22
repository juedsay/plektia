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
    // Mezcla de bits del algoritmo mulberry32 (no cambiar: define la secuencia).
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
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
    const fromJack = points[i - 1] ?? first;
    const toJack = points[i] ?? first;
    const verticalGap = toJack.y - fromJack.y;
    const [bendAtStart, bendAtEnd] = shape.bends[i] ?? [1, 1];
    const size = Math.min(1, 0.45 + verticalGap / 220) * (tension[i] ?? 1);
    segments.push({
      from: fromJack,
      c1: at(fromJack.x + sway(bendAtStart, size), fromJack.y + verticalGap * 0.35),
      c2: at(toJack.x + sway(bendAtEnd, size), toJack.y - verticalGap * 0.35),
      to: toJack,
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

/** Punto de la curva al avanzar `progress` (de 0, el inicio, a 1, el final). */
export function pointAt(curve: Cubic, progress: number): Point {
  // Fórmula de Bézier cúbica: cada punto de la curva "pesa" según el avance.
  const remaining = 1 - progress;
  const weightFrom = remaining * remaining * remaining;
  const weightControl1 = 3 * remaining * remaining * progress;
  const weightControl2 = 3 * remaining * progress * progress;
  const weightTo = progress * progress * progress;
  return {
    x:
      weightFrom * curve.from.x +
      weightControl1 * curve.c1.x +
      weightControl2 * curve.c2.x +
      weightTo * curve.to.x,
    y:
      weightFrom * curve.from.y +
      weightControl1 * curve.c1.y +
      weightControl2 * curve.c2.y +
      weightTo * curve.to.y,
  };
}

/** Coordenada con dos decimales: alcanza para el trazo y achica el SVG. */
const formatCoordinate = (value: number) => String(Math.round(value * 100) / 100);
const curveTo = (curve: Cubic) =>
  `C${formatCoordinate(curve.c1.x)} ${formatCoordinate(curve.c1.y)} ` +
  `${formatCoordinate(curve.c2.x)} ${formatCoordinate(curve.c2.y)} ` +
  `${formatCoordinate(curve.to.x)} ${formatCoordinate(curve.to.y)}`;
const moveTo = (point: Point) => `M${formatCoordinate(point.x)} ${formatCoordinate(point.y)}`;

/** Trazo continuo del hilo entero, para el atributo `d`. */
export function threadPath(thread: Thread): string {
  const curves = [thread.lead, ...thread.segments, thread.tail];
  return `${moveTo(thread.start)}${curves.map(curveTo).join("")}`;
}

/**
 * Tramos encendidos: los que llegan a un jack en vivo (`live[i]`). Cada uno es
 * un subtrazo propio, porque pueden no ser consecutivos.
 */
export function livePath(thread: Thread, live: readonly boolean[]): string {
  let pathData = live[0] ? `${moveTo(thread.start)}${curveTo(thread.lead)}` : "";
  thread.segments.forEach((segment, i) => {
    if (live[i + 1]) pathData += `${moveTo(segment.from)}${curveTo(segment)}`;
  });
  return pathData;
}

/** Curvas de los tramos encendidos (los que llegan a un jack en vivo). */
export function liveCurves(thread: Thread, live: readonly boolean[]): Cubic[] {
  const curves: Cubic[] = live[0] ? [thread.lead] : [];
  thread.segments.forEach((segment, i) => {
    if (live[i + 1]) curves.push(segment);
  });
  return curves;
}

/** Curvas del hilo entero, en orden. */
export function threadCurves(thread: Thread): Cubic[] {
  return [thread.lead, ...thread.segments, thread.tail];
}

// Muestras por curva para medir su largo: alcanza para que las marcas queden
// parejas a simple vista, y el costo crece en forma lineal con la cantidad de links.
const SAMPLES_PER_CURVE = 48;

/**
 * Trenzado: marcas diagonales que cruzan todo el ancho del trazo cada
 * `spacing` píxeles, siguiendo la tangente, para que se lea como cordón torcido.
 * Se calcula sobre las curvas (matemática pura): pedirle al navegador puntos con
 * `getPointAtLength` cuesta cuadrático y trababa la página con muchos links.
 */
export function twistPath(curves: readonly Cubic[], strokeWidth: number, spacing = 4.2): string {
  const halfStroke = strokeWidth / 2;
  let pathData = "";
  for (const curve of curves) {
    let previous = pointAt(curve, 0);
    let walked = 0;
    let nextMark = 2;
    for (let i = 1; i <= SAMPLES_PER_CURVE; i++) {
      const point = pointAt(curve, i / SAMPLES_PER_CURVE);
      const length = Math.hypot(point.x - previous.x, point.y - previous.y);
      if (length > 0) {
        // Dirección del trazo en este tramo (vector unitario).
        const tangentX = (point.x - previous.x) / length;
        const tangentY = (point.y - previous.y) / length;
        while (walked + length >= nextMark) {
          const fraction = (nextMark - walked) / length;
          const markX = previous.x + (point.x - previous.x) * fraction;
          const markY = previous.y + (point.y - previous.y) * fraction;
          // Normal = tangente girada 90°; la marca se inclina 1.4 px a cada lado.
          const startX = markX + tangentY * halfStroke - tangentX * 1.4;
          const startY = markY - tangentX * halfStroke - tangentY * 1.4;
          const endX = markX - tangentY * halfStroke + tangentX * 1.4;
          const endY = markY + tangentX * halfStroke + tangentY * 1.4;
          pathData += `${moveTo({ x: startX, y: startY })}L${formatCoordinate(endX)} ${formatCoordinate(endY)}`;
          nextMark += spacing;
        }
      }
      walked += length;
      previous = point;
    }
  }
  return pathData;
}

/** Nudo simple al inicio: un lazo cerrado sobre sí mismo y la punta deshilachada. */
export function knotPath(start: Point): string {
  const knotStart = moveTo(start);
  return `${knotStart}c5 -7 11 -1 6 5c-4 5 -10 0 -6 -5${knotStart}l-4 -5${knotStart}l1 -6.5`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
