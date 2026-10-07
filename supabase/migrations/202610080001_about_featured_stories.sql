-- Admin-managed editorial success stories for the public About Us page.
-- No story rows are seeded: every published claim must come from approved Admin content.

create table public.about_featured_stories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (
    title = btrim(title)
    and char_length(title) between 1 and 240
  ),
  quote text not null check (
    quote = btrim(quote)
    and char_length(quote) between 1 and 3000
  ),
  attribution_name text not null check (
    attribution_name = btrim(attribution_name)
    and char_length(attribution_name) between 1 and 180
  ),
  attribution_organization text not null check (
    attribution_organization = btrim(attribution_organization)
    and char_length(attribution_organization) between 1 and 240
  ),
  achievement_text text not null check (
    achievement_text = btrim(achievement_text)
    and char_length(achievement_text) between 1 and 300
  ),
  media_layout text not null check (media_layout in ('single', 'pair')),
  primary_image_path text not null unique check (
    primary_image_path ~ '^about-featured-stories/[0-9a-f-]{36}\.webp$'
    and primary_image_path not like '%..%'
    and primary_image_path not like '%//%'
  ),
  primary_image_source_path text not null unique check (
    primary_image_source_path ~ '^about-featured-stories/[0-9a-f-]{36}\.(jpg|png|webp)$'
    and primary_image_source_path not like '%..%'
    and primary_image_source_path not like '%//%'
  ),
  primary_image_crop jsonb not null,
  primary_image_alt_text text not null check (
    primary_image_alt_text = btrim(primary_image_alt_text)
    and char_length(primary_image_alt_text) between 1 and 300
  ),
  secondary_image_path text unique check (
    secondary_image_path is null or (
      secondary_image_path ~ '^about-featured-stories/[0-9a-f-]{36}\.webp$'
      and secondary_image_path not like '%..%'
      and secondary_image_path not like '%//%'
    )
  ),
  secondary_image_source_path text unique check (
    secondary_image_source_path is null or (
      secondary_image_source_path ~ '^about-featured-stories/[0-9a-f-]{36}\.(jpg|png|webp)$'
      and secondary_image_source_path not like '%..%'
      and secondary_image_source_path not like '%//%'
    )
  ),
  secondary_image_crop jsonb,
  secondary_image_alt_text text check (
    secondary_image_alt_text is null or (
      secondary_image_alt_text = btrim(secondary_image_alt_text)
      and char_length(secondary_image_alt_text) between 1 and 300
    )
  ),
  display_order integer not null default 0 check (display_order between 0 and 100000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint about_featured_stories_primary_crop_check check (
    coalesce((
      jsonb_typeof(primary_image_crop) = 'object'
      and jsonb_typeof(primary_image_crop->'x') = 'number'
      and jsonb_typeof(primary_image_crop->'y') = 'number'
      and jsonb_typeof(primary_image_crop->'width') = 'number'
      and jsonb_typeof(primary_image_crop->'height') = 'number'
      and (primary_image_crop->>'x')::numeric between 0 and 1
      and (primary_image_crop->>'y')::numeric between 0 and 1
      and (primary_image_crop->>'width')::numeric > 0
      and (primary_image_crop->>'width')::numeric <= 1
      and (primary_image_crop->>'height')::numeric > 0
      and (primary_image_crop->>'height')::numeric <= 1
      and (primary_image_crop->>'x')::numeric + (primary_image_crop->>'width')::numeric <= 1.000001
      and (primary_image_crop->>'y')::numeric + (primary_image_crop->>'height')::numeric <= 1.000001
    ), false)
  ),
  constraint about_featured_stories_secondary_crop_check check (
    secondary_image_crop is null or coalesce((
      jsonb_typeof(secondary_image_crop) = 'object'
      and jsonb_typeof(secondary_image_crop->'x') = 'number'
      and jsonb_typeof(secondary_image_crop->'y') = 'number'
      and jsonb_typeof(secondary_image_crop->'width') = 'number'
      and jsonb_typeof(secondary_image_crop->'height') = 'number'
      and (secondary_image_crop->>'x')::numeric between 0 and 1
      and (secondary_image_crop->>'y')::numeric between 0 and 1
      and (secondary_image_crop->>'width')::numeric > 0
      and (secondary_image_crop->>'width')::numeric <= 1
      and (secondary_image_crop->>'height')::numeric > 0
      and (secondary_image_crop->>'height')::numeric <= 1
      and (secondary_image_crop->>'x')::numeric + (secondary_image_crop->>'width')::numeric <= 1.000001
      and (secondary_image_crop->>'y')::numeric + (secondary_image_crop->>'height')::numeric <= 1.000001
    ), false)
  ),
  constraint about_featured_stories_media_slots_check check (
    (
      media_layout = 'single'
      and secondary_image_path is null
      and secondary_image_source_path is null
      and secondary_image_crop is null
      and secondary_image_alt_text is null
    )
    or (
      media_layout = 'pair'
      and secondary_image_path is not null
      and secondary_image_source_path is not null
      and secondary_image_crop is not null
      and secondary_image_alt_text is not null
    )
  )
);

