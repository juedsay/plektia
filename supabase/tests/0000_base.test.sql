-- Base: el esquema `private` existe y no es alcanzable desde la API pública.
begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

select has_schema('private', 'existe el esquema private');

select ok(
  not has_schema_privilege('anon', 'private', 'usage'),
  'anon no puede usar el esquema private'
);

select ok(
  not has_schema_privilege('authenticated', 'private', 'usage'),
  'authenticated no puede usar el esquema private'
);

select ok(
  not has_schema_privilege('anon', 'private', 'create'),
  'anon no puede crear objetos en private'
);

select * from finish();
rollback;
