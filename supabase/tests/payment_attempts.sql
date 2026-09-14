-- Disposable database only. All fixtures and mutations are rolled back.
begin;

create schema test_payments;
grant usage on schema test_payments to authenticated, service_role;

create function test_payments.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;

create function test_payments.denied(command text, message text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when insufficient_privilege or check_violation or invalid_parameter_value or raise_exception then return;
  end;
  raise exception 'UNEXPECTEDLY ALLOWED: %', message;
end;
$$;

grant execute on all functions in schema test_payments to authenticated, service_role;

select test_payments.assert(to_regclass('public.payment_attempts') is not null, 'payment_attempts exists');

insert into auth.users (id, email) values ('95000000-0000-0000-0000-000000000001', 'payment-mentee@test.invalid');
update public.mentee_profiles set onboarding_completed_at = now() where user_id = '95000000-0000-0000-0000-000000000001';
insert into public.digital_products (id, name, slug, description, image_path, price_amount)
values ('95100000-0000-0000-0000-000000000001', 'Payment Handbook', 'payment-handbook', 'Payment fixture.', 'products/payment-handbook.webp', 75000);

set local role authenticated;
select set_config('request.jwt.claim.sub', '95000000-0000-0000-0000-000000000001', true);
select public.add_cart_item('95100000-0000-0000-0000-000000000001');
select public.create_order_from_cart((select id from public.carts where user_id = auth.uid() and status = 'active'));
select test_payments.denied($$select count(*) from public.payment_attempts$$, 'authenticated client reads Payment Attempts');
select test_payments.denied(
  $$insert into public.payment_attempts (order_id,provider,provider_order_id,gross_amount,status) select id,'midtrans','CLIENT-CONTROLLED',1,'paid' from public.orders limit 1$$,
  'authenticated client creates Payment Attempt'
);
select test_payments.denied(
  $$select public.claim_midtrans_snap_creation('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002')$$,
  'authenticated client claims Snap creation'
);
reset role;

set local role service_role;
select public.reserve_midtrans_payment_attempt((select id from public.orders where user_id = '95000000-0000-0000-0000-000000000001'));
select public.reserve_midtrans_payment_attempt((select id from public.orders where user_id = '95000000-0000-0000-0000-000000000001'));
select test_payments.assert(
  (select count(*) = 1 and bool_and(gross_amount = 75000 and provider = 'midtrans') from public.payment_attempts),
  'reservation reuses one active attempt with trusted Order total'
);
select test_payments.assert(
  (select bool_and(provider_order_id ~ '^STRAT-[0-9a-f]{32}$' and char_length(provider_order_id) < 50) from public.payment_attempts),
  'provider Order ID is server-generated and within Midtrans limit'
);
select set_config('test.first_attempt', (select id::text from public.payment_attempts), true);
select set_config('test.first_provider_order', (select provider_order_id from public.payment_attempts), true);

select test_payments.assert(
  public.claim_midtrans_snap_creation(
    current_setting('test.first_attempt')::uuid,
    '95200000-0000-0000-0000-000000000001'
  ),
  'first creation claim wins'
);
select test_payments.assert(
  not public.claim_midtrans_snap_creation(
    current_setting('test.first_attempt')::uuid,
    '95200000-0000-0000-0000-000000000002'
  ),
  'concurrent creation claim has exactly one winner'
);
select public.store_midtrans_snap_token(
  current_setting('test.first_attempt')::uuid,
  '95200000-0000-0000-0000-000000000001',
  'fixture-snap-token'
);
select test_payments.assert(
  (select status = 'pending'
      and snap_token = 'fixture-snap-token'
      and snap_token_created_at is not null
      and snap_token_expires_at = snap_token_created_at + interval '24 hours'
      and snap_creation_claim_token is null
    from public.payment_attempts
    where id = current_setting('test.first_attempt')::uuid),
  'matching claim stores a bounded Snap token and releases the claim'
);

update public.payment_attempts
set snap_token_expires_at = now() - interval '1 minute'
where id = current_setting('test.first_attempt')::uuid;
select public.reserve_midtrans_payment_attempt((select id from public.orders where user_id = '95000000-0000-0000-0000-000000000001'));
select test_payments.assert(
  (select status = 'expired' from public.payment_attempts where id = current_setting('test.first_attempt')::uuid),
  'expired Snap token retires the old attempt'
);
select test_payments.assert(
  (select count(*) = 2 from public.payment_attempts)
  and (select count(*) = 1 from public.payment_attempts where status in ('creating','pending')),
  'expired token retry creates exactly one fresh active attempt for the same Order'
);
select set_config('test.retry_attempt', (select id::text from public.payment_attempts where status = 'creating'), true);
select test_payments.assert(
  (select provider_order_id <> current_setting('test.first_provider_order')
    from public.payment_attempts where id = current_setting('test.retry_attempt')::uuid),
  'retry receives a fresh provider Order ID'
);

select test_payments.assert(
  public.claim_midtrans_snap_creation(
    current_setting('test.retry_attempt')::uuid,
    '95200000-0000-0000-0000-000000000003'
  ),
  'retry attempt can be claimed'
);
select test_payments.assert(
  not public.release_midtrans_snap_creation(
    current_setting('test.retry_attempt')::uuid,
    '95200000-0000-0000-0000-000000000004'
  ),
  'non-owner cannot release another request creation claim'
);
update public.payment_attempts
set snap_creation_claim_expires_at = now() - interval '1 second'
where id = current_setting('test.retry_attempt')::uuid;
select test_payments.assert(
  public.claim_midtrans_snap_creation(
    current_setting('test.retry_attempt')::uuid,
    '95200000-0000-0000-0000-000000000004'
  ),
  'stale creation claim can be recovered'
);
select test_payments.assert(
  public.release_midtrans_snap_creation(
    current_setting('test.retry_attempt')::uuid,
    '95200000-0000-0000-0000-000000000004'
  ),
  'matching request can release its creation claim after provider failure'
);
select test_payments.assert(
  public.claim_midtrans_snap_creation(
    current_setting('test.retry_attempt')::uuid,
    '95200000-0000-0000-0000-000000000005'
  ),
  'released attempt is retryable'
);
select public.store_midtrans_snap_token(
  current_setting('test.retry_attempt')::uuid,
  '95200000-0000-0000-0000-000000000005',
  'retry-snap-token'
);

select public.apply_midtrans_payment_status(
  current_setting('test.retry_attempt')::uuid, 'paid', 'settlement', 'midtrans-transaction-1', null, 'bank_transfer'
);
select test_payments.assert(
  (select status = 'paid' from public.payment_attempts where id = current_setting('test.retry_attempt')::uuid)
  and (select status = 'paid' and paid_at is not null from public.orders),
  'trusted paid transition marks attempt and Order paid'
);
select set_config('test.paid_at', (select paid_at::text from public.orders), true);

select public.apply_midtrans_payment_status(
  current_setting('test.retry_attempt')::uuid, 'paid', 'settlement', 'midtrans-transaction-1', null, 'bank_transfer'
);
select test_payments.assert(
  (select paid_at::text = current_setting('test.paid_at') from public.orders),
  'duplicate paid notification preserves paid_at'
);

select public.apply_midtrans_payment_status(
  current_setting('test.retry_attempt')::uuid, 'pending', 'pending', 'midtrans-transaction-1', null, 'bank_transfer'
);
select test_payments.assert(
  (select status = 'paid' from public.payment_attempts where id = current_setting('test.retry_attempt')::uuid)
  and (select status = 'paid' and paid_at::text = current_setting('test.paid_at') from public.orders),
  'stale pending notification cannot downgrade paid state'
);
reset role;

rollback;
select 'PASS: Payment Attempt expiry, claim ownership, retry, and monotonic Order transitions' as result;
