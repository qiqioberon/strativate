-- Fix managed mentor RPC row typing and add an exact filtered count for numbered pagination.
-- auth.users.email is varchar in the auth schema while the public RPC contract exposes text.

create or replace function public.list_managed_mentors(
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
    select p.id, coalesce(u.email::text, ''), p.first_name, p.last_name, p.username,
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
      and (v_query = '' or concat_ws(' ', p.first_name, p.last_name, p.username, u.email::text) ilike '%' || v_query || '%')
    order by p.created_at desc, p.id
    limit 25 offset p_offset;
end;
$$;

create or replace function public.list_managed_mentors(
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
      coalesce(u.email::text, ''),
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
      and (v_query = '' or concat_ws(' ', p.first_name, p.last_name, p.username, u.email::text) ilike '%' || v_query || '%')
    order by p.created_at desc, p.id
    limit 25 offset p_offset;
end;
$$;

drop function if exists public.count_managed_mentors(text, uuid, text, text);
create function public.count_managed_mentors(
  p_query text,
  p_tier_id uuid,
  p_account_status text,
  p_setup_status text
)
returns bigint
language plpgsql stable security definer set search_path = '' as $$
declare
  v_query text := btrim(coalesce(p_query, ''));
  v_count bigint;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_account_status is null or p_account_status not in ('all', 'active', 'inactive') then
    raise exception 'Invalid account status' using errcode = '22023';
  end if;
  if p_setup_status is null or p_setup_status not in ('all', 'complete', 'pending') then
    raise exception 'Invalid setup status' using errcode = '22023';
  end if;

  select count(*) into v_count
  from public.profiles p
  join public.mentor_profiles mp on mp.user_id = p.id
  join auth.users u on u.id = p.id
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
    and (v_query = '' or concat_ws(' ', p.first_name, p.last_name, p.username, u.email::text) ilike '%' || v_query || '%');

  return v_count;
end;
$$;

revoke all on function public.count_managed_mentors(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.count_managed_mentors(text, uuid, text, text) to authenticated, service_role;
