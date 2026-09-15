-- Disposable database only. WhatsApp ownership and admin Mentee projection tests are rolled back.
begin;

create schema test_profile_contact;
grant usage on schema test_profile_contact to anon, authenticated, service_role;
create function test_profile_contact.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;
create function test_profile_contact.denied(command text, message text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when insufficient_privilege or raise_exception then return;
  end;
  raise exception 'UNEXPECTEDLY ALLOWED: %', message;
end;
$$;
grant execute on all functions in schema test_profile_contact to anon, authenticated, service_role;

insert into auth.users(id, email, encrypted_password) values
  ('99000000-0000-0000-0000-000000000001', 'contact-admin@test.invalid', 'hash'),
  ('99000000-0000-0000-0000-000000000002', 'contact-mentee@test.invalid', 'hash');
update public.profiles set role='admin' where id='99000000-0000-0000-0000-000000000001';
update public.profiles set first_name='Aqil', last_name='Contact', username='aqil_contact' where id='99000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub','99000000-0000-0000-0000-000000000002',true);
update public.profiles set whatsapp_number='08123456789' where id='99000000-0000-0000-0000-000000000002';
select test_profile_contact.assert(
  (select whatsapp_number='+628123456789' from public.profiles where id='99000000-0000-0000-0000-000000000002'),
  'owner WhatsApp is normalized to E.164-like +628 form'
);
select test_profile_contact.denied($q$select * from public.list_admin_mentees_page()$q$, 'mentee cannot read admin Mentee projection');

select set_config('request.jwt.claim.sub','99000000-0000-0000-0000-000000000001',true);
select test_profile_contact.assert(
  (select count(*)=1 and max(email)='contact-mentee@test.invalid' and max(whatsapp_number)='+628123456789'
   from public.list_admin_mentees_page(p_query=>'aqil_contact')),
  'admin projection exposes Auth email plus normalized WhatsApp'
);
select test_profile_contact.assert(
  (select count(*)=1 from public.list_admin_mentees_page(p_sort_key=>'name', p_sort_direction=>'asc', p_limit=>1, p_offset=>0)),
  'admin Mentee projection accepts sortable pagination arguments'
);
update public.profiles set whatsapp_number='+628999999999' where id='99000000-0000-0000-0000-000000000002';
reset role;
select test_profile_contact.assert(
  (select whatsapp_number='+628123456789' from public.profiles where id='99000000-0000-0000-0000-000000000002'),
  'admin RLS does not permit editing another user profile'
);

rollback;