create index about_featured_stories_public_order
  on public.about_featured_stories (display_order, created_at, id)
  where is_active;

create trigger about_featured_stories_touch_updated_at
before update on public.about_featured_stories
for each row execute function public.touch_updated_at();

alter table public.about_featured_stories enable row level security;

create policy about_featured_stories_public_active_read
on public.about_featured_stories for select to anon, authenticated
using (is_active);

create policy about_featured_stories_admin_read
on public.about_featured_stories for select to authenticated
using (public.is_admin());

create policy about_featured_stories_admin_insert
on public.about_featured_stories for insert to authenticated
with check (public.is_admin());

create policy about_featured_stories_admin_update
on public.about_featured_stories for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy about_featured_stories_admin_delete
on public.about_featured_stories for delete to authenticated
using (public.is_admin());

revoke all on public.about_featured_stories from anon, authenticated;
grant select (
  id, title, quote, attribution_name, attribution_organization, achievement_text,
  media_layout, primary_image_path, primary_image_alt_text, secondary_image_path,
  secondary_image_alt_text, display_order, is_active, created_at, updated_at
) on public.about_featured_stories to anon, authenticated;
grant insert (
  title, quote, attribution_name, attribution_organization, achievement_text,
  media_layout, primary_image_path, primary_image_source_path, primary_image_crop,
  primary_image_alt_text, secondary_image_path, secondary_image_source_path,
  secondary_image_crop, secondary_image_alt_text, display_order, is_active
), update (
  title, quote, attribution_name, attribution_organization, achievement_text,
  media_layout, primary_image_path, primary_image_source_path, primary_image_crop,
  primary_image_alt_text, secondary_image_path, secondary_image_source_path,
  secondary_image_crop, secondary_image_alt_text, display_order, is_active
), delete on public.about_featured_stories to authenticated;
grant all on public.about_featured_stories to service_role;

create function public.admin_list_about_featured_stories()
returns setof public.about_featured_stories
language sql
stable
security definer
set search_path = ''
as $$
  select story.*
  from public.about_featured_stories story
  where public.is_admin()
  order by story.display_order, story.created_at, story.id;
$$;

create function public.reorder_about_featured_stories(p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_matched_count integer;
  v_total_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admin account required' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) > 1000 then
    raise exception 'Provide a valid featured story order' using errcode = '22023';
  end if;

  lock table public.about_featured_stories in share row exclusive mode;
  select count(*) into v_total_count from public.about_featured_stories;
  select count(*) into v_matched_count
  from public.about_featured_stories
  where id = any(p_ids);

  if v_total_count <> cardinality(p_ids)
    or v_matched_count <> cardinality(p_ids)
    or v_matched_count <> (select count(distinct input_id) from unnest(p_ids) input_ids(input_id)) then
    raise exception 'Featured story order is stale or contains missing or duplicate identities' using errcode = '22023';
  end if;

  update public.about_featured_stories story
  set display_order = ordering.ordinality
  from unnest(p_ids) with ordinality ordering(id, ordinality)
  where story.id = ordering.id;
end $$;

revoke all on function public.admin_list_about_featured_stories() from public, anon, authenticated;
revoke all on function public.reorder_about_featured_stories(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_list_about_featured_stories() to authenticated;
grant execute on function public.reorder_about_featured_stories(uuid[]) to authenticated;

-- Preserve the private source bucket and extend its admin-only upload allowlist.
update storage.buckets
set public = false
where id = 'marketing-photo-sources';

drop policy if exists marketing_photo_sources_admin_insert on storage.objects;
create policy marketing_photo_sources_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'marketing-photo-sources'
    and public.is_admin()
    and split_part(name, '/', 1) in (
      'publications', 'competitions', 'testimonials', 'who-we-are',
      'competition-recognitions', 'trusted-partners', 'about-featured-stories'
    )
    and name !~ '(^|/)\.\.(/|$)'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  );

-- Keep one restricted policy family for the public editorial bucket while preserving all prior prefixes.
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
      or name ~ '^about-featured-stories/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
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
      or name ~ '^about-featured-stories/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
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
      or name ~ '^about-featured-stories/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
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
      or name ~ '^about-featured-stories/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
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
      or name ~ '^about-featured-stories/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    )
    and name not like '%..%'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  );

comment on table public.about_featured_stories is 'Admin-managed, approved editorial success stories shown at the bottom of About Us.';
comment on column public.about_featured_stories.primary_image_source_path is 'Admin-only private original for repeatable crop adjustment.';
comment on column public.about_featured_stories.secondary_image_source_path is 'Admin-only private original for repeatable crop adjustment.';
comment on column public.about_featured_stories.primary_image_crop is 'Admin-only normalized x/y/width/height crop in source-image coordinates.';
comment on column public.about_featured_stories.secondary_image_crop is 'Admin-only normalized x/y/width/height crop in source-image coordinates.';
