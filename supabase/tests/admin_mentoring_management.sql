-- Disposable database only. Admin mentoring enrollment/invitation projections are rolled back.
begin;

create schema test_admin_mentoring_management;
grant usage on schema test_admin_mentoring_management to anon, authenticated, service_role;

create function test_admin_mentoring_management.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;

create function test_admin_mentoring_management.denied(command text, message text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when insufficient_privilege or raise_exception then return;
  end;
  raise exception 'UNEXPECTEDLY ALLOWED: %', message;
end;
$$;

grant execute on all functions in schema test_admin_mentoring_management to anon, authenticated, service_role;

insert into auth.users(id, email, encrypted_password) values
  ('98000000-0000-0000-0000-000000000001', 'ops-admin@test.invalid', 'hash'),
  ('98000000-0000-0000-0000-000000000002', 'ops-mentee@test.invalid', 'hash'),
  ('98000000-0000-0000-0000-000000000003', 'ops-mentor@test.invalid', 'hash');

update public.profiles set role='admin' where id='98000000-0000-0000-0000-000000000001';
update public.profiles set first_name='Qiqi', last_name='Tester', username='qiqi_ops' where id='98000000-0000-0000-0000-000000000002';
update public.profiles set role='mentor', first_name='Mentor', last_name='Ops', username='mentor_ops', mentor_setup_completed_at=now() where id='98000000-0000-0000-0000-000000000003';
delete from public.mentee_profiles where user_id='98000000-0000-0000-0000-000000000003';
update public.mentor_profiles set tier_id='81000000-0000-0000-0000-000000000001', is_active=true where user_id='98000000-0000-0000-0000-000000000003';

insert into public.carts(id, user_id, status) values ('98100000-0000-0000-0000-000000000001','98000000-0000-0000-0000-000000000002','converted');
insert into public.orders(id, user_id, cart_id, status, total_amount, paid_at, created_at) values
  ('98200000-0000-0000-0000-000000000001','98000000-0000-0000-0000-000000000002','98100000-0000-0000-0000-000000000001','paid',885000,'2026-09-10 09:00+07','2026-09-10 08:58+07');
insert into public.order_items(id, order_id, commerce_item_id, item_kind_snapshot, name_snapshot, slug_snapshot, unit_price_amount) values
  ('98300000-0000-0000-0000-000000000001','98200000-0000-0000-0000-000000000001','97300000-0000-0000-0000-000000000002','private_mentoring','Private Mentoring - Top Student - 3 Sessions','private-mentoring-top-student-3-sessions',885000);
insert into public.private_mentoring_enrollments(id, mentee_id, order_item_id, package_id, purchased_sessions, created_at) values
  ('98400000-0000-0000-0000-000000000001','98000000-0000-0000-0000-000000000002','98300000-0000-0000-0000-000000000001','97300000-0000-0000-0000-000000000002',3,'2026-09-10 09:00+07');
insert into public.private_mentoring_sessions(id, enrollment_id, session_number, status, session_focus_id, mentor_id, scheduled_start_at, scheduled_end_at) values
  ('98500000-0000-0000-0000-000000000001','98400000-0000-0000-0000-000000000001',1,'awaiting_focus',null,null,null,null),
  ('98500000-0000-0000-0000-000000000002','98400000-0000-0000-0000-000000000001',2,'awaiting_scheduling','97200000-0000-0000-0000-000000000001',null,null,null),
  ('98500000-0000-0000-0000-000000000003','98400000-0000-0000-0000-000000000001',3,'scheduled','97200000-0000-0000-0000-000000000003','98000000-0000-0000-0000-000000000003','2026-09-20 10:00+07','2026-09-20 11:15+07');

set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-0000-0000-000000000002',true);
select test_admin_mentoring_management.denied($q$select * from public.list_admin_private_mentoring_enrollments_page()$q$,'mentee cannot list admin enrollment projection');
select test_admin_mentoring_management.denied($q$select * from public.get_admin_private_mentoring_enrollment_sessions('98400000-0000-0000-0000-000000000001')$q$,'mentee cannot list admin session detail');
select test_admin_mentoring_management.denied($q$select * from public.list_admin_mentor_invites_page()$q$,'mentee cannot list admin invitations');

select set_config('request.jwt.claim.sub','98000000-0000-0000-0000-000000000001',true);
select test_admin_mentoring_management.assert(
  (select count(*)=1 and max(total_count)=1 from public.list_admin_private_mentoring_enrollments_page()),
  'three sessions are projected as one enrollment row'
);
select test_admin_mentoring_management.assert(
  (select mentee_username='qiqi_ops' and purchased_sessions=3 and awaiting_focus_sessions=1 and awaiting_scheduling_sessions=1 and configured_sessions=1
   from public.list_admin_private_mentoring_enrollments_page(p_query=>'qiqi_ops')),
  'enrollment row exposes username and aggregate progress'
);
select test_admin_mentoring_management.assert(
  (select count(*)=1 from public.list_admin_private_mentoring_enrollments_page(p_package_id=>'97300000-0000-0000-0000-000000000002',p_tier_id=>'81000000-0000-0000-0000-000000000001',p_progress=>'needs_focus',p_from=>'2026-09-10',p_to=>'2026-09-10')),
  'package, tier, progress, and purchase date filters work together'
);
select test_admin_mentoring_management.assert(
  (select count(*)=3 from public.get_admin_private_mentoring_enrollment_sessions('98400000-0000-0000-0000-000000000001')),
  'modal detail projection returns every session for one enrollment'
);

insert into public.mentor_invites(email, invited_by, status, tier_id, created_at) values
  ('filter-failed@mentor.test','98000000-0000-0000-0000-000000000001','failed','81000000-0000-0000-0000-000000000001','2026-09-11 10:00+07'),
  ('filter-pending@mentor.test','98000000-0000-0000-0000-000000000001','pending','81000000-0000-0000-0000-000000000002','2026-09-12 10:00+07');
select test_admin_mentoring_management.assert(
  (select count(*)=1 and max(total_count)=1 from public.list_admin_mentor_invites_page(p_query=>'failed@mentor',p_status=>'failed',p_tier_id=>'81000000-0000-0000-0000-000000000001',p_from=>'2026-09-11',p_to=>'2026-09-11')),
  'invitation filters and total count are server-side'
);
select test_admin_mentoring_management.assert(
  (select can_delete from public.list_admin_mentor_invites_page(p_query=>'filter-failed')),
  'failed invitation remains deletable in paginated projection'
);

rollback;
