-- Disposable database only. Verifies Digital Product-only discount scope and paid-only sales proof.
begin;

create schema test_digital_discounts;
grant usage on schema test_digital_discounts to anon, authenticated, service_role;

create function test_digital_discounts.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;

create function test_digital_discounts.denied(command text, message text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when insufficient_privilege or check_violation or invalid_parameter_value or raise_exception then return;
  end;
  raise exception 'UNEXPECTEDLY ALLOWED: %', message;
end;
$$;

grant execute on all functions in schema test_digital_discounts to anon, authenticated, service_role;

insert into auth.users (id, email, encrypted_password) values
  ('a1000000-0000-0000-0000-000000000001', 'discount-admin@test.invalid', 'hash'),
  ('a1000000-0000-0000-0000-000000000002', 'discount-mentee@test.invalid', 'hash');
update public.profiles set role = 'admin' where id = 'a1000000-0000-0000-0000-000000000001';
update public.mentee_profiles set onboarding_completed_at = now()
where user_id = 'a1000000-0000-0000-0000-000000000002';

insert into public.digital_products (
  id, name, slug, description, image_path, price_amount,
  content_type, content_path, content_mime_type, content_file_name,
  content_size_bytes, page_count, is_published, show_sales_count
) values
  ('a1100000-0000-0000-0000-000000000001', 'Discount Product A', 'discount-product-a', 'Fixture A.', 'products/discount-a.webp', 100000, 'pdf', 'products/discount/a.pdf', 'application/pdf', 'a.pdf', 100, 1, true, true),
  ('a1100000-0000-0000-0000-000000000002', 'Discount Product B', 'discount-product-b', 'Fixture B.', 'products/discount-b.webp', 50000, 'pdf', 'products/discount/b.pdf', 'application/pdf', 'b.pdf', 100, 1, true, false);

insert into public.commerce_discount_codes (
  id, code, description, discount_type, discount_value, minimum_subtotal_amount,
  max_redemptions, is_active, scope
) values
  ('a1200000-0000-0000-0000-000000000001', 'DPONLY', 'Digital Products only', 'fixed', 60000, 0, 1, true, 'digital_products'),
  ('a1200000-0000-0000-0000-000000000002', 'SELECTEDA', 'Selected A only', 'percentage', 10, 0, null, true, 'selected_digital_products'),
  ('a1200000-0000-0000-0000-000000000003', 'EXPIRED', 'Expired', 'percentage', 10, 0, null, true, 'digital_products');

update public.commerce_discount_codes
set ends_at = now() - interval '1 minute'
where id = 'a1200000-0000-0000-0000-000000000003';

insert into public.commerce_discount_code_products(discount_code_id, product_id)
values ('a1200000-0000-0000-0000-000000000002', 'a1100000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000002', true);

select public.add_cart_item('a1100000-0000-0000-0000-000000000001');
select public.add_cart_item('97300000-0000-0000-0000-000000000001');

select test_digital_discounts.assert(
  (select discount_amount = 60000 and subtotal_amount = 400000 and total_amount = 340000
   from public.apply_discount_code(
     (select id from public.carts where user_id = auth.uid() and status = 'active'),
     'dponly'
   )),
  'Digital Product code discounts only the eligible Digital Product subtotal'
);

select public.create_order_from_cart(
  (select id from public.carts where user_id = auth.uid() and status = 'active')
);

select test_digital_discounts.assert(
  (select subtotal_amount = 400000 and discount_amount = 60000 and total_amount = 340000
   from public.orders where user_id = auth.uid()),
  'Order total is recalculated authoritatively from eligible Digital Products only'
);

select test_digital_discounts.assert(
  (select unit_price_amount = 100000 and discounted_unit_price_amount = 40000
   from public.order_items
   where commerce_item_id = 'a1100000-0000-0000-0000-000000000001'),
  'eligible Digital Product receives the discount allocation'
);

select test_digital_discounts.assert(
  (select unit_price_amount = 300000 and discounted_unit_price_amount = 300000
   from public.order_items
   where commerce_item_id = '97300000-0000-0000-0000-000000000001'),
  'Private Mentoring price is never discounted by a Digital Product code'
);

select test_digital_discounts.assert(
  (select status = 'reserved' from public.commerce_discount_redemptions where order_id = (select id from public.orders where user_id = auth.uid()))
  and (select redemption_count = 0 from public.commerce_discount_codes where code = 'DPONLY'),
  'unpaid Orders reserve but do not permanently redeem the code'
);

reset role;

update public.orders
set status = 'paid', paid_at = now()
where user_id = 'a1000000-0000-0000-0000-000000000002';

select test_digital_discounts.assert(
  (select status = 'redeemed' and redeemed_at is not null
   from public.commerce_discount_redemptions
   where order_id = (select id from public.orders where user_id = 'a1000000-0000-0000-0000-000000000002'))
  and (select redemption_count = 1 from public.commerce_discount_codes where code = 'DPONLY'),
  'only paid Orders become successful redemptions'
);

-- Non-paid Order Items must never contribute to public sales proof.
insert into public.carts(id,user_id,status) values
  ('a1300000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','converted'),
  ('a1300000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002','converted'),
  ('a1300000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000002','converted'),
  ('a1300000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000002','converted');

insert into public.orders(id,user_id,cart_id,status,subtotal_amount,total_amount) values
  ('a1400000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','a1300000-0000-0000-0000-000000000001','pending_payment',100000,100000),
  ('a1400000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002','a1300000-0000-0000-0000-000000000002','payment_failed',100000,100000),
  ('a1400000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000002','a1300000-0000-0000-0000-000000000003','expired',100000,100000),
  ('a1400000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000002','a1300000-0000-0000-0000-000000000004','cancelled',100000,100000);

insert into public.order_items(order_id,commerce_item_id,item_kind_snapshot,name_snapshot,slug_snapshot,unit_price_amount,discounted_unit_price_amount)
select id,'a1100000-0000-0000-0000-000000000001','digital_product','Discount Product A','discount-product-a',100000,100000
from public.orders where id in (
  'a1400000-0000-0000-0000-000000000001',
  'a1400000-0000-0000-0000-000000000002',
  'a1400000-0000-0000-0000-000000000003',
  'a1400000-0000-0000-0000-000000000004'
);

set local role anon;
select test_digital_discounts.assert(
  (select sales_count = 1 from public.list_public_digital_product_sales()
   where product_id = 'a1100000-0000-0000-0000-000000000001'),
  'only the one real paid Digital Product Order Item is counted'
);
select test_digital_discounts.assert(
  not exists (
    select 1 from public.list_public_digital_product_sales()
    where product_id = 'a1100000-0000-0000-0000-000000000002'
  ),
  'show_sales_count=false exposes no public count'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000002', true);
select public.add_cart_item('a1100000-0000-0000-0000-000000000002');

select test_digital_discounts.denied(
  $$select public.apply_discount_code((select id from public.carts where user_id=auth.uid() and status='active'),'SELECTEDA')$$,
  'selected-product code cannot discount an incompatible Digital Product'
);
select test_digital_discounts.denied(
  $$select public.apply_discount_code((select id from public.carts where user_id=auth.uid() and status='active'),'EXPIRED')$$,
  'expired code'
);
select test_digital_discounts.denied(
  $$select public.apply_discount_code((select id from public.carts where user_id=auth.uid() and status='active'),'DOES-NOT-EXIST')$$,
  'unknown code'
);
select test_digital_discounts.denied(
  $$select public.apply_discount_code((select id from public.carts where user_id=auth.uid() and status='active'),'DPONLY')$$,
  'max redemption after one paid redemption'
);
reset role;

update public.digital_products
set price_amount = 999999
where id = 'a1100000-0000-0000-0000-000000000001';
update public.commerce_discount_codes
set discount_value = 1
where code = 'DPONLY';

select test_digital_discounts.assert(
  (select total_amount = 340000 and discount_amount = 60000
   from public.orders where user_id = 'a1000000-0000-0000-0000-000000000002')
  and
  (select unit_price_amount = 100000 and discounted_unit_price_amount = 40000
   from public.order_items
   where order_id = (select id from public.orders where user_id = 'a1000000-0000-0000-0000-000000000002')
     and commerce_item_id = 'a1100000-0000-0000-0000-000000000001'),
  'Order and Order Item snapshots remain immutable after source price/code changes'
);

rollback;
select 'PASS: Digital Product discount scope, redemption lifecycle, immutable snapshots, and paid-only sales proof' as result;
