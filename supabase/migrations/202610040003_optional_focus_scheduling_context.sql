-- Keep optional focus/topic from blocking scheduling discovery and show custom final focus in slot context.
create or replace function public.admin_get_private_mentoring_slot_context(p_session_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  select jsonb_build_object(
    'sessionId', s.id, 'status', s.status, 'topicStatus', s.topic_status,
    'focusName', coalesce(s.resolved_topic, f.name, s.final_focus_custom_text), 'resolvedTopic', s.resolved_topic,
    'requiredTierId', pkg.mentor_tier_id, 'durationMinutes', pkg.duration_minutes,
    'menteeId', e.mentee_id, 'purchasedSessions', e.purchased_sessions,
    'sessionNumber', s.session_number, 'primaryMentorRequired', e.purchased_sessions >= 5,
    'primaryMentorId', e.primary_mentor_id,
    'mentors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'mentorId', mp.user_id,
        'mentorName', coalesce(nullif(btrim(concat_ws(' ', pp.first_name, pp.last_name)), ''), au.email),
        'tierId', mp.tier_id, 'active', mp.is_active, 'timezone', mp.timezone,
        'availability', coalesce((select jsonb_agg(jsonb_build_object(
          'start', (((a.week_start_date + (a.day_of_week - 1))::date + a.start_time) at time zone mp.timezone),
          'end', (((a.week_start_date + (a.day_of_week - 1))::date + a.end_time) at time zone mp.timezone)
        ) order by a.week_start_date, a.day_of_week, a.start_time)
          from public.mentor_availability_rules a
          where a.mentor_id = mp.user_id and a.week_start_date in (
            date_trunc('week', current_timestamp at time zone mp.timezone)::date,
            date_trunc('week', current_timestamp at time zone mp.timezone)::date + 7
          )), '[]'::jsonb),
        'strativate_busy', coalesce((
          select jsonb_agg(jsonb_build_object('start', busy.starts_at, 'end', busy.ends_at) order by busy.starts_at)
          from (
            select other.scheduled_start_at as starts_at, other.scheduled_end_at as ends_at
            from public.private_mentoring_sessions other
            where other.mentor_id = mp.user_id and other.id <> s.id
              and other.status in ('scheduled', 'completed') and other.scheduled_start_at is not null
            union all
            select other.scheduled_start_at, other.scheduled_end_at
            from public.intensive_mentoring_sessions other
            where other.mentor_id = mp.user_id and other.status in ('scheduled', 'completed')
              and other.scheduled_start_at is not null
          ) busy
        ), '[]'::jsonb)
      ) order by coalesce(pp.first_name, ''), coalesce(pp.last_name, ''), mp.user_id)
      from public.mentor_profiles mp
      join public.profiles pp on pp.id = mp.user_id and pp.role = 'mentor'::public.app_role
      join auth.users au on au.id = mp.user_id
      where mp.tier_id = pkg.mentor_tier_id and mp.is_active
        and (e.purchased_sessions < 5 or mp.user_id = e.primary_mentor_id)
    ), '[]'::jsonb)
  ) into v_result
  from public.private_mentoring_sessions s
  join public.private_mentoring_enrollments e on e.id = s.enrollment_id
  join public.private_mentoring_packages pkg on pkg.id = e.package_id
  left join public.private_mentoring_session_focuses f on f.id = s.session_focus_id
  where s.id = p_session_id;
  if v_result is null then raise exception 'Private Mentoring session not found' using errcode = '22023'; end if;
  return v_result;
end;
$$;

create or replace function public.admin_get_intensive_mentoring_slot_context(p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 select jsonb_build_object('sessionId',s.id,'status',s.status,'focusName',coalesce(s.resolved_topic,f.name,s.final_focus_custom_text),'requiredTierId',null,'durationMinutes',s.duration_minutes,'menteeId',g.mentee_id,'purchasedSessions',g.baseline_sessions_per_month,'sessionNumber',s.session_number,'primaryMentorId',g.primary_mentor_id,
 'mentors',coalesce((select jsonb_agg(jsonb_build_object('mentorId',m.user_id,'mentorName',coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),u.email),'tierId',m.tier_id,'active',m.is_active,'timezone',m.timezone,'availability',coalesce((select jsonb_agg(jsonb_build_object('start',(((a.week_start_date+(a.day_of_week-1))::date+a.start_time) at time zone m.timezone),'end',(((a.week_start_date+(a.day_of_week-1))::date+a.end_time) at time zone m.timezone)) order by a.week_start_date,a.day_of_week,a.start_time) from public.mentor_availability_rules a where a.mentor_id=m.user_id and a.week_start_date in(date_trunc('week',current_timestamp at time zone m.timezone)::date,date_trunc('week',current_timestamp at time zone m.timezone)::date+7)),'[]'::jsonb),'strativate_busy',coalesce((select jsonb_agg(jsonb_build_object('start',busy.start_at,'end',busy.end_at) order by busy.start_at) from (select ps.scheduled_start_at start_at,ps.scheduled_end_at end_at from public.private_mentoring_sessions ps where ps.mentor_id=m.user_id and ps.status in('scheduled','completed') union all select isess.scheduled_start_at,isess.scheduled_end_at from public.intensive_mentoring_sessions isess where isess.mentor_id=m.user_id and isess.id<>s.id and isess.status in('scheduled','completed'))busy),'[]'::jsonb)) order by case when m.user_id=g.primary_mentor_id then 0 else 1 end,coalesce(p.first_name,''),coalesce(p.last_name,'')) from public.mentor_profiles m join public.profiles p on p.id=m.user_id and p.role='mentor'::public.app_role join auth.users u on u.id=m.user_id where m.is_active),'[]'::jsonb))
 into v_result from public.intensive_mentoring_sessions s join public.intensive_mentoring_engagements g on g.id=s.engagement_id left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id where s.id=p_session_id;
 if v_result is null then raise exception 'Intensive session not found' using errcode='22023';end if;
 return v_result;
end; $$;

revoke all on function public.admin_get_private_mentoring_slot_context(uuid),public.admin_get_intensive_mentoring_slot_context(uuid) from public,anon;
grant execute on function public.admin_get_private_mentoring_slot_context(uuid),public.admin_get_intensive_mentoring_slot_context(uuid) to authenticated,service_role;
