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
select public.store_midtrans_snap_token((select id from public.payment_attempts), 'fixture-snap-token');
select test_payments.assert(
  (select status = 'pending' and snap_token = 'fixture-snap-token' from public.payment_attempts),
  'Snap token moves creating attempt to pending'
);

select public.apply_midtrans_payment_status(
  (select id from public.payment_attempts), 'paid', 'settlement', 'midtrans-transaction-1', null, 'bank_transfer'
);
select test_payments.assert(
  (select status = 'paid' from public.payment_attempts)
  and (select status = 'paid' and paid_at is not null from public.orders),
  'trusted paid transition marks attempt and Order paid'
);
select set_config('test.paid_at', (select paid_at::text from public.orders), true);

select public.apply_midtrans_payment_status(
  (select id from public.payment_attempts), 'paid', 'settlement', 'midtrans-transaction-1', null, 'bank_transfer'
);
select test_payments.assert(
  (select paid_at::text = current_setting('test.paid_at') from public.orders),
  'duplicate paid notification preserves paid_at'
);

select public.apply_midtrans_payment_status(
  (select id from public.payment_attempts), 'pending', 'pending', 'midtrans-transaction-1', null, 'bank_transfer'
);
select test_payments.assert(
  (select status = 'paid' from public.payment_attempts)
  and (select status = 'paid' and paid_at::text = current_setting('test.paid_at') from public.orders),
  'stale pending notification cannot downgrade paid state'
);
reset role;

rollback;
select 'PASS: Payment Attempt persistence and monotonic Order transitions' as result;
