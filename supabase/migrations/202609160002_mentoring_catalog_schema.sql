-- Domain-owned Mentoring catalog management for Private + Intensive Mentoring.
-- Business source: approved 2026 Indonesian Private/Intensive guidebooks.
-- Legal guardrail: guarantee/refund-dependent catalog rows are seeded inactive; no refund/credit promise is published here.

create table public.intensive_mentoring_packages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(btrim(code)) and code ~ '^[A-Z0-9_]+$'),
  slug text not null unique check (slug = btrim(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 160),
  description text not null check (description = btrim(description) and char_length(description) between 1 and 3000),
  competition_scope text not null check (competition_scope in ('national','international')),
  sessions_per_month integer check (sessions_per_month is null or sessions_per_month between 1 and 100),
  pricing_mode text not null check (pricing_mode in ('fixed','consultation')),
  price_amount bigint,
  reference_price_amount bigint,
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (pricing_mode = 'fixed' and price_amount is not null and price_amount > 0 and price_amount <= 9007199254740991)
    or
    (pricing_mode = 'consultation' and price_amount is null and reference_price_amount is null)
  ),
  check (reference_price_amount is null or (reference_price_amount >= price_amount and reference_price_amount <= 9007199254740991))
);

create table public.intensive_mentoring_package_features (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.intensive_mentoring_packages(id) on delete cascade,
  text text not null check (text = btrim(text) and char_length(text) between 1 and 500),
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.intensive_mentoring_add_ons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(btrim(code)) and code ~ '^[A-Z0-9_]+$'),
  slug text not null unique check (slug = btrim(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 160),
  description text not null check (description = btrim(description) and char_length(description) between 1 and 3000),
  price_amount bigint not null check (price_amount > 0 and price_amount <= 9007199254740991),
  terms_note text check (terms_note is null or char_length(btrim(terms_note)) between 1 and 1500),
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.intensive_mentoring_add_on_features (
  id uuid primary key default gen_random_uuid(),
  add_on_id uuid not null references public.intensive_mentoring_add_ons(id) on delete cascade,
  text text not null check (text = btrim(text) and char_length(text) between 1 and 500),
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.intensive_mentoring_bundles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(btrim(code)) and code ~ '^[A-Z0-9_]+$'),
  slug text not null unique check (slug = btrim(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 160),
  description text not null check (description = btrim(description) and char_length(description) between 1 and 3000),
  price_amount bigint not null check (price_amount > 0 and price_amount <= 9007199254740991),
  badge_text text check (badge_text is null or char_length(btrim(badge_text)) between 1 and 120),
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.intensive_mentoring_bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.intensive_mentoring_bundles(id) on delete cascade,
  item_type text not null check (item_type in ('package','add_on','feature')),
  package_id uuid references public.intensive_mentoring_packages(id),
  add_on_id uuid references public.intensive_mentoring_add_ons(id),
  feature_text text,
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (item_type='package' and package_id is not null and add_on_id is null and feature_text is null)
    or (item_type='add_on' and package_id is null and add_on_id is not null and feature_text is null)
    or (item_type='feature' and package_id is null and add_on_id is null and feature_text is not null and char_length(btrim(feature_text)) between 1 and 500)
  )
);

create index intensive_mentoring_packages_public_order on public.intensive_mentoring_packages (is_active, sort_order, id);
create index intensive_mentoring_package_features_parent_order on public.intensive_mentoring_package_features (package_id, is_active, sort_order, id);
create index intensive_mentoring_add_ons_public_order on public.intensive_mentoring_add_ons (is_active, sort_order, id);
create index intensive_mentoring_add_on_features_parent_order on public.intensive_mentoring_add_on_features (add_on_id, is_active, sort_order, id);
create index intensive_mentoring_bundles_public_order on public.intensive_mentoring_bundles (is_active, sort_order, id);
create index intensive_mentoring_bundle_items_parent_order on public.intensive_mentoring_bundle_items (bundle_id, is_active, sort_order, id);

create trigger intensive_mentoring_packages_touch_updated_at before update on public.intensive_mentoring_packages for each row execute function public.touch_updated_at();
create trigger intensive_mentoring_package_features_touch_updated_at before update on public.intensive_mentoring_package_features for each row execute function public.touch_updated_at();
create trigger intensive_mentoring_add_ons_touch_updated_at before update on public.intensive_mentoring_add_ons for each row execute function public.touch_updated_at();
create trigger intensive_mentoring_add_on_features_touch_updated_at before update on public.intensive_mentoring_add_on_features for each row execute function public.touch_updated_at();
create trigger intensive_mentoring_bundles_touch_updated_at before update on public.intensive_mentoring_bundles for each row execute function public.touch_updated_at();
create trigger intensive_mentoring_bundle_items_touch_updated_at before update on public.intensive_mentoring_bundle_items for each row execute function public.touch_updated_at();

