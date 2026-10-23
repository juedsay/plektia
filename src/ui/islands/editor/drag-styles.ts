// Estilos que @dnd-kit/dom 0.5.0 inyecta al arrastrar (un <style> en <head>):
// el cursor, el posicionamiento de lo que se arrastra y "no seleccionar texto".
// La CSP no permite estilos en línea; estos tres textos fijos se habilitan por
// su hash, solo en /admin. Si cambia la versión de dnd-kit, el E2E de ordenar
// falla con una violación de CSP y hay que actualizar los hashes.
export const DRAG_STYLE_HASHES = [
  "sha256-P3zrZWkaCzrI/B9T0+WLFRTTY8rvTIfnbvP5TBI9Vgo=",
  "sha256-E7zJXfkufcgTIQG1Th6iYnoGis+rTfZd044bgiM1kr4=",
  "sha256-YYLJe/bgx7gKdFc8dp3EM3/S8hpKeZs7JyhfBoZYPuk=",
] as const;
