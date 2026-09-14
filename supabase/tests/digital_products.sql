-- Execute as postgres after migrations. All fixtures roll back.
begin;
create schema test_digital_products;
grant usage on schema test_digital_products to anon, authenticated;

create function test_digital_products.assert(p_condition boolean, p_message text) returns void language plpgsql as $$
begin
  if p_condition is distinct from true then raise exception 'ASSERTION FAILED: %', p_message; end if;
end $$;

create function test_digital_products.rejected(p_sql text, p_message text) returns void language plpgsql as $$
declare was_rejected boolean := false;
begin
  begin execute p_sql;
  exception when insufficient_privilege or check_violation or unique_violation or not_null_violation then was_rejected := true;
  end;
  if not was_rejected then raise exception 'INVALID OPERATION ACCEPTED: %', p_message; end if;
end $$;

grant execute on all functions in schema test_digital_products to anon, authenticated;

select test_digital_products.assert(to_regclass('public.digital_products') is not null, 'digital_products table exists');
select test_digital_products.assert(
  exists (
    select 1 from storage.buckets
    where id = 'digital-product-images'
      and public = true
      and file_size_limit = 5242880
      and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  ),
  'public Digital Product cover bucket is configured'
);
select test_digital_products.assert(
  exists (
    select 1 from storage.buckets
    where id = 'digital-product-content'
      and public = false
      and file_size_limit = 524288000
      and allowed_mime_types = array['application/pdf', 'video/mp4', 'video/webm']
  ),
  'protected Digital Product content bucket is private'
);
select test_digital_products.assert(to_regclass('public.catalog_products') is null, 'legacy catalog_products is not recreated');
select test_digital_products.assert(to_regclass('public.catalog_commercial_items') is null, 'legacy catalog_commercial_items is not recreated');
select test_digital_products.assert(to_regclass('public.catalog_digital_product_details') is null, 'legacy catalog_digital_product_details is not recreated');

insert into auth.users (id, email, encrypted_password) values
  ('93000000-0000-0000-0000-000000000001', 'digital-admin@test.invalid', 'hash'),
  ('93000000-0000-0000-0000-000000000002', 'digital-mentee@test.invalid', 'hash'),
  ('93000000-0000-0000-0000-000000000003', 'digital-mentor@test.invalid', 'hash');
update public.profiles set role = 'admin' where id = '93000000-0000-0000-0000-000000000001';
update public.profiles set role = 'mentee' where id = '93000000-0000-0000-0000-000000000002';
update public.profiles set role = 'mentor' where id = '93000000-0000-0000-0000-000000000003';

set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-0000-0000-000000000001', true);

insert into public.digital_products (
  name, slug, description, image_path, price_amount,
  content_type, content_path, content_mime_type, content_file_name, content_size_bytes, page_count, is_published
) values (
  'Business Case Handbook', 'business-case-handbook', 'Panduan latihan kasus bisnis.', 'products/business-case-handbook.webp', 75000,
  'pdf', 'products/business-case/business-case.pdf', 'application/pdf', 'business-case.pdf', 4096, 24, true
);
insert into public.digital_products (name, slug, description, image_path, price_amount)
values ('Draft Workbook', 'draft-workbook', 'Draft admin.', 'products/draft-workbook.webp', 25000);
select test_digital_products.assert((select count(*) = 2 from public.digital_products), 'admin can create and select published and draft Digital Products');

select test_digital_products.rejected($q$
  insert into public.digital_products (name, slug, description, image_path, price_amount, is_published)
  values ('No content', 'no-content', 'No protected source.', 'products/no-content.webp', 10000, true)
$q$, 'publishing without protected content');
select test_digital_products.rejected($q$
  insert into public.digital_products (name, slug, description, image_path, price_amount, content_type, content_path, content_mime_type, content_file_name, content_size_bytes, is_published)
  values ('Bad MIME', 'bad-mime', 'Bad MIME.', 'products/bad-mime.webp', 10000, 'pdf', 'products/bad-mime/file.pdf', 'video/mp4', 'file.pdf', 100, true)
$q$, 'content MIME must match product type');
select test_digital_products.rejected($q$
  insert into public.digital_products (name, slug, description, image_path, price_amount)
  values ('Duplicate', 'business-case-handbook', 'Duplicate slug.', 'products/duplicate.webp', 10000)
$q$, 'duplicate slug');
select test_digital_products.rejected($q$
  insert into public.digital_products (name, slug, description, image_path, price_amount)
  values ('Bad slug', 'Bad Slug', 'Malformed slug.', 'products/bad-slug.webp', 10000)
$q$, 'malformed slug');
select test_digital_products.rejected($q$
  insert into public.digital_products (name, slug, description, image_path, price_amount)
  values ('   ', 'blank-name', 'Description.', 'products/blank-name.webp', 10000)
$q$, 'blank name');
select test_digital_products.rejected($q$
  insert into public.digital_products (name, slug, description, image_path, price_amount)
  values ('Blank description', 'blank-description', '   ', 'products/blank-description.webp', 10000)
$q$, 'blank description');
select test_digital_products.rejected($q$
  insert into public.digital_products (name, slug, description, image_path, price_amount)
  values ('Negative price', 'negative-price', 'Description.', 'products/negative-price.webp', -1)
$q$, 'negative price');
select test_digital_products.rejected($q$
  insert into public.digital_products (name, slug, description, image_path, price_amount)
  values ('Traversal image', 'traversal-image', 'Description.', 'products/../secret.webp', 10000)
$q$, 'image traversal');
select test_digital_products.rejected($q$
  insert into public.digital_products (name, slug, description, image_path, price_amount)
  values ('Wrong namespace', 'wrong-namespace', 'Description.', 'posters/wrong.webp', 10000)
$q$, 'image outside products namespace');

