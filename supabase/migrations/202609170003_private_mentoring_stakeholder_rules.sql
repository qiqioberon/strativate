-- 17 Sep 2026 stakeholder rules for Private Mentoring + Intensive Mentoring commerce.
-- Forward-only migration: historical order snapshots remain immutable and existing enrollments remain auditable.

alter table public.private_mentoring_enrollments
  add column if not exists primary_mentor_id uuid references public.mentor_profiles(user_id);
create index if not exists private_mentoring_enrollments_primary_mentor_idx
  on public.private_mentoring_enrollments(primary_mentor_id) where primary_mentor_id is not null;

alter table public.private_mentoring_sessions
  add column if not exists requested_focus_id uuid references public.private_mentoring_session_focuses(id),
  add column if not exists mentee_topic_request text,
  add column if not exists topic_status text not null default 'needs_input',
  add column if not exists resolved_topic text,
  add column if not exists mentor_scope_notes text,
  add column if not exists topic_updated_at timestamptz;

alter table public.private_mentoring_sessions
  drop constraint if exists private_mentoring_sessions_topic_status_check;
alter table public.private_mentoring_sessions
  add constraint private_mentoring_sessions_topic_status_check
  check (topic_status in ('needs_input','pending_review','confirmed'));

update public.private_mentoring_sessions s
set topic_status='confirmed',
    resolved_topic=coalesce(s.resolved_topic, f.name),
    requested_focus_id=coalesce(s.requested_focus_id, s.session_focus_id),
    topic_updated_at=coalesce(s.topic_updated_at, s.updated_at)
from public.private_mentoring_session_focuses f
where f.id=s.session_focus_id and s.session_focus_id is not null;

create table if not exists public.private_mentoring_session_topic_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.private_mentoring_sessions(id) on delete cascade,
  event_type text not null check (event_type in ('mentee_request','admin_resolution')),
  requested_focus_id uuid references public.private_mentoring_session_focuses(id),
  mentee_topic_request text,
  resolved_focus_id uuid references public.private_mentoring_session_focuses(id),
  resolved_topic text,
  mentor_scope_notes text,
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (mentee_topic_request is null or char_length(btrim(mentee_topic_request)) between 5 and 3000),
  check (resolved_topic is null or char_length(btrim(resolved_topic)) between 3 and 3000)
);
create index if not exists private_mentoring_topic_events_session_idx
  on public.private_mentoring_session_topic_events(session_id, created_at, id);

create table if not exists public.private_mentoring_primary_mentor_changes (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.private_mentoring_enrollments(id) on delete cascade,
  previous_mentor_id uuid references public.mentor_profiles(user_id),
  new_mentor_id uuid not null references public.mentor_profiles(user_id),
  changed_by uuid references public.profiles(id),
  reason text,
  changed_at timestamptz not null default now(),
  check (reason is null or char_length(btrim(reason)) between 3 and 1000)
);
create index if not exists private_mentoring_primary_mentor_changes_enrollment_idx
  on public.private_mentoring_primary_mentor_changes(enrollment_id, changed_at, id);

-- Safe legacy backfill: only infer a primary mentor when every assigned session agrees.
with single_mentor as (
  select s.enrollment_id, min(s.mentor_id::text)::uuid as mentor_id
  from public.private_mentoring_sessions s
  where s.mentor_id is not null
  group by s.enrollment_id
  having count(distinct s.mentor_id)=1
)
update public.private_mentoring_enrollments e
set primary_mentor_id=single_mentor.mentor_id
from single_mentor
where e.id=single_mentor.enrollment_id
  and e.purchased_sessions >= 5
  and e.primary_mentor_id is null;

insert into public.private_mentoring_primary_mentor_changes(enrollment_id, previous_mentor_id, new_mentor_id, changed_by, reason)
select e.id, null, e.primary_mentor_id, null, 'Legacy single-mentor backfill'
from public.private_mentoring_enrollments e
where e.purchased_sessions >= 5
  and e.primary_mentor_id is not null
  and not exists (select 1 from public.private_mentoring_primary_mentor_changes c where c.enrollment_id=e.id);

alter table public.private_mentoring_session_topic_events enable row level security;
alter table public.private_mentoring_primary_mentor_changes enable row level security;
revoke all on public.private_mentoring_session_topic_events, public.private_mentoring_primary_mentor_changes from public, anon, authenticated;
grant all on public.private_mentoring_session_topic_events, public.private_mentoring_primary_mentor_changes to service_role;

create policy private_topic_events_admin_read on public.private_mentoring_session_topic_events
for select to authenticated using (public.is_admin());
create policy private_primary_mentor_changes_admin_read on public.private_mentoring_primary_mentor_changes
for select to authenticated using (public.is_admin());
grant select on public.private_mentoring_session_topic_events, public.private_mentoring_primary_mentor_changes to authenticated;

create or replace function public.private_mentoring_topic_immutability_guard()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.status in ('completed','cancelled') and (
    new.requested_focus_id is distinct from old.requested_focus_id or
    new.mentee_topic_request is distinct from old.mentee_topic_request or
    new.topic_status is distinct from old.topic_status or
    new.session_focus_id is distinct from old.session_focus_id or
    new.resolved_topic is distinct from old.resolved_topic or
    new.mentor_scope_notes is distinct from old.mentor_scope_notes
  ) then
    raise exception 'Completed and cancelled session topics are immutable' using errcode='22023';
  end if;
  return new;
end;
$$;
drop trigger if exists private_mentoring_topic_immutability_guard on public.private_mentoring_sessions;
create trigger private_mentoring_topic_immutability_guard
before update on public.private_mentoring_sessions
for each row execute function public.private_mentoring_topic_immutability_guard();

