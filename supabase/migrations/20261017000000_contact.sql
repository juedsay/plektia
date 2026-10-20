-- Formulario de contacto (SPEC-public-page, "Contacto"; tarea 16, parte 3).
--
-- Los mensajes viven en `private`, que la API pública no expone: nadie puede
-- insertarlos con la clave publishable salteándose Turnstile y el límite por IP
-- del Worker. La única entrada es `ingest_contact_message`, que solo ejecuta
-- `service_role` desde `ingest-client.ts` (SPEC-platform, "Secretos").
-- No se guarda la IP de quien escribe.

create table private.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  email text not null check (
    char_length(email) between 3 and 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now(),
  -- Para el panel (F5): marcar como leído.
  read_at timestamptz
);

create index contact_messages_created_at_idx on private.contact_messages (created_at desc);

alter table private.contact_messages enable row level security;
revoke all on private.contact_messages from public, anon, authenticated;

-- Segunda barrera contra una inundación (la primera es el límite por IP del
-- Worker): como mucho 100 mensajes por hora en total.
create function public.ingest_contact_message(p_name text, p_email text, p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from private.contact_messages
    where created_at > now() - interval '1 hour'
  ) >= 100 then
    raise exception 'contacto: demasiados mensajes en la última hora' using errcode = 'PL429';
  end if;
  insert into private.contact_messages (name, email, message)
  values (p_name, p_email, p_message);
end;
$$;

revoke all on function public.ingest_contact_message(text, text, text) from public, anon, authenticated;
grant execute on function public.ingest_contact_message(text, text, text) to service_role;
