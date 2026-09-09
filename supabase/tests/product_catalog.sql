-- Execute as postgres after migrations. All fixtures roll back.
begin;
create schema test_catalog;
grant usage on schema test_catalog to anon, authenticated;
create function test_catalog.assert(p_condition boolean, p_message text) returns void language plpgsql as $$
begin
  if p_condition is distinct from true then raise exception 'ASSERTION FAILED: %', p_message; end if;
end $$;
create function test_catalog.denied(p_sql text, p_message text) returns void language plpgsql as $$
declare rejected boolean := false;
begin
  begin execute p_sql;
  exception when insufficient_privilege or invalid_parameter_value or check_violation or unique_violation
    or invalid_text_representation or not_null_violation or foreign_key_violation then rejected := true;
  end;
  if not rejected then raise exception 'ATTACK ACCEPTED: %', p_message; end if;
end $$;
grant execute on all functions in schema test_catalog to anon, authenticated;

insert into auth.users (id, email, encrypted_password) values
  ('90000000-0000-0000-0000-000000000001', 'catalog-admin@test.invalid', 'hash'),
  ('90000000-0000-0000-0000-000000000002', 'catalog-mentee@test.invalid', 'hash');
update public.profiles set role = 'admin' where id = '90000000-0000-0000-0000-000000000001';

select test_catalog.assert((select count(*) = 2 from public.catalog_products), 'only authoritative mentoring products seeded');
select test_catalog.assert((select count(*) = 0 from public.catalog_products where product_type in ('big_class', 'digital_product')), 'no Big Class or Digital demo seed');
select test_catalog.assert((select count(*) = 2 from public.public_catalog_products), 'both authoritative programs are public');
select test_catalog.assert((select count(*) = 19 from public.catalog_commercial_items), 'ten private offerings, three intensive offerings, three add-ons and three bundles seeded');
select test_catalog.assert((select count(*) = 10 from public.catalog_commercial_items where kind = 'offering' and product_id = '71000000-0000-0000-0000-000000000001'), 'every private tier/package cell has an offering identity');
select test_catalog.assert((
  select ci.price_amount = 885000 and ci.reference_price_amount = 950000 and pc.per_session_price_amount = 285000
  from public.catalog_commercial_items ci
  join public.catalog_private_offering_configs pc on pc.id = ci.id
  join public.catalog_mentor_tiers mt on mt.id = pc.mentor_tier_id
  join public.catalog_session_packages sp on sp.id = pc.session_package_id
  where mt.code = 'top_student' and sp.session_count = 3
), 'guidebook Top Student 3-session values stored verbatim');
select test_catalog.assert((
  select pricing_mode = 'quotation_required' and price_amount is null and reference_price_amount is null
  from public.catalog_commercial_items where code = 'international_custom'
), 'international mentoring uses quotation pricing without zero');
select test_catalog.assert((select count(*) = 3 from public.catalog_bundles), 'three authoritative bundles seeded');
select test_catalog.assert((
  select count(*) = 4 from public.public_catalog_bundle_components
  where bundle_code = 'competition_assurance_bundle'
), 'competition assurance has explicit relational composition');
select test_catalog.assert((select count(*) = 9 from public.catalog_delivery_options), 'delivery option identities are catalog-owned');
select test_catalog.assert((select count(*) = 0 from public.catalog_delivery_options d join public.catalog_commercial_items c on c.id = d.id), 'delivery options are not purchasable identities');
select test_catalog.assert((select count(*) = 0 from public.catalog_benefits b join public.catalog_commercial_items c on c.id = b.id), 'benefits are not purchasable identities');

insert into public.catalog_products (id,code,slug,product_type,status,default_purchase_flow,title,short_description,is_public)
values ('79000000-0000-0000-0000-000000000001','internal_test','internal-test','big_class','published','consultation_offer','Internal Test','Must remain invisible',false);
insert into public.catalog_commercial_items (id,product_id,code,kind,title,pricing_mode,price_amount)
values ('79000000-0000-0000-0000-000000000002','79000000-0000-0000-0000-000000000001','internal_offering','offering','Internal Offering','fixed',123000);
insert into public.catalog_offerings (id,product_id)
values ('79000000-0000-0000-0000-000000000002','79000000-0000-0000-0000-000000000001');
update public.catalog_commercial_items set status='published' where id='79000000-0000-0000-0000-000000000002';

