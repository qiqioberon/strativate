-- Disposable database only. Calendar scheduling / credential access regression suite.
begin;

create schema test_calendar_scheduling;
grant usage on schema test_calendar_scheduling to anon, authenticated, service_role;

create function test_calendar_scheduling.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;

create function test_calendar_scheduling.denied(command text, message text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when insufficient_privilege or check_violation or unique_violation or exclusion_violation or foreign_key_violation or invalid_parameter_value or raise_exception then return;
  end;
  raise exception 'UNEXPECTEDLY ALLOWED: %', message;
end;
$$;

grant execute on all functions in schema test_calendar_scheduling to anon, authenticated, service_role;

select test_calendar_scheduling.assert(
  not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('google_calendar_connections','google_calendar_oauth_states','private_mentoring_session_calendar_integrations')
      and grantee = 'authenticated'
  ),
  'authenticated receives no raw credential or external integration table grants'
);

insert into auth.users (id, email, encrypted_password) values
  ('98000000-0000-0000-0000-000000000001', 'calendar-admin@test.invalid', 'hash'),
  ('98000000-0000-0000-0000-000000000002', 'calendar-mentee-a@test.invalid', 'hash'),
  ('98000000-0000-0000-0000-000000000003', 'calendar-mentee-b@test.invalid', 'hash'),
  ('98000000-0000-0000-0000-000000000004', 'calendar-mentor-a@test.invalid', 'hash'),
  ('98000000-0000-0000-0000-000000000005', 'calendar-mentor-b@test.invalid', 'hash');

update public.profiles set role = 'admin' where id = '98000000-0000-0000-0000-000000000001';
update public.profiles set role = 'mentor', mentor_setup_completed_at = now() where id in ('98000000-0000-0000-0000-000000000004','98000000-0000-0000-0000-000000000005');
delete from public.mentee_profiles where user_id in ('98000000-0000-0000-0000-000000000004','98000000-0000-0000-0000-000000000005');
update public.mentor_profiles
set tier_id = '81000000-0000-0000-0000-000000000001', timezone = 'Asia/Jakarta', is_active = true
where user_id in ('98000000-0000-0000-0000-000000000004','98000000-0000-0000-0000-000000000005');
update public.mentee_profiles set onboarding_completed_at = now() where user_id in ('98000000-0000-0000-0000-000000000002','98000000-0000-0000-0000-000000000003');

insert into public.carts (id, user_id, status) values
  ('98100000-0000-0000-0000-000000000001','98000000-0000-0000-0000-000000000002','converted'),
  ('98100000-0000-0000-0000-000000000002','98000000-0000-0000-0000-000000000003','converted');
insert into public.orders (id, user_id, cart_id, status, currency_code, total_amount) values
  ('98200000-0000-0000-0000-000000000001','98000000-0000-0000-0000-000000000002','98100000-0000-0000-0000-000000000001','pending_payment','IDR',885000),
  ('98200000-0000-0000-0000-000000000002','98000000-0000-0000-0000-000000000003','98100000-0000-0000-0000-000000000002','pending_payment','IDR',885000);
insert into public.order_items (id, order_id, commerce_item_id, item_kind_snapshot, name_snapshot, slug_snapshot, unit_price_amount) values
  ('98300000-0000-0000-0000-000000000001','98200000-0000-0000-0000-000000000001','97300000-0000-0000-0000-000000000002','private_mentoring','Private Mentoring','private-mentoring-top-student-3',885000),
  ('98300000-0000-0000-0000-000000000002','98200000-0000-0000-0000-000000000002','97300000-0000-0000-0000-000000000002','private_mentoring','Private Mentoring','private-mentoring-top-student-3-b',885000);
insert into public.private_mentoring_enrollments (id, mentee_id, order_item_id, package_id, purchased_sessions) values
  ('98400000-0000-0000-0000-000000000001','98000000-0000-0000-0000-000000000002','98300000-0000-0000-0000-000000000001','97300000-0000-0000-0000-000000000002',3),
  ('98400000-0000-0000-0000-000000000002','98000000-0000-0000-0000-000000000003','98300000-0000-0000-0000-000000000002','97300000-0000-0000-0000-000000000002',3);
insert into public.private_mentoring_sessions (id, enrollment_id, session_number, session_focus_id, status) values
  ('98500000-0000-0000-0000-000000000001','98400000-0000-0000-0000-000000000001',1,'97200000-0000-0000-0000-000000000001','awaiting_scheduling'),
  ('98500000-0000-0000-0000-000000000002','98400000-0000-0000-0000-000000000001',2,'97200000-0000-0000-0000-000000000002','awaiting_scheduling'),
  ('98500000-0000-0000-0000-000000000003','98400000-0000-0000-0000-000000000002',1,'97200000-0000-0000-0000-000000000001','awaiting_scheduling');

