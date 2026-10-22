// Hilo de la patchera en el DOM: mide el layout, pide las curvas a
// `thread-geometry` y las pinta en un SVG absoluto (nunca provoca saltos).
// Lo cubren los E2E; la geometría, los tests unitarios.
import {
  boundsFor,
  buildThread,
  knotPath,
  liveCurves,
  livePath,
  mulberry32,
  type Point,
  randomShape,
  threadCurves,
  threadPath,
  twistPath,
} from "@/ui/scripts/thread-geometry";

declare global {
  interface Window {
    /** Solo para tests: fija la forma del hilo (capturas comparables). */
    __plektiaThreadSeed?: number;
  }
}

const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(name: string, attributes: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function cssNumber(element: Element, property: string, fallback: number): number {
  const value = Number.parseFloat(getComputedStyle(element).getPropertyValue(property));
  return Number.isFinite(value) ? value : fallback;
}

export function mountThread(patchbay: HTMLElement): void {
  const svg = patchbay.querySelector<SVGSVGElement>(".thread");
  const jacks = [...patchbay.querySelectorAll<HTMLElement>(".jack")];
  const firstBody = patchbay.querySelector(".port-body");
  if (!svg || !firstBody || jacks.length === 0) return;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const live = jacks.map((jack) => jack.closest(".port")?.classList.contains("is-live") ?? false);
  const seed = window.__plektiaThreadSeed ?? crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
  const shape = randomShape(mulberry32(seed), jacks.length);
  const tension = jacks.map(() => 1);
  const target = jacks.map(() => 1);
  const width = cssNumber(patchbay, "--thread-width", 3.2);

  const clipId = `thread-clip-${String(seed)}`;
  const clipRect = svgElement("rect", { x: "-100", y: "0", width: "100%", height: "0" });
  const clip = svgElement("clipPath", { id: clipId });
  clip.appendChild(clipRect);
  const defs = svgElement("defs", {});
  defs.appendChild(clip);
  const group = svgElement("g", { "clip-path": `url(#${clipId})` });
  const strand = (color: string, strokeWidth: number) =>
    svgElement("path", {
      fill: "none",
      stroke: color,
      "stroke-width": String(strokeWidth),
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }) as SVGPathElement;
  const base = strand("var(--color-thread)", width);
  const baseTwist = strand("var(--color-thread-twist)", 1);
  const liveStrand = strand("var(--color-live)", width);
  const liveTwist = strand("var(--color-thread-twist)", 1);
  const knot = strand("var(--color-thread)", width - 0.6);
  base.dataset["thread"] = "base";
  // appendChild y no append: los tipos del runtime de Workers redefinen `Element.append`.
  for (const path of [base, baseTwist, liveStrand, liveTwist, knot]) group.appendChild(path);
  svg.textContent = "";
  svg.appendChild(defs);
  svg.appendChild(group);

  // Alto visible del hilo mientras se enhebra; null = completo.
  let revealHeight: number | null = reduceMotion ? null : 0;

  function draw(): void {
    const box = patchbay.getBoundingClientRect();
    const points: Point[] = jacks.map((jack) => {
      const jackBox = jack.getBoundingClientRect();
      return {
        x: jackBox.left + jackBox.width / 2 - box.left,
        y: jackBox.top + jackBox.height / 2 - box.top,
      };
    });
    const textLeft = (firstBody?.getBoundingClientRect().left ?? box.left) - box.left;
    const thread = buildThread(
      points,
      boundsFor(points[0]?.x ?? 0, textLeft, width),
      shape,
      tension,
    );
    if (!thread) return;

    base.setAttribute("d", threadPath(thread));
    baseTwist.setAttribute("d", twistPath(threadCurves(thread), width));
    const liveD = livePath(thread, live);
    liveStrand.setAttribute("d", liveD);
    liveTwist.setAttribute("d", twistPath(liveCurves(thread, live), width));
    knot.setAttribute("d", knotPath(thread.start));
    applyClip();
  }

  // Recorte del enhebrado: lo único que cambia en cada cuadro de la animación.
  // La forma (y su trenzado, que es lo caro) se calcula una vez en draw().
  function applyClip(): void {
    const height = revealHeight ?? patchbay.getBoundingClientRect().height;
    clipRect.setAttribute("y", "-60");
    clipRect.setAttribute("height", String(height + 120));
  }

  // Enhebrado inicial: una sola vez por carga, de arriba hacia abajo.
  function reveal(): void {
    // En una pestaña en segundo plano el navegador frena los frames: sin animación.
    if (reduceMotion || document.visibilityState !== "visible") {
      revealHeight = null;
      draw();
      return;
    }
    const total = patchbay.getBoundingClientRect().height + 60;
    const duration = cssNumber(patchbay, "--dur-thread", 1200);
    draw();
    let startTime: number | undefined;
    const step = (now: number) => {
      startTime ??= now;
      const progress = Math.min(1, (now - startTime) / duration);
      revealHeight = progress < 1 ? total * (1 - Math.pow(2, -10 * progress)) : null;
      applyClip();
      if (progress < 1) requestAnimationFrame(step);
      else patchbay.dataset["threadReady"] = "";
    };
    requestAnimationFrame(step);
  }

  // Tensado: el tramo que llega al link enfocado se estira.
  let animating = false;
  function animateTension(): void {
    if (reduceMotion) {
      tension.splice(0, tension.length, ...target);
      draw();
      return;
    }
    if (animating) return;
    animating = true;
    const step = () => {
      let moving = false;
      for (let i = 0; i < tension.length; i++) {
        const value = tension[i] ?? 1;
        const goal = target[i] ?? 1;
        const next = value + (goal - value) * 0.18;
        tension[i] = Math.abs(next - goal) < 0.01 ? goal : next;
        if (tension[i] !== goal) moving = true;
      }
      draw();
      if (moving) requestAnimationFrame(step);
      else animating = false;
    };
    requestAnimationFrame(step);
  }

  jacks.forEach((jack, i) => {
    const port = jack.closest(".port");
    if (!port) return;
    const tighten = () => {
      target.fill(1);
      target[i] = 0.2;
      animateTension();
    };
    const release = () => {
      target.fill(1);
      animateTension();
    };
    port.addEventListener("pointerenter", tighten);
    port.addEventListener("pointerleave", release);
    port.addEventListener("focusin", tighten);
    port.addEventListener("focusout", release);
  });

  new ResizeObserver(() => {
    draw();
  }).observe(patchbay);
  if (reduceMotion || document.visibilityState !== "visible") patchbay.dataset["threadReady"] = "";
  reveal();
}
