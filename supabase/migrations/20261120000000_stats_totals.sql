-- Totales del período en la base (revisión de la tarea 28). El panel sumaba en
-- el Worker las filas diarias de clics por link y de países y orígenes, pero
-- PostgREST devuelve como mucho `max_rows` (1000) filas: con 90 días y 20
-- links (1800 filas) los totales salían cortados, sin aviso. Estas funciones
-- devuelven una fila por link o por valor, ya sumada.
--
-- `security invoker`: corren con la RLS de quien llama, así que valen las
-- mismas políticas de lectura (solo el dueño, y solo una conexión activa).

create function public.page_link_clicks(p_page uuid, p_from date, p_to date)
returns table (link_id uuid, title text, clicks bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.id, l.title, sum(d.clicks)::bigint
  from public.link_stats_daily d
  join public.links l on l.id = d.link_id
  where l.page_id = p_page and d.day between p_from and p_to
  group by l.id, l.title;
$$;

create function public.page_stats_breakdown(p_page uuid, p_from date, p_to date)
returns table (dimension text, value text, views bigint, clicks bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select b.dimension, b.value, sum(b.views)::bigint, sum(b.clicks)::bigint
  from public.stats_breakdown_daily b
  where b.page_id = p_page and b.day between p_from and p_to
  group by b.dimension, b.value;
$$;

revoke all on function public.page_link_clicks(uuid, date, date),
  public.page_stats_breakdown(uuid, date, date) from public, anon;
grant execute on function public.page_link_clicks(uuid, date, date),
  public.page_stats_breakdown(uuid, date, date) to authenticated;
