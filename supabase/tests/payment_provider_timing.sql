-- Focused provider-timing regression coverage for discounted paid reconciliation.
begin;

create schema test_provider_timing;
grant usage on schema test_provider_timing to authenticated, service_role;

create function test_provider_timing.assert(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if ok is distinct from true then
    raise exception 'ASSERTION FAILED: %', message;
  end if;
end;
$$;

grant execute on function test_provider_timing.assert(boolean, text) to authenticated, service_role;

insert into auth.users(id, email)
values ('ab100000-0000-0000-0000-000000000001', 'provider-timing@test.invalid');

update public.mentee_profiles
set onboarding_completed_at = now()
where user_id = 'ab100000-0000-0000-0000-000000000001';

insert into public.digital_products(
  id, name, slug, description, image_path, price_amount,
  content_type, content_path, content_mime_type, content_file_name,
  content_size_bytes, page_count, is_published
) values
('ab110000-0000-0000-0000-000000000001','Late Valid','late-valid','fixture','products/late-valid.webp',100000,'pdf','products/timing/late-valid.pdf','application/pdf','late-valid.pdf',1024,1,true),
('ab110000-0000-0000-0000-000000000002','Expired Reconcile','expired-reconcile','fixture','products/expired-reconcile.webp',100000,'pdf','products/timing/expired-reconcile.pdf','application/pdf','expired-reconcile.pdf',1024,1,true),
('ab110000-0000-0000-0000-000000000003','Truly Late','truly-late','fixture','products/truly-late.webp',100000,'pdf','products/timing/truly-late.pdf','application/pdf','truly-late.pdf',1024,1,true),
('ab110000-0000-0000-0000-000000000004','Missing Timing','missing-timing','fixture','products/missing-timing.webp',100000,'pdf','products/timing/missing-timing.pdf','application/pdf','missing-timing.pdf',1024,1,true),
('ab110000-0000-0000-0000-000000000005','No Discount','no-discount','fixture','products/no-discount.webp',100000,'pdf','products/timing/no-discount.pdf','application/pdf','no-discount.pdf',1024,1,true);

insert into public.commerce_discount_codes(
  id, code, description, discount_type, discount_value,
  minimum_subtotal_amount, max_redemptions, is_active, scope
) values
('ab120000-0000-0000-0000-000000000001','LATEOK','fixture','fixed',10000,0,5,true,'digital_products'),
('ab120000-0000-0000-0000-000000000002','RECONCILE','fixture','fixed',10000,0,5,true,'digital_products'),
('ab120000-0000-0000-0000-000000000003','TOOLATE','fixture','fixed',10000,0,5,true,'digital_products'),
('ab120000-0000-0000-0000-000000000004','NOTIME','fixture','fixed',10000,0,5,true,'digital_products');

insert into public.commerce_discount_code_categories(discount_code_id, category)
select id, 'digital_products'
from public.commerce_discount_codes
where id in (
  'ab120000-0000-0000-0000-000000000001',
  'ab120000-0000-0000-0000-000000000002',
  'ab120000-0000-0000-0000-000000000003',
  'ab120000-0000-0000-0000-000000000004'
);

-- Helper pattern: each scenario receives a fresh active Cart.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ab100000-0000-0000-0000-000000000001', true);
select public.add_cart_item('ab110000-0000-0000-0000-000000000001');
select public.apply_discount_code((select id from public.carts where user_id=auth.uid() and status='active'),'LATEOK');
select public.create_order_from_cart((select id from public.carts where user_id=auth.uid() and status='active'));
select set_config('test.timing.valid_order',(select id::text from public.orders where user_id=auth.uid() and discount_code_id='ab120000-0000-0000-0000-000000000001' order by created_at desc limit 1),true);
reset role;

set local role service_role;
select public.reserve_midtrans_payment_attempt(current_setting('test.timing.valid_order')::uuid);
select set_config('test.timing.valid_attempt',(select id::text from public.payment_attempts where order_id=current_setting('test.timing.valid_order')::uuid order by created_at desc limit 1),true);
update public.commerce_discount_redemptions
set reserved_until = now() - interval '2 seconds'
where order_id=current_setting('test.timing.valid_order')::uuid;
update public.payment_attempts
set payment_expires_at=(select reserved_until from public.commerce_discount_redemptions where order_id=current_setting('test.timing.valid_order')::uuid)
where id=current_setting('test.timing.valid_attempt')::uuid;
select public.apply_midtrans_payment_status(
  current_setting('test.timing.valid_attempt')::uuid,
  'paid','settlement','valid-late-provider',null,'bank_transfer',
  (select reserved_until - interval '2 seconds' from public.commerce_discount_redemptions where order_id=current_setting('test.timing.valid_order')::uuid)
);
select test_provider_timing.assert(
  (select status='paid' from public.orders where id=current_setting('test.timing.valid_order')::uuid)
  and (select status='paid' from public.payment_attempts where id=current_setting('test.timing.valid_attempt')::uuid)
  and (select status='redeemed' from public.commerce_discount_redemptions where order_id=current_setting('test.timing.valid_order')::uuid)
  and (select status='redeemed' from public.commerce_discount_user_claims where order_id=current_setting('test.timing.valid_order')::uuid),
  'paid-before-deadline is accepted even after local receipt time crossed the deadline'
);
select set_config('test.timing.valid_paid_at',(select paid_at::text from public.orders where id=current_setting('test.timing.valid_order')::uuid),true);

-- Duplicate paid remains idempotent; later terminal provider events cannot downgrade paid.
select public.apply_midtrans_payment_status(
  current_setting('test.timing.valid_attempt')::uuid,
  'paid','settlement','valid-late-provider',null,'bank_transfer',
  (select paid_at from public.orders where id=current_setting('test.timing.valid_order')::uuid)
);
select public.apply_midtrans_payment_status(
  current_setting('test.timing.valid_attempt')::uuid,
  'failed','deny','valid-late-provider',null,'bank_transfer',null
);
select test_provider_timing.assert(
  (select status='paid' and paid_at::text=current_setting('test.timing.valid_paid_at') from public.orders where id=current_setting('test.timing.valid_order')::uuid)
  and (select status='paid' from public.payment_attempts where id=current_setting('test.timing.valid_attempt')::uuid),
  'duplicate paid is idempotent and out-of-order terminal status does not downgrade paid'
);
reset role;

-- Local deadline expiry may be reconciled when provider success actually occurred before it.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ab100000-0000-0000-0000-000000000001', true);
select public.add_cart_item('ab110000-0000-0000-0000-000000000002');
select public.apply_discount_code((select id from public.carts where user_id=auth.uid() and status='active'),'RECONCILE');
select public.create_order_from_cart((select id from public.carts where user_id=auth.uid() and status='active'));
select set_config('test.timing.reconcile_order',(select id::text from public.orders where user_id=auth.uid() and discount_code_id='ab120000-0000-0000-0000-000000000002' order by created_at desc limit 1),true);
reset role;

set local role service_role;
select public.reserve_midtrans_payment_attempt(current_setting('test.timing.reconcile_order')::uuid);
select set_config('test.timing.reconcile_attempt',(select id::text from public.payment_attempts where order_id=current_setting('test.timing.reconcile_order')::uuid order by created_at desc limit 1),true);
update public.commerce_discount_redemptions
set reserved_until=now()-interval '2 seconds'
where order_id=current_setting('test.timing.reconcile_order')::uuid;
update public.payment_attempts
set payment_expires_at=(select reserved_until from public.commerce_discount_redemptions where order_id=current_setting('test.timing.reconcile_order')::uuid)
where id=current_setting('test.timing.reconcile_attempt')::uuid;
select test_provider_timing.assert(
  public.reserve_midtrans_payment_attempt(current_setting('test.timing.reconcile_order')::uuid) is null,
  'local deadline cleanup expires the old discounted lifecycle'
);
select test_provider_timing.assert(
  (select status='expired' from public.orders where id=current_setting('test.timing.reconcile_order')::uuid)
  and (select status='released' from public.commerce_discount_redemptions where order_id=current_setting('test.timing.reconcile_order')::uuid)
  and not exists(select 1 from public.commerce_discount_user_claims where order_id=current_setting('test.timing.reconcile_order')::uuid),
  'local expiry releases redemption and user claim before late provider reconciliation'
);
select public.apply_midtrans_payment_status(
  current_setting('test.timing.reconcile_attempt')::uuid,
  'paid','settlement','reconciled-provider',null,'bank_transfer',
  (select reserved_until-interval '2 seconds' from public.commerce_discount_redemptions where order_id=current_setting('test.timing.reconcile_order')::uuid)
);
select test_provider_timing.assert(
  (select status='paid' from public.orders where id=current_setting('test.timing.reconcile_order')::uuid)
  and (select status='paid' from public.payment_attempts where id=current_setting('test.timing.reconcile_attempt')::uuid)
  and (select status='redeemed' from public.commerce_discount_redemptions where order_id=current_setting('test.timing.reconcile_order')::uuid)
  and (select status='redeemed' from public.commerce_discount_user_claims where order_id=current_setting('test.timing.reconcile_order')::uuid),
  'provider-confirmed pre-deadline success safely reconciles a locally expired Order'
);
reset role;

-- Truly late provider success remains invalid and releases the voucher.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ab100000-0000-0000-0000-000000000001', true);
select public.add_cart_item('ab110000-0000-0000-0000-000000000003');
select public.apply_discount_code((select id from public.carts where user_id=auth.uid() and status='active'),'TOOLATE');
select public.create_order_from_cart((select id from public.carts where user_id=auth.uid() and status='active'));
select set_config('test.timing.late_order',(select id::text from public.orders where user_id=auth.uid() and discount_code_id='ab120000-0000-0000-0000-000000000003' order by created_at desc limit 1),true);
reset role;

set local role service_role;
select public.reserve_midtrans_payment_attempt(current_setting('test.timing.late_order')::uuid);
select set_config('test.timing.late_attempt',(select id::text from public.payment_attempts where order_id=current_setting('test.timing.late_order')::uuid order by created_at desc limit 1),true);
update public.commerce_discount_redemptions set reserved_until=now()-interval '10 seconds' where order_id=current_setting('test.timing.late_order')::uuid;
update public.payment_attempts set payment_expires_at=(select reserved_until from public.commerce_discount_redemptions where order_id=current_setting('test.timing.late_order')::uuid) where id=current_setting('test.timing.late_attempt')::uuid;
select public.apply_midtrans_payment_status(
  current_setting('test.timing.late_attempt')::uuid,
  'paid','settlement','truly-late-provider',null,'bank_transfer',
  (select reserved_until+interval '5 seconds' from public.commerce_discount_redemptions where order_id=current_setting('test.timing.late_order')::uuid)
);
select test_provider_timing.assert(
  (select status='expired' from public.orders where id=current_setting('test.timing.late_order')::uuid)
  and (select status='expired' from public.payment_attempts where id=current_setting('test.timing.late_attempt')::uuid)
  and (select status='released' from public.commerce_discount_redemptions where order_id=current_setting('test.timing.late_order')::uuid)
  and not exists(select 1 from public.commerce_discount_user_claims where order_id=current_setting('test.timing.late_order')::uuid),
  'provider success after the deadline is rejected and does not consume the voucher'
);
reset role;

-- Missing provider success timing fails closed without substituting local now().
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ab100000-0000-0000-0000-000000000001', true);
select public.add_cart_item('ab110000-0000-0000-0000-000000000004');
select public.apply_discount_code((select id from public.carts where user_id=auth.uid() and status='active'),'NOTIME');
select public.create_order_from_cart((select id from public.carts where user_id=auth.uid() and status='active'));
select set_config('test.timing.missing_order',(select id::text from public.orders where user_id=auth.uid() and discount_code_id='ab120000-0000-0000-0000-000000000004' order by created_at desc limit 1),true);
reset role;

set local role service_role;
select public.reserve_midtrans_payment_attempt(current_setting('test.timing.missing_order')::uuid);
select set_config('test.timing.missing_attempt',(select id::text from public.payment_attempts where order_id=current_setting('test.timing.missing_order')::uuid order by created_at desc limit 1),true);
select public.apply_midtrans_payment_status(
  current_setting('test.timing.missing_attempt')::uuid,
  'paid','settlement','missing-time-provider',null,'bank_transfer',null
);
select test_provider_timing.assert(
  (select status='pending_payment' from public.orders where id=current_setting('test.timing.missing_order')::uuid)
  and (select status in ('creating','pending') from public.payment_attempts where id=current_setting('test.timing.missing_attempt')::uuid)
  and (select status='reserved' from public.commerce_discount_redemptions where order_id=current_setting('test.timing.missing_order')::uuid),
  'missing provider success time does not mark a discounted Order paid'
);
reset role;

-- Non-discounted Orders preserve existing paid semantics and do not require voucher timing.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ab100000-0000-0000-0000-000000000001', true);
select public.add_cart_item('ab110000-0000-0000-0000-000000000005');
select public.create_order_from_cart((select id from public.carts where user_id=auth.uid() and status='active'));
select set_config('test.timing.plain_order',(select id::text from public.orders where user_id=auth.uid() and discount_code_id is null order by created_at desc limit 1),true);
reset role;

set local role service_role;
select public.reserve_midtrans_payment_attempt(current_setting('test.timing.plain_order')::uuid);
select public.apply_midtrans_payment_status(
  (select id from public.payment_attempts where order_id=current_setting('test.timing.plain_order')::uuid order by created_at desc limit 1),
  'paid','settlement','plain-provider',null,'bank_transfer',null
);
select test_provider_timing.assert(
  (select status='paid' from public.orders where id=current_setting('test.timing.plain_order')::uuid),
  'non-discounted paid transition does not require voucher timing'
);
reset role;

rollback;
select 'PASS: provider payment timing controls discounted late-paid reconciliation' as result;
