-- Admin-managed homepage hero posters and their dedicated public Storage bucket.
-- This forward migration is intentionally separate from the existing catalog schema.

create table public.marketing_hero_posters (
  id uuid primary key default gen_random_uuid(),
  image_path text not null unique check (
    image_path ~ '^posters/[A-Za-z0-9][A-Za-z0-9._/-]{0,499}$'
    and image_path !~ '(^|/)\.\.(/|$)'
  ),
  alt_text text not null check (char_length(btrim(alt_text)) between 1 and 240),
  title text check (title is null or char_length(btrim(title)) between 1 and 160),
  url text check (url is null or (url ~ '^/[A-Za-z0-9/?#&=._~-]*$' and url !~ '^//')),
  sort_order integer not null default 0 check (sort_order between -100000 and 100000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index marketing_hero_posters_public_order
  on public.marketing_hero_posters (sort_order, created_at, id)
  where is_active;

create trigger marketing_hero_posters_touch_updated_at
before update on public.marketing_hero_posters
for each row execute function public.touch_updated_at();

alter table public.marketing_hero_posters enable row level security;

create policy marketing_hero_posters_public_read
on public.marketing_hero_posters for select to anon, authenticated
using (is_active or public.is_admin());

create policy marketing_hero_posters_admin_insert
on public.marketing_hero_posters for insert to authenticated
with check (public.is_admin());

create policy marketing_hero_posters_admin_update
on public.marketing_hero_posters for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy marketing_hero_posters_admin_delete
on public.marketing_hero_posters for delete to authenticated
using (public.is_admin());

create function public.reorder_marketing_hero_posters(p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admin account required' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 100 then
    raise exception 'Provide a valid poster order' using errcode = '22023';
  end if;
  select count(*) into v_count from public.marketing_hero_posters where id = any(p_ids);
  if v_count <> cardinality(p_ids) or v_count <> (select count(distinct id) from unnest(p_ids) id) then
    raise exception 'Poster order contains missing or duplicate identities' using errcode = '22023';
  end if;
  update public.marketing_hero_posters poster
  set sort_order = ordering.ordinality * 10
  from unnest(p_ids) with ordinality ordering(id, ordinality)
  where poster.id = ordering.id;
end $$;

revoke all on public.marketing_hero_posters from anon, authenticated;
grant select (id, image_path, alt_text, title, url, sort_order, is_active, created_at, updated_at)
  on public.marketing_hero_posters to anon, authenticated;
grant insert (image_path, alt_text, title, url, sort_order, is_active),
  update (image_path, alt_text, title, url, sort_order, is_active), delete
  on public.marketing_hero_posters to authenticated;
grant all on public.marketing_hero_posters to service_role;
revoke all on function public.reorder_marketing_hero_posters(uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_marketing_hero_posters(uuid[]) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketing-hero-posters',
  'marketing-hero-posters',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy marketing_hero_posters_storage_public_read
on storage.objects for select to anon, authenticated
using (bucket_id = 'marketing-hero-posters');

create policy marketing_hero_posters_storage_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'marketing-hero-posters'
  and split_part(name, '/', 1) = 'posters'
  and public.is_admin()
);

create policy marketing_hero_posters_storage_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'marketing-hero-posters' and public.is_admin())
with check (
  bucket_id = 'marketing-hero-posters'
  and split_part(name, '/', 1) = 'posters'
  and public.is_admin()
);

create policy marketing_hero_posters_storage_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'marketing-hero-posters' and public.is_admin());
