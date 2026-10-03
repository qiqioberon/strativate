-- Shared Commerce concurrency and transaction hardening.
-- Keeps the existing cart/order/payment architecture while enforcing:
-- 1) one materialized commerce snapshot per order creation,
-- 2) one active-or-paid Digital Product purchase per mentee/product,
-- 3) consistent payment lock ordering,
-- 4) discount reservation expiry as a hard payment boundary.

alter table public.payment_attempts
  add column payment_expires_at timestamptz;

-- Discounted attempts inherit the Order reservation deadline. Existing local token
-- metadata is capped as well; new provider sessions are capped by the application.
update public.payment_attempts pa
set payment_expires_at = r.reserved_until,
    snap_token_expires_at = case
      when pa.snap_token_expires_at is null then null
      else least(pa.snap_token_expires_at, r.reserved_until)
    end
from public.commerce_discount_redemptions r
where r.order_id = pa.order_id;

-- Existing already-expired discounted Orders are not valid active purchases. Retire
-- their local attempts first, then persist the terminal Order transition so the
-- existing discount trigger releases reservation capacity before claim backfill.
update public.payment_attempts pa
set status = 'expired',
    snap_creation_claim_token = null,
    snap_creation_claimed_at = null,
    snap_creation_claim_expires_at = null
where pa.status in ('creating', 'pending')
  and exists (
    select 1
    from public.orders o
    where o.id = pa.order_id
      and o.status = 'pending_payment'
      and o.discount_code_id is not null
      and not exists (
        select 1
        from public.commerce_discount_redemptions r
        where r.order_id = o.id
          and r.status = 'reserved'
          and r.reserved_until > now()
      )
  );

update public.orders o
set status = 'expired'
where o.status = 'pending_payment'
  and o.discount_code_id is not null
  and not exists (
    select 1
    from public.commerce_discount_redemptions r
    where r.order_id = o.id
      and r.status = 'reserved'
      and r.reserved_until > now()
  );

create table public.commerce_digital_product_purchase_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  commerce_item_id uuid not null references public.commerce_items(id),
  order_id uuid not null references public.orders(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, commerce_item_id)
);

create index commerce_digital_product_purchase_claims_order_idx
  on public.commerce_digital_product_purchase_claims(order_id);

alter table public.commerce_digital_product_purchase_claims enable row level security;
revoke all on public.commerce_digital_product_purchase_claims from public, anon, authenticated;
grant all on public.commerce_digital_product_purchase_claims to service_role;

-- Preserve one canonical active/paid claim for historical rows. Paid ownership wins;
-- otherwise keep the oldest still-pending order. Historical duplicate rows are not rewritten.
with ranked as (
  select
    o.user_id,
    oi.commerce_item_id,
    o.id as order_id,
    row_number() over (
      partition by o.user_id, oi.commerce_item_id
      order by
        case when o.status = 'paid' then 0 else 1 end,
        coalesce(o.paid_at, o.created_at),
        o.created_at,
        o.id
    ) as row_no
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  where oi.item_kind_snapshot = 'digital_product'
    and o.status in ('pending_payment', 'paid')
)
insert into public.commerce_digital_product_purchase_claims(user_id, commerce_item_id, order_id)
select user_id, commerce_item_id, order_id
from ranked
where row_no = 1
on conflict do nothing;

create or replace function public.ensure_digital_product_purchase_claims(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception 'Order not found' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.order_items oi
    join public.commerce_digital_product_purchase_claims claim
      on claim.user_id = v_user_id
     and claim.commerce_item_id = oi.commerce_item_id
     and claim.order_id <> p_order_id
    where oi.order_id = p_order_id
      and oi.item_kind_snapshot = 'digital_product'
  ) then
    raise exception 'Digital Product already has an active or paid order' using errcode = '22023';
  end if;

  begin
    insert into public.commerce_digital_product_purchase_claims(user_id, commerce_item_id, order_id)
    select v_user_id, oi.commerce_item_id, p_order_id
    from public.order_items oi
    where oi.order_id = p_order_id
      and oi.item_kind_snapshot = 'digital_product'
      and not exists (
        select 1
        from public.commerce_digital_product_purchase_claims claim
        where claim.user_id = v_user_id
          and claim.commerce_item_id = oi.commerce_item_id
          and claim.order_id = p_order_id
      );
  exception when unique_violation then
    raise exception 'Digital Product already has an active or paid order' using errcode = '22023';
  end;
end;
$$;

revoke all on function public.ensure_digital_product_purchase_claims(uuid)
from public, anon, authenticated;

