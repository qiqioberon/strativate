-- Corrective Shared Commerce reservation and source-row locking invariants.
-- Forward-only follow-up to 202610040004_shared_commerce_concurrency_hardening.sql.

create or replace function public.commerce_discount_reservation_ttl()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '60 minutes';
$$;

revoke all on function public.commerce_discount_reservation_ttl()
from public, anon, authenticated;
grant execute on function public.commerce_discount_reservation_ttl() to service_role;

alter table public.commerce_discount_redemptions
  alter column reserved_until
  set default (now() + public.commerce_discount_reservation_ttl());

-- Existing reservations are preserved, but no unpaid reservation is allowed to
-- retain the obsolete 24-hour deadline after this migration.
update public.commerce_discount_redemptions
set reserved_until = least(
  reserved_until,
  created_at + public.commerce_discount_reservation_ttl()
)
where status = 'reserved';

-- Retire already-expired discounted Orders before installing user claims. Lock
-- each Order before its Payment Attempts, matching the live payment lock order.
-- The Order transition invokes the existing release trigger; no historical row
-- is deleted or rewritten as a paid transaction.
do $$
declare
  v_order_id uuid;
begin
  for v_order_id in
    select o.id
    from public.orders o
    where o.status = 'pending_payment'
      and exists (
        select 1
        from public.commerce_discount_redemptions r
        where r.order_id = o.id
          and r.status = 'reserved'
          and r.reserved_until <= now()
      )
    order by o.id
    for update of o
  loop
    update public.payment_attempts
    set status = 'expired',
        snap_creation_claim_token = null,
        snap_creation_claimed_at = null,
        snap_creation_claim_expires_at = null
    where order_id = v_order_id
      and status in ('creating', 'pending');

    update public.orders
    set status = 'expired'
    where id = v_order_id
      and status = 'pending_payment';
  end loop;
end;
$$;

-- A successful historical use permanently spends the user/voucher pair. Retire
-- any legacy active hold for that same pair before choosing active claims.
do $$
declare
  v_order_id uuid;
begin
  for v_order_id in
    select o.id
    from public.orders o
    where o.status = 'pending_payment'
      and exists (
        select 1
        from public.commerce_discount_redemptions active
        where active.order_id = o.id
          and active.status = 'reserved'
          and active.reserved_until > now()
          and exists (
            select 1
            from public.commerce_discount_redemptions spent
            join public.orders spent_order on spent_order.id = spent.order_id
            where spent.user_id = active.user_id
              and spent.discount_code_id = active.discount_code_id
              and spent.order_id <> active.order_id
              and (spent.status = 'redeemed' or spent_order.status = 'paid')
          )
      )
    order by o.id
    for update of o
  loop
    update public.payment_attempts
    set status = 'expired',
        snap_creation_claim_token = null,
        snap_creation_claimed_at = null,
        snap_creation_claim_expires_at = null
    where order_id = v_order_id
      and status in ('creating', 'pending');

    update public.orders
    set status = 'expired'
    where id = v_order_id
      and status = 'pending_payment';
  end loop;
end;
$$;

-- Explicitly normalize legacy duplicate active holds. The oldest valid hold is
-- retained; later conflicting unpaid Orders become terminal and release quota.
do $$
declare
  v_order_id uuid;
begin
  for v_order_id in
    select o.id
    from public.orders o
    where o.status = 'pending_payment'
      and o.id in (
        select order_id
        from (
          select
            r.order_id,
            row_number() over (
              partition by r.user_id, r.discount_code_id
              order by r.created_at, r.id
            ) as row_no
          from public.commerce_discount_redemptions r
          join public.orders redemption_order on redemption_order.id = r.order_id
          where r.status = 'reserved'
            and r.reserved_until > now()
            and redemption_order.status = 'pending_payment'
        ) ranked
        where row_no > 1
      )
    order by o.id
    for update of o
  loop
    update public.payment_attempts
    set status = 'expired',
        snap_creation_claim_token = null,
        snap_creation_claimed_at = null,
        snap_creation_claim_expires_at = null
    where order_id = v_order_id
      and status in ('creating', 'pending');

    update public.orders
    set status = 'expired'
    where id = v_order_id
      and status = 'pending_payment';
  end loop;
end;
$$;

create table public.commerce_discount_user_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  discount_code_id uuid not null references public.commerce_discount_codes(id),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  status text not null check (status in ('reserved', 'redeemed')),
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  primary key (user_id, discount_code_id),
  check ((status = 'redeemed') = (redeemed_at is not null))
);

alter table public.commerce_discount_user_claims enable row level security;
revoke all on public.commerce_discount_user_claims from public, anon, authenticated;
grant all on public.commerce_discount_user_claims to service_role;