create or replace function public.submit_private_mentoring_topic_request(
  p_session_id uuid,
  p_requested_focus_id uuid default null,
  p_topic_request text default null
)
returns public.private_mentoring_sessions
language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid := public.current_completed_mentee_id();
  v_session public.private_mentoring_sessions;
  v_topic text := nullif(btrim(coalesce(p_topic_request,'')), '');
begin
  if v_topic is null or char_length(v_topic) < 5 or char_length(v_topic) > 3000 then
    raise exception 'Tell us what you want to discuss (5-3000 characters)' using errcode='22023';
  end if;
  if p_requested_focus_id is not null and not exists (
    select 1 from public.private_mentoring_session_focuses f where f.id=p_requested_focus_id and f.is_active
  ) then raise exception 'Active optional Session Focus required' using errcode='22023'; end if;

  select s.* into v_session
  from public.private_mentoring_sessions s
  join public.private_mentoring_enrollments e on e.id=s.enrollment_id
  where s.id=p_session_id and e.mentee_id=v_uid
  for update of s;
  if not found then raise exception 'Private Mentoring session not found' using errcode='42501'; end if;
  if v_session.status in ('completed','cancelled') then raise exception 'Session topic is locked' using errcode='22023'; end if;
  if v_session.status='scheduled' and v_session.scheduled_start_at <= now() then
    raise exception 'Only an upcoming scheduled session can change topic' using errcode='22023';
  end if;

  update public.private_mentoring_sessions
  set requested_focus_id=p_requested_focus_id,
      mentee_topic_request=v_topic,
      topic_status='pending_review',
      topic_updated_at=now()
  where id=p_session_id
  returning * into v_session;

  insert into public.private_mentoring_session_topic_events(
    session_id,event_type,requested_focus_id,mentee_topic_request,actor_id
  ) values (p_session_id,'mentee_request',p_requested_focus_id,v_topic,v_uid);

  return v_session;
end;
$$;

-- Backward-compatible name now submits a request; it no longer auto-approves the taxonomy choice.
create or replace function public.set_private_mentoring_session_focus(p_session_id uuid, p_focus_id uuid)
returns public.private_mentoring_sessions
language plpgsql security definer set search_path='' as $$
declare v_name text;
begin
  select name into v_name from public.private_mentoring_session_focuses where id=p_focus_id and is_active;
  if v_name is null then raise exception 'Active Session Focus required' using errcode='22023'; end if;
  return public.submit_private_mentoring_topic_request(p_session_id,p_focus_id,'Saya ingin membahas: ' || v_name || '.');
end;
$$;

create or replace function public.admin_resolve_private_mentoring_session_topic(
  p_session_id uuid,
  p_focus_id uuid,
  p_resolved_topic text,
  p_mentor_scope_notes text default null
)
returns public.private_mentoring_sessions
language plpgsql security definer set search_path='' as $$
declare
  v_session public.private_mentoring_sessions;
  v_topic text := nullif(btrim(coalesce(p_resolved_topic,'')), '');
  v_notes text := nullif(btrim(coalesce(p_mentor_scope_notes,'')), '');
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if v_topic is null or char_length(v_topic) < 3 or char_length(v_topic) > 3000 then
    raise exception 'Resolved topic is required' using errcode='22023';
  end if;
  if v_notes is not null and char_length(v_notes) > 3000 then raise exception 'Mentor notes are too long' using errcode='22023'; end if;
  if not exists (select 1 from public.private_mentoring_session_focuses where id=p_focus_id and is_active) then
    raise exception 'Active Session Focus required' using errcode='22023';
  end if;

  select * into v_session from public.private_mentoring_sessions where id=p_session_id for update;
  if not found then raise exception 'Private Mentoring session not found' using errcode='22023'; end if;
  if v_session.status in ('completed','cancelled') then raise exception 'Session topic is locked' using errcode='22023'; end if;

  update public.private_mentoring_sessions
  set session_focus_id=p_focus_id,
      resolved_topic=v_topic,
      mentor_scope_notes=v_notes,
      topic_status='confirmed',
      topic_updated_at=now(),
      status=case when status='awaiting_focus' then 'awaiting_scheduling' else status end
  where id=p_session_id
  returning * into v_session;

  insert into public.private_mentoring_session_topic_events(
    session_id,event_type,requested_focus_id,mentee_topic_request,resolved_focus_id,resolved_topic,mentor_scope_notes,actor_id
  ) values (
    p_session_id,'admin_resolution',v_session.requested_focus_id,v_session.mentee_topic_request,
    p_focus_id,v_topic,v_notes,auth.uid()
  );

  if v_session.status='scheduled' then
    insert into public.private_mentoring_session_calendar_integrations(session_id,organizer_user_id,sync_status,sync_error)
    values (p_session_id,auth.uid(),'pending',null)
    on conflict (session_id) do update set sync_status='pending',sync_error=null;
  end if;
  return v_session;
end;
$$;

create or replace function public.list_eligible_private_mentoring_enrollment_mentors(p_enrollment_id uuid)
returns table(mentor_id uuid, mentor_name text, tier_id uuid, timezone text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  return query
  select mp.user_id,
    coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),u.email)::text,
    mp.tier_id,
    mp.timezone::text
  from public.private_mentoring_enrollments e
  join public.private_mentoring_packages pkg on pkg.id=e.package_id
  join public.mentor_profiles mp on mp.tier_id=pkg.mentor_tier_id and mp.is_active
  join public.profiles p on p.id=mp.user_id and p.role='mentor'::public.app_role
  join auth.users u on u.id=mp.user_id
  where e.id=p_enrollment_id
  order by coalesce(p.first_name,''),coalesce(p.last_name,''),mp.user_id;
