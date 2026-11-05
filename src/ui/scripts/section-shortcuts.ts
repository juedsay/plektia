// Atajos a las partes de la pantalla Página (Perfil, Estilo, Modo…). Sin
// JavaScript son links a cada sección. Con JavaScript:
// - el atajo de la parte que se está viendo queda marcado (`aria-current`) y,
//   si la fila de atajos no entra entera, se desliza para mostrarlo;
// - `--admin-bar-height` sigue la altura de la barra de arriba, para que los
//   atajos queden fijos justo debajo y las secciones no queden tapadas al saltar.

export function connectSectionShortcuts(nav: HTMLElement): void {
  const links = [...nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  const sections = links
    .map((link) => document.getElementById(link.hash.slice(1)))
    .filter((section): section is HTMLElement => section !== null);

  // En el celular la barra va arriba y fija; desde 60rem es la columna lateral
  // (coincide con admin.css) y los atajos quedan pegados al borde de arriba.
  const bar = document.querySelector<HTMLElement>(".admin-bar");
  const sideBar = window.matchMedia("(min-width: 60rem)");
  const measure = () => {
    const height = bar && !sideBar.matches ? bar.offsetHeight : 0;
    document.documentElement.style.setProperty("--admin-bar-height", `${String(height)}px`);
  };
  if (bar && "ResizeObserver" in window) new ResizeObserver(measure).observe(bar);
  sideBar.addEventListener("change", measure);
  measure();

  const mark = (id: string) => {
    for (const link of links) {
      const current = link.hash === `#${id}`;
      if (current) {
        link.setAttribute("aria-current", "true");
        nav.scrollLeft =
          link.offsetLeft - nav.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2;
      } else {
        link.removeAttribute("aria-current");
      }
    }
  };

  if (sections.length === 0) return;

  // La parte actual es la última cuyo título ya pasó por debajo de los atajos;
  // al final de la página, la última (puede no llegar a subir tanto).
  const current = () => {
    const line = nav.getBoundingClientRect().bottom + 24;
    const atBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (atBottom) return sections.at(-1);
    return sections.filter((section) => section.getBoundingClientRect().top <= line).at(-1);
  };

  // Al tocar un atajo, queda marcado ese mientras dura el salto.
  let jumpingUntil = 0;
  for (const link of links) {
    link.addEventListener("click", () => {
      jumpingUntil = Date.now() + 1000;
      mark(link.hash.slice(1));
    });
  }

  let scheduled = false;
  const update = () => {
    scheduled = false;
    if (Date.now() < jumpingUntil) return;
    const section = current();
    if (section) mark(section.id);
  };
  window.addEventListener(
    "scroll",
    () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(update);
    },
    { passive: true },
  );
  update();
}