-- Multiple historical successful uses, if any, remain immutable history. A
-- single canonical redeemed claim records that the user is permanently spent.
with ranked as (
  select
    r.user_id,
    r.discount_code_id,
    r.order_id,
    coalesce(r.redeemed_at, o.paid_at, r.created_at) as redeemed_at,
    row_number() over (
      partition by r.user_id, r.discount_code_id
      order by coalesce(r.redeemed_at, o.paid_at, r.created_at), r.id
    ) as row_no
  from public.commerce_discount_redemptions r
  join public.orders o on o.id = r.order_id
  where r.status = 'redeemed' or o.status = 'paid'
)
insert into public.commerce_discount_user_claims(
  user_id, discount_code_id, order_id, status, created_at, redeemed_at
)
select user_id, discount_code_id, order_id, 'redeemed', redeemed_at, redeemed_at
from ranked
where row_no = 1;

insert into public.commerce_discount_user_claims(
  user_id, discount_code_id, order_id, status, created_at
)
select r.user_id, r.discount_code_id, r.order_id, 'reserved', r.created_at
from public.commerce_discount_redemptions r
join public.orders o on o.id = r.order_id
where r.status = 'reserved'
  and r.reserved_until > now()
  and o.status = 'pending_payment'
on conflict (user_id, discount_code_id) do nothing;

create or replace function public.lock_intensive_bundle_item_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_bundle_id uuid;
  v_new_bundle_id uuid;
begin
  if tg_op <> 'INSERT' then
    v_old_bundle_id := old.bundle_id;
  end if;
  if tg_op <> 'DELETE' then
    v_new_bundle_id := new.bundle_id;
  end if;

  perform 1
  from public.intensive_mentoring_bundles bundle
  where bundle.id in (v_old_bundle_id, v_new_bundle_id)
  order by bundle.id
  for update;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.lock_intensive_bundle_item_parent()
from public, anon, authenticated;

drop trigger if exists intensive_bundle_items_lock_parent
on public.intensive_mentoring_bundle_items;
create trigger intensive_bundle_items_lock_parent
before insert or update or delete on public.intensive_mentoring_bundle_items
for each row execute function public.lock_intensive_bundle_item_parent();

