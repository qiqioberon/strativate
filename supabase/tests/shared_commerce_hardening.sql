-- Focused regression coverage for Shared Commerce hardening.
-- This intentionally stays single-session; dedicated multi-connection stress testing is out of scope.
begin;

create schema test_commerce_hardening;
grant usage on schema test_commerce_hardening to authenticated, service_role;

create function test_commerce_hardening.assert(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if ok is distinct from true then
    raise exception 'ASSERTION FAILED: %', message;
  end if;
end;
$$;

create function test_commerce_hardening.denied(command text, message text)
returns void
language plpgsql
as $$
begin
  begin
    execute command;
  exception
    when insufficient_privilege or check_violation or invalid_parameter_value or raise_exception or unique_violation then
      return;
  end;
  raise exception 'UNEXPECTEDLY ALLOWED: %', message;
end;
$$;

grant execute on all functions in schema test_commerce_hardening to authenticated, service_role;

insert into auth.users(id, email)
values ('aa100000-0000-0000-0000-000000000001', 'commerce-hardening@test.invalid');

update public.mentee_profiles
set onboarding_completed_at = now()
where user_id = 'aa100000-0000-0000-0000-000000000001';

insert into public.digital_products(
  id, name, slug, description, image_path, price_amount,
  content_type, content_path, content_mime_type, content_file_name,
  content_size_bytes, page_count, is_published
) values
(
  'aa110000-0000-0000-0000-000000000001',
  'Lifecycle Handbook',
  'lifecycle-handbook',
  'Digital Product fixture for purchase lifecycle regression.',
  'products/lifecycle-handbook.webp',
  100000,
  'pdf',
  'products/hardening/lifecycle-handbook.pdf',
  'application/pdf',
  'lifecycle-handbook.pdf',
  4096,
  10,
  true
),
(
  'aa110000-0000-0000-0000-000000000002',
  'Reservation Handbook',
  'reservation-handbook',
  'Digital Product fixture for discount reservation expiry regression.',
  'products/reservation-handbook.webp',
  120000,
  'pdf',
  'products/hardening/reservation-handbook.pdf',
  'application/pdf',
  'reservation-handbook.pdf',
  4096,
  12,
  true
);

insert into public.commerce_discount_codes(
  id, code, description, discount_type, discount_value,
  minimum_subtotal_amount, max_redemptions, is_active, scope
) values (
  'aa120000-0000-0000-0000-000000000001',
  'HARDEN20',
  'Hardening fixture',
  'fixed',
  20000,
  0,
  1,
  true,
  'digital_products'
);

insert into public.commerce_discount_code_categories(discount_code_id, category)
values ('aa120000-0000-0000-0000-000000000001', 'digital_products');

-- First lifecycle: pending_payment is active and blocks a second checkout.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aa100000-0000-0000-0000-000000000001', true);

select public.add_cart_item('aa110000-0000-0000-0000-000000000001');
select public.create_order_from_cart(
  (select id from public.carts where user_id = auth.uid() and status = 'active')
);

select set_config(
  'test.hardening.order_failed',
  (select id::text from public.orders
   where user_id = auth.uid() and status = 'pending_payment'
   order by created_at desc, id desc limit 1),
  true
);

select test_commerce_hardening.assert(
  public.get_active_digital_product_order('aa110000-0000-0000-0000-000000000001')
    = current_setting('test.hardening.order_failed')::uuid,
  'pending Digital Product Order is discoverable for the active-payment UX'
);

select public.get_or_create_active_cart();

select test_commerce_hardening.denied(
  $$select public.add_cart_item('aa110000-0000-0000-0000-000000000001')$$,
  'pending Digital Product purchase was added to another Cart'
);

-- Bypass the add-to-cart guard to prove order creation itself is authoritative.
reset role;
insert into public.cart_items(cart_id, commerce_item_id)
select c.id, 'aa110000-0000-0000-0000-000000000001'
from public.carts c
where c.user_id = 'aa100000-0000-0000-0000-000000000001'
  and c.status = 'active';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aa100000-0000-0000-0000-000000000001', true);
select test_commerce_hardening.denied(
  $$select public.create_order_from_cart(
    (select id from public.carts where user_id = auth.uid() and status = 'active')
  )$$,
  'second pending Digital Product Order was created by bypassing the UI/cart guard'
);
reset role;

-- The canonical pending Order transitions to payment_failed.
set local role service_role;
select public.reserve_midtrans_payment_attempt(current_setting('test.hardening.order_failed')::uuid);
select set_config(
  'test.hardening.attempt_failed',
  (select id::text from public.payment_attempts
   where order_id = current_setting('test.hardening.order_failed')::uuid
   order by created_at desc, id desc limit 1),
  true
);
select public.apply_midtrans_payment_status(
  current_setting('test.hardening.attempt_failed')::uuid,
  'failed', 'deny', 'hardening-failed', null, 'bank_transfer'
);
select test_commerce_hardening.denied(
  format(
    $$select public.reserve_midtrans_payment_attempt(%L::uuid)$$,
    current_setting('test.hardening.order_failed')
  ),
  'payment_failed Order was silently reopened'
);
select test_commerce_hardening.assert(
  (select status = 'payment_failed' from public.orders where id = current_setting('test.hardening.order_failed')::uuid),
  'payment_failed Order remains terminal'
);
reset role;

-- A fresh checkout is allowed after payment_failed.
reset role;
delete from public.cart_items
where cart_id = (
  select id from public.carts
  where user_id = 'aa100000-0000-0000-0000-000000000001'
    and status = 'active'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aa100000-0000-0000-0000-000000000001', true);
select public.add_cart_item('aa110000-0000-0000-0000-000000000001');
select public.create_order_from_cart(
  (select id from public.carts where user_id = auth.uid() and status = 'active')
);
select set_config(
  'test.hardening.order_expired',
  (select id::text from public.orders
   where user_id = auth.uid() and status = 'pending_payment'
   order by created_at desc, id desc limit 1),
  true
);
reset role;

set local role service_role;
select public.reserve_midtrans_payment_attempt(current_setting('test.hardening.order_expired')::uuid);
select set_config(
  'test.hardening.attempt_expired',
  (select id::text from public.payment_attempts
   where order_id = current_setting('test.hardening.order_expired')::uuid
   order by created_at desc, id desc limit 1),
  true
);
select public.apply_midtrans_payment_status(
  current_setting('test.hardening.attempt_expired')::uuid,
  'expired', 'expire', 'hardening-expired', null, 'bank_transfer'
);
select test_commerce_hardening.denied(
  format(
    $$select public.reserve_midtrans_payment_attempt(%L::uuid)$$,
    current_setting('test.hardening.order_expired')
  ),
  'expired Order was silently reopened'
);
select test_commerce_hardening.assert(
  (select status = 'expired' from public.orders where id = current_setting('test.hardening.order_expired')::uuid),
  'expired Order remains terminal'
);
reset role;

-- A fresh checkout is allowed after expired, then cancelled is also terminal.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aa100000-0000-0000-0000-000000000001', true);
select public.add_cart_item('aa110000-0000-0000-0000-000000000001');
select public.create_order_from_cart(
  (select id from public.carts where user_id = auth.uid() and status = 'active')
);
select set_config(
  'test.hardening.order_cancelled',
  (select id::text from public.orders
   where user_id = auth.uid() and status = 'pending_payment'
   order by created_at desc, id desc limit 1),
  true
);
reset role;

set local role service_role;
select public.reserve_midtrans_payment_attempt(current_setting('test.hardening.order_cancelled')::uuid);
select set_config(
  'test.hardening.attempt_cancelled',
  (select id::text from public.payment_attempts
   where order_id = current_setting('test.hardening.order_cancelled')::uuid
   order by created_at desc, id desc limit 1),
  true
);
select public.apply_midtrans_payment_status(
  current_setting('test.hardening.attempt_cancelled')::uuid,
  'cancelled', 'cancel', 'hardening-cancelled', null, 'bank_transfer'
);
select test_commerce_hardening.denied(
  format(
    $$select public.reserve_midtrans_payment_attempt(%L::uuid)$$,
    current_setting('test.hardening.order_cancelled')
  ),
  'cancelled Order was silently reopened'
);
select test_commerce_hardening.assert(
  (select status = 'cancelled' from public.orders where id = current_setting('test.hardening.order_cancelled')::uuid),
  'cancelled Order remains terminal'
);
reset role;

-- A final fresh checkout may be paid; paid ownership remains non-purchasable.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aa100000-0000-0000-0000-000000000001', true);
select public.add_cart_item('aa110000-0000-0000-0000-000000000001');
select public.create_order_from_cart(
  (select id from public.carts where user_id = auth.uid() and status = 'active')
);
select set_config(
  'test.hardening.order_paid',
  (select id::text from public.orders
   where user_id = auth.uid() and status = 'pending_payment'
   order by created_at desc, id desc limit 1),
  true
);
reset role;

set local role service_role;
select public.reserve_midtrans_payment_attempt(current_setting('test.hardening.order_paid')::uuid);
select set_config(
  'test.hardening.attempt_paid',
  (select id::text from public.payment_attempts
   where order_id = current_setting('test.hardening.order_paid')::uuid
   order by created_at desc, id desc limit 1),
  true
);
select public.apply_midtrans_payment_status(
  current_setting('test.hardening.attempt_paid')::uuid,
  'paid', 'settlement', 'hardening-paid', null, 'bank_transfer'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aa100000-0000-0000-0000-000000000001', true);
select public.get_or_create_active_cart();
select test_commerce_hardening.assert(
  public.get_active_digital_product_order('aa110000-0000-0000-0000-000000000001') is null,
  'paid ownership is not presented as a pending active payment'
);
select test_commerce_hardening.denied(
  $$select public.add_cart_item('aa110000-0000-0000-0000-000000000001')$$,
  'paid Digital Product ownership was repurchased'
);
reset role;

-- Discounted Order: a valid reservation can create a payment attempt, and its
-- local Snap validity is capped by the reservation deadline.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aa100000-0000-0000-0000-000000000001', true);
select public.add_cart_item('aa110000-0000-0000-0000-000000000002');
select public.apply_discount_code(
  (select id from public.carts where user_id = auth.uid() and status = 'active'),
  'HARDEN20'
);
select public.create_order_from_cart(
  (select id from public.carts where user_id = auth.uid() and status = 'active')
);
select public.get_or_create_active_cart();
select test_commerce_hardening.denied(
  $$select public.apply_discount_code(
    (select id from public.carts where user_id = auth.uid() and status = 'active'),
    'HARDEN20'
  )$$,
  'second active reservation for the same user and voucher was allowed'
);
select set_config(
  'test.hardening.discount_order',
  (select id::text from public.orders
   where user_id = auth.uid()
     and discount_code_id = 'aa120000-0000-0000-0000-000000000001'
   order by created_at desc, id desc limit 1),
  true
);
reset role;

set local role service_role;
select test_commerce_hardening.assert(
  (select count(*) = 1
   from public.commerce_discount_user_claims
   where user_id = 'aa100000-0000-0000-0000-000000000001'
     and discount_code_id = 'aa120000-0000-0000-0000-000000000001'
     and status = 'reserved'),
  'first checkout creates one active user voucher reservation claim'
);
select public.reserve_midtrans_payment_attempt(current_setting('test.hardening.discount_order')::uuid);
select set_config(
  'test.hardening.discount_attempt',
  (select id::text from public.payment_attempts
   where order_id = current_setting('test.hardening.discount_order')::uuid
   order by created_at desc, id desc limit 1),
  true
);

select test_commerce_hardening.assert(
  (select pa.payment_expires_at = r.reserved_until
   from public.payment_attempts pa
   join public.commerce_discount_redemptions r on r.order_id = pa.order_id
   where pa.id = current_setting('test.hardening.discount_attempt')::uuid),
  'valid discounted payment attempt inherits the reservation deadline'
);

select test_commerce_hardening.assert(
  (select r.reserved_until = r.created_at + public.commerce_discount_reservation_ttl()
   from public.commerce_discount_redemptions r
   where r.order_id = current_setting('test.hardening.discount_order')::uuid)
  and public.commerce_discount_reservation_ttl() = interval '60 minutes',
  'discount reservation uses the single 60-minute TTL source of truth'
);

select test_commerce_hardening.assert(
  public.claim_midtrans_snap_creation(
    current_setting('test.hardening.discount_attempt')::uuid,
    'aa150000-0000-0000-0000-000000000001'
  ),
  'valid discounted payment attempt can claim Snap creation'
);
select public.store_midtrans_snap_token(
  current_setting('test.hardening.discount_attempt')::uuid,
  'aa150000-0000-0000-0000-000000000001',
  'hardening-discount-token'
);

select test_commerce_hardening.assert(
  (select pa.snap_token_expires_at <= r.reserved_until
   from public.payment_attempts pa
   join public.commerce_discount_redemptions r on r.order_id = pa.order_id
   where pa.id = current_setting('test.hardening.discount_attempt')::uuid),
  'stored Snap token metadata never outlives the discount reservation'
);
reset role;

-- Expire the reservation, then prove a late paid transition cannot revive it.
update public.commerce_discount_redemptions
set reserved_until = now() - interval '1 minute'
where order_id = current_setting('test.hardening.discount_order')::uuid;

set local role service_role;
select public.apply_midtrans_payment_status(
  current_setting('test.hardening.discount_attempt')::uuid,
  'paid',
  'settlement',
  'late-paid-transaction',
  null,
  'bank_transfer',
  (
    select reserved_until + interval '5 seconds'
    from public.commerce_discount_redemptions
    where order_id = current_setting('test.hardening.discount_order')::uuid
  )
);

select test_commerce_hardening.assert(
  (select status = 'expired'
   from public.orders
   where id = current_setting('test.hardening.discount_order')::uuid)
  and
  (select status = 'expired'
   from public.payment_attempts
   where id = current_setting('test.hardening.discount_attempt')::uuid)
  and
  (select status = 'released'
   from public.commerce_discount_redemptions
   where order_id = current_setting('test.hardening.discount_order')::uuid),
  'late paid transition durably expires the old discounted lifecycle'
);

select test_commerce_hardening.denied(
  format(
    $$select public.reserve_midtrans_payment_attempt(%L::uuid)$$,
    current_setting('test.hardening.discount_order')
  ),
  'expired discounted Order created or reused a payment attempt'
);

select test_commerce_hardening.assert(
  (select status = 'expired'
   from public.orders
   where id = current_setting('test.hardening.discount_order')::uuid)
  and
  (select status = 'expired'
   from public.payment_attempts
   where id = current_setting('test.hardening.discount_attempt')::uuid)
  and
  (select status = 'released'
   from public.commerce_discount_redemptions
   where order_id = current_setting('test.hardening.discount_order')::uuid)
  and
  not exists (
    select 1
    from public.commerce_digital_product_purchase_claims
    where order_id = current_setting('test.hardening.discount_order')::uuid
  ),
  'expired discounted Order durably releases reservation capacity and purchase claim'
);

select test_commerce_hardening.assert(
  not exists (
    select 1
    from public.commerce_discount_user_claims
    where user_id = 'aa100000-0000-0000-0000-000000000001'
      and discount_code_id = 'aa120000-0000-0000-0000-000000000001'
  ),
  'released unpaid reservation does not consume the user lifetime voucher claim'
);
reset role;

-- max_redemptions=1 capacity can be legitimately reassigned only through a new checkout.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aa100000-0000-0000-0000-000000000001', true);
select public.add_cart_item('aa110000-0000-0000-0000-000000000002');
select test_commerce_hardening.assert(
  (select total_amount = 100000
   from public.apply_discount_code(
     (select id from public.carts where user_id = auth.uid() and status = 'active'),
     'HARDEN20'
   )),
  'released expired reservation restores max_redemptions capacity for a new checkout'
);
select public.create_order_from_cart(
  (select id from public.carts where user_id = auth.uid() and status = 'active')
);
select set_config(
  'test.hardening.discount_retry_order',
  (select id::text from public.orders
   where user_id = auth.uid()
     and discount_code_id = 'aa120000-0000-0000-0000-000000000001'
     and status = 'pending_payment'
   order by created_at desc, id desc limit 1),
  true
);
reset role;

set local role service_role;
select test_commerce_hardening.assert(
  (select count(*) = 1
   from public.commerce_discount_redemptions
   where discount_code_id = 'aa120000-0000-0000-0000-000000000001'
     and status = 'reserved')
  and
  (select count(*) = 1
   from public.commerce_discount_redemptions
   where discount_code_id = 'aa120000-0000-0000-0000-000000000001'
     and status = 'released'),
  'new checkout creates a new reservation without re-reserving the expired Order'
);
select public.reserve_midtrans_payment_attempt(
  current_setting('test.hardening.discount_retry_order')::uuid
);
select public.apply_midtrans_payment_status(
  (select id from public.payment_attempts
   where order_id = current_setting('test.hardening.discount_retry_order')::uuid
   order by created_at desc, id desc limit 1),
  'paid',
  'settlement',
  'successful-voucher-redemption',
  null,
  'bank_transfer',
  now()
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aa100000-0000-0000-0000-000000000001', true);
select public.get_or_create_active_cart();
select test_commerce_hardening.denied(
  $$select public.apply_discount_code(
    (select id from public.carts where user_id = auth.uid() and status = 'active'),
    'HARDEN20'
  )$$,
  'redeemed voucher was applied again by the same user'
);
reset role;

set local role service_role;
select test_commerce_hardening.assert(
  (select status = 'redeemed'
   from public.commerce_discount_user_claims
   where user_id = 'aa100000-0000-0000-0000-000000000001'
     and discount_code_id = 'aa120000-0000-0000-0000-000000000001'),
  'paid voucher use permanently redeems the user voucher claim'
);
reset role;

rollback;
select 'PASS: Shared Commerce snapshot, active purchase lifecycle, terminal Orders, lock ordering, and discount expiry hardening' as result;
