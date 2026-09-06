-- Execute as postgres after migration. All fixtures roll back.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/auth_security.sql
begin;
create schema test_security;
grant usage on schema test_security to anon, authenticated;
create function test_security.assert(p_condition boolean, p_message text) returns void language plpgsql as $$
begin
  if p_condition is distinct from true then raise exception 'ASSERTION FAILED: %', p_message; end if;
end $$;
create function test_security.denied(p_sql text, p_message text) returns void language plpgsql as $$
declare rejected boolean := false;
begin
  begin execute p_sql;
  exception when insufficient_privilege or invalid_parameter_value or check_violation or unique_violation or invalid_text_representation or not_null_violation then rejected := true;
  end;
  if not rejected then raise exception 'ATTACK ACCEPTED: %', p_message; end if;
end $$;
grant execute on all functions in schema test_security to anon, authenticated;

insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'admin@test.invalid', 'test-hash', '{}'),
  ('10000000-0000-0000-0000-000000000002', 'alice@test.invalid', 'gotrue-generated-temporary-hash', '{"role":"admin","registration_method":"google","password_set":true}'),
  ('10000000-0000-0000-0000-000000000003', 'bob@test.invalid', 'test-hash', '{"role":"mentor"}');
update public.profiles set role = 'admin' where id = '10000000-0000-0000-0000-000000000001';
update auth.users set email_confirmed_at = now() where id = '10000000-0000-0000-0000-000000000003';
update auth.users set encrypted_password = 'bob-chosen-password-hash' where id = '10000000-0000-0000-0000-000000000003';
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000004', 'google@test.invalid', '{"provider":"google"}', '{"given_name":"Google","family_name":"User","role":"admin"}');
select test_security.assert((select role = 'mentee' and registration_method = 'email' from public.profiles where id = '10000000-0000-0000-0000-000000000002'), 'user metadata cannot assign role or provider');
select test_security.assert((select role = 'mentee' from public.profiles where id = '10000000-0000-0000-0000-000000000003'), 'public mentor request defaults to mentee');

insert into public.institutions (id, name, type, source, external_id) values
  ('20000000-0000-0000-0000-000000000001', 'Official University', 'university', 'official', 'one'),
  ('20000000-0000-0000-0000-000000000002', 'Official University', 'university', 'official', 'two');
insert into public.referral_sources (id, name, is_active) values
  ('30000000-0000-0000-0000-000000000001', 'Active test referral', true),
  ('30000000-0000-0000-0000-000000000002', 'Inactive test referral', false);
insert into public.interests (id, name, is_active) values
  ('40000000-0000-0000-0000-000000000001', 'Active test interest A', true),
  ('40000000-0000-0000-0000-000000000002', 'Active test interest B', true),
  ('40000000-0000-0000-0000-000000000003', 'Inactive test interest', false);

