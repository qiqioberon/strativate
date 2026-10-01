-- Admin-managed trusted partner logos for the public homepage.

create table public.trusted_partners (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null check (
    organization_name = btrim(organization_name)
    and char_length(organization_name) between 1 and 180
  ),
  logo_path text not null unique check (
    char_length(logo_path) between 18 and 508
    and logo_path ~ '^partner-logos/[A-Za-z0-9][A-Za-z0-9._/-]*$'
    and logo_path not like '%..%'
    and logo_path not like '%//%'
    and logo_path ~* '\.(jpe?g|png|webp)$'
  ),
  display_order integer not null default 0 check (display_order between 0 and 100000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trusted_partners_public_order
  on public.trusted_partners (display_order, created_at, id)
  where is_active;

create trigger trusted_partners_touch_updated_at
before update on public.trusted_partners
for each row execute function public.touch_updated_at();

alter table public.trusted_partners enable row level security;

create policy trusted_partners_public_active_read
on public.trusted_partners for select to anon, authenticated
using (is_active);

create policy trusted_partners_admin_read
on public.trusted_partners for select to authenticated
using (public.is_admin());

create policy trusted_partners_admin_insert
on public.trusted_partners for insert to authenticated
with check (public.is_admin());

create policy trusted_partners_admin_update
on public.trusted_partners for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy trusted_partners_admin_delete
on public.trusted_partners for delete to authenticated
using (public.is_admin());

create function public.reorder_trusted_partners(p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_matched_count integer;
  v_total_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admin account required' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) > 1000 then
    raise exception 'Provide a valid trusted partner order' using errcode = '22023';
  end if;

  lock table public.trusted_partners in share row exclusive mode;
  select count(*) into v_total_count from public.trusted_partners;
  select count(*) into v_matched_count
  from public.trusted_partners
  where id = any(p_ids);

  if v_total_count <> cardinality(p_ids)
    or v_matched_count <> cardinality(p_ids)
    or v_matched_count <> (select count(distinct input_id) from unnest(p_ids) input_ids(input_id)) then
    raise exception 'Trusted partner order is stale or contains missing or duplicate identities' using errcode = '22023';
  end if;

  update public.trusted_partners partner
  set display_order = ordering.ordinality
  from unnest(p_ids) with ordinality ordering(id, ordinality)
  where partner.id = ordering.id;
end $$;

revoke all on public.trusted_partners from anon, authenticated;
grant select (id, organization_name, logo_path, display_order, is_active, created_at, updated_at)
  on public.trusted_partners to anon, authenticated;
grant insert (organization_name, logo_path, display_order, is_active),
  update (organization_name, logo_path, display_order, is_active), delete
  on public.trusted_partners to authenticated;
grant all on public.trusted_partners to service_role;
revoke all on function public.reorder_trusted_partners(uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_trusted_partners(uuid[]) to authenticated;

-- Maintain marketing-editorial storage policies with partner-logos prefix
drop policy if exists marketing_editorial_public_read on storage.objects;
drop policy if exists marketing_editorial_admin_insert on storage.objects;
drop policy if exists marketing_editorial_admin_update on storage.objects;
drop policy if exists marketing_editorial_admin_delete on storage.objects;

create policy marketing_editorial_public_read on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'marketing-editorial'
    and (
      name like 'publications/%'
      or name like 'competitions/%'
      or name like 'recognition-logos/%'
      or name like 'partner-logos/%'
      or name ~ '^who-we-are/(primary|upper_right|lower_right)/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    )
    and name not like '%..%'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  );

create policy marketing_editorial_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'marketing-editorial'
    and public.is_admin()
    and (
      name like 'publications/%'
      or name like 'competitions/%'
      or name like 'recognition-logos/%'
      or name like 'partner-logos/%'
      or name ~ '^who-we-are/(primary|upper_right|lower_right)/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    )
    and name not like '%..%'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  );

create policy marketing_editorial_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'marketing-editorial'
    and public.is_admin()
    and (
      name like 'publications/%'
      or name like 'competitions/%'
      or name like 'recognition-logos/%'
      or name like 'partner-logos/%'
      or name ~ '^who-we-are/(primary|upper_right|lower_right)/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    )
    and name not like '%..%'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  )
  with check (
    bucket_id = 'marketing-editorial'
    and public.is_admin()
    and (
      name like 'publications/%'
      or name like 'competitions/%'
      or name like 'recognition-logos/%'
      or name like 'partner-logos/%'
      or name ~ '^who-we-are/(primary|upper_right|lower_right)/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    )
    and name not like '%..%'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  );

create policy marketing_editorial_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'marketing-editorial'
    and public.is_admin()
    and (
      name like 'publications/%'
      or name like 'competitions/%'
      or name like 'recognition-logos/%'
      or name like 'partner-logos/%'
      or name ~ '^who-we-are/(primary|upper_right|lower_right)/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    )
    and name not like '%..%'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  );
