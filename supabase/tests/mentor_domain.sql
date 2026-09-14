-- Disposable database only. All fixtures and mutations are rolled back.
begin;

create schema test_mentor;
grant usage on schema test_mentor to anon, authenticated, service_role;

create function test_mentor.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;

create function test_mentor.denied(command text, expected_state text, message text) returns void language plpgsql as $$
begin
  begin
    execute command;
  exception when others then
    if sqlstate <> expected_state then
      raise exception 'Wrong SQLSTATE for %: expected %, got % (%)', message, expected_state, sqlstate, sqlerrm;
    end if;
    return;
  end;
  raise exception 'Unexpectedly allowed: %', message;
end;
$$;

grant execute on all functions in schema test_mentor to anon, authenticated, service_role;

select test_mentor.assert(to_regclass('public.mentor_tiers') is not null, 'mentor tier master exists');
select test_mentor.assert(to_regclass('public.mentor_profiles') is not null, 'mentor profiles exist');
select test_mentor.assert(to_regclass('public.mentor_availability_rules') is not null, 'mentor availability exists');
select test_mentor.assert(
  (select array_agg(code order by sort_order) from public.mentor_tiers)
    = array['TOP_STUDENT', 'YOUNG_PROFESSIONAL'],
  'only approved operational tiers are seeded'
);
select test_mentor.assert(
  (select count(*) = 2 and bool_and(is_active) from public.mentor_tiers),
  'both approved operational tiers are active'
);
select test_mentor.assert(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'mentor_invites'
      and column_name = 'tier_id' and is_nullable = 'YES'
  ),
  'mentor invitation tier stays nullable for legacy compatibility'
);

insert into auth.users (id, email) values
  ('82000000-0000-0000-0000-000000000001', 'admin@mentor.test'),
  ('82000000-0000-0000-0000-000000000002', 'mentor-a@mentor.test'),
  ('82000000-0000-0000-0000-000000000003', 'mentor-b@mentor.test'),
  ('82000000-0000-0000-0000-000000000004', 'mentee@mentor.test');
update public.profiles set role = 'admin' where id = '82000000-0000-0000-0000-000000000001';
update public.profiles set role = 'mentor' where id in (
  '82000000-0000-0000-0000-000000000002',
  '82000000-0000-0000-0000-000000000003'
);
delete from public.mentee_profiles where user_id in (
  '82000000-0000-0000-0000-000000000002',
  '82000000-0000-0000-0000-000000000003'
);

select test_mentor.assert(
  (select count(*) = 2 from public.mentor_profiles where user_id in (
    '82000000-0000-0000-0000-000000000002',
    '82000000-0000-0000-0000-000000000003'
  )),
  'mentor role changes create operational profiles'
);
select test_mentor.assert(
  (select bool_and(tier_id is null and timezone = 'Asia/Jakarta') from public.mentor_profiles where user_id in (
    '82000000-0000-0000-0000-000000000002',
    '82000000-0000-0000-0000-000000000003'
  )),
  'legacy mentors keep an unknown tier and receive the default timezone'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000001', true);
select public.set_mentor_tier(
  '82000000-0000-0000-0000-000000000002',
  '81000000-0000-0000-0000-000000000001'
);
select test_mentor.assert(
  (select tier_id = '81000000-0000-0000-0000-000000000001'
    from public.mentor_profiles where user_id = '82000000-0000-0000-0000-000000000002'),
  'admin assigns mentor tier'
);
select public.set_mentor_tier(
  '82000000-0000-0000-0000-000000000002',
  '81000000-0000-0000-0000-000000000002'
);
select test_mentor.assert(
  (select tier_id = '81000000-0000-0000-0000-000000000002'
    from public.mentor_profiles where user_id = '82000000-0000-0000-0000-000000000002'),
  'admin changes mentor tier'
);
reset role;

update public.mentor_tiers set is_active = false where id = '81000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000001', true);
select test_mentor.denied(
  $$select public.set_mentor_tier('82000000-0000-0000-0000-000000000003','81000000-0000-0000-0000-000000000001')$$,
  '22023',
  'admin cannot assign an inactive tier'
);
reset role;
update public.mentor_tiers set is_active = true where id = '81000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000002', true);
select test_mentor.denied(
  $$select public.set_mentor_tier('82000000-0000-0000-0000-000000000002','81000000-0000-0000-0000-000000000001')$$,
  '42501',
  'mentor cannot change own tier'
);
select test_mentor.denied(
  $$update public.mentor_profiles set tier_id = '81000000-0000-0000-0000-000000000001' where user_id = '82000000-0000-0000-0000-000000000002'$$,
  '42501',
  'mentor has no direct tier mutation grant'
);
select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000004', true);
select test_mentor.denied(
  $$select public.set_mentor_tier('82000000-0000-0000-0000-000000000002','81000000-0000-0000-0000-000000000001')$$,
  '42501',
  'mentee cannot change mentor tier'
);
reset role;

