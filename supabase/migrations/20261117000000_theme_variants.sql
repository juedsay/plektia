-- Estilos de la página pública (SPEC-styles): `pages.theme` pasa a guardar la
-- variante. La familia y lo que admite cada una (acentos, formas, tipografías)
-- se deducen en el dominio (src/domain/theme.ts); la base solo valida que el
-- valor exista. Una variante se habilita en el dominio cuando su PR la
-- construye: hasta entonces la app la rechaza.

alter type public.profile_theme add value if not exists 'punto';
alter type public.profile_theme add value if not exists 'cassette';
alter type public.profile_theme add value if not exists 'corcho';
alter type public.profile_theme add value if not exists 'subte';
alter type public.profile_theme add value if not exists 'pedalera';
alter type public.profile_theme add value if not exists 'bitmap';
alter type public.profile_theme add value if not exists 'lomo';
alter type public.profile_theme add value if not exists 'manual';
alter type public.profile_theme add value if not exists 'sumario';
