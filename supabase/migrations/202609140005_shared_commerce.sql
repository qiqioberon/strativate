-- Phase 2: public Digital Product covers and reusable shared commerce.
-- Digital Product content files and other business-domain commerce remain out of scope.

drop policy if exists digital_products_admin_read on public.digital_products;

create policy digital_products_public_read
on public.digital_products for select to anon, authenticated
using (true);

grant select on public.digital_products to anon;

update storage.buckets
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'digital-product-images';

create policy digital_product_images_public_read
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'digital-product-images'
  and split_part(name, '/', 1) = 'products'
);

create table public.commerce_items (
  id uuid primary key,
  item_kind text not null check (
    item_kind = lower(btrim(item_kind))
    and item_kind ~ '^[a-z][a-z0-9_]{2,63}$'
  ),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index commerce_items_kind_availability
  on public.commerce_items (item_kind, is_available, created_at desc, id);

create trigger commerce_items_touch_updated_at
before update on public.commerce_items
for each row execute function public.touch_updated_at();

insert into public.commerce_items (id, item_kind, is_available, created_at, updated_at)
select id, 'digital_product', true, created_at, updated_at
from public.digital_products
on conflict (id) do update set
  item_kind = excluded.item_kind,
  is_available = true;

create function public.register_digital_product_commerce_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.commerce_items (id, item_kind, is_available, created_at, updated_at)
  values (new.id, 'digital_product', true, new.created_at, new.updated_at)
  on conflict (id) do update set
    item_kind = excluded.item_kind,
    is_available = true;
  return new;
end;
$$;

create trigger digital_products_register_commerce_item
after insert on public.digital_products
for each row execute function public.register_digital_product_commerce_item();

create function public.retire_digital_product_commerce_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.commerce_items
  set is_available = false
  where id = old.id and item_kind = 'digital_product';
  return old;
end;
$$;

create trigger digital_products_retire_commerce_item
before delete on public.digital_products
for each row execute function public.retire_digital_product_commerce_item();

create function public.resolve_commerce_item(p_commerce_item_id uuid)
returns table (
  commerce_item_id uuid,
  item_kind text,
  name text,
  slug text,
  description text,
  image_path text,
  price_amount bigint,
  is_available boolean
)
language sql stable security definer set search_path = '' as $$
  select
    ci.id,
    ci.item_kind,
    case when ci.item_kind = 'digital_product' then dp.name end,
    case when ci.item_kind = 'digital_product' then dp.slug end,
    case when ci.item_kind = 'digital_product' then dp.description end,
    case when ci.item_kind = 'digital_product' then dp.image_path end,
    case when ci.item_kind = 'digital_product' then dp.price_amount end,
    ci.is_available
      and case when ci.item_kind = 'digital_product' then dp.id is not null else false end
  from public.commerce_items ci
  left join public.digital_products dp
    on ci.item_kind = 'digital_product' and dp.id = ci.id
  where ci.id = p_commerce_item_id
$$;

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'converted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index carts_one_active_per_user
  on public.carts (user_id) where status = 'active';
create index carts_user_history
  on public.carts (user_id, created_at desc, id);

create trigger carts_touch_updated_at
before update on public.carts
for each row execute function public.touch_updated_at();

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  commerce_item_id uuid not null references public.commerce_items(id),
  created_at timestamptz not null default now(),
  unique (cart_id, commerce_item_id)
);

create index cart_items_cart_order
  on public.cart_items (cart_id, created_at, id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  cart_id uuid not null unique references public.carts(id),
  status text not null default 'pending_payment' check (
    status in ('pending_payment', 'paid', 'payment_failed', 'expired', 'cancelled')
  ),
  currency_code text not null default 'IDR' check (currency_code = 'IDR'),
  total_amount bigint not null check (
    total_amount >= 0 and total_amount <= 9007199254740991
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index orders_user_history
  on public.orders (user_id, created_at desc, id);

create trigger orders_touch_updated_at
before update on public.orders
for each row execute function public.touch_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  commerce_item_id uuid not null references public.commerce_items(id),
  item_kind_snapshot text not null check (
    item_kind_snapshot = lower(btrim(item_kind_snapshot))
    and item_kind_snapshot ~ '^[a-z][a-z0-9_]{2,63}$'
  ),
  name_snapshot text not null check (
    name_snapshot = btrim(name_snapshot) and char_length(name_snapshot) between 1 and 160
  ),
  slug_snapshot text not null check (
    slug_snapshot = btrim(slug_snapshot) and char_length(slug_snapshot) between 1 and 160
  ),
  unit_price_amount bigint not null check (
    unit_price_amount >= 0 and unit_price_amount <= 9007199254740991
  ),
  created_at timestamptz not null default now(),
  unique (order_id, commerce_item_id)
);

create index order_items_order_history
  on public.order_items (order_id, created_at, id);
create index order_items_ownership_lookup
  on public.order_items (commerce_item_id, item_kind_snapshot, order_id);

create function public.prevent_order_item_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Order Item snapshots are immutable' using errcode = '42501';
end;
$$;

create trigger order_items_are_immutable
before update or delete on public.order_items
for each row execute function public.prevent_order_item_mutation();

alter table public.commerce_items enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy carts_owner_read
on public.carts for select to authenticated
using (user_id = auth.uid());

create policy cart_items_owner_read
on public.cart_items for select to authenticated
using (exists (
  select 1 from public.carts c
  where c.id = cart_id and c.user_id = auth.uid()
));

create policy orders_owner_read
on public.orders for select to authenticated
using (user_id = auth.uid());

create policy order_items_owner_read
on public.order_items for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_id and o.user_id = auth.uid()
));