set local role anon;
select test_catalog.assert((select count(*) = 2 from public.public_catalog_products), 'anonymous users see published public products');
select test_catalog.assert((select count(*) = 0 from public.catalog_offerings where product_id='79000000-0000-0000-0000-000000000001'), 'anonymous base child read cannot leak internal product identity');
select test_catalog.assert((select count(*) = 0 from public.public_catalog_commercial_items where product_id='79000000-0000-0000-0000-000000000001'), 'security-invoker view cannot leak internal commercial items');
select test_catalog.denied($q$insert into public.catalog_products (code, slug, product_type, default_purchase_flow, title, short_description) values ('attack','attack','big_class','consultation_offer','Attack','Attack')$q$, 'anonymous catalog insert');
select test_catalog.denied($q$select public.set_catalog_product_status('71000000-0000-0000-0000-000000000001', 'archived')$q$, 'anonymous lifecycle change');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000002', true);
select test_catalog.assert((select count(*) = 2 from public.public_catalog_products), 'mentee sees public catalog');
select test_catalog.assert((select count(*) = 2 from public.catalog_products), 'over-broad base product query still hides drafts and archives');
select test_catalog.assert((select count(*) = 19 from public.catalog_commercial_items), 'over-broad base item query exposes published items only');
select test_catalog.denied($q$insert into public.catalog_products (code, slug, product_type, default_purchase_flow, title, short_description) values ('attack','attack','big_class','consultation_offer','Attack','Attack')$q$, 'mentee catalog insert');
with attacked as (
  update public.catalog_commercial_items set price_amount = 1 where code = 'intensive_national' returning id
)
select test_catalog.assert((select count(*) = 0 from attacked), 'mentee cannot mutate catalog price');
select test_catalog.denied($q$update public.catalog_products set status = 'archived' where code = 'private_mentoring'$q$, 'direct lifecycle mutation');
select test_catalog.denied($q$select public.set_catalog_commercial_item_status('73000000-0000-0000-0000-000000000001', 'archived')$q$, 'mentee lifecycle RPC');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000001', true);
insert into public.catalog_products (code, slug, product_type, default_purchase_flow, title, short_description)
values ('catalog_test_digital', 'catalog-test-digital', 'digital_product', 'direct_checkout', 'Produk Uji', 'Produk untuk pengujian katalog');
insert into public.catalog_digital_product_details (product_id, content_type)
values ((select id from public.catalog_products where code = 'catalog_test_digital'), 'pdf');
select test_catalog.assert((select status = 'draft' from public.catalog_products where code = 'catalog_test_digital'), 'admin creates manageable draft');
select test_catalog.assert((select count(*) = 0 from public.public_catalog_products where code = 'catalog_test_digital'), 'draft hidden from public projection');
select test_catalog.denied($q$select public.set_catalog_product_status((select id from public.catalog_products where code = 'catalog_test_digital'), 'published')$q$, 'product without published offering cannot publish');
select public.create_catalog_commercial_item(
  (select id from public.catalog_products where code = 'catalog_test_digital'), 'offering', 'digital_access', 'Akses Produk Uji', null,
  'fixed', 99000, null, true, 0, null, null, null, null, null, null, null
);
select public.set_catalog_commercial_item_status((select id from public.catalog_commercial_items where code = 'digital_access'), 'published');
update public.catalog_products set is_public = true where code = 'catalog_test_digital';
select public.set_catalog_product_status((select id from public.catalog_products where code = 'catalog_test_digital'), 'published');
select test_catalog.assert((select count(*) = 1 from public.public_catalog_products where code = 'catalog_test_digital'), 'valid admin draft publishes');
update public.catalog_commercial_items set price_amount = 109000 where code = 'digital_access';
select test_catalog.assert((select price_amount = 109000 from public.catalog_commercial_items where code = 'digital_access'), 'published mutable price may evolve');
select test_catalog.denied($q$update public.catalog_commercial_items set pricing_mode='quotation_required',price_amount=null,reference_price_amount=null where code='intensive_national'$q$, 'published national intensive cannot become quotation pricing in place');
select public.set_catalog_product_status((select id from public.catalog_products where code = 'catalog_test_digital'), 'archived');
select test_catalog.assert((select count(*) = 0 from public.public_catalog_products where code = 'catalog_test_digital'), 'archived product hidden');
select test_catalog.denied($q$select public.set_catalog_product_status((select id from public.catalog_products where code = 'catalog_test_digital'), 'published')$q$, 'archived identity cannot republish');

