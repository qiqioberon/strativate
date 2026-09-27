-- Execute as postgres after migrations. All fixtures roll back.
begin;
create schema test_who_we_are;
grant usage on schema test_who_we_are to anon, authenticated;

create function test_who_we_are.assert(p_condition boolean, p_message text) returns void language plpgsql as $$
begin
  if p_condition is distinct from true then raise exception 'ASSERTION FAILED: %', p_message; end if;
end $$;

create function test_who_we_are.denied(p_sql text, p_message text) returns void language plpgsql as $$
declare
  rejected boolean := false;
  affected bigint := 0;
begin
  begin
    execute p_sql;
    get diagnostics affected = row_count;
    rejected := affected = 0;
  exception when insufficient_privilege or check_violation or invalid_parameter_value or unique_violation then
    rejected := true;
  end;
  if not rejected then raise exception 'ATTACK ACCEPTED: %', p_message; end if;
end $$;
grant execute on all functions in schema test_who_we_are to anon, authenticated;

insert into auth.users (id, email, encrypted_password) values
  ('c2800000-0000-0000-0000-000000000001', 'who-admin@test.invalid', 'hash'),
  ('c2800000-0000-0000-0000-000000000002', 'who-mentee@test.invalid', 'hash');
update public.profiles set role = 'admin' where id = 'c2800000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2800000-0000-0000-0000-000000000001', true);
insert into public.homepage_who_we_are_photos (role, image_path, alt_text, badge_text)
values ('primary', 'who-we-are/primary/a2800000-0000-4000-8000-000000000001.webp', 'Students preparing a presentation', null);
insert into storage.objects (bucket_id, name, owner_id)
values ('marketing-editorial', 'who-we-are/primary/a2800000-0000-4000-8000-000000000001.webp', 'c2800000-0000-0000-0000-000000000001');
update public.homepage_who_we_are_photos
set badge_text = 'Competition preparation'
where role = 'primary';
select test_who_we_are.assert(
  (select badge_text = 'Competition preparation' from public.homepage_who_we_are_photos where role = 'primary'),
  'admin can edit metadata without replacing the image path'
);
select test_who_we_are.denied(
  $q$insert into public.homepage_who_we_are_photos (role, image_path, alt_text) values ('primary', 'who-we-are/primary/a2800000-0000-4000-8000-000000000002.webp', 'Duplicate role')$q$,
  'duplicate fixed role'
);
select test_who_we_are.denied(
  $q$insert into public.homepage_who_we_are_photos (role, image_path, alt_text) values ('upper_right', 'who-we-are/primary/a2800000-0000-4000-8000-000000000003.webp', 'Mismatched role')$q$,
  'role and path mismatch'
);
select test_who_we_are.denied(
  $q$insert into public.homepage_who_we_are_photos (role, image_path, alt_text) values ('upper_right', 'who-we-are/upper_right/a2800000-0000-4000-8000-000000000008.webp', null)$q$,
  'image without required alt text'
);
select test_who_we_are.denied(
  $q$insert into storage.objects (bucket_id, name, owner_id) values ('marketing-editorial', 'who-we-are/primary/../attack.webp', 'c2800000-0000-0000-0000-000000000001')$q$,
  'unsafe traversal path'
);
select test_who_we_are.denied(
  $q$insert into storage.objects (bucket_id, name, owner_id) values ('marketing-editorial', 'who-we-are/arbitrary/a2800000-0000-4000-8000-000000000004.webp', 'c2800000-0000-0000-0000-000000000001')$q$,
  'arbitrary who-we-are role path'
);
select test_who_we_are.denied(
  $q$insert into storage.objects (bucket_id, name, owner_id) values ('marketing-editorial', 'who-we-are/primary/a2800000-0000-4000-8000-000000000005.png', 'c2800000-0000-0000-0000-000000000001')$q$,
  'non-WebP who-we-are upload'
);
reset role;

set local role anon;
select test_who_we_are.assert((select count(*) = 1 from public.homepage_who_we_are_photos), 'anonymous users can read configured slots');
select test_who_we_are.assert((select count(*) = 1 from storage.objects where name like 'who-we-are/%'), 'anonymous users can read safe who-we-are objects');
select test_who_we_are.denied(
  $q$insert into public.homepage_who_we_are_photos (role, image_path, alt_text) values ('upper_right', 'who-we-are/upper_right/a2800000-0000-4000-8000-000000000006.webp', 'Anonymous insert')$q$,
  'anonymous slot insert'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2800000-0000-0000-0000-000000000002', true);
select test_who_we_are.assert((select count(*) = 1 from public.homepage_who_we_are_photos), 'non-admin users can read configured slots');
select test_who_we_are.denied($q$update public.homepage_who_we_are_photos set badge_text = 'Attack'$q$, 'non-admin slot update');
select test_who_we_are.denied($q$delete from public.homepage_who_we_are_photos$q$, 'non-admin slot delete');
select test_who_we_are.denied(
  $q$insert into storage.objects (bucket_id, name, owner_id) values ('marketing-editorial', 'who-we-are/upper_right/a2800000-0000-4000-8000-000000000007.webp', 'c2800000-0000-0000-0000-000000000002')$q$,
  'non-admin photo upload'
);
reset role;

rollback;
select 'PASS: Who We Are fixed roles, RLS, and Storage security' as result;
