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

select test_about_featured.assert(
  (select count(*) = 2 from public.about_featured_stories),
  'migration creates exactly two Featured Story rows'
);
select test_about_featured.assert(
  (select count(*) = 1 from public.about_featured_stories where slot = 'story_one' and media_layout = 'single' and display_order = 1),
  'story one has the fixed first layout'
);
select test_about_featured.assert(
  (select count(*) = 1 from public.about_featured_stories where slot = 'story_two' and media_layout = 'pair' and display_order = 2),
  'story two has the fixed second layout'
);
select test_about_featured.assert(
  to_regprocedure('public.reorder_about_featured_stories(uuid[])') is null,
  'collection reorder RPC is removed'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c8100000-0000-0000-0000-000000000001', true);

select test_about_featured.assert(
  (select count(*) = 2 from public.admin_list_about_featured_stories()),
  'admin list exposes exactly the two fixed slots'
);

update public.about_featured_stories
set
  title = 'Approved story one',
  quote = 'Approved quote one',
  attribution_name = 'Approved team one',
  attribution_organization = 'Approved institution one',
  achievement_text = 'Approved result one',
  primary_image_path = 'about-featured-stories/11111111-1111-4111-8111-111111111111.webp',
  primary_image_source_path = 'about-featured-stories/11111111-1111-4111-8111-111111111111.jpg',
  primary_image_crop = '{"x":0,"y":0,"width":1,"height":1}'::jsonb,
  primary_image_alt_text = 'Approved landscape image',
  is_active = true
where slot = 'story_one';

update public.about_featured_stories
set
  title = 'Approved story two',
  quote = 'Approved quote two',
  attribution_name = 'Approved team two',
  attribution_organization = 'Approved institution two',
  achievement_text = 'Approved result two',
  primary_image_path = 'about-featured-stories/22222222-2222-4222-8222-222222222222.webp',
  primary_image_source_path = 'about-featured-stories/22222222-2222-4222-8222-222222222222.png',
  primary_image_crop = '{"x":0,"y":0,"width":1,"height":1}'::jsonb,
  primary_image_alt_text = 'Approved first portrait',
  secondary_image_path = 'about-featured-stories/33333333-3333-4333-8333-333333333333.webp',
  secondary_image_source_path = 'about-featured-stories/33333333-3333-4333-8333-333333333333.jpg',
  secondary_image_crop = '{"x":0,"y":0,"width":1,"height":1}'::jsonb,
  secondary_image_alt_text = 'Approved second portrait',
  is_active = true
where slot = 'story_two';

insert into storage.objects (bucket_id, name, owner_id) values
  ('marketing-editorial', 'about-featured-stories/11111111-1111-4111-8111-111111111111.webp', 'c8100000-0000-0000-0000-000000000001'),
  ('marketing-photo-sources', 'about-featured-stories/11111111-1111-4111-8111-111111111111.jpg', 'c8100000-0000-0000-0000-000000000001');

select test_about_featured.assert(
  (select count(*) = 2 from public.about_featured_stories where is_active),
  'both complete fixed slots can be activated'
);

select test_about_featured.denied(
  $q$insert into public.about_featured_stories (slot, media_layout, display_order, is_active)
      values ('story_one', 'single', 1, false)$q$,
  'admin cannot add a third or replacement Featured Story row'
);
select test_about_featured.denied(
  $q$delete from public.about_featured_stories where slot = 'story_one'$q$,
  'admin cannot delete fixed Featured Story slots'
);
select test_about_featured.denied(
  $q$update public.about_featured_stories set media_layout = 'pair' where slot = 'story_one'$q$,
  'admin cannot change a fixed layout'
);
reset role;

set local role anon;
select test_about_featured.assert(
  (select count(*) = 2 from public.about_featured_stories),
  'anonymous users can read both active fixed stories'
);
select test_about_featured.denied(
  $q$select primary_image_source_path from public.about_featured_stories$q$,
  'anonymous users cannot read private original paths'
);
select test_about_featured.assert(
  (select count(*) = 0 from storage.objects where bucket_id = 'marketing-photo-sources' and name like 'about-featured-stories/%'),
  'anonymous users cannot read private story originals'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c8100000-0000-0000-0000-000000000002', true);
select test_about_featured.assert(
  (select count(*) = 2 from public.about_featured_stories),
  'non-admin users can read active public stories'
);
select test_about_featured.denied(
  $q$update public.about_featured_stories set title = 'Tampered' where slot = 'story_one'$q$,
  'non-admin users cannot modify fixed stories'
);
select test_about_featured.denied(
  $q$insert into storage.objects (bucket_id, name, owner_id) values (
    'marketing-photo-sources',
    'about-featured-stories/55555555-5555-4555-8555-555555555555.jpg',
    'c8100000-0000-0000-0000-000000000002'
  )$q$,
  'non-admin users cannot upload private story originals'
);
reset role;

rollback;
select 'PASS: About Featured Stories fixed two-slot model, RLS, public boundary, and source privacy' as result;
