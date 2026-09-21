-- Forward rollback for the superseded profile-only mentor website importer.
-- Public profiles already written by the old importer are deliberately preserved.

drop function if exists public.service_seed_mentor_website_profiles(jsonb);
drop table if exists public.mentor_website_seed_achievements;
drop table if exists public.mentor_website_seed_expertise;
