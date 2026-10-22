import { describe, expect, it } from "vitest";

import {
  boundsFor,
  buildThread,
  type Cubic,
  knotPath,
  liveCurves,
  livePath,
  mulberry32,
  type Point,
  pointAt,
  randomShape,
  TEXT_GAP,
  threadCurves,
  threadPath,
  twistPath,
} from "@/ui/scripts/thread-geometry";

const STROKE = 3.2;

/** Layout plausible: jacks en una columna, separados como filas y bancos reales. */
function layout(random: () => number, jackCol: number) {
  const x = jackCol / 2;
  const points: Point[] = [];
  let y = 40 + random() * 40;
  const count = 1 + Math.floor(random() * 14);
  for (let i = 0; i < count; i++) {
    points.push({ x, y });
    // Fila común (~52 px), fila con descripción larga o salto de banco con título.
    y += 52 + random() * (random() < 0.2 ? 160 : 40);
  }
  return { points, textLeft: jackCol };
}

function samples(curve: Cubic): Point[] {
  return Array.from({ length: 101 }, (_, i) => pointAt(curve, i / 100));
}

describe("hilo de la patchera", () => {
  it("con 1.000 semillas nunca entra en la columna del texto ni se sale de la página", () => {
    const violations: string[] = [];
    for (let seed = 1; seed <= 1000; seed++) {
      const random = mulberry32(seed);
      for (const jackCol of [72, 88]) {
        const { points, textLeft } = layout(random, jackCol);
        const shape = randomShape(random, points.length);
        // Con tensión al azar: el tramo enfocado se estira y no debe salirse tampoco.
        const tension = points.map(() => (random() < 0.2 ? 0.2 : 1));
        const bounds = boundsFor(points[0]?.x ?? 0, textLeft, STROKE);
        const thread = buildThread(points, bounds, shape, tension);
        if (!thread) {
          violations.push(`semilla ${String(seed)}: sin hilo`);
          continue;
        }
        const xs = [thread.lead, ...thread.segments, thread.tail].flatMap(samples).map((p) => p.x);
        // El nudo asoma hasta 11 px a la derecha del inicio y 4 a la izquierda.
        const right = Math.max(...xs, thread.start.x + 11) + STROKE / 2;
        const left = Math.min(...xs, thread.start.x - 4) - STROKE / 2;
        if (right > textLeft - TEXT_GAP || left < -16) {
          violations.push(
            `semilla ${String(seed)}, columna ${String(jackCol)}: ${left.toFixed(1)}..${right.toFixed(1)}`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("la misma semilla da siempre el mismo hilo; otra semilla, otro", () => {
    const points = [
      { x: 36, y: 60 },
      { x: 36, y: 112 },
      { x: 36, y: 220 },
    ];
    const draw = (seed: number) =>
      threadPath(
        buildThread(
          points,
          boundsFor(36, 72, STROKE),
          randomShape(mulberry32(seed), 3),
          [1, 1, 1],
        ) ??
          (() => {
            throw new Error("sin hilo");
          })(),
      );
    expect(draw(42)).toBe(draw(42));
    expect(draw(42)).not.toBe(draw(43));
  });

  it("pasa por todos los jacks, en orden", () => {
    const points = [
      { x: 36, y: 60 },
      { x: 36, y: 112 },
      { x: 36, y: 164 },
    ];
    const thread = buildThread(
      points,
      boundsFor(36, 72, STROKE),
      randomShape(mulberry32(7), 3),
      [1, 1, 1],
    );
    expect(thread?.lead.to).toEqual(points[0]);
    expect(thread?.segments.map((s) => [s.from, s.to])).toEqual([
      [points[0], points[1]],
      [points[1], points[2]],
    ]);
    expect(thread?.tail.from).toEqual(points[2]);
  });

  it("sin jacks no hay hilo", () => {
    expect(
      buildThread([], boundsFor(36, 72, STROKE), randomShape(mulberry32(1), 0), []),
    ).toBeNull();
  });

  it("solo se encienden los tramos que llegan a un jack en vivo", () => {
    const points = [
      { x: 36, y: 60 },
      { x: 36, y: 112 },
      { x: 36, y: 164 },
    ];
    const thread = buildThread(
      points,
      boundsFor(36, 72, STROKE),
      randomShape(mulberry32(3), 3),
      [1, 1, 1],
    );
    if (!thread) throw new Error("sin hilo");
    expect(livePath(thread, [false, false, false])).toBe("");
    // Primer jack: el tramo de entrada. Tercero: el que viene del segundo.
    expect(livePath(thread, [true, false, false]).match(/M/g)).toHaveLength(1);
    expect(livePath(thread, [false, false, true])).toMatch(/^M36 112C/);
    expect(livePath(thread, [true, false, true]).match(/M/g)).toHaveLength(2);
  });

  it("el nudo nace en el inicio del hilo", () => {
    expect(knotPath({ x: 30, y: 20 })).toMatch(/^M30 20c/);
  });
});

describe("trenzado", () => {
  const straight: Cubic = {
    from: { x: 0, y: 0 },
    c1: { x: 0, y: 33 },
    c2: { x: 0, y: 67 },
    to: { x: 0, y: 100 },
  };
  const marks = (d: string) =>
    [...d.matchAll(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/g)].map((m) =>
      m.slice(1).map(Number),
    );

  it("pone una marca cada 4.2 px a lo largo del trazo", () => {
    // 100 px desde la primera marca en 2 px: (100 - 2) / 4.2 + 1 ≈ 24.
    expect(marks(twistPath([straight], STROKE))).toHaveLength(24);
  });

  it("cada marca cruza el trazo de lado a lado, inclinada", () => {
    for (const [x1 = 0, , x2 = 0] of marks(twistPath([straight], STROKE))) {
      // En un trazo vertical, la marca va de un borde (x = ±1.6) al otro.
      expect(Math.abs(x1 - x2)).toBeCloseTo(STROKE, 1);
    }
  });

  it("con 200 links se calcula rápido (costo lineal)", () => {
    const points = Array.from({ length: 200 }, (_, i) => ({ x: 36, y: 60 + i * 52 }));
    const thread = buildThread(
      points,
      boundsFor(36, 72, STROKE),
      randomShape(mulberry32(9), 200),
      points.map(() => 1),
    );
    if (!thread) throw new Error("sin hilo");
    const start = performance.now();
    const d = twistPath(threadCurves(thread), STROKE);
    expect(performance.now() - start).toBeLessThan(200);
    expect(marks(d).length).toBeGreaterThan(2000);
  });

  it("los tramos encendidos son los que llegan a un jack en vivo", () => {
    const points = [
      { x: 36, y: 60 },
      { x: 36, y: 112 },
      { x: 36, y: 164 },
    ];
    const thread = buildThread(
      points,
      boundsFor(36, 72, STROKE),
      randomShape(mulberry32(3), 3),
      [1, 1, 1],
    );
    if (!thread) throw new Error("sin hilo");
    expect(liveCurves(thread, [false, false, false])).toEqual([]);
    expect(liveCurves(thread, [true, false, true])).toEqual([thread.lead, thread.segments[1]]);
    expect(twistPath([], STROKE)).toBe("");
  });
});
