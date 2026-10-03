-- Forward-only follow-up: complete optional mentoring workflows and move community analytics to Admin.
-- Historical migrations 202610030001_mentee_community_stats.sql and 202610040001_flexible_mentoring_cart_links.sql remain untouched.

drop function if exists public.get_mentee_community_stats();

create or replace function public.get_admin_mentee_community_stats()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  with mentees as (
    select p.id as user_id from public.profiles p where p.role='mentee'::public.app_role
  ), profiled as (
    select m.user_id,mp.institution_id,mp.cohort_year,mp.referral_source_id,mp.referral_other_text
    from mentees m left join public.mentee_profiles mp on mp.user_id=m.user_id
  ), sma_counts as (
    select i.name::text label,count(distinct p.user_id)::integer count
    from profiled p join public.institutions i on i.id=p.institution_id
    where i.type='sma'::public.institution_type group by i.id,i.name
  ), smk_counts as (
    select i.name::text label,count(distinct p.user_id)::integer count
    from profiled p join public.institutions i on i.id=p.institution_id
    where i.type='smk'::public.institution_type group by i.id,i.name
  ), university_counts as (
    select i.name::text label,count(distinct p.user_id)::integer count
    from profiled p join public.institutions i on i.id=p.institution_id
    where i.type='university'::public.institution_type group by i.id,i.name
  ), province_counts as (
    select btrim(i.province)::text label,count(distinct p.user_id)::integer count
    from profiled p join public.institutions i on i.id=p.institution_id
    where nullif(btrim(coalesce(i.province,'')),'') is not null group by btrim(i.province)
  ), city_counts as (
    select btrim(i.city)::text label,count(distinct p.user_id)::integer count
    from profiled p join public.institutions i on i.id=p.institution_id
    where nullif(btrim(coalesce(i.city,'')),'') is not null group by btrim(i.city)
  ), interest_counts as (
    select ints.name::text label,count(distinct mi.user_id)::integer count
    from public.mentee_interests mi join mentees m on m.user_id=mi.user_id join public.interests ints on ints.id=mi.interest_id
    group by ints.id,ints.name
  ), referral_rows as (
    select p.user_id,case when nullif(btrim(coalesce(p.referral_other_text,'')),'') is not null then 'Lainnya'::text when rs.id is not null then rs.name::text else null end label
    from profiled p left join public.referral_sources rs on rs.id=p.referral_source_id
  ), referral_counts as (
    select label,count(distinct user_id)::integer count from referral_rows where label is not null group by label
  ), cohort_counts as (
    select p.cohort_year::text label,count(distinct p.user_id)::integer count,p.cohort_year from profiled p where p.cohort_year is not null group by p.cohort_year
  )
  select jsonb_build_object(
    'totalMentees',(select count(*)::integer from mentees),
    'uniqueSchools',(select count(distinct i.id)::integer from profiled p join public.institutions i on i.id=p.institution_id where i.type in('sma'::public.institution_type,'smk'::public.institution_type)),
    'uniqueUniversities',(select count(distinct i.id)::integer from profiled p join public.institutions i on i.id=p.institution_id where i.type='university'::public.institution_type),
    'uniqueInterests',(select count(distinct mi.interest_id)::integer from public.mentee_interests mi join mentees m on m.user_id=mi.user_id),
    'institutionTypes',jsonb_build_array(
      jsonb_build_object('label','SMA','count',(select count(distinct p.user_id)::integer from profiled p join public.institutions i on i.id=p.institution_id where i.type='sma'::public.institution_type)),
      jsonb_build_object('label','SMK','count',(select count(distinct p.user_id)::integer from profiled p join public.institutions i on i.id=p.institution_id where i.type='smk'::public.institution_type)),
      jsonb_build_object('label','University','count',(select count(distinct p.user_id)::integer from profiled p join public.institutions i on i.id=p.institution_id where i.type='university'::public.institution_type))
    ),
    'sma',coalesce((select jsonb_agg(jsonb_build_object('label',label,'count',count) order by count desc,lower(label)) from sma_counts),'[]'::jsonb),
    'smk',coalesce((select jsonb_agg(jsonb_build_object('label',label,'count',count) order by count desc,lower(label)) from smk_counts),'[]'::jsonb),
    'universities',coalesce((select jsonb_agg(jsonb_build_object('label',label,'count',count) order by count desc,lower(label)) from university_counts),'[]'::jsonb),
    'provinces',coalesce((select jsonb_agg(jsonb_build_object('label',label,'count',count) order by count desc,lower(label)) from province_counts),'[]'::jsonb),
    'cities',coalesce((select jsonb_agg(jsonb_build_object('label',label,'count',count) order by count desc,lower(label)) from city_counts),'[]'::jsonb),
    'interests',coalesce((select jsonb_agg(jsonb_build_object('label',label,'count',count) order by count desc,lower(label)) from interest_counts),'[]'::jsonb),
    'referrals',coalesce((select jsonb_agg(jsonb_build_object('label',label,'count',count) order by count desc,lower(label)) from referral_counts),'[]'::jsonb),
    'cohortYears',coalesce((select jsonb_agg(jsonb_build_object('label',label,'count',count) order by cohort_year) from cohort_counts),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.get_admin_mentee_community_stats() from public,anon;
grant execute on function public.get_admin_mentee_community_stats() to authenticated;

alter table public.private_mentoring_session_topic_events
  add column if not exists requested_focus_custom_text text,
  add column if not exists resolved_focus_custom_text text,
  add column if not exists supporting_materials text[] not null default '{}'::text[];

create or replace function public.private_mentoring_topic_immutability_guard()
returns trigger language plpgsql set search_path='' as $$
begin
 if old.status in('completed','cancelled') and (
  new.requested_focus_id is distinct from old.requested_focus_id or new.requested_focus_custom_text is distinct from old.requested_focus_custom_text or
  new.mentee_topic_request is distinct from old.mentee_topic_request or new.topic_status is distinct from old.topic_status or
  new.session_focus_id is distinct from old.session_focus_id or new.final_focus_custom_text is distinct from old.final_focus_custom_text or
  new.resolved_topic is distinct from old.resolved_topic or new.mentor_scope_notes is distinct from old.mentor_scope_notes or
  new.supporting_materials is distinct from old.supporting_materials
 ) then raise exception 'Completed and cancelled session preferences are immutable' using errcode='22023';end if;
 return new;
end;$$;

create or replace function public.intensive_mentoring_preference_immutability_guard()
returns trigger language plpgsql set search_path='' as $$
begin
 if old.status in('completed','cancelled') and (
  new.requested_focus_id is distinct from old.requested_focus_id or new.requested_focus_custom_text is distinct from old.requested_focus_custom_text or
  new.mentee_topic_request is distinct from old.mentee_topic_request or new.topic_status is distinct from old.topic_status or
  new.session_focus_id is distinct from old.session_focus_id or new.final_focus_custom_text is distinct from old.final_focus_custom_text or
  new.resolved_topic is distinct from old.resolved_topic or new.mentor_scope_notes is distinct from old.mentor_scope_notes or
  new.supporting_materials is distinct from old.supporting_materials
 ) then raise exception 'Completed and cancelled session preferences are immutable' using errcode='22023';end if;
 return new;
end;$$;
drop trigger if exists intensive_mentoring_preference_immutability_guard on public.intensive_mentoring_sessions;
create trigger intensive_mentoring_preference_immutability_guard before update on public.intensive_mentoring_sessions for each row execute function public.intensive_mentoring_preference_immutability_guard();

create or replace function public.get_mentoring_session_preferences(p_kind text,p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;v_owner uuid;v_mentor uuid;v_primary uuid;
begin
 if p_kind='private' then
  select e.mentee_id,s.mentor_id,e.primary_mentor_id,jsonb_build_object('sessionId',s.id,'parentId',e.id,'kind','private','status',s.status,'topicStatus',s.topic_status,'requestedFocusId',s.requested_focus_id,'requestedFocusName',rf.name,'requestedCustomFocus',s.requested_focus_custom_text,'requestedTopic',s.mentee_topic_request,'focusId',s.session_focus_id,'focusName',f.name,'customFocus',s.final_focus_custom_text,'topic',s.resolved_topic,'supportingMaterials',s.supporting_materials,'mentorNotes',s.mentor_scope_notes,'competitionNames',e.competition_names)
  into v_owner,v_mentor,v_primary,v_result from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id left join public.private_mentoring_session_focuses rf on rf.id=s.requested_focus_id left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id where s.id=p_session_id;
 elsif p_kind='intensive' then
  select e.mentee_id,s.mentor_id,e.primary_mentor_id,jsonb_build_object('sessionId',s.id,'parentId',e.id,'kind','intensive','status',s.status,'topicStatus',s.topic_status,'requestedFocusId',s.requested_focus_id,'requestedFocusName',rf.name,'requestedCustomFocus',s.requested_focus_custom_text,'requestedTopic',s.mentee_topic_request,'focusId',s.session_focus_id,'focusName',f.name,'customFocus',s.final_focus_custom_text,'topic',s.resolved_topic,'supportingMaterials',s.supporting_materials,'mentorNotes',s.mentor_scope_notes,'competitionNames',e.competition_names)
  into v_owner,v_mentor,v_primary,v_result from public.intensive_mentoring_sessions s join public.intensive_mentoring_engagements e on e.id=s.engagement_id left join public.private_mentoring_session_focuses rf on rf.id=s.requested_focus_id left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id where s.id=p_session_id;
 else raise exception 'Invalid mentoring kind' using errcode='22023';end if;
 if v_result is null then raise exception 'Mentoring session not found' using errcode='22023';end if;
 if not public.is_admin() and auth.uid() is distinct from v_owner and auth.uid() is distinct from v_mentor and auth.uid() is distinct from v_primary then raise exception 'Forbidden' using errcode='42501';end if;
 return v_result;
end;$$;

create or replace function public.save_mentoring_session_preferences(p_kind text,p_session_id uuid,p_focus_id uuid default null,p_custom_focus text default null,p_topic text default null,p_supporting_materials text[] default '{}'::text[],p_mentor_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid;v_custom text:=nullif(btrim(coalesce(p_custom_focus,'')),'');v_topic text:=nullif(btrim(coalesce(p_topic,'')),'');v_notes text:=nullif(btrim(coalesce(p_mentor_notes,'')),'');v_materials text[];v_admin boolean:=public.is_admin();v_private public.private_mentoring_sessions;v_intensive public.intensive_mentoring_sessions;v_calendar_change boolean:=false;
begin
 v_materials:=public.clean_text_values(p_supporting_materials,20,1000);
 if coalesce(array_length(p_supporting_materials,1),0)>20 or exists(select 1 from unnest(coalesce(p_supporting_materials,'{}'::text[])) value where char_length(btrim(value))>1000) then raise exception 'Supporting materials exceed the supported limit' using errcode='22023';end if;
 if v_custom is not null and char_length(v_custom)>300 then raise exception 'Custom focus is too long' using errcode='22023';end if;
 if v_topic is not null and char_length(v_topic)>3000 then raise exception 'Topic is too long' using errcode='22023';end if;
 if v_notes is not null and char_length(v_notes)>3000 then raise exception 'Mentor notes are too long' using errcode='22023';end if;
 if p_focus_id is not null and not exists(select 1 from public.private_mentoring_session_focuses where id=p_focus_id and is_active) then raise exception 'Active focus required' using errcode='22023';end if;
 if p_kind='private' then
  select * into v_private from public.private_mentoring_sessions where id=p_session_id for update;if not found then raise exception 'Session not found' using errcode='22023';end if;
  select mentee_id into v_owner from public.private_mentoring_enrollments where id=v_private.enrollment_id;
  if not v_admin and auth.uid() is distinct from v_owner then raise exception 'Forbidden' using errcode='42501';end if;
  if v_private.status in('completed','cancelled') then raise exception 'Closed session preferences are immutable' using errcode='22023';end if;
  if v_private.status='scheduled' and v_private.scheduled_start_at<=now() then raise exception 'Only an upcoming scheduled session can change preferences' using errcode='22023';end if;
  if v_admin then
   v_calendar_change:=v_private.status='scheduled' and (v_private.session_focus_id is distinct from p_focus_id or v_private.final_focus_custom_text is distinct from case when p_focus_id is null then v_custom end or v_private.resolved_topic is distinct from v_topic);
   update public.private_mentoring_sessions set session_focus_id=p_focus_id,final_focus_custom_text=case when p_focus_id is null then v_custom end,resolved_topic=v_topic,mentor_scope_notes=v_notes,supporting_materials=v_materials,topic_status='confirmed',topic_updated_at=now(),status=case when status='awaiting_focus' then 'awaiting_scheduling' else status end where id=p_session_id returning * into v_private;
  else
   update public.private_mentoring_sessions set requested_focus_id=p_focus_id,requested_focus_custom_text=case when p_focus_id is null then v_custom end,mentee_topic_request=v_topic,supporting_materials=v_materials,topic_status='pending_review',topic_updated_at=now() where id=p_session_id returning * into v_private;
  end if;
  insert into public.private_mentoring_session_topic_events(session_id,event_type,requested_focus_id,requested_focus_custom_text,mentee_topic_request,resolved_focus_id,resolved_focus_custom_text,resolved_topic,supporting_materials,mentor_scope_notes,actor_id)
  values(p_session_id,case when v_admin then 'admin_resolution' else 'mentee_request' end,v_private.requested_focus_id,v_private.requested_focus_custom_text,v_private.mentee_topic_request,v_private.session_focus_id,v_private.final_focus_custom_text,v_private.resolved_topic,v_private.supporting_materials,v_private.mentor_scope_notes,auth.uid());
  if v_admin and v_calendar_change then insert into public.private_mentoring_session_calendar_integrations(session_id,organizer_user_id,sync_status,sync_error) values(p_session_id,auth.uid(),'pending',null) on conflict(session_id) do update set sync_status='pending',sync_error=null,organizer_user_id=coalesce(public.private_mentoring_session_calendar_integrations.organizer_user_id,excluded.organizer_user_id);end if;
 elsif p_kind='intensive' then
  select * into v_intensive from public.intensive_mentoring_sessions where id=p_session_id for update;if not found then raise exception 'Session not found' using errcode='22023';end if;
  select mentee_id into v_owner from public.intensive_mentoring_engagements where id=v_intensive.engagement_id;
  if not v_admin and auth.uid() is distinct from v_owner then raise exception 'Forbidden' using errcode='42501';end if;
  if v_intensive.status in('completed','cancelled') then raise exception 'Closed session preferences are immutable' using errcode='22023';end if;
  if v_intensive.status='scheduled' and v_intensive.scheduled_start_at<=now() then raise exception 'Only an upcoming scheduled session can change preferences' using errcode='22023';end if;
  if v_admin then
   v_calendar_change:=v_intensive.status='scheduled' and (v_intensive.session_focus_id is distinct from p_focus_id or v_intensive.final_focus_custom_text is distinct from case when p_focus_id is null then v_custom end or v_intensive.resolved_topic is distinct from v_topic);
   update public.intensive_mentoring_sessions set session_focus_id=p_focus_id,final_focus_custom_text=case when p_focus_id is null then v_custom end,resolved_topic=v_topic,mentor_scope_notes=v_notes,supporting_materials=v_materials,topic_status='confirmed',status=case when status='awaiting_focus' then 'awaiting_scheduling' else status end where id=p_session_id returning * into v_intensive;
  else
   update public.intensive_mentoring_sessions set requested_focus_id=p_focus_id,requested_focus_custom_text=case when p_focus_id is null then v_custom end,mentee_topic_request=v_topic,supporting_materials=v_materials,topic_status='pending_review' where id=p_session_id returning * into v_intensive;
  end if;
  insert into public.intensive_mentoring_session_events(session_id,event_type,actor_user_id,metadata) values(p_session_id,case when v_admin then 'preferences_reviewed' else 'preferences_submitted' end,auth.uid(),jsonb_build_object('requestedFocusId',v_intensive.requested_focus_id,'requestedCustomFocus',v_intensive.requested_focus_custom_text,'requestedTopic',v_intensive.mentee_topic_request,'finalFocusId',v_intensive.session_focus_id,'finalCustomFocus',v_intensive.final_focus_custom_text,'finalTopic',v_intensive.resolved_topic,'supportingMaterials',to_jsonb(v_intensive.supporting_materials),'mentorNotes',v_intensive.mentor_scope_notes));
  if v_admin and v_calendar_change then insert into public.intensive_mentoring_session_calendar_integrations(session_id,organizer_user_id,sync_status,sync_error) values(p_session_id,auth.uid(),'pending',null) on conflict(session_id) do update set sync_status='pending',sync_error=null,organizer_user_id=coalesce(public.intensive_mentoring_session_calendar_integrations.organizer_user_id,excluded.organizer_user_id);end if;
 else raise exception 'Invalid mentoring kind' using errcode='22023';end if;
 return public.get_mentoring_session_preferences(p_kind,p_session_id);
end;$$;

revoke all on function public.get_mentoring_session_preferences(text,uuid),public.save_mentoring_session_preferences(text,uuid,uuid,text,text,text[],text) from public,anon;
grant execute on function public.get_mentoring_session_preferences(text,uuid),public.save_mentoring_session_preferences(text,uuid,uuid,text,text,text[],text) to authenticated,service_role;

create or replace function public.service_get_private_mentoring_sync_context(p_session_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  select jsonb_build_object(
    'sessionId', s.id, 'sessionNumber', s.session_number, 'purchasedSessions', e.purchased_sessions, 'status', s.status,
    'focusName', coalesce(s.resolved_topic, f.name, s.final_focus_custom_text), 'resolvedTopic', s.resolved_topic,
    'start', s.scheduled_start_at, 'end', s.scheduled_end_at, 'menteeEmail', mentee_user.email, 'mentorEmail', mentor_user.email,
    'organizerUserId', ci.organizer_user_id, 'calendarId', coalesce(ci.google_calendar_id, 'primary'), 'eventId', ci.google_event_id,
    'iCalUID', ci.google_ical_uid,
    'managedMeetingUrl', case when s.status = 'scheduled' then r.meeting_url end,
    'manualMeetingUrl', case when s.status = 'scheduled' then ci.manual_meeting_url end
  ) into v_result
  from public.private_mentoring_sessions s
  join public.private_mentoring_enrollments e on e.id = s.enrollment_id
  join auth.users mentee_user on mentee_user.id = e.mentee_id
  left join auth.users mentor_user on mentor_user.id = s.mentor_id
  left join public.private_mentoring_session_focuses f on f.id = s.session_focus_id
  left join public.private_mentoring_session_calendar_integrations ci on ci.session_id = s.id
  left join public.mentoring_zoom_room_allocations a on a.private_session_id = s.id
  left join public.mentoring_zoom_rooms r on r.id = a.zoom_room_id
  where s.id = p_session_id;
  if v_result is null then raise exception 'Private Mentoring session not found' using errcode = '22023'; end if;
  return v_result;
end;
$$;

create or replace function public.service_get_intensive_mentoring_sync_context(p_session_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  select jsonb_build_object(
    'sessionId', s.id, 'sessionNumber', s.session_number, 'purchasedSessions', g.baseline_sessions_per_month, 'status', s.status,
    'focusName', coalesce(s.resolved_topic, f.name, s.final_focus_custom_text), 'resolvedTopic', s.resolved_topic,
    'start', s.scheduled_start_at, 'end', s.scheduled_end_at, 'menteeEmail', mentee.email, 'mentorEmail', mentor.email,
    'organizerUserId', ci.organizer_user_id, 'calendarId', coalesce(ci.google_calendar_id, 'primary'), 'eventId', ci.google_event_id,
    'iCalUID', ci.google_ical_uid,
    'managedMeetingUrl', case when s.status = 'scheduled' then r.meeting_url end,
    'manualMeetingUrl', case when s.status = 'scheduled' then ci.manual_meeting_url end
  ) into v_result
  from public.intensive_mentoring_sessions s
  join public.intensive_mentoring_engagements g on g.id = s.engagement_id
  join auth.users mentee on mentee.id = g.mentee_id
  left join auth.users mentor on mentor.id = s.mentor_id
  left join public.private_mentoring_session_focuses f on f.id = s.session_focus_id
  left join public.intensive_mentoring_session_calendar_integrations ci on ci.session_id = s.id
  left join public.mentoring_zoom_room_allocations a on a.intensive_session_id = s.id
  left join public.mentoring_zoom_rooms r on r.id = a.zoom_room_id
  where s.id = p_session_id;
  if v_result is null then raise exception 'Intensive session not found' using errcode = '22023'; end if;
  return v_result;
end;
$$;

drop function if exists public.list_my_private_mentoring_sessions_v2();
create function public.list_my_private_mentoring_sessions_v2()
returns table(
  session_id uuid, enrollment_id uuid, session_number integer, status text,
  session_focus_id uuid, focus_name text, requested_focus_id uuid, mentee_topic_request text, topic_status text, resolved_topic text,
  mentor_id uuid, mentor_name text, primary_mentor_id uuid, primary_mentor_name text,
  scheduled_start_at timestamptz, scheduled_end_at timestamptz,
  mentor_tier_code text, mentor_tier_name text, package_id uuid, purchased_sessions integer,
  mentor_timezone text, duration_minutes integer, meeting_url text, google_event_id text, google_ical_uid text, google_sync_status text
)
language sql stable security definer set search_path = '' as $$
  select s.id, e.id, s.session_number, s.status::text, s.session_focus_id, coalesce(f.name, s.final_focus_custom_text)::text, s.requested_focus_id, s.mentee_topic_request, s.topic_status, s.resolved_topic,
    s.mentor_id, nullif(btrim(concat_ws(' ', mp.first_name, mp.last_name)), ''), e.primary_mentor_id, nullif(btrim(concat_ws(' ', primary_profile.first_name, primary_profile.last_name)), ''),
    s.scheduled_start_at, s.scheduled_end_at, t.code, t.name, e.package_id, e.purchased_sessions, mentor_profile.timezone, pkg.duration_minutes,
    case when s.status = 'scheduled' then coalesce(ci.manual_meeting_url, r.meeting_url) end,
    ci.google_event_id, ci.google_ical_uid, coalesce(ci.sync_status, 'pending')
  from public.private_mentoring_sessions s
  join public.private_mentoring_enrollments e on e.id = s.enrollment_id
  join public.private_mentoring_packages pkg on pkg.id = e.package_id
  join public.mentor_tiers t on t.id = pkg.mentor_tier_id
  left join public.private_mentoring_session_focuses f on f.id = s.session_focus_id
  left join public.profiles mp on mp.id = s.mentor_id
  left join public.profiles primary_profile on primary_profile.id = e.primary_mentor_id
  left join public.mentor_profiles mentor_profile on mentor_profile.user_id = s.mentor_id
  left join public.private_mentoring_session_calendar_integrations ci on ci.session_id = s.id
  left join public.mentoring_zoom_room_allocations a on a.private_session_id = s.id
  left join public.mentoring_zoom_rooms r on r.id = a.zoom_room_id
  where e.mentee_id = auth.uid()
  order by e.created_at desc, s.session_number;
$$;

drop function if exists public.list_my_mentor_private_mentoring_sessions();
create function public.list_my_mentor_private_mentoring_sessions()
returns table(
  session_id uuid, enrollment_id uuid, mentee_id uuid, mentee_name text, mentee_email text,
  session_number integer, purchased_sessions integer, status text, focus_name text, resolved_topic text, mentor_scope_notes text,
  scheduled_start_at timestamptz, scheduled_end_at timestamptz, mentor_timezone text, duration_minutes integer,
  meeting_url text, google_event_id text, google_ical_uid text, google_sync_status text
)
language sql stable security definer set search_path = '' as $$
  select s.id, e.id, e.mentee_id, nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), coalesce(u.email, '')::text,
    s.session_number, e.purchased_sessions, s.status::text, coalesce(s.resolved_topic, f.name, s.final_focus_custom_text)::text, s.resolved_topic, s.mentor_scope_notes,
    s.scheduled_start_at, s.scheduled_end_at, mentor_profile.timezone, pkg.duration_minutes,
    case when s.status = 'scheduled' then coalesce(ci.manual_meeting_url, r.meeting_url) end,
    ci.google_event_id, ci.google_ical_uid, coalesce(ci.sync_status, 'pending')
  from public.private_mentoring_sessions s
  join public.private_mentoring_enrollments e on e.id = s.enrollment_id
  join public.private_mentoring_packages pkg on pkg.id = e.package_id
  join public.profiles p on p.id = e.mentee_id
  join auth.users u on u.id = e.mentee_id
  join public.mentor_profiles mentor_profile on mentor_profile.user_id = s.mentor_id
  left join public.private_mentoring_session_focuses f on f.id = s.session_focus_id
  left join public.private_mentoring_session_calendar_integrations ci on ci.session_id = s.id
  left join public.mentoring_zoom_room_allocations a on a.private_session_id = s.id
  left join public.mentoring_zoom_rooms r on r.id = a.zoom_room_id
  where s.mentor_id = auth.uid()
  order by s.scheduled_start_at nulls last, s.session_number;
$$;

drop function if exists public.list_admin_private_mentoring_calendar_sessions(timestamptz, timestamptz);
create function public.list_admin_private_mentoring_calendar_sessions(p_from timestamptz, p_to timestamptz)
returns table(
  session_id uuid, enrollment_id uuid, mentee_id uuid, mentee_name text, mentee_email text,
  mentor_id uuid, mentor_name text, mentor_tier_name text, session_number integer, purchased_sessions integer,
  status text, focus_name text, scheduled_start_at timestamptz, scheduled_end_at timestamptz, mentor_timezone text, duration_minutes integer,
  meeting_url text, managed_meeting_url text, manual_meeting_url text, zoom_room_name text,
  google_event_id text, google_ical_uid text, google_sync_status text, google_sync_error text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  return query
  select s.id, e.id, e.mentee_id, nullif(btrim(concat_ws(' ', mentee.first_name, mentee.last_name)), ''), coalesce(mu.email, '')::text,
    s.mentor_id, nullif(btrim(concat_ws(' ', mentor.first_name, mentor.last_name)), ''), tier.name,
    s.session_number, e.purchased_sessions, s.status::text, coalesce(s.resolved_topic, f.name, s.final_focus_custom_text)::text, s.scheduled_start_at, s.scheduled_end_at, mentor_profile.timezone, pkg.duration_minutes,
    case when s.status = 'scheduled' then coalesce(ci.manual_meeting_url, r.meeting_url) end,
    case when s.status = 'scheduled' then r.meeting_url end,
    case when s.status = 'scheduled' then ci.manual_meeting_url end,
    r.name,
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
  left join public.mentoring_zoom_room_allocations a on a.private_session_id = s.id
  left join public.mentoring_zoom_rooms r on r.id = a.zoom_room_id
  where s.status <> 'cancelled' and s.scheduled_start_at is not null
    and (p_from is null or s.scheduled_end_at > p_from)
    and (p_to is null or s.scheduled_start_at < p_to)
  order by s.scheduled_start_at, s.id;
end;
$$;

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
  select s.id,e.id,s.session_number,s.status::text,s.session_focus_id,coalesce(f.name,s.final_focus_custom_text)::text,s.requested_focus_id,coalesce(rf.name,s.requested_focus_custom_text)::text,s.mentee_topic_request,s.topic_status,s.resolved_topic,s.mentor_scope_notes,
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

drop function if exists public.list_my_intensive_mentoring_engagements();
create function public.list_my_intensive_mentoring_engagements()
returns table(
  engagement_id uuid, base_entitlement_id uuid, base_kind text, program_name text, status text, baseline_sessions_per_month integer,
  primary_mentor_id uuid, primary_mentor_name text, competition_name text, program_stage text, current_activity text, progress_summary text, started_at timestamptz,
  add_ons jsonb, sessions jsonb
)
language sql stable security definer set search_path = '' as $$
  select g.id, g.base_entitlement_id, e.entitlement_kind, coalesce(p.name, b.name, o.title)::text, g.status, g.baseline_sessions_per_month, g.primary_mentor_id,
    nullif(btrim(concat_ws(' ', mentor.first_name, mentor.last_name)), '')::text, g.competition_name, g.program_stage, g.current_activity, g.progress_summary, g.started_at,
    public.intensive_engagement_add_ons_json(g.id),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'sessionId', s.id, 'sessionNumber', s.session_number, 'durationMinutes', s.duration_minutes, 'status', s.status,
        'focusId', s.session_focus_id, 'focusName', coalesce(f.name, s.final_focus_custom_text), 'menteeTopicRequest', s.mentee_topic_request,
        'topicStatus', s.topic_status, 'resolvedTopic', s.resolved_topic, 'mentorId', s.mentor_id,
        'mentorName', nullif(btrim(concat_ws(' ', sm.first_name, sm.last_name)), ''),
        'scheduledStartAt', s.scheduled_start_at, 'scheduledEndAt', s.scheduled_end_at,
        'meetingUrl', case when s.status = 'scheduled' then coalesce(ci.manual_meeting_url, r.meeting_url) end,
        'zoomRoomId', a.zoom_room_id, 'zoomRoomName', r.name,
        'googleSyncStatus', coalesce(ci.sync_status, 'pending'), 'creationSource', s.creation_source
      ) order by s.session_number)
      from public.intensive_mentoring_sessions s
      left join public.private_mentoring_session_focuses f on f.id = s.session_focus_id
      left join public.profiles sm on sm.id = s.mentor_id
      left join public.intensive_mentoring_session_calendar_integrations ci on ci.session_id = s.id
      left join public.mentoring_zoom_room_allocations a on a.intensive_session_id = s.id
      left join public.mentoring_zoom_rooms r on r.id = a.zoom_room_id
      where s.engagement_id = g.id
    ), '[]'::jsonb)
  from public.intensive_mentoring_engagements g
  join public.intensive_mentoring_entitlements e on e.id = g.base_entitlement_id
  left join public.intensive_mentoring_packages p on p.id = e.package_id
  left join public.intensive_mentoring_bundles b on b.id = e.bundle_id
  left join public.intensive_mentoring_custom_offers o on o.id = e.custom_offer_id
  left join public.profiles mentor on mentor.id = g.primary_mentor_id
  where g.mentee_id = auth.uid()
  order by g.created_at desc, g.id;
$$;

drop function if exists public.list_admin_intensive_mentoring_engagements();
create function public.list_admin_intensive_mentoring_engagements()
returns table(
  engagement_id uuid, mentee_id uuid, mentee_name text, mentee_email text, base_entitlement_id uuid, base_kind text, program_name text, status text,
  baseline_sessions_per_month integer, primary_mentor_id uuid, primary_mentor_name text, program_stage text, current_activity text, progress_summary text, created_at timestamptz,
  add_ons jsonb, sessions jsonb, unassigned_add_ons jsonb
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  return query
  select g.id, g.mentee_id, nullif(btrim(concat_ws(' ', mp.first_name, mp.last_name)), ''), coalesce(mu.email, '')::text,
    g.base_entitlement_id, e.entitlement_kind, coalesce(p.name, b.name, o.title)::text, g.status, g.baseline_sessions_per_month,
    g.primary_mentor_id, nullif(btrim(concat_ws(' ', mentor.first_name, mentor.last_name)), '')::text,
    g.program_stage, g.current_activity, g.progress_summary, g.created_at,
    public.intensive_engagement_add_ons_json(g.id),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'sessionId', s.id, 'sessionNumber', s.session_number, 'durationMinutes', s.duration_minutes, 'status', s.status,
        'focusId', s.session_focus_id, 'focusName', coalesce(f.name, s.final_focus_custom_text), 'menteeTopicRequest', s.mentee_topic_request,
        'topicStatus', s.topic_status, 'resolvedTopic', s.resolved_topic, 'mentorId', s.mentor_id,
        'mentorName', nullif(btrim(concat_ws(' ', sm.first_name, sm.last_name)), ''),
        'scheduledStartAt', s.scheduled_start_at, 'scheduledEndAt', s.scheduled_end_at,
        'meetingUrl', case when s.status = 'scheduled' then coalesce(ci.manual_meeting_url, r.meeting_url) end,
        'zoomRoomId', a.zoom_room_id, 'zoomRoomName', r.name,
        'googleSyncStatus', coalesce(ci.sync_status, 'pending'),
        'creationSource', s.creation_source, 'creationReason', s.creation_reason
      ) order by s.session_number)
      from public.intensive_mentoring_sessions s
      left join public.private_mentoring_session_focuses f on f.id = s.session_focus_id
      left join public.profiles sm on sm.id = s.mentor_id
      left join public.intensive_mentoring_session_calendar_integrations ci on ci.session_id = s.id
      left join public.mentoring_zoom_room_allocations a on a.intensive_session_id = s.id
      left join public.mentoring_zoom_rooms r on r.id = a.zoom_room_id
      where s.engagement_id = g.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('entitlementId', a.id, 'name', ao.name, 'code', ao.code, 'createdAt', a.created_at) order by a.created_at, a.id)
      from public.intensive_mentoring_entitlements a
      join public.intensive_mentoring_add_ons ao on ao.id = a.add_on_id
      where a.mentee_id = g.mentee_id and a.entitlement_kind = 'add_on' and a.engagement_id is null
    ), '[]'::jsonb)
  from public.intensive_mentoring_engagements g
  join public.intensive_mentoring_entitlements e on e.id = g.base_entitlement_id
  join public.profiles mp on mp.id = g.mentee_id
  join auth.users mu on mu.id = g.mentee_id
  left join public.intensive_mentoring_packages p on p.id = e.package_id
  left join public.intensive_mentoring_bundles b on b.id = e.bundle_id
  left join public.intensive_mentoring_custom_offers o on o.id = e.custom_offer_id
  left join public.profiles mentor on mentor.id = g.primary_mentor_id
  order by g.created_at desc, g.id;