end;
$$;

create or replace function public.get_admin_private_mentoring_enrollment_mentor_context(p_enrollment_id uuid)
returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  select jsonb_build_object(
    'enrollmentId',e.id,
    'purchasedSessions',e.purchased_sessions,
    'primaryMentorRequired',e.purchased_sessions>=5,
    'primaryMentorId',e.primary_mentor_id,
    'primaryMentorName',nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),'')
  ) into v_result
  from public.private_mentoring_enrollments e
  left join public.profiles p on p.id=e.primary_mentor_id
  where e.id=p_enrollment_id;
  if v_result is null then raise exception 'Private Mentoring enrollment not found' using errcode='22023'; end if;
  return v_result;
end;
$$;

create or replace function public.admin_set_private_mentoring_primary_mentor(
  p_enrollment_id uuid,
  p_mentor_id uuid,
  p_reason text default null
)
returns public.private_mentoring_enrollments
language plpgsql security definer set search_path='' as $$
declare
  v_enrollment public.private_mentoring_enrollments;
  v_required_tier uuid;
  v_mentor_tier uuid;
  v_active boolean;
  v_reason text := nullif(btrim(coalesce(p_reason,'')), '');
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  select e.* into v_enrollment from public.private_mentoring_enrollments e where e.id=p_enrollment_id for update;
  if not found then raise exception 'Private Mentoring enrollment not found' using errcode='22023'; end if;
  if v_enrollment.purchased_sessions < 5 then raise exception 'Primary mentor only applies to packages with 5 or more sessions' using errcode='22023'; end if;
  if v_enrollment.primary_mentor_id=p_mentor_id then return v_enrollment; end if;
  if v_enrollment.primary_mentor_id is not null and v_reason is null then
    raise exception 'Reason is required when changing primary mentor' using errcode='22023';
  end if;
  select pkg.mentor_tier_id into v_required_tier from public.private_mentoring_packages pkg where pkg.id=v_enrollment.package_id;
  select mp.tier_id,mp.is_active into v_mentor_tier,v_active
  from public.mentor_profiles mp join public.profiles p on p.id=mp.user_id and p.role='mentor'::public.app_role
  where mp.user_id=p_mentor_id;
  if not found or not v_active then raise exception 'Active mentor required' using errcode='22023'; end if;
  if v_mentor_tier is distinct from v_required_tier then raise exception 'Mentor tier does not match purchased package' using errcode='22023'; end if;

  insert into public.private_mentoring_primary_mentor_changes(
    enrollment_id,previous_mentor_id,new_mentor_id,changed_by,reason
  ) values (v_enrollment.id,v_enrollment.primary_mentor_id,p_mentor_id,auth.uid(),v_reason);

  update public.private_mentoring_enrollments set primary_mentor_id=p_mentor_id where id=v_enrollment.id returning * into v_enrollment;
  return v_enrollment;
end;
$$;

-- Scheduling enforcement: confirmed topic + exact tier + dedicated mentor for >=5 sessions.
create or replace function public.admin_schedule_private_mentoring_session(
  p_session_id uuid,
  p_mentor_id uuid,
  p_scheduled_start_at timestamptz
)
returns public.private_mentoring_sessions
language plpgsql security definer set search_path='' as $$
declare
  v_session public.private_mentoring_sessions;
  v_required_tier uuid;
  v_duration integer;
  v_purchased integer;
  v_primary uuid;
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
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if p_scheduled_start_at is null or p_scheduled_start_at<=now() then raise exception 'Schedule must be in the future' using errcode='22023'; end if;
  select * into v_session from public.private_mentoring_sessions where id=p_session_id for update;
  if not found then raise exception 'Private Mentoring session not found' using errcode='22023'; end if;

  select pkg.mentor_tier_id,pkg.duration_minutes,e.purchased_sessions,e.primary_mentor_id
  into v_required_tier,v_duration,v_purchased,v_primary
  from public.private_mentoring_enrollments e join public.private_mentoring_packages pkg on pkg.id=e.package_id
  where e.id=v_session.enrollment_id;

  if v_session.topic_status<>'confirmed' or v_session.session_focus_id is null or v_session.resolved_topic is null then
    raise exception 'Session topic must be confirmed before scheduling' using errcode='22023';
  end if;
  if v_session.status not in ('awaiting_scheduling','scheduled') then raise exception 'Session is not schedulable' using errcode='22023'; end if;
  if v_purchased>=5 and v_primary is null then raise exception 'Set the enrollment primary mentor before scheduling' using errcode='22023'; end if;
  if v_purchased>=5 and p_mentor_id is distinct from v_primary then raise exception 'This package must use the enrollment primary mentor' using errcode='22023'; end if;

  select mp.tier_id,mp.is_active,mp.timezone into v_mentor_tier,v_mentor_active,v_timezone
  from public.mentor_profiles mp join public.profiles p on p.id=mp.user_id and p.role='mentor'::public.app_role
  where mp.user_id=p_mentor_id;
  if not found or not v_mentor_active then raise exception 'Active mentor required' using errcode='22023'; end if;
  if v_mentor_tier is distinct from v_required_tier then raise exception 'Mentor tier does not match purchased package' using errcode='22023'; end if;

  v_end:=p_scheduled_start_at+make_interval(mins=>v_duration);
  v_local_start:=p_scheduled_start_at at time zone v_timezone;
  v_local_end:=v_end at time zone v_timezone;
  v_local_date:=v_local_start::date;
  v_week_start:=date_trunc('week',v_local_start)::date;
  v_day:=extract(isodow from v_local_start)::smallint;
  if v_local_end::date<>v_local_date or not exists (
    select 1 from public.mentor_availability_rules a
    where a.mentor_id=p_mentor_id and a.week_start_date=v_week_start and a.day_of_week=v_day
      and a.start_time<=v_local_start::time and a.end_time>=v_local_end::time
  ) then raise exception 'Selected slot is outside declared mentor availability' using errcode='22023'; end if;

  if exists (
    select 1 from public.private_mentoring_sessions other
    where other.id<>p_session_id and other.mentor_id=p_mentor_id and other.status in ('scheduled','completed')
      and tstzrange(other.scheduled_start_at,other.scheduled_end_at,'[)') && tstzrange(p_scheduled_start_at,v_end,'[)')
  ) then raise exception 'Selected slot conflicts with another Strativate session' using errcode='23P01'; end if;

  begin
    update public.private_mentoring_sessions
    set mentor_id=p_mentor_id,scheduled_start_at=p_scheduled_start_at,scheduled_end_at=v_end,status='scheduled'
    where id=p_session_id returning * into v_session;
  exception when exclusion_violation then
    raise exception 'Selected slot was just booked by another session' using errcode='23P01';
  end;

  insert into public.private_mentoring_session_calendar_integrations(session_id,organizer_user_id,sync_status,sync_error)
  values (p_session_id,auth.uid(),'pending',null)
  on conflict(session_id) do update set sync_status='pending',sync_error=null,
    organizer_user_id=coalesce(public.private_mentoring_session_calendar_integrations.organizer_user_id,excluded.organizer_user_id);
  return v_session;
