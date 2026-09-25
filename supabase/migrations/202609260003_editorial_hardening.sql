-- Harden the stakeholder Publications/Competitions CMS without rewriting deployed history.

alter table public.publications
  add column if not exists category text,
  add column if not exists cover_alt_text text;

alter table public.competitions
  add column if not exists cover_alt_text text;

update public.publications
set cover_path = null
where cover_path is not null
  and (
    cover_path !~ '^publications/[A-Za-z0-9][A-Za-z0-9._/-]*$'
    or cover_path like '%..%'
    or cover_path like '%//%'
    or cover_path !~* '\.(jpe?g|png|webp)$'
  );

update public.competitions
set cover_path = null
where cover_path is not null
  and (
    cover_path !~ '^competitions/[A-Za-z0-9][A-Za-z0-9._/-]*$'
    or cover_path like '%..%'
    or cover_path like '%//%'
    or cover_path !~* '\.(jpe?g|png|webp)$'
  );

update public.competitions
set rules_url = null
where rules_url is not null and rules_url !~* '^https?://[^[:space:]]+$';

update public.competitions
set registration_url = null
where registration_url is not null and registration_url !~* '^https?://[^[:space:]]+$';

alter table public.publications
  add constraint publications_category_safe_check
    check (category is null or (category = btrim(category) and char_length(category) between 1 and 80)),
  add constraint publications_cover_path_safe_check
    check (
      cover_path is null
      or (
        cover_path ~ '^publications/[A-Za-z0-9][A-Za-z0-9._/-]*$'
        and cover_path not like '%..%'
        and cover_path not like '%//%'
        and cover_path ~* '\.(jpe?g|png|webp)$'
      )
    ),
  add constraint publications_cover_alt_text_check
    check (cover_alt_text is null or char_length(btrim(cover_alt_text)) between 1 and 220);

alter table public.competitions
  add constraint competitions_cover_path_safe_check
    check (
      cover_path is null
      or (
        cover_path ~ '^competitions/[A-Za-z0-9][A-Za-z0-9._/-]*$'
        and cover_path not like '%..%'
        and cover_path not like '%//%'
        and cover_path ~* '\.(jpe?g|png|webp)$'
      )
    ),
  add constraint competitions_cover_alt_text_check
    check (cover_alt_text is null or char_length(btrim(cover_alt_text)) between 1 and 220),
  add constraint competitions_rules_url_http_check
    check (rules_url is null or rules_url ~* '^https?://[^[:space:]]+$'),
  add constraint competitions_registration_url_http_check
    check (registration_url is null or registration_url ~* '^https?://[^[:space:]]+$');

create index if not exists publications_category_public_idx
  on public.publications(category, published_at desc)
  where is_published;

drop policy if exists marketing_editorial_public_read on storage.objects;
drop policy if exists marketing_editorial_admin_insert on storage.objects;
drop policy if exists marketing_editorial_admin_update on storage.objects;
drop policy if exists marketing_editorial_admin_delete on storage.objects;

create policy marketing_editorial_public_read on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'marketing-editorial'
    and (name like 'publications/%' or name like 'competitions/%')
    and name not like '%..%'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  );

create policy marketing_editorial_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'marketing-editorial'
    and public.is_admin()
    and (name like 'publications/%' or name like 'competitions/%')
    and name not like '%..%'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  );

create policy marketing_editorial_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'marketing-editorial'
    and public.is_admin()
    and (name like 'publications/%' or name like 'competitions/%')
    and name not like '%..%'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  )
  with check (
    bucket_id = 'marketing-editorial'
    and public.is_admin()
    and (name like 'publications/%' or name like 'competitions/%')
    and name not like '%..%'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  );

create policy marketing_editorial_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'marketing-editorial'
    and public.is_admin()
    and (name like 'publications/%' or name like 'competitions/%')
    and name not like '%..%'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  );
