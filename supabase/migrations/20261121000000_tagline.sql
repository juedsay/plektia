-- Lema nuevo: "Todos tus links, unidos a tu estilo." (antes "…unidos por un
-- hilo", que describía solo a Patchera: la mayoría de los estilos no tiene hilo).
-- La página oficial (/plektia) vive en la base: se actualiza solo si todavía
-- tiene el texto viejo, así no se pisa lo que se haya editado desde el panel.
-- Repetirla no cambia nada.

update public.pages
set bio = 'Todos tus links, unidos a tu estilo.'
where handle = 'plektia' and bio = 'Todos tus links, unidos por un hilo.';

update public.links l
set description = 'Todos tus links, unidos a tu estilo'
from public.pages p
where p.handle = 'plektia'
  and l.page_id = p.id
  and l.description = 'Todos tus links, unidos por un hilo';
