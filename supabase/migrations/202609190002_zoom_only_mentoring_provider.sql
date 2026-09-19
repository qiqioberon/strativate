-- Zoom is the sole active video provider for Private Mentoring.
-- Google Calendar event identities are intentionally preserved so legacy upcoming sessions reuse the same event.
-- Historical provider URLs are retained only as audit data and are never exposed as active runtime links.

update public.private_mentoring_session_calendar_integrations ci
set
  manual_meeting_url=coalesce(
    ci.manual_meeting_url,
    case
      when ci.provider_meeting_url is not null
       and ci.provider_meeting_url not ilike '%meet.google.com/%'
       and ci.provider_meeting_url not ilike '%zoom.%/%'
      then ci.provider_meeting_url
      else null
    end
  ),
  meeting_provider='zoom',
  provider_meeting_id=null,
  provider_meeting_url=null,
  provider_host_id=null,
  provider_sync_status='pending',
  provider_sync_error=null,
  provider_sync_started_at=null,
  recording_status='expected',
  recording_error=null,
  recording_metadata=null,
  recording_available_at=null
from public.private_mentoring_sessions s
where ci.session_id=s.id
  and s.status not in ('completed','cancelled')
  and (
    ci.meeting_provider is distinct from 'zoom'
    or ci.provider_meeting_url ilike '%meet.google.com/%'
  );

update public.private_mentoring_session_calendar_integrations ci
set
  manual_meeting_url=coalesce(
    ci.manual_meeting_url,
    case when ci.meeting_provider='manual' then ci.provider_meeting_url else null end
  ),
  meeting_provider=null,
  provider_sync_started_at=null,
  recording_status=case when ci.meeting_provider='zoom' then ci.recording_status else 'not_applicable' end
from public.private_mentoring_sessions s
where ci.session_id=s.id
  and s.status in ('completed','cancelled')
  and (
    ci.meeting_provider in ('google_meet','manual')
    or ci.provider_meeting_url ilike '%meet.google.com/%'
  );

alter table public.private_mentoring_session_calendar_integrations
  drop constraint if exists private_mentoring_meeting_provider_check;
alter table public.private_mentoring_session_calendar_integrations
  add constraint private_mentoring_meeting_provider_check
  check (meeting_provider is null or meeting_provider='zoom');

create or replace function public.service_claim_zoom_meeting_creation(p_session_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare
  v_row public.private_mentoring_session_calendar_integrations;
  v_status text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;

  select s.status::text into v_status
  from public.private_mentoring_sessions s
  where s.id=p_session_id
  for update;
  if not found then raise exception 'Private Mentoring session not found' using errcode='22023'; end if;

  insert into public.private_mentoring_session_calendar_integrations(
    session_id,meeting_provider,provider_sync_status,sync_status
  ) values (
    p_session_id,
    case when v_status in ('completed','cancelled') then null else 'zoom' end,
    case when v_status='cancelled' then 'cancelled' else 'pending' end,
    'pending'
  )
  on conflict(session_id) do nothing;

  select * into v_row
  from public.private_mentoring_session_calendar_integrations
  where session_id=p_session_id
  for update;

  if v_status in ('completed','cancelled') then
    update public.private_mentoring_session_calendar_integrations
    set meeting_provider=null,provider_sync_started_at=null
    where session_id=p_session_id;
    return 'inactive';
  end if;

  if v_row.provider_meeting_id is not null and v_row.meeting_provider='zoom' then
    update public.private_mentoring_session_calendar_integrations
    set meeting_provider='zoom',provider_sync_status='pending',provider_sync_error=null
    where session_id=p_session_id;
    return 'update';
  end if;

  if v_row.provider_sync_status='creating'
     and v_row.provider_sync_started_at>now()-interval '5 minutes' then
    return 'wait';
  end if;

  update public.private_mentoring_session_calendar_integrations
  set meeting_provider='zoom',
      provider_sync_status='creating',
      provider_sync_error=null,
      provider_sync_started_at=now()
  where session_id=p_session_id;
  return 'create';
end;
$$;

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
    'iCalUID',ci.google_ical_uid,
    'providerMeetingUrl',case when s.status='scheduled' and ci.meeting_provider='zoom' then ci.provider_meeting_url else null end,
    'manualMeetingUrl',case when s.status='scheduled' then ci.manual_meeting_url else null end
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

revoke all on function public.service_claim_zoom_meeting_creation(uuid),public.service_get_private_mentoring_sync_context(uuid) from public,anon,authenticated;
grant execute on function public.service_claim_zoom_meeting_creation(uuid),public.service_get_private_mentoring_sync_context(uuid) to service_role;

comment on column public.private_mentoring_session_calendar_integrations.meeting_provider is
  'Active mentoring provider. Zoom is the only non-null value; manual_meeting_url is an emergency URL override, not a provider.';
