-- Authoritative commerce discounts, immutable order snapshots, and opt-in paid sales counts.

alter table public.digital_products
  add column if not exists show_sales_count boolean not null default false;

create table public.commerce_discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(btrim(code)) and code ~ '^[A-Z0-9][A-Z0-9_-]{2,63}$'),
  description text,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value bigint not null check (discount_value > 0 and discount_value <= 100000000000),
  minimum_subtotal_amount bigint not null default 0 check (minimum_subtotal_amount >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_type <> 'percentage' or discount_value <= 100),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.commerce_discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_code_id uuid not null references public.commerce_discount_codes(id),
  order_id uuid not null unique references public.orders(id),
  user_id uuid not null references public.profiles(id),
  discount_amount bigint not null check (discount_amount >= 0),
  code_snapshot text not null,
  created_at timestamptz not null default now()
);

alter table public.carts
  add column if not exists discount_code_id uuid references public.commerce_discount_codes(id),
  add column if not exists discount_code_snapshot text,
  add column if not exists discount_amount bigint not null default 0 check (discount_amount >= 0);

alter table public.orders
  add column if not exists subtotal_amount bigint not null default 0 check (subtotal_amount >= 0),
  add column if not exists discount_amount bigint not null default 0 check (discount_amount >= 0),
  add column if not exists discount_code_snapshot text;

alter table public.order_items
  add column if not exists discounted_unit_price_amount bigint check (discounted_unit_price_amount is null or discounted_unit_price_amount >= 0);

create trigger commerce_discount_codes_touch_updated_at before update on public.commerce_discount_codes for each row execute function public.touch_updated_at();

alter table public.commerce_discount_codes enable row level security;
alter table public.commerce_discount_redemptions enable row level security;

create policy commerce_discount_codes_admin_read on public.commerce_discount_codes for select to authenticated using (public.is_admin());
create policy commerce_discount_codes_admin_insert on public.commerce_discount_codes for insert to authenticated with check (public.is_admin());
create policy commerce_discount_codes_admin_update on public.commerce_discount_codes for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy commerce_discount_codes_admin_delete on public.commerce_discount_codes for delete to authenticated using (public.is_admin());
create policy commerce_discount_redemptions_admin_read on public.commerce_discount_redemptions for select to authenticated using (public.is_admin());

revoke all on public.commerce_discount_codes, public.commerce_discount_redemptions from anon, authenticated;
grant select, insert, update, delete on public.commerce_discount_codes to authenticated;
grant select on public.commerce_discount_redemptions to authenticated;
grant all on public.commerce_discount_codes, public.commerce_discount_redemptions to service_role;
grant select (show_sales_count) on public.digital_products to anon, authenticated;

create or replace function public.apply_discount_code(p_cart_id uuid, p_code text)
returns table (cart_id uuid, subtotal_amount bigint, discount_amount bigint, total_amount bigint, code text)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.current_completed_mentee_id();
  v_cart public.carts;
  v_code public.commerce_discount_codes;
  v_subtotal bigint;
  v_discount bigint;
begin
  select * into v_cart from public.carts where id = p_cart_id and user_id = v_uid and status = 'active' for update;
  if not found then raise exception 'Cart not found' using errcode = '42501'; end if;
  select * into v_code from public.commerce_discount_codes where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found or not v_code.is_active or (v_code.starts_at is not null and now() < v_code.starts_at) or (v_code.ends_at is not null and now() >= v_code.ends_at) then
    raise exception 'Discount code is invalid or expired' using errcode = '22023';
  end if;
  if v_code.max_redemptions is not null and v_code.redemption_count >= v_code.max_redemptions then
    raise exception 'Discount code has reached its redemption limit' using errcode = '22023';
  end if;
  select coalesce(sum(r.price_amount), 0)::bigint into v_subtotal
  from public.cart_items ci cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r
  where ci.cart_id = v_cart.id;
  if v_subtotal < v_code.minimum_subtotal_amount then raise exception 'Cart subtotal does not meet the discount minimum' using errcode = '22023'; end if;
  v_discount := least(v_subtotal, case when v_code.discount_type = 'percentage' then floor(v_subtotal * least(v_code.discount_value, 100) / 100.0)::bigint else v_code.discount_value end);
  update public.carts set discount_code_id = v_code.id, discount_code_snapshot = v_code.code, discount_amount = v_discount where id = v_cart.id;
  return query select v_cart.id, v_subtotal, v_discount, v_subtotal - v_discount, v_code.code;
end;
$$;

