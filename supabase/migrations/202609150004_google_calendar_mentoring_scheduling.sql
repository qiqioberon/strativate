-- Google Calendar + Google Meet integration for Private Mentoring scheduling.
-- Strativate remains the source of truth for entitlement, mentor assignment, focus, schedule and status.
-- OAuth credentials and private Google event details remain server-only.

create table public.google_calendar_connections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  account_email text not null check (account_email = lower(btrim(account_email)) and char_length(account_email) between 3 and 320),
  calendar_id text not null default 'primary' check (char_length(btrim(calendar_id)) between 1 and 1024),
  granted_scopes text[] not null default '{}',
  encrypted_refresh_token text,
  status text not null default 'connected' check (status in ('connected','invalid','disconnected')),
  connected_at timestamptz not null default now(),
  refreshed_at timestamptz,
  revoked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'connected') = (encrypted_refresh_token is not null))
);

create table public.google_calendar_oauth_states (
  state_hash text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  code_verifier text not null check (char_length(code_verifier) between 43 and 128),
  return_path text not null default '/',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index google_calendar_oauth_states_expiry_idx on public.google_calendar_oauth_states(expires_at);

create table public.private_mentoring_session_calendar_integrations (
  session_id uuid primary key references public.private_mentoring_sessions(id) on delete cascade,
  organizer_user_id uuid references public.profiles(id) on delete set null,
  google_calendar_id text not null default 'primary',
  google_event_id text,
  google_ical_uid text,
  provider_meeting_url text,
  manual_meeting_url text,
  sync_status text not null default 'pending' check (sync_status in ('pending','synced','failed')),
  sync_error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (manual_meeting_url is null or manual_meeting_url ~ '^https://'),
  check (provider_meeting_url is null or provider_meeting_url ~ '^https://')
);

create trigger google_calendar_connections_touch_updated_at before update on public.google_calendar_connections for each row execute function public.touch_updated_at();
create trigger private_mentoring_session_calendar_integrations_touch_updated_at before update on public.private_mentoring_session_calendar_integrations for each row execute function public.touch_updated_at();

alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_oauth_states enable row level security;
alter table public.private_mentoring_session_calendar_integrations enable row level security;

-- Raw credential/integration tables deliberately have no authenticated policies or grants.
-- Clients receive only sanitized data through dedicated SECURITY DEFINER RPCs / server routes.
revoke all on table public.google_calendar_connections from public, anon, authenticated;
revoke all on table public.google_calendar_oauth_states from public, anon, authenticated;
revoke all on table public.private_mentoring_session_calendar_integrations from public, anon, authenticated;
grant all on table public.google_calendar_connections to service_role;
grant all on table public.google_calendar_oauth_states to service_role;
grant all on table public.private_mentoring_session_calendar_integrations to service_role;

-- One mentor cannot own overlapping scheduled sessions. [) keeps touching boundaries valid.
alter table public.private_mentoring_sessions
  add constraint private_mentoring_sessions_no_mentor_overlap
  exclude using gist (
    mentor_id extensions.gist_uuid_ops with =,
    tstzrange(scheduled_start_at, scheduled_end_at, '[)') with &&
  )
  where (mentor_id is not null and scheduled_start_at is not null and scheduled_end_at is not null and status in ('scheduled','completed'));

create or replace function public.get_my_google_calendar_connection()
returns table(account_email text, calendar_id text, granted_scopes text[], status text, connected_at timestamptz, refreshed_at timestamptz, revoked_at timestamptz, last_error text)
language sql stable security definer set search_path = '' as $$
  select c.account_email, c.calendar_id, c.granted_scopes, c.status, c.connected_at, c.refreshed_at, c.revoked_at, c.last_error
  from public.google_calendar_connections c
  where c.user_id = auth.uid();
$$;

-- Replaces the legacy schedule RPC in-place so all existing callers inherit stronger DB validation.
create or replace function public.admin_schedule_private_mentoring_session(
  p_session_id uuid,
  p_mentor_id uuid,
  p_scheduled_start_at timestamptz
)
returns public.private_mentoring_sessions
language plpgsql security definer set search_path = '' as $$
declare
  v_session public.private_mentoring_sessions;
  v_required_tier uuid;
  v_duration integer;
  v_mentor_tier uuid;
  v_mentor_active boolean;
  v_timezone text;
  v_end timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
  v_local_date date;
  v_week_start date;
  v_day smallint;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_scheduled_start_at is null then raise exception 'Schedule is required' using errcode = '22023'; end if;
  if p_scheduled_start_at <= now() then raise exception 'Schedule must be in the future' using errcode = '22023'; end if;

  select s.* into v_session
  from public.private_mentoring_sessions s
  where s.id = p_session_id
  for update;
  if not found then raise exception 'Private Mentoring session not found' using errcode = '22023'; end if;

  select p.mentor_tier_id, p.duration_minutes into v_required_tier, v_duration
  from public.private_mentoring_enrollments e
  join public.private_mentoring_packages p on p.id = e.package_id
  where e.id = v_session.enrollment_id;
  if not found then raise exception 'Private Mentoring package entitlement is missing' using errcode = '23503'; end if;
  if v_session.session_focus_id is null or v_session.status not in ('awaiting_scheduling','scheduled') then
    raise exception 'Session must have a focus and be schedulable' using errcode = '22023';
  end if;

  select mp.tier_id, mp.is_active, mp.timezone into v_mentor_tier, v_mentor_active, v_timezone
  from public.mentor_profiles mp
  join public.profiles p on p.id = mp.user_id and p.role = 'mentor'::public.app_role
  where mp.user_id = p_mentor_id;
  if not found or not v_mentor_active then raise exception 'Active mentor required' using errcode = '22023'; end if;
  if v_mentor_tier is distinct from v_required_tier then raise exception 'Mentor tier does not match purchased package' using errcode = '22023'; end if;

  v_end := p_scheduled_start_at + make_interval(mins => v_duration);
  v_local_start := p_scheduled_start_at at time zone v_timezone;
  v_local_end := v_end at time zone v_timezone;
  v_local_date := v_local_start::date;
  v_week_start := date_trunc('week', v_local_start)::date;
  v_day := extract(isodow from v_local_start)::smallint;

  if v_local_end::date <> v_local_date or not exists (
    select 1 from public.mentor_availability_rules a
    where a.mentor_id = p_mentor_id
      and a.week_start_date = v_week_start
      and a.day_of_week = v_day
      and a.start_time <= v_local_start::time
      and a.end_time >= v_local_end::time
  ) then
    raise exception 'Selected slot is outside declared mentor availability' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.private_mentoring_sessions other
    where other.id <> p_session_id
      and other.mentor_id = p_mentor_id
      and other.status in ('scheduled','completed')
      and tstzrange(other.scheduled_start_at, other.scheduled_end_at, '[)') && tstzrange(p_scheduled_start_at, v_end, '[)')
  ) then
    raise exception 'Selected slot conflicts with another Strativate session' using errcode = '23P01';
  end if;

  begin
    update public.private_mentoring_sessions
    set mentor_id = p_mentor_id,
        scheduled_start_at = p_scheduled_start_at,
        scheduled_end_at = v_end,
        status = 'scheduled'
    where id = p_session_id
    returning * into v_session;
  exception when exclusion_violation then
    raise exception 'Selected slot was just booked by another session' using errcode = '23P01';
  end;

  insert into public.private_mentoring_session_calendar_integrations(session_id, organizer_user_id, sync_status, sync_error)
  values (p_session_id, auth.uid(), 'pending', null)
  on conflict (session_id) do update
    set sync_status = 'pending', sync_error = null,
        organizer_user_id = coalesce(public.private_mentoring_session_calendar_integrations.organizer_user_id, excluded.organizer_user_id);

  return v_session;