end;
$$;

drop function if exists public.list_my_mentor_intensive_mentoring_sessions();
create function public.list_my_mentor_intensive_mentoring_sessions()
returns table(
  session_id uuid, engagement_id uuid, mentee_id uuid, mentee_name text, mentee_email text, program_name text,
  session_number integer, status text, focus_name text, resolved_topic text,
  scheduled_start_at timestamptz, scheduled_end_at timestamptz, mentor_timezone text, duration_minutes integer,
  meeting_url text, google_event_id text, google_ical_uid text, google_sync_status text, add_ons jsonb
)
language sql stable security definer set search_path = '' as $$
  select s.id, g.id, g.mentee_id, nullif(btrim(concat_ws(' ', mp.first_name, mp.last_name)), ''), coalesce(mu.email, '')::text,
    coalesce(p.name, b.name, o.title)::text, s.session_number, s.status, coalesce(f.name, s.final_focus_custom_text)::text, s.resolved_topic,
    s.scheduled_start_at, s.scheduled_end_at, mentor_profile.timezone, s.duration_minutes,
    case when s.status = 'scheduled' then coalesce(ci.manual_meeting_url, r.meeting_url) end,
    ci.google_event_id, ci.google_ical_uid, coalesce(ci.sync_status, 'pending'), public.intensive_engagement_add_ons_json(g.id)
  from public.intensive_mentoring_sessions s
  join public.intensive_mentoring_engagements g on g.id = s.engagement_id
  join public.intensive_mentoring_entitlements e on e.id = g.base_entitlement_id
  join public.profiles mp on mp.id = g.mentee_id
  join auth.users mu on mu.id = g.mentee_id
  join public.mentor_profiles mentor_profile on mentor_profile.user_id = s.mentor_id
  left join public.intensive_mentoring_packages p on p.id = e.package_id
  left join public.intensive_mentoring_bundles b on b.id = e.bundle_id
  left join public.intensive_mentoring_custom_offers o on o.id = e.custom_offer_id
  left join public.private_mentoring_session_focuses f on f.id = s.session_focus_id
  left join public.intensive_mentoring_session_calendar_integrations ci on ci.session_id = s.id
  left join public.mentoring_zoom_room_allocations a on a.intensive_session_id = s.id
  left join public.mentoring_zoom_rooms r on r.id = a.zoom_room_id
  where s.mentor_id = auth.uid()
  order by s.scheduled_start_at nulls last, s.session_number;