set local role anon;
select test_security.denied('select * from public.profiles', 'anonymous profiles');
select test_security.denied('select * from public.institutions', 'anonymous institutions');
select test_security.denied($q$select public.save_onboarding_step(1, '{}')$q$, 'anonymous RPC');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select test_security.assert((select count(*) = 1 from public.profiles), 'own profile visibility');
select test_security.assert((select count(*) = 1 from public.mentee_profiles), 'own onboarding visibility');
select test_security.denied($q$update public.profiles set role = 'admin'$q$, 'role escalation admin');
select test_security.denied($q$update public.profiles set role = 'mentor'$q$, 'role escalation mentor');
select test_security.denied($q$update public.profiles set registration_method = 'google'$q$, 'password bypass via registration method');
select test_security.denied($q$update public.profiles set mentor_setup_completed_at = now()$q$, 'mentor completion overwrite');
select test_security.denied($q$update public.profiles set password_set_at = now()$q$, 'password timestamp cannot be forged');
select test_security.denied($q$insert into public.profiles (id, role, registration_method) values (auth.uid(), 'admin', 'google')$q$, 'profile insert escalation');
select test_security.denied($q$update public.mentee_profiles set onboarding_completed_at = now()$q$, 'fake completion');
select test_security.denied($q$update public.mentee_profiles set onboarding_step = 4 where user_id = '10000000-0000-0000-0000-000000000003'$q$, 'cross-user onboarding');
select test_security.denied($q$insert into public.mentee_interests (user_id, interest_id) values ('10000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001')$q$, 'cross-user interests');
select test_security.denied($q$insert into public.mentor_invites (email, invited_by) values ('attacker@test.invalid', auth.uid())$q$, 'client invitation registry');
select test_security.denied($q$select * from public.mentor_invites$q$, 'client invitation registry visibility');
select test_security.denied($q$insert into public.institutions (name, type, source, approval_status) values ('Fake University', 'university', 'official', 'approved')$q$, 'institution privilege injection');
select test_security.denied($q$insert into public.institutions (name, type, source, approval_status, submitted_by) values ('Fake University', 'university', 'user_submission', 'pending', '10000000-0000-0000-0000-000000000003')$q$, 'institution ownership injection');
with attacked as (update public.institutions set approval_status = 'archived' returning *) select test_security.assert((select count(*) = 0 from attacked), 'official institutions cannot be edited');
with attacked as (update public.referral_sources set name = 'hacked' returning *) select test_security.assert((select count(*) = 0 from attacked), 'master referral cannot be edited');
with attacked as (update public.interests set is_active = false returning *) select test_security.assert((select count(*) = 0 from attacked), 'master interests cannot be edited');
select test_security.denied($q$insert into public.interests (name) values ('hacked')$q$, 'master interest insert');
select test_security.denied($q$insert into public.referral_sources (name) values ('hacked')$q$, 'master referral insert');
select test_security.assert((select count(*) = 0 from public.referral_sources where not is_active), 'inactive referral hidden');
select test_security.assert((select count(*) = 0 from public.interests where not is_active), 'inactive interest hidden');
update public.profiles set first_name = 'Alice', avatar_url = 'https://example.invalid/avatar.png' where id = auth.uid();
select test_security.assert((select first_name = 'Alice' from public.profiles), 'permitted profile updates');
select test_security.denied($q$select public.save_onboarding_step(2, '{"institution_id":"20000000-0000-0000-0000-000000000001"}')$q$, 'step 2 cannot skip step 1');
select test_security.denied($q$select public.save_onboarding_step(4, '{"interest_ids":["40000000-0000-0000-0000-000000000001"]}')$q$, 'step 4 cannot skip');
select test_security.denied($q$select public.save_onboarding_step(1, '{"first_name":"Alice","username":"alice","password_set":true}')$q$, 'fake password flag rejected');
select test_security.denied($q$select public.save_onboarding_step(1, '{"first_name":"Alice","username":"alice"}')$q$, 'real email password required');
select test_security.denied($q$select public.save_onboarding_step(1, '{"first_name":"Alice","username":"alice","user_id":"10000000-0000-0000-0000-000000000003"}')$q$, 'RPC ownership injection');
reset role;
update auth.users set encrypted_password = 'gotrue-resend-generated-hash' where id = '10000000-0000-0000-0000-000000000002';
select test_security.assert((select password_set_at is null from public.profiles where id = '10000000-0000-0000-0000-000000000002'), 'resending signup temporary password does not satisfy setup');
update auth.users set email_confirmed_at = now() where id = '10000000-0000-0000-0000-000000000002';
set local role authenticated;
select test_security.denied($q$select public.save_onboarding_step(1, '{"first_name":"Alice","username":"alice"}')$q$, 'verified magic-link temporary hash is not a user-set password');
reset role;
update auth.users set encrypted_password = 'test-password-hash' where id = '10000000-0000-0000-0000-000000000002';
set local role authenticated;
select test_security.assert((select password_set_at is not null from public.profiles), 'real Auth password update recorded');
select public.save_onboarding_step(1, '{"first_name":"Alice","last_name":"Test","username":"Alice"}');
select test_security.assert((select onboarding_step = 2 from public.mentee_profiles), 'step 1 persisted');
select public.submit_institution('  My   School  ', 'sma');
select public.submit_institution('My School', 'sma');
select test_security.assert((select count(*) = 1 from public.institutions where normalized_name = 'my school'), 'repeated personal submission idempotent');
select test_security.assert((select approval_status = 'pending' and source = 'user_submission' and submitted_by = auth.uid() from public.institutions where normalized_name = 'my school'), 'submission controlled fields');
with attacked as (update public.institutions set approval_status = 'approved' where normalized_name = 'my school' returning *) select test_security.assert((select count(*) = 0 from attacked), 'own pending cannot approve');
select test_security.assert((select count(*) = 0 from public.search_institutions('M')), 'minimum search length');
select test_security.assert((select count(*) = 1 from public.search_institutions('my')), 'own pending searchable');
select test_security.denied($q$select public.submit_institution('Official University', 'university')$q$, 'exact official match asks explicit selection');
select test_security.denied($q$select public.submit_institution('Official University', 'university', false)$q$, 'duplicate needs explicit acknowledgement');
select test_security.denied($q$select public.submit_institution('Official University', 'university', null)$q$, 'null is not duplicate acknowledgement');
select public.submit_institution('Official University', 'university', true);
select public.submit_institution('Official University', 'university', true);
select test_security.assert((select count(*) = 1 from public.institutions where name = 'Official University' and approval_status = 'pending' and source = 'user_submission' and submitted_by = auth.uid()), 'acknowledged duplicate is separate pending record and personal retries are idempotent');
select test_security.assert((select count(*) = 2 from public.institutions where name = 'Official University' and approval_status = 'approved' and source = 'official'), 'same-name official institutions remain separate and unchanged');
select test_security.assert(public.normalize_institution_name(U&'\00A0Campus\00A0\00A0Name\00A0') = 'campus name', 'NBSP whitespace matches JavaScript');
select test_security.assert(public.normalize_institution_name(U&'\FEFFCampus\202F\3000Name\FEFF') = 'campus name', 'BOM and Unicode whitespace match JavaScript');
select test_security.assert(public.normalize_institution_name(U&'Cafe\0301') = public.normalize_institution_name(U&'Caf\00E9'), 'composed and decomposed Unicode share NFC search keys');
select test_security.assert(public.normalize_institution_name(U&'CAF\00C9') = U&'caf\00E9', 'Unicode lowercasing is independent of database locale');
select public.submit_institution(U&'\00A0Cafe\0301\00A0\00A0School\00A0', 'sma');
select test_security.assert((select name = U&'Cafe\0301 School' and normalized_name = U&'caf\00E9 school' from public.institutions where normalized_name = U&'caf\00E9 school'), 'display composition preserved while search key is NFC');
select test_security.assert((select count(*) = 1 from public.search_institutions(U&'\00A0CAF\00C9\00A0')), 'Unicode normalized search finds preserved display name');
select public.save_onboarding_step(2, jsonb_build_object('institution_id', (select id from public.institutions where normalized_name = 'my school'), 'major_or_faculty', 'Science', 'cohort_year', 2026));
select test_security.assert((select onboarding_step = 3 and major_or_faculty = 'Science' from public.mentee_profiles), 'step 2 persisted');
select test_security.denied($q$select public.save_onboarding_step(3, '{"referral_source_id":"30000000-0000-0000-0000-000000000002"}')$q$, 'inactive referral rejected');
select test_security.denied($q$select public.save_onboarding_step(3, '{"referral_source_id":"30000000-0000-0000-0000-000000000001","referral_other_text":"Both"}')$q$, 'exactly one referral');
select public.save_onboarding_step(3, '{"referral_other_text":"Community event"}');
select test_security.assert((select onboarding_step = 4 and referral_other_text = 'Community event' from public.mentee_profiles), 'step 3 persisted');
select test_security.denied($q$select public.save_onboarding_step(4, '{"interest_ids":["40000000-0000-0000-0000-000000000003"]}')$q$, 'inactive interest rejected');
select test_security.assert((select onboarding_completed_at is null from public.mentee_profiles), 'failed final save does not complete');
select test_security.denied($q$select public.save_onboarding_step(4, '{"interest_ids":[]}')$q$, 'empty final selection');
-- Changes by moderators between wizard steps must be revalidated at completion.
reset role;
update public.institutions set approval_status = 'rejected' where normalized_name = 'my school';
set local role authenticated;
select test_security.denied($q$select public.save_onboarding_step(4, '{"interest_ids":["40000000-0000-0000-0000-000000000001"]}')$q$, 'reject institution archived after step 2');
reset role;
update public.institutions set approval_status = 'pending' where normalized_name = 'my school';
set local role authenticated;
select public.save_onboarding_step(3, '{"referral_source_id":"30000000-0000-0000-0000-000000000001"}');
reset role;
update public.referral_sources set is_active = false where id = '30000000-0000-0000-0000-000000000001';
set local role authenticated;
select test_security.denied($q$select public.save_onboarding_step(4, '{"interest_ids":["40000000-0000-0000-0000-000000000001"]}')$q$, 'reject referral archived after step 3');
reset role;
update public.referral_sources set is_active = true where id = '30000000-0000-0000-0000-000000000001';
set local role authenticated;
select public.save_onboarding_step(3, '{"referral_other_text":"Community event"}');
select public.save_onboarding_step(4, '{"interest_ids":["40000000-0000-0000-0000-000000000001","40000000-0000-0000-0000-000000000002"]}');
select test_security.denied($q$select public.save_onboarding_step(4, '{"interest_ids":[],"other_interest_text":"Robotics"}')$q$, 'custom-only interest rejected');
select test_security.denied($q$select public.save_onboarding_step(4, '{"interest_ids":[]}')$q$, 'empty interests rejected');
select test_security.assert((select onboarding_completed_at is not null and other_interest_text is null from public.mentee_profiles), 'completion persisted');
select test_security.assert((select count(*) = 2 from public.mentee_interests), 'multiple interests persisted');
select test_security.denied($q$select public.save_onboarding_step(4, jsonb_build_object('interest_ids', jsonb_build_array('40000000-0000-0000-0000-000000000001'), 'other_interest_text', 'Robotics'))$q$, 'custom text rejected even with a valid master selection');
select test_security.assert((select count(*) = 2 from public.mentee_interests), 'failed replacement rolls back deleted interests');
select public.save_onboarding_step(1, '{"first_name":"Alice","username":"Alice"}');
select test_security.assert((select onboarding_step = 4 and onboarding_completed_at is not null from public.mentee_profiles), 'earlier edits never regress progress');
select test_security.denied($q$select public.complete_mentor_setup('Alice', '', 'alice')$q$, 'mentee cannot use mentor setup');
select test_security.denied($q$select public.merge_institutions('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002')$q$, 'merge requires admin');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select test_security.assert((select count(*) = 0 from public.search_institutions('my')), 'other mentee pending hidden');
select test_security.assert((select count(*) = 0 from public.mentee_interests), 'other mentee interests hidden');
select test_security.denied($q$select public.save_onboarding_step(1, '{"first_name":"Bob","username":"aLICE"}')$q$, 'case insensitive username uniqueness');
select public.save_onboarding_step(1, '{"first_name":"Bob","username":"bob"}');
reset role;
-- Pending ownership is tested with the actual hidden ID, as a crafted REST request would use.
select set_config('test.hidden_institution', (select id::text from public.institutions where normalized_name = 'my school'), true);
set local role authenticated;
select test_security.denied(format('select public.save_onboarding_step(2, %L::jsonb)', jsonb_build_object('institution_id', current_setting('test.hidden_institution'))), 'cannot use another mentee pending institution');
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select public.save_onboarding_step(1, '{"first_name":"Google","username":"google_user"}');
select test_security.assert((select onboarding_step = 2 from public.mentee_profiles), 'Google onboarding needs no password');
reset role;

