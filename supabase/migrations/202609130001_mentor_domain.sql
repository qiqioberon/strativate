-- Canonical operational Mentor Domain. Product Catalog mentor tiers remain
-- intentionally separate until the Private Mentoring redesign.
create extension if not exists btree_gist with schema extensions;

create table public.mentor_tiers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_]*$'),
  name text not null unique check (char_length(btrim(name)) between 1 and 100),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mentor_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tier_id uuid references public.mentor_tiers(id),
  timezone text not null default 'Asia/Jakarta'
    check (char_length(btrim(timezone)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index mentor_profiles_tier_idx on public.mentor_profiles(tier_id);

alter table public.mentor_invites
  add column tier_id uuid references public.mentor_tiers(id);
create index mentor_invites_tier_idx on public.mentor_invites(tier_id);

create table public.mentor_availability_rules (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.mentor_profiles(user_id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time without time zone not null,
  end_time time without time zone not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mentor_availability_time_order check (start_time < end_time),
  constraint mentor_availability_no_overlap exclude using gist (
    mentor_id extensions.gist_uuid_ops with =,
    day_of_week extensions.gist_int2_ops with =,
    int8range(
      extract(epoch from start_time)::bigint,
      extract(epoch from end_time)::bigint,
      '[)'
    ) with &&
  )
);
create index mentor_availability_lookup_idx
  on public.mentor_availability_rules(mentor_id, day_of_week, start_time);

insert into public.mentor_tiers (id, code, name, sort_order) values
  ('81000000-0000-0000-0000-000000000001', 'TOP_STUDENT', 'Top Student', 10),
  ('81000000-0000-0000-0000-000000000002', 'YOUNG_PROFESSIONAL', 'Young Professional', 20);

create trigger mentor_tiers_touch_updated_at
  before update on public.mentor_tiers
  for each row execute function public.touch_updated_at();
create trigger mentor_profiles_touch_updated_at
  before update on public.mentor_profiles
  for each row execute function public.touch_updated_at();
create trigger mentor_availability_touch_updated_at
  before update on public.mentor_availability_rules
  for each row execute function public.touch_updated_at();

create function public.mentor_profile_require_mentor() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = new.user_id and role = 'mentor'::public.app_role
  ) then
    raise exception 'Mentor profile requires a mentor account' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger mentor_profiles_require_mentor
  before insert or update of user_id on public.mentor_profiles
  for each row execute function public.mentor_profile_require_mentor();

create function public.sync_mentor_profile_for_role() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'mentor'::public.app_role then
    insert into public.mentor_profiles(user_id) values (new.id)
    on conflict (user_id) do nothing;
  elsif exists (select 1 from public.mentor_profiles where user_id = new.id) then
    raise exception 'Remove the mentor profile before changing the account role'
      using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger profiles_sync_mentor_profile
  after insert or update of role on public.profiles
  for each row execute function public.sync_mentor_profile_for_role();

-- Do not infer legacy tiers from the public roster or Product Catalog.
insert into public.mentor_profiles(user_id)
select id from public.profiles where role = 'mentor'::public.app_role
on conflict (user_id) do nothing;

create function public.validate_mentor_invite_tier() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.tier_id is null then
    raise exception 'A new mentor invitation requires an active tier' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' then
    if old.user_id is not null and new.tier_id is distinct from old.tier_id then
      raise exception 'The tier of a linked mentor invitation cannot be changed' using errcode = '22023';
    end if;
    if old.tier_id is not null and new.tier_id is null then
      raise exception 'A tiered mentor invitation cannot lose its tier' using errcode = '22023';
    end if;
  end if;
  if new.tier_id is not null and not exists (
    select 1 from public.mentor_tiers where id = new.tier_id and is_active
  ) then
    raise exception 'Mentor invitation requires an active tier' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger mentor_invites_validate_tier
  before insert or update of tier_id on public.mentor_invites
  for each row execute function public.validate_mentor_invite_tier();

-- Preserve the trusted Auth bootstrap while propagating the registry tier.
create or replace function public.bootstrap_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_role public.app_role := 'mentee';
  v_method text := case when new.raw_app_meta_data->>'provider' = 'google' then 'google' else 'email' end;
  v_invite public.mentor_invites;
begin
  if new.invited_at is not null then
    select * into v_invite from public.mentor_invites
    where email = lower(btrim(new.email)) and status = 'pending' and user_id is null
    for update;
    if found and exists (
      select 1 from public.profiles where id = v_invite.invited_by and role = 'admin'::public.app_role
    ) then
      v_role := 'mentor';
      v_method := 'invitation';
    end if;
  end if;

  insert into public.profiles (id, role, registration_method, first_name, last_name, avatar_url)
  values (
    new.id,
    v_role,
    v_method,
    nullif(left(btrim(new.raw_user_meta_data->>'given_name'), 100), ''),
    nullif(left(btrim(new.raw_user_meta_data->>'family_name'), 100), ''),
    nullif(left(new.raw_user_meta_data->>'avatar_url', 2048), '')
  );

  if v_role = 'mentee'::public.app_role then
    insert into public.mentee_profiles(user_id) values (new.id);
  else
    insert into public.mentor_profiles(user_id, tier_id)
    values (new.id, v_invite.tier_id)
    on conflict (user_id) do update set tier_id = excluded.tier_id;
    if v_invite.tier_id is not null and not exists (
      select 1 from public.mentor_profiles
      where user_id = new.id and tier_id = v_invite.tier_id
    ) then
      raise exception 'Mentor invitation tier was not propagated' using errcode = '23514';
    end if;
    update public.mentor_invites set user_id = new.id where email = v_invite.email;
  end if;
  return new;
end;
$$;

create or replace function public.assign_invited_mentor() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.mentor_invites;
begin
  if old.invited_at is not null or new.invited_at is null or new.email_confirmed_at is not null then
    return new;
  end if;
  select * into v_invite from public.mentor_invites
  where email = lower(btrim(new.email)) and status = 'pending' and user_id is null
  for update;
  if not found or not exists (
    select 1 from public.profiles where id = v_invite.invited_by and role = 'admin'::public.app_role
  ) then
    return new;
  end if;

  update public.profiles
  set role = 'mentor'::public.app_role, registration_method = 'invitation'
  where id = new.id and role = 'mentee'::public.app_role;
  if found then
    delete from public.mentee_profiles where user_id = new.id;
    insert into public.mentor_profiles(user_id, tier_id)
    values (new.id, v_invite.tier_id)
    on conflict (user_id) do update set tier_id = excluded.tier_id;
    if v_invite.tier_id is not null and not exists (
      select 1 from public.mentor_profiles
      where user_id = new.id and tier_id = v_invite.tier_id
    ) then
      raise exception 'Mentor invitation tier was not propagated' using errcode = '23514';
    end if;
    update public.mentor_invites set user_id = new.id where email = v_invite.email;
  end if;
  return new;
end;
$$;

alter table public.mentor_tiers enable row level security;
alter table public.mentor_profiles enable row level security;
alter table public.mentor_availability_rules enable row level security;

create policy mentor_tiers_read on public.mentor_tiers for select to authenticated using (
  is_active or public.is_admin() or exists (
    select 1 from public.mentor_profiles
    where user_id = auth.uid() and tier_id = mentor_tiers.id
  )
);
create policy mentor_profiles_read on public.mentor_profiles for select to authenticated using (
  user_id = auth.uid() or public.is_admin()
);
create policy mentor_availability_read on public.mentor_availability_rules for select to authenticated using (
  mentor_id = auth.uid() or public.is_admin()
);

revoke all on public.mentor_tiers, public.mentor_profiles, public.mentor_availability_rules
  from anon, authenticated;
grant select on public.mentor_tiers, public.mentor_profiles, public.mentor_availability_rules
  to authenticated;
grant all on public.mentor_tiers, public.mentor_profiles, public.mentor_availability_rules
  to service_role;

drop function public.list_mentor_invites(integer);
create function public.list_mentor_invites(p_offset integer default 0)
returns table(
  email text,
  status text,
  tier_id uuid,
  tier_code text,
  tier_name text,
  created_at timestamptz,
  can_delete boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_offset is null or p_offset < 0 then raise exception 'Invalid offset' using errcode = '22023'; end if;
  return query
    select i.email, i.status, i.tier_id, t.code, t.name, i.created_at,
      i.status <> 'pending' and (i.user_id is null or coalesce(
        p.role = 'mentor'::public.app_role and p.registration_method = 'invitation'
        and p.mentor_setup_completed_at is null and p.password_set_at is null
        and u.invited_at is not null and u.email_confirmed_at is null
        and u.last_sign_in_at is null and lower(btrim(u.email)) = i.email,
        false
      ))
    from public.mentor_invites i
    left join public.mentor_tiers t on t.id = i.tier_id
    left join public.profiles p on p.id = i.user_id
    left join auth.users u on u.id = i.user_id
    order by i.created_at desc, i.email
    limit 25 offset p_offset;
end;
$$;

create function public.list_managed_mentors(
  p_offset integer default 0,
  p_query text default '',
  p_tier_id uuid default null,
  p_setup_status text default 'all'
)
returns table(
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  username text,
  avatar_url text,
  tier_id uuid,
  tier_code text,
  tier_name text,
  timezone text,
  mentor_setup_completed_at timestamptz,
  created_at timestamptz,
  availability_configured boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_query text := btrim(coalesce(p_query, ''));
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_offset is null or p_offset < 0 then raise exception 'Invalid offset' using errcode = '22023'; end if;
  if p_setup_status not in ('all', 'complete', 'pending') then
    raise exception 'Invalid setup status' using errcode = '22023';
  end if;
  return query
    select p.id, coalesce(u.email, ''), p.first_name, p.last_name, p.username,
      p.avatar_url, mp.tier_id, t.code, t.name, mp.timezone,
      p.mentor_setup_completed_at, p.created_at,
      exists (select 1 from public.mentor_availability_rules a where a.mentor_id = p.id)
    from public.profiles p
    join public.mentor_profiles mp on mp.user_id = p.id
    join auth.users u on u.id = p.id
    left join public.mentor_tiers t on t.id = mp.tier_id
    where p.role = 'mentor'::public.app_role
      and (p_tier_id is null or mp.tier_id = p_tier_id)
      and (p_setup_status = 'all'
        or (p_setup_status = 'complete' and p.mentor_setup_completed_at is not null)
        or (p_setup_status = 'pending' and p.mentor_setup_completed_at is null))
      and (v_query = '' or concat_ws(' ', p.first_name, p.last_name, p.username, u.email) ilike '%' || v_query || '%')
    order by p.created_at desc, p.id
    limit 25 offset p_offset;
end;
$$;

create function public.set_mentor_tier(p_mentor_id uuid, p_tier_id uuid)
returns public.mentor_profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.mentor_profiles;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if not exists (select 1 from public.mentor_tiers where id = p_tier_id and is_active) then
    raise exception 'Select an active mentor tier' using errcode = '22023';
  end if;
  select mp.* into v_row
  from public.mentor_profiles mp
  join public.profiles p on p.id = mp.user_id
  where mp.user_id = p_mentor_id and p.role = 'mentor'::public.app_role
  for update of mp;
  if not found then raise exception 'Mentor account not found' using errcode = '22023'; end if;
  update public.mentor_profiles set tier_id = p_tier_id
  where user_id = p_mentor_id returning * into v_row;
  return v_row;
end;
$$;

create function public.save_mentor_availability(p_mentor_id uuid, p_rules jsonb)
returns setof public.mentor_availability_rules
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.is_admin() and v_uid is distinct from p_mentor_id then
    raise exception 'Mentor availability access denied' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.mentor_profiles mp
    join public.profiles p on p.id = mp.user_id
    where mp.user_id = p_mentor_id and p.role = 'mentor'::public.app_role
  ) then
    raise exception 'Mentor account not found' using errcode = '22023';
  end if;
  if jsonb_typeof(p_rules) is distinct from 'array' or jsonb_array_length(p_rules) > 100 then
    raise exception 'Availability must be an array of at most 100 ranges' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rules) r
    where jsonb_typeof(r) is distinct from 'object'
      or exists (
        select 1 from jsonb_object_keys(r) k
        where k not in ('day_of_week', 'start_time', 'end_time')
      )
      or coalesce(r->>'day_of_week', '') !~ '^[1-7]$'
      or coalesce(r->>'start_time', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or coalesce(r->>'end_time', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  ) then
    raise exception 'Invalid availability range' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rules) r
    where (r->>'start_time')::time >= (r->>'end_time')::time
  ) then
    raise exception 'Availability start time must be before end time' using errcode = '22023';
  end if;

  delete from public.mentor_availability_rules where mentor_id = p_mentor_id;
  insert into public.mentor_availability_rules(mentor_id, day_of_week, start_time, end_time)
  select p_mentor_id, (r->>'day_of_week')::smallint,
    (r->>'start_time')::time, (r->>'end_time')::time
  from jsonb_array_elements(p_rules) r;

  return query
    select a.* from public.mentor_availability_rules a
    where a.mentor_id = p_mentor_id
    order by a.day_of_week, a.start_time, a.id;
end;
$$;

revoke all on function public.mentor_profile_require_mentor(), public.sync_mentor_profile_for_role(),
  public.validate_mentor_invite_tier(), public.list_mentor_invites(integer),
  public.list_managed_mentors(integer, text, uuid, text), public.set_mentor_tier(uuid, uuid),
  public.save_mentor_availability(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.list_mentor_invites(integer),
  public.list_managed_mentors(integer, text, uuid, text), public.set_mentor_tier(uuid, uuid),
  public.save_mentor_availability(uuid, jsonb)
  to authenticated;
grant execute on function public.list_mentor_invites(integer),
  public.list_managed_mentors(integer, text, uuid, text), public.set_mentor_tier(uuid, uuid),
  public.save_mentor_availability(uuid, jsonb)
  to service_role;

comment on table public.mentor_tiers is
  'Canonical operational mentor tiers. Do not use catalog_mentor_tiers for mentor account assignment.';
comment on table public.catalog_mentor_tiers is
  'Legacy catalog-specific tier definitions retained for Product Catalog compatibility until Private Mentoring is redesigned.';
comment on column public.mentor_availability_rules.day_of_week is
  'ISO weekday convention: 1 = Monday through 7 = Sunday.';
