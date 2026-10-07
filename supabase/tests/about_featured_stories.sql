-- Execute as postgres after migrations. All fixtures roll back.
begin;
create schema test_about_featured;
grant usage on schema test_about_featured to anon, authenticated;

create function test_about_featured.assert(p_condition boolean, p_message text) returns void language plpgsql as $$
begin
  if p_condition is distinct from true then raise exception 'ASSERTION FAILED: %', p_message; end if;
end $$;

create function test_about_featured.denied(p_sql text, p_message text) returns void language plpgsql as $$
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
grant execute on all functions in schema test_about_featured to anon, authenticated;

insert into auth.users (id, email, encrypted_password) values
  ('c8100000-0000-0000-0000-000000000001', 'featured-admin@test.invalid', 'hash'),
  ('c8100000-0000-0000-0000-000000000002', 'featured-mentee@test.invalid', 'hash');
update public.profiles set role = 'admin' where id = 'c8100000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c8100000-0000-0000-0000-000000000001', true);

insert into public.about_featured_stories (
  title, quote, attribution_name, attribution_organization, achievement_text, media_layout,
  primary_image_path, primary_image_source_path, primary_image_crop, primary_image_alt_text,
  display_order, is_active
) values (
  'Approved active story', 'Approved quote', 'Approved team', 'Approved institution', 'Approved result', 'single',
  'about-featured-stories/11111111-1111-4111-8111-111111111111.webp',
  'about-featured-stories/11111111-1111-4111-8111-111111111111.jpg',
  '{"x":0,"y":0,"width":1,"height":1}'::jsonb, 'Approved editorial image',
  20, true
);

insert into public.about_featured_stories (
  title, quote, attribution_name, attribution_organization, achievement_text, media_layout,
  primary_image_path, primary_image_source_path, primary_image_crop, primary_image_alt_text,
  secondary_image_path, secondary_image_source_path, secondary_image_crop, secondary_image_alt_text,
  display_order, is_active
) values (
  'Approved inactive pair', 'Approved quote two', 'Approved person', 'Approved organization', 'Approved result two', 'pair',
  'about-featured-stories/22222222-2222-4222-8222-222222222222.webp',
  'about-featured-stories/22222222-2222-4222-8222-222222222222.png',
  '{"x":0,"y":0,"width":1,"height":1}'::jsonb, 'Approved first portrait',
  'about-featured-stories/33333333-3333-4333-8333-333333333333.webp',
  'about-featured-stories/33333333-3333-4333-8333-333333333333.webp',
  '{"x":0,"y":0,"width":1,"height":1}'::jsonb, 'Approved second portrait',
  10, false
);

insert into storage.objects (bucket_id, name, owner_id) values
  ('marketing-editorial', 'about-featured-stories/11111111-1111-4111-8111-111111111111.webp', 'c8100000-0000-0000-0000-000000000001'),
  ('marketing-photo-sources', 'about-featured-stories/11111111-1111-4111-8111-111111111111.jpg', 'c8100000-0000-0000-0000-000000000001');

select test_about_featured.assert(
  (select count(*) = 2 from public.admin_list_about_featured_stories()),
  'admin list includes active and inactive stories with private metadata'
);

select public.reorder_about_featured_stories(array(
  select id from public.about_featured_stories order by display_order desc
));
select test_about_featured.assert(
  (select display_order = 1 from public.about_featured_stories where title = 'Approved active story'),
  'admin can reorder stories contiguously'
);

select test_about_featured.denied(
  $q$insert into public.about_featured_stories (
    title, quote, attribution_name, attribution_organization, achievement_text, media_layout,
    primary_image_path, primary_image_source_path, primary_image_crop, primary_image_alt_text
  ) values (
    'Broken pair', 'Quote', 'Name', 'Organization', 'Result', 'pair',
    'about-featured-stories/44444444-4444-4444-8444-444444444444.webp',
    'about-featured-stories/44444444-4444-4444-8444-444444444444.jpg',
    '{"x":0,"y":0,"width":1,"height":1}'::jsonb, 'Alt'
  )$q$,
  'pair layout without a secondary image'
);
reset role;

set local role anon;
select test_about_featured.assert((select count(*) = 1 from public.about_featured_stories), 'anonymous users see only active stories');
select test_about_featured.denied(
  $q$select primary_image_source_path from public.about_featured_stories$q$,
  'anonymous access to private source paths'
);
select test_about_featured.assert(
  (select count(*) = 0 from storage.objects where bucket_id = 'marketing-photo-sources' and name like 'about-featured-stories/%'),
  'anonymous users cannot read private story originals'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c8100000-0000-0000-0000-000000000002', true);
select test_about_featured.assert((select count(*) = 1 from public.about_featured_stories), 'non-admin users see only active stories');
select test_about_featured.denied($q$update public.about_featured_stories set is_active = false$q$, 'non-admin story update');
select test_about_featured.denied(
  $q$select public.reorder_about_featured_stories(array(select id from public.about_featured_stories))$q$,
  'non-admin story reorder'
);
select test_about_featured.denied(
  $q$insert into storage.objects (bucket_id, name, owner_id) values (
    'marketing-photo-sources',
    'about-featured-stories/55555555-5555-4555-8555-555555555555.jpg',
    'c8100000-0000-0000-0000-000000000002'
  )$q$,
  'non-admin private original upload'
);
reset role;

rollback;
select 'PASS: About Featured Stories table, ordering, RLS, public boundary, and source privacy' as result;