create or replace function public.lock_cart_commerce_snapshot_sources(p_cart_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Primary domain rows are locked before their registry row because admin
  -- writes acquire the source row before source->commerce synchronization.
  perform 1
  from public.digital_products source
  where source.id in (
    select ci.commerce_item_id from public.cart_items ci
    join public.commerce_items registry on registry.id = ci.commerce_item_id
    where ci.cart_id = p_cart_id and registry.item_kind = 'digital_product'
  )
  order by source.id
  for update;

  perform 1
  from public.private_mentoring_cart_link_offers source
  where source.id in (
    select ci.commerce_item_id from public.cart_items ci
    where ci.cart_id = p_cart_id
  )
  order by source.id
  for update;

  perform 1
  from public.private_mentoring_packages source
  where source.id in (
    select ci.commerce_item_id from public.cart_items ci
    join public.commerce_items registry on registry.id = ci.commerce_item_id
    where ci.cart_id = p_cart_id and registry.item_kind = 'private_mentoring'
  )
  order by source.id
  for update;

  perform 1
  from public.mentor_tiers source
  where source.id in (
    select package.mentor_tier_id
    from public.cart_items ci
    join public.private_mentoring_packages package on package.id = ci.commerce_item_id
    where ci.cart_id = p_cart_id
  )
  order by source.id
  for update;

  perform 1
  from public.intensive_mentoring_bundles source
  where source.id in (
    select ci.commerce_item_id from public.cart_items ci
    join public.commerce_items registry on registry.id = ci.commerce_item_id
    where ci.cart_id = p_cart_id and registry.item_kind = 'intensive_mentoring_bundle'
  )
  order by source.id
  for update;

  -- Lock direct and bundle-referenced rows in one sorted pass per table. The
  -- bundle lock above stabilizes composition through the parent-lock trigger.
  perform 1
  from public.intensive_mentoring_packages source
  where source.id in (
    select ci.commerce_item_id
    from public.cart_items ci
    join public.commerce_items registry on registry.id = ci.commerce_item_id
    where ci.cart_id = p_cart_id
      and registry.item_kind = 'intensive_mentoring_package'
    union
    select bi.package_id
    from public.cart_items ci
    join public.commerce_items registry on registry.id = ci.commerce_item_id
    join public.intensive_mentoring_bundle_items bi on bi.bundle_id = ci.commerce_item_id
    where ci.cart_id = p_cart_id
      and registry.item_kind = 'intensive_mentoring_bundle'
      and bi.package_id is not null
  )
  order by source.id
  for update;

  perform 1
  from public.intensive_mentoring_add_ons source
  where source.id in (
    select ci.commerce_item_id
    from public.cart_items ci
    join public.commerce_items registry on registry.id = ci.commerce_item_id
    where ci.cart_id = p_cart_id
      and registry.item_kind = 'intensive_mentoring_add_on'
    union
    select bi.add_on_id
    from public.cart_items ci
    join public.commerce_items registry on registry.id = ci.commerce_item_id
    join public.intensive_mentoring_bundle_items bi on bi.bundle_id = ci.commerce_item_id
    where ci.cart_id = p_cart_id
      and registry.item_kind = 'intensive_mentoring_bundle'
      and bi.add_on_id is not null
  )
  order by source.id
  for update;

  perform 1
  from public.intensive_mentoring_custom_offers source
  where source.id in (
    select ci.commerce_item_id from public.cart_items ci
    join public.commerce_items registry on registry.id = ci.commerce_item_id
    where ci.cart_id = p_cart_id and registry.item_kind = 'intensive_mentoring_custom_offer'
  )
  order by source.id
  for update;

  -- Bundle admin writes lock bundle -> registry -> composition, so preserve that
  -- order while also freezing every row that affects bundle availability.
  perform 1
  from public.commerce_items source
  where source.id in (
    select ci.commerce_item_id from public.cart_items ci where ci.cart_id = p_cart_id
  )
  order by source.id
  for update;

  perform 1
  from public.intensive_mentoring_bundle_items source
  where source.bundle_id in (
    select ci.commerce_item_id from public.cart_items ci
    join public.commerce_items registry on registry.id = ci.commerce_item_id
    where ci.cart_id = p_cart_id and registry.item_kind = 'intensive_mentoring_bundle'
  )
  order by source.bundle_id, source.id
  for update;

end;
$$;

revoke all on function public.lock_cart_commerce_snapshot_sources(uuid)
from public, anon, authenticated;

create or replace function public.assert_discount_user_eligible(
  p_user_id uuid,
  p_discount_code_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.commerce_discount_user_claims;
  v_order public.orders;
  v_redemption public.commerce_discount_redemptions;
begin
  -- Discover without locking, then use the payment-wide Order-first lock order.
  select * into v_claim
  from public.commerce_discount_user_claims
  where user_id = p_user_id and discount_code_id = p_discount_code_id;

  if not found then return; end if;

  select * into v_order
  from public.orders
  where id = v_claim.order_id
  for update;

  select * into v_claim
  from public.commerce_discount_user_claims
  where user_id = p_user_id and discount_code_id = p_discount_code_id
  for update;

  if not found then return; end if;
  if v_claim.order_id <> v_order.id then
    raise exception 'Discount reservation changed during eligibility validation' using errcode = '40001';
  end if;

  if v_claim.status = 'redeemed' or v_order.status = 'paid' then
    raise exception 'Discount code has already been redeemed by this user' using errcode = '22023';
  end if;

  select * into v_redemption
  from public.commerce_discount_redemptions
  where order_id = v_order.id
  for update;

  if v_order.status = 'pending_payment'
    and found
    and v_redemption.status = 'reserved'
    and v_redemption.reserved_until > now()
  then
    raise exception 'Discount code already has an active reservation for this user' using errcode = '22023';
  end if;

  if v_order.status = 'pending_payment' then
    update public.payment_attempts
    set status = 'expired',
        snap_creation_claim_token = null,
        snap_creation_claimed_at = null,
        snap_creation_claim_expires_at = null
    where order_id = v_order.id and status in ('creating', 'pending');

    update public.orders
    set status = 'expired'
    where id = v_order.id and status = 'pending_payment';
  else
    delete from public.commerce_discount_user_claims
    where user_id = p_user_id
      and discount_code_id = p_discount_code_id
      and status = 'reserved';
  end if;
end;
$$;

revoke all on function public.assert_discount_user_eligible(uuid, uuid)
from public, anon, authenticated;

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
  v_discount_code_id uuid;
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

  select dc.id into v_discount_code_id
  from public.commerce_discount_codes dc
  where dc.code = upper(btrim(coalesce(p_code, '')));

  if not found then
    raise exception 'Discount code is invalid or expired' using errcode = '22023';
  end if;

  perform public.assert_discount_user_eligible(v_uid, v_discount_code_id);

  select dc.* into v_code
  from public.commerce_discount_codes dc
  where dc.id = v_discount_code_id
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
  v_commerce_snapshot jsonb := '[]'::jsonb;
  v_subtotal bigint := 0;
  v_eligible_subtotal bigint := 0;
  v_discount bigint := 0;
  v_total bigint;
  v_capacity_used bigint;
begin
  select * into v_cart
  from public.carts
  where id = p_cart_id
    and user_id = v_uid
  for update;

  if not found then
    raise exception 'Cart not found' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where cart_id = v_cart.id
    and user_id = v_uid;

  if found then
    return v_order;
  end if;

  if v_cart.status <> 'active' then
    raise exception 'Cart is not active' using errcode = '22023';
  end if;

  perform 1
  from public.cart_items
  where cart_id = v_cart.id
  order by id
  for update;

  select count(*) into v_item_count
  from public.cart_items
  where cart_id = v_cart.id;

  if v_item_count = 0 then
    raise exception 'Cart is empty' using errcode = '22023';
  end if;

  -- Lock each mutable domain source in deterministic source->registry order.
  -- Cart-time reads remain unlocked; the lock begins only at Order creation.
  perform public.lock_cart_commerce_snapshot_sources(v_cart.id);

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

    select public.discount_redemption_capacity_used(v_code.id)
    into v_capacity_used;

    if v_code.max_redemptions is not null
      and v_capacity_used >= v_code.max_redemptions
    then
      raise exception 'Discount code has reached its redemption limit' using errcode = '22023';
    end if;
  end if;

  -- Resolve each Commerce Item exactly once in one PostgreSQL statement/MVCC
  -- snapshot. Everything below consumes the materialized values, so a concurrent
  -- catalog commit can only be wholly before or wholly after this Order snapshot;
  -- mutable catalog state is never re-read while the Order is being assembled.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'created_at', ci.created_at,
        'cart_item_id', ci.id,
        'commerce_item_id', ci.commerce_item_id,
        'item_kind', r.item_kind,
        'name', r.name,
        'slug', r.slug,
        'price_amount', r.price_amount,
        'is_available', r.is_available,
        'eligible', case
          when v_code.id is null then false
          else public.discount_code_item_is_eligible(
            v_code.id, v_code.scope, r.item_kind, ci.commerce_item_id
          )
        end,
        'custom_offer_owner', offer.intended_mentee_id
      )
      order by ci.created_at, ci.id
    ),
    '[]'::jsonb
  )
  into v_commerce_snapshot
  from public.cart_items ci
  join public.commerce_items registry on registry.id = ci.commerce_item_id
  cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r
  left join public.intensive_mentoring_custom_offers offer
    on registry.item_kind = 'intensive_mentoring_custom_offer'
   and offer.id = ci.commerce_item_id
  where ci.cart_id = v_cart.id;

  if jsonb_array_length(v_commerce_snapshot) <> v_item_count then
    raise exception 'Cart contains an unavailable item' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_commerce_snapshot) as s(
      created_at timestamptz,
      cart_item_id uuid,
      commerce_item_id uuid,
      item_kind text,
      name text,
      slug text,
      price_amount bigint,
      is_available boolean,
      eligible boolean,
      custom_offer_owner uuid
    )
    where s.is_available is distinct from true
      or s.name is null
      or s.slug is null
      or s.price_amount is null
  ) then
    raise exception 'Cart contains an unavailable item' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_commerce_snapshot) as s(
      created_at timestamptz,
      cart_item_id uuid,
      commerce_item_id uuid,
      item_kind text,
      name text,
      slug text,
      price_amount bigint,
      is_available boolean,
      eligible boolean,
      custom_offer_owner uuid
    )
    where s.item_kind = 'intensive_mentoring_custom_offer'
      and s.custom_offer_owner is distinct from v_uid
  ) then
    raise exception 'Cart contains an International custom offer for another mentee' using errcode = '42501';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_commerce_snapshot) as s(
      created_at timestamptz,
      cart_item_id uuid,
      commerce_item_id uuid,
      item_kind text,
      name text,
      slug text,
      price_amount bigint,
      is_available boolean,
      eligible boolean,
      custom_offer_owner uuid
    )
    join public.commerce_digital_product_purchase_claims claim
      on claim.user_id = v_uid
     and claim.commerce_item_id = s.commerce_item_id
    where s.item_kind = 'digital_product'
  ) then
    raise exception 'Cart contains a Digital Product with an active or paid order' using errcode = '22023';
  end if;

  select coalesce(sum(s.price_amount), 0)::bigint
  into v_subtotal
  from jsonb_to_recordset(v_commerce_snapshot) as s(
    created_at timestamptz,
    cart_item_id uuid,
    commerce_item_id uuid,
    item_kind text,
    name text,
    slug text,
    price_amount bigint,
    is_available boolean,
    eligible boolean,
    custom_offer_owner uuid
  );

  if v_code.id is not null then
    select coalesce(sum(s.price_amount) filter (where s.eligible), 0)::bigint
    into v_eligible_subtotal
    from jsonb_to_recordset(v_commerce_snapshot) as s(
      created_at timestamptz,
      cart_item_id uuid,
      commerce_item_id uuid,
      item_kind text,
      name text,
      slug text,
      price_amount bigint,
      is_available boolean,
      eligible boolean,
      custom_offer_owner uuid
    );

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

  if v_total < 0 then
    raise exception 'Discount produced a negative total' using errcode = '22023';
  end if;

  insert into public.orders(
    user_id,
    cart_id,
    discount_code_id,
    subtotal_amount,
    discount_amount,
    discount_code_snapshot,
    total_amount
  )
  values(
    v_uid,
    v_cart.id,
    case when v_code.id is null then null else v_code.id end,
    v_subtotal,
    v_discount,
    case when v_code.id is null then null else v_code.code end,
    v_total
  )
  returning * into v_order;

  insert into public.order_items(
    order_id,
    commerce_item_id,
    item_kind_snapshot,
    name_snapshot,
    slug_snapshot,
    unit_price_amount,
    discounted_unit_price_amount
  )
  with priced as (
    select *
    from jsonb_to_recordset(v_commerce_snapshot) as s(
      created_at timestamptz,
      cart_item_id uuid,
      commerce_item_id uuid,
      item_kind text,
      name text,
      slug text,
      price_amount bigint,
      is_available boolean,
      eligible boolean,
      custom_offer_owner uuid
    )
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
        order by eligible desc, allocation_remainder desc nulls last, created_at, cart_item_id
      ) as remainder_rank
    from allocated
  ),
  finalized as (
    select
      *,
      case
        when eligible then
          allocated_discount
          + case when remainder_rank <= v_discount - base_discount_total then 1 else 0 end
        else 0
      end as final_discount
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
  order by created_at, cart_item_id;

  perform public.ensure_digital_product_purchase_claims(v_order.id);

  if v_code.id is not null then
    insert into public.commerce_discount_redemptions(
      discount_code_id,
      order_id,
      user_id,
      discount_amount,
      code_snapshot,
      status,
      reserved_until
    )
    values(
      v_code.id,
      v_order.id,
      v_uid,
      v_discount,
      v_code.code,
      'reserved',
      now() + public.commerce_discount_reservation_ttl()
    );

    begin
      insert into public.commerce_discount_user_claims(
        user_id, discount_code_id, order_id, status
      )
      values(v_uid, v_code.id, v_order.id, 'reserved');
    exception when unique_violation then
      if exists (
        select 1
        from public.commerce_discount_user_claims claim
        where claim.user_id = v_uid
          and claim.discount_code_id = v_code.id
          and claim.status = 'redeemed'
      ) then
        raise exception 'Discount code has already been redeemed by this user' using errcode = '22023';
      end if;
      raise exception 'Discount code already has an active reservation for this user' using errcode = '22023';
    end;
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

  update public.carts
  set status = 'converted'
  where id = v_cart.id;

  return v_order;
end;
$$;

create or replace function public.sync_discount_redemption_from_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if new.discount_code_id is null then
    return new;
  end if;

  if new.status = 'paid'
    and old.status is distinct from new.status
  then
    update public.commerce_discount_user_claims
    set status = 'redeemed',
        redeemed_at = coalesce(redeemed_at, new.paid_at, now())
    where order_id = new.id
      and status = 'reserved';

    get diagnostics v_rows = row_count;

    if v_rows <> 1 then
      raise exception 'Discount user claim is unavailable; create a new checkout' using errcode = '22023';
    end if;

    update public.commerce_discount_redemptions
    set status = 'redeemed',
        redeemed_at = coalesce(redeemed_at, new.paid_at, now()),
        released_at = null
    where order_id = new.id
      and status = 'reserved'
      and reserved_until > now();

    get diagnostics v_rows = row_count;

    if v_rows <> 1 then
      raise exception 'Discount reservation expired; create a new checkout' using errcode = '22023';
    end if;

  elsif new.status in ('payment_failed', 'expired', 'cancelled')
    and old.status is distinct from new.status
  then
    update public.commerce_discount_redemptions
    set status = 'released',
        released_at = coalesce(released_at, now())
    where order_id = new.id
      and status = 'reserved';

    delete from public.commerce_discount_user_claims
    where order_id = new.id
      and status = 'reserved';
  end if;

  update public.commerce_discount_codes dc
  set redemption_count = (
    select count(*)::integer
    from public.commerce_discount_redemptions r
    where r.discount_code_id = dc.id
      and r.status = 'redeemed'
  )
  where dc.id = new.discount_code_id;

  return new;
end;
$$;

create or replace function public.reserve_midtrans_payment_attempt(p_order_id uuid)
returns public.payment_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_redemption public.commerce_discount_redemptions;
  v_attempt public.payment_attempts;
  v_attempt_found boolean := false;
  v_attempt_id uuid;
  v_payment_expires_at timestamptz;
  v_constraint text;
begin
  -- Global payment lock order: Order -> Payment Attempt. Other lifecycle rows are
  -- checked only after an existing active Attempt has been locked.
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = '22023';
  end if;

  if v_order.status = 'paid' then
    raise exception 'Order is already paid' using errcode = '22023';
  end if;

  if v_order.status <> 'pending_payment' then
    raise exception 'Order is terminal; create a new checkout' using errcode = '22023';
  end if;

  select * into v_attempt
  from public.payment_attempts
  where order_id = p_order_id
    and status in ('creating', 'pending')
  order by created_at desc, id desc
  limit 1
  for update;

  v_attempt_found := found;

  perform public.ensure_digital_product_purchase_claims(v_order.id);

  if v_order.discount_code_id is not null then
    select * into v_redemption
    from public.commerce_discount_redemptions
    where order_id = v_order.id
    for update;

    if not found
      or v_redemption.status <> 'reserved'
      or v_redemption.reserved_until <= now()
    then
      update public.payment_attempts
      set status = 'expired',
          snap_creation_claim_token = null,
          snap_creation_claimed_at = null,
          snap_creation_claim_expires_at = null
      where order_id = v_order.id
        and status in ('creating', 'pending');

      -- Do not raise after this update: the durable Order transition releases the
      -- discount reservation and Digital Product claim through existing triggers.
      update public.orders
      set status = 'expired'
      where id = v_order.id
        and status = 'pending_payment';

      return null;
    end if;

    v_payment_expires_at := v_redemption.reserved_until;
  end if;

  if v_attempt_found then
    if v_payment_expires_at is not null then
      update public.payment_attempts
      set payment_expires_at = v_payment_expires_at,
          snap_token_expires_at = case
            when snap_token_expires_at is null then null
            else least(snap_token_expires_at, v_payment_expires_at)
          end
      where id = v_attempt.id
      returning * into v_attempt;
    end if;

    if v_attempt.payment_expires_at is not null
      and v_attempt.payment_expires_at <= now()
    then
      update public.payment_attempts
      set status = 'expired',
          snap_creation_claim_token = null,
          snap_creation_claimed_at = null,
          snap_creation_claim_expires_at = null
      where id = v_attempt.id;
    elsif v_attempt.snap_token is not null
      and (
        v_attempt.snap_token_expires_at is null
        or v_attempt.snap_token_expires_at <= now()
      )
    then
      update public.payment_attempts
      set status = 'expired',
          snap_creation_claim_token = null,
          snap_creation_claimed_at = null,
          snap_creation_claim_expires_at = null
      where id = v_attempt.id;
    else
      if v_attempt.snap_creation_claim_token is not null
        and v_attempt.snap_creation_claim_expires_at <= now()
      then
        update public.payment_attempts
        set snap_creation_claim_token = null,
            snap_creation_claimed_at = null,
            snap_creation_claim_expires_at = null
        where id = v_attempt.id
        returning * into v_attempt;
      end if;

      return v_attempt;
    end if;
  end if;

  v_attempt_id := gen_random_uuid();

  insert into public.payment_attempts(
    id,
    order_id,
    provider,
    provider_order_id,
    gross_amount,
    payment_expires_at
  )
  values(
    v_attempt_id,
    v_order.id,
    'midtrans',
    'STRAT-' || replace(v_attempt_id::text, '-', ''),
    v_order.total_amount,
    v_payment_expires_at
  )
  returning * into v_attempt;

  return v_attempt;

exception when unique_violation then
  get stacked diagnostics v_constraint = CONSTRAINT_NAME;

  if v_constraint = 'commerce_digital_product_purchase_claims_pkey' then
    raise exception 'Digital Product already has an active or paid order' using errcode = '22023';
  end if;

  if v_constraint <> 'payment_attempts_one_active_per_order' then
    raise;
  end if;

  select * into strict v_attempt
  from public.payment_attempts
  where order_id = p_order_id
    and status in ('creating', 'pending')
  order by created_at desc, id desc
  limit 1;

  return v_attempt;
end;
$$;

create or replace function public.claim_midtrans_snap_creation(
  p_attempt_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.payment_attempts;
  v_order public.orders;
  v_order_id uuid;
  v_redemption public.commerce_discount_redemptions;
  v_now timestamptz := now();
begin
  if p_claim_token is null then
    raise exception 'Snap creation claim token is required' using errcode = '22023';
  end if;

  select order_id into v_order_id
  from public.payment_attempts
  where id = p_attempt_id;

  if not found then
    raise exception 'Payment Attempt not found' using errcode = '22023';
  end if;

  select * into v_order
  from public.orders
  where id = v_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = '22023';
  end if;

  select * into v_attempt
  from public.payment_attempts
  where id = p_attempt_id
  for update;

  if not found or v_attempt.order_id <> v_order.id then
    raise exception 'Payment Attempt Order changed during Snap claim' using errcode = '22023';
  end if;

  if v_order.status <> 'pending_payment'
    or v_attempt.status not in ('creating', 'pending')
  then
    return false;
  end if;

  if v_order.discount_code_id is not null then
    select * into v_redemption
    from public.commerce_discount_redemptions
    where order_id = v_order.id
    for update;

    if not found
      or v_redemption.status <> 'reserved'
      or v_redemption.reserved_until <= v_now
      or v_attempt.payment_expires_at is null
      or v_attempt.payment_expires_at <= v_now
    then
      update public.payment_attempts
      set status = 'expired',
          snap_creation_claim_token = null,
          snap_creation_claimed_at = null,
          snap_creation_claim_expires_at = null
      where id = v_attempt.id and status in ('creating', 'pending');

      update public.orders
      set status = 'expired'
      where id = v_order.id and status = 'pending_payment';
      return false;
    end if;
  end if;

  if v_attempt.snap_token is not null then
    if v_attempt.snap_token_expires_at is not null
      and v_attempt.snap_token_expires_at > v_now
    then
      return false;
    end if;

    update public.payment_attempts
    set status = 'expired',
        snap_creation_claim_token = null,
        snap_creation_claimed_at = null,
        snap_creation_claim_expires_at = null
    where id = v_attempt.id;
    return false;
  end if;

  if v_attempt.snap_creation_claim_token is not null
    and v_attempt.snap_creation_claim_expires_at > v_now
  then
    return v_attempt.snap_creation_claim_token = p_claim_token;
  end if;

  update public.payment_attempts
  set snap_creation_claim_token = p_claim_token,
      snap_creation_claimed_at = v_now,
      snap_creation_claim_expires_at = least(
        v_now + interval '2 minutes',
        coalesce(v_attempt.payment_expires_at, v_now + interval '2 minutes')
      )
  where id = v_attempt.id;

  return true;
end;
$$;

create or replace function public.store_midtrans_snap_token(
  p_attempt_id uuid,
  p_claim_token uuid,
  p_snap_token text
)
returns public.payment_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.payment_attempts;
  v_order public.orders;
  v_order_id uuid;
  v_redemption public.commerce_discount_redemptions;
  v_token text := btrim(p_snap_token);
  v_now timestamptz := now();
  v_token_expires_at timestamptz;
begin
  if p_claim_token is null then
    raise exception 'Snap creation claim token is required' using errcode = '22023';
  end if;

  if v_token is null or char_length(v_token) not between 1 and 2048 then
    raise exception 'Invalid Snap token' using errcode = '22023';
  end if;

  select order_id into v_order_id
  from public.payment_attempts
  where id = p_attempt_id;

  if not found then
    raise exception 'Payment Attempt not found' using errcode = '22023';
  end if;

  select * into v_order
  from public.orders
  where id = v_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = '22023';
  end if;

  select * into v_attempt
  from public.payment_attempts
  where id = p_attempt_id
  for update;

  if not found then
    raise exception 'Payment Attempt not found' using errcode = '22023';
  end if;
  if v_attempt.order_id <> v_order.id then
    raise exception 'Payment Attempt Order changed during Snap storage' using errcode = '22023';
  end if;
  if v_order.status <> 'pending_payment' then
    raise exception 'Order is not payable' using errcode = '22023';
  end if;

  if v_attempt.status not in ('creating', 'pending') then
    raise exception 'Payment Attempt is not active' using errcode = '22023';
  end if;

  if v_attempt.snap_creation_claim_token is distinct from p_claim_token
    or v_attempt.snap_creation_claim_expires_at is null
    or v_attempt.snap_creation_claim_expires_at <= v_now
  then
    raise exception 'Snap creation claim is not owned or has expired' using errcode = '22023';
  end if;

  if v_order.discount_code_id is not null then
    select * into v_redemption
    from public.commerce_discount_redemptions
    where order_id = v_order.id
    for update;

    if not found
      or v_redemption.status <> 'reserved'
      or v_redemption.reserved_until <= v_now
      or v_attempt.payment_expires_at is null
      or v_attempt.payment_expires_at <= v_now
    then
      -- The provider token may already exist, so retire the local lifecycle and
      -- never publish/store it after the authoritative deadline.
      update public.payment_attempts
      set status = 'expired',
          snap_creation_claim_token = null,
          snap_creation_claimed_at = null,
          snap_creation_claim_expires_at = null
      where id = v_attempt.id and status in ('creating', 'pending');

      update public.orders
      set status = 'expired'
      where id = v_order.id and status = 'pending_payment';
      return null;
    end if;
  end if;

  v_token_expires_at := least(
    v_now + interval '24 hours',
    coalesce(v_attempt.payment_expires_at, v_now + interval '24 hours')
  );

  if v_token_expires_at <= v_now then
    raise exception 'Payment window has expired; create a new checkout' using errcode = '22023';
  end if;

  update public.payment_attempts
  set snap_token = v_token,
      snap_token_created_at = v_now,
      snap_token_expires_at = v_token_expires_at,
      snap_creation_claim_token = null,
      snap_creation_claimed_at = null,
      snap_creation_claim_expires_at = null,
      status = 'pending'
  where id = p_attempt_id
  returning * into v_attempt;

  return v_attempt;
end;
$$;

create or replace function public.release_midtrans_snap_creation(
  p_attempt_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_attempt public.payment_attempts;
  v_order_id uuid;
  v_rows integer;
begin
  if p_claim_token is null then return false; end if;

  select order_id into v_order_id
  from public.payment_attempts
  where id = p_attempt_id;
  if not found then return false; end if;

  select * into v_order
  from public.orders
  where id = v_order_id
  for update;
  if not found then return false; end if;

  select * into v_attempt
  from public.payment_attempts
  where id = p_attempt_id
  for update;
  if not found or v_attempt.order_id <> v_order.id then return false; end if;

  update public.payment_attempts
  set snap_creation_claim_token = null,
      snap_creation_claimed_at = null,
      snap_creation_claim_expires_at = null
  where id = v_attempt.id
    and snap_creation_claim_token = p_claim_token
    and status in ('creating', 'pending');

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

create or replace function public.apply_midtrans_payment_status(
  p_attempt_id uuid,
  p_normalized_status text,
  p_provider_status text,
  p_provider_transaction_id text,
  p_fraud_status text,
  p_payment_type text
)
returns public.payment_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.payment_attempts;
  v_order public.orders;
  v_order_id uuid;
  v_redemption public.commerce_discount_redemptions;
  v_now timestamptz := now();
begin
  if p_normalized_status is null
    or p_normalized_status not in ('pending', 'paid', 'failed', 'expired', 'cancelled')
  then
    raise exception 'Invalid normalized payment status' using errcode = '22023';
  end if;

  -- Read identity without locking so the transaction can then acquire rows in the
  -- same Order -> claim -> discount reservation -> Payment Attempt order as reserve.
  select order_id into v_order_id
  from public.payment_attempts
  where id = p_attempt_id;

  if not found then
    raise exception 'Payment Attempt not found' using errcode = '22023';
  end if;

  select * into v_order
  from public.orders
  where id = v_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = '22023';
  end if;

  select * into v_attempt
  from public.payment_attempts
  where id = p_attempt_id
  for update;

  if not found then
    raise exception 'Payment Attempt not found' using errcode = '22023';
  end if;

  if v_attempt.order_id <> v_order.id then
    raise exception 'Payment Attempt Order changed during status application' using errcode = '22023';
  end if;

  -- paid and terminal Orders are monotonic. In particular, a provider event may
  -- not revive an Order whose payable lifecycle has definitively ended.
  if v_order.status = 'paid' and p_normalized_status <> 'paid' then
    return v_attempt;
  end if;

  if v_order.status in ('payment_failed', 'expired', 'cancelled') then
    return v_attempt;
  end if;

  if v_attempt.status = 'paid' and p_normalized_status <> 'paid' then
    return v_attempt;
  end if;

  if v_attempt.status in ('failed', 'expired', 'cancelled') then
    return v_attempt;
  end if;

  if p_normalized_status = 'paid' then
    perform public.ensure_digital_product_purchase_claims(v_order.id);
  end if;

  if v_order.discount_code_id is not null then
    select * into v_redemption
    from public.commerce_discount_redemptions
    where order_id = v_order.id
    for update;

    if p_normalized_status = 'paid'
      and v_order.status <> 'paid'
      and (
        not found
        or v_redemption.status <> 'reserved'
        or v_redemption.reserved_until <= v_now
      )
    then
      update public.payment_attempts
      set status = 'expired',
          provider_status = nullif(btrim(p_provider_status), ''),
          provider_transaction_id = coalesce(
            nullif(btrim(p_provider_transaction_id), ''),
            provider_transaction_id
          ),
          fraud_status = nullif(btrim(p_fraud_status), ''),
          payment_type = nullif(btrim(p_payment_type), ''),
          snap_creation_claim_token = null,
          snap_creation_claimed_at = null,
          snap_creation_claim_expires_at = null
      where id = v_attempt.id
      returning * into v_attempt;

      update public.orders
      set status = 'expired'
      where id = v_order.id and status = 'pending_payment';

      return v_attempt;
    end if;
  end if;

  update public.payment_attempts
  set status = p_normalized_status,
      provider_status = nullif(btrim(p_provider_status), ''),
      provider_transaction_id = coalesce(
        nullif(btrim(p_provider_transaction_id), ''),
        provider_transaction_id
      ),
      fraud_status = nullif(btrim(p_fraud_status), ''),
      payment_type = nullif(btrim(p_payment_type), '')
  where id = v_attempt.id
  returning * into v_attempt;

  if p_normalized_status = 'paid' then
    update public.orders o
    set status = 'paid',
        paid_at = coalesce(o.paid_at, now())
    where o.id = v_order.id;
  elsif p_normalized_status = 'failed'
    and v_order.status <> 'paid'
  then
    update public.orders
    set status = 'payment_failed'
    where id = v_order.id;
  elsif p_normalized_status = 'expired'
    and v_order.status <> 'paid'
  then
    update public.orders
    set status = 'expired'
    where id = v_order.id;
  elsif p_normalized_status = 'cancelled'
    and v_order.status <> 'paid'
  then
    update public.orders
    set status = 'cancelled'
    where id = v_order.id;
  end if;

  return v_attempt;
end;
$$;
