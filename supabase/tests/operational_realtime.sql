-- Disposable database only. Operational invalidation RLS and trusted-writer coverage.
begin;

create schema test_operational_realtime;

create function test_operational_realtime.assert(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if ok is distinct from true then
    raise exception 'ASSERTION FAILED: %', message;
  end if;
end;
$$;

create function test_operational_realtime.denied(command text, message text)
returns void
language plpgsql
as $$
begin
  begin
    execute command;
  exception
    when insufficient_privilege
      or check_violation
      or unique_violation
      or foreign_key_violation
      or invalid_parameter_value
      or raise_exception
    then return;
  end;
  raise exception 'UNEXPECTEDLY ALLOWED: %', message;
end;
$$;

create table test_operational_realtime.revision_baselines (
  name text primary key,
  revision bigint not null
);

grant usage on schema test_operational_realtime to authenticated, service_role;
grant execute on all functions in schema test_operational_realtime to authenticated, service_role;
grant select, insert, update on table test_operational_realtime.revision_baselines to service_role;

select test_operational_realtime.assert(
  to_regclass('public.operational_invalidation_versions') is not null,
  'bounded operational invalidation table exists'
);
select test_operational_realtime.assert(
  to_regprocedure('public.bump_operational_invalidation(public.app_role,uuid,text)') is not null,
  'trusted bump helper exists'
);
select test_operational_realtime.assert(
  not has_function_privilege(
    'authenticated',
    'public.bump_operational_invalidation(public.app_role,uuid,text)',
    'execute'
  ),
  'authenticated cannot execute the bump helper'
);
select test_operational_realtime.assert(
  not has_function_privilege(
    'anon',
    'public.bump_operational_invalidation(public.app_role,uuid,text)',
    'execute'
  ),
  'anon cannot execute the bump helper'
);

insert into auth.users (id, email, encrypted_password) values
  ('99800000-0000-0000-0000-000000000001', 'revision-admin@test.invalid', 'hash'),
  ('99800000-0000-0000-0000-000000000002', 'revision-mentor@test.invalid', 'hash'),
  ('99800000-0000-0000-0000-000000000003', 'revision-mentee-a@test.invalid', 'hash'),
  ('99800000-0000-0000-0000-000000000004', 'revision-mentee-b@test.invalid', 'hash');

update public.profiles
set role = 'admin'
where id = '99800000-0000-0000-0000-000000000001';

update public.profiles
set role = 'mentor', mentor_setup_completed_at = now()
where id = '99800000-0000-0000-0000-000000000002';

delete from public.mentee_profiles
where user_id in (
  '99800000-0000-0000-0000-000000000001',
  '99800000-0000-0000-0000-000000000002'
);

set local role service_role;
select public.bump_operational_invalidation('admin', null, 'admin-overview');
select public.bump_operational_invalidation('admin', null, 'admin-overview');
select public.bump_operational_invalidation(
  'mentor',
  '99800000-0000-0000-0000-000000000002',
  'mentor-dashboard'
);
select public.bump_operational_invalidation(
  'mentee',
  '99800000-0000-0000-0000-000000000003',
  'cart'
);
select public.bump_operational_invalidation(
  'mentee',
  '99800000-0000-0000-0000-000000000004',
  'cart'
);
select public.bump_operational_invalidation('mentee', null, 'availability');
reset role;

select test_operational_realtime.assert(
  (
    select count(*) = 1 and max(revision) = 2
    from public.operational_invalidation_versions
    where recipient_role = 'admin'
      and recipient_user_id is null
      and domain = 'admin-overview'
  ),
  'two trusted bumps atomically update one bounded row'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '99800000-0000-0000-0000-000000000001',
  true
);
select test_operational_realtime.assert(
  (
    select count(*) = 1
    from public.operational_invalidation_versions
    where recipient_role = 'admin'
      and recipient_user_id is null
      and domain = 'admin-overview'
  ),
  'admin reads role-wide admin revision'
);
select test_operational_realtime.assert(
  (
    select count(*) = 0
    from public.operational_invalidation_versions
    where recipient_role <> 'admin'
  ),
  'admin cannot read another role revision'
);
select test_operational_realtime.denied(
  $q$select public.bump_operational_invalidation('admin', null, 'commerce')$q$,
  'authenticated admin cannot invoke the trusted bump helper'
);
select test_operational_realtime.denied(
  $q$insert into public.operational_invalidation_versions(recipient_role, recipient_user_id, domain) values ('admin', null, 'commerce')$q$,
  'authenticated admin cannot insert invalidation rows'
);
select test_operational_realtime.denied(
  $q$update public.operational_invalidation_versions set revision = revision + 100$q$,
  'authenticated admin cannot update invalidation rows'
);
select test_operational_realtime.denied(
  $q$delete from public.operational_invalidation_versions$q$,
  'authenticated admin cannot delete invalidation rows'
);

select set_config(
  'request.jwt.claim.sub',
  '99800000-0000-0000-0000-000000000002',
  true
);
select test_operational_realtime.assert(
  (
    select count(*) = 0
    from public.operational_invalidation_versions
    where recipient_role = 'admin'
  ),
  'mentor sees zero admin role-wide revisions'
);
select test_operational_realtime.assert(
  (
    select count(*) = 1
      and bool_and(recipient_user_id = '99800000-0000-0000-0000-000000000002')
    from public.operational_invalidation_versions
  ),
  'mentor sees only the exact mentor-scoped revision'
);

select set_config(
  'request.jwt.claim.sub',
  '99800000-0000-0000-0000-000000000003',
  true
);
select test_operational_realtime.assert(
  (
    select count(*) = 0
    from public.operational_invalidation_versions
    where recipient_role = 'admin'
  ),
  'mentee sees zero admin role-wide revisions'
);
select test_operational_realtime.assert(
  (
    select count(*) = 0
    from public.operational_invalidation_versions
    where recipient_user_id = '99800000-0000-0000-0000-000000000004'
  ),
  'mentee A cannot read Mentee B user-scoped revision'
);
select test_operational_realtime.assert(
  (
    select count(*) = 2
      and count(*) filter (
        where recipient_user_id = '99800000-0000-0000-0000-000000000003'
      ) = 1
      and count(*) filter (
        where recipient_user_id is null
          and recipient_role = 'mentee'
          and domain = 'availability'
      ) = 1
    from public.operational_invalidation_versions
  ),
  'mentee A sees own user revision plus intended Mentee role-wide revision'
);

select set_config(
  'request.jwt.claim.sub',
  '99800000-0000-0000-0000-000000000004',
  true
);
select test_operational_realtime.assert(
  (
    select count(*) = 0
    from public.operational_invalidation_versions
    where recipient_user_id = '99800000-0000-0000-0000-000000000003'
  ),
  'mentee B cannot read Mentee A user-scoped revision'
);
select test_operational_realtime.denied(
  $q$insert into public.operational_invalidation_versions(recipient_role, recipient_user_id, domain) values ('mentee', auth.uid(), 'cart')$q$,
  'authenticated Mentee cannot insert an invalidation row'
);
reset role;


-- Provider/recording invalidation regression fixtures. These execute the real table triggers.
set local role service_role;

insert into public.carts (id, user_id, status)
values ('99810000-0000-0000-0000-000000000001', '99800000-0000-0000-0000-000000000003', 'converted');

insert into public.orders (id, user_id, cart_id, status, total_amount)
values (
  '99820000-0000-0000-0000-000000000001',
  '99800000-0000-0000-0000-000000000003',
  '99810000-0000-0000-0000-000000000001',
  'pending_payment',
  300000
);

insert into public.order_items (
  id, order_id, commerce_item_id, item_kind_snapshot, name_snapshot, slug_snapshot, unit_price_amount
)
select
  '99830000-0000-0000-0000-000000000001',
  '99820000-0000-0000-0000-000000000001',
  p.id,
  'private_mentoring',
  'Realtime Private Mentoring',
  'realtime-private-mentoring',
  p.price_amount
from public.private_mentoring_packages p
where p.id = '97300000-0000-0000-0000-000000000001';

update public.orders
set status = 'paid', paid_at = now()
where id = '99820000-0000-0000-0000-000000000001';

insert into public.private_mentoring_session_calendar_integrations (session_id)
select s.id
from public.private_mentoring_sessions s
join public.private_mentoring_enrollments e on e.id = s.enrollment_id
where e.order_item_id = '99830000-0000-0000-0000-000000000001'
  and s.session_number = 1;

insert into test_operational_realtime.revision_baselines(name, revision)
select 'private-provider-status', revision
from public.operational_invalidation_versions
where recipient_role = 'mentee'
  and recipient_user_id = '99800000-0000-0000-0000-000000000003'
  and domain = 'provider';

update public.private_mentoring_session_calendar_integrations
set provider_sync_status = 'ready'
where session_id = (
  select s.id
  from public.private_mentoring_sessions s
  join public.private_mentoring_enrollments e on e.id = s.enrollment_id
  where e.order_item_id = '99830000-0000-0000-0000-000000000001'
    and s.session_number = 1
);

select test_operational_realtime.assert(
  (
    select revision from public.operational_invalidation_versions
    where recipient_role = 'mentee'
      and recipient_user_id = '99800000-0000-0000-0000-000000000003'
      and domain = 'provider'
  ) = (
    select revision + 1 from test_operational_realtime.revision_baselines
    where name = 'private-provider-status'
  ),
  'Private provider_sync_status increments the bounded provider revision'
);

insert into test_operational_realtime.revision_baselines(name, revision)
select 'private-recording-status', revision
from public.operational_invalidation_versions
where recipient_role = 'mentee'
  and recipient_user_id = '99800000-0000-0000-0000-000000000003'
  and domain = 'provider';

update public.private_mentoring_session_calendar_integrations
set recording_status = 'processing'
where session_id = (
  select s.id
  from public.private_mentoring_sessions s
  join public.private_mentoring_enrollments e on e.id = s.enrollment_id
  where e.order_item_id = '99830000-0000-0000-0000-000000000001'
    and s.session_number = 1
);

select test_operational_realtime.assert(
  (
    select revision from public.operational_invalidation_versions
    where recipient_role = 'mentee'
      and recipient_user_id = '99800000-0000-0000-0000-000000000003'
      and domain = 'provider'
  ) = (
    select revision + 1 from test_operational_realtime.revision_baselines
    where name = 'private-recording-status'
  ),
  'Private recording_status increments the bounded provider revision'
);

insert into test_operational_realtime.revision_baselines(name, revision)
select 'private-unrelated', revision
from public.operational_invalidation_versions
where recipient_role = 'mentee'
  and recipient_user_id = '99800000-0000-0000-0000-000000000003'
  and domain = 'provider';

update public.private_mentoring_session_calendar_integrations
set last_synced_at = now()
where session_id = (
  select s.id
  from public.private_mentoring_sessions s
  join public.private_mentoring_enrollments e on e.id = s.enrollment_id
  where e.order_item_id = '99830000-0000-0000-0000-000000000001'
    and s.session_number = 1
);

select test_operational_realtime.assert(
  (
    select revision from public.operational_invalidation_versions
    where recipient_role = 'mentee'
      and recipient_user_id = '99800000-0000-0000-0000-000000000003'
      and domain = 'provider'
  ) = (
    select revision from test_operational_realtime.revision_baselines
    where name = 'private-unrelated'
  ),
  'Private unrelated integration timestamps do not bump provider revisions'
);

insert into public.carts (id, user_id, status)
values ('99810000-0000-0000-0000-000000000002', '99800000-0000-0000-0000-000000000003', 'converted');

insert into public.orders (id, user_id, cart_id, status, total_amount)
select
  '99820000-0000-0000-0000-000000000002',
  '99800000-0000-0000-0000-000000000003',
  '99810000-0000-0000-0000-000000000002',
  'pending_payment',
  p.price_amount
from public.intensive_mentoring_packages p
where p.code = 'INTENSIVE';

insert into public.order_items (
  id, order_id, commerce_item_id, item_kind_snapshot, name_snapshot, slug_snapshot, unit_price_amount
)
select
  '99830000-0000-0000-0000-000000000002',
  '99820000-0000-0000-0000-000000000002',
  p.id,
  'intensive_mentoring_package',
  'Realtime Intensive Mentoring',
  'realtime-intensive-mentoring',
  p.price_amount
from public.intensive_mentoring_packages p
where p.code = 'INTENSIVE';

update public.orders
set status = 'paid', paid_at = now()
where id = '99820000-0000-0000-0000-000000000002';

insert into public.intensive_mentoring_sessions (
  id, engagement_id, session_number, duration_minutes, created_by
)
select
  '99840000-0000-0000-0000-000000000002',
  e.engagement_id,
  1,
  60,
  '99800000-0000-0000-0000-000000000001'
from public.intensive_mentoring_entitlements e
where e.order_item_id = '99830000-0000-0000-0000-000000000002';

insert into public.intensive_mentoring_session_calendar_integrations (session_id)
values ('99840000-0000-0000-0000-000000000002');

insert into test_operational_realtime.revision_baselines(name, revision)
select 'intensive-provider-status', revision
from public.operational_invalidation_versions
where recipient_role = 'mentee'
  and recipient_user_id = '99800000-0000-0000-0000-000000000003'
  and domain = 'provider';

update public.intensive_mentoring_session_calendar_integrations
set provider_sync_status = 'ready'
where session_id = '99840000-0000-0000-0000-000000000002';

select test_operational_realtime.assert(
  (
    select revision from public.operational_invalidation_versions
    where recipient_role = 'mentee'
      and recipient_user_id = '99800000-0000-0000-0000-000000000003'
      and domain = 'provider'
  ) = (
    select revision + 1 from test_operational_realtime.revision_baselines
    where name = 'intensive-provider-status'
  ),
  'Intensive provider_sync_status increments the bounded provider revision'
);

insert into test_operational_realtime.revision_baselines(name, revision)
select 'intensive-recording-status', revision
from public.operational_invalidation_versions
where recipient_role = 'mentee'
  and recipient_user_id = '99800000-0000-0000-0000-000000000003'
  and domain = 'provider';

update public.intensive_mentoring_session_calendar_integrations
set recording_status = 'processing'
where session_id = '99840000-0000-0000-0000-000000000002';

select test_operational_realtime.assert(
  (
    select revision from public.operational_invalidation_versions
    where recipient_role = 'mentee'
      and recipient_user_id = '99800000-0000-0000-0000-000000000003'
      and domain = 'provider'
  ) = (
    select revision + 1 from test_operational_realtime.revision_baselines
    where name = 'intensive-recording-status'
  ),
  'Intensive recording_status increments the bounded provider revision'
);


-- Deleting a mentor cascades availability rows after the mentor recipient can
-- already be gone. The cascade must still invalidate role-wide availability
-- without weakening the protected recipient validation helper.
set local role service_role;

insert into public.mentor_availability_rules (
  mentor_id,
  week_start_date,
  day_of_week,
  start_time,
  end_time
)
values (
  '99800000-0000-0000-0000-000000000002',
  date_trunc('week', current_timestamp at time zone 'Asia/Jakarta')::date,
  1,
  '09:00',
  '10:00'
);

insert into test_operational_realtime.revision_baselines(name, revision)
select 'mentor-delete-mentee-availability', revision
from public.operational_invalidation_versions
where recipient_role = 'mentee'
  and recipient_user_id is null
  and domain = 'availability'
on conflict (name) do update set revision = excluded.revision;

insert into test_operational_realtime.revision_baselines(name, revision)
select 'mentor-delete-admin-availability', revision
from public.operational_invalidation_versions
where recipient_role = 'admin'
  and recipient_user_id is null
  and domain = 'availability'
on conflict (name) do update set revision = excluded.revision;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '99800000-0000-0000-0000-000000000001',
  true
);
select public.delete_mentor_account('99800000-0000-0000-0000-000000000002');
reset role;

