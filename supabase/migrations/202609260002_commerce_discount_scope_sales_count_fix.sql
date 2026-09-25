-- Correct Digital Product discount scope, paid-only sales proof, and redemption lifecycle.
-- Forward-only follow-up to 202609260001_commerce_discounts_sales_counts.sql.

alter table public.commerce_discount_codes
  add column scope text not null default 'digital_products';

alter table public.commerce_discount_codes
  add constraint commerce_discount_codes_scope_check
  check (scope in ('digital_products', 'selected_digital_products'));

create table public.commerce_discount_code_products (
  discount_code_id uuid not null references public.commerce_discount_codes(id) on delete cascade,
  product_id uuid not null references public.digital_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (discount_code_id, product_id)
);

alter table public.commerce_discount_code_products enable row level security;
create policy commerce_discount_code_products_admin_read on public.commerce_discount_code_products
  for select to authenticated using (public.is_admin());
create policy commerce_discount_code_products_admin_insert on public.commerce_discount_code_products
  for insert to authenticated with check (public.is_admin());
create policy commerce_discount_code_products_admin_delete on public.commerce_discount_code_products
  for delete to authenticated using (public.is_admin());

revoke all on public.commerce_discount_code_products from anon, authenticated;
grant select, insert, delete on public.commerce_discount_code_products to authenticated;
grant all on public.commerce_discount_code_products to service_role;

alter table public.orders
  add column discount_code_id uuid references public.commerce_discount_codes(id) on delete set null;

alter table public.commerce_discount_redemptions
  add column status text not null default 'reserved',
  add column reserved_until timestamptz not null default (now() + interval '24 hours'),
  add column redeemed_at timestamptz,
  add column released_at timestamptz;

alter table public.commerce_discount_redemptions
  add constraint commerce_discount_redemptions_status_check
  check (status in ('reserved', 'redeemed', 'released'));

update public.orders o
set discount_code_id = r.discount_code_id
from public.commerce_discount_redemptions r
where r.order_id = o.id
  and o.discount_code_id is null;

update public.commerce_discount_redemptions r
set
  status = case
    when o.status = 'paid' then 'redeemed'
    when o.status in ('payment_failed', 'expired', 'cancelled') then 'released'
    else 'reserved'
  end,
  reserved_until = r.created_at + interval '24 hours',
  redeemed_at = case when o.status = 'paid' then coalesce(o.paid_at, r.created_at) else null end,
  released_at = case when o.status in ('payment_failed', 'expired', 'cancelled') then now() else null end
from public.orders o
where o.id = r.order_id;

update public.commerce_discount_codes dc
set redemption_count = (
  select count(*)::integer
  from public.commerce_discount_redemptions r
  where r.discount_code_id = dc.id and r.status = 'redeemed'
);

