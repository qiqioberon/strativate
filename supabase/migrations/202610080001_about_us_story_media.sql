-- One fixed admin-managed editorial image for the public About Us story section.

create table public.about_us_story_media (
  id text primary key default 'story' check (id = 'story'),
  image_path text,
  source_image_path text,
  image_crop jsonb,
  alt_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint about_us_story_media_image_path_check check (
    image_path is null or image_path ~ '^about-us/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
  ),
  constraint about_us_story_media_source_path_check check (
    source_image_path is null or source_image_path ~ '^about-us/[0-9a-f-]{36}\.(jpg|png|webp)$'
  ),
  constraint about_us_story_media_crop_check check (
    image_crop is null or coalesce((
      jsonb_typeof(image_crop) = 'object'
      and jsonb_typeof(image_crop->'x') = 'number'
      and jsonb_typeof(image_crop->'y') = 'number'
      and jsonb_typeof(image_crop->'width') = 'number'
      and jsonb_typeof(image_crop->'height') = 'number'
      and (image_crop->>'x')::numeric between 0 and 1
      and (image_crop->>'y')::numeric between 0 and 1
      and (image_crop->>'width')::numeric > 0 and (image_crop->>'width')::numeric <= 1
      and (image_crop->>'height')::numeric > 0 and (image_crop->>'height')::numeric <= 1
      and (image_crop->>'x')::numeric + (image_crop->>'width')::numeric <= 1.000001
      and (image_crop->>'y')::numeric + (image_crop->>'height')::numeric <= 1.000001
    ), false)
  ),
  constraint about_us_story_media_content_check check (
    (
      image_path is null
      and source_image_path is null
      and image_crop is null
      and alt_text is null
    ) or (
      image_path is not null
      and alt_text is not null
      and alt_text = btrim(alt_text)
      and char_length(alt_text) between 1 and 300
    )
  )
);

create trigger about_us_story_media_touch_updated_at
before update on public.about_us_story_media
for each row execute function public.touch_updated_at();

alter table public.about_us_story_media enable row level security;

create policy about_us_story_media_public_read
on public.about_us_story_media for select to anon, authenticated
using (true);

create policy about_us_story_media_admin_insert
on public.about_us_story_media for insert to authenticated
with check (public.is_admin());

create policy about_us_story_media_admin_update
on public.about_us_story_media for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy about_us_story_media_admin_delete
on public.about_us_story_media for delete to authenticated
using (public.is_admin());

revoke all on public.about_us_story_media from anon, authenticated;
grant select (id, image_path, alt_text, created_at, updated_at)
  on public.about_us_story_media to anon, authenticated;
grant insert (id, image_path, source_image_path, image_crop, alt_text),
  update (image_path, source_image_path, image_crop, alt_text),
  delete on public.about_us_story_media to authenticated;
grant all on public.about_us_story_media to service_role;

create function public.admin_list_about_us_story_media()
returns setof public.about_us_story_media
language sql
stable
security definer
set search_path = ''
as $$
  select media.*
  from public.about_us_story_media media
  where public.is_admin()
  order by media.id;
$$;

revoke all on function public.admin_list_about_us_story_media() from public, anon, authenticated;
grant execute on function public.admin_list_about_us_story_media() to authenticated;

comment on column public.about_us_story_media.source_image_path is 'Admin-only private original used for future crop adjustments.';
comment on column public.about_us_story_media.image_crop is 'Admin-only normalized x/y/width/height crop in source-image coordinates.';

-- Extend the shared private-original upload policy with the About Us prefix.
update storage.buckets set public = false where id = 'marketing-photo-sources';
drop policy if exists marketing_photo_sources_admin_insert on storage.objects;
create policy marketing_photo_sources_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'marketing-photo-sources'
    and public.is_admin()
    and split_part(name, '/', 1) in (
      'publications', 'competitions', 'testimonials', 'who-we-are',
      'competition-recognitions', 'trusted-partners', 'about-us'
    )
    and name !~ '(^|/)\.\.(/|$)'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  );

-- Keep one restricted policy family for the public derivative bucket.
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
      or name ~ '^about-us/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
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
      or name ~ '^about-us/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
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
      or name ~ '^about-us/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
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
      or name ~ '^about-us/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
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
      or name ~ '^about-us/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    )
    and name not like '%..%'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  );
