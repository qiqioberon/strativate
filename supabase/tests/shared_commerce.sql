-- Disposable database only. All fixtures and mutations are rolled back.
begin;

create schema test_commerce;
grant usage on schema test_commerce to anon, authenticated, service_role;

create function test_commerce.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;

create function test_commerce.denied(command text, message text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when insufficient_privilege or check_violation or unique_violation or invalid_parameter_value or raise_exception then return;
  end;
  raise exception 'UNEXPECTEDLY ALLOWED: %', message;
end;
$$;

grant execute on all functions in schema test_commerce to anon, authenticated, service_role;

select test_commerce.assert(to_regclass('public.commerce_items') is not null, 'commerce registry exists');
select test_commerce.assert(to_regclass('public.carts') is not null, 'shared carts exist');
select test_commerce.assert(to_regclass('public.orders') is not null, 'shared orders exist');
select test_commerce.assert(to_regclass('public.catalog_products') is null, 'legacy catalog stays removed');
select test_commerce.assert(
  (select public from storage.buckets where id = 'digital-product-images'),
  'cover bucket is public'
);

insert into auth.users (id, email, encrypted_password) values
  ('94000000-0000-0000-0000-000000000001', 'commerce-admin@test.invalid', 'hash'),
  ('94000000-0000-0000-0000-000000000002', 'commerce-mentee-a@test.invalid', 'hash'),
  ('94000000-0000-0000-0000-000000000003', 'commerce-mentee-b@test.invalid', 'hash'),
  ('94000000-0000-0000-0000-000000000004', 'commerce-mentor@test.invalid', 'hash'),
  ('94000000-0000-0000-0000-000000000005', 'commerce-incomplete@test.invalid', 'hash');
update public.profiles set role = 'admin' where id = '94000000-0000-0000-0000-000000000001';
update public.profiles set role = 'mentor' where id = '94000000-0000-0000-0000-000000000004';
delete from public.mentee_profiles where user_id = '94000000-0000-0000-0000-000000000004';
update public.mentee_profiles set onboarding_completed_at = now() where user_id in (
  '94000000-0000-0000-0000-000000000002',
  '94000000-0000-0000-0000-000000000003'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000001', true);
insert into public.digital_products (
  id, name, slug, description, image_path, price_amount,
  content_type, content_path, content_mime_type, content_file_name, content_size_bytes, page_count, is_published
) values
  ('94100000-0000-0000-0000-000000000001', 'Business Case Handbook', 'business-case-handbook', 'Panduan latihan kasus bisnis.', 'products/business-case-handbook.webp', 75000, 'pdf', 'products/handbook/business-case.pdf', 'application/pdf', 'business-case.pdf', 1024, 20, true),
  ('94100000-0000-0000-0000-000000000002', 'Pitch Deck Workbook', 'pitch-deck-workbook', 'Workbook presentasi bisnis.', 'products/pitch-deck-workbook.webp', 50000, 'pdf', 'products/workbook/pitch-deck.pdf', 'application/pdf', 'pitch-deck.pdf', 2048, 18, true);
reset role;

select test_commerce.assert(
  (select count(*) = 2 and bool_and(item_kind = 'digital_product' and is_available) from public.commerce_items where id in (
    '94100000-0000-0000-0000-000000000001', '94100000-0000-0000-0000-000000000002'
  )),
  'published Digital Products register stable available commerce identities'
);

set local role anon;
select test_commerce.assert((select count(*) = 2 from public.digital_products), 'anonymous storefront can read published Digital Products');
select test_commerce.denied(
  $$insert into public.digital_products (name,slug,description,image_path,price_amount) values ('No','no','No','products/no.webp',1)$$,
  'anonymous Digital Product write'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000002', true);
select public.get_or_create_active_cart();
select public.get_or_create_active_cart();
select test_commerce.assert(
  (select count(*) = 1 from public.carts where user_id = auth.uid() and status = 'active'),
  'get/create keeps one active cart'
);
select public.add_cart_item('94100000-0000-0000-0000-000000000001');
select test_commerce.denied(
  $$select public.add_cart_item('94100000-0000-0000-0000-000000000001')$$,
  'duplicate Digital Product add to cart'
);
select public.add_cart_item('94100000-0000-0000-0000-000000000002');
select test_commerce.assert(
  (select count(*) = 2 from public.get_active_cart()),
  'Cart keeps one row per Digital Product'
);

select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000003', true);
select test_commerce.assert((select count(*) = 0 from public.carts), 'another Mentee cannot read the first cart');
select test_commerce.assert((select count(*) = 0 from public.cart_items), 'another Mentee cannot read the first cart items');

select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000004', true);
select test_commerce.denied($$select public.get_or_create_active_cart()$$, 'mentor Cart access');
select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000005', true);
select test_commerce.denied($$select public.get_or_create_active_cart()$$, 'incomplete Mentee Cart access');

select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000002', true);
select public.create_order_from_cart((select id from public.carts where user_id = auth.uid() and status = 'active'));
select test_commerce.assert(
  (select total_amount = 125000 and status = 'pending_payment' from public.orders where user_id = auth.uid()),
  'trusted current prices calculate Order total'
);
select test_commerce.assert(
  (select count(*) = 2 and sum(unit_price_amount) = 125000 from public.order_items oi join public.orders o on o.id = oi.order_id where o.user_id = auth.uid()),
  'Order Items snapshot both prices'
);
select test_commerce.assert(
  (select status = 'converted' from public.carts where user_id = auth.uid()),
  'Cart converts atomically'
);
select public.create_order_from_cart((select cart_id from public.orders where user_id = auth.uid()));
select test_commerce.assert((select count(*) = 1 from public.orders where user_id = auth.uid()), 'same Cart reuses one Order');
reset role;

update public.digital_products set name = 'Changed Handbook', slug = 'changed-handbook', price_amount = 100000
where id = '94100000-0000-0000-0000-000000000001';
select test_commerce.assert(
  (select name_snapshot = 'Business Case Handbook' and slug_snapshot = 'business-case-handbook' and unit_price_amount = 75000
   from public.order_items where commerce_item_id = '94100000-0000-0000-0000-000000000001'),
  'Order Item snapshot ignores later product edits'
);
delete from public.digital_products where id = '94100000-0000-0000-0000-000000000002';
select test_commerce.assert(
  (select not is_available from public.commerce_items where id = '94100000-0000-0000-0000-000000000002'),
  'deleted source retires rather than deletes commerce identity'
);
select test_commerce.assert(
  exists (select 1 from public.order_items where commerce_item_id = '94100000-0000-0000-0000-000000000002'),
  'source deletion preserves Order history'
);

update public.orders set status = 'paid', paid_at = now() where user_id = '94000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000002', true);
select test_commerce.assert((select count(*) = 2 from public.list_owned_digital_products()), 'paid Order grants Digital Product ownership');
select public.get_or_create_active_cart();
select test_commerce.denied($$select public.add_cart_item('94100000-0000-0000-0000-000000000001')$$, 'already-owned Digital Product repurchase');
select test_commerce.denied($$update public.order_items set name_snapshot = 'Tampered'$$, 'authenticated Order Item mutation');

select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000003', true);
select test_commerce.assert((select count(*) = 0 from public.orders), 'another Mentee cannot read Orders');
select test_commerce.assert((select count(*) = 0 from public.order_items), 'another Mentee cannot read Order Items');
reset role;

rollback;
select 'PASS: shared commerce registry, Cart, Order, ownership, duplicate prevention, and RLS' as result;