set local role service_role;
select test_mentor.denied(
  $$insert into public.mentor_invites (email, invited_by) values ('missing-tier@mentor.test','82000000-0000-0000-0000-000000000001')$$,
  '22023',
  'new invitation requires a tier at the database boundary'
);
reset role;
update public.mentor_tiers set is_active = false where id = '81000000-0000-0000-0000-000000000001';
set local role service_role;
select test_mentor.denied(
  $$insert into public.mentor_invites (email, invited_by, tier_id) values ('inactive-tier@mentor.test','82000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001')$$,
  '22023',
  'new invitation rejects an inactive tier at the database boundary'
);
reset role;
update public.mentor_tiers set is_active = true where id = '81000000-0000-0000-0000-000000000001';

insert into public.mentor_invites (email, invited_by, tier_id) values
  ('insert-path@mentor.test', '82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001'),
  ('update-path@mentor.test', '82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002');
insert into auth.users (id, email, invited_at) values
  ('82000000-0000-0000-0000-000000000005', 'insert-path@mentor.test', now());
insert into auth.users (id, email) values
  ('82000000-0000-0000-0000-000000000006', 'update-path@mentor.test');
update auth.users set invited_at = now() where id = '82000000-0000-0000-0000-000000000006';

select test_mentor.assert(
  (select role = 'mentor' from public.profiles where id = '82000000-0000-0000-0000-000000000005')
  and (select tier_id = '81000000-0000-0000-0000-000000000001'
    from public.mentor_profiles where user_id = '82000000-0000-0000-0000-000000000005')
  and (select user_id = '82000000-0000-0000-0000-000000000005'
    from public.mentor_invites where email = 'insert-path@mentor.test'),
  'trusted Auth insert propagates the exact invitation tier'
);
select test_mentor.assert(
  (select role = 'mentor' from public.profiles where id = '82000000-0000-0000-0000-000000000006')
  and (select tier_id = '81000000-0000-0000-0000-000000000002'
    from public.mentor_profiles where user_id = '82000000-0000-0000-0000-000000000006')
  and not exists (select 1 from public.mentee_profiles where user_id = '82000000-0000-0000-0000-000000000006'),
  'trusted Auth update propagates the exact invitation tier'
);

alter table public.mentor_invites disable trigger mentor_invites_validate_tier;
insert into public.mentor_invites (email, invited_by) values
  ('legacy-tierless@mentor.test', '82000000-0000-0000-0000-000000000001');
alter table public.mentor_invites enable trigger mentor_invites_validate_tier;
insert into auth.users (id, email, invited_at) values
  ('82000000-0000-0000-0000-000000000007', 'legacy-tierless@mentor.test', now());
select test_mentor.assert(
  (select role = 'mentor' from public.profiles where id = '82000000-0000-0000-0000-000000000007')
  and (select tier_id is null from public.mentor_profiles where user_id = '82000000-0000-0000-0000-000000000007'),
  'pre-migration tierless invitation remains compatible without fabricated data'
);
update public.mentor_invites set status = 'sent'
  where email = 'legacy-tierless@mentor.test';
