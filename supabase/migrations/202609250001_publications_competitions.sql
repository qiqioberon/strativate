-- Stakeholder editorial CMS for public publications and competition listings.
-- The tables intentionally store only approved editorial fields; empty public states are valid.

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 3 and 120),
  title text not null check (char_length(btrim(title)) between 1 and 180),
  excerpt text not null check (char_length(btrim(excerpt)) between 1 and 500),
  body text not null check (char_length(btrim(body)) between 1 and 50000),
  cover_path text check (cover_path is null or char_length(btrim(cover_path)) between 1 and 508),
  published_at date,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 3 and 120),
  name text not null check (char_length(btrim(name)) between 1 and 180),
  category_id uuid references public.competition_categories(id) on delete set null,
  description text not null check (char_length(btrim(description)) between 1 and 5000),
  rules_url text,
  registration_url text,
  registration_deadline date,
  cover_path text check (cover_path is null or char_length(btrim(cover_path)) between 1 and 508),
  status text not null default 'upcoming' check (status in ('upcoming', 'open', 'closed', 'archived')),
  is_published boolean not null default false,
  is_featured boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index publications_public_order on public.publications (is_featured desc, sort_order, published_at desc nulls last, created_at desc) where is_published;
create index competitions_public_order on public.competitions (is_featured desc, sort_order, registration_deadline nulls last, created_at desc) where is_published;

create trigger publications_touch_updated_at before update on public.publications for each row execute function public.touch_updated_at();
create trigger competitions_touch_updated_at before update on public.competitions for each row execute function public.touch_updated_at();

alter table public.publications enable row level security;
alter table public.competitions enable row level security;

create policy publications_public_read on public.publications for select to anon, authenticated using (is_published);
create policy publications_admin_read on public.publications for select to authenticated using (public.is_admin());
create policy publications_admin_insert on public.publications for insert to authenticated with check (public.is_admin());
create policy publications_admin_update on public.publications for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy publications_admin_delete on public.publications for delete to authenticated using (public.is_admin());

create policy competitions_public_read on public.competitions for select to anon, authenticated using (is_published);
create policy competitions_admin_read on public.competitions for select to authenticated using (public.is_admin());
create policy competitions_admin_insert on public.competitions for insert to authenticated with check (public.is_admin());
create policy competitions_admin_update on public.competitions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy competitions_admin_delete on public.competitions for delete to authenticated using (public.is_admin());

revoke all on public.publications, public.competitions from anon, authenticated;
grant select on public.publications, public.competitions to anon, authenticated;
grant insert, update, delete on public.publications, public.competitions to authenticated;
grant all on public.publications, public.competitions to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketing-editorial', 'marketing-editorial', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy marketing_editorial_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'marketing-editorial');
create policy marketing_editorial_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'marketing-editorial' and public.is_admin());
create policy marketing_editorial_admin_update on storage.objects for update to authenticated using (bucket_id = 'marketing-editorial' and public.is_admin()) with check (bucket_id = 'marketing-editorial' and public.is_admin());
create policy marketing_editorial_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'marketing-editorial' and public.is_admin());