-- The registry is trusted server-only, and only an actual Auth invitation consumes it.
insert into public.mentor_invites (email, invited_by) values
  ('mentor@test.invalid', '10000000-0000-0000-0000-000000000001'),
  ('race@test.invalid', '10000000-0000-0000-0000-000000000001'),
  ('bob@test.invalid', '10000000-0000-0000-0000-000000000001');
insert into public.mentor_invites (email, invited_by, status) values
  ('failed@test.invalid', '10000000-0000-0000-0000-000000000001', 'failed');
-- Match the real GoTrue /invite transaction: INSERT, then trusted UPDATE.
insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000005', 'mentor@test.invalid'),
  ('10000000-0000-0000-0000-000000000006', 'failed@test.invalid');
select test_security.assert((select role = 'mentee' from public.profiles where id = '10000000-0000-0000-0000-000000000005'), 'insert alone never consumes registry');
update auth.users set invited_at = now() where id in ('10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000006');
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000007', 'race@test.invalid', '{"role":"mentor","invited_at":"2026-09-06"}');
update auth.users set invited_at = now() where id = '10000000-0000-0000-0000-000000000003';
select test_security.assert((select role = 'mentor' and registration_method = 'invitation' from public.profiles where id = '10000000-0000-0000-0000-000000000005'), 'trusted invite creates mentor atomically');
select test_security.assert((select user_id = '10000000-0000-0000-0000-000000000005' from public.mentor_invites where email = 'mentor@test.invalid'), 'registry consumed');
select test_security.assert((select role = 'mentee' from public.profiles where id = '10000000-0000-0000-0000-000000000006'), 'failed registry never assigns mentor');
select test_security.assert((select role = 'mentee' from public.profiles where id = '10000000-0000-0000-0000-000000000007'), 'ordinary signup cannot consume pending registry');
select test_security.assert((select role = 'mentee' from public.profiles where id = '10000000-0000-0000-0000-000000000003'), 'existing public account is never promoted');
select test_security.assert((select count(*) = 0 from public.mentee_profiles where user_id = '10000000-0000-0000-0000-000000000005'), 'mentor transition removes provisional mentee row');
-- Admin Auth supports inviting an existing unconfirmed email. Only the trusted
-- invited_at transition grants the role, never a signup or a metadata update.
update auth.users set invited_at = now() where id = '10000000-0000-0000-0000-000000000007';
select test_security.assert((select role = 'mentor' from public.profiles where id = '10000000-0000-0000-0000-000000000007'), 'admin invitation may transition an unconfirmed email');
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
select test_security.denied($q$select public.complete_mentor_setup('Mentor', 'Test', 'mentor_test')$q$, 'mentor password required');
select test_security.denied($q$select public.save_onboarding_step(1, '{"first_name":"Mentor","username":"mentor_test"}')$q$, 'mentor cannot perform mentee onboarding');
reset role;
update auth.users set email_confirmed_at = now() where id = '10000000-0000-0000-0000-000000000005';
update auth.users set encrypted_password = 'test-password-hash' where id = '10000000-0000-0000-0000-000000000005';
set local role authenticated;
select public.complete_mentor_setup('Mentor', 'Test', 'mentor_test');
select test_security.assert((select mentor_setup_completed_at is not null from public.profiles), 'mentor setup persisted');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select test_security.assert((select count(*) = 7 from public.profiles), 'admin profile visibility');
select test_security.assert((select count(*) = 1 from public.referral_sources where not is_active), 'admin inactive visibility');
insert into public.referral_sources (name, sort_order) values ('Admin referral', 99);
update public.referral_sources set name = 'Renamed referral', is_active = false where name = 'Admin referral';
select test_security.assert((select count(*) = 1 from public.referral_sources where name = 'Renamed referral' and not is_active), 'admin referral management');
insert into public.interests (name, sort_order) values ('Admin interest', 99);
update public.interests set is_active = false where name = 'Admin interest';
select test_security.assert((select count(*) = 1 from public.interests where name = 'Admin interest' and not is_active), 'admin interest management');
insert into public.institutions (name, type, source, approval_status) values ('Admin School', 'smk', 'admin_manual', 'approved');
update public.institutions set approval_status = 'approved' where normalized_name = 'my school';
select test_security.assert((select approval_status = 'approved' from public.institutions where normalized_name = 'my school'), 'admin approval works');
select public.merge_institutions((select id from public.institutions where normalized_name = 'my school'), '20000000-0000-0000-0000-000000000001');
select test_security.assert((select institution_id = '20000000-0000-0000-0000-000000000001' from public.mentee_profiles where user_id = '10000000-0000-0000-0000-000000000002'), 'explicit merge repoints references');
select test_security.assert((select approval_status = 'archived' from public.institutions where normalized_name = 'my school'), 'merge archives original');
select test_security.assert((select count(*) = 0 from public.referral_sources where name = 'Community event'), 'custom referral never creates master');
select test_security.assert((select count(*) = 0 from public.interests where name = 'Robotics'), 'custom interest never creates master');
reset role;
rollback;
select 'PASS: database authorization, onboarding, invitations, and administration' as result;
