-- Product / Catalog Master. Private and Intensive seed values are copied
-- verbatim from the owner-supplied guidebooks; no demo product is seeded.

create type public.catalog_product_type as enum ('private_mentoring', 'intensive_mentoring', 'big_class', 'digital_product');
create type public.catalog_lifecycle_status as enum ('draft', 'published', 'archived');
create type public.catalog_purchase_flow as enum ('consultation_offer', 'direct_checkout');
create type public.catalog_pricing_mode as enum ('fixed', 'quotation_required');
create type public.catalog_commercial_item_kind as enum ('offering', 'add_on', 'bundle');
create type public.catalog_digital_content_type as enum ('pdf', 'video');
create type public.catalog_delivery_option_kind as enum ('learning_path', 'focus_topic');
create type public.catalog_intensive_scope as enum ('national_fixed', 'international_custom');

create table public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  product_type public.catalog_product_type not null,
  status public.catalog_lifecycle_status not null default 'draft',
  default_purchase_flow public.catalog_purchase_flow not null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  short_description text not null check (char_length(btrim(short_description)) between 1 and 500),
  description text check (description is null or char_length(btrim(description)) between 1 and 5000),
  is_public boolean not null default false,
  is_featured boolean not null default false,
  sort_order integer not null default 0 check (sort_order between -100000 and 100000),
  published_at timestamptz, archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, product_type),
  check (
    (product_type in ('private_mentoring', 'intensive_mentoring') and default_purchase_flow = 'consultation_offer')
    or (product_type = 'digital_product' and default_purchase_flow = 'direct_checkout')
    or product_type = 'big_class'
  )
);

create table public.catalog_commercial_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.catalog_products(id) on delete restrict,
  code text not null check (code ~ '^[a-z][a-z0-9_]*$'),
  kind public.catalog_commercial_item_kind not null,
  status public.catalog_lifecycle_status not null default 'draft',
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text check (description is null or char_length(btrim(description)) between 1 and 5000),
  pricing_mode public.catalog_pricing_mode,
  price_amount bigint, reference_price_amount bigint,
  currency_code text not null default 'IDR' check (currency_code = 'IDR'),
  is_sellable boolean not null default true,
  sort_order integer not null default 0 check (sort_order between -100000 and 100000),
  published_at timestamptz, archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (product_id, code), unique (id, product_id), unique (id, product_id, kind),
  check (
    (pricing_mode is null and status = 'draft' and price_amount is null and reference_price_amount is null)
    or (pricing_mode = 'fixed' and price_amount is not null and price_amount >= 0
      and (reference_price_amount is null or reference_price_amount >= price_amount))
    or (pricing_mode = 'quotation_required' and price_amount is null and reference_price_amount is null)
  )
);

create table public.catalog_offerings (
  id uuid primary key, product_id uuid not null,
  kind public.catalog_commercial_item_kind not null default 'offering' check (kind = 'offering'),
  foreign key (id, product_id, kind) references public.catalog_commercial_items(id, product_id, kind) on delete cascade,
  unique (id, product_id)
);
create table public.catalog_add_ons (
  id uuid primary key, product_id uuid not null,
  kind public.catalog_commercial_item_kind not null default 'add_on' check (kind = 'add_on'),
  is_conditional boolean not null default false,
  public_condition_summary text check (public_condition_summary is null or char_length(public_condition_summary) <= 1000),
  foreign key (id, product_id, kind) references public.catalog_commercial_items(id, product_id, kind) on delete cascade,
  unique (id, product_id)
);
create table public.catalog_bundles (
  id uuid primary key, product_id uuid not null,
  kind public.catalog_commercial_item_kind not null default 'bundle' check (kind = 'bundle'),
  is_conditional boolean not null default false,
  public_condition_summary text check (public_condition_summary is null or char_length(public_condition_summary) <= 1000),
  foreign key (id, product_id, kind) references public.catalog_commercial_items(id, product_id, kind) on delete cascade,
  unique (id, product_id)
);