select test_catalog.denied($q$insert into public.catalog_commercial_items (product_id, code, kind, title, pricing_mode, price_amount) values ('71000000-0000-0000-0000-000000000001','bad_quote','offering','Bad Quote','quotation_required',0)$q$, 'quotation price cannot masquerade as zero');
select test_catalog.denied($q$insert into public.catalog_session_packages (product_id, code, label, session_count) values ('71000000-0000-0000-0000-000000000001','zero','Zero',0)$q$, 'session count must be positive');
select test_catalog.denied($q$insert into public.catalog_digital_product_details (product_id, content_type) values ('71000000-0000-0000-0000-000000000001','video')$q$, 'digital detail cannot attach to Private Mentoring');
select test_catalog.denied($q$update public.catalog_products set code = 'changed_identity' where id = '71000000-0000-0000-0000-000000000001'$q$, 'published product code immutable');
select test_catalog.denied($q$update public.catalog_session_packages set session_count = 4 where code = 'sessions_3'$q$, 'published session package meaning requires a new identity');
select test_catalog.denied($q$update public.catalog_delivery_options set code = 'changed_delivery_identity' where code = 'end_to_end_learning'$q$, 'delivery option code remains stable');
select test_catalog.denied($q$update public.catalog_intensive_offering_configs set sessions_per_month = 5 where id = '73000000-0000-0000-0000-000000000001'$q$, 'published intensive package meaning requires a new identity');
select test_catalog.denied($q$update public.catalog_mentor_tiers set status = 'archived' where code = 'top_student'$q$, 'mentor tier used by a published offering cannot be archived');
select test_catalog.denied($q$update public.catalog_benefits set status = 'archived' where code = 'direct_mentor_networking'$q$, 'benefit used by a published item cannot be archived');
select test_catalog.denied($q$select public.set_catalog_commercial_item_status('73000000-0000-0000-0000-000000000001', 'archived')$q$, 'published bundle component cannot be archived while referenced');
select test_catalog.denied($q$delete from public.catalog_offerings where id = '73000000-0000-0000-0000-000000000003'$q$, 'published offering subtype cannot be deleted');
select test_catalog.denied($q$delete from public.catalog_private_mentoring_details where product_id = '71000000-0000-0000-0000-000000000001'$q$, 'published product details cannot be deleted');
with deleted as (
  delete from public.catalog_commercial_items where code = 'intensive_national' returning id
)
select test_catalog.assert((select count(*) = 0 from deleted), 'admin RLS cannot delete published commercial identity');
with deleted as (
  delete from public.catalog_products where code = 'private_mentoring' returning id
)
select test_catalog.assert((select count(*) = 0 from deleted), 'admin RLS cannot delete published product identity');
reset role;

select test_catalog.denied($q$delete from public.catalog_commercial_items where code = 'intensive_national'$q$, 'trusted direct access cannot delete published commercial identity');
select test_catalog.denied($q$delete from public.catalog_products where code = 'private_mentoring'$q$, 'trusted direct access cannot delete published product identity');

rollback;
select 'PASS: product catalog master security, lifecycle, domain, and authoritative seed' as result;
