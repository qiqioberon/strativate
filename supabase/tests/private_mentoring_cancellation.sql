-- Disposable database only. Private Mentoring cancellation regression suite.
begin;

create schema test_private_mentoring_cancellation;
grant usage on schema test_private_mentoring_cancellation to anon, authenticated, service_role;

create function test_private_mentoring_cancellation.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;

create function test_private_mentoring_cancellation.denied(command text, message text) returns void language plpgsql as $$
begin
  begin
    execute command;
  exception when insufficient_privilege or check_violation or unique_violation or exclusion_violation or foreign_key_violation or invalid_parameter_value or raise_exception then
    return;
  end;
  raise exception 'UNEXPECTEDLY ALLOWED: %', message;
end;
$$;

grant execute on all functions in schema test_private_mentoring_cancellation to anon, authenticated, service_role;

insert into auth.users (id, email, encrypted_password) values
  ('99000000-0000-0000-0000-000000000001', 'cancel-admin@test.invalid', 'hash'),
  ('99000000-0000-0000-0000-000000000002', 'cancel-mentee@test.invalid', 'hash'),
  ('99000000-0000-0000-0000-000000000003', 'cancel-mentor@test.invalid', 'hash');

update public.profiles set role = 'admin' where id = '99000000-0000-0000-0000-000000000001';
update public.profiles set role = 'mentor', mentor_setup_completed_at = now() where id = '99000000-0000-0000-0000-000000000003';
delete from public.mentee_profiles where user_id = '99000000-0000-0000-0000-000000000003';
update public.mentor_profiles
set tier_id = '81000000-0000-0000-0000-000000000001', timezone = 'Asia/Jakarta', is_active = true
where user_id = '99000000-0000-0000-0000-000000000003';
update public.mentee_profiles set onboarding_completed_at = now() where user_id = '99000000-0000-0000-0000-000000000002';

insert into public.carts (id, user_id, status)
values ('99100000-0000-0000-0000-000000000001','99000000-0000-0000-0000-000000000002','converted');
insert into public.orders (id, user_id, cart_id, status, currency_code, total_amount)
values ('99200000-0000-0000-0000-000000000001','99000000-0000-0000-0000-000000000002','99100000-0000-0000-0000-000000000001','pending_payment','IDR',885000);
insert into public.order_items (id, order_id, commerce_item_id, item_kind_snapshot, name_snapshot, slug_snapshot, unit_price_amount)
values ('99300000-0000-0000-0000-000000000001','99200000-0000-0000-0000-000000000001','97300000-0000-0000-0000-000000000002','private_mentoring','Private Mentoring','private-mentoring-cancellation-test',885000);
insert into public.private_mentoring_enrollments (id, mentee_id, order_item_id, package_id, purchased_sessions)
values ('99400000-0000-0000-0000-000000000001','99000000-0000-0000-0000-000000000002','99300000-0000-0000-0000-000000000001','97300000-0000-0000-0000-000000000002',3);
insert into public.private_mentoring_sessions (id, enrollment_id, session_number, session_focus_id, status) values
  ('99500000-0000-0000-0000-000000000001','99400000-0000-0000-0000-000000000001',1,'97200000-0000-0000-0000-000000000001','awaiting_scheduling'),
  ('99500000-0000-0000-0000-000000000002','99400000-0000-0000-0000-000000000001',2,'97200000-0000-0000-0000-000000000002','awaiting_scheduling'),
  ('99500000-0000-0000-0000-000000000003','99400000-0000-0000-0000-000000000001',3,'97200000-0000-0000-0000-000000000001','awaiting_scheduling');
update public.private_mentoring_enrollments set competition_name='Fixture Competition', competition_updated_at=now() where id='99400000-0000-0000-0000-000000000001';

insert into public.mentor_availability_rules (mentor_id, week_start_date, day_of_week, start_time, end_time)
values (
  '99000000-0000-0000-0000-000000000003',
  date_trunc('week', current_timestamp at time zone 'Asia/Jakarta')::date + 7,
  2,
  '09:00',
  '16:00'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '99000000-0000-0000-0000-000000000001', true);