alter table public.intensive_mentoring_packages enable row level security;
alter table public.intensive_mentoring_package_features enable row level security;
alter table public.intensive_mentoring_add_ons enable row level security;
alter table public.intensive_mentoring_add_on_features enable row level security;
alter table public.intensive_mentoring_bundles enable row level security;
alter table public.intensive_mentoring_bundle_items enable row level security;

create policy intensive_packages_public_read on public.intensive_mentoring_packages for select to anon, authenticated using (is_active);
create policy intensive_package_features_public_read on public.intensive_mentoring_package_features for select to anon, authenticated using (
  is_active and exists (select 1 from public.intensive_mentoring_packages p where p.id=package_id and p.is_active)
);
create policy intensive_add_ons_public_read on public.intensive_mentoring_add_ons for select to anon, authenticated using (is_active);
create policy intensive_add_on_features_public_read on public.intensive_mentoring_add_on_features for select to anon, authenticated using (
  is_active and exists (select 1 from public.intensive_mentoring_add_ons a where a.id=add_on_id and a.is_active)
);
create policy intensive_bundles_public_read on public.intensive_mentoring_bundles for select to anon, authenticated using (is_active);
create policy intensive_bundle_items_public_read on public.intensive_mentoring_bundle_items for select to anon, authenticated using (
  is_active
  and exists (select 1 from public.intensive_mentoring_bundles b where b.id=bundle_id and b.is_active)
  and (package_id is null or exists (select 1 from public.intensive_mentoring_packages p where p.id=package_id and p.is_active))
  and (add_on_id is null or exists (select 1 from public.intensive_mentoring_add_ons a where a.id=add_on_id and a.is_active))
);

create policy intensive_packages_admin_all on public.intensive_mentoring_packages for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy intensive_package_features_admin_all on public.intensive_mentoring_package_features for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy intensive_add_ons_admin_all on public.intensive_mentoring_add_ons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy intensive_add_on_features_admin_all on public.intensive_mentoring_add_on_features for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy intensive_bundles_admin_all on public.intensive_mentoring_bundles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy intensive_bundle_items_admin_all on public.intensive_mentoring_bundle_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Forward grants for CRUD on existing shared/private masters. Existing RLS still enforces admin-only mutation.
drop policy if exists competition_categories_admin_delete on public.competition_categories;
create policy competition_categories_admin_delete on public.competition_categories for delete to authenticated using (public.is_admin());
drop policy if exists private_mentoring_paths_admin_delete on public.private_mentoring_learning_paths;
create policy private_mentoring_paths_admin_delete on public.private_mentoring_learning_paths for delete to authenticated using (public.is_admin());
drop policy if exists private_mentoring_focuses_admin_delete on public.private_mentoring_session_focuses;
create policy private_mentoring_focuses_admin_delete on public.private_mentoring_session_focuses for delete to authenticated using (public.is_admin());

grant delete on public.competition_categories, public.private_mentoring_learning_paths, public.private_mentoring_session_focuses to authenticated;

revoke all on public.intensive_mentoring_packages, public.intensive_mentoring_package_features,
  public.intensive_mentoring_add_ons, public.intensive_mentoring_add_on_features,
  public.intensive_mentoring_bundles, public.intensive_mentoring_bundle_items from anon, authenticated;
grant select on public.intensive_mentoring_packages, public.intensive_mentoring_package_features,
  public.intensive_mentoring_add_ons, public.intensive_mentoring_add_on_features,
  public.intensive_mentoring_bundles, public.intensive_mentoring_bundle_items to anon, authenticated;
grant insert, update, delete on public.intensive_mentoring_packages, public.intensive_mentoring_package_features,
  public.intensive_mentoring_add_ons, public.intensive_mentoring_add_on_features,
  public.intensive_mentoring_bundles, public.intensive_mentoring_bundle_items to authenticated;
grant all on public.intensive_mentoring_packages, public.intensive_mentoring_package_features,
  public.intensive_mentoring_add_ons, public.intensive_mentoring_add_on_features,
  public.intensive_mentoring_bundles, public.intensive_mentoring_bundle_items to service_role;
