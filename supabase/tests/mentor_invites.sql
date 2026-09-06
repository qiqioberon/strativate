-- Disposable database only. All fixtures and deletes are rolled back.
begin;
create schema test_invites;
grant usage on schema test_invites to anon, authenticated;
create function test_invites.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if;
end $$;
create function test_invites.denied(command text, expected_state text) returns void language plpgsql as $$
begin
  begin
    execute command;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise;
  end;
  raise exception 'Unexpectedly allowed: %', command;
end $$;
grant execute on all functions in schema test_invites to anon, authenticated;

select test_invites.assert(to_regprocedure('public.delete_mentor_invite(text)') is not null, 'invitation deletion RPC exists');
insert into auth.users(id, email) values
  ('50000000-0000-0000-0000-000000000001', 'admin@invite.test'),
  ('50000000-0000-0000-0000-000000000002', 'mentee@invite.test');
update public.profiles set role = 'admin' where id = '50000000-0000-0000-0000-000000000001';
insert into public.mentor_invites(email, invited_by, status) values
  ('failed@invite.test', '50000000-0000-0000-0000-000000000001', 'failed'),
  ('waiting@invite.test', '50000000-0000-0000-0000-000000000001', 'pending'),
  ('active@invite.test', '50000000-0000-0000-0000-000000000001', 'pending'),
  ('processing@invite.test', '50000000-0000-0000-0000-000000000001', 'pending');
insert into auth.users(id, email, invited_at) values
  ('50000000-0000-0000-0000-000000000003', 'waiting@invite.test', now()),
  ('50000000-0000-0000-0000-000000000004', 'active@invite.test', now());
update public.mentor_invites set status = 'sent' where user_id is not null;
update auth.users set email_confirmed_at = now() where email = 'active@invite.test';

set local role anon;
select test_invites.denied($q$select * from public.list_mentor_invites(0)$q$, '42501');
select test_invites.denied($q$select public.delete_mentor_invite('failed@invite.test')$q$, '42501');
set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);
select test_invites.denied($q$select * from public.list_mentor_invites(0)$q$, '42501');
select test_invites.denied($q$select public.delete_mentor_invite('failed@invite.test')$q$, '42501');
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000003', true);
select test_invites.denied($q$select public.delete_mentor_invite('waiting@invite.test')$q$, '42501');
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);
select test_invites.assert((select count(*) = 4 from public.list_mentor_invites(0)), 'admin sees failed and sent invitations');
select test_invites.assert((select can_delete from public.list_mentor_invites(0) where email = 'waiting@invite.test'), 'unaccepted invite deletable');
select test_invites.assert((select not can_delete from public.list_mentor_invites(0) where email = 'active@invite.test'), 'accepted invite protected in list');
select test_invites.denied($q$select public.delete_mentor_invite('active@invite.test')$q$, '22023');
select test_invites.denied($q$select public.delete_mentor_invite('processing@invite.test')$q$, '22023');
select test_invites.denied($q$select public.delete_mentor_invite('missing@invite.test')$q$, '22023');
select public.delete_mentor_invite(' FAILED@invite.test ');
select public.delete_mentor_invite('waiting@invite.test');
reset role;
select test_invites.assert(not exists(select 1 from public.mentor_invites where email in ('failed@invite.test', 'waiting@invite.test')), 'only selected invites removed');
select test_invites.assert(not exists(select 1 from auth.users where email = 'waiting@invite.test'), 'unused Auth account removed');
select test_invites.assert(not exists(select 1 from public.profiles where id = '50000000-0000-0000-0000-000000000003'), 'unused profile removed');
select test_invites.assert(exists(select 1 from auth.users where email = 'active@invite.test'), 'active Auth account preserved');
select test_invites.assert(exists(select 1 from public.profiles where id = '50000000-0000-0000-0000-000000000002'), 'unrelated account preserved');

-- The same email can be invited again and gets a fresh mentor profile.
insert into public.mentor_invites(email, invited_by) values ('waiting@invite.test', '50000000-0000-0000-0000-000000000001');
insert into auth.users(id, email, invited_at) values ('50000000-0000-0000-0000-000000000005', 'waiting@invite.test', now());
select test_invites.assert((select role = 'mentor' from public.profiles where id = '50000000-0000-0000-0000-000000000005'), 'reinvitation keeps trusted mentor assignment');
update public.mentor_invites set status = 'sent' where email = 'waiting@invite.test';

-- A stale UI must not delete an account that was activated after the list loaded.
update auth.users set last_sign_in_at = now() where email = 'waiting@invite.test';
set local role authenticated;
select test_invites.denied($q$select public.delete_mentor_invite('waiting@invite.test')$q$, '22023');
reset role;
update auth.users set last_sign_in_at = null where email = 'waiting@invite.test';
update public.profiles set mentor_setup_completed_at = now() where id = '50000000-0000-0000-0000-000000000005';
set local role authenticated;
select test_invites.denied($q$select public.delete_mentor_invite('waiting@invite.test')$q$, '22023');
reset role;

-- A failed account deletion must roll back the registry deletion too.
update public.profiles set mentor_setup_completed_at = null where id = '50000000-0000-0000-0000-000000000005';
create table test_invites.referenced_account(user_id uuid references auth.users);
insert into test_invites.referenced_account values ('50000000-0000-0000-0000-000000000005');
set local role authenticated;
select test_invites.denied($q$select public.delete_mentor_invite('waiting@invite.test')$q$, '23503');
reset role;
select test_invites.assert(exists(select 1 from public.mentor_invites where email = 'waiting@invite.test'), 'failed deletion preserves registry');
select test_invites.assert(exists(select 1 from auth.users where email = 'waiting@invite.test'), 'failed deletion preserves account');
rollback;