select public.admin_schedule_private_mentoring_session(
  '99500000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000003',
  (((date_trunc('week', current_timestamp at time zone 'Asia/Jakarta')::date + 8)::timestamp + time '10:00') at time zone 'Asia/Jakarta')
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
update public.private_mentoring_session_calendar_integrations
set google_event_id = 'cancel-event-1',
    provider_meeting_url = 'https://meet.google.com/cancel-test',
    sync_status = 'synced'
where session_id = '99500000-0000-0000-0000-000000000001';
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '99000000-0000-0000-0000-000000000002', true);
select test_private_mentoring_cancellation.denied(
  $$select public.admin_cancel_private_mentoring_session('99500000-0000-0000-0000-000000000001')$$,
  'non-admin cannot cancel a scheduled session'
);

select set_config('request.jwt.claim.sub', '99000000-0000-0000-0000-000000000001', true);
select public.admin_cancel_private_mentoring_session('99500000-0000-0000-0000-000000000001');
select test_private_mentoring_cancellation.assert(
  (select status = 'cancelled' from public.private_mentoring_sessions where id = '99500000-0000-0000-0000-000000000001'),
  'admin transitions scheduled session to cancelled'
);
select test_private_mentoring_cancellation.assert(
  exists (
    select 1
    from public.get_admin_private_mentoring_enrollment_sessions('99400000-0000-0000-0000-000000000001')
    where session_id = '99500000-0000-0000-0000-000000000001'
      and google_sync_status = 'pending'
  ),
  'canonical cancellation marks external reconciliation pending through sanitized admin projection'
);

select public.admin_cancel_private_mentoring_session('99500000-0000-0000-0000-000000000001');
select test_private_mentoring_cancellation.assert(
  (select status = 'cancelled' from public.private_mentoring_sessions where id = '99500000-0000-0000-0000-000000000001'),
  'repeated cancellation is idempotent'
);

select test_private_mentoring_cancellation.assert(
  not exists (
    select 1
    from public.list_admin_private_mentoring_calendar_sessions(
      (((date_trunc('week', current_timestamp at time zone 'Asia/Jakarta')::date + 8)::timestamp + time '09:00') at time zone 'Asia/Jakarta'),
      (((date_trunc('week', current_timestamp at time zone 'Asia/Jakarta')::date + 8)::timestamp + time '12:00') at time zone 'Asia/Jakarta')
    )
    where session_id = '99500000-0000-0000-0000-000000000001'
  ),
  'cancelled session is absent from active admin calendar projection'
);

select public.admin_schedule_private_mentoring_session(
  '99500000-0000-0000-0000-000000000002',
  '99000000-0000-0000-0000-000000000003',
  (((date_trunc('week', current_timestamp at time zone 'Asia/Jakarta')::date + 8)::timestamp + time '10:00') at time zone 'Asia/Jakarta')
);
select test_private_mentoring_cancellation.assert(
  (select status = 'scheduled' from public.private_mentoring_sessions where id = '99500000-0000-0000-0000-000000000002'),
  'cancelled sessions no longer block mentor Strativate availability'
);

select test_private_mentoring_cancellation.denied(
  $$select public.admin_schedule_private_mentoring_session(
    '99500000-0000-0000-0000-000000000003',
    '99000000-0000-0000-0000-000000000003',
    (((date_trunc('week', current_timestamp at time zone 'Asia/Jakarta')::date + 8)::timestamp + time '10:15') at time zone 'Asia/Jakarta')
  )$$,
  'scheduled/completed overlap protection still rejects active mentor conflicts'
);

select public.admin_set_private_mentoring_session_status(
  '99500000-0000-0000-0000-000000000002',
  'completed'
);
select test_private_mentoring_cancellation.denied(
  $$select public.admin_cancel_private_mentoring_session('99500000-0000-0000-0000-000000000002')$$,
  'completed sessions cannot be cancelled'
);

select set_config('request.jwt.claim.sub', '99000000-0000-0000-0000-000000000002', true);
select test_private_mentoring_cancellation.assert(
  exists (
    select 1
    from public.list_my_private_mentoring_sessions_v2()
    where session_id = '99500000-0000-0000-0000-000000000001'
      and status = 'cancelled'
      and meeting_url is null
  ),
  'cancelled mentee history does not expose an active meeting URL'
);

rollback;
select 'PASS: Private Mentoring cancellation authorization, idempotency, slot release and history controls' as result;