create or replace function public.sync_digital_product_purchase_claims_from_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status in ('payment_failed', 'expired', 'cancelled') then
    delete from public.commerce_digital_product_purchase_claims
    where order_id = new.id;
  elsif new.status in ('pending_payment', 'paid') then
    perform public.ensure_digital_product_purchase_claims(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists orders_sync_digital_product_purchase_claims on public.orders;
create trigger orders_sync_digital_product_purchase_claims
after update of status on public.orders
for each row
execute function public.sync_digital_product_purchase_claims_from_order_status();

revoke all on function public.sync_digital_product_purchase_claims_from_order_status()
from public, anon, authenticated;

create or replace function public.get_active_digital_product_order(p_commerce_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $
declare
  v_uid uuid := public.current_completed_mentee_id();
  v_order_id uuid;
begin
  select claim.order_id into v_order_id
  from public.commerce_digital_product_purchase_claims claim
  join public.orders o on o.id = claim.order_id
  where claim.user_id = v_uid
    and claim.commerce_item_id = p_commerce_item_id
    and o.status = 'pending_payment';

  return v_order_id;
end;
$;

revoke all on function public.get_active_digital_product_order(uuid)
from public, anon, authenticated;
grant execute on function public.get_active_digital_product_order(uuid)
to authenticated, service_role;

create or replace function public.add_cart_item(p_commerce_item_id uuid)
returns public.cart_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.current_completed_mentee_id();
  v_cart public.carts;
  v_item record;
  v_cart_item public.cart_items;
begin
  if exists(select 1 from public.private_mentoring_cart_link_offers where id = p_commerce_item_id) then
    raise exception 'This Private Mentoring quote can only be claimed from its Cart Link' using errcode = '42501';
  end if;

  select * into v_item
  from public.resolve_commerce_item(p_commerce_item_id);

  if not found
    or v_item.is_available is distinct from true
    or v_item.name is null
    or v_item.price_amount is null
  then
    raise exception 'Commerce Item is unavailable' using errcode = '22023';
  end if;

  if v_item.item_kind = 'intensive_mentoring_custom_offer'
    and not exists (
      select 1
      from public.intensive_mentoring_custom_offers o
      where o.id = p_commerce_item_id
        and o.intended_mentee_id = v_uid
    )
  then
    raise exception 'International custom offer belongs to another mentee' using errcode = '42501';
  end if;

  if v_item.item_kind = 'digital_product' then
    if exists (
      select 1
      from public.commerce_digital_product_purchase_claims claim
      join public.orders o on o.id = claim.order_id
      where claim.user_id = v_uid
        and claim.commerce_item_id = p_commerce_item_id
        and o.status = 'pending_payment'
    ) then
      raise exception 'Digital Product has an active payment' using errcode = '22023';
    end if;

    if exists (
      select 1
      from public.commerce_digital_product_purchase_claims claim
      join public.orders o on o.id = claim.order_id
      where claim.user_id = v_uid
        and claim.commerce_item_id = p_commerce_item_id
        and o.status = 'paid'
    ) then
      raise exception 'Digital Product is already owned' using errcode = '22023';
    end if;
  end if;

  v_cart := public.get_or_create_active_cart();

  if exists (
    select 1
    from public.cart_items ci
    where ci.cart_id = v_cart.id
      and ci.commerce_item_id = p_commerce_item_id
  ) then
    raise exception 'Commerce Item is already in cart' using errcode = '22023';
  end if;

  insert into public.cart_items(cart_id, commerce_item_id)
  values(v_cart.id, p_commerce_item_id)
  returning * into v_cart_item;

  return v_cart_item;
end;
$$;

revoke all on function public.add_cart_item(uuid) from public, anon, authenticated;
grant execute on function public.add_cart_item(uuid) to authenticated, service_role;

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
      now() + interval '24 hours'
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

  update public.carts
  set status = 'converted'
  where id = v_cart.id;

  return v_order;
end;
$$;

revoke all on function public.create_order_from_cart(uuid) from public, anon, authenticated;
grant execute on function public.create_order_from_cart(uuid) to authenticated, service_role;

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

revoke all on function public.sync_discount_redemption_from_order_status()
from public, anon, authenticated;

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
  v_attempt_id uuid;
  v_payment_expires_at timestamptz;
  v_constraint text;
begin
  -- Global payment lock order: Order -> Payment Attempt. Discount reservation and
  -- purchase-claim checks happen after the Order lock and before the Attempt lock.
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

  select * into v_attempt
  from public.payment_attempts
  where order_id = p_order_id
    and status in ('creating', 'pending')
  order by created_at desc, id desc
  limit 1
  for update;

  if found then
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

create or replace function public.store_midtrans_snap_token(
  p_attempt_id uuid,
  p_claim_token uuid,
  p_snap_token text
)
returns public.payment_attempts
language plpgsql
security definer
set search_path = ''
as $
declare
  v_attempt public.payment_attempts;
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

  select * into v_attempt
  from public.payment_attempts
  where id = p_attempt_id
  for update;

  if not found then
    raise exception 'Payment Attempt not found' using errcode = '22023';
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
$;

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
        or v_redemption.reserved_until <= now()
      )
    then
      raise exception 'Discount reservation expired; create a new checkout' using errcode = '22023';
    end if;
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

  if v_order.status = 'paid'
    and p_normalized_status <> 'paid'
  then
    return v_attempt;
  end if;

  if v_attempt.status = 'paid'
    and p_normalized_status <> 'paid'
  then
    return v_attempt;
  end if;

  if v_attempt.status in ('failed', 'expired', 'cancelled')
    and p_normalized_status <> 'paid'
    and p_normalized_status <> v_attempt.status
  then
    return v_attempt;
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

revoke all on function public.reserve_midtrans_payment_attempt(uuid)
from public, anon, authenticated;
revoke all on function public.apply_midtrans_payment_status(uuid, text, text, text, text, text)
from public, anon, authenticated;

grant execute on function public.reserve_midtrans_payment_attempt(uuid) to service_role;
grant execute on function public.apply_midtrans_payment_status(uuid, text, text, text, text, text)
to service_role;
