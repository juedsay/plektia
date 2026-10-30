-- "Editado desde Claude" (SPEC-mcp-server, historia 5): cuando el editor del
-- panel choca con una versión nueva de un link, pregunta si la cambió una app
-- conectada por MCP. Solo el dueño, desde el panel (`panel_caller` rechaza a
-- un cliente MCP), y solo lo de la última hora: es para explicar el conflicto,
-- no para leer la auditoría entera.

create function public.mcp_last_edit(p_target uuid)
returns table (client_name text, edited_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select g.client_name, a.created_at
  from private.mcp_audit_log a
  join public.mcp_grants g on g.client_id = a.client_id and g.user_id = a.user_id
  where a.user_id = private.panel_caller()
    and a.target_id = p_target
    and a.created_at > now() - interval '1 hour'
  order by a.created_at desc
  limit 1;
$$;

revoke all on function public.mcp_last_edit(uuid) from public, anon;
grant execute on function public.mcp_last_edit(uuid) to authenticated;
