-- Phase 2 hardening: bounded Snap-token validity and one-owner-at-a-time creation claims.
-- This is intentionally forward-only. Historical Shared Commerce/payment migrations remain unchanged.

alter table public.payment_attempts
  add column snap_token_created_at timestamptz,
  add column snap_token_expires_at timestamptz,
  add column snap_creation_claim_token uuid,
  add column snap_creation_claimed_at timestamptz,
  add column snap_creation_claim_expires_at timestamptz;

-- Existing active tokens predate explicit validity metadata. Give them a deterministic
-- historical creation time and the same 24-hour lifetime used by new Snap requests.
update public.payment_attempts
set snap_token_created_at = coalesce(updated_at, created_at),
    snap_token_expires_at = coalesce(updated_at, created_at) + interval '24 hours'
where snap_token is not null;

alter table public.payment_attempts
  add constraint payment_attempts_snap_token_timing_check check (
    (snap_token is null and snap_token_created_at is null and snap_token_expires_at is null)
    or (
      snap_token is not null
      and snap_token_created_at is not null
      and snap_token_expires_at is not null
      and snap_token_expires_at > snap_token_created_at
    )
  ),
  add constraint payment_attempts_snap_creation_claim_timing_check check (
    (
      snap_creation_claim_token is null
      and snap_creation_claimed_at is null
      and snap_creation_claim_expires_at is null
    )
    or (
      snap_creation_claim_token is not null
      and snap_creation_claimed_at is not null
      and snap_creation_claim_expires_at is not null
      and snap_creation_claim_expires_at > snap_creation_claimed_at
    )
  );

create or replace function public.reserve_midtrans_payment_attempt(p_order_id uuid)
returns public.payment_attempts
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_attempt public.payment_attempts;
  v_attempt_id uuid;
begin
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

  select * into v_attempt
  from public.payment_attempts
  where order_id = p_order_id and status in ('creating', 'pending')
  order by created_at desc, id desc
  limit 1
  for update;

  if found then
    if v_attempt.snap_token is not null
      and (v_attempt.snap_token_expires_at is null or v_attempt.snap_token_expires_at <= now()) then
      update public.payment_attempts
      set status = 'expired',
          snap_creation_claim_token = null,
          snap_creation_claimed_at = null,
          snap_creation_claim_expires_at = null
      where id = v_attempt.id;
    else
      if v_attempt.snap_creation_claim_token is not null
        and v_attempt.snap_creation_claim_expires_at <= now() then
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
  insert into public.payment_attempts (
    id,
    order_id,
    provider,
    provider_order_id,
    gross_amount
  ) values (
    v_attempt_id,
    v_order.id,
    'midtrans',
    'STRAT-' || replace(v_attempt_id::text, '-', ''),
    v_order.total_amount
  )
  returning * into v_attempt;

  if v_order.status in ('payment_failed', 'expired', 'cancelled') then
    update public.orders
    set status = 'pending_payment'
    where id = v_order.id;
  end if;

  return v_attempt;
exception when unique_violation then
  select * into strict v_attempt
  from public.payment_attempts
  where order_id = p_order_id and status in ('creating', 'pending')
  order by created_at desc, id desc
  limit 1;
  return v_attempt;
end;
$$;

create function public.claim_midtrans_snap_creation(p_attempt_id uuid, p_claim_token uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_attempt public.payment_attempts;
begin
  if p_claim_token is null then
    raise exception 'Snap creation claim token is required' using errcode = '22023';
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

  if v_attempt.snap_token is not null then
    if v_attempt.snap_token_expires_at is not null and v_attempt.snap_token_expires_at > now() then
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
    and v_attempt.snap_creation_claim_expires_at > now() then
    return v_attempt.snap_creation_claim_token = p_claim_token;
  end if;

  update public.payment_attempts
  set snap_creation_claim_token = p_claim_token,
      snap_creation_claimed_at = now(),
      snap_creation_claim_expires_at = now() + interval '2 minutes'
  where id = v_attempt.id;

  return true;
end;
$$;

drop function public.store_midtrans_snap_token(uuid, text);

create function public.store_midtrans_snap_token(
  p_attempt_id uuid,
  p_claim_token uuid,
  p_snap_token text
)
returns public.payment_attempts
language plpgsql security definer set search_path = '' as $$
declare
  v_attempt public.payment_attempts;
  v_token text := btrim(p_snap_token);
  v_now timestamptz := now();
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
    or v_attempt.snap_creation_claim_expires_at <= v_now then
    raise exception 'Snap creation claim is not owned or has expired' using errcode = '22023';
  end if;

  update public.payment_attempts
  set snap_token = v_token,
      snap_token_created_at = v_now,
      snap_token_expires_at = v_now + interval '24 hours',
      snap_creation_claim_token = null,
      snap_creation_claimed_at = null,
      snap_creation_claim_expires_at = null,
      status = 'pending'
  where id = p_attempt_id
  returning * into v_attempt;

  return v_attempt;
end;
$$;

create function public.release_midtrans_snap_creation(p_attempt_id uuid, p_claim_token uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_rows integer;
begin
  if p_claim_token is null then
    return false;
  end if;

  update public.payment_attempts
  set snap_creation_claim_token = null,
      snap_creation_claimed_at = null,
      snap_creation_claim_expires_at = null
  where id = p_attempt_id
    and snap_creation_claim_token = p_claim_token
    and status in ('creating', 'pending');

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

revoke all on function public.reserve_midtrans_payment_attempt(uuid) from public, anon, authenticated;
revoke all on function public.claim_midtrans_snap_creation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.store_midtrans_snap_token(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.release_midtrans_snap_creation(uuid, uuid) from public, anon, authenticated;

grant execute on function public.reserve_midtrans_payment_attempt(uuid) to service_role;
grant execute on function public.claim_midtrans_snap_creation(uuid, uuid) to service_role;
grant execute on function public.store_midtrans_snap_token(uuid, uuid, text) to service_role;
grant execute on function public.release_midtrans_snap_creation(uuid, uuid) to service_role;