end;
$$;

create or replace function public.list_my_private_mentoring_sessions_v2()
returns table (
  session_id uuid, enrollment_id uuid, session_number integer, status text,
  session_focus_id uuid, focus_name text, mentor_id uuid, mentor_name text,
  scheduled_start_at timestamptz, scheduled_end_at timestamptz,
  mentor_tier_code text, mentor_tier_name text, package_id uuid, purchased_sessions integer,
  mentor_timezone text, duration_minutes integer, meeting_url text, google_event_id text, google_ical_uid text, google_sync_status text
)
language sql stable security definer set search_path = '' as $$
  select s.id, e.id, s.session_number, s.status, s.session_focus_id, f.name,
    s.mentor_id, nullif(btrim(concat_ws(' ', mp.first_name, mp.last_name)), ''),
    s.scheduled_start_at, s.scheduled_end_at, t.code, t.name, e.package_id, e.purchased_sessions,
    mentor_profile.timezone, pkg.duration_minutes, coalesce(ci.manual_meeting_url, ci.provider_meeting_url), ci.google_event_id, ci.google_ical_uid, coalesce(ci.sync_status, 'pending')
  from public.private_mentoring_sessions s
  join public.private_mentoring_enrollments e on e.id = s.enrollment_id
  join public.private_mentoring_packages pkg on pkg.id = e.package_id
  join public.mentor_tiers t on t.id = pkg.mentor_tier_id
  left join public.private_mentoring_session_focuses f on f.id = s.session_focus_id
  left join public.profiles mp on mp.id = s.mentor_id
  left join public.mentor_profiles mentor_profile on mentor_profile.user_id = s.mentor_id
  left join public.private_mentoring_session_calendar_integrations ci on ci.session_id = s.id
  where e.mentee_id = auth.uid()
  order by e.created_at desc, s.session_number;