create table public.catalog_private_mentoring_details (
  product_id uuid primary key,
  product_type public.catalog_product_type not null default 'private_mentoring' check (product_type = 'private_mentoring'),
  session_duration_minutes integer not null check (session_duration_minutes > 0),
  min_participants integer not null check (min_participants > 0),
  max_participants integer not null check (max_participants >= min_participants),
  foreign key (product_id, product_type) references public.catalog_products(id, product_type) on delete cascade
);
create table public.catalog_mentor_tiers (
  id uuid primary key default gen_random_uuid(), product_id uuid not null,
  product_type public.catalog_product_type not null default 'private_mentoring' check (product_type = 'private_mentoring'),
  code text not null check (code ~ '^[a-z][a-z0-9_]*$'),
  label text not null check (char_length(btrim(label)) between 1 and 160),
  description text, status public.catalog_lifecycle_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (product_id, product_type) references public.catalog_products(id, product_type) on delete cascade,
  unique (product_id, code), unique (id, product_id)
);
create table public.catalog_session_packages (
  id uuid primary key default gen_random_uuid(), product_id uuid not null,
  product_type public.catalog_product_type not null default 'private_mentoring' check (product_type = 'private_mentoring'),
  code text not null check (code ~ '^[a-z][a-z0-9_]*$'),
  label text not null check (char_length(btrim(label)) between 1 and 160),
  session_count integer not null check (session_count > 0),
  status public.catalog_lifecycle_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (product_id, product_type) references public.catalog_products(id, product_type) on delete cascade,
  unique (product_id, code), unique (product_id, session_count), unique (id, product_id)
);
create table public.catalog_private_offering_configs (
  id uuid primary key, product_id uuid not null, mentor_tier_id uuid not null, session_package_id uuid not null,
  per_session_price_amount bigint not null check (per_session_price_amount >= 0),
  foreign key (id, product_id) references public.catalog_offerings(id, product_id) on delete cascade,
  foreign key (mentor_tier_id, product_id) references public.catalog_mentor_tiers(id, product_id) on delete restrict,
  foreign key (session_package_id, product_id) references public.catalog_session_packages(id, product_id) on delete restrict,
  unique (product_id, mentor_tier_id, session_package_id)
);
create table public.catalog_intensive_offering_configs (
  id uuid primary key, product_id uuid not null,
  product_type public.catalog_product_type not null default 'intensive_mentoring' check (product_type = 'intensive_mentoring'),
  scope public.catalog_intensive_scope not null,
  sessions_per_month integer check (sessions_per_month is null or sessions_per_month > 0),
  foreign key (id, product_id) references public.catalog_offerings(id, product_id) on delete cascade,
  foreign key (product_id, product_type) references public.catalog_products(id, product_type) on delete cascade,
  check ((scope = 'national_fixed' and sessions_per_month is not null) or (scope = 'international_custom' and sessions_per_month is null))
);
create table public.catalog_digital_product_details (
  product_id uuid primary key,
  product_type public.catalog_product_type not null default 'digital_product' check (product_type = 'digital_product'),
  content_type public.catalog_digital_content_type not null,
  foreign key (product_id, product_type) references public.catalog_products(id, product_type) on delete cascade
);
create table public.catalog_delivery_options (
  id uuid primary key default gen_random_uuid(), product_id uuid not null,
  product_type public.catalog_product_type not null default 'private_mentoring' check (product_type = 'private_mentoring'),
  kind public.catalog_delivery_option_kind not null, code text not null check (code ~ '^[a-z][a-z0-9_]*$'),
  label text not null check (char_length(btrim(label)) between 1 and 160),
  allows_custom_value boolean not null default false,
  status public.catalog_lifecycle_status not null default 'draft', sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (product_id, product_type) references public.catalog_products(id, product_type) on delete cascade,
  unique (product_id, code), unique (id, product_id)
);
create table public.catalog_benefits (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.catalog_products(id) on delete cascade,
  code text not null check (code ~ '^[a-z][a-z0-9_]*$'),
  label text not null check (char_length(btrim(label)) between 1 and 160),
  description text, status public.catalog_lifecycle_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (product_id, code), unique (id, product_id)
);
create table public.catalog_offering_benefits (
  product_id uuid not null, offering_id uuid not null, benefit_id uuid not null,
  primary key (offering_id, benefit_id),
  foreign key (offering_id, product_id) references public.catalog_offerings(id, product_id) on delete cascade,
  foreign key (benefit_id, product_id) references public.catalog_benefits(id, product_id) on delete restrict
);
create table public.catalog_add_on_applicability (
  product_id uuid not null, add_on_id uuid not null, offering_id uuid not null,
  primary key (add_on_id, offering_id),
  foreign key (add_on_id, product_id) references public.catalog_add_ons(id, product_id) on delete cascade,
  foreign key (offering_id, product_id) references public.catalog_offerings(id, product_id) on delete cascade
);
create table public.catalog_bundle_offerings (
  product_id uuid not null, bundle_id uuid not null, offering_id uuid not null,
  quantity integer not null default 1 check (quantity > 0), primary key (bundle_id, offering_id),
  foreign key (bundle_id, product_id) references public.catalog_bundles(id, product_id) on delete cascade,
  foreign key (offering_id, product_id) references public.catalog_offerings(id, product_id) on delete restrict
);
create table public.catalog_bundle_add_ons (
  product_id uuid not null, bundle_id uuid not null, add_on_id uuid not null,
  quantity integer not null default 1 check (quantity > 0), primary key (bundle_id, add_on_id),
  foreign key (bundle_id, product_id) references public.catalog_bundles(id, product_id) on delete cascade,
  foreign key (add_on_id, product_id) references public.catalog_add_ons(id, product_id) on delete restrict
);
create table public.catalog_bundle_benefits (
  product_id uuid not null, bundle_id uuid not null, benefit_id uuid not null,
  quantity integer not null default 1 check (quantity > 0), primary key (bundle_id, benefit_id),
  foreign key (bundle_id, product_id) references public.catalog_bundles(id, product_id) on delete cascade,
  foreign key (benefit_id, product_id) references public.catalog_benefits(id, product_id) on delete restrict
);

create index catalog_products_public_order on public.catalog_products (sort_order, title, id) where status = 'published' and is_public;
create index catalog_items_product_order on public.catalog_commercial_items (product_id, kind, sort_order, title, id);
create index catalog_delivery_product_order on public.catalog_delivery_options (product_id, kind, sort_order, label, id);
create index catalog_benefits_product_order on public.catalog_benefits (product_id, sort_order, label, id);

create function public.catalog_set_audit_fields() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := now(); new.updated_by := auth.uid();
  if tg_op = 'INSERT' then new.created_by := auth.uid(); end if;
  return new;
end $$;
create trigger catalog_products_audit before insert or update on public.catalog_products for each row execute function public.catalog_set_audit_fields();
create trigger catalog_items_audit before insert or update on public.catalog_commercial_items for each row execute function public.catalog_set_audit_fields();
create trigger catalog_mentor_tiers_touch before update on public.catalog_mentor_tiers for each row execute function public.touch_updated_at();
create trigger catalog_session_packages_touch before update on public.catalog_session_packages for each row execute function public.touch_updated_at();
create trigger catalog_delivery_options_touch before update on public.catalog_delivery_options for each row execute function public.touch_updated_at();
create trigger catalog_benefits_touch before update on public.catalog_benefits for each row execute function public.touch_updated_at();

create function public.catalog_protect_identity() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_table_name = 'catalog_products' then
    if new.id <> old.id or new.code <> old.code or new.product_type <> old.product_type then
      raise exception 'Stable product identity cannot be changed' using errcode = '22023';
    end if;
  elsif new.id <> old.id or new.product_id <> old.product_id or new.code <> old.code or new.kind <> old.kind then
    raise exception 'Stable commercial identity cannot be changed' using errcode = '22023';
  end if;
  if old.status = 'archived' and new is distinct from old then
    raise exception 'Archived catalog identity is immutable' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger catalog_products_identity before update on public.catalog_products for each row execute function public.catalog_protect_identity();
create trigger catalog_items_identity before update on public.catalog_commercial_items for each row execute function public.catalog_protect_identity();

create function public.catalog_require_draft_composition() returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_item uuid; v_status public.catalog_lifecycle_status;
begin
  if tg_table_name in ('catalog_bundle_offerings', 'catalog_bundle_add_ons', 'catalog_bundle_benefits') then
    v_item := case when tg_op = 'DELETE' then old.bundle_id else new.bundle_id end;
  elsif tg_table_name = 'catalog_add_on_applicability' then
    v_item := case when tg_op = 'DELETE' then old.add_on_id else new.add_on_id end;
  else
    v_item := case when tg_op = 'DELETE' then old.offering_id else new.offering_id end;
  end if;
  select status into v_status from public.catalog_commercial_items where id = v_item;
  if v_status is distinct from 'draft' then
    raise exception 'Create a new draft commercial identity to change structure' using errcode = '22023';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger catalog_offering_benefits_draft before insert or update or delete on public.catalog_offering_benefits for each row execute function public.catalog_require_draft_composition();
create trigger catalog_add_on_applicability_draft before insert or update or delete on public.catalog_add_on_applicability for each row execute function public.catalog_require_draft_composition();
create trigger catalog_bundle_offerings_draft before insert or update or delete on public.catalog_bundle_offerings for each row execute function public.catalog_require_draft_composition();
create trigger catalog_bundle_add_ons_draft before insert or update or delete on public.catalog_bundle_add_ons for each row execute function public.catalog_require_draft_composition();
create trigger catalog_bundle_benefits_draft before insert or update or delete on public.catalog_bundle_benefits for each row execute function public.catalog_require_draft_composition();

