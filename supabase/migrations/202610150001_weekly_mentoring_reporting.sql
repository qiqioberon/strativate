-- Canonical operational session reporting. Entitlements supply package labels only, never counts.
create index if not exists private_sessions_reporting_start_idx
  on public.private_mentoring_sessions(scheduled_start_at,id);
create index if not exists intensive_sessions_reporting_start_idx
  on public.intensive_mentoring_sessions(scheduled_start_at,id);
create index if not exists private_sessions_reporting_undated_idx
  on public.private_mentoring_sessions(id) where scheduled_start_at is null or not isfinite(scheduled_start_at);
create index if not exists intensive_sessions_reporting_undated_idx
  on public.intensive_mentoring_sessions(id) where scheduled_start_at is null or not isfinite(scheduled_start_at);

create function public.admin_mentoring_reporting_rows(
  p_from date,p_to date,p_kind text,p_mentor text,p_status text,p_query text,p_mentee uuid
) returns table(
  kind text,session_id uuid,parent_id uuid,mentee_id uuid,mentee_name text,mentee_email text,
  mentor_id uuid,mentor_name text,program text,session_number integer,start_at timestamptz,
  end_at timestamptz,duration_minutes integer,status text,topic text,needs_review boolean,review_reason text
) language plpgsql stable security definer set search_path='' as $$
declare v_start timestamptz;v_end timestamptz;v_query text:=lower(btrim(coalesce(p_query,'')));
begin
  if not coalesce(public.is_admin(),false) then raise exception 'Admin required' using errcode='42501';end if;
  if p_to is null or p_to>date '9999-12-30' or p_to<date '0001-01-01' or (p_from is not null and (p_from>p_to or p_from<date '0001-01-01'))
    or p_kind is null or p_kind not in('all','private','intensive') or p_status is null or p_status not in('all','awaiting_focus','awaiting_scheduling','scheduled','completed','cancelled')
    or p_mentor is null or (p_mentor not in('all','unassigned') and p_mentor !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    or char_length(v_query)>200 then raise exception 'Invalid reporting filters' using errcode='22023';end if;
  v_start:=case when p_from is not null then p_from::timestamp at time zone 'Asia/Jakarta' end;
  v_end:=(p_to+1)::timestamp at time zone 'Asia/Jakarta';
  return query
  with canonical as (
    select 'private'::text kind,s.id session_id,s.enrollment_id parent_id,e.mentee_id,
      s.mentor_id,oi.name_snapshot::text program,s.session_number,
      case when isfinite(s.scheduled_start_at) then s.scheduled_start_at end start_at,
      case when isfinite(s.scheduled_end_at) then s.scheduled_end_at end end_at,
      case when isfinite(s.scheduled_start_at) and isfinite(s.scheduled_end_at)
        then round(extract(epoch from (s.scheduled_end_at-s.scheduled_start_at))/60)::integer else pkg.duration_minutes end duration_minutes,s.status::text status,
      coalesce(nullif(btrim(s.resolved_topic),''),f.name,nullif(btrim(s.final_focus_custom_text),''),nullif(btrim(s.mentee_topic_request),''))::text topic
    from public.private_mentoring_sessions s
    join public.private_mentoring_enrollments e on e.id=s.enrollment_id
    left join public.private_mentoring_packages pkg on pkg.id=e.package_id
    left join public.order_items oi on oi.id=e.order_item_id
    left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id
    where p_kind in('all','private')
      and (s.scheduled_start_at is null or not isfinite(s.scheduled_start_at) or ((v_start is null or s.scheduled_start_at>=v_start) and s.scheduled_start_at<v_end))
    union all
    select 'intensive'::text,s.id,s.engagement_id,e.mentee_id,s.mentor_id,oi.name_snapshot::text,
      s.session_number,case when isfinite(s.scheduled_start_at) then s.scheduled_start_at end,
      case when isfinite(s.scheduled_end_at) then s.scheduled_end_at end,s.duration_minutes,s.status::text,
      coalesce(nullif(btrim(s.resolved_topic),''),f.name,nullif(btrim(s.final_focus_custom_text),''),nullif(btrim(s.mentee_topic_request),''))::text
    from public.intensive_mentoring_sessions s
    join public.intensive_mentoring_engagements e on e.id=s.engagement_id
    left join public.intensive_mentoring_entitlements ent on ent.id=e.base_entitlement_id
    left join public.order_items oi on oi.id=ent.order_item_id
    left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id
    where p_kind in('all','intensive')
      and (s.scheduled_start_at is null or not isfinite(s.scheduled_start_at) or ((v_start is null or s.scheduled_start_at>=v_start) and s.scheduled_start_at<v_end))
  ), identified as (
    select c.*,coalesce(nullif(btrim(concat_ws(' ',mp.first_name,mp.last_name)),''),mu.email,'Mentee '||left(c.mentee_id::text,8))::text mentee_name,
      mu.email::text mentee_email,
      case when c.mentor_id is null then 'Unassigned' else coalesce(nullif(btrim(concat_ws(' ',tp.first_name,tp.last_name)),''),tu.email,'Mentor '||left(c.mentor_id::text,8)) end::text mentor_name
    from canonical c
    left join public.profiles mp on mp.id=c.mentee_id
    left join auth.users mu on mu.id=c.mentee_id
    left join public.profiles tp on tp.id=c.mentor_id
    left join auth.users tu on tu.id=c.mentor_id
    where (p_mentor='all' or (p_mentor='unassigned' and c.mentor_id is null) or c.mentor_id::text=lower(p_mentor))
      and (p_status='all' or c.status=p_status) and (p_mentee is null or c.mentee_id=p_mentee)
  )
  select c.kind,c.session_id,c.parent_id,c.mentee_id,c.mentee_name,c.mentee_email,c.mentor_id,c.mentor_name,c.program,
    c.session_number,c.start_at,c.end_at,c.duration_minutes,c.status,c.topic,
    (c.start_at is null or c.mentor_id is null or (c.status='scheduled' and coalesce(c.end_at,c.start_at)<current_timestamp)) needs_review,
    case when c.start_at is null then 'No scheduled date' when c.mentor_id is null then 'No assigned mentor'
      when c.status='scheduled' and coalesce(c.end_at,c.start_at)<current_timestamp then 'Past scheduled session' end::text review_reason
  from identified c
  where v_query='' or strpos(lower(c.mentee_name),v_query)>0 or strpos(lower(coalesce(c.mentee_email,'')),v_query)>0
    or strpos(c.session_id::text,v_query)>0 or strpos(c.parent_id::text,v_query)>0;
end;$$;

-- One shared snapshot and aggregation for weekly UI, arbitrary report periods and full XLSX exports.
create function public.get_admin_mentoring_report(
  p_from date default null,p_to date default (current_timestamp at time zone 'Asia/Jakarta')::date,
  p_kind text default 'all',p_mentor text default 'all',p_status text default 'all',p_query text default '',p_mentee uuid default null,
  p_session_page integer default 1,p_mentor_page integer default 1,p_mentee_page integer default 1,p_review_page integer default 1,
  p_page_size integer default 20,p_export boolean default false
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;v_size integer;v_count bigint;
begin
  if not coalesce(public.is_admin(),false) then raise exception 'Admin required' using errcode='42501';end if;
  if p_export is null or p_page_size is null or p_page_size<1 or p_page_size>100
    or p_session_page is null or p_mentor_page is null or p_mentee_page is null or p_review_page is null
    or least(p_session_page,p_mentor_page,p_mentee_page,p_review_page)<1
    or greatest(p_session_page,p_mentor_page,p_mentee_page,p_review_page)>1000000
    then raise exception 'Invalid reporting pagination' using errcode='22023';end if;
  v_size:=case when p_export then 50000 else p_page_size end;
  if p_export then
    select count(*) into v_count from (select 1 from public.admin_mentoring_reporting_rows(p_from,p_to,p_kind,p_mentor,p_status,p_query,p_mentee) limit 50001) bounded;
    if v_count>50000 then raise exception 'Export exceeds 50000 sessions. Narrow the period or filters.' using errcode='54000';end if;
  end if;
  with all_rows as materialized (
    select * from public.admin_mentoring_reporting_rows(p_from,p_to,p_kind,p_mentor,p_status,p_query,p_mentee)
  ), dated as (select * from all_rows where start_at is not null),
  mentors as (
    select mentor_id,mentor_name,count(*) total,count(*) filter(where status='completed') completed,
      count(*) filter(where status='scheduled') scheduled,count(*) filter(where status='cancelled') cancelled,
      count(*) filter(where status not in('completed','cancelled')) unfinished,count(distinct mentee_id) mentees,
      count(*) filter(where kind='private') private_sessions,count(*) filter(where kind='intensive') intensive_sessions
    from dated group by mentor_id,mentor_name
  ), mentees as (
    select mentee_id,mentee_name,mentee_email,mentor_id,mentor_name,count(*) total,
      count(*) filter(where status='completed') completed,count(*) filter(where status='scheduled') scheduled,
      count(*) filter(where status='cancelled') cancelled,count(*) filter(where status not in('completed','cancelled')) unfinished,
      count(*) filter(where kind='private') private_sessions,count(*) filter(where kind='intensive') intensive_sessions
    from dated group by mentee_id,mentee_name,mentee_email,mentor_id,mentor_name
  ), totals as (
    select count(*) total,count(*) filter(where status='completed') completed,count(*) filter(where status='scheduled') scheduled,
      count(*) filter(where status='cancelled') cancelled,count(*) filter(where status not in('completed','cancelled')) unfinished,
      count(distinct mentor_id) mentors,count(distinct mentee_id) mentees,count(*) filter(where kind='private') private_sessions,
      count(*) filter(where kind='intensive') intensive_sessions,count(*) filter(where needs_review) needs_review,
      count(*) filter(where mentor_id is null) unassigned,
      coalesce(round(100.0*count(*) filter(where status='completed')/nullif(count(*) filter(where status<>'cancelled'),0),1),0) completion_rate
    from dated
  )
  select jsonb_build_object(
    'range',jsonb_build_object('from',p_from,'to',p_to,'timezone','Asia/Jakarta','end_exclusive',(p_to+1)),
    'summary',(select to_jsonb(t) from totals t),
    'top_mentors',coalesce((select jsonb_agg(to_jsonb(m) order by m.completed desc,m.mentor_id) from (select * from mentors where mentor_id is not null and completed>0 order by completed desc,mentor_id limit 5)m),'[]'::jsonb),
    'mentors',jsonb_build_object('total_count',(select count(*) from mentors),'rows',coalesce((select jsonb_agg(to_jsonb(m) order by m.total desc,m.mentor_name,m.mentor_id nulls last) from (select * from mentors order by total desc,mentor_name,mentor_id nulls last limit v_size offset case when p_export then 0 else (p_mentor_page-1)*p_page_size end)m),'[]'::jsonb)),
    'mentees',jsonb_build_object('total_count',(select count(*) from mentees),'rows',coalesce((select jsonb_agg(to_jsonb(m) order by m.mentee_name,m.mentee_id,m.mentor_id nulls last) from (select * from mentees order by mentee_name,mentee_id,mentor_id nulls last limit v_size offset case when p_export then 0 else (p_mentee_page-1)*p_page_size end)m),'[]'::jsonb)),
    'sessions',jsonb_build_object('total_count',(select count(*) from dated),'rows',coalesce((select jsonb_agg(to_jsonb(s) order by s.start_at,s.kind,s.session_id) from (select * from dated order by start_at,kind,session_id limit v_size offset case when p_export then 0 else (p_session_page-1)*p_page_size end)s),'[]'::jsonb)),
    'review',jsonb_build_object('total_count',(select count(*) from all_rows where start_at is null),'rows',coalesce((select jsonb_agg(to_jsonb(s) order by s.mentee_name,s.mentee_id,s.kind,s.session_id) from (select * from all_rows where start_at is null order by mentee_name,mentee_id,kind,session_id limit v_size offset case when p_export then 0 else (p_review_page-1)*p_page_size end)s),'[]'::jsonb))
  ) into v_result;
  return v_result;
end;$$;

create function public.search_admin_reporting_mentors(p_query text default '',p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce(public.is_admin(),false) then raise exception 'Admin required' using errcode='42501';end if;
  if p_query is null or char_length(p_query)>200 or p_limit is null or p_limit<1 or p_limit>50 then raise exception 'Invalid mentor search' using errcode='22023';end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.name,x.id) from (
    select p.id,coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),u.email,'Mentor '||left(p.id::text,8))::text name
    from public.profiles p left join auth.users u on u.id=p.id
    where (exists(select 1 from public.private_mentoring_sessions s where s.mentor_id=p.id)
      or exists(select 1 from public.intensive_mentoring_sessions s where s.mentor_id=p.id))
      and (btrim(p_query)='' or strpos(lower(concat_ws(' ',p.first_name,p.last_name,u.email)),lower(btrim(p_query)))>0 or p.id::text=p_query)
    order by name,p.id limit p_limit
  )x),'[]'::jsonb);
end;$$;

revoke all on function public.admin_mentoring_reporting_rows(date,date,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.get_admin_mentoring_report(date,date,text,text,text,text,uuid,integer,integer,integer,integer,integer,boolean) from public,anon;
revoke all on function public.search_admin_reporting_mentors(text,integer) from public,anon;
grant execute on function public.get_admin_mentoring_report(date,date,text,text,text,text,uuid,integer,integer,integer,integer,integer,boolean),public.search_admin_reporting_mentors(text,integer) to authenticated;
