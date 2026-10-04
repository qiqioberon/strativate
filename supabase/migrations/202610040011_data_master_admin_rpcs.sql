create function public.admin_delete_master_option(p_table text, p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin required' using errcode = '42501';
  end if;

  if p_table = 'referral_sources' then
    perform 1 from public.referral_sources where id = p_id for update;
    if not found then return 'not_found'; end if;
    if exists (select 1 from public.mentee_profiles where referral_source_id = p_id) then
      return 'deactivate_required';
    end if;
    delete from public.referral_sources where id = p_id;
  elsif p_table = 'interests' then
    perform 1 from public.interests where id = p_id for update;
    if not found then return 'not_found'; end if;
    if exists (select 1 from public.mentee_interests where interest_id = p_id) then
      return 'deactivate_required';
    end if;
    delete from public.interests where id = p_id;
  else
    raise exception 'Unsupported master option table' using errcode = '22023';
  end if;

  return 'deleted';
end;
$$;

create function public.admin_reorder_master_options(p_table text, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  if p_ids is null then
    raise exception 'Reorder list is required' using errcode = '22023';
  end if;

  if p_table = 'referral_sources' then
    lock table public.referral_sources in share row exclusive mode;
    if cardinality(p_ids) <> (select count(*) from public.referral_sources) then
      raise exception 'Reorder list must include every referral source exactly once' using errcode = '22023';
    end if;
    if cardinality(p_ids) <> (select count(distinct ids.id) from unnest(p_ids) as ids(id)) then
      raise exception 'Duplicate referral source in reorder list' using errcode = '22023';
    end if;
    if exists (select 1 from unnest(p_ids) as ids(id) left join public.referral_sources item on item.id = ids.id where item.id is null) then
      raise exception 'Unknown referral source in reorder list' using errcode = '22023';
    end if;
    update public.referral_sources item
    set sort_order = ordered.ordinality::integer * 10
    from unnest(p_ids) with ordinality as ordered(id, ordinality)
    where item.id = ordered.id;
  elsif p_table = 'interests' then
    lock table public.interests in share row exclusive mode;
    if cardinality(p_ids) <> (select count(*) from public.interests) then
      raise exception 'Reorder list must include every interest exactly once' using errcode = '22023';
    end if;
    if cardinality(p_ids) <> (select count(distinct ids.id) from unnest(p_ids) as ids(id)) then
      raise exception 'Duplicate interest in reorder list' using errcode = '22023';
    end if;
    if exists (select 1 from unnest(p_ids) as ids(id) left join public.interests item on item.id = ids.id where item.id is null) then
      raise exception 'Unknown interest in reorder list' using errcode = '22023';
    end if;
    update public.interests item
    set sort_order = ordered.ordinality::integer * 10
    from unnest(p_ids) with ordinality as ordered(id, ordinality)
    where item.id = ordered.id;
  else
    raise exception 'Unsupported master option table' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.admin_delete_master_option(text, uuid), public.admin_reorder_master_options(text, uuid[]) from public, anon, authenticated;
grant execute on function public.admin_delete_master_option(text, uuid), public.admin_reorder_master_options(text, uuid[]) to authenticated, service_role;