$$;

drop function if exists public.list_admin_intensive_mentoring_calendar_sessions(timestamptz, timestamptz);
create function public.list_admin_intensive_mentoring_calendar_sessions(p_from timestamptz, p_to timestamptz)
returns table(
  session_id uuid, enrollment_id uuid, mentee_id uuid, mentee_name text, mentee_email text,
  mentor_id uuid, mentor_name text, mentor_tier_name text, session_number integer, purchased_sessions integer,
  status text, focus_name text, scheduled_start_at timestamptz, scheduled_end_at timestamptz, mentor_timezone text, duration_minutes integer,
  meeting_url text, managed_meeting_url text, manual_meeting_url text, zoom_room_name text,
  google_event_id text, google_ical_uid text, google_sync_status text, google_sync_error text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  return query
  select s.id, g.id, g.mentee_id, nullif(btrim(concat_ws(' ', mentee.first_name, mentee.last_name)), ''), coalesce(mu.email, '')::text,
    s.mentor_id, nullif(btrim(concat_ws(' ', mentor.first_name, mentor.last_name)), ''), tier.name,
    s.session_number, g.baseline_sessions_per_month, s.status, coalesce(s.resolved_topic, f.name, s.final_focus_custom_text)::text,
    s.scheduled_start_at, s.scheduled_end_at, mp.timezone, s.duration_minutes,
    case when s.status = 'scheduled' then coalesce(ci.manual_meeting_url, r.meeting_url) end,
    case when s.status = 'scheduled' then r.meeting_url end,
    case when s.status = 'scheduled' then ci.manual_meeting_url end,
    r.name,
    ci.google_event_id, ci.google_ical_uid, coalesce(ci.sync_status, 'pending'), ci.sync_error
  from public.intensive_mentoring_sessions s
  join public.intensive_mentoring_engagements g on g.id = s.engagement_id
  join public.profiles mentee on mentee.id = g.mentee_id
  join auth.users mu on mu.id = g.mentee_id
  left join public.profiles mentor on mentor.id = s.mentor_id
  left join public.mentor_profiles mp on mp.user_id = s.mentor_id
  left join public.mentor_tiers tier on tier.id = mp.tier_id
  left join public.private_mentoring_session_focuses f on f.id = s.session_focus_id
  left join public.intensive_mentoring_session_calendar_integrations ci on ci.session_id = s.id
  left join public.mentoring_zoom_room_allocations a on a.intensive_session_id = s.id
  left join public.mentoring_zoom_rooms r on r.id = a.zoom_room_id
  where s.status <> 'cancelled' and s.scheduled_start_at is not null
    and (p_from is null or s.scheduled_end_at > p_from)
    and (p_to is null or s.scheduled_start_at < p_to)
  order by s.scheduled_start_at, s.id;
end;
$$;

drop function if exists public.list_my_intensive_mentoring_calendar_sessions();
create function public.list_my_intensive_mentoring_calendar_sessions()
returns table(
  session_id uuid, enrollment_id uuid, mentee_id uuid, mentee_name text, mentee_email text,
  mentor_id uuid, mentor_name text, mentor_tier_name text, session_number integer, purchased_sessions integer,
  status text, focus_name text, scheduled_start_at timestamptz, scheduled_end_at timestamptz, mentor_timezone text, duration_minutes integer,
  meeting_url text, managed_meeting_url text, manual_meeting_url text, zoom_room_name text,
  google_event_id text, google_ical_uid text, google_sync_status text, google_sync_error text
)
language sql stable security definer set search_path = '' as $$
  select s.id, g.id, g.mentee_id, nullif(btrim(concat_ws(' ', mentee.first_name, mentee.last_name)), ''), ''::text,
    s.mentor_id, nullif(btrim(concat_ws(' ', mentor.first_name, mentor.last_name)), ''), tier.name,
    s.session_number, g.baseline_sessions_per_month, s.status, coalesce(s.resolved_topic, f.name, s.final_focus_custom_text)::text,
    s.scheduled_start_at, s.scheduled_end_at, mp.timezone, s.duration_minutes,
    case when s.status = 'scheduled' then coalesce(ci.manual_meeting_url, r.meeting_url) end,
    null::text, null::text, r.name,
    ci.google_event_id, ci.google_ical_uid, coalesce(ci.sync_status, 'pending'), null::text
  from public.intensive_mentoring_sessions s
  join public.intensive_mentoring_engagements g on g.id = s.engagement_id
  join public.profiles mentee on mentee.id = g.mentee_id
  left join public.profiles mentor on mentor.id = s.mentor_id
  left join public.mentor_profiles mp on mp.user_id = s.mentor_id
  left join public.mentor_tiers tier on tier.id = mp.tier_id
  left join public.private_mentoring_session_focuses f on f.id = s.session_focus_id
  left join public.intensive_mentoring_session_calendar_integrations ci on ci.session_id = s.id
  left join public.mentoring_zoom_room_allocations a on a.intensive_session_id = s.id
  left join public.mentoring_zoom_rooms r on r.id = a.zoom_room_id
  where g.mentee_id = auth.uid() and s.status <> 'cancelled'
  order by s.scheduled_start_at nulls last, s.session_number;
$$;

revoke all on function public.get_admin_private_mentoring_enrollment_sessions(uuid) from public,anon;
grant execute on function public.get_admin_private_mentoring_enrollment_sessions(uuid) to authenticated,service_role;
revoke all on function public.list_my_private_mentoring_sessions_v2(),public.list_my_mentor_private_mentoring_sessions(),public.list_admin_private_mentoring_calendar_sessions(timestamptz,timestamptz),public.list_my_intensive_mentoring_engagements(),public.list_admin_intensive_mentoring_engagements(),public.list_my_mentor_intensive_mentoring_sessions(),public.list_admin_intensive_mentoring_calendar_sessions(timestamptz,timestamptz),public.list_my_intensive_mentoring_calendar_sessions() from public,anon;
grant execute on function public.list_my_private_mentoring_sessions_v2(),public.list_my_mentor_private_mentoring_sessions(),public.list_admin_private_mentoring_calendar_sessions(timestamptz,timestamptz),public.list_my_intensive_mentoring_engagements(),public.list_admin_intensive_mentoring_engagements(),public.list_my_mentor_intensive_mentoring_sessions(),public.list_admin_intensive_mentoring_calendar_sessions(timestamptz,timestamptz),public.list_my_intensive_mentoring_calendar_sessions() to authenticated,service_role;
revoke all on function public.service_get_private_mentoring_sync_context(uuid),public.service_get_intensive_mentoring_sync_context(uuid) from public,anon,authenticated;
grant execute on function public.service_get_private_mentoring_sync_context(uuid),public.service_get_intensive_mentoring_sync_context(uuid) to service_role;
