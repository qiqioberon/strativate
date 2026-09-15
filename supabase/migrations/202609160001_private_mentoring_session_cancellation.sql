-- Private Mentoring scheduled-session cancellation with Google Calendar reconciliation.
-- Strativate remains canonical: external Calendar failures never reactivate a cancelled session.

alter table public.private_mentoring_sessions
  drop constraint if exists private_mentoring_sessions_status_check;

alter table public.private_mentoring_sessions
  add constraint private_mentoring_sessions_status_check
  check (status in ('awaiting_focus', 'awaiting_scheduling', 'scheduled', 'completed', 'cancelled'));

-- Replace the original unnamed scheduling-fields check without depending on PostgreSQL's generated constraint suffix.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.private_mentoring_sessions'::regclass
      and c.contype = 'c'
      and lower(pg_get_constraintdef(c.oid)) like '%mentor_id is not null%'
      and lower(pg_get_constraintdef(c.oid)) like '%scheduled_start_at is not null%'
      and lower(pg_get_constraintdef(c.oid)) like '%session_focus_id is not null%'
      and lower(pg_get_constraintdef(c.oid)) like '%status%'
  loop
    execute format('alter table public.private_mentoring_sessions drop constraint %I', v_constraint.conname);
  end loop;
end;
$$;

alter table public.private_mentoring_sessions
  add constraint private_mentoring_sessions_scheduling_fields_check
  check (
    (status in ('scheduled', 'completed', 'cancelled'))
    = (mentor_id is not null and scheduled_start_at is not null and session_focus_id is not null)
  );

alter table public.private_mentoring_session_calendar_integrations
  drop constraint if exists private_mentoring_session_calendar_integrations_sync_status_check;

alter table public.private_mentoring_session_calendar_integrations
  add constraint private_mentoring_session_calendar_integrations_sync_status_check
  check (sync_status in ('pending', 'synced', 'failed', 'cancelled'));

create function public.admin_cancel_private_mentoring_session(p_session_id uuid)
returns public.private_mentoring_sessions
language plpgsql security definer set search_path = '' as $$
declare
  v_session public.private_mentoring_sessions;
begin
  if not public.is_admin() then
    raise exception 'Admin required' using errcode = '42501';
  end if;

  select * into v_session
  from public.private_mentoring_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Private Mentoring session not found' using errcode = '22023';
  end if;

  if v_session.status = 'cancelled' then
    return v_session;
  end if;

  if v_session.status = 'completed' then
    raise exception 'Completed sessions cannot be cancelled' using errcode = '22023';
  end if;

  if v_session.status <> 'scheduled' then
    raise exception 'Only a scheduled session can be cancelled' using errcode = '22023';
  end if;

  update public.private_mentoring_sessions
  set status = 'cancelled'
  where id = p_session_id
  returning * into v_session;

  insert into public.private_mentoring_session_calendar_integrations(session_id, organizer_user_id, sync_status, sync_error)
  values (p_session_id, auth.uid(), 'pending', null)
  on conflict (session_id) do update
    set sync_status = 'pending',
        sync_error = null,
        organizer_user_id = coalesce(public.private_mentoring_session_calendar_integrations.organizer_user_id, excluded.organizer_user_id);

  return v_session;
end;
$$;

revoke all on function public.admin_cancel_private_mentoring_session(uuid) from public, anon;
grant execute on function public.admin_cancel_private_mentoring_session(uuid) to authenticated, service_role;

-- Cancelled sessions remain visible in history, but their effective meeting link is no longer active.
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
    mentor_profile.timezone, pkg.duration_minutes,
    case when s.status = 'cancelled' then null else coalesce(ci.manual_meeting_url, ci.provider_meeting_url) end,
    ci.google_event_id, ci.google_ical_uid, coalesce(ci.sync_status, 'pending')
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
    case when s.status = 'cancelled' then null else coalesce(ci.manual_meeting_url, ci.provider_meeting_url) end,
    ci.google_event_id, ci.google_ical_uid, coalesce(ci.sync_status, 'pending')
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
  where s.status <> 'cancelled'
    and s.scheduled_start_at is not null
    and (p_from is null or s.scheduled_end_at > p_from)
    and (p_to is null or s.scheduled_start_at < p_to)
  order by s.scheduled_start_at, s.id;
end;
$$;

-- Recreate the admin detail projection so failed Google cancellation remains retryable after refresh.
drop function if exists public.get_admin_private_mentoring_enrollment_sessions(uuid);
create function public.get_admin_private_mentoring_enrollment_sessions(p_enrollment_id uuid)
returns table (
  session_id uuid,
  enrollment_id uuid,
  session_number integer,
  status text,
  session_focus_id uuid,
  focus_name text,
  mentor_id uuid,
  mentor_name text,
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  mentor_tier_id uuid,
  mentor_tier_code text,
  mentor_tier_name text,
  purchased_sessions integer,
  google_sync_status text,
  google_sync_error text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  return query
    select s.id, e.id, s.session_number, s.status::text, s.session_focus_id, f.name::text,
      s.mentor_id, nullif(btrim(concat_ws(' ', mp.first_name, mp.last_name)), '')::text,
      s.scheduled_start_at, s.scheduled_end_at, tier.id, tier.code::text, tier.name::text, e.purchased_sessions,
      coalesce(ci.sync_status, 'pending')::text, ci.sync_error::text
    from public.private_mentoring_enrollments e
    join public.private_mentoring_sessions s on s.enrollment_id = e.id
    join public.private_mentoring_packages pkg on pkg.id = e.package_id
    join public.mentor_tiers tier on tier.id = pkg.mentor_tier_id
    left join public.private_mentoring_session_focuses f on f.id = s.session_focus_id
    left join public.profiles mp on mp.id = s.mentor_id
    left join public.private_mentoring_session_calendar_integrations ci on ci.session_id = s.id
    where e.id = p_enrollment_id
    order by s.session_number;
end;
$$;
revoke all on function public.get_admin_private_mentoring_enrollment_sessions(uuid) from public, anon;
grant execute on function public.get_admin_private_mentoring_enrollment_sessions(uuid) to authenticated, service_role;

comment on function public.admin_cancel_private_mentoring_session(uuid) is 'Idempotently transitions a scheduled Private Mentoring session to cancelled. External Google reconciliation is performed server-side after this canonical transaction commits.';