$$;

create or replace function public.list_my_mentor_private_mentoring_sessions()
returns table (
  session_id uuid, enrollment_id uuid, mentee_id uuid, mentee_name text, mentee_email text,
  session_number integer, purchased_sessions integer, status text, focus_name text,
  scheduled_start_at timestamptz, scheduled_end_at timestamptz, mentor_timezone text, duration_minutes integer,
  meeting_url text, google_event_id text, google_ical_uid text, google_sync_status text
)
language sql stable security definer set search_path = '' as $$
  select s.id, e.id, e.mentee_id,
    nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), coalesce(u.email, '')::text,
    s.session_number, e.purchased_sessions, s.status, f.name,
    s.scheduled_start_at, s.scheduled_end_at, mentor_profile.timezone, pkg.duration_minutes,
    coalesce(ci.manual_meeting_url, ci.provider_meeting_url), ci.google_event_id, ci.google_ical_uid, coalesce(ci.sync_status, 'pending')
  from public.private_mentoring_sessions s
  join public.private_mentoring_enrollments e on e.id = s.enrollment_id
  join public.private_mentoring_packages pkg on pkg.id = e.package_id
  join public.profiles p on p.id = e.mentee_id
  join auth.users u on u.id = e.mentee_id
  join public.mentor_profiles mentor_profile on mentor_profile.user_id = s.mentor_id
  left join public.private_mentoring_session_focuses f on f.id = s.session_focus_id
  left join public.private_mentoring_session_calendar_integrations ci on ci.session_id = s.id
  where s.mentor_id = auth.uid()
  order by s.scheduled_start_at nulls last, s.session_number;
$$;

create or replace function public.list_admin_private_mentoring_calendar_sessions(p_from timestamptz, p_to timestamptz)
returns table (
  session_id uuid, enrollment_id uuid, mentee_id uuid, mentee_name text, mentee_email text,
  mentor_id uuid, mentor_name text, mentor_tier_name text, session_number integer, purchased_sessions integer,
  status text, focus_name text, scheduled_start_at timestamptz, scheduled_end_at timestamptz, mentor_timezone text, duration_minutes integer,
  meeting_url text, provider_meeting_url text, manual_meeting_url text,
  google_event_id text, google_ical_uid text, google_sync_status text, google_sync_error text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  return query
  select s.id, e.id, e.mentee_id, nullif(btrim(concat_ws(' ', mentee.first_name, mentee.last_name)), ''), coalesce(mu.email, '')::text,
    s.mentor_id, nullif(btrim(concat_ws(' ', mentor.first_name, mentor.last_name)), ''), tier.name,
    s.session_number, e.purchased_sessions, s.status, f.name, s.scheduled_start_at, s.scheduled_end_at, mentor_profile.timezone, pkg.duration_minutes,
    coalesce(ci.manual_meeting_url, ci.provider_meeting_url), ci.provider_meeting_url, ci.manual_meeting_url,
    ci.google_event_id, ci.google_ical_uid, coalesce(ci.sync_status, 'pending'), ci.sync_error
  from public.private_mentoring_sessions s
  join public.private_mentoring_enrollments e on e.id = s.enrollment_id
  join public.private_mentoring_packages pkg on pkg.id = e.package_id
  join public.mentor_tiers tier on tier.id = pkg.mentor_tier_id
  join public.profiles mentee on mentee.id = e.mentee_id
  join auth.users mu on mu.id = e.mentee_id
  left join public.profiles mentor on mentor.id = s.mentor_id
  left join public.mentor_profiles mentor_profile on mentor_profile.user_id = s.mentor_id
  left join public.private_mentoring_session_focuses f on f.id = s.session_focus_id
  left join public.private_mentoring_session_calendar_integrations ci on ci.session_id = s.id
  where s.scheduled_start_at is not null
    and (p_from is null or s.scheduled_end_at > p_from)
    and (p_to is null or s.scheduled_start_at < p_to)
  order by s.scheduled_start_at, s.id;
end;
$$;

-- Sanitized operational context. It includes only declared availability and Strativate busy ranges;
-- private Google Calendar titles/descriptions/attendees never enter this database projection.
create or replace function public.admin_get_private_mentoring_slot_context(p_session_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  select jsonb_build_object(
    'sessionId', s.id,
    'status', s.status,
    'focusName', f.name,
    'requiredTierId', pkg.mentor_tier_id,
    'durationMinutes', pkg.duration_minutes,
    'menteeId', e.mentee_id,
    'purchasedSessions', e.purchased_sessions,
    'sessionNumber', s.session_number,
    'mentors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'mentorId', mp.user_id,
        'mentorName', coalesce(nullif(btrim(concat_ws(' ', pp.first_name, pp.last_name)), ''), au.email),
        'tierId', mp.tier_id,
        'active', mp.is_active,
        'timezone', mp.timezone,
        'availability', coalesce((select jsonb_agg(jsonb_build_object(
          'start', (((a.week_start_date + (a.day_of_week - 1))::date + a.start_time) at time zone mp.timezone),
          'end', (((a.week_start_date + (a.day_of_week - 1))::date + a.end_time) at time zone mp.timezone)
        ) order by a.week_start_date, a.day_of_week, a.start_time) from public.mentor_availability_rules a where a.mentor_id = mp.user_id and a.week_start_date in (date_trunc('week', current_timestamp at time zone mp.timezone)::date, date_trunc('week', current_timestamp at time zone mp.timezone)::date + 7)), '[]'::jsonb),
        'strativate_busy', coalesce((select jsonb_agg(jsonb_build_object('start', other.scheduled_start_at, 'end', other.scheduled_end_at) order by other.scheduled_start_at)
          from public.private_mentoring_sessions other where other.mentor_id = mp.user_id and other.id <> s.id and other.status in ('scheduled','completed') and other.scheduled_start_at is not null), '[]'::jsonb)
      ) order by coalesce(pp.first_name,''), coalesce(pp.last_name,''), mp.user_id)
      from public.mentor_profiles mp
      join public.profiles pp on pp.id = mp.user_id and pp.role = 'mentor'::public.app_role
      join auth.users au on au.id = mp.user_id
      where mp.tier_id = pkg.mentor_tier_id and mp.is_active
    ), '[]'::jsonb)
  ) into v_result
  from public.private_mentoring_sessions s
  join public.private_mentoring_enrollments e on e.id = s.enrollment_id
  join public.private_mentoring_packages pkg on pkg.id = e.package_id
  left join public.private_mentoring_session_focuses f on f.id = s.session_focus_id
  where s.id = p_session_id;
  if v_result is null then raise exception 'Private Mentoring session not found' using errcode='22023'; end if;
  return v_result;
