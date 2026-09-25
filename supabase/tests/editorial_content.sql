begin;

create schema test_editorial;
grant usage on schema test_editorial to anon, authenticated;

create function test_editorial.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if;
end $$;

create function test_editorial.denied(command text, message text) returns void language plpgsql as $$
declare affected bigint := 0;
begin
  begin
    execute command;
    get diagnostics affected = row_count;
    if affected = 0 then return; end if;
  exception when insufficient_privilege or check_violation or invalid_text_representation then
    return;
  end;
  raise exception 'UNEXPECTEDLY ALLOWED: %', message;
end $$;

grant execute on all functions in schema test_editorial to anon, authenticated;

insert into auth.users(id,email,encrypted_password) values
  ('a2000000-0000-0000-0000-000000000001','editorial-admin@test.invalid','hash'),
  ('a2000000-0000-0000-0000-000000000002','editorial-mentee@test.invalid','hash');
update public.profiles set role='admin' where id='a2000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub','a2000000-0000-0000-0000-000000000001',true);

insert into public.competition_categories(id,code,slug,name,sort_order,is_active)
values ('a2100000-0000-0000-0000-000000000001','EDITORIAL_TEST','editorial-test','Editorial Test',999,true);

insert into public.publications(slug,title,excerpt,body,category,cover_path,cover_alt_text,published_at,is_published,is_featured)
values
  ('published-story','Published Story','Visible excerpt','Visible body','Insights','publications/published.webp','Published story cover',current_date,true,true),
  ('draft-story','Draft Story','Draft excerpt','Draft body','News',null,null,current_date,false,false);

insert into public.competitions(slug,name,category_id,description,rules_url,registration_url,registration_deadline,cover_path,cover_alt_text,status,is_published)
values
  ('published-competition','Published Competition','a2100000-0000-0000-0000-000000000001','Visible competition','https://example.com/rules','http://example.com/register',current_date+10,'competitions/published.webp','Published competition cover','open',true),
  ('draft-competition','Draft Competition',null,'Draft competition',null,null,null,null,null,'upcoming',false);

insert into storage.objects(bucket_id,name,owner_id)
values
  ('marketing-editorial','publications/published.webp','a2000000-0000-0000-0000-000000000001'),
  ('marketing-editorial','competitions/published.webp','a2000000-0000-0000-0000-000000000001');

select test_editorial.assert((select count(*)=2 from public.publications),'admin can read publication drafts and published rows');
select test_editorial.assert((select count(*)=2 from public.competitions),'admin can read competition drafts and published rows');

update public.publications set excerpt='Updated excerpt' where slug='published-story';
select test_editorial.assert((select excerpt='Updated excerpt' from public.publications where slug='published-story'),'admin can update publication');

select test_editorial.denied(
  $$insert into public.publications(slug,title,excerpt,body,cover_path) values('bad-path','Bad','Bad','Bad','../attack.webp')$$,
  'publication traversal cover path'
);
select test_editorial.denied(
  $$insert into public.competitions(slug,name,description,rules_url) values('bad-url','Bad','Bad','javascript:alert(1)')$$,
  'unsafe competition rules URL'
);
select test_editorial.denied(
  $$insert into storage.objects(bucket_id,name,owner_id) values('marketing-editorial','other/attack.webp','a2000000-0000-0000-0000-000000000001')$$,
  'storage object outside approved prefixes'
);

delete from public.competition_categories where id='a2100000-0000-0000-0000-000000000001';
select test_editorial.assert((select category_id is null from public.competitions where slug='published-competition'),'competition category FK uses on delete set null');
reset role;

set local role anon;
select test_editorial.assert((select count(*)=1 from public.publications),'anonymous users see only published publications');
select test_editorial.assert((select count(*)=1 from public.competitions),'anonymous users see only published competitions');
select test_editorial.assert((select count(*)=2 from storage.objects where bucket_id='marketing-editorial'),'anonymous users see only approved-prefix editorial objects');
select test_editorial.denied(
  $$insert into public.publications(slug,title,excerpt,body) values('anon-write','Anon','Anon','Anon')$$,
  'anonymous publication write'
);
select test_editorial.denied(
  $$insert into public.competitions(slug,name,description) values('anon-competition','Anon','Anon')$$,
  'anonymous competition write'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','a2000000-0000-0000-0000-000000000002',true);
select test_editorial.assert((select count(*)=1 from public.publications),'mentee cannot read publication drafts');
select test_editorial.assert((select count(*)=1 from public.competitions),'mentee cannot read competition drafts');
select test_editorial.denied(
  $$update public.publications set title='Tampered' where slug='published-story'$$,
  'mentee publication update'
);
select test_editorial.denied(
  $$insert into storage.objects(bucket_id,name,owner_id) values('marketing-editorial','publications/attack.webp','a2000000-0000-0000-0000-000000000002')$$,
  'mentee editorial storage upload'
);
reset role;

rollback;
select 'PASS: editorial publication/competition RLS, category FK, URL and storage path hardening' as result;
