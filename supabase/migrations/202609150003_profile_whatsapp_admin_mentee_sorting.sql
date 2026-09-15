-- Optional WhatsApp contact on profiles and an admin-only, read-only Mentee projection.
-- Direct profile ownership stays unchanged: users may update their own contact data;
-- admins can read the projection but RLS still prevents editing another user's profile.

alter table public.profiles add column if not exists whatsapp_number text;

create or replace function public.normalize_whatsapp_number(p_value text)
returns text
language sql immutable set search_path = '' as $$
  with cleaned as (
    select regexp_replace(btrim(coalesce(p_value, '')), '[[:space:]().-]+', '', 'g') as value
  )
  select case
    when value = '' then null
    when value like '08%' then '+62' || substr(value, 2)
    when value like '628%' then '+' || value
    else value
  end
  from cleaned;
$$;

update public.profiles
set whatsapp_number = public.normalize_whatsapp_number(whatsapp_number)
where whatsapp_number is not null;

alter table public.profiles drop constraint if exists profiles_whatsapp_number_format;
alter table public.profiles add constraint profiles_whatsapp_number_format
  check (whatsapp_number is null or whatsapp_number ~ '^\+628[0-9]{7,11}$');

create or replace function public.normalize_profile_whatsapp()
returns trigger
language plpgsql set search_path = '' as $$
begin
  new.whatsapp_number := public.normalize_whatsapp_number(new.whatsapp_number);
  return new;
end;
$$;

drop trigger if exists profiles_normalize_whatsapp on public.profiles;
create trigger profiles_normalize_whatsapp
before insert or update of whatsapp_number on public.profiles
for each row execute function public.normalize_profile_whatsapp();

grant update (whatsapp_number) on public.profiles to authenticated;

create function public.list_admin_mentees_page(
  p_query text default '',
  p_sort_key text default 'created_at',
  p_sort_direction text default 'desc',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  total_count bigint,
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  username text,
  whatsapp_number text,
  registration_method text,
  created_at timestamptz,
  institution_name text,
  institution_type text,
  institution_city text,
  institution_province text,
  major_or_faculty text,
  cohort_year integer,
  referral_source_name text,
  referral_other_text text,
  other_interest_text text,
  onboarding_step integer,
  onboarding_completed_at timestamptz,
  interests jsonb
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_query text := btrim(coalesce(p_query, ''));
  v_sort_key text := coalesce(p_sort_key, 'created_at');
  v_sort_direction text := lower(coalesce(p_sort_direction, 'desc'));
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if v_sort_key not in ('name', 'email', 'whatsapp', 'institution', 'created_at') then
    raise exception 'Invalid Mentee sort key' using errcode = '22023';
  end if;
  if v_sort_direction not in ('asc', 'desc') then
    raise exception 'Invalid Mentee sort direction' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then raise exception 'Invalid limit' using errcode = '22023'; end if;
  if p_offset is null or p_offset < 0 then raise exception 'Invalid offset' using errcode = '22023'; end if;

  return query
  with rows as (
    select
      p.id as user_id,
      coalesce(u.email::text, '') as email,
      p.first_name,
      p.last_name,
      p.username,
      p.whatsapp_number,
      p.registration_method::text as registration_method,
      p.created_at,
      i.name::text as institution_name,
      i.type::text as institution_type,
      i.city::text as institution_city,
      i.province::text as institution_province,
      mp.major_or_faculty,
      mp.cohort_year,
      rs.name::text as referral_source_name,
      mp.referral_other_text,
      mp.other_interest_text,
      mp.onboarding_step,
      mp.onboarding_completed_at,
      coalesce(interests.names, '[]'::jsonb) as interests,
      lower(coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), p.username, u.email::text, p.id::text)) as name_sort
    from public.profiles p
    join auth.users u on u.id = p.id
    join public.mentee_profiles mp on mp.user_id = p.id
    left join public.institutions i on i.id = mp.institution_id
    left join public.referral_sources rs on rs.id = mp.referral_source_id
    left join lateral (
      select jsonb_agg(ints.name order by ints.sort_order, ints.name) as names
      from public.mentee_interests mi
      join public.interests ints on ints.id = mi.interest_id
      where mi.user_id = p.id
    ) interests on true
    where p.role = 'mentee'::public.app_role
      and (
        v_query = ''
        or concat_ws(' ', p.first_name, p.last_name, p.username, u.email::text, p.whatsapp_number, i.name, mp.major_or_faculty) ilike '%' || v_query || '%'
      )
  ), counted as (
    select r.*, count(*) over() as total_count from rows r
  )
  select
    c.total_count, c.user_id, c.email, c.first_name, c.last_name, c.username,
    c.whatsapp_number, c.registration_method, c.created_at, c.institution_name,
    c.institution_type, c.institution_city, c.institution_province,
    c.major_or_faculty, c.cohort_year, c.referral_source_name, c.referral_other_text,
    c.other_interest_text, c.onboarding_step, c.onboarding_completed_at, c.interests
  from counted c
  order by
    case when v_sort_key = 'name' and v_sort_direction = 'asc' then c.name_sort end asc nulls last,
    case when v_sort_key = 'name' and v_sort_direction = 'desc' then c.name_sort end desc nulls last,
    case when v_sort_key = 'email' and v_sort_direction = 'asc' then lower(c.email) end asc nulls last,
    case when v_sort_key = 'email' and v_sort_direction = 'desc' then lower(c.email) end desc nulls last,
    case when v_sort_key = 'whatsapp' and v_sort_direction = 'asc' then c.whatsapp_number end asc nulls last,
    case when v_sort_key = 'whatsapp' and v_sort_direction = 'desc' then c.whatsapp_number end desc nulls last,
    case when v_sort_key = 'institution' and v_sort_direction = 'asc' then lower(c.institution_name) end asc nulls last,
    case when v_sort_key = 'institution' and v_sort_direction = 'desc' then lower(c.institution_name) end desc nulls last,
    case when v_sort_key = 'created_at' and v_sort_direction = 'asc' then c.created_at end asc nulls last,
    case when v_sort_key = 'created_at' and v_sort_direction = 'desc' then c.created_at end desc nulls last,
    c.created_at desc,
    c.user_id
  limit greatest(1, least(p_limit, 100))
  offset greatest(p_offset, 0);
end;
$$;

revoke all on function public.list_admin_mentees_page(text,text,text,integer,integer) from public, anon;
grant execute on function public.list_admin_mentees_page(text,text,text,integer,integer) to authenticated;