insert into public.mentor_availability_rules (mentor_id, week_start_date, day_of_week, start_time, end_time)
select id, (date_trunc('week', current_timestamp at time zone 'Asia/Jakarta')::date + 7), 2, '09:00', '16:00'
from public.profiles where id in ('98000000-0000-0000-0000-000000000004','98000000-0000-0000-0000-000000000005');

set local role service_role;
insert into public.google_calendar_connections (user_id, account_email, calendar_id, granted_scopes, encrypted_refresh_token, status)
values ('98000000-0000-0000-0000-000000000002','calendar-mentee-a@test.invalid','primary',array['calendar.events.readonly'],'v1:test-token','connected');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '98000000-0000-0000-0000-000000000002', true);
select test_calendar_scheduling.denied($$select encrypted_refresh_token from public.google_calendar_connections$$, 'mentee cannot read raw Google refresh token');
select test_calendar_scheduling.assert((select count(*) = 1 from public.get_my_google_calendar_connection() where account_email='calendar-mentee-a@test.invalid'), 'owner receives sanitized connection status');
select test_calendar_scheduling.assert((select count(*) = 0 from public.list_my_mentor_private_mentoring_sessions()), 'mentee cannot see mentor-assigned session projection');

select set_config('request.jwt.claim.sub', '98000000-0000-0000-0000-000000000003', true);
select test_calendar_scheduling.assert((select count(*) = 0 from public.get_my_google_calendar_connection()), 'another mentee cannot see owner Google connection');
select test_calendar_scheduling.assert((select count(*) = 1 from public.list_my_private_mentoring_sessions_v2()), 'mentee sees only own Strativate sessions');

select set_config('request.jwt.claim.sub', '98000000-0000-0000-0000-000000000001', true);
select test_calendar_scheduling.denied($$select encrypted_refresh_token from public.google_calendar_connections$$, 'admin cannot read raw Google refresh token');
select test_calendar_scheduling.denied($$select public.service_get_private_mentoring_sync_context('98500000-0000-0000-0000-000000000001')$$, 'admin cannot call service-only sync context');
select test_calendar_scheduling.assert(jsonb_array_length(public.admin_get_private_mentoring_slot_context('98500000-0000-0000-0000-000000000001')->'mentors') = 2, 'admin receives eligible mentor availability context without Google event detail');

select test_calendar_scheduling.denied(
  $$select public.admin_schedule_private_mentoring_session('98500000-0000-0000-0000-000000000001','98000000-0000-0000-0000-000000000004',(((date_trunc('week', current_timestamp at time zone 'Asia/Jakarta')::date + 7 + 1)::timestamp + time '08:00') at time zone 'Asia/Jakarta'))$$,
  'server-side booking rejects time outside declared availability'
);

select public.admin_schedule_private_mentoring_session(
  '98500000-0000-0000-0000-000000000001',
  '98000000-0000-0000-0000-000000000004',
  (((date_trunc('week', current_timestamp at time zone 'Asia/Jakarta')::date + 7 + 1)::timestamp + time '10:00') at time zone 'Asia/Jakarta')
);
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select test_calendar_scheduling.assert(
  (select count(*) = 1 and bool_and(sync_status='pending' and organizer_user_id='98000000-0000-0000-0000-000000000001') from public.private_mentoring_session_calendar_integrations where session_id='98500000-0000-0000-0000-000000000001'),
  'booking creates exactly one pending calendar integration row linked to the canonical session'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '98000000-0000-0000-0000-000000000001', true);
select test_calendar_scheduling.denied(
  $$select public.admin_schedule_private_mentoring_session('98500000-0000-0000-0000-000000000002','98000000-0000-0000-0000-000000000004',(((date_trunc('week', current_timestamp at time zone 'Asia/Jakarta')::date + 7 + 1)::timestamp + time '10:15') at time zone 'Asia/Jakarta'))$$,
  'overlap exclusion prevents concurrent mentor double booking'
);

select set_config('request.jwt.claim.sub', '98000000-0000-0000-0000-000000000004', true);
select test_calendar_scheduling.assert((select count(*) = 1 from public.list_my_mentor_private_mentoring_sessions()), 'mentor sees only assigned Strativate sessions');
select test_calendar_scheduling.assert((select count(*) = 0 from public.list_my_private_mentoring_sessions_v2()), 'mentor cannot see mentee-owned session projection');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select test_calendar_scheduling.assert(
  (public.service_get_private_mentoring_sync_context('98500000-0000-0000-0000-000000000001')->>'menteeEmail') = 'calendar-mentee-a@test.invalid',
  'service integration layer can read attendee sync context'
);
reset role;

rollback;
select 'PASS: Google Calendar scheduling security, isolation, availability and overlap controls' as result;
