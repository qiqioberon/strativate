-- Disposable database only. All assertions are rolled back.
begin;

create schema test_catalog_removal;
create function test_catalog_removal.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;

select test_catalog_removal.assert(to_regclass('public.catalog_products') is null, 'catalog_products removed');
select test_catalog_removal.assert(to_regclass('public.catalog_commercial_items') is null, 'catalog_commercial_items removed');
select test_catalog_removal.assert(to_regclass('public.catalog_mentor_tiers') is null, 'legacy catalog mentor tiers removed');
select test_catalog_removal.assert(to_regclass('public.public_catalog_products') is null, 'public catalog product view removed');
select test_catalog_removal.assert(
  not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and (c.relname like 'catalog\_%' escape '\\' or c.relname like 'public\_catalog\_%' escape '\\')
  ),
  'no legacy catalog relations or indexes remain'
);
select test_catalog_removal.assert(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'catalog\_%' escape '\\' or p.proname like 'set\_catalog\_%' escape '\\' or p.proname = 'create_catalog_commercial_item')
  ),
  'no legacy catalog functions remain'
);
select test_catalog_removal.assert(to_regtype('public.catalog_product_type') is null, 'catalog enums removed');

select test_catalog_removal.assert(to_regclass('public.mentor_tiers') is not null, 'operational mentor tiers survive');
select test_catalog_removal.assert((select count(*) = 2 from public.mentor_tiers), 'operational mentor tier seed survives');
select test_catalog_removal.assert(to_regclass('public.mentor_profiles') is not null, 'mentor domain survives');
select test_catalog_removal.assert(to_regclass('public.marketing_hero_posters') is not null, 'hero poster domain survives');
select test_catalog_removal.assert(to_regclass('public.profiles') is not null, 'auth profiles survive');
select test_catalog_removal.assert(to_regclass('public.mentee_profiles') is not null, 'onboarding profiles survive');
select test_catalog_removal.assert(to_regclass('public.institutions') is not null, 'institutions survive');

rollback;
select 'PASS: legacy Product Catalog removed without unrelated-domain loss' as result;
