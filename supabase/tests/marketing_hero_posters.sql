-- Execute as postgres after migrations. All fixtures roll back.
begin;
create schema test_marketing;
grant usage on schema test_marketing to anon, authenticated;
create function test_marketing.assert(p_condition boolean, p_message text) returns void language plpgsql as $$
begin
  if p_condition is distinct from true then raise exception 'ASSERTION FAILED: %', p_message; end if;
end $$;
create function test_marketing.denied(p_sql text, p_message text) returns void language plpgsql as $$
declare rejected boolean := false;
begin
  begin execute p_sql;
  exception when insufficient_privilege or check_violation then rejected := true;
  end;
  if not rejected then raise exception 'ATTACK ACCEPTED: %', p_message; end if;
end $$;
grant execute on all functions in schema test_marketing to anon, authenticated;

insert into auth.users (id, email, encrypted_password) values
  ('92000000-0000-0000-0000-000000000001', 'marketing-admin@test.invalid', 'hash'),
  ('92000000-0000-0000-0000-000000000002', 'marketing-mentee@test.invalid', 'hash');
update public.profiles set role = 'admin' where id = '92000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-0000-0000-000000000001', true);
insert into public.marketing_hero_posters (image_path, alt_text, title, url, sort_order, is_active)
values
  ('posters/active.webp', 'Poster aktif', 'Persiapan terarah', '/program', 10, true),
  ('posters/draft.webp', 'Poster nonaktif', null, null, 20, false);
insert into storage.objects (bucket_id, name, owner_id)
values ('marketing-hero-posters', 'posters/active.webp', '92000000-0000-0000-0000-000000000001');
select public.reorder_marketing_hero_posters(array(
  select id from public.marketing_hero_posters order by sort_order desc
));
select test_marketing.assert((select sort_order = 10 from public.marketing_hero_posters where image_path = 'posters/draft.webp'), 'admin can reorder posters atomically');
reset role;

set local role anon;
select test_marketing.assert((select count(*) = 1 from public.marketing_hero_posters), 'anonymous users see only active posters');
select test_marketing.assert((select count(*) = 1 from storage.objects where bucket_id = 'marketing-hero-posters'), 'public poster object is readable');
select test_marketing.denied($q$insert into public.marketing_hero_posters (image_path, alt_text) values ('posters/attack.webp', 'Attack')$q$, 'anonymous poster insert');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-0000-0000-000000000002', true);
select test_marketing.assert((select count(*) = 1 from public.marketing_hero_posters), 'mentee sees only active posters');
select test_marketing.denied($q$update public.marketing_hero_posters set is_active = false$q$, 'mentee poster update');
select test_marketing.denied($q$select public.reorder_marketing_hero_posters(array(select id from public.marketing_hero_posters))$q$, 'mentee poster reorder');
select test_marketing.denied($q$insert into storage.objects (bucket_id, name, owner_id) values ('marketing-hero-posters', 'posters/attack.webp', '92000000-0000-0000-0000-000000000002')$q$, 'mentee storage upload');
reset role;

rollback;
select 'PASS: marketing hero poster table and storage policy security' as result;
