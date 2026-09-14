-- Phase 3 operational hardening: keep the scheduling query explicit so the session row lock and package metadata
-- remain independently typed in PL/pgSQL on both fresh bootstrap and upgrades.
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
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_scheduled_start_at is null then raise exception 'Schedule is required' using errcode = '22023'; end if;

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

  select tier_id, is_active into v_mentor_tier, v_mentor_active
  from public.mentor_profiles where user_id = p_mentor_id;
  if not found or not v_mentor_active then raise exception 'Active mentor required' using errcode = '22023'; end if;
  if v_mentor_tier is distinct from v_required_tier then
    raise exception 'Mentor tier does not match purchased package' using errcode = '22023';
  end if;

  update public.private_mentoring_sessions
  set mentor_id = p_mentor_id,
      scheduled_start_at = p_scheduled_start_at,
      scheduled_end_at = p_scheduled_start_at + make_interval(mins => v_duration),
      status = 'scheduled'
  where id = p_session_id
  returning * into v_session;
  return v_session;
end;
$$;
