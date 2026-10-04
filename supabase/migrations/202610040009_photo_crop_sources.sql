-- Preserve private original photo sources and normalized crop geometry for repeatable adjustments.
-- Existing derivative-only rows remain valid legacy records.

alter table public.publications
  add column cover_source_path text,
  add column cover_crop jsonb;

alter table public.competitions
  add column cover_source_path text,
  add column cover_crop jsonb;

alter table public.marketing_testimonials
  add column image_source_path text,
  add column image_crop jsonb;

alter table public.homepage_who_we_are_photos
  add column source_image_path text,
  add column image_crop jsonb;

alter table public.profiles
  add column avatar_source_path text,
  add column avatar_crop jsonb;

alter table public.publications
  add constraint publications_cover_source_path_check check (
    cover_source_path is null or cover_source_path ~ '^publications/[0-9a-f-]{36}\.(jpg|png|webp)$'
  ),
  add constraint publications_cover_crop_check check (
    cover_crop is null or (
      jsonb_typeof(cover_crop) = 'object'
      and jsonb_typeof(cover_crop->'x') = 'number'
      and jsonb_typeof(cover_crop->'y') = 'number'
      and jsonb_typeof(cover_crop->'width') = 'number'
      and jsonb_typeof(cover_crop->'height') = 'number'
      and (cover_crop->>'x')::numeric between 0 and 1
      and (cover_crop->>'y')::numeric between 0 and 1
      and (cover_crop->>'width')::numeric > 0 and (cover_crop->>'width')::numeric <= 1
      and (cover_crop->>'height')::numeric > 0 and (cover_crop->>'height')::numeric <= 1
      and (cover_crop->>'x')::numeric + (cover_crop->>'width')::numeric <= 1.000001
      and (cover_crop->>'y')::numeric + (cover_crop->>'height')::numeric <= 1.000001
    )
  );

alter table public.competitions
  add constraint competitions_cover_source_path_check check (
    cover_source_path is null or cover_source_path ~ '^competitions/[0-9a-f-]{36}\.(jpg|png|webp)$'
  ),
  add constraint competitions_cover_crop_check check (
    cover_crop is null or (
      jsonb_typeof(cover_crop) = 'object'
      and jsonb_typeof(cover_crop->'x') = 'number'
      and jsonb_typeof(cover_crop->'y') = 'number'
      and jsonb_typeof(cover_crop->'width') = 'number'
      and jsonb_typeof(cover_crop->'height') = 'number'
      and (cover_crop->>'x')::numeric between 0 and 1
      and (cover_crop->>'y')::numeric between 0 and 1
      and (cover_crop->>'width')::numeric > 0 and (cover_crop->>'width')::numeric <= 1
      and (cover_crop->>'height')::numeric > 0 and (cover_crop->>'height')::numeric <= 1
      and (cover_crop->>'x')::numeric + (cover_crop->>'width')::numeric <= 1.000001
      and (cover_crop->>'y')::numeric + (cover_crop->>'height')::numeric <= 1.000001
    )
  );

alter table public.marketing_testimonials
  add constraint marketing_testimonials_source_path_check check (
    image_source_path is null or image_source_path ~ '^testimonials/[0-9a-f-]{36}\.(jpg|png|webp)$'
  ),
  add constraint marketing_testimonials_crop_check check (
    image_crop is null or (
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
    )
  );

alter table public.homepage_who_we_are_photos
  add constraint homepage_who_we_are_source_path_check check (
    source_image_path is null or source_image_path ~ '^who-we-are/(primary|upper_right|lower_right)/[0-9a-f-]{36}\.(jpg|png|webp)$'
  ),
  add constraint homepage_who_we_are_crop_check check (
    image_crop is null or (
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
    )
  );

