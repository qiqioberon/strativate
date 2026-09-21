-- Development-only account configuration invoked after Auth Admin creates or updates a user.
-- The caller must enforce the environment guard; this RPC is restricted to service_role.

create or replace function public.service_seed_dev_mentor_account(p_user_id uuid,p_profile jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_tier_id uuid;
  v_profile_id uuid;
  v_requested_slug text := lower(btrim(coalesce(p_profile->>'public_slug','')));
  v_slug text;
  v_display_name text := btrim(coalesce(p_profile->>'display_name',''));
  v_created boolean := false;
begin
  if p_profile is null or jsonb_typeof(p_profile)<>'object' then
    raise exception 'Mentor seed profile must be an object' using errcode='22023';
  end if;
  select role into v_role from public.profiles where id=p_user_id for update;
  if not found then raise exception 'Auth-backed profile required' using errcode='22023'; end if;
  if v_role='admin'::public.app_role then raise exception 'Admin account cannot be overwritten by mentor seed' using errcode='22023'; end if;
  if v_requested_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_requested_slug)>120 then raise exception 'Invalid public slug' using errcode='22023'; end if;
  if char_length(v_display_name) not between 1 and 120 then raise exception 'Invalid display name' using errcode='22023'; end if;
  if p_profile->>'photo_status' not in('ready','missing') then raise exception 'Invalid photo status' using errcode='22023'; end if;
  if p_profile->>'publication_status' not in('draft','published') then raise exception 'Invalid publication status' using errcode='22023'; end if;
  if coalesce(p_profile->>'sort_order','')!~'^[0-9]+$' then raise exception 'Invalid sort order' using errcode='22023'; end if;
  if coalesce(jsonb_typeof(p_profile->'achievements'),'')<>'array'
    or coalesce(jsonb_typeof(p_profile->'expertise_names'),'')<>'array' then
    raise exception 'Achievements and expertise must be arrays' using errcode='22023';
  end if;
  if jsonb_array_length(p_profile->'achievements')>30 or jsonb_array_length(p_profile->'expertise_names')>30 then
    raise exception 'Too many achievements or expertise values' using errcode='22023';
  end if;
  if nullif(btrim(coalesce(p_profile->>'linkedin_url','')),'') is not null
    and p_profile->>'linkedin_url'!~'^https?://' then raise exception 'Invalid LinkedIn URL' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements_text(p_profile->'achievements') value where char_length(btrim(value)) not between 1 and 500) then
    raise exception 'Invalid achievement' using errcode='22023';
  end if;

  select id into v_tier_id from public.mentor_tiers
  where lower(name)=lower(btrim(p_profile->>'tier_name')) and is_active;
  if not found then raise exception 'Active mentor tier required' using errcode='22023'; end if;
  if exists(
    select 1 from jsonb_array_elements_text(p_profile->'expertise_names') requested(name)
    left join public.mentor_expertise expertise on lower(expertise.name)=lower(btrim(requested.name)) and expertise.is_active
    where expertise.id is null
  ) then raise exception 'Unknown or inactive expertise' using errcode='22023'; end if;

  update public.profiles set
    role='mentor'::public.app_role,
    registration_method='email',
    first_name=coalesce(first_name,left(v_display_name,100))
  where id=p_user_id;
  delete from public.mentee_profiles where user_id=p_user_id;
  insert into public.mentor_profiles(user_id,tier_id,is_active)
  values(p_user_id,v_tier_id,true)
  on conflict(user_id) do update set tier_id=excluded.tier_id,is_active=true;

  select id,public_slug into v_profile_id,v_slug
  from public.mentor_public_profiles where mentor_user_id=p_user_id for update;
  if v_profile_id is null then
    v_slug:=v_requested_slug;
    if exists(select 1 from public.mentor_public_profiles where public_slug=v_slug) then
      v_slug:=left(v_slug,107)||'-'||left(replace(p_user_id::text,'-',''),12);
    end if;
    if exists(select 1 from public.mentor_public_profiles where public_slug=v_slug) then
      raise exception 'Unable to allocate stable public slug' using errcode='23505';
    end if;
    insert into public.mentor_public_profiles(
      mentor_user_id,public_slug,display_name,tier_id,headline,linkedin_url,short_bio,
      portrait_asset_key,photo_status,publication_status,sort_order
    ) values(
      p_user_id,v_slug,v_display_name,v_tier_id,
      nullif(btrim(coalesce(p_profile->>'headline','')),''),
      nullif(btrim(coalesce(p_profile->>'linkedin_url','')),''),
      nullif(btrim(coalesce(p_profile->>'short_bio','')),''),
      nullif(btrim(coalesce(p_profile->>'portrait_asset_key','')),''),
      p_profile->>'photo_status',p_profile->>'publication_status',(p_profile->>'sort_order')::integer
    ) returning id into v_profile_id;
    v_created:=true;
  else
    update public.mentor_public_profiles profile set
      display_name=v_display_name,
      tier_id=v_tier_id,
      headline=coalesce(nullif(btrim(coalesce(p_profile->>'headline','')),''),profile.headline),
      linkedin_url=coalesce(nullif(btrim(coalesce(p_profile->>'linkedin_url','')),''),profile.linkedin_url),
      short_bio=coalesce(nullif(btrim(coalesce(p_profile->>'short_bio','')),''),profile.short_bio),
      portrait_asset_key=coalesce(nullif(btrim(coalesce(p_profile->>'portrait_asset_key','')),''),profile.portrait_asset_key),
      photo_status=case when nullif(btrim(coalesce(p_profile->>'portrait_asset_key','')),'') is null then profile.photo_status else p_profile->>'photo_status' end,
      publication_status=p_profile->>'publication_status',
      sort_order=(p_profile->>'sort_order')::integer
    where id=v_profile_id;
  end if;

  insert into public.mentor_public_achievements(mentor_public_profile_id,achievement,sort_order)
  select v_profile_id,desired.achievement,desired.ordinality::integer*10
  from(
    select distinct on(lower(btrim(value))) btrim(value) achievement,ordinality
    from jsonb_array_elements_text(p_profile->'achievements') with ordinality source(value,ordinality)
    order by lower(btrim(value)),ordinality
  ) desired
  where not exists(
    select 1 from public.mentor_public_achievements existing
    where existing.mentor_public_profile_id=v_profile_id and lower(existing.achievement)=lower(desired.achievement)
  )
  order by desired.ordinality;

  insert into public.mentor_public_profile_expertise(mentor_public_profile_id,expertise_id)
  select v_profile_id,expertise.id
  from jsonb_array_elements_text(p_profile->'expertise_names') with ordinality requested(name,ordinality)
  join public.mentor_expertise expertise on lower(expertise.name)=lower(btrim(requested.name)) and expertise.is_active
  group by expertise.id order by min(requested.ordinality)
  on conflict do nothing;

  return jsonb_build_object('profile_id',v_profile_id,'created',v_created,'public_slug',v_slug);
end;
$$;

revoke all on function public.service_seed_dev_mentor_account(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.service_seed_dev_mentor_account(uuid,jsonb) to service_role;

comment on function public.service_seed_dev_mentor_account(uuid,jsonb)
is 'Development-only service operation that configures an existing Auth user as a mentor and upserts approved public profile data.';
