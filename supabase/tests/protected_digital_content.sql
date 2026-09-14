-- Disposable database only. Verify paid-content authorization and private Storage boundaries.
begin;

create schema test_protected_content;
grant usage on schema test_protected_content to anon, authenticated, service_role;

create function test_protected_content.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;

create function test_protected_content.denied(command text, message text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when insufficient_privilege or check_violation or invalid_parameter_value or raise_exception then return;
  end;
  raise exception 'UNEXPECTEDLY ALLOWED: %', message;
end;
$$;

grant execute on all functions in schema test_protected_content to anon, authenticated, service_role;

select test_protected_content.assert(
  (select public = false from storage.buckets where id = 'digital-product-content'),
  'paid content bucket stays private'
);
select test_protected_content.assert(
  to_regclass('public.digital_product_access_sessions') is not null,
  'content access session audit table exists'
);

insert into auth.users (id, email, encrypted_password) values
  ('96000000-0000-0000-0000-000000000001', 'protected-admin@test.invalid', 'hash'),
  ('96000000-0000-0000-0000-000000000002', 'protected-owner@test.invalid', 'hash'),
  ('96000000-0000-0000-0000-000000000003', 'protected-other@test.invalid', 'hash');
update public.profiles set role = 'admin' where id = '96000000-0000-0000-0000-000000000001';
update public.mentee_profiles set onboarding_completed_at = now() where user_id in (
  '96000000-0000-0000-0000-000000000002',
  '96000000-0000-0000-0000-000000000003'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000001', true);
insert into public.digital_products (
  id, name, slug, description, image_path, price_amount,
  content_type, content_path, content_mime_type, content_file_name, content_size_bytes, page_count, is_published
) values (
  '96100000-0000-0000-0000-000000000001', 'Protected Handbook', 'protected-handbook', 'Protected fixture.', 'products/protected-handbook.webp', 85000,
  'pdf', 'products/protected/protected-handbook.pdf', 'application/pdf', 'protected-handbook.pdf', 8192, 32, true
);
insert into storage.objects (bucket_id, name, owner_id)
values ('digital-product-content', 'products/protected/protected-handbook.pdf', '96000000-0000-0000-0000-000000000001');
reset role;

set local role anon;
select test_protected_content.denied(
  $$select * from public.create_digital_product_access_session('96100000-0000-0000-0000-000000000001')$$,
  'anonymous protected content session'
);
select test_protected_content.assert(
  (select count(*) = 0 from storage.objects where bucket_id = 'digital-product-content'),
  'anonymous cannot discover raw protected objects'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000003', true);
select test_protected_content.denied(
  $$select * from public.create_digital_product_access_session('96100000-0000-0000-0000-000000000001')$$,
  'authenticated non-owner protected content session'
);
select test_protected_content.assert(
  (select count(*) = 0 from storage.objects where bucket_id = 'digital-product-content'),
  'non-owner cannot discover raw protected objects'
);

select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000002', true);
select public.add_cart_item('96100000-0000-0000-0000-000000000001');
select public.create_order_from_cart((select id from public.carts where user_id = auth.uid() and status = 'active'));
reset role;
update public.orders set status = 'paid', paid_at = now() where user_id = '96000000-0000-0000-0000-000000000002';

-- Storefront publication can stop without revoking an already-paid entitlement.
set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000001', true);
update public.digital_products set is_published = false where id = '96100000-0000-0000-0000-000000000001';
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000002', true);
select test_protected_content.assert(
  (select order_item_id is not null and order_id is not null and content_type = 'pdf'
   from public.create_digital_product_access_session('96100000-0000-0000-0000-000000000001') limit 1),
  'paid owner receives a protected content access session even after unpublish'
);
select test_protected_content.assert(
  (select count(*) = 1 and bool_and(content_ready and current_content_type = 'pdf') from public.list_owned_digital_products()),
  'paid owner library retains ready protected content'
);
select test_protected_content.assert(
  (select count(*) = 0 from storage.objects where bucket_id = 'digital-product-content'),
  'paid owner still cannot read raw protected Storage directly'
);
select test_protected_content.denied(
  $$select count(*) from public.digital_product_access_sessions$$,
  'authenticated users cannot read forensic access-session rows directly'
);

select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000003', true);
select test_protected_content.denied(
  $$select * from public.create_digital_product_access_session('96100000-0000-0000-0000-000000000001')$$,
  'non-owner remains denied after product unpublish'
);
update public.digital_products set is_published = true where id = '96100000-0000-0000-0000-000000000001';
reset role;
select test_protected_content.assert(
  (select is_published = false from public.digital_products where id = '96100000-0000-0000-0000-000000000001'),
  'non-admin cannot manipulate publication state'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000001', true);
select test_protected_content.assert(
  (select order_item_id is null and order_id is null and content_type = 'pdf'
   from public.create_digital_product_access_session('96100000-0000-0000-0000-000000000001') limit 1),
  'admin can preview protected content without fabricating an ownership record'
);
select test_protected_content.assert(
  (select count(*) = 1 from storage.objects where bucket_id = 'digital-product-content'),
  'admin can read protected Storage for management'
);
reset role;

select test_protected_content.assert(
  (select count(*) = 2 from public.digital_product_access_sessions),
  'owner and admin accesses are forensically logged'
);

rollback;
select 'PASS: protected Digital Product authorization, private Storage, and forensic sessions' as result;