select test_operational_realtime.assert(
  not exists (
    select 1 from public.profiles
    where id = '99800000-0000-0000-0000-000000000002'
  ),
  'mentor account deletion completes even when availability rows cascade'
);

select test_operational_realtime.assert(
  (
    select revision
    from public.operational_invalidation_versions
    where recipient_role = 'mentee'
      and recipient_user_id is null
      and domain = 'availability'
  ) = (
    select revision + 1
    from test_operational_realtime.revision_baselines
    where name = 'mentor-delete-mentee-availability'
  ),
  'mentor deletion still invalidates Mentee role-wide availability'
);

select test_operational_realtime.assert(
  (
    select revision
    from public.operational_invalidation_versions
    where recipient_role = 'admin'
      and recipient_user_id is null
      and domain = 'availability'
  ) = (
    select revision + 1
    from test_operational_realtime.revision_baselines
    where name = 'mentor-delete-admin-availability'
  ),
  'mentor deletion still invalidates Admin role-wide availability'
);

select test_operational_realtime.assert(
  not exists (
    select 1
    from public.operational_invalidation_versions
    where recipient_role = 'mentor'
      and recipient_user_id = '99800000-0000-0000-0000-000000000002'
  ),
  'deleted mentor has no orphan user-scoped invalidation rows'
);

rollback;

select 'PASS: operational invalidation bounded revisions, grants, and RLS isolation' as result;