create or replace function public.remove_discount_code(p_cart_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.carts set discount_code_id = null, discount_code_snapshot = null, discount_amount = 0
  where id = p_cart_id and user_id = public.current_completed_mentee_id() and status = 'active';
end;
$$;

create or replace function public.get_active_cart_summary()
returns table (cart_id uuid, subtotal_amount bigint, discount_amount bigint, total_amount bigint, discount_code text)
language sql security definer set search_path = '' as $$
  select c.id, coalesce(sum(r.price_amount), 0)::bigint, least(coalesce(sum(r.price_amount), 0)::bigint, c.discount_amount), coalesce(sum(r.price_amount), 0)::bigint - least(coalesce(sum(r.price_amount), 0)::bigint, c.discount_amount), c.discount_code_snapshot
  from public.get_or_create_active_cart() c
  left join public.cart_items ci on ci.cart_id = c.id
  left join lateral public.resolve_commerce_item(ci.commerce_item_id) r on true
  group by c.id, c.discount_amount, c.discount_code_snapshot;
$$;

create or replace function public.list_public_digital_product_sales()
returns table (product_id uuid, sales_count bigint)
language sql stable security definer set search_path = '' as $$
  select dp.id, count(oi.id)::bigint
  from public.digital_products dp
  left join public.order_items oi on oi.commerce_item_id = dp.id and oi.item_kind_snapshot = 'digital_product'
  left join public.orders o on o.id = oi.order_id and o.status = 'paid'
  where dp.show_sales_count
  group by dp.id;
$$;

revoke all on function public.apply_discount_code(uuid, text), public.remove_discount_code(uuid), public.get_active_cart_summary(), public.list_public_digital_product_sales() from public, anon;
grant execute on function public.apply_discount_code(uuid, text), public.remove_discount_code(uuid), public.get_active_cart_summary() to authenticated;
grant execute on function public.list_public_digital_product_sales() to anon, authenticated;

create or replace function public.create_order_from_cart(p_cart_id uuid) returns public.orders
language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid := public.current_completed_mentee_id(); v_cart public.carts; v_order public.orders; v_code public.commerce_discount_codes;
  v_item_count integer; v_subtotal bigint; v_discount bigint := 0; v_total bigint;
begin
  select * into v_cart from public.carts where id=p_cart_id and user_id=v_uid for update;
  if not found then raise exception 'Cart not found' using errcode='42501'; end if;
  select * into v_order from public.orders where cart_id=v_cart.id and user_id=v_uid;
  if found then return v_order; end if;
  if v_cart.status<>'active' then raise exception 'Cart is not active' using errcode='22023'; end if;
  perform 1 from public.cart_items where cart_id=v_cart.id for update;
  select count(*) into v_item_count from public.cart_items where cart_id=v_cart.id;
  if v_item_count=0 then raise exception 'Cart is empty' using errcode='22023'; end if;
  if exists(select 1 from public.cart_items ci cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r where ci.cart_id=v_cart.id and (r.is_available is distinct from true or r.name is null or r.slug is null or r.price_amount is null)) then raise exception 'Cart contains an unavailable item' using errcode='22023'; end if;
  if exists(select 1 from public.cart_items ci join public.commerce_items registry on registry.id=ci.commerce_item_id join public.intensive_mentoring_custom_offers o on o.id=registry.id and registry.item_kind='intensive_mentoring_custom_offer' where ci.cart_id=v_cart.id and o.intended_mentee_id is distinct from v_uid) then raise exception 'Cart contains an International custom offer for another mentee' using errcode='42501'; end if;
  if exists(select 1 from public.cart_items ci cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r where ci.cart_id=v_cart.id and r.item_kind='digital_product' and exists(select 1 from public.orders owned_order join public.order_items owned_item on owned_item.order_id=owned_order.id where owned_order.user_id=v_uid and owned_order.status='paid' and owned_item.commerce_item_id=ci.commerce_item_id and owned_item.item_kind_snapshot='digital_product')) then raise exception 'Cart contains an already-owned Digital Product' using errcode='22023'; end if;
  select coalesce(sum(r.price_amount),0)::bigint into v_subtotal from public.cart_items ci cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r where ci.cart_id=v_cart.id;
  if v_cart.discount_code_id is not null then
    select * into v_code from public.commerce_discount_codes where id=v_cart.discount_code_id for update;
    if not found or not v_code.is_active or (v_code.starts_at is not null and now() < v_code.starts_at) or (v_code.ends_at is not null and now() >= v_code.ends_at) or (v_code.max_redemptions is not null and v_code.redemption_count >= v_code.max_redemptions) or v_subtotal < v_code.minimum_subtotal_amount then
      raise exception 'Discount code is no longer valid' using errcode='22023';
    end if;
    v_discount := least(v_subtotal, case when v_code.discount_type='percentage' then floor(v_subtotal * least(v_code.discount_value,100) / 100.0)::bigint else v_code.discount_value end);
  end if;
  v_total := v_subtotal - v_discount;
  insert into public.orders(user_id,cart_id,subtotal_amount,discount_amount,discount_code_snapshot,total_amount) values(v_uid,v_cart.id,v_subtotal,v_discount,case when v_code.id is null then null else v_code.code end,v_total) returning * into v_order;
  insert into public.order_items(order_id,commerce_item_id,item_kind_snapshot,name_snapshot,slug_snapshot,unit_price_amount,discounted_unit_price_amount)
  with priced as (
    select ci.created_at,ci.id,ci.commerce_item_id,r.item_kind,r.name,r.slug,r.price_amount,
      row_number() over(order by ci.created_at,ci.id) as row_no, count(*) over() as row_count,
      floor(r.price_amount * v_discount / nullif(v_subtotal,0))::bigint as allocated_discount
    from public.cart_items ci cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r where ci.cart_id=v_cart.id
  ), allocated as (
    select *, case when row_no=row_count then v_discount-coalesce(sum(allocated_discount) over(order by created_at,id rows between unbounded preceding and 1 preceding),0) else allocated_discount end as final_discount from priced
  )
  select v_order.id,commerce_item_id,item_kind,name,slug,price_amount,price_amount-final_discount from allocated order by created_at,id;
  if v_code.id is not null then
    insert into public.commerce_discount_redemptions(discount_code_id,order_id,user_id,discount_amount,code_snapshot) values(v_code.id,v_order.id,v_uid,v_discount,v_code.code);
    update public.commerce_discount_codes set redemption_count=redemption_count+1 where id=v_code.id;
  end if;
  update public.intensive_mentoring_custom_offers o set status='converted' where o.status='active' and exists(select 1 from public.order_items oi where oi.order_id=v_order.id and oi.commerce_item_id=o.id and oi.item_kind_snapshot='intensive_mentoring_custom_offer');
  update public.carts set status='converted' where id=v_cart.id;
  return v_order;
end; $$;

grant execute on function public.create_order_from_cart(uuid) to authenticated;
