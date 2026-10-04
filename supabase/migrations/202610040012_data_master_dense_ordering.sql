-- Dense positions are limited to these three Data Master domains.
-- Serialize normalization with writes; preserve the existing order and stable ties.
do $$
begin
  lock table public.mentor_expertise, public.referral_sources, public.interests in share row exclusive mode;

  with ordered as (
    select id, row_number() over (order by sort_order, name, id)::integer as position
    from public.mentor_expertise
  )
  update public.mentor_expertise item set sort_order = ordered.position
  from ordered where item.id = ordered.id and item.sort_order <> ordered.position;

  with ordered as (
    select id, row_number() over (order by sort_order, name, id)::integer as position
    from public.referral_sources
  )
  update public.referral_sources item set sort_order = ordered.position
  from ordered where item.id = ordered.id and item.sort_order <> ordered.position;

  with ordered as (
    select id, row_number() over (order by sort_order, name, id)::integer as position
    from public.interests
  )
  update public.interests item set sort_order = ordered.position
  from ordered where item.id = ordered.id and item.sort_order <> ordered.position;
end;
$$;

create or replace function public.admin_upsert_mentor_expertise(
  p_name text, p_id uuid default null, p_is_active boolean default true, p_sort_order integer default null
)
returns public.mentor_expertise
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text;
  v_position integer;
  v_last_position integer;
  v_row public.mentor_expertise;
begin
  if not public.is_admin() then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 100 then
    raise exception 'Expertise name is required' using errcode = '22023';
  end if;
  if p_is_active is null then
    raise exception 'Expertise status is required' using errcode = '22023';
  end if;
  if p_sort_order is not null and p_sort_order < 1 then
    raise exception 'Order position must be at least 1' using errcode = '22023';
  end if;

  lock table public.mentor_expertise in share row exclusive mode;
  if exists (select 1 from public.mentor_expertise where lower(name) = lower(v_name) and id is distinct from p_id) then
    raise exception 'Expertise name already exists' using errcode = '23505';
  end if;
  if p_id is null then
    v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
    if v_slug = '' then
      raise exception 'Expertise name cannot form a stable slug' using errcode = '22023';
    end if;
    if exists (select 1 from public.mentor_expertise where slug = v_slug) then
      raise exception 'Expertise slug already exists' using errcode = '23505';
    end if;
  else
    select ordered.position into v_position from (
      select id, row_number() over (order by sort_order, name, id)::integer as position
      from public.mentor_expertise
    ) ordered where ordered.id = p_id;
    if not found then
      raise exception 'Expertise not found' using errcode = '22023';
    end if;
  end if;

  select count(*)::integer + 1 into v_last_position
  from public.mentor_expertise where id is distinct from p_id;
  v_position := least(coalesce(p_sort_order, v_position, v_last_position), v_last_position);

  -- Remove the moving record from the sequence, then open its requested slot.
  with ordered as (
    select id, row_number() over (order by sort_order, name, id)::integer as position
    from public.mentor_expertise where id is distinct from p_id
  )
  update public.mentor_expertise item
  set sort_order = ordered.position + case when ordered.position >= v_position then 1 else 0 end
  from ordered where item.id = ordered.id
    and item.sort_order <> ordered.position + case when ordered.position >= v_position then 1 else 0 end;

  if p_id is null then
    insert into public.mentor_expertise(name, slug, sort_order, is_active)
    values (v_name, v_slug, v_position, p_is_active) returning * into v_row;
  else
    update public.mentor_expertise set name = v_name, is_active = p_is_active, sort_order = v_position
    where id = p_id returning * into v_row;
  end if;
  return v_row;
end;
$$;

-- Manual moves must shift neighbors in the same transaction as the save.
create function public.admin_upsert_master_option(
  p_table text, p_name text, p_id uuid default null, p_is_active boolean default true, p_sort_order integer default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_position integer;
  v_last_position integer;
begin
  if not public.is_admin() then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  if p_table is null or p_table not in ('referral_sources', 'interests') then
    raise exception 'Unsupported master option table' using errcode = '22023';
  end if;
  if char_length(v_name) not between 1 and 100 then
    raise exception 'Master option name is required' using errcode = '22023';
  end if;
  if p_is_active is null then
    raise exception 'Master option status is required' using errcode = '22023';
  end if;
  if p_sort_order is not null and p_sort_order < 1 then
    raise exception 'Order position must be at least 1' using errcode = '22023';
  end if;

  -- The identifier is quoted and restricted to the whitelist above.
  execute format('lock table public.%I in share row exclusive mode', p_table);
  if p_id is not null then
    execute format(
      'select ordered.position from (
        select id, row_number() over (order by sort_order, name, id)::integer as position
        from public.%I
      ) ordered where ordered.id = $1', p_table
    ) into v_position using p_id;
    if v_position is null then
      raise exception 'Master option not found' using errcode = '22023';
    end if;
  end if;
  execute format('select count(*)::integer + 1 from public.%I where id is distinct from $1', p_table)
    into v_last_position using p_id;
  v_position := least(coalesce(p_sort_order, v_position, v_last_position), v_last_position);

  execute format(
    'with ordered as (
      select id, row_number() over (order by sort_order, name, id)::integer as position
      from public.%I where id is distinct from $1
    )
    update public.%I item
    set sort_order = ordered.position + case when ordered.position >= $2 then 1 else 0 end
    from ordered where item.id = ordered.id
      and item.sort_order <> ordered.position + case when ordered.position >= $2 then 1 else 0 end',
    p_table, p_table
  ) using p_id, v_position;
  if p_id is null then
    execute format('insert into public.%I(name, sort_order, is_active) values ($1, $2, $3)', p_table)
      using v_name, v_position, p_is_active;
  else
    execute format('update public.%I set name = $1, sort_order = $2, is_active = $3 where id = $4', p_table)
      using v_name, v_position, p_is_active, p_id;
  end if;
