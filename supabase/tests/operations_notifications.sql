-- Disposable database only. Notification role isolation and read-state regression coverage.
begin;

create schema test_notifications;
create function test_notifications.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;
create function test_notifications.denied(command text, message text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when insufficient_privilege or check_violation or unique_violation or foreign_key_violation or invalid_parameter_value or raise_exception then return;
  end;
  raise exception 'UNEXPECTEDLY ALLOWED: %', message;
end;
$$;
grant usage on schema test_notifications to authenticated, service_role;
grant execute on all functions in schema test_notifications to authenticated, service_role;

select test_notifications.assert(to_regclass('public.notifications') is not null,'notifications table exists');
select test_notifications.assert(to_regprocedure('public.mark_notification_read(uuid)') is not null,'mark-read RPC exists');
select test_notifications.assert(to_regprocedure('public.mark_all_notifications_read()') is not null,'mark-all-read RPC exists');

insert into auth.users(id,email,encrypted_password) values
 ('99700000-0000-0000-0000-000000000001','notification-admin@test.invalid','hash'),
 ('99700000-0000-0000-0000-000000000002','notification-a@test.invalid','hash'),
 ('99700000-0000-0000-0000-000000000003','notification-b@test.invalid','hash'),
 ('99700000-0000-0000-0000-000000000004','notification-mentor@test.invalid','hash');
update public.profiles set role='admin' where id='99700000-0000-0000-0000-000000000001';
update public.profiles set role='mentor',mentor_setup_completed_at=now() where id='99700000-0000-0000-0000-000000000004';
delete from public.mentee_profiles where user_id='99700000-0000-0000-0000-000000000004';

set local role service_role;
insert into public.notifications(recipient_user_id,recipient_role,type,title,message,idempotency_key) values
 ('99700000-0000-0000-0000-000000000002','mentee','test','Mentee A','Only A','test:a'),
 ('99700000-0000-0000-0000-000000000003','mentee','test','Mentee B','Only B','test:b'),
 ('99700000-0000-0000-0000-000000000004','mentor','test','Mentor','Only mentor','test:mentor'),
 (null,'admin','test','Admin','All admins','test:admin');
select test_notifications.denied($q$insert into public.notifications(recipient_user_id,recipient_role,type,title,message,idempotency_key)
 values('99700000-0000-0000-0000-000000000002','mentee','test','Duplicate','Duplicate','test:a')$q$,'notification idempotency key is unique per recipient');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','99700000-0000-0000-0000-000000000002',true);
select test_notifications.assert((select count(*)=1 from public.notifications),'mentee A reads only own notification');
select public.mark_notification_read((select id from public.notifications limit 1));
select test_notifications.assert((select bool_and(read_at is not null) from public.notifications),'mentee can mark own notification read');
select test_notifications.denied($q$insert into public.notifications(recipient_user_id,recipient_role,type,title,message,idempotency_key)
 values('99700000-0000-0000-0000-000000000003','mentee','forged','Forged','No','forged')$q$,'authenticated client cannot inject notification for another user');

select set_config('request.jwt.claim.sub','99700000-0000-0000-0000-000000000003',true);
select test_notifications.assert((select count(*)=1 and bool_and(title='Mentee B') from public.notifications),'mentee B cannot see mentee A');

select set_config('request.jwt.claim.sub','99700000-0000-0000-0000-000000000004',true);
select test_notifications.assert((select count(*)=1 and bool_and(title='Mentor') from public.notifications),'mentor reads only own notification');

select set_config('request.jwt.claim.sub','99700000-0000-0000-0000-000000000001',true);
select test_notifications.assert((select count(*)=1 and bool_and(title='Admin') from public.notifications),'admin reads role-wide admin notification');
select public.mark_all_notifications_read();
select test_notifications.assert((select bool_and(read_at is not null) from public.notifications),'admin can mark role notification read');
reset role;

rollback;
select 'PASS: notification RLS, dedupe, and read state' as result;
