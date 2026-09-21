-- Transactional, service-role-only importer for the approved mentor website seed.
-- Account lookup stays in scripts/seed-mentor-website.ts; this migration never creates auth users.

create table public.mentor_website_seed_achievements (
  mentor_public_profile_id uuid not null references public.mentor_public_profiles(id) on delete cascade,
  achievement text not null,
  primary key (mentor_public_profile_id, achievement)
);

create table public.mentor_website_seed_expertise (
  mentor_public_profile_id uuid not null references public.mentor_public_profiles(id) on delete cascade,
  expertise_id uuid not null references public.mentor_expertise(id) on delete cascade,
  primary key (mentor_public_profile_id, expertise_id)
);

alter table public.mentor_website_seed_achievements enable row level security;
alter table public.mentor_website_seed_expertise enable row level security;
revoke all on public.mentor_website_seed_achievements, public.mentor_website_seed_expertise from public, anon, authenticated;
grant all on public.mentor_website_seed_achievements, public.mentor_website_seed_expertise to service_role;

drop function if exists public.service_seed_mentor_website_profile(uuid,text,text,text,text,text,text,text,text,integer,text[],text[]);

create or replace function public.service_seed_mentor_website_profiles(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  v_profile_id uuid;
  v_mentor_user_id uuid;
  v_tier_name text;
  v_slug text;
  v_inserted integer := 0;
  v_updated integer := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Seed rows must be a JSON array' using errcode='22023';
  end if;
  if jsonb_array_length(p_rows) > 100 then
    raise exception 'At most 100 mentor seed rows are allowed' using errcode='22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) source(value)
    group by lower(btrim(value->>'public_slug')) having count(*) > 1
  ) or exists (
    select 1 from jsonb_array_elements(p_rows) source(value)
    group by value->>'mentor_user_id' having count(*) > 1
  ) then
    raise exception 'Duplicate mentor owner or public slug in seed batch' using errcode='22023';
  end if;

  -- Validate the complete batch before any write. An exception also rolls back the entire RPC call.
  for item in select value from jsonb_array_elements(p_rows)
  loop
    begin
      v_mentor_user_id := (item->>'mentor_user_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid mentor user ID' using errcode='22023';
    end;
    v_slug := btrim(lower(coalesce(item->>'public_slug','')));
    if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) > 120 then
      raise exception 'Invalid public slug: %', v_slug using errcode='22023';
    end if;
    if char_length(btrim(coalesce(item->>'display_name',''))) not between 1 and 120 then
      raise exception 'Invalid display name for %', v_slug using errcode='22023';
    end if;
    if item->>'photo_status' not in ('ready','missing') then
      raise exception 'Invalid photo status for %', v_slug using errcode='22023';
    end if;
    if item->>'publication_status' not in ('draft','published') then
      raise exception 'Invalid publication status for %', v_slug using errcode='22023';
    end if;
    if coalesce(item->>'sort_order','') !~ '^[0-9]+$' then
      raise exception 'Invalid sort order for %', v_slug using errcode='22023';
    end if;
    if coalesce(jsonb_typeof(item->'achievements'),'') <> 'array'
      or coalesce(jsonb_typeof(item->'expertise_names'),'') <> 'array' then
      raise exception 'Invalid achievement or expertise list for %', v_slug using errcode='22023';
    end if;
    if jsonb_array_length(item->'achievements') > 30
      or jsonb_array_length(item->'expertise_names') > 30 then
      raise exception 'Too many achievements or expertise values for %', v_slug using errcode='22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(item->'achievements') value
      where char_length(btrim(value)) not between 1 and 500
    ) then raise exception 'Invalid achievement for %', v_slug using errcode='22023'; end if;
    if nullif(btrim(coalesce(item->>'linkedin_url','')),'') is not null
      and item->>'linkedin_url' !~ '^https?://' then
      raise exception 'Invalid LinkedIn URL for %', v_slug using errcode='22023';
    end if;

    select tier.name into v_tier_name
    from public.mentor_profiles mp
    join public.profiles profile on profile.id=mp.user_id and profile.role='mentor'::public.app_role
    left join public.mentor_tiers tier on tier.id=mp.tier_id
    where mp.user_id=v_mentor_user_id;
    if not found then raise exception 'Real mentor account required for %', v_slug using errcode='22023'; end if;
    if nullif(btrim(coalesce(item->>'tier_name','')),'') is not null
      and v_tier_name is distinct from item->>'tier_name' then
      raise exception 'Mentor tier mismatch for %', v_slug using errcode='22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(item->'expertise_names') requested(name)
      left join public.mentor_expertise expertise
        on lower(expertise.name)=lower(btrim(requested.name)) and expertise.is_active
      where expertise.id is null
    ) then raise exception 'Unknown or inactive expertise for %', v_slug using errcode='22023'; end if;
  end loop;

  for item in select value from jsonb_array_elements(p_rows)
  loop
    v_mentor_user_id := (item->>'mentor_user_id')::uuid;
    v_slug := btrim(lower(item->>'public_slug'));
    v_profile_id := null;
    select id into v_profile_id
    from public.mentor_public_profiles
    where mentor_user_id=v_mentor_user_id
    for update;

    if v_profile_id is null then
      if exists(select 1 from public.mentor_public_profiles where public_slug=v_slug) then
        v_slug:=left(v_slug,107)||'-'||left(replace(v_mentor_user_id::text,'-',''),12);
      end if;
      if exists(select 1 from public.mentor_public_profiles where public_slug=v_slug) then
        raise exception 'Unable to allocate stable public slug for %', item->>'public_slug' using errcode='23505';
      end if;
      insert into public.mentor_public_profiles(
        mentor_user_id,public_slug,display_name,tier_id,headline,linkedin_url,short_bio,
        portrait_asset_key,photo_status,publication_status,sort_order
      )
      select v_mentor_user_id,v_slug,btrim(item->>'display_name'),mp.tier_id,
        nullif(btrim(coalesce(item->>'headline','')),''),
        nullif(btrim(coalesce(item->>'linkedin_url','')),''),
        nullif(btrim(coalesce(item->>'short_bio','')),''),
        nullif(btrim(coalesce(item->>'portrait_asset_key','')),''),
        item->>'photo_status',item->>'publication_status',(item->>'sort_order')::integer
      from public.mentor_profiles mp where mp.user_id=v_mentor_user_id
      returning id into v_profile_id;
      v_inserted := v_inserted + 1;
    else
      update public.mentor_public_profiles profile set
        display_name=btrim(item->>'display_name'),
        tier_id=mp.tier_id,
        headline=coalesce(nullif(btrim(coalesce(item->>'headline','')),''),profile.headline),
        linkedin_url=coalesce(nullif(btrim(coalesce(item->>'linkedin_url','')),''),profile.linkedin_url),
        short_bio=coalesce(nullif(btrim(coalesce(item->>'short_bio','')),''),profile.short_bio),
        portrait_asset_key=coalesce(nullif(btrim(coalesce(item->>'portrait_asset_key','')),''),profile.portrait_asset_key),
        photo_status=case when nullif(btrim(coalesce(item->>'portrait_asset_key','')),'') is null then profile.photo_status else item->>'photo_status' end,
        publication_status=item->>'publication_status',
        sort_order=(item->>'sort_order')::integer
      from public.mentor_profiles mp
      where profile.id=v_profile_id and mp.user_id=v_mentor_user_id;
      v_updated := v_updated + 1;
    end if;

    delete from public.mentor_public_achievements a
    using public.mentor_website_seed_achievements managed
    where managed.mentor_public_profile_id=v_profile_id
      and a.mentor_public_profile_id=managed.mentor_public_profile_id
      and a.achievement=managed.achievement;
    delete from public.mentor_website_seed_achievements where mentor_public_profile_id=v_profile_id;
    with desired as (
      select distinct on(lower(btrim(value))) btrim(value) achievement,ordinality
      from jsonb_array_elements_text(item->'achievements') with ordinality source(value,ordinality)
      order by lower(btrim(value)),ordinality
    ), inserted as (
      insert into public.mentor_public_achievements(mentor_public_profile_id,achievement,sort_order)
      select v_profile_id,achievement,ordinality::integer*10 from desired order by ordinality
      on conflict do nothing returning achievement
    )
    insert into public.mentor_website_seed_achievements(mentor_public_profile_id,achievement)
    select v_profile_id,achievement from inserted;

    delete from public.mentor_public_profile_expertise relation
    using public.mentor_website_seed_expertise managed
    where managed.mentor_public_profile_id=v_profile_id
      and relation.mentor_public_profile_id=managed.mentor_public_profile_id
      and relation.expertise_id=managed.expertise_id;
    delete from public.mentor_website_seed_expertise where mentor_public_profile_id=v_profile_id;
    with desired as (
      select expertise.id,min(requested.ordinality) ordinality
      from jsonb_array_elements_text(item->'expertise_names') with ordinality requested(name,ordinality)
      join public.mentor_expertise expertise
        on lower(expertise.name)=lower(btrim(requested.name)) and expertise.is_active
      group by expertise.id
    ), inserted as (
      insert into public.mentor_public_profile_expertise(mentor_public_profile_id,expertise_id)
      select v_profile_id,id from desired order by ordinality
      on conflict do nothing returning expertise_id
    )
    insert into public.mentor_website_seed_expertise(mentor_public_profile_id,expertise_id)
    select v_profile_id,expertise_id from inserted;
  end loop;

  return jsonb_build_object('inserted',v_inserted,'updated',v_updated,'processed',jsonb_array_length(p_rows));
end;
$$;

revoke all on function public.service_seed_mentor_website_profiles(jsonb) from public, anon, authenticated;
grant execute on function public.service_seed_mentor_website_profiles(jsonb) to service_role;

comment on function public.service_seed_mentor_website_profiles(jsonb)
is 'Atomically reconciles approved website data for existing real mentor accounts; never creates accounts.';