end;
$$;

create or replace function public.admin_get_private_mentoring_slot_context(p_session_id uuid)
returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  select jsonb_build_object(
    'sessionId',s.id,
    'status',s.status,
    'topicStatus',s.topic_status,
    'focusName',coalesce(s.resolved_topic,f.name),
    'resolvedTopic',s.resolved_topic,
    'requiredTierId',pkg.mentor_tier_id,
    'durationMinutes',pkg.duration_minutes,
    'menteeId',e.mentee_id,
    'purchasedSessions',e.purchased_sessions,
    'sessionNumber',s.session_number,
    'primaryMentorRequired',e.purchased_sessions>=5,
    'primaryMentorId',e.primary_mentor_id,
    'mentors',coalesce((
      select jsonb_agg(jsonb_build_object(
        'mentorId',mp.user_id,
        'mentorName',coalesce(nullif(btrim(concat_ws(' ',pp.first_name,pp.last_name)),''),au.email),
        'tierId',mp.tier_id,'active',mp.is_active,'timezone',mp.timezone,
        'availability',coalesce((select jsonb_agg(jsonb_build_object(
          'start',(((a.week_start_date+(a.day_of_week-1))::date+a.start_time) at time zone mp.timezone),
          'end',(((a.week_start_date+(a.day_of_week-1))::date+a.end_time) at time zone mp.timezone)
        ) order by a.week_start_date,a.day_of_week,a.start_time)
          from public.mentor_availability_rules a where a.mentor_id=mp.user_id and a.week_start_date in (
            date_trunc('week',current_timestamp at time zone mp.timezone)::date,
            date_trunc('week',current_timestamp at time zone mp.timezone)::date+7
          )),'[]'::jsonb),
        'strativate_busy',coalesce((select jsonb_agg(jsonb_build_object('start',other.scheduled_start_at,'end',other.scheduled_end_at) order by other.scheduled_start_at)
          from public.private_mentoring_sessions other where other.mentor_id=mp.user_id and other.id<>s.id and other.status in ('scheduled','completed') and other.scheduled_start_at is not null),'[]'::jsonb)
      ) order by coalesce(pp.first_name,''),coalesce(pp.last_name,''),mp.user_id)
      from public.mentor_profiles mp
      join public.profiles pp on pp.id=mp.user_id and pp.role='mentor'::public.app_role
      join auth.users au on au.id=mp.user_id
      where mp.tier_id=pkg.mentor_tier_id and mp.is_active
        and (e.purchased_sessions<5 or mp.user_id=e.primary_mentor_id)
    ),'[]'::jsonb)
  ) into v_result
  from public.private_mentoring_sessions s
  join public.private_mentoring_enrollments e on e.id=s.enrollment_id
  join public.private_mentoring_packages pkg on pkg.id=e.package_id
  left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id
  where s.id=p_session_id;
  if v_result is null then raise exception 'Private Mentoring session not found' using errcode='22023'; end if;
  return v_result;
end;
$$;

-- Completing a session requires the topic review to be resolved.
create or replace function public.admin_set_private_mentoring_session_status(p_session_id uuid,p_status text)
returns public.private_mentoring_sessions
language plpgsql security definer set search_path='' as $$
declare v_session public.private_mentoring_sessions;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if p_status<>'completed' then raise exception 'Only completion is supported' using errcode='22023'; end if;
  select * into v_session from public.private_mentoring_sessions where id=p_session_id for update;
  if not found or v_session.status<>'scheduled' then raise exception 'Only a scheduled session can be completed' using errcode='22023'; end if;
  if v_session.topic_status<>'confirmed' then raise exception 'Resolve the session topic before completion' using errcode='22023'; end if;
  update public.private_mentoring_sessions set status='completed' where id=p_session_id returning * into v_session;
  if not exists (select 1 from public.private_mentoring_sessions where enrollment_id=v_session.enrollment_id and status not in ('completed','cancelled')) then
    update public.private_mentoring_enrollments set status='completed' where id=v_session.enrollment_id;
  end if;
  return v_session;