update public.digital_products set name = 'Business Case Handbook Revised' where slug = 'business-case-handbook';
select test_digital_products.assert((select name = 'Business Case Handbook Revised' from public.digital_products where slug = 'business-case-handbook'), 'admin can update Digital Products');
reset role;
update public.digital_products set updated_at = '2000-01-01T00:00:00Z' where slug = 'business-case-handbook';
set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-0000-0000-000000000001', true);
update public.digital_products set description = 'Panduan latihan kasus bisnis yang diperbarui.' where slug = 'business-case-handbook';
select test_digital_products.assert((select updated_at > now() - interval '1 minute' from public.digital_products where slug = 'business-case-handbook'), 'updated_at trigger refreshes timestamps through an allowed admin update');

delete from public.digital_products where slug = 'draft-workbook';
select test_digital_products.assert((select count(*) = 0 from public.digital_products where slug = 'draft-workbook'), 'admin can delete Digital Products');

insert into storage.objects (bucket_id, name, owner_id) values
  ('digital-product-images', 'products/admin-cover.webp', '93000000-0000-0000-0000-000000000001'),
  ('digital-product-content', 'products/business-case/business-case.pdf', '93000000-0000-0000-0000-000000000001');
select test_digital_products.assert((select count(*) = 1 from storage.objects where bucket_id = 'digital-product-images'), 'admin can upload a Digital Product cover');
select test_digital_products.assert((select count(*) = 1 from storage.objects where bucket_id = 'digital-product-content'), 'admin can upload protected Digital Product content');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-0000-0000-000000000002', true);
select test_digital_products.assert((select count(*) = 1 from public.digital_products), 'mentee can read published Digital Products only');
select test_digital_products.rejected($q$
  insert into public.digital_products (name, slug, description, image_path, price_amount)
  values ('Unauthorized mentee', 'unauthorized-mentee', 'Unauthorized.', 'products/unauthorized-mentee.webp', 1)
$q$, 'mentee insert');
update public.digital_products set name = 'Unauthorized mentee update';
delete from public.digital_products;
select test_digital_products.assert((select count(*) = 1 from storage.objects where bucket_id = 'digital-product-images'), 'mentee can read public cover objects');
select test_digital_products.assert((select count(*) = 0 from storage.objects where bucket_id = 'digital-product-content'), 'mentee cannot read protected content objects');
select test_digital_products.rejected($q$
  insert into storage.objects (bucket_id, name, owner_id)
  values ('digital-product-content', 'products/unauthorized/file.pdf', '93000000-0000-0000-0000-000000000002')
$q$, 'mentee protected storage upload');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-0000-0000-000000000003', true);
select test_digital_products.assert((select count(*) = 1 from public.digital_products), 'mentor can read published Digital Products');
select test_digital_products.rejected($q$
  insert into public.digital_products (name, slug, description, image_path, price_amount)
  values ('Unauthorized mentor', 'unauthorized-mentor', 'Unauthorized.', 'products/unauthorized-mentor.webp', 1)
$q$, 'mentor insert');
select test_digital_products.assert((select count(*) = 0 from storage.objects where bucket_id = 'digital-product-content'), 'mentor cannot read protected content objects');
reset role;

set local role anon;
select test_digital_products.assert((select count(*) = 1 from public.digital_products), 'anonymous visitor can read published Digital Products');
select test_digital_products.rejected($q$
  insert into public.digital_products (name, slug, description, image_path, price_amount)
  values ('Unauthorized anonymous', 'unauthorized-anonymous', 'Unauthorized.', 'products/unauthorized-anonymous.webp', 1)
$q$, 'anonymous insert');
select test_digital_products.rejected($q$update public.digital_products set name = 'Unauthorized anonymous update'$q$, 'anonymous update');
select test_digital_products.rejected($q$delete from public.digital_products$q$, 'anonymous delete');
select test_digital_products.assert((select count(*) = 1 from storage.objects where bucket_id = 'digital-product-images'), 'anonymous visitor can read public cover objects');
select test_digital_products.assert((select count(*) = 0 from storage.objects where bucket_id = 'digital-product-content'), 'anonymous visitor cannot read protected content objects');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-0000-0000-000000000001', true);
select test_digital_products.assert((select name = 'Business Case Handbook Revised' from public.digital_products where slug = 'business-case-handbook'), 'non-admin update and delete attempts leave the row intact');
reset role;

rollback;
select 'PASS: Digital Product schema, publication, RLS, and private content Storage security' as result;
