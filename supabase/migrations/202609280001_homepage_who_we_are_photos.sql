-- Three fixed, admin-managed photo roles for the public homepage Who We Are section.

create table public.homepage_who_we_are_photos (
  role text primary key check (role in ('primary', 'upper_right', 'lower_right')),
  image_path text unique,
  alt_text text,
  badge_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homepage_who_we_are_photo_content check (
    (
      image_path is null
      and alt_text is null
      and badge_text is null
    ) or (
      image_path is not null
      and alt_text is not null
      and alt_text = btrim(alt_text)
      and char_length(alt_text) between 1 and 300
      and (badge_text is null or (
        badge_text = btrim(badge_text)
        and char_length(badge_text) between 1 and 120
      ))
    )
  ),
  constraint homepage_who_we_are_photo_role_path check (
    (role = 'primary' and image_path ~ '^who-we-are/primary/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$')
    or (role = 'upper_right' and image_path ~ '^who-we-are/upper_right/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$')
    or (role = 'lower_right' and image_path ~ '^who-we-are/lower_right/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$')
    or image_path is null
  )
);

create trigger homepage_who_we_are_photos_touch_updated_at
before update on public.homepage_who_we_are_photos
for each row execute function public.touch_updated_at();

alter table public.homepage_who_we_are_photos enable row level security;

create policy homepage_who_we_are_photos_public_read
on public.homepage_who_we_are_photos for select to anon, authenticated
using (true);

create policy homepage_who_we_are_photos_admin_insert
on public.homepage_who_we_are_photos for insert to authenticated
with check (public.is_admin());

create policy homepage_who_we_are_photos_admin_update
on public.homepage_who_we_are_photos for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy homepage_who_we_are_photos_admin_delete
on public.homepage_who_we_are_photos for delete to authenticated
using (public.is_admin());

revoke all on public.homepage_who_we_are_photos from anon, authenticated;
grant select (role, image_path, alt_text, badge_text, created_at, updated_at)
  on public.homepage_who_we_are_photos to anon, authenticated;
grant insert (role, image_path, alt_text, badge_text),
  update (image_path, alt_text, badge_text), delete
  on public.homepage_who_we_are_photos to authenticated;
grant all on public.homepage_who_we_are_photos to service_role;

-- Keep one restricted policy family for the shared editorial bucket while
-- preserving every previously approved prefix.
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
      or name ~ '^who-we-are/(primary|upper_right|lower_right)/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    )
    and name not like '%..%'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  );
