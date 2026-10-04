-- Use authoritative Midtrans success timing for discounted paid reconciliation.
-- Forward-only follow-up to Shared Commerce reservation hardening.

create or replace function public.sync_discount_redemption_from_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
  v_redemption public.commerce_discount_redemptions;
  v_max_redemptions integer;
  v_capacity_used bigint;
begin
  if new.discount_code_id is null then
    return new;
  end if;

  if new.status = 'paid'
    and old.status is distinct from new.status
  then
    -- paid_at is assigned from trusted provider success timing by the payment
    -- transition RPC for discounted Orders. It is intentionally compared with
    -- the original reservation deadline rather than local webhook receipt time.
    select * into v_redemption
    from public.commerce_discount_redemptions
    where order_id = new.id
    for update;

    if not found
      or new.paid_at is null
      or new.paid_at > v_redemption.reserved_until
      or v_redemption.status not in ('reserved', 'released')
    then
      raise exception 'Discount payment timing is outside the trusted reservation window'
        using errcode = '22023';
    end if;

    -- A locally expired Order may have released its capacity while a provider
    -- success notification was in flight. Re-admit it only if doing so does not
    -- violate the existing global max_redemptions reservation invariant.
    if v_redemption.status = 'released' then
      select dc.max_redemptions into v_max_redemptions
      from public.commerce_discount_codes dc
      where dc.id = new.discount_code_id
      for update;

      if v_max_redemptions is not null then
        select public.discount_redemption_capacity_used(new.discount_code_id)
        into v_capacity_used;

        if v_capacity_used >= v_max_redemptions then
          raise exception 'Discount redemption capacity was reassigned; manual reconciliation required'
            using errcode = '22023';
        end if;
      end if;
    end if;

    update public.commerce_discount_user_claims
    set status = 'redeemed',
        redeemed_at = coalesce(redeemed_at, new.paid_at)
    where order_id = new.id
      and status = 'reserved';

    get diagnostics v_rows = row_count;

    if v_rows = 0 then
      insert into public.commerce_discount_user_claims(
        user_id,
        discount_code_id,
        order_id,
        status,
        created_at,
        redeemed_at
      )
      values(
        v_redemption.user_id,
        v_redemption.discount_code_id,
        new.id,
        'redeemed',
        v_redemption.created_at,
        new.paid_at
      )
      on conflict (user_id, discount_code_id) do nothing;

      get diagnostics v_rows = row_count;
    end if;

    if v_rows <> 1 then
      raise exception 'Discount user claim is unavailable; create a new checkout'
        using errcode = '22023';
    end if;

    update public.commerce_discount_redemptions
    set status = 'redeemed',
        redeemed_at = coalesce(redeemed_at, new.paid_at),
        released_at = null
    where order_id = new.id
      and status in ('reserved', 'released')
      and new.paid_at <= reserved_until;

    get diagnostics v_rows = row_count;

    if v_rows <> 1 then
      raise exception 'Discount payment timing is outside the trusted reservation window'
        using errcode = '22023';
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

revoke all on function public.sync_discount_redemption_from_order_status()
from public, anon, authenticated;

