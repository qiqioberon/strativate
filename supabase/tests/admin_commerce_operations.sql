-- Disposable database only. Admin commerce read models must remain admin-gated.
begin;

create schema test_admin_commerce;
grant usage on schema test_admin_commerce to authenticated;
create function test_admin_commerce.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;
grant execute on all functions in schema test_admin_commerce to authenticated;

select test_admin_commerce.assert(to_regprocedure('public.list_admin_commerce_orders(text,text,timestamp with time zone,timestamp with time zone,integer,integer)') is not null, 'admin order RPC exists');
select test_admin_commerce.assert(to_regprocedure('public.get_admin_commerce_report(timestamp with time zone,timestamp with time zone)') is not null, 'admin report RPC exists');
select test_admin_commerce.assert(to_regprocedure('public.list_admin_purchasable_commerce_items(text)') is not null, 'admin product discovery RPC exists');
select test_admin_commerce.assert(to_regprocedure('public.list_admin_cart_links_page(text,text,integer,integer)') is not null, 'cart link page RPC exists');

insert into auth.users (id, email, encrypted_password) values
  ('99000000-0000-0000-0000-000000000001', 'ops-admin@test.invalid', 'hash'),
  ('99000000-0000-0000-0000-000000000002', 'ops-mentee@test.invalid', 'hash');
update public.profiles set role = 'admin' where id = '99000000-0000-0000-0000-000000000001';
update public.mentee_profiles set onboarding_completed_at = now() where user_id = '99000000-0000-0000-0000-000000000002';

insert into public.digital_products (id, name, slug, description, image_path, price_amount, is_published)
values ('99010000-0000-0000-0000-000000000001', 'Ops Test Guide', 'ops-test-guide', 'Fixture only.', 'products/ops-test.webp', 99000, true);

set local role authenticated;
select set_config('request.jwt.claim.sub', '99000000-0000-0000-0000-000000000002', true);
select public.get_or_create_active_cart();
select public.add_cart_item('99010000-0000-0000-0000-000000000001');
select public.create_order_from_cart((select id from public.carts where user_id = auth.uid() and status = 'active'));
select test_admin_commerce.assert((select count(*) = 0 from public.list_admin_commerce_orders()), 'mentee cannot read admin order projection');
select test_admin_commerce.assert((select count(*) = 0 from public.get_admin_commerce_report()), 'mentee cannot read admin metrics');
select test_admin_commerce.assert((select count(*) = 0 from public.list_admin_purchasable_commerce_items()), 'mentee cannot read admin product projection');
reset role;

update public.orders set status = 'paid', paid_at = now() where user_id = '99000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', '99000000-0000-0000-0000-000000000001', true);
select test_admin_commerce.assert((select count(*) = 1 from public.list_admin_commerce_orders()), 'admin can read the Shared Commerce order');
select test_admin_commerce.assert((select total_revenue = 99000 and paid_orders = 1 from public.get_admin_commerce_report()), 'report uses paid Shared Commerce revenue');
select test_admin_commerce.assert((select name = 'Ops Test Guide' and image_path = 'products/ops-test.webp' from public.list_admin_purchasable_commerce_items()), 'admin product cards use domain cover metadata');
select test_admin_commerce.assert((select name = 'Ops Test Guide' and is_available from public.get_admin_commerce_item_detail('99010000-0000-0000-0000-000000000001')), 'admin product detail resolves from domain source');
select public.create_commerce_cart_link(
  '99000000-0000-0000-0000-000000000002',
  repeat('a', 64),
  array['99010000-0000-0000-0000-000000000001'::uuid]
);
select test_admin_commerce.assert((select count(*) = 1 from public.list_admin_cart_links_page()), 'admin cart link history is paginated from real rows');
reset role;

rollback;
