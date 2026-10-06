-- Add private originals/crops without changing existing derivative-only records.
alter table public.competition_recognitions
  add column logo_source_path text,
  add column logo_crop jsonb;

alter table public.trusted_partners
  add column logo_source_path text,
  add column logo_crop jsonb;

alter table public.competition_recognitions
  add constraint competition_recognitions_logo_source_path_check check (
    logo_source_path is null or logo_source_path ~ '^competition-recognitions/[0-9a-f-]{36}\.(jpg|png|webp)$'
  ),
  add constraint competition_recognitions_logo_crop_check check (
    logo_crop is null or coalesce((
      jsonb_typeof(logo_crop) = 'object'
      and jsonb_typeof(logo_crop->'x') = 'number'
      and jsonb_typeof(logo_crop->'y') = 'number'
      and jsonb_typeof(logo_crop->'width') = 'number'
      and jsonb_typeof(logo_crop->'height') = 'number'
      and (logo_crop->>'x')::numeric between 0 and 1
      and (logo_crop->>'y')::numeric between 0 and 1
      and (logo_crop->>'width')::numeric > 0 and (logo_crop->>'width')::numeric <= 1
      and (logo_crop->>'height')::numeric > 0 and (logo_crop->>'height')::numeric <= 1
      and (logo_crop->>'x')::numeric + (logo_crop->>'width')::numeric <= 1.000001
      and (logo_crop->>'y')::numeric + (logo_crop->>'height')::numeric <= 1.000001
    ), false)
  );

alter table public.trusted_partners
  add constraint trusted_partners_logo_source_path_check check (
    logo_source_path is null or logo_source_path ~ '^trusted-partners/[0-9a-f-]{36}\.(jpg|png|webp)$'
  ),
  add constraint trusted_partners_logo_crop_check check (
    logo_crop is null or coalesce((
      jsonb_typeof(logo_crop) = 'object'
      and jsonb_typeof(logo_crop->'x') = 'number'
      and jsonb_typeof(logo_crop->'y') = 'number'
      and jsonb_typeof(logo_crop->'width') = 'number'
      and jsonb_typeof(logo_crop->'height') = 'number'
      and (logo_crop->>'x')::numeric between 0 and 1
      and (logo_crop->>'y')::numeric between 0 and 1
      and (logo_crop->>'width')::numeric > 0 and (logo_crop->>'width')::numeric <= 1
      and (logo_crop->>'height')::numeric > 0 and (logo_crop->>'height')::numeric <= 1
      and (logo_crop->>'x')::numeric + (logo_crop->>'width')::numeric <= 1.000001
      and (logo_crop->>'y')::numeric + (logo_crop->>'height')::numeric <= 1.000001
    ), false)
  );

-- Keep the original private bucket and its existing read/delete admin checks.
update storage.buckets set public = false where id = 'marketing-photo-sources';
drop policy marketing_photo_sources_admin_insert on storage.objects;
create policy marketing_photo_sources_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'marketing-photo-sources'
    and public.is_admin()
    and split_part(name, '/', 1) in (
      'publications', 'competitions', 'testimonials', 'who-we-are',
      'competition-recognitions', 'trusted-partners'
    )
    and name !~ '(^|/)\.\.(/|$)'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  );

-- RLS still restricts mutations to admins. Never grant public access to source/crop columns.
grant insert (logo_source_path, logo_crop), update (logo_source_path, logo_crop)
  on public.competition_recognitions to authenticated;
grant insert (logo_source_path, logo_crop), update (logo_source_path, logo_crop)
  on public.trusted_partners to authenticated;
revoke select on public.competition_recognitions, public.trusted_partners from anon, authenticated;
grant select (id, competition_name, logo_path, display_order, is_active, created_at, updated_at)
  on public.competition_recognitions to anon, authenticated;
grant select (id, organization_name, logo_path, display_order, is_active, created_at, updated_at)
  on public.trusted_partners to anon, authenticated;

create function public.admin_list_competition_recognitions()
returns setof public.competition_recognitions
language sql stable security definer set search_path = '' as $$
  select recognition.* from public.competition_recognitions recognition
  where public.is_admin()
  order by recognition.display_order, recognition.created_at, recognition.id;
$$;

create function public.admin_list_trusted_partners()
returns setof public.trusted_partners
language sql stable security definer set search_path = '' as $$
  select partner.* from public.trusted_partners partner
  where public.is_admin()
  order by partner.display_order, partner.created_at, partner.id;
$$;

revoke all on function public.admin_list_competition_recognitions() from public, anon, authenticated;
revoke all on function public.admin_list_trusted_partners() from public, anon, authenticated;
grant execute on function public.admin_list_competition_recognitions() to authenticated;
grant execute on function public.admin_list_trusted_partners() to authenticated;

comment on column public.competition_recognitions.logo_source_path is 'Admin-only private original; null identifies a legacy derivative-only logo.';
comment on column public.trusted_partners.logo_source_path is 'Admin-only private original; null identifies a legacy derivative-only logo.';
comment on column public.competition_recognitions.logo_crop is 'Admin-only normalized x/y/width/height crop in source-image coordinates.';
comment on column public.trusted_partners.logo_crop is 'Admin-only normalized x/y/width/height crop in source-image coordinates.';
