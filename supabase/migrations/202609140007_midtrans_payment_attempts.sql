-- Phase 2: server-owned Midtrans payment attempts and monotonic Order transitions.

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  provider text not null check (provider = 'midtrans'),
  provider_order_id text not null unique check (
    provider_order_id = btrim(provider_order_id)
    and char_length(provider_order_id) between 1 and 49
  ),
  snap_token text check (
    snap_token is null
    or (snap_token = btrim(snap_token) and char_length(snap_token) between 1 and 2048)
  ),
  provider_transaction_id text check (
    provider_transaction_id is null
    or char_length(btrim(provider_transaction_id)) between 1 and 255
  ),
  provider_status text check (
    provider_status is null
    or char_length(btrim(provider_status)) between 1 and 100
  ),
  fraud_status text check (
    fraud_status is null
    or char_length(btrim(fraud_status)) between 1 and 100
  ),
  payment_type text check (
    payment_type is null
    or char_length(btrim(payment_type)) between 1 and 100
  ),
  gross_amount bigint not null check (
    gross_amount >= 0 and gross_amount <= 9007199254740991
  ),
  status text not null default 'creating' check (
    status in ('creating', 'pending', 'paid', 'failed', 'expired', 'cancelled')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index payment_attempts_one_active_per_order
  on public.payment_attempts (order_id)
  where status in ('creating', 'pending');
create index payment_attempts_order_history
  on public.payment_attempts (order_id, created_at desc, id);
create index payment_attempts_provider_transaction
  on public.payment_attempts (provider_transaction_id)
  where provider_transaction_id is not null;

create trigger payment_attempts_touch_updated_at
before update on public.payment_attempts
for each row execute function public.touch_updated_at();

alter table public.payment_attempts enable row level security;
revoke all on public.payment_attempts from anon, authenticated;
grant all on public.payment_attempts to service_role;

create function public.reserve_midtrans_payment_attempt(p_order_id uuid)
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
    return v_attempt;
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

create function public.store_midtrans_snap_token(p_attempt_id uuid, p_snap_token text)
returns public.payment_attempts
language plpgsql security definer set search_path = '' as $$
declare
  v_attempt public.payment_attempts;
  v_token text := btrim(p_snap_token);
begin
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

  update public.payment_attempts
  set snap_token = v_token,
      status = 'pending'
  where id = p_attempt_id
  returning * into v_attempt;
  return v_attempt;
end;
$$;

create function public.apply_midtrans_payment_status(
  p_attempt_id uuid,
  p_normalized_status text,
  p_provider_status text,
  p_provider_transaction_id text,
  p_fraud_status text,
  p_payment_type text
)
returns public.payment_attempts
language plpgsql security definer set search_path = '' as $$
declare
  v_attempt public.payment_attempts;
  v_order public.orders;
begin
  if p_normalized_status is null or p_normalized_status not in (
    'pending', 'paid', 'failed', 'expired', 'cancelled'
  ) then
    raise exception 'Invalid normalized payment status' using errcode = '22023';
  end if;

  select * into v_attempt
  from public.payment_attempts
  where id = p_attempt_id
  for update;
  if not found then
    raise exception 'Payment Attempt not found' using errcode = '22023';
  end if;

  select * into strict v_order
  from public.orders
  where id = v_attempt.order_id
  for update;

  if v_order.status = 'paid' and p_normalized_status <> 'paid' then
    return v_attempt;
  end if;
  if v_attempt.status = 'paid' and p_normalized_status <> 'paid' then
    return v_attempt;
  end if;
  if v_attempt.status in ('failed', 'expired', 'cancelled')
    and p_normalized_status <> 'paid'
    and p_normalized_status <> v_attempt.status then
    return v_attempt;
  end if;

  update public.payment_attempts
  set status = p_normalized_status,
      provider_status = nullif(btrim(p_provider_status), ''),
      provider_transaction_id = coalesce(
        nullif(btrim(p_provider_transaction_id), ''), provider_transaction_id
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
  elsif p_normalized_status = 'failed' and v_order.status <> 'paid' then
    update public.orders set status = 'payment_failed' where id = v_order.id;
  elsif p_normalized_status = 'expired' and v_order.status <> 'paid' then
    update public.orders set status = 'expired' where id = v_order.id;
  elsif p_normalized_status = 'cancelled' and v_order.status <> 'paid' then
    update public.orders set status = 'cancelled' where id = v_order.id;
  end if;

  return v_attempt;
end;
$$;

revoke all on function public.reserve_midtrans_payment_attempt(uuid) from public, anon, authenticated;
revoke all on function public.store_midtrans_snap_token(uuid, text) from public, anon, authenticated;
revoke all on function public.apply_midtrans_payment_status(uuid, text, text, text, text, text)
from public, anon, authenticated;

grant execute on function public.reserve_midtrans_payment_attempt(uuid) to service_role;
grant execute on function public.store_midtrans_snap_token(uuid, text) to service_role;
grant execute on function public.apply_midtrans_payment_status(uuid, text, text, text, text, text)
to service_role;