end;
$$;

revoke all on function public.get_my_google_calendar_connection(),
  public.list_my_private_mentoring_sessions_v2(),
  public.list_my_mentor_private_mentoring_sessions(),
  public.list_admin_private_mentoring_calendar_sessions(timestamptz,timestamptz),
  public.admin_get_private_mentoring_slot_context(uuid)
from public, anon, authenticated;

grant execute on function public.get_my_google_calendar_connection(),
  public.list_my_private_mentoring_sessions_v2(),
  public.list_my_mentor_private_mentoring_sessions(),
  public.list_admin_private_mentoring_calendar_sessions(timestamptz,timestamptz),
  public.admin_get_private_mentoring_slot_context(uuid)
to authenticated;

grant execute on function public.get_my_google_calendar_connection(),
  public.list_my_private_mentoring_sessions_v2(),
  public.list_my_mentor_private_mentoring_sessions(),
  public.list_admin_private_mentoring_calendar_sessions(timestamptz,timestamptz),
  public.admin_get_private_mentoring_slot_context(uuid)
to service_role;


create or replace function public.service_get_private_mentoring_sync_context(p_session_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  select jsonb_build_object(
    'sessionId', s.id,
    'sessionNumber', s.session_number,
    'purchasedSessions', e.purchased_sessions,
    'status', s.status,
    'focusName', f.name,
    'start', s.scheduled_start_at,
    'end', s.scheduled_end_at,
    'menteeEmail', mentee_user.email,
    'mentorEmail', mentor_user.email,
    'organizerUserId', ci.organizer_user_id,
    'calendarId', coalesce(ci.google_calendar_id, 'primary'),
    'eventId', ci.google_event_id,
    'iCalUID', ci.google_ical_uid,
    'providerMeetingUrl', ci.provider_meeting_url,
    'manualMeetingUrl', ci.manual_meeting_url
  ) into v_result
  from public.private_mentoring_sessions s
  join public.private_mentoring_enrollments e on e.id=s.enrollment_id
  join auth.users mentee_user on mentee_user.id=e.mentee_id
  left join auth.users mentor_user on mentor_user.id=s.mentor_id
  left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id
  left join public.private_mentoring_session_calendar_integrations ci on ci.session_id=s.id
  where s.id=p_session_id;
  if v_result is null then raise exception 'Private Mentoring session not found' using errcode='22023'; end if;
  return v_result;
end;
$$;

revoke all on function public.service_get_private_mentoring_sync_context(uuid) from public, anon, authenticated;
grant execute on function public.service_get_private_mentoring_sync_context(uuid) to service_role;

comment on table public.google_calendar_connections is 'Server-only encrypted Google Calendar OAuth connection metadata. Raw refresh tokens are never exposed through user-facing RPCs.';
comment on table public.private_mentoring_session_calendar_integrations is 'External Calendar/Meet identity and sync state for the canonical Strativate Private Mentoring session.';
