-- Generalize discount eligibility across Shared Commerce categories while preserving
-- the existing all/selected Digital Product behavior.

create table public.commerce_discount_code_categories (
  discount_code_id uuid not null references public.commerce_discount_codes(id) on delete cascade,
  category text not null check (category in ('digital_products', 'private_mentoring', 'intensive_mentoring')),
  created_at timestamptz not null default now(),
  primary key (discount_code_id, category)
);

insert into public.commerce_discount_code_categories (discount_code_id, category)
select id, 'digital_products'
from public.commerce_discount_codes
on conflict do nothing;

alter table public.commerce_discount_code_categories enable row level security;

create policy commerce_discount_code_categories_admin_read
on public.commerce_discount_code_categories for select to authenticated
using (public.is_admin());

create policy commerce_discount_code_categories_admin_insert
on public.commerce_discount_code_categories for insert to authenticated
with check (public.is_admin());

create policy commerce_discount_code_categories_admin_delete
on public.commerce_discount_code_categories for delete to authenticated
using (public.is_admin());

revoke all on public.commerce_discount_code_categories from anon, authenticated;
grant select, insert, delete on public.commerce_discount_code_categories to authenticated;
grant all on public.commerce_discount_code_categories to service_role;

create function public.ensure_discount_code_has_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.commerce_discount_codes where id = new.id for update;
  if not found then return new; end if;

  if not exists (
    select 1 from public.commerce_discount_code_categories
    where discount_code_id = new.id
  ) then
    raise exception 'Discount code must apply to at least one category' using errcode = '23514';
  end if;

  if new.scope = 'selected_digital_products'
    and exists (
      select 1 from public.commerce_discount_code_categories
      where discount_code_id = new.id and category = 'digital_products'
    )
    and not exists (
      select 1 from public.commerce_discount_code_products
      where discount_code_id = new.id
    )
  then
    raise exception 'Selected Digital Product discount must include at least one product' using errcode = '23514';
  end if;
  return new;
end;
$$;

create constraint trigger commerce_discount_codes_require_category
after insert or update of scope on public.commerce_discount_codes
deferrable initially deferred
for each row execute function public.ensure_discount_code_has_category();

create function public.ensure_discount_mapping_keeps_configuration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_discount_code_id uuid;
  v_code public.commerce_discount_codes;
begin
  v_discount_code_id := case when tg_op = 'DELETE' then old.discount_code_id else new.discount_code_id end;

  select * into v_code
  from public.commerce_discount_codes
  where id = v_discount_code_id
  for update;
  if not found then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if not exists (
    select 1 from public.commerce_discount_code_categories
    where discount_code_id = v_discount_code_id
  ) then
    raise exception 'Discount code must apply to at least one category' using errcode = '23514';
  end if;

  if v_code.scope = 'selected_digital_products'
    and exists (
      select 1 from public.commerce_discount_code_categories
      where discount_code_id = v_discount_code_id and category = 'digital_products'
    )
    and not exists (
      select 1 from public.commerce_discount_code_products
      where discount_code_id = v_discount_code_id
    )
  then
    raise exception 'Selected Digital Product discount must include at least one product' using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create constraint trigger commerce_discount_code_categories_validate
after insert or delete on public.commerce_discount_code_categories
deferrable initially deferred
for each row execute function public.ensure_discount_mapping_keeps_configuration();

create constraint trigger commerce_discount_code_products_validate
after insert or delete on public.commerce_discount_code_products
deferrable initially deferred
for each row execute function public.ensure_discount_mapping_keeps_configuration();

revoke all on function public.ensure_discount_code_has_category(),
  public.ensure_discount_mapping_keeps_configuration()
from public, anon, authenticated;