create function public.catalog_validate_commercial_item(p_item_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_item public.catalog_commercial_items; v_type public.catalog_product_type;
begin
  select * into v_item from public.catalog_commercial_items where id = p_item_id;
  if not found then raise exception 'Catalog item not found' using errcode = '22023'; end if;
  select product_type into v_type from public.catalog_products where id = v_item.product_id and status <> 'archived';
  if not found then raise exception 'Active parent product required' using errcode = '22023'; end if;
  if v_item.pricing_mode is null then raise exception 'Published item requires pricing mode' using errcode = '22023'; end if;
  if v_item.kind = 'offering' then
    if not exists (select 1 from public.catalog_offerings where id = v_item.id) then raise exception 'Offering subtype required' using errcode = '22023'; end if;
    if v_type = 'private_mentoring' and not exists (
      select 1 from public.catalog_private_offering_configs c
      join public.catalog_mentor_tiers t on t.id = c.mentor_tier_id and t.status = 'published'
      join public.catalog_session_packages p on p.id = c.session_package_id and p.status = 'published'
      where c.id = v_item.id
    ) then raise exception 'Complete Private Mentoring configuration required' using errcode = '22023'; end if;
    if v_type = 'intensive_mentoring' then
      if not exists (select 1 from public.catalog_intensive_offering_configs where id = v_item.id) then raise exception 'Complete Intensive configuration required' using errcode = '22023'; end if;
      if exists (select 1 from public.catalog_intensive_offering_configs where id = v_item.id and
        ((scope = 'national_fixed' and v_item.pricing_mode <> 'fixed') or (scope = 'international_custom' and v_item.pricing_mode <> 'quotation_required')))
      then raise exception 'Intensive scope and pricing mode conflict' using errcode = '22023'; end if;
    end if;
    if v_type = 'digital_product' and not exists (select 1 from public.catalog_digital_product_details where product_id = v_item.product_id)
      then raise exception 'Digital content type required' using errcode = '22023'; end if;
  elsif v_item.kind = 'add_on' then
    if v_type <> 'intensive_mentoring' or v_item.pricing_mode <> 'fixed' or not exists (select 1 from public.catalog_add_ons where id = v_item.id)
      then raise exception 'Valid fixed-price Intensive add-on required' using errcode = '22023'; end if;
  else
    if v_type <> 'intensive_mentoring' or v_item.pricing_mode <> 'fixed' or not exists (select 1 from public.catalog_bundles where id = v_item.id)
      then raise exception 'Valid fixed-price Intensive bundle required' using errcode = '22023'; end if;
    if not exists (select 1 from public.catalog_bundle_offerings where bundle_id = v_item.id)
      then raise exception 'Bundle requires a base offering' using errcode = '22023'; end if;
    if exists (
      select 1 from (
        select offering_id id from public.catalog_bundle_offerings where bundle_id = v_item.id
        union all select add_on_id from public.catalog_bundle_add_ons where bundle_id = v_item.id
      ) c join public.catalog_commercial_items i on i.id = c.id where i.status <> 'published'
    ) then raise exception 'Bundle components must be published' using errcode = '22023'; end if;
  end if;
  if exists (select 1 from public.catalog_offering_benefits ob join public.catalog_benefits b on b.id = ob.benefit_id where ob.offering_id = v_item.id and b.status <> 'published')
    or exists (select 1 from public.catalog_bundle_benefits bb join public.catalog_benefits b on b.id = bb.benefit_id where bb.bundle_id = v_item.id and b.status <> 'published')
  then raise exception 'Included benefits must be published' using errcode = '22023'; end if;
end $$;

create function public.set_catalog_commercial_item_status(p_item_id uuid, p_status public.catalog_lifecycle_status) returns public.catalog_commercial_items
language plpgsql security definer set search_path = '' as $$
declare v_row public.catalog_commercial_items;
begin
  if not public.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  select * into v_row from public.catalog_commercial_items where id = p_item_id for update;
  if not found then raise exception 'Catalog item not found' using errcode = '22023'; end if;
  if v_row.status = 'archived' and p_status <> 'archived' then raise exception 'Archived identity cannot be republished' using errcode = '22023'; end if;
  if p_status = 'published' then perform public.catalog_validate_commercial_item(p_item_id); end if;
  if p_status = 'draft' and v_row.status <> 'draft' then raise exception 'Published identity cannot return to draft' using errcode = '22023'; end if;
  update public.catalog_commercial_items set status = p_status,
    published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end,
    archived_at = case when p_status = 'archived' then coalesce(archived_at, now()) else null end
  where id = p_item_id returning * into v_row;
  return v_row;
end $$;

create function public.set_catalog_product_status(p_product_id uuid, p_status public.catalog_lifecycle_status) returns public.catalog_products
language plpgsql security definer set search_path = '' as $$
declare v_row public.catalog_products;
begin
  if not public.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  select * into v_row from public.catalog_products where id = p_product_id for update;
  if not found then raise exception 'Catalog product not found' using errcode = '22023'; end if;
  if v_row.status = 'archived' and p_status <> 'archived' then raise exception 'Archived identity cannot be republished' using errcode = '22023'; end if;
  if p_status = 'draft' and v_row.status <> 'draft' then raise exception 'Published product cannot return to draft' using errcode = '22023'; end if;
  if p_status = 'published' then
    if v_row.product_type = 'private_mentoring' and not exists (select 1 from public.catalog_private_mentoring_details where product_id = p_product_id)
      then raise exception 'Private Mentoring details required' using errcode = '22023'; end if;
    if v_row.product_type = 'digital_product' and not exists (select 1 from public.catalog_digital_product_details where product_id = p_product_id)
      then raise exception 'Digital Product type required' using errcode = '22023'; end if;
    if not exists (select 1 from public.catalog_commercial_items where product_id = p_product_id and kind = 'offering' and status = 'published')
      then raise exception 'At least one published offering required' using errcode = '22023'; end if;
  end if;
  update public.catalog_products set status = p_status,
    published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end,
    archived_at = case when p_status = 'archived' then coalesce(archived_at, now()) else null end
  where id = p_product_id returning * into v_row;
  return v_row;
end $$;

create function public.create_catalog_commercial_item(
  p_product_id uuid, p_kind public.catalog_commercial_item_kind, p_code text, p_title text, p_description text,
  p_pricing_mode public.catalog_pricing_mode, p_price_amount bigint, p_reference_price_amount bigint,
  p_is_sellable boolean, p_sort_order integer, p_mentor_tier_id uuid, p_session_package_id uuid,
  p_per_session_price_amount bigint, p_intensive_scope public.catalog_intensive_scope, p_sessions_per_month integer,
  p_is_conditional boolean, p_public_condition_summary text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := gen_random_uuid(); v_type public.catalog_product_type;
begin
  if not public.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  select product_type into v_type from public.catalog_products where id = p_product_id and status <> 'archived';
  if not found then raise exception 'Active catalog product required' using errcode = '22023'; end if;
  insert into public.catalog_commercial_items (id, product_id, code, kind, title, description, pricing_mode, price_amount, reference_price_amount, is_sellable, sort_order)
  values (v_id, p_product_id, p_code, p_kind, p_title, p_description, p_pricing_mode, p_price_amount, p_reference_price_amount, coalesce(p_is_sellable, true), coalesce(p_sort_order, 0));
  if p_kind = 'offering' then
    insert into public.catalog_offerings (id, product_id) values (v_id, p_product_id);
    if v_type = 'private_mentoring' then
      if p_mentor_tier_id is null or p_session_package_id is null or p_per_session_price_amount is null then raise exception 'Private offering configuration required' using errcode = '22023'; end if;
      insert into public.catalog_private_offering_configs (id, product_id, mentor_tier_id, session_package_id, per_session_price_amount)
      values (v_id, p_product_id, p_mentor_tier_id, p_session_package_id, p_per_session_price_amount);
    elsif v_type = 'intensive_mentoring' then
      if p_intensive_scope is null then raise exception 'Intensive offering scope required' using errcode = '22023'; end if;
      insert into public.catalog_intensive_offering_configs (id, product_id, scope, sessions_per_month)
      values (v_id, p_product_id, p_intensive_scope, p_sessions_per_month);
    end if;
  elsif p_kind = 'add_on' then
    if v_type <> 'intensive_mentoring' then raise exception 'Add-ons belong to Intensive Mentoring' using errcode = '22023'; end if;
    insert into public.catalog_add_ons (id, product_id, is_conditional, public_condition_summary)
    values (v_id, p_product_id, coalesce(p_is_conditional, false), p_public_condition_summary);
  else
    if v_type <> 'intensive_mentoring' then raise exception 'Bundles belong to Intensive Mentoring' using errcode = '22023'; end if;
    insert into public.catalog_bundles (id, product_id, is_conditional, public_condition_summary)
    values (v_id, p_product_id, coalesce(p_is_conditional, false), p_public_condition_summary);
  end if;
  return v_id;
end $$;

alter table public.catalog_products enable row level security;
alter table public.catalog_commercial_items enable row level security;
alter table public.catalog_offerings enable row level security;
alter table public.catalog_add_ons enable row level security;
alter table public.catalog_bundles enable row level security;
alter table public.catalog_private_mentoring_details enable row level security;
alter table public.catalog_mentor_tiers enable row level security;
alter table public.catalog_session_packages enable row level security;
alter table public.catalog_private_offering_configs enable row level security;
alter table public.catalog_intensive_offering_configs enable row level security;
alter table public.catalog_digital_product_details enable row level security;
alter table public.catalog_delivery_options enable row level security;
alter table public.catalog_benefits enable row level security;
alter table public.catalog_offering_benefits enable row level security;
alter table public.catalog_add_on_applicability enable row level security;
alter table public.catalog_bundle_offerings enable row level security;
alter table public.catalog_bundle_add_ons enable row level security;
alter table public.catalog_bundle_benefits enable row level security;

create policy catalog_products_public_read on public.catalog_products for select to anon, authenticated using (status = 'published' and is_public);
create policy catalog_products_admin_read on public.catalog_products for select to authenticated using (public.is_admin());
create policy catalog_products_admin_insert on public.catalog_products for insert to authenticated with check (public.is_admin());
create policy catalog_products_admin_update on public.catalog_products for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy catalog_products_admin_delete on public.catalog_products for delete to authenticated using (public.is_admin() and status = 'draft');
create policy catalog_items_public_read on public.catalog_commercial_items for select to anon, authenticated using (
  status = 'published' and exists (select 1 from public.catalog_products p where p.id = product_id and p.status = 'published' and p.is_public)
);
create policy catalog_items_admin_read on public.catalog_commercial_items for select to authenticated using (public.is_admin());
create policy catalog_items_admin_insert on public.catalog_commercial_items for insert to authenticated with check (public.is_admin());
create policy catalog_items_admin_update on public.catalog_commercial_items for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy catalog_items_admin_delete on public.catalog_commercial_items for delete to authenticated using (public.is_admin() and status = 'draft');

do $$
declare t text;
begin
  foreach t in array array['catalog_offerings','catalog_add_ons','catalog_bundles','catalog_private_mentoring_details','catalog_mentor_tiers','catalog_session_packages','catalog_private_offering_configs','catalog_intensive_offering_configs','catalog_digital_product_details','catalog_delivery_options','catalog_benefits','catalog_offering_benefits','catalog_add_on_applicability','catalog_bundle_offerings','catalog_bundle_add_ons','catalog_bundle_benefits'] loop
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin_all', t);
  end loop;
end $$;

create policy catalog_offerings_public_read on public.catalog_offerings for select to anon, authenticated using (exists (select 1 from public.catalog_commercial_items i where i.id = catalog_offerings.id and i.status = 'published'));
create policy catalog_add_ons_public_read on public.catalog_add_ons for select to anon, authenticated using (exists (select 1 from public.catalog_commercial_items i where i.id = catalog_add_ons.id and i.status = 'published'));
create policy catalog_bundles_public_read on public.catalog_bundles for select to anon, authenticated using (exists (select 1 from public.catalog_commercial_items i where i.id = catalog_bundles.id and i.status = 'published'));
create policy catalog_private_details_public_read on public.catalog_private_mentoring_details for select to anon, authenticated using (exists (select 1 from public.catalog_products p where p.id = product_id and p.status = 'published' and p.is_public));
create policy catalog_tiers_public_read on public.catalog_mentor_tiers for select to anon, authenticated using (status = 'published' and exists (select 1 from public.catalog_products p where p.id = product_id and p.status = 'published' and p.is_public));
create policy catalog_packages_public_read on public.catalog_session_packages for select to anon, authenticated using (status = 'published' and exists (select 1 from public.catalog_products p where p.id = product_id and p.status = 'published' and p.is_public));
create policy catalog_private_configs_public_read on public.catalog_private_offering_configs for select to anon, authenticated using (exists (select 1 from public.catalog_commercial_items i where i.id = catalog_private_offering_configs.id and i.status = 'published'));
create policy catalog_intensive_configs_public_read on public.catalog_intensive_offering_configs for select to anon, authenticated using (exists (select 1 from public.catalog_commercial_items i where i.id = catalog_intensive_offering_configs.id and i.status = 'published'));
create policy catalog_digital_details_public_read on public.catalog_digital_product_details for select to anon, authenticated using (exists (select 1 from public.catalog_products p where p.id = product_id and p.status = 'published' and p.is_public));
create policy catalog_delivery_public_read on public.catalog_delivery_options for select to anon, authenticated using (status = 'published' and exists (select 1 from public.catalog_products p where p.id = product_id and p.status = 'published' and p.is_public));
create policy catalog_benefits_public_read on public.catalog_benefits for select to anon, authenticated using (status = 'published' and exists (select 1 from public.catalog_products p where p.id = product_id and p.status = 'published' and p.is_public));
create policy catalog_offering_benefits_public_read on public.catalog_offering_benefits for select to anon, authenticated using (exists (select 1 from public.catalog_commercial_items i where i.id = offering_id and i.status = 'published'));
create policy catalog_applicability_public_read on public.catalog_add_on_applicability for select to anon, authenticated using (exists (select 1 from public.catalog_commercial_items a where a.id = add_on_id and a.status = 'published') and exists (select 1 from public.catalog_commercial_items o where o.id = offering_id and o.status = 'published'));
create policy catalog_bundle_offerings_public_read on public.catalog_bundle_offerings for select to anon, authenticated using (exists (select 1 from public.catalog_commercial_items b where b.id = bundle_id and b.status = 'published') and exists (select 1 from public.catalog_commercial_items o where o.id = offering_id and o.status = 'published'));
create policy catalog_bundle_add_ons_public_read on public.catalog_bundle_add_ons for select to anon, authenticated using (exists (select 1 from public.catalog_commercial_items b where b.id = bundle_id and b.status = 'published') and exists (select 1 from public.catalog_commercial_items a where a.id = add_on_id and a.status = 'published'));
create policy catalog_bundle_benefits_public_read on public.catalog_bundle_benefits for select to anon, authenticated using (exists (select 1 from public.catalog_commercial_items b where b.id = bundle_id and b.status = 'published'));

revoke all on public.catalog_products, public.catalog_commercial_items, public.catalog_offerings, public.catalog_add_ons, public.catalog_bundles,
  public.catalog_private_mentoring_details, public.catalog_mentor_tiers, public.catalog_session_packages, public.catalog_private_offering_configs,
  public.catalog_intensive_offering_configs, public.catalog_digital_product_details, public.catalog_delivery_options, public.catalog_benefits,
  public.catalog_offering_benefits, public.catalog_add_on_applicability, public.catalog_bundle_offerings, public.catalog_bundle_add_ons, public.catalog_bundle_benefits
  from anon, authenticated;
grant select (id, code, slug, product_type, status, default_purchase_flow, title, short_description, description, is_public, is_featured, sort_order, published_at, archived_at, created_at, updated_at) on public.catalog_products to anon, authenticated;
grant select (id, product_id, code, kind, status, title, description, pricing_mode, price_amount, reference_price_amount, currency_code, is_sellable, sort_order, published_at, archived_at, created_at, updated_at) on public.catalog_commercial_items to anon, authenticated;
grant select on public.catalog_offerings, public.catalog_add_ons, public.catalog_bundles, public.catalog_private_mentoring_details, public.catalog_mentor_tiers,
  public.catalog_session_packages, public.catalog_private_offering_configs, public.catalog_intensive_offering_configs, public.catalog_digital_product_details,
  public.catalog_delivery_options, public.catalog_benefits, public.catalog_offering_benefits, public.catalog_add_on_applicability,
  public.catalog_bundle_offerings, public.catalog_bundle_add_ons, public.catalog_bundle_benefits to anon, authenticated;
grant insert (code, slug, product_type, default_purchase_flow, title, short_description, description, is_public, is_featured, sort_order),
  update (slug, default_purchase_flow, title, short_description, description, is_public, is_featured, sort_order), delete on public.catalog_products to authenticated;
grant insert (product_id, code, kind, title, description, pricing_mode, price_amount, reference_price_amount, is_sellable, sort_order),
  update (title, description, pricing_mode, price_amount, reference_price_amount, is_sellable, sort_order), delete on public.catalog_commercial_items to authenticated;
grant insert, update, delete on public.catalog_offerings, public.catalog_add_ons, public.catalog_bundles, public.catalog_private_mentoring_details,
  public.catalog_mentor_tiers, public.catalog_session_packages, public.catalog_private_offering_configs, public.catalog_intensive_offering_configs,
  public.catalog_digital_product_details, public.catalog_delivery_options, public.catalog_benefits, public.catalog_offering_benefits,
  public.catalog_add_on_applicability, public.catalog_bundle_offerings, public.catalog_bundle_add_ons, public.catalog_bundle_benefits to authenticated;
grant all on public.catalog_products, public.catalog_commercial_items, public.catalog_offerings, public.catalog_add_ons, public.catalog_bundles,
  public.catalog_private_mentoring_details, public.catalog_mentor_tiers, public.catalog_session_packages, public.catalog_private_offering_configs,
  public.catalog_intensive_offering_configs, public.catalog_digital_product_details, public.catalog_delivery_options, public.catalog_benefits,
  public.catalog_offering_benefits, public.catalog_add_on_applicability, public.catalog_bundle_offerings, public.catalog_bundle_add_ons, public.catalog_bundle_benefits to service_role;

create view public.public_catalog_products with (security_invoker = true, security_barrier = true) as
select id, code, slug, product_type, default_purchase_flow, title, short_description, description, is_featured, sort_order, created_at, updated_at
from public.catalog_products where status = 'published' and is_public;
create view public.public_catalog_commercial_items with (security_invoker = true, security_barrier = true) as
select i.id, i.product_id, i.code, i.kind, i.title, i.description, i.pricing_mode, i.price_amount, i.reference_price_amount, i.currency_code, i.is_sellable, i.sort_order
from public.catalog_commercial_items i join public.catalog_products p on p.id = i.product_id
where i.status = 'published' and p.status = 'published' and p.is_public;
create view public.public_catalog_private_offerings with (security_invoker = true, security_barrier = true) as
select i.id, i.product_id, c.mentor_tier_id, t.code mentor_tier_code, t.label mentor_tier_label,
  c.session_package_id, s.code session_package_code, s.label session_package_label, s.session_count,
  c.per_session_price_amount, d.session_duration_minutes, d.min_participants, d.max_participants
from public.catalog_commercial_items i
join public.catalog_private_offering_configs c on c.id = i.id
join public.catalog_mentor_tiers t on t.id = c.mentor_tier_id and t.status = 'published'
join public.catalog_session_packages s on s.id = c.session_package_id and s.status = 'published'
join public.catalog_private_mentoring_details d on d.product_id = i.product_id
join public.catalog_products p on p.id = i.product_id
where i.status = 'published' and i.kind = 'offering' and p.status = 'published' and p.is_public;
create view public.public_catalog_intensive_offerings with (security_invoker = true, security_barrier = true) as
select i.id, i.product_id, c.scope, c.sessions_per_month
from public.catalog_commercial_items i join public.catalog_intensive_offering_configs c on c.id = i.id
join public.catalog_products p on p.id = i.product_id
where i.status = 'published' and i.kind = 'offering' and p.status = 'published' and p.is_public;
create view public.public_catalog_delivery_options with (security_invoker = true, security_barrier = true) as
select d.id, d.product_id, d.kind, d.code, d.label, d.allows_custom_value, d.sort_order
from public.catalog_delivery_options d join public.catalog_products p on p.id = d.product_id
where d.status = 'published' and p.status = 'published' and p.is_public;
create view public.public_catalog_item_benefits with (security_invoker = true, security_barrier = true) as
select ob.product_id, ob.offering_id item_id, i.code item_code, b.id benefit_id, b.code benefit_code, b.label benefit_label, b.description benefit_description, b.sort_order
from public.catalog_offering_benefits ob join public.catalog_commercial_items i on i.id = ob.offering_id
join public.catalog_benefits b on b.id = ob.benefit_id join public.catalog_products p on p.id = ob.product_id
where i.status = 'published' and b.status = 'published' and p.status = 'published' and p.is_public
union all
select bb.product_id, bb.bundle_id, i.code, b.id, b.code, b.label, b.description, b.sort_order
from public.catalog_bundle_benefits bb join public.catalog_commercial_items i on i.id = bb.bundle_id
join public.catalog_benefits b on b.id = bb.benefit_id join public.catalog_products p on p.id = bb.product_id
where i.status = 'published' and b.status = 'published' and p.status = 'published' and p.is_public;
create view public.public_catalog_add_on_applicability with (security_invoker = true, security_barrier = true) as
select a.product_id, a.add_on_id, a.offering_id from public.catalog_add_on_applicability a
join public.catalog_commercial_items ai on ai.id = a.add_on_id join public.catalog_commercial_items oi on oi.id = a.offering_id
join public.catalog_products p on p.id = a.product_id
where ai.status = 'published' and oi.status = 'published' and p.status = 'published' and p.is_public;
create view public.public_catalog_bundle_components with (security_invoker = true, security_barrier = true) as
select bo.product_id, bo.bundle_id, bi.code bundle_code, 'offering'::text component_kind, oi.id component_id, oi.code component_code, oi.title component_title, bo.quantity
from public.catalog_bundle_offerings bo join public.catalog_commercial_items bi on bi.id = bo.bundle_id
join public.catalog_commercial_items oi on oi.id = bo.offering_id join public.catalog_products p on p.id = bo.product_id
where bi.status = 'published' and oi.status = 'published' and p.status = 'published' and p.is_public
union all
select ba.product_id, ba.bundle_id, bi.code, 'add_on', ai.id, ai.code, ai.title, ba.quantity
from public.catalog_bundle_add_ons ba join public.catalog_commercial_items bi on bi.id = ba.bundle_id
join public.catalog_commercial_items ai on ai.id = ba.add_on_id join public.catalog_products p on p.id = ba.product_id
where bi.status = 'published' and ai.status = 'published' and p.status = 'published' and p.is_public
union all
select bb.product_id, bb.bundle_id, bi.code, 'benefit', b.id, b.code, b.label, bb.quantity
from public.catalog_bundle_benefits bb join public.catalog_commercial_items bi on bi.id = bb.bundle_id
join public.catalog_benefits b on b.id = bb.benefit_id join public.catalog_products p on p.id = bb.product_id
where bi.status = 'published' and b.status = 'published' and p.status = 'published' and p.is_public;
create view public.public_catalog_digital_details with (security_invoker = true, security_barrier = true) as
select d.product_id, d.content_type from public.catalog_digital_product_details d join public.catalog_products p on p.id = d.product_id
where p.status = 'published' and p.is_public;
grant select on public.public_catalog_products, public.public_catalog_commercial_items, public.public_catalog_private_offerings,
  public.public_catalog_intensive_offerings, public.public_catalog_delivery_options, public.public_catalog_item_benefits,
  public.public_catalog_add_on_applicability, public.public_catalog_bundle_components, public.public_catalog_digital_details to anon, authenticated;
grant select on all tables in schema public to service_role;

revoke all on function public.catalog_set_audit_fields(), public.catalog_protect_identity(), public.catalog_require_draft_composition(),
  public.catalog_validate_commercial_item(uuid), public.set_catalog_commercial_item_status(uuid, public.catalog_lifecycle_status),
  public.set_catalog_product_status(uuid, public.catalog_lifecycle_status),
  public.create_catalog_commercial_item(uuid, public.catalog_commercial_item_kind, text, text, text, public.catalog_pricing_mode, bigint, bigint, boolean, integer, uuid, uuid, bigint, public.catalog_intensive_scope, integer, boolean, text)
  from public, anon, authenticated;
grant execute on function public.set_catalog_commercial_item_status(uuid, public.catalog_lifecycle_status),
  public.set_catalog_product_status(uuid, public.catalog_lifecycle_status),
  public.create_catalog_commercial_item(uuid, public.catalog_commercial_item_kind, text, text, text, public.catalog_pricing_mode, bigint, bigint, boolean, integer, uuid, uuid, bigint, public.catalog_intensive_scope, integer, boolean, text)
  to authenticated;

-- Authoritative guidebook bootstrap: assemble drafts relationally, then publish.
insert into public.catalog_products
  (id,code,slug,product_type,default_purchase_flow,title,short_description,description,is_public,is_featured,sort_order)
values
('71000000-0000-0000-0000-000000000001','private_mentoring','private-mentoring','private_mentoring','consultation_offer',
 'Mentoring Privat','Bimbingan fleksibel per sesi untuk kebutuhan dan target kompetisimu.',
 'Pilih topik, mentor, dan jumlah sesi sesuai kebutuhan. Setiap sesi berfokus pada satu tantangan dengan masukan praktis dan langkah lanjutan yang jelas.',true,true,10),
('71000000-0000-0000-0000-000000000002','intensive_mentoring','intensive-mentoring','intensive_mentoring','consultation_offer',
 'Mentoring Intensif','Pendampingan terstruktur dan berkelanjutan untuk persiapan kompetisi.',
 'Persiapkan kompetisi secara sistematis bersama mentor khusus, rencana belajar personal, tugas, masukan berkelanjutan, pemantauan progres, dan evaluasi akhir.',true,true,20);

insert into public.catalog_private_mentoring_details (product_id,session_duration_minutes,min_participants,max_participants)
values ('71000000-0000-0000-0000-000000000001',75,1,4);
insert into public.catalog_mentor_tiers (id,product_id,code,label,description,status,sort_order) values
('71100000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','top_student','Mentor Mahasiswa Berprestasi','Mahasiswa berprestasi yang membagikan strategi kompetisi dari pengalaman terbaru secara langsung.','published',10),
('71100000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000001','young_professional','Mentor Profesional Muda','Profesional industri yang membawa pengalaman bisnis praktis dan perspektif dunia kerja.','published',20);
insert into public.catalog_session_packages (id,product_id,code,label,session_count,status,sort_order) values
('71200000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','sessions_1','1 sesi',1,'published',10),
('71200000-0000-0000-0000-000000000003','71000000-0000-0000-0000-000000000001','sessions_3','3 sesi',3,'published',20),
('71200000-0000-0000-0000-000000000005','71000000-0000-0000-0000-000000000001','sessions_5','5 sesi',5,'published',30),
('71200000-0000-0000-0000-000000000007','71000000-0000-0000-0000-000000000001','sessions_7','7 sesi',7,'published',40),
('71200000-0000-0000-0000-000000000010','71000000-0000-0000-0000-000000000001','sessions_10','10 sesi',10,'published',50);

insert into public.catalog_commercial_items
  (id,product_id,code,kind,title,pricing_mode,price_amount,reference_price_amount,sort_order)
values
('72000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','top_student_1','offering','Mentor Mahasiswa Berprestasi · 1 sesi','fixed',300000,null,10),
('72000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000001','top_student_3','offering','Mentor Mahasiswa Berprestasi · 3 sesi','fixed',885000,950000,20),
('72000000-0000-0000-0000-000000000003','71000000-0000-0000-0000-000000000001','top_student_5','offering','Mentor Mahasiswa Berprestasi · 5 sesi','fixed',1395000,1500000,30),
('72000000-0000-0000-0000-000000000004','71000000-0000-0000-0000-000000000001','top_student_7','offering','Mentor Mahasiswa Berprestasi · 7 sesi','fixed',1890000,2100000,40),
('72000000-0000-0000-0000-000000000005','71000000-0000-0000-0000-000000000001','top_student_10','offering','Mentor Mahasiswa Berprestasi · 10 sesi','fixed',2500000,3000000,50),
('72000000-0000-0000-0000-000000000006','71000000-0000-0000-0000-000000000001','young_professional_1','offering','Mentor Profesional Muda · 1 sesi','fixed',350000,null,60),
('72000000-0000-0000-0000-000000000007','71000000-0000-0000-0000-000000000001','young_professional_3','offering','Mentor Profesional Muda · 3 sesi','fixed',1005000,1050000,70),
('72000000-0000-0000-0000-000000000008','71000000-0000-0000-0000-000000000001','young_professional_5','offering','Mentor Profesional Muda · 5 sesi','fixed',1645000,1750000,80),
('72000000-0000-0000-0000-000000000009','71000000-0000-0000-0000-000000000001','young_professional_7','offering','Mentor Profesional Muda · 7 sesi','fixed',2240000,2450000,90),
('72000000-0000-0000-0000-000000000010','71000000-0000-0000-0000-000000000001','young_professional_10','offering','Mentor Profesional Muda · 10 sesi','fixed',3000000,3500000,100);
insert into public.catalog_offerings (id,product_id)
select id,product_id from public.catalog_commercial_items where product_id='71000000-0000-0000-0000-000000000001';
insert into public.catalog_private_offering_configs
  (id,product_id,mentor_tier_id,session_package_id,per_session_price_amount)
values
('72000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','71100000-0000-0000-0000-000000000001','71200000-0000-0000-0000-000000000001',300000),
('72000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000001','71100000-0000-0000-0000-000000000001','71200000-0000-0000-0000-000000000003',285000),
('72000000-0000-0000-0000-000000000003','71000000-0000-0000-0000-000000000001','71100000-0000-0000-0000-000000000001','71200000-0000-0000-0000-000000000005',279000),
('72000000-0000-0000-0000-000000000004','71000000-0000-0000-0000-000000000001','71100000-0000-0000-0000-000000000001','71200000-0000-0000-0000-000000000007',270000),
('72000000-0000-0000-0000-000000000005','71000000-0000-0000-0000-000000000001','71100000-0000-0000-0000-000000000001','71200000-0000-0000-0000-000000000010',250000),
('72000000-0000-0000-0000-000000000006','71000000-0000-0000-0000-000000000001','71100000-0000-0000-0000-000000000002','71200000-0000-0000-0000-000000000001',350000),
('72000000-0000-0000-0000-000000000007','71000000-0000-0000-0000-000000000001','71100000-0000-0000-0000-000000000002','71200000-0000-0000-0000-000000000003',335000),
('72000000-0000-0000-0000-000000000008','71000000-0000-0000-0000-000000000001','71100000-0000-0000-0000-000000000002','71200000-0000-0000-0000-000000000005',329000),
('72000000-0000-0000-0000-000000000009','71000000-0000-0000-0000-000000000001','71100000-0000-0000-0000-000000000002','71200000-0000-0000-0000-000000000007',320000),
('72000000-0000-0000-0000-000000000010','71000000-0000-0000-0000-000000000001','71100000-0000-0000-0000-000000000002','71200000-0000-0000-0000-000000000010',300000);

insert into public.catalog_delivery_options
  (id,product_id,kind,code,label,allows_custom_value,status,sort_order)
values
('76000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','learning_path','end_to_end_learning','Belajar dari Dasar sampai Siap Tampil',false,'published',10),
('76000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000001','learning_path','competition_focused','Mentoring Fokus Kompetisi',false,'published',20),
('76000000-0000-0000-0000-000000000003','71000000-0000-0000-0000-000000000001','focus_topic','idea_problem_framing','Perumusan Ide dan Masalah',false,'published',10),
('76000000-0000-0000-0000-000000000004','71000000-0000-0000-0000-000000000001','focus_topic','business_analysis_case_structuring','Analisis Bisnis dan Penyusunan Kasus',false,'published',20),
('76000000-0000-0000-0000-000000000005','71000000-0000-0000-0000-000000000001','focus_topic','proposal_writing_storyline','Penulisan Proposal dan Alur Cerita',false,'published',30),
('76000000-0000-0000-0000-000000000006','71000000-0000-0000-0000-000000000001','focus_topic','financial_analysis_valuation','Analisis Keuangan dan Valuasi',false,'published',40),
('76000000-0000-0000-0000-000000000007','71000000-0000-0000-0000-000000000001','focus_topic','slide_deck_visual_design','Materi Presentasi dan Desain Visual',false,'published',50),
('76000000-0000-0000-0000-000000000008','71000000-0000-0000-0000-000000000001','focus_topic','pitching_presentation_skills','Keterampilan Presentasi dan Penyampaian Ide',false,'published',60),
('76000000-0000-0000-0000-000000000009','71000000-0000-0000-0000-000000000001','focus_topic','custom_topic','Topik khusus',true,'published',70);

insert into public.catalog_benefits (id,product_id,code,label,status,sort_order) values
('77000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','direct_mentor_networking','Koneksi Langsung dengan Mentor','published',10),
('77000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000001','judge_level_insight','Wawasan dari Perspektif Juri','published',20),
('77000000-0000-0000-0000-000000000003','71000000-0000-0000-0000-000000000001','competition_strategy_discussion','Diskusi Strategi Kompetisi','published',30),
('77000000-0000-0000-0000-000000000004','71000000-0000-0000-0000-000000000001','sample_deck_exposure','Referensi Contoh Materi Presentasi','published',40),
('77000000-0000-0000-0000-000000000005','71000000-0000-0000-0000-000000000001','group_discussion_5_plus','Diskusi Grup untuk Paket 5+ Sesi','published',50),
('77000000-0000-0000-0000-000000000006','71000000-0000-0000-0000-000000000001','dummy_case_mini_practice','Latihan Singkat atau Kasus Simulasi','published',60);
insert into public.catalog_offering_benefits (product_id,offering_id,benefit_id)
select '71000000-0000-0000-0000-000000000001',o.id,b.id
from public.catalog_commercial_items o cross join public.catalog_benefits b
where o.product_id='71000000-0000-0000-0000-000000000001' and b.product_id=o.product_id
  and b.code in ('direct_mentor_networking','judge_level_insight','competition_strategy_discussion','sample_deck_exposure','dummy_case_mini_practice');
insert into public.catalog_offering_benefits (product_id,offering_id,benefit_id)
select '71000000-0000-0000-0000-000000000001',c.id,'77000000-0000-0000-0000-000000000005'
from public.catalog_private_offering_configs c
join public.catalog_session_packages s on s.id=c.session_package_id where s.session_count >= 5;

insert into public.catalog_commercial_items
  (id,product_id,code,kind,title,pricing_mode,price_amount,reference_price_amount,sort_order)
values
('73000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002','intensive_national','offering','Intensif','fixed',1150000,1400000,10),
('73000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000002','super_intensive_national','offering','Super Intensif','fixed',2200000,2800000,20),
('73000000-0000-0000-0000-000000000003','71000000-0000-0000-0000-000000000002','international_custom','offering','Kompetisi Internasional · Sepenuhnya Disesuaikan','quotation_required',null,null,30);
insert into public.catalog_offerings (id,product_id)
select id,product_id from public.catalog_commercial_items where product_id='71000000-0000-0000-0000-000000000002' and kind='offering';
insert into public.catalog_intensive_offering_configs (id,product_id,scope,sessions_per_month) values
('73000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002','national_fixed',4),
('73000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000002','national_fixed',8),
('73000000-0000-0000-0000-000000000003','71000000-0000-0000-0000-000000000002','international_custom',null);

insert into public.catalog_commercial_items (id,product_id,code,kind,title,pricing_mode,price_amount,sort_order) values
('74000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002','detailed_performance_report','add_on','Laporan Kinerja Terperinci','fixed',150000,10),
('74000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000002','mock_judging_simulation','add_on','Simulasi Penjurian','fixed',300000,20),
('74000000-0000-0000-0000-000000000003','71000000-0000-0000-0000-000000000002','win_guarantee_protection','add_on','Perlindungan Jaminan Kemenangan','fixed',500000,30);
insert into public.catalog_add_ons (id,product_id,is_conditional,public_condition_summary) values
('74000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002',false,null),
('74000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000002',false,null),
('74000000-0000-0000-0000-000000000003','71000000-0000-0000-0000-000000000002',true,'Syarat, ketentuan, dan penilaian kelayakan berlaku.');
insert into public.catalog_add_on_applicability (product_id,add_on_id,offering_id)
select '71000000-0000-0000-0000-000000000002',a.id,o.id
from public.catalog_add_ons a cross join public.catalog_offerings o
where a.product_id='71000000-0000-0000-0000-000000000002'
  and o.id in ('73000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000002');

insert into public.catalog_commercial_items (id,product_id,code,kind,title,pricing_mode,price_amount,sort_order) values
('75000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002','team_starter_bundle','bundle','Paket Rintisan Tim','fixed',1250000,10),
('75000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000002','competition_ready_bundle','bundle','Paket Siap Kompetisi','fixed',2500000,20),
('75000000-0000-0000-0000-000000000003','71000000-0000-0000-0000-000000000002','competition_assurance_bundle','bundle','Paket Jaminan Kompetisi','fixed',3000000,30);
insert into public.catalog_bundles (id,product_id,is_conditional,public_condition_summary) values
('75000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002',false,null),
('75000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000002',false,null),
('75000000-0000-0000-0000-000000000003','71000000-0000-0000-0000-000000000002',true,'Syarat, ketentuan, dan penilaian kelayakan berlaku.');

insert into public.catalog_benefits (id,product_id,code,label,status,sort_order) values
('77100000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002','dedicated_mentor','Mentor Khusus','published',10),
('77100000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000002','personalized_learning_roadmap','Rencana Belajar Personal','published',20),
('77100000-0000-0000-0000-000000000003','71000000-0000-0000-0000-000000000002','core_concepts_frameworks','Konsep Inti dan Kerangka Kerja Praktis','published',30),
('77100000-0000-0000-0000-000000000004','71000000-0000-0000-0000-000000000002','hands_on_assignments','Tugas Praktik','published',40),
('77100000-0000-0000-0000-000000000005','71000000-0000-0000-0000-000000000002','templates_winning_references','Templat dan Referensi Pemenang','published',50),
('77100000-0000-0000-0000-000000000006','71000000-0000-0000-0000-000000000002','competition_timeline','Linimasa Kompetisi','published',60),
('77100000-0000-0000-0000-000000000007','71000000-0000-0000-0000-000000000002','competition_recommendation','Rekomendasi Kompetisi','published',70),
('77100000-0000-0000-0000-000000000008','71000000-0000-0000-0000-000000000002','continuous_feedback_refinement','Masukan dan Penyempurnaan Berkelanjutan','published',80),
('77100000-0000-0000-0000-000000000009','71000000-0000-0000-0000-000000000002','progress_monitoring','Pemantauan Progres','published',90),
('77100000-0000-0000-0000-000000000010','71000000-0000-0000-0000-000000000002','final_evaluation','Evaluasi Akhir','published',100),
('77100000-0000-0000-0000-000000000011','71000000-0000-0000-0000-000000000002','competition_preparation_support','Dukungan Persiapan Kompetisi','published',110),
('77100000-0000-0000-0000-000000000012','71000000-0000-0000-0000-000000000002','final_stage_preparation_support','Dukungan Persiapan Tahap Akhir','published',120);
insert into public.catalog_offering_benefits (product_id,offering_id,benefit_id)
select '71000000-0000-0000-0000-000000000002',o.id,b.id
from public.catalog_offerings o cross join public.catalog_benefits b
where o.product_id='71000000-0000-0000-0000-000000000002' and b.product_id=o.product_id
  and b.code in ('dedicated_mentor','personalized_learning_roadmap','core_concepts_frameworks','hands_on_assignments',
    'templates_winning_references','competition_timeline','competition_recommendation','continuous_feedback_refinement',
    'progress_monitoring','final_evaluation');

insert into public.catalog_bundle_offerings (product_id,bundle_id,offering_id) values
('71000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001'),
('71000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000002','73000000-0000-0000-0000-000000000002'),
('71000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000003','73000000-0000-0000-0000-000000000002');
insert into public.catalog_bundle_add_ons (product_id,bundle_id,add_on_id) values
('71000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000001'),
('71000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000002','74000000-0000-0000-0000-000000000001'),
('71000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000002','74000000-0000-0000-0000-000000000002'),
('71000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000003','74000000-0000-0000-0000-000000000001'),
('71000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000003','74000000-0000-0000-0000-000000000002'),
('71000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000003','74000000-0000-0000-0000-000000000003');
insert into public.catalog_bundle_benefits (product_id,bundle_id,benefit_id) values
('71000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000001','77100000-0000-0000-0000-000000000002'),
('71000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000001','77100000-0000-0000-0000-000000000011'),
('71000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000002','77100000-0000-0000-0000-000000000012');

update public.catalog_commercial_items set status='published', published_at=now();
update public.catalog_products set status='published', published_at=now();