end;
$$;

create or replace function public.admin_reorder_mentor_expertise(p_ids uuid[])
returns setof public.mentor_expertise
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  lock table public.mentor_expertise in share row exclusive mode;
  if p_ids is null or cardinality(p_ids) <> (select count(*) from public.mentor_expertise) then
    raise exception 'Reorder list must include every expertise exactly once' using errcode = '22023';
  end if;
  if cardinality(p_ids) <> (select count(distinct ids.id) from unnest(p_ids) as ids(id)) then
    raise exception 'Duplicate expertise in reorder list' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_ids) as ids(id) left join public.mentor_expertise item on item.id = ids.id where item.id is null) then
    raise exception 'Unknown expertise in reorder list' using errcode = '22023';
  end if;
  update public.mentor_expertise item set sort_order = ordered.ordinality::integer
  from unnest(p_ids) with ordinality as ordered(id, ordinality) where item.id = ordered.id;
  return query select * from public.mentor_expertise order by sort_order, name, id;
end;
$$;

create or replace function public.admin_reorder_master_options(p_table text, p_ids uuid[])
returns void
language plpgsql security definer set search_path = ''
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
    update public.referral_sources item set sort_order = ordered.ordinality::integer
    from unnest(p_ids) with ordinality as ordered(id, ordinality) where item.id = ordered.id;
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
    update public.interests item set sort_order = ordered.ordinality::integer
    from unnest(p_ids) with ordinality as ordered(id, ordinality) where item.id = ordered.id;
  else
    raise exception 'Unsupported master option table' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.admin_delete_mentor_expertise(p_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  lock table public.mentor_expertise in share row exclusive mode;
  perform 1 from public.mentor_expertise where id = p_id for update;
  if not found then
    raise exception 'Expertise not found' using errcode = '22023';
  end if;
  if exists (select 1 from public.mentor_public_profile_expertise where expertise_id = p_id) then
    return 'deactivate_required';
  end if;
  delete from public.mentor_expertise where id = p_id;
  with ordered as (
    select id, row_number() over (order by sort_order, name, id)::integer as position
    from public.mentor_expertise
  )
  update public.mentor_expertise item set sort_order = ordered.position
  from ordered where item.id = ordered.id and item.sort_order <> ordered.position;
  return 'deleted';
end;
$$;

create or replace function public.admin_delete_master_option(p_table text, p_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  if p_table = 'referral_sources' then
    lock table public.referral_sources in share row exclusive mode;
    perform 1 from public.referral_sources where id = p_id for update;
    if not found then return 'not_found'; end if;
    if exists (select 1 from public.mentee_profiles where referral_source_id = p_id) then
      return 'deactivate_required';
    end if;
    delete from public.referral_sources where id = p_id;
    with ordered as (
      select id, row_number() over (order by sort_order, name, id)::integer as position
      from public.referral_sources
    )
    update public.referral_sources item set sort_order = ordered.position
    from ordered where item.id = ordered.id and item.sort_order <> ordered.position;
  elsif p_table = 'interests' then
    lock table public.interests in share row exclusive mode;
    perform 1 from public.interests where id = p_id for update;
    if not found then return 'not_found'; end if;
    if exists (select 1 from public.mentee_interests where interest_id = p_id) then
      return 'deactivate_required';
    end if;
    delete from public.interests where id = p_id;
    with ordered as (
      select id, row_number() over (order by sort_order, name, id)::integer as position
      from public.interests
    )
    update public.interests item set sort_order = ordered.position
    from ordered where item.id = ordered.id and item.sort_order <> ordered.position;
  else
    raise exception 'Unsupported master option table' using errcode = '22023';
  end if;
  return 'deleted';
end;
$$;

-- Retain the existing execution boundary for replacements and the new save RPC.
revoke all on function
  public.admin_upsert_mentor_expertise(text, uuid, boolean, integer),
  public.admin_upsert_master_option(text, text, uuid, boolean, integer),
  public.admin_reorder_mentor_expertise(uuid[]),
  public.admin_reorder_master_options(text, uuid[]),
  public.admin_delete_mentor_expertise(uuid),
  public.admin_delete_master_option(text, uuid)
from public, anon, authenticated;

grant execute on function
  public.admin_upsert_mentor_expertise(text, uuid, boolean, integer),
  public.admin_upsert_master_option(text, text, uuid, boolean, integer),
  public.admin_reorder_mentor_expertise(uuid[]),
  public.admin_reorder_master_options(text, uuid[]),
  public.admin_delete_mentor_expertise(uuid),
  public.admin_delete_master_option(text, uuid)
to authenticated, service_role;