alter table public.profiles
  add constraint profiles_avatar_source_path_check check (
    avatar_source_path is null or avatar_source_path ~ '^[0-9a-f-]{36}/sources/[0-9a-f-]{36}\.(jpg|png|webp)$'
  ),
  add constraint profiles_avatar_crop_check check (
    avatar_crop is null or (
      jsonb_typeof(avatar_crop) = 'object'
      and jsonb_typeof(avatar_crop->'x') = 'number'
      and jsonb_typeof(avatar_crop->'y') = 'number'
      and jsonb_typeof(avatar_crop->'width') = 'number'
      and jsonb_typeof(avatar_crop->'height') = 'number'
      and (avatar_crop->>'x')::numeric between 0 and 1
      and (avatar_crop->>'y')::numeric between 0 and 1
      and (avatar_crop->>'width')::numeric > 0 and (avatar_crop->>'width')::numeric <= 1
      and (avatar_crop->>'height')::numeric > 0 and (avatar_crop->>'height')::numeric <= 1
      and (avatar_crop->>'x')::numeric + (avatar_crop->>'width')::numeric <= 1.000001
      and (avatar_crop->>'y')::numeric + (avatar_crop->>'height')::numeric <= 1.000001
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketing-photo-sources', 'marketing-photo-sources', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy marketing_photo_sources_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'marketing-photo-sources' and public.is_admin());

create policy marketing_photo_sources_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'marketing-photo-sources'
    and public.is_admin()
    and split_part(name, '/', 1) in ('publications', 'competitions', 'testimonials', 'who-we-are')
    and name !~ '(^|/)\.\.(/|$)'
    and name ~* '\.(jpe?g|png|webp)$'
  );

create policy marketing_photo_sources_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'marketing-photo-sources' and public.is_admin());

grant insert (cover_source_path, cover_crop), update (cover_source_path, cover_crop)
  on public.publications to authenticated;
grant insert (cover_source_path, cover_crop), update (cover_source_path, cover_crop)
  on public.competitions to authenticated;
grant insert (image_source_path, image_crop), update (image_source_path, image_crop)
  on public.marketing_testimonials to authenticated;
grant insert (source_image_path, image_crop), update (source_image_path, image_crop)
  on public.homepage_who_we_are_photos to authenticated;
grant update (avatar_source_path, avatar_crop) on public.profiles to authenticated;

-- Public content remains directly readable without revealing private source-object metadata.
revoke select on public.publications, public.competitions from anon, authenticated;
grant select (
  id, slug, title, excerpt, body, body_json, category, category_id, cover_path,
  cover_alt_text, published_at, is_published, is_featured, sort_order, created_at, updated_at
) on public.publications to anon, authenticated;
grant select (
  id, slug, name, category_id, description, rules_url, registration_url,
  registration_deadline, cover_path, cover_alt_text, status, is_published,
  is_featured, sort_order, created_at, updated_at
) on public.competitions to anon, authenticated;

create function public.admin_list_publications()
returns setof public.publications
language sql
stable
security definer
set search_path = ''
as $$
  select publication.*
  from public.publications publication
  where public.is_admin()
  order by publication.sort_order, publication.created_at;
$$;

create function public.admin_list_competitions()
returns setof public.competitions
language sql
stable
security definer
set search_path = ''
as $$
  select competition.*
  from public.competitions competition
  where public.is_admin()
  order by competition.sort_order, competition.created_at;
$$;

create function public.admin_list_marketing_testimonials()
returns setof public.marketing_testimonials
language sql
stable
security definer
set search_path = ''
as $$
  select testimonial.*
  from public.marketing_testimonials testimonial
  where public.is_admin()
  order by testimonial.sort_order, testimonial.created_at, testimonial.id;
$$;

create function public.admin_list_homepage_who_we_are_photos()
returns setof public.homepage_who_we_are_photos
language sql
stable
security definer
set search_path = ''
as $$
  select photo.*
  from public.homepage_who_we_are_photos photo
  where public.is_admin()
  order by photo.role;
$$;

revoke all on function public.admin_list_publications() from public, anon, authenticated;
revoke all on function public.admin_list_competitions() from public, anon, authenticated;
revoke all on function public.admin_list_marketing_testimonials() from public, anon, authenticated;
revoke all on function public.admin_list_homepage_who_we_are_photos() from public, anon, authenticated;
grant execute on function public.admin_list_publications() to authenticated;
grant execute on function public.admin_list_competitions() to authenticated;
grant execute on function public.admin_list_marketing_testimonials() to authenticated;
grant execute on function public.admin_list_homepage_who_we_are_photos() to authenticated;

comment on column public.publications.cover_source_path is 'Private original source used for future crop adjustments; null identifies a legacy derivative-only cover.';
comment on column public.competitions.cover_source_path is 'Private original source used for future crop adjustments; null identifies a legacy derivative-only cover.';
comment on column public.marketing_testimonials.image_source_path is 'Private original source used for future crop adjustments; null identifies a legacy derivative-only image.';
comment on column public.homepage_who_we_are_photos.source_image_path is 'Private original source used for future crop adjustments; null identifies a legacy derivative-only image.';
comment on column public.profiles.avatar_source_path is 'Owner-private original source used for future avatar crop adjustments.';
