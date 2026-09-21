-- Disposable database only. All fixtures and mutations are rolled back.
begin;

create schema test_mentor_website_seed;
create function test_mentor_website_seed.assert(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ASSERTION FAILED: %',message;end if;end;
$$;

select test_mentor_website_seed.assert(to_regprocedure('public.service_seed_mentor_website_profiles(jsonb)') is null,'superseded profile-only importer was rolled back');
select test_mentor_website_seed.assert(to_regclass('public.mentor_website_seed_achievements') is null,'superseded achievement provenance table was rolled back');
select test_mentor_website_seed.assert(to_regclass('public.mentor_website_seed_expertise') is null,'superseded expertise provenance table was rolled back');
select test_mentor_website_seed.assert(to_regprocedure('public.service_seed_dev_mentor_account(uuid,jsonb)') is not null,'development account configuration RPC exists');
select test_mentor_website_seed.assert(not has_function_privilege('authenticated','public.service_seed_dev_mentor_account(uuid,jsonb)','execute'),'authenticated callers cannot execute the development seed RPC');

insert into auth.users(id,email) values
  ('8a000000-0000-0000-0000-000000000001','seed-owner@test.invalid'),
  ('8a000000-0000-0000-0000-000000000002','unrelated-owner@test.invalid'),
  ('8a000000-0000-0000-0000-000000000003','admin-owner@test.invalid');
update public.profiles set role='admin' where id='8a000000-0000-0000-0000-000000000003';

set local role service_role;
select public.service_seed_dev_mentor_account('8a000000-0000-0000-0000-000000000001',jsonb_build_object(
  'public_slug','seed-owner','display_name','Seed Owner','tier_name','Top Student','headline','Seed Headline',
  'linkedin_url',null,'short_bio',null,'portrait_asset_key','mentors.seed-owner.portrait','photo_status','ready',
  'publication_status','published','sort_order',10,'achievements',jsonb_build_array('First achievement','Second achievement','First achievement'),
  'expertise_names',jsonb_build_array('Business Case','Finance','Business Case')
));
reset role;

select test_mentor_website_seed.assert((select role='mentor' and registration_method='email' from public.profiles where id='8a000000-0000-0000-0000-000000000001'),'seeded Auth owner is promoted to an email mentor account');
select test_mentor_website_seed.assert(not exists(select 1 from public.mentee_profiles where user_id='8a000000-0000-0000-0000-000000000001'),'stale mentee extension is removed');
select test_mentor_website_seed.assert((select t.name='Top Student' and mp.is_active from public.mentor_profiles mp join public.mentor_tiers t on t.id=mp.tier_id where mp.user_id='8a000000-0000-0000-0000-000000000001'),'mentor tier and active state are configured');
select test_mentor_website_seed.assert((select count(*)=1 from public.mentor_public_profiles where mentor_user_id='8a000000-0000-0000-0000-000000000001' and publication_status='published'),'one published public profile is created');
select test_mentor_website_seed.assert((select count(*)=2 from public.mentor_public_achievements a join public.mentor_public_profiles p on p.id=a.mentor_public_profile_id where p.mentor_user_id='8a000000-0000-0000-0000-000000000001'),'achievement values are deduplicated');
select test_mentor_website_seed.assert((select count(*)=2 from public.mentor_public_profile_expertise j join public.mentor_public_profiles p on p.id=j.mentor_public_profile_id where p.mentor_user_id='8a000000-0000-0000-0000-000000000001'),'expertise links are deduplicated');

set local role service_role;
update public.mentor_public_profiles set short_bio='Mentor managed bio',portrait_url='https://example.test/mentor-managed.webp'
where mentor_user_id='8a000000-0000-0000-0000-000000000001';
insert into public.mentor_public_achievements(mentor_public_profile_id,achievement,sort_order)
select id,'Mentor managed achievement',900 from public.mentor_public_profiles where mentor_user_id='8a000000-0000-0000-0000-000000000001';
select public.service_seed_dev_mentor_account('8a000000-0000-0000-0000-000000000001',jsonb_build_object(
  'public_slug','changed-slug-must-not-win','display_name','Seed Owner Updated','tier_name','Top Student','headline','Updated Headline',
  'linkedin_url',null,'short_bio',null,'portrait_asset_key','mentors.seed-owner.portrait','photo_status','ready',
  'publication_status','published','sort_order',10,'achievements',jsonb_build_array('Second achievement','New seed achievement'),
  'expertise_names',jsonb_build_array('Marketing')
));
reset role;

select test_mentor_website_seed.assert((select public_slug='seed-owner' and display_name='Seed Owner Updated' from public.mentor_public_profiles where mentor_user_id='8a000000-0000-0000-0000-000000000001'),'rerun preserves the stable slug and updates approved fields');
select test_mentor_website_seed.assert((select short_bio='Mentor managed bio' and portrait_url='https://example.test/mentor-managed.webp' from public.mentor_public_profiles where mentor_user_id='8a000000-0000-0000-0000-000000000001'),'absent spreadsheet values preserve mentor-managed scalars');
select test_mentor_website_seed.assert((select count(*)=4 from public.mentor_public_achievements a join public.mentor_public_profiles p on p.id=a.mentor_public_profile_id where p.mentor_user_id='8a000000-0000-0000-0000-000000000001'),'rerun is additive and duplicate-safe for achievements');
select test_mentor_website_seed.assert((select count(*)=3 from public.mentor_public_profile_expertise j join public.mentor_public_profiles p on p.id=j.mentor_public_profile_id where p.mentor_user_id='8a000000-0000-0000-0000-000000000001'),'rerun is additive and duplicate-safe for expertise');
select test_mentor_website_seed.assert((select count(*)=1 from public.list_public_mentors() where public_slug='seed-owner'),'published mentor remains visible through the safe public boundary');
select test_mentor_website_seed.assert(not exists(select 1 from public.mentor_public_profiles where mentor_user_id='8a000000-0000-0000-0000-000000000002'),'accounts absent from the workbook remain untouched');

do $$begin
  begin
    perform public.service_seed_dev_mentor_account('8a000000-0000-0000-0000-000000000003',jsonb_build_object(
      'public_slug','admin-owner','display_name','Admin Owner','tier_name','Top Student','photo_status','missing',
      'publication_status','published','sort_order',20,'achievements','[]'::jsonb,'expertise_names','[]'::jsonb
    ));
    raise exception 'admin account was overwritten';
  exception when sqlstate '22023' then null;end;
end$$;
select test_mentor_website_seed.assert((select role='admin' from public.profiles where id='8a000000-0000-0000-0000-000000000003'),'admin account remains protected');

rollback;
