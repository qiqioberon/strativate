-- Execute as postgres after migrations; all fixtures roll back.
begin;
create schema test_logo_crop;
grant usage on schema test_logo_crop to anon, authenticated;
create function test_logo_crop.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if;
end $$;
create function test_logo_crop.denied(statement text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when insufficient_privilege or check_violation or invalid_text_representation then return;
  end;
  raise exception 'ATTACK ACCEPTED: %', statement;
end $$;
grant execute on all functions in schema test_logo_crop to anon, authenticated;

insert into auth.users (id, email, encrypted_password) values
  ('c7000000-0000-4000-8000-000000000001', 'crop-admin@test.invalid', 'hash'),
  ('c7000000-0000-4000-8000-000000000002', 'crop-mentee@test.invalid', 'hash');
update public.profiles set role = 'admin' where id = 'c7000000-0000-4000-8000-000000000001';
select test_logo_crop.assert((select not public from storage.buckets where id = 'marketing-photo-sources'), 'original bucket stays private');
select test_logo_crop.assert(not has_column_privilege('anon', 'public.competition_recognitions', 'logo_source_path', 'SELECT'), 'anon cannot read source paths');
select test_logo_crop.assert(not has_column_privilege('authenticated', 'public.competition_recognitions', 'logo_crop', 'SELECT'), 'authenticated cannot directly read crops');
select test_logo_crop.assert(not has_column_privilege('authenticated', 'public.trusted_partners', 'logo_source_path', 'SELECT'), 'authenticated cannot directly read partner sources');
select test_logo_crop.assert(not has_column_privilege('anon', 'public.trusted_partners', 'logo_crop', 'SELECT'), 'anon cannot read partner crops');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c7000000-0000-4000-8000-000000000001', true);
insert into public.competition_recognitions (competition_name, logo_path) values ('Legacy', 'recognition-logos/legacy.webp');
insert into public.trusted_partners (organization_name, logo_path) values ('Legacy', 'partner-logos/legacy.webp');
insert into public.competition_recognitions (competition_name, logo_path, logo_source_path, logo_crop)
values ('New', 'recognition-logos/new.webp', 'competition-recognitions/c7000000-0000-4000-8000-000000000003.png', '{"x":0,"y":0.2,"width":1,"height":0.4}');
insert into public.trusted_partners (organization_name, logo_path, logo_source_path, logo_crop)
values ('New', 'partner-logos/new.webp', 'trusted-partners/c7000000-0000-4000-8000-000000000004.jpg', '{"x":0.1,"y":0,"width":0.8,"height":1}');
select test_logo_crop.assert((select count(*) = 2 from public.admin_list_competition_recognitions()), 'admin RPC returns legacy and sourced recognition');
select test_logo_crop.assert((select logo_source_path is null and logo_crop is null from public.admin_list_trusted_partners() where organization_name = 'Legacy'), 'legacy metadata stays null');
select test_logo_crop.assert((select logo_crop is not null from public.admin_list_trusted_partners() where organization_name = 'New'), 'admin can read private metadata');
insert into storage.objects (bucket_id, name) values
  ('marketing-photo-sources', 'competition-recognitions/c7000000-0000-4000-8000-000000000003.png'),
  ('marketing-photo-sources', 'trusted-partners/c7000000-0000-4000-8000-000000000004.jpg');
select test_logo_crop.assert((select count(*) = 2 from storage.objects where bucket_id = 'marketing-photo-sources'), 'admin reads both original prefixes');
select test_logo_crop.denied($q$update public.trusted_partners set logo_crop = '{"x":0.9,"y":0,"width":0.5,"height":1}'$q$);
select test_logo_crop.denied($q$update public.competition_recognitions set logo_crop = '{"x":0,"y":0,"width":0}'$q$);
select test_logo_crop.denied($q$update public.competition_recognitions set logo_crop = '{"x":-0.1,"y":0,"width":1,"height":1}'$q$);
select test_logo_crop.denied($q$update public.trusted_partners set logo_source_path = 'trusted-partners/../escape.png'$q$);
select test_logo_crop.denied($q$insert into storage.objects (bucket_id,name) values ('marketing-photo-sources','trusted-partners/../escape.png')$q$);
select test_logo_crop.denied($q$insert into storage.objects (bucket_id,name) values ('marketing-photo-sources','competition-recognitions/image.svg')$q$);
reset role;

set local role anon;
select test_logo_crop.assert((select count(*) = 2 from public.trusted_partners), 'public final derivatives remain readable');
select test_logo_crop.assert((select count(*) = 0 from storage.objects where bucket_id = 'marketing-photo-sources'), 'anon cannot read originals');
select test_logo_crop.denied($q$select logo_source_path from public.trusted_partners$q$);
select test_logo_crop.denied($q$select * from public.admin_list_competition_recognitions()$q$);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c7000000-0000-4000-8000-000000000002', true);
select test_logo_crop.assert((select count(*) = 0 from public.admin_list_competition_recognitions()), 'nonadmin recognition RPC reveals no metadata');
select test_logo_crop.assert((select count(*) = 0 from public.admin_list_trusted_partners()), 'nonadmin partner RPC reveals no metadata');
select test_logo_crop.assert((select count(*) = 0 from storage.objects where bucket_id = 'marketing-photo-sources'), 'nonadmin cannot read originals');
select test_logo_crop.denied($q$insert into storage.objects (bucket_id,name) values ('marketing-photo-sources','trusted-partners/attack.png')$q$);
delete from storage.objects where bucket_id = 'marketing-photo-sources';
reset role;
select test_logo_crop.assert((select count(*) = 2 from storage.objects where bucket_id = 'marketing-photo-sources'), 'nonadmin cannot delete originals');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c7000000-0000-4000-8000-000000000001', true);
delete from storage.objects where bucket_id = 'marketing-photo-sources';
select test_logo_crop.assert((select count(*) = 0 from storage.objects where bucket_id = 'marketing-photo-sources'), 'admin deletes originals');
reset role;
rollback;
select 'PASS: private logo sources, crops, legacy compatibility, grants, RPCs and storage RLS' as result;