select test_mentor.assert(
  (select status = 'sent' from public.mentor_invites where email = 'legacy-tierless@mentor.test'),
  'legacy tierless invitation may continue existing lifecycle updates'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000002', true);
select * from public.save_mentor_availability(
  '82000000-0000-0000-0000-000000000002',
  '[{"day_of_week":1,"start_time":"18:00","end_time":"21:00"},{"day_of_week":6,"start_time":"09:00","end_time":"12:00"},{"day_of_week":6,"start_time":"12:00","end_time":"14:00"}]'::jsonb
);
select test_mentor.assert(
  (select count(*) = 3 from public.mentor_availability_rules),
  'mentor saves a complete week with multiple and adjacent ranges'
);
select test_mentor.assert(
  (select count(*) = 3 and bool_and(mentor_id = auth.uid()) from public.mentor_availability_rules),
  'mentor reads only own availability'
);
select test_mentor.denied(
  $$select * from public.save_mentor_availability('82000000-0000-0000-0000-000000000003','[]'::jsonb)$$,
  '42501',
  'mentor cannot modify another mentor availability'
);
select test_mentor.denied(
  $$insert into public.mentor_availability_rules (mentor_id,day_of_week,start_time,end_time) values ('82000000-0000-0000-0000-000000000002',2,'10:00','11:00')$$,
  '42501',
  'mentor cannot bypass atomic availability RPC'
);
select test_mentor.denied(
  $$select * from public.save_mentor_availability('82000000-0000-0000-0000-000000000002','[{"day_of_week":0,"start_time":"10:00","end_time":"11:00"}]'::jsonb)$$,
  '22023',
  'weekday outside Monday to Sunday is rejected'
);
select test_mentor.denied(
  $$select * from public.save_mentor_availability('82000000-0000-0000-0000-000000000002','[{"day_of_week":2,"start_time":"11:00","end_time":"11:00"}]'::jsonb)$$,
  '22023',
  'equal start and end is rejected'
);
select test_mentor.denied(
  $$select * from public.save_mentor_availability('82000000-0000-0000-0000-000000000002','[{"day_of_week":2,"start_time":"12:00","end_time":"11:00"}]'::jsonb)$$,
  '22023',
  'reversed availability range is rejected'
);
select test_mentor.denied(
  $$select * from public.save_mentor_availability('82000000-0000-0000-0000-000000000002','[{"day_of_week":1,"start_time":"18:00","end_time":"21:00"},{"day_of_week":1,"start_time":"20:00","end_time":"22:00"}]'::jsonb)$$,
  '23P01',
  'overlapping availability ranges are rejected'
);
select test_mentor.assert(
  (select count(*) = 3 from public.mentor_availability_rules),
  'failed whole-week replacement rolls back to the previous configuration'
);
select test_mentor.denied(
  $$select * from public.save_mentor_availability('82000000-0000-0000-0000-000000000002','{}'::jsonb)$$,
  '22023',
  'availability payload must be an array'
);

select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000004', true);
select test_mentor.assert(
  (select count(*) = 0 from public.mentor_profiles)
  and (select count(*) = 0 from public.mentor_availability_rules),
  'mentee cannot read private mentor management data'
);
select test_mentor.assert(
  (select count(*) = 2 and bool_and(is_active) from public.mentor_tiers),
  'mentee can read active mentor tier taxonomy used by public Private Mentoring packages'
);
select test_mentor.denied(
  $$select * from public.save_mentor_availability('82000000-0000-0000-0000-000000000002','[]'::jsonb)$$,
  '42501',
  'mentee cannot modify mentor availability'
);
select test_mentor.denied(
  $$select * from public.list_managed_mentors(0,'',null,'all')$$,
  '42501',
  'mentee cannot list managed mentors'
);

select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000001', true);
select test_mentor.assert(
  (select count(*) >= 5 from public.mentor_profiles),
  'admin reads all operational mentor profiles'
);
select test_mentor.assert(
  (select count(*) = 3 from public.mentor_availability_rules),
  'admin reads any mentor availability'
);
select * from public.save_mentor_availability(
  '82000000-0000-0000-0000-000000000003',
  '[{"day_of_week":3,"start_time":"18:00","end_time":"21:00"}]'::jsonb
);
select test_mentor.assert(
  (select count(*) = 1 from public.mentor_availability_rules where mentor_id = '82000000-0000-0000-0000-000000000003'),
  'admin modifies another mentor availability'
);
select test_mentor.assert(
  (select count(*) >= 5 from public.list_managed_mentors(0, '', null, 'all')),
  'admin lists active mentor accounts'
);
select test_mentor.assert(
  (select tier_id = '81000000-0000-0000-0000-000000000001'
    and tier_name = 'Top Student'
    from public.list_mentor_invites(0)
    where email = 'insert-path@mentor.test'),
  'admin invitation list includes operational tier identity'
);
reset role;

select test_mentor.denied(
  $$insert into public.mentor_profiles (user_id) values ('82000000-0000-0000-0000-000000000004')$$,
  '22023',
  'non-mentor account cannot own a mentor profile'
);
select test_mentor.assert(
  to_regclass('public.catalog_mentor_tiers') is null,
  'legacy Product Catalog mentor tiers are removed while operational mentor_tiers remain canonical'
);

rollback;
select 'PASS: mentor domain tiers, invitations, availability, and authorization' as result;