create or replace function public.apply_midtrans_payment_status(
  p_attempt_id uuid,
  p_normalized_status text,
  p_provider_status text,
  p_provider_transaction_id text,
  p_fraud_status text,
  p_payment_type text,
  p_provider_success_at timestamptz
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
  v_payment_deadline timestamptz;
  v_previous_provider_status text;
  v_local_expiry_reconcilable boolean := false;
begin
  if p_normalized_status is null
    or p_normalized_status not in ('pending', 'paid', 'failed', 'expired', 'cancelled')
  then
    raise exception 'Invalid normalized payment status' using errcode = '22023';
  end if;

  -- Read identity without locking, then preserve the payment-wide lock order:
  -- Order -> Payment Attempt -> discount reservation.
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
    raise exception 'Payment Attempt Order changed during status application'
      using errcode = '22023';
  end if;

  v_previous_provider_status := lower(btrim(coalesce(v_attempt.provider_status, '')));

  -- paid Orders are monotonic; duplicate/out-of-order notifications cannot
  -- downgrade or re-run the paid transition.
  if v_order.status = 'paid' then
    return v_attempt;
  end if;

  if p_normalized_status <> 'paid' then
    if v_order.status in ('payment_failed', 'expired', 'cancelled') then
      return v_attempt;
    end if;

    if v_attempt.status = 'paid'
      or v_attempt.status in ('failed', 'expired', 'cancelled')
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

    if p_normalized_status = 'failed' then
      update public.orders
      set status = 'payment_failed'
      where id = v_order.id and status = 'pending_payment';
    elsif p_normalized_status = 'expired' then
      update public.orders
      set status = 'expired'
      where id = v_order.id and status = 'pending_payment';
    elsif p_normalized_status = 'cancelled' then
      update public.orders
      set status = 'cancelled'
      where id = v_order.id and status = 'pending_payment';
    end if;

    return v_attempt;
  end if;

  -- Unrelated terminal failures/cancellations are never revived by a later paid
  -- notification. Only an expired discounted lifecycle can be reconsidered, and
  -- only when its stored provider state is non-terminal/local.
  if v_order.status in ('payment_failed', 'cancelled') then
    return v_attempt;
  end if;

  if v_attempt.status in ('failed', 'cancelled') then
    return v_attempt;
  end if;

  if v_order.discount_code_id is not null then
    select * into v_redemption
    from public.commerce_discount_redemptions
    where order_id = v_order.id
    for update;

    -- A paid decision for a discounted Order requires an authoritative provider
    -- success timestamp and the trusted deadline persisted on the Payment Attempt.
    -- Missing timing never falls back to local now().
    if not found
      or p_provider_success_at is null
      or v_attempt.payment_expires_at is null
    then
      update public.payment_attempts
      set provider_status = nullif(btrim(p_provider_status), ''),
          provider_transaction_id = coalesce(
            nullif(btrim(p_provider_transaction_id), ''),
            provider_transaction_id
          ),
          fraud_status = nullif(btrim(p_fraud_status), ''),
          payment_type = nullif(btrim(p_payment_type), '')
      where id = v_attempt.id
      returning * into v_attempt;

      return v_attempt;
    end if;

    v_payment_deadline := least(
      v_attempt.payment_expires_at,
      v_redemption.reserved_until
    );

    if p_provider_success_at > v_payment_deadline then
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
      where id = v_order.id
        and status = 'pending_payment';

      return v_attempt;
    end if;

    v_local_expiry_reconcilable :=
      v_order.status = 'expired'
      and v_attempt.status = 'expired'
      and v_previous_provider_status in ('', 'pending', 'authorize', 'capture', 'settlement')
      and v_redemption.status in ('reserved', 'released');

    if v_order.status = 'expired' and not v_local_expiry_reconcilable then
      return v_attempt;
    end if;

    if v_order.status not in ('pending_payment', 'expired') then
      return v_attempt;
    end if;

    if v_attempt.status = 'expired'
      and not (
        v_previous_provider_status in ('', 'pending', 'authorize', 'capture', 'settlement')
        and v_redemption.status in ('reserved', 'released')
      )
    then
      return v_attempt;
    end if;
  else
    -- Non-discounted Orders keep the established terminal semantics and are not
    -- subjected to voucher/provider timing requirements.
    if v_order.status <> 'pending_payment'
      or v_attempt.status in ('failed', 'expired', 'cancelled')
    then
      return v_attempt;
    end if;
  end if;

  perform public.ensure_digital_product_purchase_claims(v_order.id);

  update public.payment_attempts
  set status = 'paid',
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

  update public.orders o
  set status = 'paid',
      paid_at = coalesce(
        o.paid_at,
        case
          when o.discount_code_id is not null then p_provider_success_at
          else coalesce(p_provider_success_at, now())
        end
      )
  where o.id = v_order.id;

  return v_attempt;
end;
$$;

revoke all on function public.apply_midtrans_payment_status(
  uuid, text, text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_midtrans_payment_status(
  uuid, text, text, text, text, text, timestamptz
) to service_role;

-- Keep the historical RPC signature for non-discounted/internal regression
-- compatibility. A discounted paid transition through this wrapper receives no
-- provider success time and therefore fails closed in the authoritative function.
create or replace function public.apply_midtrans_payment_status(
  p_attempt_id uuid,
  p_normalized_status text,
  p_provider_status text,
  p_provider_transaction_id text,
  p_fraud_status text,
  p_payment_type text
)
returns public.payment_attempts
language sql
security definer
set search_path = ''
as $$
  select public.apply_midtrans_payment_status(
    p_attempt_id,
    p_normalized_status,
    p_provider_status,
    p_provider_transaction_id,
    p_fraud_status,
    p_payment_type,
    null::timestamptz
  );
$$;

revoke all on function public.apply_midtrans_payment_status(
  uuid, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.apply_midtrans_payment_status(
  uuid, text, text, text, text, text
) to service_role;
