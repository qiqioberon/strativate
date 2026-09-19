-- Extend Admin mentoring search with canonical private_mentoring_sessions.id.
-- Forward-only projection change; no new source of truth.

create or replace function public.list_admin_private_mentoring_enrollments_page(
  p_query text default '',
  p_package_id uuid default null,
  p_tier_id uuid default null,
  p_progress text default 'all',
  p_from date default null,
  p_to date default null,
  p_limit integer default 10,
  p_offset integer default 0
)
returns table (
  total_count bigint,
  enrollment_id uuid,
  mentee_id uuid,
  mentee_email text,
  mentee_username text,
  mentee_name text,
  order_item_id uuid,
  order_id uuid,
  package_id uuid,
  package_name text,
  mentor_tier_id uuid,
  mentor_tier_code text,
  mentor_tier_name text,
  purchased_sessions integer,
  awaiting_focus_sessions integer,
  awaiting_scheduling_sessions integer,
  scheduled_sessions integer,
  completed_sessions integer,
  configured_sessions integer,
  enrollment_status text,
  purchased_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if coalesce(p_progress, 'all') not in ('all','needs_focus','needs_scheduling','configured','in_progress','completed') then
    raise exception 'Invalid progress filter' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then raise exception 'Invalid limit' using errcode = '22023'; end if;
  if p_offset is null or p_offset < 0 then raise exception 'Invalid offset' using errcode = '22023'; end if;
  if p_from is not null and p_to is not null and p_from > p_to then raise exception 'Invalid purchase date range' using errcode = '22023'; end if;

  return query
  with enrollment_rows as (
    select
      e.id as enrollment_id,
      e.mentee_id,
      coalesce(u.email, '')::text as mentee_email,
      coalesce(p.username, '')::text as mentee_username,
      coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), p.username, u.email, e.mentee_id::text)::text as mentee_name,
      e.order_item_id,
      oi.order_id,
      e.package_id,
      oi.name_snapshot::text as package_name,
      pkg.mentor_tier_id,
      tier.code::text as mentor_tier_code,
      tier.name::text as mentor_tier_name,
      e.purchased_sessions,
      (count(*) filter (where s.status = 'awaiting_focus'))::integer as awaiting_focus_sessions,
      (count(*) filter (where s.status = 'awaiting_scheduling'))::integer as awaiting_scheduling_sessions,
      (count(*) filter (where s.status = 'scheduled'))::integer as scheduled_sessions,
      (count(*) filter (where s.status = 'completed'))::integer as completed_sessions,
      (count(*) filter (where s.session_focus_id is not null and s.mentor_id is not null and s.scheduled_start_at is not null))::integer as configured_sessions,
      e.status::text as enrollment_status,
      coalesce(o.paid_at, o.created_at) as purchased_at
    from public.private_mentoring_enrollments e
    join public.private_mentoring_sessions s on s.enrollment_id = e.id
    join public.order_items oi on oi.id = e.order_item_id
    join public.orders o on o.id = oi.order_id
    join public.private_mentoring_packages pkg on pkg.id = e.package_id
    join public.mentor_tiers tier on tier.id = pkg.mentor_tier_id
    join public.profiles p on p.id = e.mentee_id
    join auth.users u on u.id = e.mentee_id
    where
      (btrim(coalesce(p_query, '')) = ''
        or concat_ws(' ', u.email, p.username, p.first_name, p.last_name, oi.name_snapshot, tier.name) ilike '%' || btrim(p_query) || '%'
        or e.id::text ilike '%' || btrim(p_query) || '%'
        or exists (
          select 1
          from public.private_mentoring_sessions search_session
          where search_session.enrollment_id = e.id
            and search_session.id::text ilike '%' || btrim(p_query) || '%'
        ))
      and (p_package_id is null or e.package_id = p_package_id)
      and (p_tier_id is null or pkg.mentor_tier_id = p_tier_id)
      and (p_from is null or coalesce(o.paid_at, o.created_at)::date >= p_from)
      and (p_to is null or coalesce(o.paid_at, o.created_at)::date <= p_to)
    group by e.id, e.mentee_id, u.email, p.username, p.first_name, p.last_name,
      e.order_item_id, oi.order_id, oi.name_snapshot, e.package_id, pkg.mentor_tier_id,
      tier.code, tier.name, e.purchased_sessions, e.status, o.paid_at, o.created_at
  ), filtered as (
    select * from enrollment_rows r
    where
      coalesce(p_progress, 'all') = 'all'
      or (p_progress = 'needs_focus' and r.awaiting_focus_sessions > 0)
      or (p_progress = 'needs_scheduling' and r.awaiting_scheduling_sessions > 0)
      or (p_progress = 'configured' and r.configured_sessions = r.purchased_sessions and r.completed_sessions < r.purchased_sessions)
      or (p_progress = 'in_progress' and r.configured_sessions > 0 and r.completed_sessions < r.purchased_sessions)
      or (p_progress = 'completed' and r.completed_sessions = r.purchased_sessions)
  )
  select
    count(*) over() as total_count,
    r.enrollment_id, r.mentee_id, r.mentee_email, r.mentee_username, r.mentee_name,
    r.order_item_id, r.order_id, r.package_id, r.package_name,
    r.mentor_tier_id, r.mentor_tier_code, r.mentor_tier_name,
    r.purchased_sessions, r.awaiting_focus_sessions, r.awaiting_scheduling_sessions,
    r.scheduled_sessions, r.completed_sessions, r.configured_sessions,
    r.enrollment_status, r.purchased_at
  from filtered r
  order by r.purchased_at desc, r.enrollment_id
  limit greatest(1, least(p_limit, 100))
  offset greatest(p_offset, 0);
end;
$$;


revoke all on function public.list_admin_private_mentoring_enrollments_page(text,uuid,uuid,text,date,date,integer,integer) from public, anon;
grant execute on function public.list_admin_private_mentoring_enrollments_page(text,uuid,uuid,text,date,date,integer,integer) to authenticated;