create or replace function public.discount_code_item_is_eligible(
  p_discount_code_id uuid,
  p_digital_scope text,
  p_item_kind text,
  p_commerce_item_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_item_kind = 'digital_product' then
      exists (
        select 1
        from public.commerce_discount_code_categories c
        where c.discount_code_id = p_discount_code_id
          and c.category = 'digital_products'
      )
      and (
        p_digital_scope = 'digital_products'
        or (
          p_digital_scope = 'selected_digital_products'
          and exists (
            select 1
            from public.commerce_discount_code_products p
            where p.discount_code_id = p_discount_code_id
              and p.product_id = p_commerce_item_id
          )
        )
      )
    when p_item_kind = 'private_mentoring' then
      exists (
        select 1
        from public.commerce_discount_code_categories c
        where c.discount_code_id = p_discount_code_id
          and c.category = 'private_mentoring'
      )
    when p_item_kind = 'intensive_mentoring'
      or p_item_kind like 'intensive\_mentoring\_%' escape '\' then
      exists (
        select 1
        from public.commerce_discount_code_categories c
        where c.discount_code_id = p_discount_code_id
          and c.category = 'intensive_mentoring'
      )
    else false
  end;
$$;

revoke all on function public.discount_code_item_is_eligible(uuid, text, text, uuid)
from public, anon, authenticated;

create or replace function public.admin_save_discount_code(
  p_discount_code_id uuid,
  p_code text,
  p_description text,
  p_discount_type text,
  p_discount_value bigint,
  p_minimum_subtotal_amount bigint,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_max_redemptions integer,
  p_scope text,
  p_is_active boolean,
  p_categories text[],
  p_product_ids uuid[]
)
returns public.commerce_discount_codes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code public.commerce_discount_codes;
  v_scope text := coalesce(p_scope, 'digital_products');
begin
  if not public.is_admin() then
    raise exception 'Admin required' using errcode = '42501';
  end if;

  if coalesce(cardinality(p_categories), 0) = 0
    or exists (
      select 1 from unnest(p_categories) category
      where category not in ('digital_products', 'private_mentoring', 'intensive_mentoring')
    )
  then
    raise exception 'Select at least one valid discount category' using errcode = '22023';
  end if;

  if not ('digital_products' = any(p_categories)) then
    v_scope := 'digital_products';
  elsif v_scope = 'selected_digital_products' and coalesce(cardinality(p_product_ids), 0) = 0 then
    raise exception 'Select at least one Digital Product' using errcode = '22023';
  end if;

  if p_discount_code_id is null then
    insert into public.commerce_discount_codes (
      code, description, discount_type, discount_value, minimum_subtotal_amount,
      starts_at, ends_at, max_redemptions, scope, is_active
    )
    values (
      upper(btrim(p_code)), nullif(btrim(coalesce(p_description, '')), ''),
      p_discount_type, p_discount_value, p_minimum_subtotal_amount,
      p_starts_at, p_ends_at, p_max_redemptions, v_scope, p_is_active
    )
    returning * into v_code;
  else
    update public.commerce_discount_codes
    set code = upper(btrim(p_code)),
        description = nullif(btrim(coalesce(p_description, '')), ''),
        discount_type = p_discount_type,
        discount_value = p_discount_value,
        minimum_subtotal_amount = p_minimum_subtotal_amount,
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        max_redemptions = p_max_redemptions,
        scope = v_scope,
        is_active = p_is_active
    where id = p_discount_code_id
    returning * into v_code;

    if not found then
      raise exception 'Discount code not found' using errcode = '22023';
    end if;
  end if;

  delete from public.commerce_discount_code_categories where discount_code_id = v_code.id;
  insert into public.commerce_discount_code_categories (discount_code_id, category)
  select v_code.id, category
  from (select distinct unnest(p_categories) as category) categories;

  delete from public.commerce_discount_code_products where discount_code_id = v_code.id;
  if 'digital_products' = any(p_categories) and v_scope = 'selected_digital_products' then
    insert into public.commerce_discount_code_products (discount_code_id, product_id)
    select v_code.id, product_id
    from (select distinct unnest(p_product_ids) as product_id) products;
  end if;

  return v_code;
end;
$$;

revoke all on function public.admin_save_discount_code(
  uuid, text, text, text, bigint, bigint, timestamptz, timestamptz,
  integer, text, boolean, text[], uuid[]
) from public, anon;
grant execute on function public.admin_save_discount_code(
  uuid, text, text, text, bigint, bigint, timestamptz, timestamptz,
  integer, text, boolean, text[], uuid[]
) to authenticated, service_role;

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

  select dc.* into v_code
  from public.commerce_discount_codes dc
  where dc.code = upper(btrim(coalesce(p_code, '')))
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
    and public.discount_code_item_is_eligible(v_code.id, v_code.scope, r.item_kind, ci.commerce_item_id);

  if v_eligible_subtotal <= 0 then
    raise exception 'Discount code is not compatible with items in this cart' using errcode = '22023';
  end if;
  if v_eligible_subtotal < v_code.minimum_subtotal_amount then
    raise exception 'Eligible item subtotal does not meet the discount minimum' using errcode = '22023';
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
        and public.discount_code_item_is_eligible(v_code.id, v_code.scope, r.item_kind, ci.commerce_item_id);

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
      and public.discount_code_item_is_eligible(v_code.id, v_code.scope, r.item_kind, ci.commerce_item_id);

    if v_eligible_subtotal <= 0 then
      raise exception 'Discount code is not compatible with items in this cart' using errcode = '22023';
    end if;
    if v_eligible_subtotal < v_code.minimum_subtotal_amount then
      raise exception 'Eligible item subtotal does not meet the discount minimum' using errcode = '22023';
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
        and public.discount_code_item_is_eligible(v_code.id, v_code.scope, r.item_kind, ci.commerce_item_id)
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
          then floor(price_amount::numeric * v_discount::numeric / nullif(v_eligible_subtotal, 0))::bigint
        else 0
      end as allocated_discount,
      case
        when eligible and v_discount > 0
          then mod(price_amount::numeric * v_discount::numeric, v_eligible_subtotal::numeric)
        else null
      end as allocation_remainder
    from priced
  ),
  ranked as (
    select
      *,
      coalesce(sum(allocated_discount) filter (where eligible) over (), 0) as base_discount_total,
      row_number() over (
        order by eligible desc, allocation_remainder desc nulls last, created_at, id
      ) as remainder_rank
    from allocated
  ),
  finalized as (
    select
      *,
      case when eligible then
        allocated_discount
        + case when remainder_rank <= v_discount - base_discount_total then 1 else 0 end
      else 0 end as final_discount
    from ranked
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

grant execute on function public.apply_discount_code(uuid, text),
  public.get_active_cart_summary(), public.create_order_from_cart(uuid)
to authenticated;
