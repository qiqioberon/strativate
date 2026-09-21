-- Disposable database only. All fixtures and mutations are rolled back.
begin;

create schema test_mentor_website_seed;
create function test_mentor_website_seed.assert(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ASSERTION FAILED: %',message;end if;end;
$$;
create function test_mentor_website_seed.row_data(
  owner_id uuid, slug text, display_name text, tier_name text, headline text,
  short_bio text, portrait_key text, publication_status text, sort_order integer,
  achievements text[], expertise text[]
) returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'mentor_user_id',owner_id,'public_slug',slug,'display_name',display_name,'tier_name',tier_name,
    'headline',headline,'linkedin_url',null,'short_bio',short_bio,'portrait_asset_key',portrait_key,
    'photo_status',case when portrait_key is null then 'missing' else 'ready' end,
    'publication_status',publication_status,'sort_order',sort_order,
    'achievements',to_jsonb(achievements),'expertise_names',to_jsonb(expertise)
  );
$$;
grant usage on schema test_mentor_website_seed to service_role;
grant execute on function test_mentor_website_seed.row_data(uuid,text,text,text,text,text,text,text,integer,text[],text[]) to service_role;

insert into auth.users(id,email) values
  ('8a000000-0000-0000-0000-000000000001','seed-owner@test.invalid'),
  ('8a000000-0000-0000-0000-000000000002','unrelated-owner@test.invalid'),
  ('8a000000-0000-0000-0000-000000000003','wrong-role@test.invalid');
update public.profiles set role='mentor' where id in('8a000000-0000-0000-0000-000000000001','8a000000-0000-0000-0000-000000000002');
delete from public.mentee_profiles where user_id in('8a000000-0000-0000-0000-000000000001','8a000000-0000-0000-0000-000000000002');
insert into public.mentor_profiles(user_id,tier_id) values
  ('8a000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001'),
  ('8a000000-0000-0000-0000-000000000002','81000000-0000-0000-0000-000000000001'),
  ('8a000000-0000-0000-0000-000000000003','81000000-0000-0000-0000-000000000001')
on conflict(user_id) do update set tier_id=excluded.tier_id;

select test_mentor_website_seed.assert(
  not has_function_privilege('authenticated','public.service_seed_mentor_website_profiles(jsonb)','execute'),
  'authenticated callers cannot execute the seed importer'
);

set local role service_role;
select public.service_seed_mentor_website_profiles(jsonb_build_array(
  test_mentor_website_seed.row_data(
    '8a000000-0000-0000-0000-000000000001','seed-owner','Seed Owner','Top Student','Seed Headline',null,
    'mentors.seed-owner.portrait','published',10,array['First achievement','Second achievement','First achievement'],array['Business Case','Finance','Business Case']
  ),
  test_mentor_website_seed.row_data(
    '8a000000-0000-0000-0000-000000000002','unrelated-owner','Unrelated Owner','Top Student',null,null,
    null,'draft',20,array[]::text[],array[]::text[]
  )
));
reset role;

select test_mentor_website_seed.assert((select count(*)=1 from public.mentor_public_profiles where mentor_user_id='8a000000-0000-0000-0000-000000000001'),'first import creates one owned profile');
select test_mentor_website_seed.assert((select count(*)=2 from public.mentor_public_achievements a join public.mentor_public_profiles p on p.id=a.mentor_public_profile_id where p.mentor_user_id='8a000000-0000-0000-0000-000000000001'),'first import deduplicates achievements');
select test_mentor_website_seed.assert((select count(*)=2 from public.mentor_public_profile_expertise j join public.mentor_public_profiles p on p.id=j.mentor_public_profile_id where p.mentor_user_id='8a000000-0000-0000-0000-000000000001'),'first import deduplicates expertise links');

-- Add mentor-managed content that is deliberately outside the seed-owned set.
set local role service_role;
update public.mentor_public_profiles set short_bio='Mentor managed bio',portrait_url='https://example.test/mentor-managed.webp'
where mentor_user_id='8a000000-0000-0000-0000-000000000001';
insert into public.mentor_public_achievements(mentor_public_profile_id,achievement,sort_order)
select id,'Mentor managed achievement',900 from public.mentor_public_profiles where mentor_user_id='8a000000-0000-0000-0000-000000000001';
insert into public.mentor_public_profile_expertise(mentor_public_profile_id,expertise_id)
select p.id,e.id from public.mentor_public_profiles p cross join public.mentor_expertise e
where p.mentor_user_id='8a000000-0000-0000-0000-000000000001' and e.name='Accounting';

