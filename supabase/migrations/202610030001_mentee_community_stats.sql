-- Aggregate-only community statistics for the Mentee dashboard.
-- No user identifiers or contact fields leave this function.

create or replace function public.get_mentee_community_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null or not exists (
    select 1
    from public.profiles p
    where p.id = v_uid
      and p.role = 'mentee'::public.app_role
  ) then
    raise exception 'Mentee account required' using errcode = '42501';
  end if;

  with eligible_mentees as (
    select mp.user_id, mp.institution_id
    from public.mentee_profiles mp
    join public.profiles p on p.id = mp.user_id
    where p.role = 'mentee'::public.app_role
      and mp.onboarding_completed_at is not null
  ),
  school_counts as (
    select
      i.name::text as label,
      i.type::text as type,
      count(distinct e.user_id)::integer as mentee_count
    from eligible_mentees e
    join public.institutions i on i.id = e.institution_id
    where i.approval_status = 'approved'::public.institution_approval_status
      and i.type in ('sma'::public.institution_type, 'smk'::public.institution_type)
    group by i.name, i.type
  ),
  university_counts as (
    select
      i.name::text as label,
      count(distinct e.user_id)::integer as mentee_count
    from eligible_mentees e
    join public.institutions i on i.id = e.institution_id
    where i.approval_status = 'approved'::public.institution_approval_status
      and i.type = 'university'::public.institution_type
    group by i.name
  ),
  category_counts as (
    select
      interests.name::text as label,
      count(distinct e.user_id)::integer as mentee_count
    from eligible_mentees e
    join public.mentee_interests mi on mi.user_id = e.user_id
    join public.interests interests on interests.id = mi.interest_id
    group by interests.id, interests.name
  )
  select jsonb_build_object(
    'totalMentees', (select count(*)::integer from eligible_mentees),
    'schools', coalesce((
      select jsonb_agg(
        jsonb_build_object('label', label, 'type', type, 'count', mentee_count)
        order by mentee_count desc, label asc, type asc
      )
      from school_counts
    ), '[]'::jsonb),
    'universities', coalesce((
      select jsonb_agg(
        jsonb_build_object('label', label, 'count', mentee_count)
        order by mentee_count desc, label asc
      )
      from university_counts
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object('label', label, 'count', mentee_count)
        order by mentee_count desc, label asc
      )
      from category_counts
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_mentee_community_stats() from public, anon;
grant execute on function public.get_mentee_community_stats() to authenticated;