end;
$$;

-- User projection: separate lifecycle and topic review states.
drop function if exists public.list_my_private_mentoring_sessions_v2();
create function public.list_my_private_mentoring_sessions_v2()
returns table(
  session_id uuid,enrollment_id uuid,session_number integer,status text,
  session_focus_id uuid,focus_name text,requested_focus_id uuid,mentee_topic_request text,topic_status text,resolved_topic text,
  mentor_id uuid,mentor_name text,primary_mentor_id uuid,primary_mentor_name text,
  scheduled_start_at timestamptz,scheduled_end_at timestamptz,
  mentor_tier_code text,mentor_tier_name text,package_id uuid,purchased_sessions integer,
  mentor_timezone text,duration_minutes integer,meeting_url text,google_event_id text,google_ical_uid text,google_sync_status text
)
language sql stable security definer set search_path='' as $$
  select s.id,e.id,s.session_number,s.status::text,s.session_focus_id,f.name::text,s.requested_focus_id,s.mentee_topic_request,s.topic_status,s.resolved_topic,
    s.mentor_id,nullif(btrim(concat_ws(' ',mp.first_name,mp.last_name)),''),e.primary_mentor_id,nullif(btrim(concat_ws(' ',primary_profile.first_name,primary_profile.last_name)),''),
    s.scheduled_start_at,s.scheduled_end_at,t.code,t.name,e.package_id,e.purchased_sessions,mentor_profile.timezone,pkg.duration_minutes,
    case when s.status='cancelled' then null else coalesce(ci.manual_meeting_url,ci.provider_meeting_url) end,
    ci.google_event_id,ci.google_ical_uid,coalesce(ci.sync_status,'pending')
  from public.private_mentoring_sessions s
  join public.private_mentoring_enrollments e on e.id=s.enrollment_id
  join public.private_mentoring_packages pkg on pkg.id=e.package_id
  join public.mentor_tiers t on t.id=pkg.mentor_tier_id
  left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id
  left join public.profiles mp on mp.id=s.mentor_id
  left join public.profiles primary_profile on primary_profile.id=e.primary_mentor_id
  left join public.mentor_profiles mentor_profile on mentor_profile.user_id=s.mentor_id
  left join public.private_mentoring_session_calendar_integrations ci on ci.session_id=s.id
  where e.mentee_id=auth.uid()
  order by e.created_at desc,s.session_number;
$$;

-- Mentor projection exposes resolved topic and only mentor-visible notes, never admin audit history.
drop function if exists public.list_my_mentor_private_mentoring_sessions();
create function public.list_my_mentor_private_mentoring_sessions()
returns table(
  session_id uuid,enrollment_id uuid,mentee_id uuid,mentee_name text,mentee_email text,
  session_number integer,purchased_sessions integer,status text,focus_name text,resolved_topic text,mentor_scope_notes text,
  scheduled_start_at timestamptz,scheduled_end_at timestamptz,mentor_timezone text,duration_minutes integer,
  meeting_url text,google_event_id text,google_ical_uid text,google_sync_status text
)
language sql stable security definer set search_path='' as $$
  select s.id,e.id,e.mentee_id,nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),coalesce(u.email,'')::text,
    s.session_number,e.purchased_sessions,s.status::text,coalesce(s.resolved_topic,f.name)::text,s.resolved_topic,s.mentor_scope_notes,
    s.scheduled_start_at,s.scheduled_end_at,mentor_profile.timezone,pkg.duration_minutes,
    case when s.status='cancelled' then null else coalesce(ci.manual_meeting_url,ci.provider_meeting_url) end,
    ci.google_event_id,ci.google_ical_uid,coalesce(ci.sync_status,'pending')
  from public.private_mentoring_sessions s
  join public.private_mentoring_enrollments e on e.id=s.enrollment_id
  join public.private_mentoring_packages pkg on pkg.id=e.package_id
  join public.profiles p on p.id=e.mentee_id
  join auth.users u on u.id=e.mentee_id
  join public.mentor_profiles mentor_profile on mentor_profile.user_id=s.mentor_id
  left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id
  left join public.private_mentoring_session_calendar_integrations ci on ci.session_id=s.id
  where s.mentor_id=auth.uid()
  order by s.scheduled_start_at nulls last,s.session_number;
$$;

-- Admin detail projection carries request/resolution plus current primary mentor context.
drop function if exists public.get_admin_private_mentoring_enrollment_sessions(uuid);
create function public.get_admin_private_mentoring_enrollment_sessions(p_enrollment_id uuid)
returns table(
  session_id uuid,enrollment_id uuid,session_number integer,status text,
  session_focus_id uuid,focus_name text,requested_focus_id uuid,requested_focus_name text,mentee_topic_request text,topic_status text,resolved_topic text,mentor_scope_notes text,
  mentor_id uuid,mentor_name text,primary_mentor_id uuid,primary_mentor_name text,
  scheduled_start_at timestamptz,scheduled_end_at timestamptz,
  mentor_tier_id uuid,mentor_tier_code text,mentor_tier_name text,purchased_sessions integer,
  google_sync_status text,google_sync_error text
)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  return query
  select s.id,e.id,s.session_number,s.status::text,s.session_focus_id,f.name::text,s.requested_focus_id,rf.name::text,s.mentee_topic_request,s.topic_status,s.resolved_topic,s.mentor_scope_notes,
    s.mentor_id,nullif(btrim(concat_ws(' ',mp.first_name,mp.last_name)),''),e.primary_mentor_id,nullif(btrim(concat_ws(' ',primary_profile.first_name,primary_profile.last_name)),''),
    s.scheduled_start_at,s.scheduled_end_at,tier.id,tier.code::text,tier.name::text,e.purchased_sessions,
    coalesce(ci.sync_status,'pending')::text,ci.sync_error::text
  from public.private_mentoring_enrollments e
  join public.private_mentoring_sessions s on s.enrollment_id=e.id
  join public.private_mentoring_packages pkg on pkg.id=e.package_id
  join public.mentor_tiers tier on tier.id=pkg.mentor_tier_id
  left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id
  left join public.private_mentoring_session_focuses rf on rf.id=s.requested_focus_id
  left join public.profiles mp on mp.id=s.mentor_id
  left join public.profiles primary_profile on primary_profile.id=e.primary_mentor_id
  left join public.private_mentoring_session_calendar_integrations ci on ci.session_id=s.id
  where e.id=p_enrollment_id
  order by s.session_number;
