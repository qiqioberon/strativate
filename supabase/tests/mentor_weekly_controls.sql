-- Disposable database only. All fixtures and mutations are rolled back.
begin;

create schema test_mentor_weekly;
grant usage on schema test_mentor_weekly to anon, authenticated, service_role;

create function test_mentor_weekly.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;

create function test_mentor_weekly.denied(command text, expected_state text, message text) returns void language plpgsql as $$
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

grant execute on all functions in schema test_mentor_weekly to anon, authenticated, service_role;

insert into auth.users (id, email) values
  ('83000000-0000-0000-0000-000000000001', 'admin@mentor-weekly.test'),
  ('83000000-0000-0000-0000-000000000002', 'mentor@mentor-weekly.test'),
  ('83000000-0000-0000-0000-000000000003', 'mentee@mentor-weekly.test');

update public.profiles set role = 'admin' where id = '83000000-0000-0000-0000-000000000001';
update public.profiles set role = 'mentor' where id = '83000000-0000-0000-0000-000000000002';
delete from public.mentee_profiles where user_id = '83000000-0000-0000-0000-000000000002';

select test_mentor_weekly.assert(
  (select is_active from public.mentor_profiles where user_id = '83000000-0000-0000-0000-000000000002'),
  'new mentor profiles are active by default'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '83000000-0000-0000-0000-000000000001', true);
select public.set_mentor_active('83000000-0000-0000-0000-000000000002', false);
select test_mentor_weekly.assert(
  not (select is_active from public.mentor_profiles where user_id = '83000000-0000-0000-0000-000000000002'),
  'admin can deactivate a mentor account'
);
select test_mentor_weekly.assert(
  (select count(*) = 1 from public.list_managed_mentors(0, '', null, 'inactive', 'all')
    where user_id = '83000000-0000-0000-0000-000000000002' and is_active = false),
  'admin list filters by actual account status'
);

select set_config('request.jwt.claim.sub', '83000000-0000-0000-0000-000000000002', true);
select test_mentor_weekly.denied(
  $$select public.set_mentor_active('83000000-0000-0000-0000-000000000002', true)$$,
  '42501',
  'mentor cannot reactivate own account'
);

select set_config('request.jwt.claim.sub', '83000000-0000-0000-0000-000000000001', true);
select public.set_mentor_active('83000000-0000-0000-0000-000000000002', true);

select set_config('request.jwt.claim.sub', '83000000-0000-0000-0000-000000000002', true);
select * from public.save_mentor_availability(
  '83000000-0000-0000-0000-000000000002',
  (date_trunc('week', current_timestamp at time zone 'Asia/Jakarta'))::date,
  '[{"day_of_week":1,"start_time":"18:00","end_time":"21:00"}]'::jsonb
);
select * from public.save_mentor_availability(
  '83000000-0000-0000-0000-000000000002',
  ((date_trunc('week', current_timestamp at time zone 'Asia/Jakarta'))::date + 7),
  '[{"day_of_week":2,"start_time":"19:00","end_time":"21:00"}]'::jsonb
);

select test_mentor_weekly.assert(
  (select count(*) = 1 from public.mentor_availability_rules
    where mentor_id = '83000000-0000-0000-0000-000000000002'
      and week_start_date = (date_trunc('week', current_timestamp at time zone 'Asia/Jakarta'))::date),
  'current-week availability is stored independently'
);
select test_mentor_weekly.assert(
  (select count(*) = 1 from public.mentor_availability_rules
    where mentor_id = '83000000-0000-0000-0000-000000000002'
      and week_start_date = ((date_trunc('week', current_timestamp at time zone 'Asia/Jakarta'))::date + 7)),
  'next-week availability is stored independently'
);

select * from public.save_mentor_availability(
  '83000000-0000-0000-0000-000000000002',
  (date_trunc('week', current_timestamp at time zone 'Asia/Jakarta'))::date,
  '[]'::jsonb
);
select test_mentor_weekly.assert(
  (select count(*) = 0 from public.mentor_availability_rules
    where mentor_id = '83000000-0000-0000-0000-000000000002'
      and week_start_date = (date_trunc('week', current_timestamp at time zone 'Asia/Jakarta'))::date)
  and
  (select count(*) = 1 from public.mentor_availability_rules
    where mentor_id = '83000000-0000-0000-0000-000000000002'
      and week_start_date = ((date_trunc('week', current_timestamp at time zone 'Asia/Jakarta'))::date + 7)),
  'saving one week never erases the other week'
);

select test_mentor_weekly.denied(
  format(
    $$select * from public.save_mentor_availability('83000000-0000-0000-0000-000000000002', %L::date, '[]'::jsonb)$$,
    ((date_trunc('week', current_timestamp at time zone 'Asia/Jakarta'))::date + 14)::text
  ),
  '22023',
  'mentor cannot configure a third week'
);

select set_config('request.jwt.claim.sub', '83000000-0000-0000-0000-000000000003', true);
select test_mentor_weekly.denied(
  $$select public.delete_mentor_account('83000000-0000-0000-0000-000000000002')$$,
  '42501',
  'mentee cannot delete a mentor account'
);

reset role;
insert into public.mentor_invites (email, invited_by, status, user_id, tier_id) values (
  'mentor@mentor-weekly.test',
  '83000000-0000-0000-0000-000000000001',
  'sent',
  '83000000-0000-0000-0000-000000000002',
  '81000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '83000000-0000-0000-0000-000000000001', true);
select public.delete_mentor_account('83000000-0000-0000-0000-000000000002');
reset role;

select test_mentor_weekly.assert(
  not exists (select 1 from auth.users where id = '83000000-0000-0000-0000-000000000002')
  and not exists (select 1 from public.profiles where id = '83000000-0000-0000-0000-000000000002')
  and not exists (select 1 from public.mentor_profiles where user_id = '83000000-0000-0000-0000-000000000002')
  and not exists (select 1 from public.mentor_availability_rules where mentor_id = '83000000-0000-0000-0000-000000000002')
  and not exists (select 1 from public.mentor_invites where email = 'mentor@mentor-weekly.test'),
  'admin deletion removes auth identity, mentor domain rows, availability, and invite registry entry'
);

rollback;
