// Hilo de la patchera: une todos los jacks con curvas distintas en cada visita.
// Dibuja encima del layout (SVG absoluto), así que nunca provoca saltos.
const SVG_NS = "http://www.w3.org/2000/svg";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// PRNG con semilla: una semilla nueva por carga cambia la forma del hilo.
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function el(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

export function mountThread(patchbay) {
  const svg = patchbay.querySelector(".thread");
  const jacks = [...patchbay.querySelectorAll(".jack")];
  const ports = jacks.map((jack) => jack.closest(".port"));
  if (jacks.length === 0) return;

  const random = mulberry32(crypto.getRandomValues(new Uint32Array(1))[0]);
  // Por tramo: dos desvíos que dan curvas en C o en S, hacia cualquier lado.
  // Nunca cerca de cero, para que ningún tramo quede recto.
  const bend = () => (random() < 0.5 ? -1 : 1) * (0.6 + random() * 0.4);
  const bends = jacks.map(() => [bend(), bend()]);
  const lead = [random() * 2 - 1, random()];
  const tail = [random() * 2 - 1, random() * 2 - 1];
  const tension = jacks.map(() => 1);
  const target = jacks.map(() => 1);

  const clipId = `thread-clip-${Math.floor(random() * 1e9)}`;
  const clipRect = el("rect", { x: "-100", y: "0", width: "100%", height: "0" });
  const clip = el("clipPath", { id: clipId });
  clip.append(clipRect);
  const defs = el("defs", {});
  defs.append(clip);
  const group = el("g", { "clip-path": `url(#${clipId})` });
  const width = parseFloat(getComputedStyle(patchbay).getPropertyValue("--thread-width")) || 3.2;
  const strand = (color) => el("path", { fill: "none", stroke: color, "stroke-width": String(width), "stroke-linecap": "round" });
  const twist = () => el("path", { fill: "none", stroke: "var(--color-thread-twist)", "stroke-width": "1", "stroke-linecap": "round" });
  const base = strand("var(--color-thread)");
  const baseTwist = twist();
  const live = strand("var(--color-live)");
  const liveTwist = twist();
  const knot = el("path", { fill: "none", stroke: "var(--color-thread)", "stroke-width": String(width - 0.6), "stroke-linecap": "round", "stroke-linejoin": "round" });
  group.append(base, baseTwist, live, liveTwist, knot);
  svg.replaceChildren(defs, group);

  // Trenzado: marcas diagonales que cruzan todo el ancho del trazo, cada
  // pocos píxeles, siguiendo la tangente. Así se lee como cordón torcido.
  function twistFor(path) {
    const total = path.getTotalLength();
    let d = "";
    for (let s = 2; s < total - 1; s += 4.2) {
      const p = path.getPointAtLength(s);
      const q = path.getPointAtLength(Math.min(total, s + 0.6));
      const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      const t = { x: (q.x - p.x) / len, y: (q.y - p.y) / len };
      const n = { x: -t.y, y: t.x };
      const h = width / 2;
      d += `M${p.x - n.x * h - t.x * 1.4} ${p.y - n.y * h - t.y * 1.4}L${p.x + n.x * h + t.x * 1.4} ${p.y + n.y * h + t.y * 1.4}`;
    }
    return d;
  }

  function geometry() {
    const box = patchbay.getBoundingClientRect();
    const points = jacks.map((jack) => {
      const r = jack.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
    });
    // Margen lateral disponible: hacia la izquierda hasta el borde, hacia la
    // derecha hasta donde empieza el texto (menos un respiro).
    const textLeft = patchbay.querySelector(".port-body").getBoundingClientRect().left - box.left;
    // Una curva Bézier se aleja ~3/4 de su punto de control, por eso los
    // controles pueden pasar un poco el margen sin que el trazo lo cruce.
    const clearance = 8 + width / 2;
    const right = Math.max(4, (textLeft - points[0].x - clearance) * 1.3);
    const room = { left: Math.min(right * 1.15, points[0].x + 16), right };
    return { box, points, room };
  }

  // Alto visible del hilo mientras se enhebra; null = completo.
  let revealHeight = reduceMotion ? null : 0;

  function draw() {
    const { box, points, room } = geometry();
    const sway = (v, size) => (v < 0 ? v * room.left : v * room.right) * size;

    const first = points[0];
    const start = { x: first.x + sway(lead[0], 0.8), y: first.y - 26 - lead[1] * 8 };
    let d = `M${start.x} ${start.y} C${start.x + sway(-lead[0], 0.6)} ${start.y + 10} ${first.x + sway(lead[0], 0.5)} ${first.y - 8} ${first.x} ${first.y}`;
    let liveD = ports[0].classList.contains("is-live") ? d : "";

    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const dy = b.y - a.y;
      const size = Math.min(1, 0.45 + dy / 220) * tension[i];
      const segment = ` C${a.x + sway(bends[i][0], size)} ${a.y + dy * 0.35} ${b.x + sway(bends[i][1], size)} ${b.y - dy * 0.35} ${b.x} ${b.y}`;
      d += segment;
      if (ports[i].classList.contains("is-live")) liveD += `M${a.x} ${a.y}${segment}`;
    }

    const last = points[points.length - 1];
    d += ` C${last.x + sway(tail[0], 0.6)} ${last.y + 12} ${last.x + sway(tail[1], 0.8)} ${last.y + 18} ${last.x + sway(tail[0], 0.4)} ${last.y + 30}`;

    base.setAttribute("d", d);
    baseTwist.setAttribute("d", twistFor(base));
    live.setAttribute("d", liveD);
    liveTwist.setAttribute("d", liveD ? twistFor(live) : "");
    // Nudo simple al inicio: un lazo cerrado sobre sí mismo y la punta deshilachada.
    const k = start;
    knot.setAttribute(
      "d",
      `M${k.x} ${k.y}c5 -7 11 -1 6 5c-4 5 -10 0 -6 -5M${k.x} ${k.y}l-4 -5M${k.x} ${k.y}l1 -6.5`,
    );
    clipRect.setAttribute("y", "-60");
    clipRect.setAttribute("height", String((revealHeight ?? box.height) + 120));
  }

  // Enhebrado inicial: una sola vez por carga, de arriba hacia abajo.
  function reveal() {
    // En una pestaña en segundo plano el navegador frena los frames: sin animación.
    if (reduceMotion || document.visibilityState !== "visible") {
      revealHeight = null;
      return draw();
    }
    const total = patchbay.getBoundingClientRect().height + 60;
    const duration = parseFloat(getComputedStyle(patchbay).getPropertyValue("--dur-thread")) || 1200;
    let startTime;
    const step = (now) => {
      startTime ??= now;
      const k = Math.min(1, (now - startTime) / duration);
      revealHeight = k < 1 ? total * (1 - Math.pow(2, -10 * k)) : null;
      draw();
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Tensado: el tramo que llega al link enfocado se estira.
  let animating = false;
  function animateTension() {
    if (animating) return;
    animating = true;
    const step = () => {
      let moving = false;
      tension.forEach((value, i) => {
        const next = value + (target[i] - value) * 0.18;
        tension[i] = Math.abs(next - target[i]) < 0.01 ? target[i] : next;
        if (tension[i] !== target[i]) moving = true;
      });
      draw();
      if (moving) requestAnimationFrame(step);
      else animating = false;
    };
    requestAnimationFrame(step);
  }

  ports.forEach((port, i) => {
    const tighten = () => {
      target.fill(1);
      target[i] = 0.2;
      if (reduceMotion) tension.splice(0, tension.length, ...target);
      animateTension();
    };
    const release = () => {
      target.fill(1);
      if (reduceMotion) tension.fill(1);
      animateTension();
    };
    port.addEventListener("pointerenter", tighten);
    port.addEventListener("pointerleave", release);
    port.addEventListener("focusin", tighten);
    port.addEventListener("focusout", release);
  });

  new ResizeObserver(() => draw()).observe(patchbay);
  reveal();
}
