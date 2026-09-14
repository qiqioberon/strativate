-- Complete the Digital Product domain with private paid-content delivery.
-- Existing storefront rows stay published; new rows default to draft until an admin publishes them.

alter table public.digital_products
  add column content_type text check (content_type is null or content_type in ('pdf', 'video')),
  add column content_path text check (
    content_path is null or (
      content_path = btrim(content_path)
      and char_length(content_path) between 12 and 700
      and content_path ~ '^products/[A-Za-z0-9._-]+/[A-Za-z0-9][A-Za-z0-9._-]*$'
      and position('..' in content_path) = 0
    )
  ),
  add column content_mime_type text,
  add column content_file_name text,
  add column content_size_bytes bigint check (content_size_bytes is null or content_size_bytes > 0),
  add column page_count integer check (page_count is null or page_count > 0),
  add column duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  add column is_published boolean not null default false;

-- Digital Products that were already intentionally exposed by Phase 2 keep their storefront state.
update public.digital_products set is_published = true;

-- Drafts are hidden publicly while admins retain complete read access.
drop policy if exists digital_products_public_read on public.digital_products;
create policy digital_products_public_read
on public.digital_products for select to anon, authenticated
using (is_published);

create policy digital_products_admin_read
on public.digital_products for select to authenticated
using (public.is_admin());

grant insert (content_type, content_path, content_mime_type, content_file_name, content_size_bytes, page_count, duration_seconds, is_published),
  update (content_type, content_path, content_mime_type, content_file_name, content_size_bytes, page_count, duration_seconds, is_published)
  on public.digital_products to authenticated;

-- Publication controls shared-commerce availability. Existing products stay available after the backfill above.
create or replace function public.register_digital_product_commerce_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.commerce_items (id, item_kind, is_available, created_at, updated_at)
  values (new.id, 'digital_product', new.is_published, new.created_at, new.updated_at)
  on conflict (id) do update set
    item_kind = excluded.item_kind,
    is_available = excluded.is_available;
  return new;
end;
$$;

update public.commerce_items ci
set is_available = dp.is_published
from public.digital_products dp
where ci.id = dp.id and ci.item_kind = 'digital_product';

create trigger digital_products_sync_commerce_availability
after update of is_published on public.digital_products
for each row execute function public.register_digital_product_commerce_item();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'digital-product-content',
  'digital-product-content',
  false,
  524288000,
  array['application/pdf', 'video/mp4', 'video/webm']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy digital_product_content_admin_read
on storage.objects for select to authenticated
using (
  bucket_id = 'digital-product-content'
  and split_part(name, '/', 1) = 'products'
  and public.is_admin()
);

create policy digital_product_content_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'digital-product-content'
  and split_part(name, '/', 1) = 'products'
  and public.is_admin()
);

create policy digital_product_content_admin_update
on storage.objects for update to authenticated
using (
  bucket_id = 'digital-product-content'
  and split_part(name, '/', 1) = 'products'
  and public.is_admin()
)
with check (
  bucket_id = 'digital-product-content'
  and split_part(name, '/', 1) = 'products'
  and public.is_admin()
);

create policy digital_product_content_admin_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'digital-product-content'
  and split_part(name, '/', 1) = 'products'
  and public.is_admin()
);

create table public.digital_product_access_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.digital_products(id) on delete cascade,
  order_id uuid references public.orders(id),
  order_item_id uuid references public.order_items(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  check (expires_at > created_at)
);

create index digital_product_access_sessions_user_product
  on public.digital_product_access_sessions (user_id, product_id, created_at desc);

alter table public.digital_product_access_sessions enable row level security;
revoke all on public.digital_product_access_sessions from public, anon, authenticated;
grant all on public.digital_product_access_sessions to service_role;

create function public.create_digital_product_access_session(p_product_id uuid)
returns table (
  session_id uuid,
  product_id uuid,
  content_type text,
  content_path text,
  content_mime_type text,
  content_file_name text,
  order_id uuid,
  order_item_id uuid,
  expires_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_product public.digital_products;
  v_order_id uuid;
  v_order_item_id uuid;
  v_session public.digital_product_access_sessions;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_product
  from public.digital_products dp
  where dp.id = p_product_id;

  if not found
    or v_product.content_type is null
    or v_product.content_path is null
    or v_product.content_mime_type is null then
    raise exception 'Digital Product content is unavailable' using errcode = '22023';
  end if;

  if not public.is_admin() then
    if v_product.is_published is distinct from true then
      raise exception 'Digital Product content is unavailable' using errcode = '42501';
    end if;

    select o.id, oi.id
      into v_order_id, v_order_item_id
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    join public.commerce_items ci on ci.id = oi.commerce_item_id
    where o.user_id = v_uid
      and o.status = 'paid'
      and oi.item_kind_snapshot = 'digital_product'
      and ci.item_kind = 'digital_product'
      and ci.id = p_product_id
    order by coalesce(o.paid_at, o.updated_at) desc, oi.created_at desc
    limit 1;

    if v_order_item_id is null then
      raise exception 'Paid Digital Product ownership required' using errcode = '42501';
    end if;
  end if;

  insert into public.digital_product_access_sessions (user_id, product_id, order_id, order_item_id)
  values (v_uid, v_product.id, v_order_id, v_order_item_id)
  returning * into v_session;

  return query select
    v_session.id,
    v_product.id,
    v_product.content_type,
    v_product.content_path,
    v_product.content_mime_type,
    v_product.content_file_name,
    v_order_id,
    v_order_item_id,
    v_session.expires_at;
end;
$$;

revoke all on function public.create_digital_product_access_session(uuid) from public, anon, authenticated;
grant execute on function public.create_digital_product_access_session(uuid) to authenticated, service_role;

-- Duplicate Digital Products are a domain error rather than a silent no-op. The ownership check stays server-side.
create or replace function public.add_cart_item(p_commerce_item_id uuid) returns public.cart_items
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

  if exists (
    select 1 from public.cart_items ci
    where ci.cart_id = v_cart.id and ci.commerce_item_id = p_commerce_item_id
  ) then
    raise exception 'Digital Product is already in cart' using errcode = '22023';
  end if;

  insert into public.cart_items (cart_id, commerce_item_id)
  values (v_cart.id, p_commerce_item_id)
  returning * into v_cart_item;

  return v_cart_item;
end;
$$;
