-- Admin-managed homepage testimonials and public testimonial imagery.
-- Seed content is kept in supabase/seed/marketing_testimonials.sql so production rollout can be reviewed independently.

create table public.marketing_testimonials (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 3 and 120),
  competition_name text not null check (char_length(btrim(competition_name)) between 1 and 180),
  achievement text not null check (char_length(btrim(achievement)) between 1 and 160),
  testimonial text not null check (char_length(btrim(testimonial)) between 1 and 5000),
  participant_label text check (participant_label is null or char_length(btrim(participant_label)) between 1 and 160),
  image_path text unique check (
    image_path is null or (
      char_length(image_path) between 13 and 508
      and image_path ~ '^testimonials/[A-Za-z0-9][A-Za-z0-9._/-]*$'
      and image_path !~ '(^|/)\.\.(/|$)'
    )
  ),
  alt_text text not null check (char_length(btrim(alt_text)) between 1 and 240),
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index marketing_testimonials_public_order
  on public.marketing_testimonials (sort_order, created_at, id)
  where is_published and image_path is not null;

create trigger marketing_testimonials_touch_updated_at
before update on public.marketing_testimonials
for each row execute function public.touch_updated_at();

alter table public.marketing_testimonials enable row level security;

create policy marketing_testimonials_public_read
on public.marketing_testimonials for select to anon, authenticated
using (is_published and image_path is not null);

create policy marketing_testimonials_admin_read
on public.marketing_testimonials for select to authenticated
using (public.is_admin());

create policy marketing_testimonials_admin_insert
on public.marketing_testimonials for insert to authenticated
with check (public.is_admin());

create policy marketing_testimonials_admin_update
on public.marketing_testimonials for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy marketing_testimonials_admin_delete
on public.marketing_testimonials for delete to authenticated
using (public.is_admin());

create function public.reorder_marketing_testimonials(p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_matched_count integer;
  v_total_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admin account required' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 100 then
    raise exception 'Provide a valid testimonial order' using errcode = '22023';
  end if;

  lock table public.marketing_testimonials in share row exclusive mode;
  select count(*) into v_total_count from public.marketing_testimonials;
  select count(*) into v_matched_count from public.marketing_testimonials where id = any(p_ids);

  if v_total_count <> cardinality(p_ids)
    or v_matched_count <> cardinality(p_ids)
    or v_matched_count <> (select count(distinct input_id) from unnest(p_ids) input_ids(input_id)) then
    raise exception 'Testimonial order is stale or contains missing or duplicate identities' using errcode = '22023';
  end if;

  update public.marketing_testimonials testimonial
  set sort_order = ordering.ordinality::integer
  from unnest(p_ids) with ordinality ordering(id, ordinality)
  where testimonial.id = ordering.id;
end $$;

revoke all on public.marketing_testimonials from anon, authenticated;
grant select (id, slug, competition_name, achievement, testimonial, participant_label, image_path, alt_text, sort_order, is_published, created_at, updated_at)
  on public.marketing_testimonials to anon, authenticated;
grant insert (slug, competition_name, achievement, testimonial, participant_label, image_path, alt_text, sort_order, is_published),
  update (slug, competition_name, achievement, testimonial, participant_label, image_path, alt_text, sort_order, is_published),
  delete on public.marketing_testimonials to authenticated;
grant all on public.marketing_testimonials to service_role;

revoke all on function public.reorder_marketing_testimonials(uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_marketing_testimonials(uuid[]) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketing-testimonials',
  'marketing-testimonials',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy marketing_testimonials_storage_public_read
on storage.objects for select to anon, authenticated
using (bucket_id = 'marketing-testimonials');

create policy marketing_testimonials_storage_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'marketing-testimonials'
  and split_part(name, '/', 1) = 'testimonials'
  and public.is_admin()
);

create policy marketing_testimonials_storage_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'marketing-testimonials' and public.is_admin())
with check (
  bucket_id = 'marketing-testimonials'
  and split_part(name, '/', 1) = 'testimonials'
  and public.is_admin()
);

create policy marketing_testimonials_storage_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'marketing-testimonials' and public.is_admin());
