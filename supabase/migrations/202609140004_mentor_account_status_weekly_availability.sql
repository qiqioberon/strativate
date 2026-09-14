-- Separate mentor account lifecycle from setup completion and scope availability
-- to the current and next calendar week in each mentor's configured timezone.

alter table public.mentor_profiles
  add column is_active boolean not null default true;

alter table public.mentor_availability_rules
  drop constraint mentor_availability_no_overlap;
drop index if exists public.mentor_availability_lookup_idx;

alter table public.mentor_availability_rules
  add column week_start_date date;

-- Preserve the previously recurring weekly schedule across both editable weeks
-- during the one-time transition so mentors do not lose an existing schedule.
update public.mentor_availability_rules a
set week_start_date = date_trunc('week', current_timestamp at time zone mp.timezone)::date
from public.mentor_profiles mp
where mp.user_id = a.mentor_id;

insert into public.mentor_availability_rules (
  id,
  mentor_id,
  week_start_date,
  day_of_week,
  start_time,
  end_time,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  mentor_id,
  week_start_date + 7,
  day_of_week,
  start_time,
  end_time,
  created_at,
  updated_at
from public.mentor_availability_rules
where week_start_date is not null;

alter table public.mentor_availability_rules
  alter column week_start_date set not null,
  add constraint mentor_availability_week_starts_monday
    check (extract(isodow from week_start_date) = 1),
  add constraint mentor_availability_no_overlap exclude using gist (
    mentor_id extensions.gist_uuid_ops with =,
    week_start_date extensions.gist_date_ops with =,
    day_of_week extensions.gist_int2_ops with =,
    int8range(
      extract(epoch from start_time)::bigint,
      extract(epoch from end_time)::bigint,
      '[)'
    ) with &&
  );

create index mentor_availability_lookup_idx
  on public.mentor_availability_rules(mentor_id, week_start_date, day_of_week, start_time);

-- Keep the original four-argument listing RPC for old callers. The five-argument
-- overload is the account-lifecycle-aware admin surface used by the current UI.
create function public.list_managed_mentors(
  p_offset integer,
  p_query text,
  p_tier_id uuid,
  p_account_status text,
  p_setup_status text
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
  is_active boolean,
  mentor_setup_completed_at timestamptz,
  created_at timestamptz,
  availability_configured boolean,
  availability_current_week_configured boolean,
  availability_next_week_configured boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_query text := btrim(coalesce(p_query, ''));
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_offset is null or p_offset < 0 then raise exception 'Invalid offset' using errcode = '22023'; end if;
  if p_account_status is null or p_account_status not in ('all', 'active', 'inactive') then
    raise exception 'Invalid account status' using errcode = '22023';
  end if;
  if p_setup_status is null or p_setup_status not in ('all', 'complete', 'pending') then
    raise exception 'Invalid setup status' using errcode = '22023';
  end if;

  return query
    select
      p.id,
      coalesce(u.email, ''),
      p.first_name,
      p.last_name,
      p.username,
      p.avatar_url,
      mp.tier_id,
      t.code,
      t.name,
      mp.timezone,
      mp.is_active,
      p.mentor_setup_completed_at,
      p.created_at,
      exists (
        select 1 from public.mentor_availability_rules a
        where a.mentor_id = p.id
          and a.week_start_date in (
            date_trunc('week', current_timestamp at time zone mp.timezone)::date,
            date_trunc('week', current_timestamp at time zone mp.timezone)::date + 7
          )
      ),
      exists (
        select 1 from public.mentor_availability_rules a
        where a.mentor_id = p.id
          and a.week_start_date = date_trunc('week', current_timestamp at time zone mp.timezone)::date
      ),
      exists (
        select 1 from public.mentor_availability_rules a
        where a.mentor_id = p.id
          and a.week_start_date = date_trunc('week', current_timestamp at time zone mp.timezone)::date + 7
      )
    from public.profiles p
    join public.mentor_profiles mp on mp.user_id = p.id
    join auth.users u on u.id = p.id
    left join public.mentor_tiers t on t.id = mp.tier_id
    where p.role = 'mentor'::public.app_role
      and (p_tier_id is null or mp.tier_id = p_tier_id)
      and (
        p_account_status = 'all'
        or (p_account_status = 'active' and mp.is_active)
        or (p_account_status = 'inactive' and not mp.is_active)
      )
      and (
        p_setup_status = 'all'
        or (p_setup_status = 'complete' and p.mentor_setup_completed_at is not null)
        or (p_setup_status = 'pending' and p.mentor_setup_completed_at is null)
      )
      and (v_query = '' or concat_ws(' ', p.first_name, p.last_name, p.username, u.email) ilike '%' || v_query || '%')
    order by p.created_at desc, p.id
    limit 25 offset p_offset;
end;
$$;

create function public.set_mentor_active(p_mentor_id uuid, p_is_active boolean)
returns public.mentor_profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.mentor_profiles;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_is_active is null then raise exception 'Account status is required' using errcode = '22023'; end if;

  select mp.* into v_row
  from public.mentor_profiles mp
  join public.profiles p on p.id = mp.user_id
  where mp.user_id = p_mentor_id and p.role = 'mentor'::public.app_role
  for update of mp;
  if not found then raise exception 'Mentor account not found' using errcode = '22023'; end if;

  update public.mentor_profiles
  set is_active = p_is_active
  where user_id = p_mentor_id
  returning * into v_row;
  return v_row;
end;
$$;

create function public.save_mentor_availability(
  p_mentor_id uuid,
  p_week_start_date date,
  p_rules jsonb
)
returns setof public.mentor_availability_rules
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_timezone text;
  v_is_active boolean;
  v_current_week date;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select mp.timezone, mp.is_active into v_timezone, v_is_active
  from public.mentor_profiles mp
  join public.profiles p on p.id = mp.user_id
  where mp.user_id = p_mentor_id and p.role = 'mentor'::public.app_role;
  if not found then raise exception 'Mentor account not found' using errcode = '22023'; end if;

  if not public.is_admin() and (v_uid is distinct from p_mentor_id or not v_is_active) then
    raise exception 'Mentor availability access denied' using errcode = '42501';
  end if;

  v_current_week := date_trunc('week', current_timestamp at time zone v_timezone)::date;
  if p_week_start_date is null or p_week_start_date not in (v_current_week, v_current_week + 7) then
    raise exception 'Availability can only be configured for the current or next week' using errcode = '22023';
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

  delete from public.mentor_availability_rules
  where mentor_id = p_mentor_id and week_start_date = p_week_start_date;

  insert into public.mentor_availability_rules(
    mentor_id,
    week_start_date,
    day_of_week,
    start_time,
    end_time
  )
  select
    p_mentor_id,
    p_week_start_date,
    (r->>'day_of_week')::smallint,
    (r->>'start_time')::time,
    (r->>'end_time')::time
  from jsonb_array_elements(p_rules) r;

  return query
    select a.* from public.mentor_availability_rules a
    where a.mentor_id = p_mentor_id and a.week_start_date = p_week_start_date
    order by a.day_of_week, a.start_time, a.id;
end;
$$;

-- Backward-compatible wrapper: old callers now replace only the current week.
create or replace function public.save_mentor_availability(p_mentor_id uuid, p_rules jsonb)
returns setof public.mentor_availability_rules
language plpgsql security definer set search_path = '' as $$
declare
  v_timezone text;
  v_current_week date;
begin
  select mp.timezone into v_timezone
  from public.mentor_profiles mp
  join public.profiles p on p.id = mp.user_id
  where mp.user_id = p_mentor_id and p.role = 'mentor'::public.app_role;
  if not found then raise exception 'Mentor account not found' using errcode = '22023'; end if;
  v_current_week := date_trunc('week', current_timestamp at time zone v_timezone)::date;
  return query select * from public.save_mentor_availability(p_mentor_id, v_current_week, p_rules);
end;
$$;

create function public.delete_mentor_account(p_mentor_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;

  select u.email into v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_mentor_id and p.role = 'mentor'::public.app_role;
  if not found then raise exception 'Mentor account not found' using errcode = '22023'; end if;

  delete from public.mentor_invites
  where user_id = p_mentor_id
    or email = lower(btrim(coalesce(v_email, '')));

  delete from auth.users where id = p_mentor_id;
  if not found then raise exception 'Mentor account not found' using errcode = '22023'; end if;
end;
$$;

revoke all on function public.list_managed_mentors(integer, text, uuid, text, text),
  public.set_mentor_active(uuid, boolean),
  public.save_mentor_availability(uuid, date, jsonb),
  public.delete_mentor_account(uuid)
  from public, anon, authenticated;

grant execute on function public.list_managed_mentors(integer, text, uuid, text, text),
  public.set_mentor_active(uuid, boolean),
  public.save_mentor_availability(uuid, date, jsonb),
  public.delete_mentor_account(uuid)
  to authenticated;

grant execute on function public.list_managed_mentors(integer, text, uuid, text, text),
  public.set_mentor_active(uuid, boolean),
  public.save_mentor_availability(uuid, date, jsonb),
  public.delete_mentor_account(uuid)
  to service_role;

comment on column public.mentor_profiles.is_active is
  'Administrator-controlled mentor account lifecycle. Independent from setup completion.';
comment on column public.mentor_availability_rules.week_start_date is
  'Monday date for the concrete availability week. Mentor UI supports only current and next week.';
