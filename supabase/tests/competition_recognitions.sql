-- Execute as postgres after migrations. All fixtures roll back.
begin;
create schema test_recognition;
grant usage on schema test_recognition to anon, authenticated;

create function test_recognition.assert(p_condition boolean, p_message text) returns void language plpgsql as $$
begin
  if p_condition is distinct from true then raise exception 'ASSERTION FAILED: %', p_message; end if;
end $$;

create function test_recognition.denied(p_sql text, p_message text) returns void language plpgsql as $$
declare
  rejected boolean := false;
  affected bigint := 0;
begin
  begin
    execute p_sql;
    get diagnostics affected = row_count;
    rejected := affected = 0;
  exception when insufficient_privilege or check_violation or invalid_parameter_value or unique_violation then
    rejected := true;
  end;
  if not rejected then raise exception 'ATTACK ACCEPTED: %', p_message; end if;
end $$;
grant execute on all functions in schema test_recognition to anon, authenticated;

insert into auth.users (id, email, encrypted_password) values
  ('c2700000-0000-0000-0000-000000000001', 'recognition-admin@test.invalid', 'hash'),
  ('c2700000-0000-0000-0000-000000000002', 'recognition-mentee@test.invalid', 'hash');
update public.profiles set role = 'admin' where id = 'c2700000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2700000-0000-0000-0000-000000000001', true);
insert into public.competition_recognitions (competition_name, logo_path, display_order, is_active)
values
  ('Active Finalist', 'recognition-logos/active.webp', 20, true),
  ('Inactive Finalist', 'recognition-logos/inactive.png', 10, false);
insert into storage.objects (bucket_id, name, owner_id)
values
  ('marketing-editorial', 'recognition-logos/active.webp', 'c2700000-0000-0000-0000-000000000001'),
  ('marketing-editorial', 'recognition-logos/inactive.png', 'c2700000-0000-0000-0000-000000000001');

select public.reorder_competition_recognitions(array(
  select id from public.competition_recognitions order by display_order desc
));
select test_recognition.assert(
  (select display_order = 1 from public.competition_recognitions where competition_name = 'Active Finalist'),
  'admin can reorder recognitions into contiguous one-based positions'
);
update public.competition_recognitions set competition_name = 'Updated Finalist' where competition_name = 'Active Finalist';
select test_recognition.assert(
  (select competition_name = 'Updated Finalist' from public.competition_recognitions where logo_path = 'recognition-logos/active.webp'),
  'admin can update recognition content'
);
select test_recognition.denied(
  $q$select public.reorder_competition_recognitions(array[(select id from public.competition_recognitions limit 1)])$q$,
  'incomplete recognition reorder'
);
select test_recognition.denied(
  $q$select public.reorder_competition_recognitions(array[(select id from public.competition_recognitions limit 1), (select id from public.competition_recognitions limit 1)])$q$,
  'duplicate recognition reorder'
);
select test_recognition.denied(
  $q$insert into public.competition_recognitions (competition_name, logo_path) values ('Traversal', 'recognition-logos/../attack.webp')$q$,
  'unsafe recognition table path'
);
select test_recognition.denied(
  $q$insert into storage.objects (bucket_id, name, owner_id) values ('marketing-editorial', 'recognition-logos/../attack.webp', 'c2700000-0000-0000-0000-000000000001')$q$,
  'unsafe recognition storage path'
);
select test_recognition.denied(
  $q$insert into storage.objects (bucket_id, name, owner_id) values ('marketing-editorial', 'recognition-logos/attack.svg', 'c2700000-0000-0000-0000-000000000001')$q$,
  'unsupported recognition storage extension'
);
reset role;

set local role anon;
select test_recognition.assert((select count(*) = 1 from public.competition_recognitions), 'anonymous users see only active recognitions');
select test_recognition.assert((select count(*) = 2 from storage.objects where bucket_id = 'marketing-editorial' and name like 'recognition-logos/%'), 'anonymous users can read safe recognition objects');
select test_recognition.denied(
  $q$insert into public.competition_recognitions (competition_name, logo_path) values ('Anon', 'recognition-logos/anon.webp')$q$,
  'anonymous recognition insert'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2700000-0000-0000-0000-000000000002', true);
select test_recognition.assert((select count(*) = 1 from public.competition_recognitions), 'non-admin users see only active recognitions');
select test_recognition.denied($q$update public.competition_recognitions set is_active = false$q$, 'non-admin recognition update');
select test_recognition.denied($q$delete from public.competition_recognitions$q$, 'non-admin recognition delete');
select test_recognition.denied(
  $q$select public.reorder_competition_recognitions(array(select id from public.competition_recognitions))$q$,
  'non-admin recognition reorder'
);
select test_recognition.denied(
  $q$insert into storage.objects (bucket_id, name, owner_id) values ('marketing-editorial', 'recognition-logos/attack.webp', 'c2700000-0000-0000-0000-000000000002')$q$,
  'non-admin recognition storage upload'
);
reset role;

rollback;
select 'PASS: competition recognition table, reorder, RLS, and storage security' as result;