create or replace function public.discount_redemption_capacity_used(p_discount_code_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::bigint
  from public.commerce_discount_redemptions r
  where r.discount_code_id = p_discount_code_id
    and (
      r.status = 'redeemed'
      or (r.status = 'reserved' and r.reserved_until > now())
    );
$$;

revoke all on function public.discount_redemption_capacity_used(uuid) from public, anon, authenticated;

create or replace function public.apply_discount_code(p_cart_id uuid, p_code text)
returns table (cart_id uuid, subtotal_amount bigint, discount_amount bigint, total_amount bigint, code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.current_completed_mentee_id();
  v_cart public.carts;
  v_code public.commerce_discount_codes;
  v_subtotal bigint;
  v_eligible_subtotal bigint;
  v_discount bigint;
  v_capacity_used bigint;
begin
  select * into v_cart
  from public.carts
  where id = p_cart_id and user_id = v_uid and status = 'active'
  for update;
  if not found then raise exception 'Cart not found' using errcode = '42501'; end if;

  select * into v_code
  from public.commerce_discount_codes
  where code = upper(btrim(coalesce(p_code, '')))
  for update;
  if not found
    or not v_code.is_active
    or (v_code.starts_at is not null and now() < v_code.starts_at)
    or (v_code.ends_at is not null and now() >= v_code.ends_at)
  then
    raise exception 'Discount code is invalid or expired' using errcode = '22023';
  end if;

  if v_cart.discount_code_id = v_code.id then
    raise exception 'Discount code is already applied' using errcode = '22023';
  end if;

  select public.discount_redemption_capacity_used(v_code.id) into v_capacity_used;
  if v_code.max_redemptions is not null and v_capacity_used >= v_code.max_redemptions then
    raise exception 'Discount code has reached its redemption limit' using errcode = '22023';
  end if;

  select coalesce(sum(r.price_amount), 0)::bigint
  into v_subtotal
  from public.cart_items ci
  cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r
  where ci.cart_id = v_cart.id;

  select coalesce(sum(r.price_amount), 0)::bigint
  into v_eligible_subtotal
  from public.cart_items ci
  cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r
  where ci.cart_id = v_cart.id
    and r.item_kind = 'digital_product'
    and (
      v_code.scope = 'digital_products'
      or (
        v_code.scope = 'selected_digital_products'
        and exists (
          select 1
          from public.commerce_discount_code_products dcp
          where dcp.discount_code_id = v_code.id
            and dcp.product_id = ci.commerce_item_id
        )
      )
    );

  if v_eligible_subtotal <= 0 then
    raise exception 'Discount code is not compatible with items in this cart' using errcode = '22023';
  end if;
  if v_eligible_subtotal < v_code.minimum_subtotal_amount then
    raise exception 'Eligible Digital Product subtotal does not meet the discount minimum' using errcode = '22023';
  end if;

  v_discount := least(
    v_eligible_subtotal,
    case
      when v_code.discount_type = 'percentage'
        then floor(v_eligible_subtotal * least(v_code.discount_value, 100) / 100.0)::bigint
      else v_code.discount_value
    end
  );

  update public.carts
  set discount_code_id = v_code.id,
      discount_code_snapshot = v_code.code,
      discount_amount = v_discount
  where id = v_cart.id;

  return query
  select v_cart.id, v_subtotal, v_discount, v_subtotal - v_discount, v_code.code;
end;
$$;

create or replace function public.get_active_cart_summary()
returns table (cart_id uuid, subtotal_amount bigint, discount_amount bigint, total_amount bigint, discount_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cart public.carts;
  v_code public.commerce_discount_codes;
  v_subtotal bigint := 0;
  v_eligible_subtotal bigint := 0;
  v_discount bigint := 0;
begin
  select * into v_cart from public.get_or_create_active_cart();

  select coalesce(sum(r.price_amount), 0)::bigint
  into v_subtotal
  from public.cart_items ci
  left join lateral public.resolve_commerce_item(ci.commerce_item_id) r on true
  where ci.cart_id = v_cart.id;

  if v_cart.discount_code_id is not null then
    select * into v_code
    from public.commerce_discount_codes
    where id = v_cart.discount_code_id;

    if found
      and v_code.is_active
      and (v_code.starts_at is null or now() >= v_code.starts_at)
      and (v_code.ends_at is null or now() < v_code.ends_at)
    then
      select coalesce(sum(r.price_amount), 0)::bigint
      into v_eligible_subtotal
      from public.cart_items ci
      cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r
      where ci.cart_id = v_cart.id
        and r.item_kind = 'digital_product'
        and (
          v_code.scope = 'digital_products'
          or (
            v_code.scope = 'selected_digital_products'
            and exists (
              select 1 from public.commerce_discount_code_products dcp
              where dcp.discount_code_id = v_code.id
                and dcp.product_id = ci.commerce_item_id
            )
          )
        );

      if v_eligible_subtotal >= v_code.minimum_subtotal_amount and v_eligible_subtotal > 0 then
        v_discount := least(
          v_eligible_subtotal,
          case
            when v_code.discount_type = 'percentage'
              then floor(v_eligible_subtotal * least(v_code.discount_value, 100) / 100.0)::bigint
            else v_code.discount_value
          end
        );
      end if;
    end if;
  end if;

  return query
  select v_cart.id, v_subtotal, v_discount, v_subtotal - v_discount, v_cart.discount_code_snapshot;
end;
$$;

create or replace function public.list_public_digital_product_sales()
returns table (product_id uuid, sales_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select dp.id, count(o.id)::bigint
  from public.digital_products dp
  left join public.order_items oi
    on oi.commerce_item_id = dp.id
   and oi.item_kind_snapshot = 'digital_product'
  left join public.orders o
    on o.id = oi.order_id
   and o.status = 'paid'
  where dp.show_sales_count
  group by dp.id;
$$;

create or replace function public.create_order_from_cart(p_cart_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.current_completed_mentee_id();
  v_cart public.carts;
  v_order public.orders;
  v_code public.commerce_discount_codes;
  v_item_count integer;
  v_subtotal bigint;
  v_eligible_subtotal bigint := 0;
  v_discount bigint := 0;
  v_total bigint;
  v_capacity_used bigint;
begin
  select * into v_cart
  from public.carts
  where id = p_cart_id and user_id = v_uid
  for update;
  if not found then raise exception 'Cart not found' using errcode = '42501'; end if;

  select * into v_order
  from public.orders
  where cart_id = v_cart.id and user_id = v_uid;
  if found then return v_order; end if;

  if v_cart.status <> 'active' then raise exception 'Cart is not active' using errcode = '22023'; end if;

  perform 1 from public.cart_items where cart_id = v_cart.id for update;
  select count(*) into v_item_count from public.cart_items where cart_id = v_cart.id;
  if v_item_count = 0 then raise exception 'Cart is empty' using errcode = '22023'; end if;

  if exists (
    select 1
    from public.cart_items ci
    cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r
    where ci.cart_id = v_cart.id
      and (r.is_available is distinct from true or r.name is null or r.slug is null or r.price_amount is null)
  ) then
    raise exception 'Cart contains an unavailable item' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.cart_items ci
    join public.commerce_items registry on registry.id = ci.commerce_item_id
    join public.intensive_mentoring_custom_offers o
      on o.id = registry.id
     and registry.item_kind = 'intensive_mentoring_custom_offer'
    where ci.cart_id = v_cart.id
      and o.intended_mentee_id is distinct from v_uid
  ) then
    raise exception 'Cart contains an International custom offer for another mentee' using errcode = '42501';
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

  select coalesce(sum(r.price_amount), 0)::bigint
  into v_subtotal
  from public.cart_items ci
  cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r
  where ci.cart_id = v_cart.id;

  if v_cart.discount_code_id is not null then
    select * into v_code
    from public.commerce_discount_codes
    where id = v_cart.discount_code_id
    for update;

    if not found
      or not v_code.is_active
      or (v_code.starts_at is not null and now() < v_code.starts_at)
      or (v_code.ends_at is not null and now() >= v_code.ends_at)
    then
      raise exception 'Discount code is no longer valid' using errcode = '22023';
    end if;

    select public.discount_redemption_capacity_used(v_code.id) into v_capacity_used;
    if v_code.max_redemptions is not null and v_capacity_used >= v_code.max_redemptions then
      raise exception 'Discount code has reached its redemption limit' using errcode = '22023';
    end if;

    select coalesce(sum(r.price_amount), 0)::bigint
    into v_eligible_subtotal
    from public.cart_items ci
    cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r
    where ci.cart_id = v_cart.id
      and r.item_kind = 'digital_product'
      and (
        v_code.scope = 'digital_products'
        or (
          v_code.scope = 'selected_digital_products'
          and exists (
            select 1
            from public.commerce_discount_code_products dcp
            where dcp.discount_code_id = v_code.id
              and dcp.product_id = ci.commerce_item_id
          )
        )
      );

    if v_eligible_subtotal <= 0 then
      raise exception 'Discount code is not compatible with items in this cart' using errcode = '22023';
    end if;
    if v_eligible_subtotal < v_code.minimum_subtotal_amount then
      raise exception 'Eligible Digital Product subtotal does not meet the discount minimum' using errcode = '22023';
    end if;

    v_discount := least(
      v_eligible_subtotal,
      case
        when v_code.discount_type = 'percentage'
          then floor(v_eligible_subtotal * least(v_code.discount_value, 100) / 100.0)::bigint
        else v_code.discount_value
      end
    );
  end if;

  v_total := v_subtotal - v_discount;
  if v_total < 0 then raise exception 'Discount produced a negative total' using errcode = '22023'; end if;

  insert into public.orders (
    user_id, cart_id, discount_code_id, subtotal_amount, discount_amount,
    discount_code_snapshot, total_amount
  )
  values (
    v_uid, v_cart.id, case when v_code.id is null then null else v_code.id end,
    v_subtotal, v_discount, case when v_code.id is null then null else v_code.code end, v_total
  )
  returning * into v_order;

  insert into public.order_items (
    order_id, commerce_item_id, item_kind_snapshot, name_snapshot, slug_snapshot,
    unit_price_amount, discounted_unit_price_amount
  )
  with priced as (
    select
      ci.created_at,
      ci.id,
      ci.commerce_item_id,
      r.item_kind,
      r.name,
      r.slug,
      r.price_amount,
      (
        v_code.id is not null
        and r.item_kind = 'digital_product'
        and (
          v_code.scope = 'digital_products'
          or (
            v_code.scope = 'selected_digital_products'
            and exists (
              select 1
              from public.commerce_discount_code_products dcp
              where dcp.discount_code_id = v_code.id
                and dcp.product_id = ci.commerce_item_id
            )
          )
        )
      ) as eligible
    from public.cart_items ci
    cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r
    where ci.cart_id = v_cart.id
  ),
  allocated as (
    select
      *,
      case
        when eligible and v_discount > 0
          then floor(price_amount * v_discount / nullif(v_eligible_subtotal, 0))::bigint
        else 0
      end as allocated_discount,
      count(*) filter (where eligible) over (
        order by created_at, id rows between unbounded preceding and current row
      ) as eligible_row_no,
      count(*) filter (where eligible) over () as eligible_count
    from priced
  ),
  finalized as (
    select
      *,
      case
        when not eligible then 0
        when eligible_row_no = eligible_count then
          v_discount - coalesce(
            sum(allocated_discount) filter (where eligible) over (
              order by created_at, id rows between unbounded preceding and 1 preceding
            ),
            0
          )
        else allocated_discount
      end as final_discount
    from allocated
  )
  select
    v_order.id,
    commerce_item_id,
    item_kind,
    name,
    slug,
    price_amount,
    price_amount - final_discount
  from finalized
  order by created_at, id;

  if v_code.id is not null then
    insert into public.commerce_discount_redemptions (
      discount_code_id, order_id, user_id, discount_amount, code_snapshot,
      status, reserved_until
    )
    values (
      v_code.id, v_order.id, v_uid, v_discount, v_code.code,
      'reserved', now() + interval '24 hours'
    );
  end if;

  update public.intensive_mentoring_custom_offers o
  set status = 'converted'
  where o.status = 'active'
    and exists (
      select 1
      from public.order_items oi
      where oi.order_id = v_order.id
        and oi.commerce_item_id = o.id
        and oi.item_kind_snapshot = 'intensive_mentoring_custom_offer'
    );

  update public.carts set status = 'converted' where id = v_cart.id;
  return v_order;
end;
$$;

create or replace function public.sync_discount_redemption_from_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.discount_code_id is null then return new; end if;

  if new.status = 'paid' and old.status is distinct from new.status then
    update public.commerce_discount_redemptions
    set status = 'redeemed',
        redeemed_at = coalesce(redeemed_at, new.paid_at, now()),
        released_at = null
    where order_id = new.id;

  elsif new.status in ('payment_failed', 'expired', 'cancelled')
    and old.status is distinct from new.status
  then
    update public.commerce_discount_redemptions
    set status = 'released',
        released_at = coalesce(released_at, now())
    where order_id = new.id
      and status = 'reserved';
  end if;

  update public.commerce_discount_codes dc
  set redemption_count = (
    select count(*)::integer
    from public.commerce_discount_redemptions r
    where r.discount_code_id = dc.id and r.status = 'redeemed'
  )
  where dc.id = new.discount_code_id;

  return new;
end;
$$;

drop trigger if exists orders_sync_discount_redemption on public.orders;
create trigger orders_sync_discount_redemption
after update of status on public.orders
for each row
execute function public.sync_discount_redemption_from_order_status();

revoke all on function public.sync_discount_redemption_from_order_status() from public, anon, authenticated;

grant execute on function public.apply_discount_code(uuid, text), public.get_active_cart_summary(), public.create_order_from_cart(uuid) to authenticated;
grant execute on function public.list_public_digital_product_sales() to anon, authenticated;
