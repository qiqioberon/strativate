-- Keep public poster reads independent from the authenticated-only is_admin helper.
-- The original combined policy made anon SELECT fail with 42501 because Postgres
-- still requires permission to invoke every function referenced by an RLS policy.

drop policy if exists marketing_hero_posters_public_read
  on public.marketing_hero_posters;

create policy marketing_hero_posters_public_active_read
on public.marketing_hero_posters for select to anon, authenticated
using (is_active);

create policy marketing_hero_posters_admin_read
on public.marketing_hero_posters for select to authenticated
using (public.is_admin());