revoke all on public.commerce_items, public.carts, public.cart_items, public.orders, public.order_items
from anon, authenticated;
grant select on public.carts, public.cart_items, public.orders, public.order_items to authenticated;
grant all on public.commerce_items, public.carts, public.cart_items, public.orders, public.order_items to service_role;

create function public.current_completed_mentee_id() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.profiles p
    join public.mentee_profiles mp on mp.user_id = p.id
    where p.id = v_uid
      and p.role = 'mentee'::public.app_role
      and mp.onboarding_completed_at is not null
  ) then
    raise exception 'Completed Mentee account required' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

create function public.get_or_create_active_cart() returns public.carts
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.current_completed_mentee_id();
  v_cart public.carts;
begin
  insert into public.carts (user_id)
  values (v_uid)
  on conflict (user_id) where status = 'active' do nothing;

  select * into strict v_cart
  from public.carts
  where user_id = v_uid and status = 'active'
  for update;

  return v_cart;
end;
$$;

create function public.add_cart_item(p_commerce_item_id uuid) returns public.cart_items
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.current_completed_mentee_id();
  v_cart public.carts;
  v_item record;
  v_cart_item public.cart_items;
begin
  select * into v_item
  from public.resolve_commerce_item(p_commerce_item_id);

  if not found or v_item.is_available is distinct from true
    or v_item.name is null or v_item.price_amount is null then
    raise exception 'Commerce Item is unavailable' using errcode = '22023';
  end if;

  if v_item.item_kind = 'digital_product' and exists (
    select 1
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.user_id = v_uid
      and o.status = 'paid'
      and oi.commerce_item_id = p_commerce_item_id
      and oi.item_kind_snapshot = 'digital_product'
  ) then
    raise exception 'Digital Product is already owned' using errcode = '22023';
  end if;

  v_cart := public.get_or_create_active_cart();
  insert into public.cart_items (cart_id, commerce_item_id)
  values (v_cart.id, p_commerce_item_id)
  on conflict (cart_id, commerce_item_id) do update
    set commerce_item_id = excluded.commerce_item_id
  returning * into v_cart_item;

  return v_cart_item;
end;
$$;