select public.service_seed_mentor_website_profiles(jsonb_build_array(
  test_mentor_website_seed.row_data(
    '8a000000-0000-0000-0000-000000000001','changed-slug-must-not-win','Seed Owner Updated','Top Student','Updated Headline',null,
    'mentors.seed-owner.portrait','published',10,array['Only current achievement'],array['Marketing']
  )
));
reset role;

select test_mentor_website_seed.assert((select count(*)=1 and min(public_slug)='seed-owner' and min(display_name)='Seed Owner Updated' from public.mentor_public_profiles where mentor_user_id='8a000000-0000-0000-0000-000000000001'),'rerun updates one profile while preserving its stable slug');
select test_mentor_website_seed.assert((select min(short_bio)='Mentor managed bio' and min(portrait_url)='https://example.test/mentor-managed.webp' from public.mentor_public_profiles where mentor_user_id='8a000000-0000-0000-0000-000000000001'),'absent spreadsheet scalars preserve mentor-managed values');
select test_mentor_website_seed.assert((select count(*)=2 from public.mentor_public_achievements a join public.mentor_public_profiles p on p.id=a.mentor_public_profile_id where p.mentor_user_id='8a000000-0000-0000-0000-000000000001'),'rerun replaces only seed-owned achievements and preserves mentor-managed content');
select test_mentor_website_seed.assert((select count(*)=2 from public.mentor_public_profile_expertise j join public.mentor_public_profiles p on p.id=j.mentor_public_profile_id where p.mentor_user_id='8a000000-0000-0000-0000-000000000001'),'rerun replaces only seed-owned expertise and preserves mentor-managed content');
select test_mentor_website_seed.assert((select count(*)=1 from public.mentor_public_profiles where mentor_user_id='8a000000-0000-0000-0000-000000000002'),'profiles absent from a later import remain untouched');
select test_mentor_website_seed.assert((select count(*)=1 from public.list_public_mentors() where public_slug='seed-owner'),'published matched profile crosses the public boundary');
select test_mentor_website_seed.assert((select count(*)=0 from public.list_public_mentors() where public_slug='unrelated-owner'),'draft profile stays hidden from the public boundary');

-- One invalid row must roll back valid rows in the same bulk call.
do $$begin
  begin
    perform public.service_seed_mentor_website_profiles(jsonb_build_array(
      test_mentor_website_seed.row_data('8a000000-0000-0000-0000-000000000001','seed-owner','Must Roll Back','Top Student',null,null,null,'published',10,array[]::text[],array[]::text[]),
      test_mentor_website_seed.row_data('8a000000-0000-0000-0000-000000000099','missing-owner','Missing Owner','Top Student',null,null,null,'published',30,array[]::text[],array[]::text[])
    ));
    raise exception 'missing mentor account was accepted';
  exception when sqlstate '22023' then null;end;
end$$;
select test_mentor_website_seed.assert((select display_name='Seed Owner Updated' from public.mentor_public_profiles where mentor_user_id='8a000000-0000-0000-0000-000000000001'),'invalid batch commits no partial profile changes');

do $$begin
  begin
    perform public.service_seed_mentor_website_profiles(jsonb_build_array(
      test_mentor_website_seed.row_data('8a000000-0000-0000-0000-000000000001','seed-owner','Seed Owner','Young Professional',null,null,null,'published',10,array[]::text[],array[]::text[])
    ));
    raise exception 'tier mismatch was accepted';
  exception when sqlstate '22023' then null;end;
end$$;

do $$begin
  begin
    perform public.service_seed_mentor_website_profiles(jsonb_build_array(
      test_mentor_website_seed.row_data('8a000000-0000-0000-0000-000000000003','wrong-role','Wrong Role','Top Student',null,null,null,'published',40,array[]::text[],array[]::text[])
    ));
    raise exception 'non-mentor profile role was accepted';
  exception when sqlstate '22023' then null;end;
end$$;

rollback;