end;
$$;

-- Calendar sync keeps the existing contract but feeds the resolved topic into focusName.
create or replace function public.service_get_private_mentoring_sync_context(p_session_id uuid)
returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  select jsonb_build_object(
    'sessionId',s.id,'sessionNumber',s.session_number,'purchasedSessions',e.purchased_sessions,'status',s.status,
    'focusName',coalesce(s.resolved_topic,f.name),'resolvedTopic',s.resolved_topic,
    'start',s.scheduled_start_at,'end',s.scheduled_end_at,'menteeEmail',mentee_user.email,'mentorEmail',mentor_user.email,
    'organizerUserId',ci.organizer_user_id,'calendarId',coalesce(ci.google_calendar_id,'primary'),'eventId',ci.google_event_id,
    'iCalUID',ci.google_ical_uid,'providerMeetingUrl',ci.provider_meeting_url,'manualMeetingUrl',ci.manual_meeting_url
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

-- Intensive Mentoring: normalized paid entitlements on top of the existing Shared Commerce pipeline.
create table if not exists public.intensive_mentoring_entitlements(
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid not null references public.profiles(id),
  order_item_id uuid not null unique references public.order_items(id),
  entitlement_kind text not null check (entitlement_kind in ('package','bundle','add_on')),
  package_id uuid references public.intensive_mentoring_packages(id),
  bundle_id uuid references public.intensive_mentoring_bundles(id),
  add_on_id uuid references public.intensive_mentoring_add_ons(id),
  purchased_sessions integer,
  status text not null default 'active' check (status in ('active','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (entitlement_kind='package' and package_id is not null and bundle_id is null and add_on_id is null)
    or (entitlement_kind='bundle' and package_id is null and bundle_id is not null and add_on_id is null)
    or (entitlement_kind='add_on' and package_id is null and bundle_id is null and add_on_id is not null)
  ),
  check (purchased_sessions is null or purchased_sessions>0)
);
create index if not exists intensive_mentoring_entitlements_mentee_idx
  on public.intensive_mentoring_entitlements(mentee_id,status,created_at desc,id);
create trigger intensive_mentoring_entitlements_touch_updated_at
before update on public.intensive_mentoring_entitlements
for each row execute function public.touch_updated_at();
alter table public.intensive_mentoring_entitlements enable row level security;
create policy intensive_entitlements_owner_read on public.intensive_mentoring_entitlements for select to authenticated using (mentee_id=auth.uid());
create policy intensive_entitlements_admin_read on public.intensive_mentoring_entitlements for select to authenticated using (public.is_admin());
revoke all on public.intensive_mentoring_entitlements from public,anon,authenticated;
grant select on public.intensive_mentoring_entitlements to authenticated;
grant all on public.intensive_mentoring_entitlements to service_role;

create or replace function public.sync_intensive_package_commerce_item()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.commerce_items(id,item_kind,is_available,created_at,updated_at)
  values(new.id,'intensive_mentoring_package',new.is_active and new.pricing_mode='fixed' and new.price_amount is not null,new.created_at,new.updated_at)
  on conflict(id) do update set item_kind=excluded.item_kind,is_available=excluded.is_available,updated_at=excluded.updated_at;
  return new;
end;
$$;
create or replace function public.sync_intensive_add_on_commerce_item()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.commerce_items(id,item_kind,is_available,created_at,updated_at)
  values(new.id,'intensive_mentoring_add_on',new.is_active,new.created_at,new.updated_at)
  on conflict(id) do update set item_kind=excluded.item_kind,is_available=excluded.is_available,updated_at=excluded.updated_at;
  return new;
end;
$$;
create or replace function public.sync_intensive_bundle_commerce_item()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.commerce_items(id,item_kind,is_available,created_at,updated_at)
  values(new.id,'intensive_mentoring_bundle',new.is_active,new.created_at,new.updated_at)
  on conflict(id) do update set item_kind=excluded.item_kind,is_available=excluded.is_available,updated_at=excluded.updated_at;
  return new;
end;
$$;
create or replace function public.retire_intensive_commerce_item()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.commerce_items set is_available=false where id=old.id;
  return old;
end;
$$;

drop trigger if exists intensive_packages_sync_commerce_item on public.intensive_mentoring_packages;
create trigger intensive_packages_sync_commerce_item after insert or update of is_active,pricing_mode,price_amount,name,slug on public.intensive_mentoring_packages for each row execute function public.sync_intensive_package_commerce_item();
drop trigger if exists intensive_add_ons_sync_commerce_item on public.intensive_mentoring_add_ons;
create trigger intensive_add_ons_sync_commerce_item after insert or update of is_active,price_amount,name,slug on public.intensive_mentoring_add_ons for each row execute function public.sync_intensive_add_on_commerce_item();
drop trigger if exists intensive_bundles_sync_commerce_item on public.intensive_mentoring_bundles;
create trigger intensive_bundles_sync_commerce_item after insert or update of is_active,price_amount,name,slug on public.intensive_mentoring_bundles for each row execute function public.sync_intensive_bundle_commerce_item();
drop trigger if exists intensive_packages_retire_commerce_item on public.intensive_mentoring_packages;
create trigger intensive_packages_retire_commerce_item before delete on public.intensive_mentoring_packages for each row execute function public.retire_intensive_commerce_item();
drop trigger if exists intensive_add_ons_retire_commerce_item on public.intensive_mentoring_add_ons;
create trigger intensive_add_ons_retire_commerce_item before delete on public.intensive_mentoring_add_ons for each row execute function public.retire_intensive_commerce_item();
drop trigger if exists intensive_bundles_retire_commerce_item on public.intensive_mentoring_bundles;
create trigger intensive_bundles_retire_commerce_item before delete on public.intensive_mentoring_bundles for each row execute function public.retire_intensive_commerce_item();

insert into public.commerce_items(id,item_kind,is_available,created_at,updated_at)
select id,'intensive_mentoring_package',is_active and pricing_mode='fixed' and price_amount is not null,created_at,updated_at from public.intensive_mentoring_packages
on conflict(id) do update set item_kind=excluded.item_kind,is_available=excluded.is_available,updated_at=excluded.updated_at;
insert into public.commerce_items(id,item_kind,is_available,created_at,updated_at)
select id,'intensive_mentoring_add_on',is_active,created_at,updated_at from public.intensive_mentoring_add_ons
on conflict(id) do update set item_kind=excluded.item_kind,is_available=excluded.is_available,updated_at=excluded.updated_at;
insert into public.commerce_items(id,item_kind,is_available,created_at,updated_at)
select id,'intensive_mentoring_bundle',is_active,created_at,updated_at from public.intensive_mentoring_bundles
on conflict(id) do update set item_kind=excluded.item_kind,is_available=excluded.is_available,updated_at=excluded.updated_at;

create or replace function public.resolve_commerce_item(p_commerce_item_id uuid)
returns table(commerce_item_id uuid,item_kind text,name text,slug text,description text,image_path text,price_amount bigint,is_available boolean)
language sql stable security definer set search_path='' as $$
  select ci.id,ci.item_kind,dp.name,dp.slug,dp.description,dp.image_path,dp.price_amount,(ci.is_available and dp.id is not null)
  from public.commerce_items ci left join public.digital_products dp on dp.id=ci.id
  where ci.id=p_commerce_item_id and ci.item_kind='digital_product'
  union all
  select ci.id,ci.item_kind,
    'Private Mentoring - '||t.name||' - '||p.session_count||case when p.session_count=1 then ' Session' else ' Sessions' end,
    'private-mentoring-'||lower(replace(t.code,'_','-'))||'-'||p.session_count||case when p.session_count=1 then '-session' else '-sessions' end,
    'Private Mentoring package'::text,null::text,p.price_amount,(ci.is_available and p.is_active and t.is_active)
  from public.commerce_items ci join public.private_mentoring_packages p on p.id=ci.id join public.mentor_tiers t on t.id=p.mentor_tier_id
  where ci.id=p_commerce_item_id and ci.item_kind='private_mentoring'
  union all
  select ci.id,ci.item_kind,p.name,p.slug,p.description,null::text,p.price_amount,
    (ci.is_available and p.is_active and p.pricing_mode='fixed' and p.price_amount is not null)
  from public.commerce_items ci join public.intensive_mentoring_packages p on p.id=ci.id
  where ci.id=p_commerce_item_id and ci.item_kind='intensive_mentoring_package'
  union all
  select ci.id,ci.item_kind,a.name,a.slug,a.description,null::text,a.price_amount,(ci.is_available and a.is_active)
  from public.commerce_items ci join public.intensive_mentoring_add_ons a on a.id=ci.id
  where ci.id=p_commerce_item_id and ci.item_kind='intensive_mentoring_add_on'
  union all
  select ci.id,ci.item_kind,b.name,b.slug,b.description,null::text,b.price_amount,
    (ci.is_available and b.is_active and not exists (
      select 1 from public.intensive_mentoring_bundle_items bi
      left join public.intensive_mentoring_packages bp on bp.id=bi.package_id
      left join public.intensive_mentoring_add_ons ba on ba.id=bi.add_on_id
      where bi.bundle_id=b.id and bi.is_active and (
        (bi.item_type='package' and (bp.id is null or not bp.is_active or bp.pricing_mode<>'fixed'))
        or (bi.item_type='add_on' and (ba.id is null or not ba.is_active))
      )
    ))
  from public.commerce_items ci join public.intensive_mentoring_bundles b on b.id=ci.id
  where ci.id=p_commerce_item_id and ci.item_kind='intensive_mentoring_bundle';
$$;

create or replace function public.fulfill_paid_intensive_mentoring_order(p_order_id uuid)
returns void
language plpgsql security definer set search_path='' as $$
declare v_order public.orders; v_item public.order_items; v_sessions integer;
begin
  select * into v_order from public.orders where id=p_order_id;
  if not found or v_order.status<>'paid' then return; end if;
  for v_item in select * from public.order_items where order_id=p_order_id and item_kind_snapshot in ('intensive_mentoring_package','intensive_mentoring_bundle','intensive_mentoring_add_on') loop
    v_sessions:=null;
    if v_item.item_kind_snapshot='intensive_mentoring_package' then
      select sessions_per_month into v_sessions from public.intensive_mentoring_packages where id=v_item.commerce_item_id;
      if not found then raise exception 'Paid Intensive Mentoring package is missing' using errcode='23503'; end if;
      insert into public.intensive_mentoring_entitlements(mentee_id,order_item_id,entitlement_kind,package_id,purchased_sessions)
      values(v_order.user_id,v_item.id,'package',v_item.commerce_item_id,v_sessions) on conflict(order_item_id) do nothing;
    elsif v_item.item_kind_snapshot='intensive_mentoring_bundle' then
      select max(p.sessions_per_month) into v_sessions
      from public.intensive_mentoring_bundle_items bi join public.intensive_mentoring_packages p on p.id=bi.package_id
      where bi.bundle_id=v_item.commerce_item_id and bi.item_type='package' and bi.is_active;
      if not exists(select 1 from public.intensive_mentoring_bundles where id=v_item.commerce_item_id) then raise exception 'Paid Intensive Mentoring bundle is missing' using errcode='23503'; end if;
      insert into public.intensive_mentoring_entitlements(mentee_id,order_item_id,entitlement_kind,bundle_id,purchased_sessions)
      values(v_order.user_id,v_item.id,'bundle',v_item.commerce_item_id,v_sessions) on conflict(order_item_id) do nothing;
    else
      if not exists(select 1 from public.intensive_mentoring_add_ons where id=v_item.commerce_item_id) then raise exception 'Paid Intensive Mentoring add-on is missing' using errcode='23503'; end if;
      insert into public.intensive_mentoring_entitlements(mentee_id,order_item_id,entitlement_kind,add_on_id)
      values(v_order.user_id,v_item.id,'add_on',v_item.commerce_item_id) on conflict(order_item_id) do nothing;
    end if;
  end loop;
end;
$$;

create or replace function public.fulfill_paid_intensive_mentoring_order_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='paid' then perform public.fulfill_paid_intensive_mentoring_order(new.id); end if;
  return new;
end;
$$;
drop trigger if exists orders_fulfill_intensive_mentoring on public.orders;
create trigger orders_fulfill_intensive_mentoring after insert or update of status on public.orders
for each row when(new.status='paid') execute function public.fulfill_paid_intensive_mentoring_order_trigger();

create or replace function public.list_my_intensive_mentoring_entitlements()
returns table(
  entitlement_id uuid,order_item_id uuid,entitlement_kind text,name text,purchased_sessions integer,status text,created_at timestamptz
)
language sql stable security definer set search_path='' as $$
  select e.id,e.order_item_id,e.entitlement_kind,
    coalesce(p.name,b.name,a.name)::text,e.purchased_sessions,e.status::text,e.created_at
  from public.intensive_mentoring_entitlements e
  left join public.intensive_mentoring_packages p on p.id=e.package_id
  left join public.intensive_mentoring_bundles b on b.id=e.bundle_id
  left join public.intensive_mentoring_add_ons a on a.id=e.add_on_id
  where e.mentee_id=auth.uid()
  order by e.created_at desc,e.id;
$$;

revoke all on function public.submit_private_mentoring_topic_request(uuid,uuid,text),
  public.set_private_mentoring_session_focus(uuid,uuid),
  public.admin_resolve_private_mentoring_session_topic(uuid,uuid,text,text),
  public.list_eligible_private_mentoring_enrollment_mentors(uuid),
  public.get_admin_private_mentoring_enrollment_mentor_context(uuid),
  public.admin_set_private_mentoring_primary_mentor(uuid,uuid,text),
  public.admin_schedule_private_mentoring_session(uuid,uuid,timestamptz),
  public.admin_get_private_mentoring_slot_context(uuid),
  public.admin_set_private_mentoring_session_status(uuid,text),
  public.list_my_private_mentoring_sessions_v2(),
  public.list_my_mentor_private_mentoring_sessions(),
  public.get_admin_private_mentoring_enrollment_sessions(uuid),
  public.list_my_intensive_mentoring_entitlements()
from public,anon;

grant execute on function public.submit_private_mentoring_topic_request(uuid,uuid,text),
  public.set_private_mentoring_session_focus(uuid,uuid),
  public.admin_resolve_private_mentoring_session_topic(uuid,uuid,text,text),
  public.list_eligible_private_mentoring_enrollment_mentors(uuid),
  public.get_admin_private_mentoring_enrollment_mentor_context(uuid),
  public.admin_set_private_mentoring_primary_mentor(uuid,uuid,text),
  public.admin_schedule_private_mentoring_session(uuid,uuid,timestamptz),
  public.admin_get_private_mentoring_slot_context(uuid),
  public.admin_set_private_mentoring_session_status(uuid,text),
  public.list_my_private_mentoring_sessions_v2(),
  public.list_my_mentor_private_mentoring_sessions(),
  public.get_admin_private_mentoring_enrollment_sessions(uuid),
  public.list_my_intensive_mentoring_entitlements()
to authenticated,service_role;

revoke all on function public.service_get_private_mentoring_sync_context(uuid) from public,anon,authenticated;
grant execute on function public.service_get_private_mentoring_sync_context(uuid) to service_role;

comment on table public.private_mentoring_session_topic_events is 'Append-only audit of mentee topic requests and admin resolutions.';
comment on table public.private_mentoring_primary_mentor_changes is 'Audit history for >=5-session enrollment primary mentor assignments/reassignments.';
comment on table public.intensive_mentoring_entitlements is 'Normalized paid Intensive Mentoring entitlement, one row per immutable order item.';
