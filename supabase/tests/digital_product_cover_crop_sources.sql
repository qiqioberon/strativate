-- Execute as postgres after migrations; all fixtures roll back.
begin;
create schema test_product_crop;
grant usage on schema test_product_crop to anon, authenticated;
create function test_product_crop.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if;
end $$;
create function test_product_crop.denied(statement text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when insufficient_privilege or check_violation or invalid_text_representation then return;
  end;
  raise exception 'ATTACK ACCEPTED: %', statement;
end $$;
grant execute on all functions in schema test_product_crop to anon, authenticated;

insert into auth.users (id, email, encrypted_password) values
  ('c8000000-0000-4000-8000-000000000001', 'product-crop-admin@test.invalid', 'hash'),
  ('c8000000-0000-4000-8000-000000000002', 'product-crop-mentee@test.invalid', 'hash');
update public.profiles set role = 'admin' where id = 'c8000000-0000-4000-8000-000000000001';
select test_product_crop.assert(not has_column_privilege('anon', 'public.digital_products', 'image_source_path', 'SELECT'), 'anon cannot read cover sources');
select test_product_crop.assert(not has_column_privilege('authenticated', 'public.digital_products', 'image_crop', 'SELECT'), 'authenticated cannot directly read cover crops');
select test_product_crop.assert(has_column_privilege('anon', 'public.digital_products', 'image_path', 'SELECT'), 'anon still reads the public cover');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c8000000-0000-4000-8000-000000000001', true);
insert into public.digital_products (name, slug, description, image_path, price_amount, is_published)
values ('Legacy Cover', 'legacy-cover', 'Legacy.', 'products/legacy-cover.webp', 10000, true);
insert into public.digital_products (name, slug, description, image_path, image_source_path, image_crop, price_amount, is_published)
values ('Sourced Cover', 'sourced-cover', 'Sourced.', 'products/sourced-cover.webp',
  'digital-products/c8000000-0000-4000-8000-000000000003.png', '{"x":0.1,"y":0,"width":0.8,"height":1}', 20000, true);
select test_product_crop.assert((select count(*) = 2 from public.admin_list_digital_products()), 'admin RPC returns legacy and sourced covers');
select test_product_crop.assert((select image_source_path is null and image_crop is null from public.admin_list_digital_products() where slug = 'legacy-cover'), 'legacy metadata stays null');
select test_product_crop.assert((select image_crop is not null from public.admin_list_digital_products() where slug = 'sourced-cover'), 'admin can read private metadata');
insert into storage.objects (bucket_id, name) values ('marketing-photo-sources', 'digital-products/c8000000-0000-4000-8000-000000000003.png');
select test_product_crop.denied($q$update public.digital_products set image_crop = '{"x":0.9,"y":0,"width":0.5,"height":1}'$q$);
select test_product_crop.denied($q$update public.digital_products set image_source_path = 'digital-products/../escape.png'$q$);
select test_product_crop.denied($q$insert into storage.objects (bucket_id,name) values ('marketing-photo-sources','digital-products/../escape.png')$q$);
select test_product_crop.denied($q$insert into storage.objects (bucket_id,name) values ('marketing-photo-sources','digital-products/image.svg')$q$);
reset role;

set local role anon;
select test_product_crop.assert((select count(*) = 2 from public.digital_products), 'published products remain publicly readable');
select test_product_crop.denied($q$select image_source_path from public.digital_products$q$);
select test_product_crop.denied($q$select * from public.admin_list_digital_products()$q$);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c8000000-0000-4000-8000-000000000002', true);
select test_product_crop.assert((select count(*) = 0 from public.admin_list_digital_products()), 'nonadmin RPC reveals no metadata');
select test_product_crop.denied($q$insert into storage.objects (bucket_id,name) values ('marketing-photo-sources','digital-products/attack.png')$q$);
reset role;
rollback;
select 'PASS: private Digital Product cover sources, crops, legacy compatibility, grants, RPC and storage RLS' as result;
