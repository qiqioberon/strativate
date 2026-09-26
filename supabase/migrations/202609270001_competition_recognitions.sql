-- Admin-managed competition recognition logos for the public homepage.

create table public.competition_recognitions (
  id uuid primary key default gen_random_uuid(),
  competition_name text not null check (
    competition_name = btrim(competition_name)
    and char_length(competition_name) between 1 and 180
  ),
  logo_path text not null unique check (
    char_length(logo_path) between 23 and 508
    and logo_path ~ '^recognition-logos/[A-Za-z0-9][A-Za-z0-9._/-]*$'
    and logo_path not like '%..%'
    and logo_path not like '%//%'
    and logo_path ~* '\.(jpe?g|png|webp)$'
  ),
  display_order integer not null default 0 check (display_order between 0 and 100000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index competition_recognitions_public_order
  on public.competition_recognitions (display_order, created_at, id)
  where is_active;

create trigger competition_recognitions_touch_updated_at
before update on public.competition_recognitions
for each row execute function public.touch_updated_at();

alter table public.competition_recognitions enable row level security;

create policy competition_recognitions_public_active_read
on public.competition_recognitions for select to anon, authenticated
using (is_active);

create policy competition_recognitions_admin_read
on public.competition_recognitions for select to authenticated
using (public.is_admin());

create policy competition_recognitions_admin_insert
on public.competition_recognitions for insert to authenticated
with check (public.is_admin());

create policy competition_recognitions_admin_update
on public.competition_recognitions for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy competition_recognitions_admin_delete
on public.competition_recognitions for delete to authenticated
using (public.is_admin());

create function public.reorder_competition_recognitions(p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_matched_count integer;
  v_total_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admin account required' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) > 1000 then
    raise exception 'Provide a valid competition recognition order' using errcode = '22023';
  end if;

  lock table public.competition_recognitions in share row exclusive mode;
  select count(*) into v_total_count from public.competition_recognitions;
  select count(*) into v_matched_count
  from public.competition_recognitions
  where id = any(p_ids);

  if v_total_count <> cardinality(p_ids)
    or v_matched_count <> cardinality(p_ids)
    or v_matched_count <> (select count(distinct input_id) from unnest(p_ids) input_ids(input_id)) then
    raise exception 'Competition recognition order is stale or contains missing or duplicate identities' using errcode = '22023';
  end if;

  update public.competition_recognitions recognition
  set display_order = ordering.ordinality
  from unnest(p_ids) with ordinality ordering(id, ordinality)
  where recognition.id = ordering.id;
end $$;

revoke all on public.competition_recognitions from anon, authenticated;
grant select (id, competition_name, logo_path, display_order, is_active, created_at, updated_at)
  on public.competition_recognitions to anon, authenticated;
grant insert (competition_name, logo_path, display_order, is_active),
  update (competition_name, logo_path, display_order, is_active), delete
  on public.competition_recognitions to authenticated;
grant all on public.competition_recognitions to service_role;
revoke all on function public.reorder_competition_recognitions(uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_competition_recognitions(uuid[]) to authenticated;

-- Keep one restricted policy family for the shared editorial bucket.
drop policy if exists marketing_editorial_public_read on storage.objects;
drop policy if exists marketing_editorial_admin_insert on storage.objects;
drop policy if exists marketing_editorial_admin_update on storage.objects;
drop policy if exists marketing_editorial_admin_delete on storage.objects;

create policy marketing_editorial_public_read on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'marketing-editorial'
    and (name like 'publications/%' or name like 'competitions/%' or name like 'recognition-logos/%')
    and name not like '%..%'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  );

create policy marketing_editorial_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'marketing-editorial'
    and public.is_admin()
    and (name like 'publications/%' or name like 'competitions/%' or name like 'recognition-logos/%')
    and name not like '%..%'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  );

create policy marketing_editorial_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'marketing-editorial'
    and public.is_admin()
    and (name like 'publications/%' or name like 'competitions/%' or name like 'recognition-logos/%')
    and name not like '%..%'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  )
  with check (
    bucket_id = 'marketing-editorial'
    and public.is_admin()
    and (name like 'publications/%' or name like 'competitions/%' or name like 'recognition-logos/%')
    and name not like '%..%'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  );

create policy marketing_editorial_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'marketing-editorial'
    and public.is_admin()
    and (name like 'publications/%' or name like 'competitions/%' or name like 'recognition-logos/%')
    and name not like '%..%'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  );