create function public.remove_cart_item(p_cart_item_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.current_completed_mentee_id();
begin
  delete from public.cart_items ci
  using public.carts c
  where ci.id = p_cart_item_id
    and c.id = ci.cart_id
    and c.user_id = v_uid
    and c.status = 'active';
end;
$$;

create function public.get_active_cart()
returns table (
  cart_id uuid,
  cart_item_id uuid,
  commerce_item_id uuid,
  item_kind text,
  name text,
  slug text,
  image_path text,
  price_amount bigint,
  is_available boolean,
  created_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
declare
  v_cart public.carts := public.get_or_create_active_cart();
begin
  return query
  select
    v_cart.id,
    ci.id,
    ci.commerce_item_id,
    r.item_kind,
    r.name,
    r.slug,
    r.image_path,
    r.price_amount,
    r.is_available,
    ci.created_at
  from public.cart_items ci
  cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r
  where ci.cart_id = v_cart.id
  order by ci.created_at, ci.id;
end;
$$;

create function public.create_order_from_cart(p_cart_id uuid) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.current_completed_mentee_id();
  v_cart public.carts;
  v_order public.orders;
  v_item_count integer;
  v_total bigint;
begin
  if p_cart_id is null then
    raise exception 'Cart identity is required' using errcode = '22023';
  end if;

  select * into v_cart
  from public.carts
  where id = p_cart_id and user_id = v_uid
  for update;

  if not found then
    raise exception 'Cart not found' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where cart_id = v_cart.id and user_id = v_uid;
  if found then
    return v_order;
  end if;

  if v_cart.status <> 'active' then
    raise exception 'Cart is not active' using errcode = '22023';
  end if;

  perform 1 from public.cart_items where cart_id = v_cart.id for update;
  select count(*) into v_item_count
  from public.cart_items where cart_id = v_cart.id;
  if v_item_count = 0 then
    raise exception 'Cart is empty' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.cart_items ci
    cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r
    where ci.cart_id = v_cart.id
      and (
        r.is_available is distinct from true
        or r.name is null
        or r.slug is null
        or r.price_amount is null
      )
  ) then
    raise exception 'Cart contains an unavailable item' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.cart_items ci
    cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r
    where ci.cart_id = v_cart.id
      and r.item_kind = 'digital_product'
      and exists (
        select 1
        from public.orders owned_order
        join public.order_items owned_item on owned_item.order_id = owned_order.id
        where owned_order.user_id = v_uid
          and owned_order.status = 'paid'
          and owned_item.commerce_item_id = ci.commerce_item_id
          and owned_item.item_kind_snapshot = 'digital_product'
      )
  ) then
    raise exception 'Cart contains an already-owned Digital Product' using errcode = '22023';
  end if;

  select coalesce(sum(r.price_amount), 0)::bigint into v_total
  from public.cart_items ci
  cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r
  where ci.cart_id = v_cart.id;

  insert into public.orders (user_id, cart_id, total_amount)
  values (v_uid, v_cart.id, v_total)
  returning * into v_order;

  insert into public.order_items (
    order_id,
    commerce_item_id,
    item_kind_snapshot,
    name_snapshot,
    slug_snapshot,
    unit_price_amount
  )
  select
    v_order.id,
    ci.commerce_item_id,
    r.item_kind,
    r.name,
    r.slug,
    r.price_amount
  from public.cart_items ci
  cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r
  where ci.cart_id = v_cart.id
  order by ci.created_at, ci.id;

  update public.carts set status = 'converted' where id = v_cart.id;
  return v_order;
end;
$$;

create function public.list_owned_digital_products()
returns table (
  order_item_id uuid,
  order_id uuid,
  commerce_item_id uuid,
  name_snapshot text,
  slug_snapshot text,
  unit_price_amount bigint,
  purchased_at timestamptz,
  current_image_path text
)
language sql stable security definer set search_path = '' as $$
  select
    oi.id,
    o.id,
    oi.commerce_item_id,
    oi.name_snapshot,
    oi.slug_snapshot,
    oi.unit_price_amount,
    o.paid_at,
    dp.image_path
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  left join public.digital_products dp on dp.id = oi.commerce_item_id
  where o.user_id = public.current_completed_mentee_id()
    and o.status = 'paid'
    and oi.item_kind_snapshot = 'digital_product'
  order by o.paid_at desc, oi.created_at desc, oi.id
$$;

revoke all on function public.current_completed_mentee_id() from public, anon, authenticated;
revoke all on function public.resolve_commerce_item(uuid) from public, anon, authenticated;
revoke all on function public.get_or_create_active_cart() from public, anon, authenticated;
revoke all on function public.add_cart_item(uuid) from public, anon, authenticated;
revoke all on function public.remove_cart_item(uuid) from public, anon, authenticated;
revoke all on function public.get_active_cart() from public, anon, authenticated;
revoke all on function public.create_order_from_cart(uuid) from public, anon, authenticated;
revoke all on function public.list_owned_digital_products() from public, anon, authenticated;

grant execute on function public.get_or_create_active_cart() to authenticated;
grant execute on function public.add_cart_item(uuid) to authenticated;
grant execute on function public.remove_cart_item(uuid) to authenticated;
grant execute on function public.get_active_cart() to authenticated;
grant execute on function public.create_order_from_cart(uuid) to authenticated;
grant execute on function public.list_owned_digital_products() to authenticated;

grant execute on function public.current_completed_mentee_id() to service_role;
grant execute on function public.resolve_commerce_item(uuid) to service_role;
grant execute on function public.get_or_create_active_cart() to service_role;
grant execute on function public.add_cart_item(uuid) to service_role;
grant execute on function public.remove_cart_item(uuid) to service_role;
grant execute on function public.get_active_cart() to service_role;
grant execute on function public.create_order_from_cart(uuid) to service_role;
grant execute on function public.list_owned_digital_products() to service_role;
