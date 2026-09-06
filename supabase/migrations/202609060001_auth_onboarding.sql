-- Roles are database-owned. Browser metadata is never an authorization source.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

create type public.app_role as enum ('admin', 'mentor', 'mentee');
create type public.institution_type as enum ('university', 'sma', 'smk');
create type public.institution_approval_status as enum ('approved', 'pending', 'rejected', 'archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'mentee',
  first_name text check (first_name is null or char_length(btrim(first_name)) between 1 and 100),
  last_name text check (last_name is null or char_length(last_name) <= 100),
  username text check (username is null or username ~ '^[A-Za-z0-9_]{3,30}$'),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  registration_method text not null check (registration_method in ('email', 'google', 'invitation')),
  mentor_setup_completed_at timestamptz,
  password_set_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_username_ci_key on public.profiles (lower(username));

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 250),
  normalized_name text not null,
  type public.institution_type not null,
  province text,
  city text,
  external_id text,
  source text not null check (char_length(source) between 1 and 100),
  source_url text,
  approval_status public.institution_approval_status not null default 'approved',
  institution_status text,
  submitted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- NULL external IDs remain distinct; a normal UNIQUE permits PostgREST upsert.
  constraint institutions_source_external_id_key unique (source, external_id)
);
create index institutions_name_search_idx on public.institutions using gin (normalized_name extensions.gin_trgm_ops);
create index institutions_moderation_idx on public.institutions (approval_status, type);
create index institutions_submitted_by_idx on public.institutions (submitted_by);

create table public.referral_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.interests (like public.referral_sources including all);

create table public.mentee_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  institution_id uuid references public.institutions(id),
  major_or_faculty text check (major_or_faculty is null or char_length(major_or_faculty) <= 150),
  cohort_year integer check (cohort_year between 1950 and 2100),
  referral_source_id uuid references public.referral_sources(id),
  referral_other_text text check (referral_other_text is null or char_length(referral_other_text) between 1 and 500),
  other_interest_text text check (other_interest_text is null or char_length(other_interest_text) between 1 and 500),
  onboarding_step integer not null default 1 check (onboarding_step between 1 and 4),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (referral_source_id is null or referral_other_text is null)
);
create index mentee_profiles_institution_idx on public.mentee_profiles (institution_id);
create table public.mentee_interests (
  user_id uuid not null references public.mentee_profiles(user_id) on delete cascade,
  interest_id uuid not null references public.interests(id),
  created_at timestamptz not null default now(),
  primary key (user_id, interest_id)
);
create table public.mentor_invites (
  email text primary key check (email = lower(btrim(email)) and char_length(email) between 3 and 320),
  invited_by uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
-- Match JavaScript trim()/\s exactly, including NBSP and BOM. PostgreSQL's
-- POSIX whitespace class varies with locale and misses these characters.
-- Display spelling and Unicode composition remain intact; only search keys use NFC.
create function public.clean_institution_name(p_name text) returns text
language sql immutable strict set search_path = '' as $$
  select btrim(regexp_replace(p_name, U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+', ' ', 'g'))
$$;
create function public.normalize_institution_name(p_name text) returns text
language sql immutable strict set search_path = '' as $$
  select lower(normalize(public.clean_institution_name(p_name), NFC) collate pg_catalog."und-x-icu")
$$;
create function public.normalize_institution() returns trigger language plpgsql set search_path = '' as $$
begin
  new.name := public.clean_institution_name(new.name);
  new.normalized_name := public.normalize_institution_name(new.name);
  return new;
end;
$$;
create trigger institutions_normalize before insert or update on public.institutions for each row execute function public.normalize_institution();
do $$
declare t text;
begin
  foreach t in array array['profiles', 'institutions', 'referral_sources', 'interests', 'mentee_profiles', 'mentor_invites'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

create function public.bootstrap_profile() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_role public.app_role := 'mentee';
  v_method text := case when new.raw_app_meta_data->>'provider' = 'google' then 'google' else 'email' end;
  v_invite public.mentor_invites;
begin
  -- invited_at is a trusted Auth column, unlike browser-supplied user metadata.
  -- Failed registries and ordinary signups can never assign a mentor role.
  if new.invited_at is not null then
    select * into v_invite from public.mentor_invites
    where email = lower(btrim(new.email)) and status = 'pending' and user_id is null
    for update;
    if found and exists (select 1 from public.profiles where id = v_invite.invited_by and role = 'admin') then
      v_role := 'mentor';
      v_method := 'invitation';
    end if;
  end if;
  insert into public.profiles (id, role, registration_method, first_name, last_name, avatar_url)
  values (new.id, v_role, v_method,
    nullif(left(btrim(new.raw_user_meta_data->>'given_name'), 100), ''),
    nullif(left(btrim(new.raw_user_meta_data->>'family_name'), 100), ''),
    nullif(left(new.raw_user_meta_data->>'avatar_url', 2048), ''));
  if v_role = 'mentee' then
    insert into public.mentee_profiles (user_id) values (new.id);
  else
    update public.mentor_invites set user_id = new.id where email = v_invite.email;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.bootstrap_profile();
-- GoTrue creates the user first, then sets invited_at inside the same invitation
-- transaction. Handle that trusted transition before an invitation can be accepted.
-- An admin may invite an existing unconfirmed email; confirmed accounts and
-- ordinary public signup can never be promoted through this path.
create function public.assign_invited_mentor() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_invite public.mentor_invites;
begin
  if old.invited_at is not null or new.invited_at is null or new.email_confirmed_at is not null then return new; end if;
  select * into v_invite from public.mentor_invites
    where email = lower(btrim(new.email)) and status = 'pending' and user_id is null for update;
  if not found or not exists (select 1 from public.profiles where id = v_invite.invited_by and role = 'admin') then return new; end if;
  update public.profiles set role = 'mentor', registration_method = 'invitation'
    where id = new.id and role = 'mentee';
  if found then
    delete from public.mentee_profiles where user_id = new.id;
    update public.mentor_invites set user_id = new.id where email = v_invite.email;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_invited after update of invited_at on auth.users for each row execute function public.assign_invited_mentor();
-- GoTrue's magic-link signup may INSERT an unknown temporary password hash.
-- Record only a later real password change for a verified email. Re-sending a
-- signup email may change the temporary password while still unconfirmed; that
-- must not satisfy the account-setup requirement. No hashes leave auth.users.
create function public.record_password_set() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.profiles set password_set_at = case
      when new.email_confirmed_at is not null and nullif(new.encrypted_password, '') is not null then now()
      else null end where id = new.id;
  end if;
  return new;
end;
$$;
create trigger on_auth_password_changed after update of encrypted_password on auth.users for each row execute function public.record_password_set();
-- Accounts predating the migration are safely initialized as public mentees.
insert into public.profiles (id, registration_method)
select id, case when raw_app_meta_data->>'provider' = 'google' then 'google' else 'email' end from auth.users
on conflict (id) do nothing;
insert into public.mentee_profiles (user_id) select id from public.profiles where role = 'mentee' on conflict do nothing;

alter table public.profiles enable row level security;
alter table public.mentee_profiles enable row level security;
alter table public.institutions enable row level security;
alter table public.referral_sources enable row level security;
alter table public.interests enable row level security;
alter table public.mentee_interests enable row level security;
alter table public.mentor_invites enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy mentee_profiles_read on public.mentee_profiles for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy mentee_interests_read on public.mentee_interests for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy institutions_read on public.institutions for select to authenticated using (
  approval_status = 'approved' or (approval_status = 'pending' and submitted_by = auth.uid()) or public.is_admin()
);
create policy institutions_admin_insert on public.institutions for insert to authenticated with check (public.is_admin());
create policy institutions_admin_update on public.institutions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy institutions_admin_delete on public.institutions for delete to authenticated using (public.is_admin());
create policy referral_sources_read on public.referral_sources for select to authenticated using (is_active or public.is_admin());
create policy referral_sources_admin_write on public.referral_sources for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy interests_read on public.interests for select to authenticated using (is_active or public.is_admin());
create policy interests_admin_write on public.interests for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- mentor_invites deliberately has no browser policies or grants.

revoke all on public.profiles, public.mentee_profiles, public.institutions, public.referral_sources, public.interests, public.mentee_interests, public.mentor_invites from anon, authenticated;
grant usage on schema public to authenticated, service_role;
grant select on public.profiles, public.mentee_profiles, public.institutions, public.referral_sources, public.interests, public.mentee_interests to authenticated;
grant update (first_name, last_name, username, avatar_url) on public.profiles to authenticated;
grant insert (name, type, province, city, external_id, source, source_url, approval_status, institution_status),
  update (name, type, province, city, external_id, source, source_url, approval_status, institution_status), delete on public.institutions to authenticated;
grant insert (name, sort_order, is_active), update (name, sort_order, is_active), delete on public.referral_sources, public.interests to authenticated;
grant all on public.profiles, public.mentee_profiles, public.institutions, public.referral_sources, public.interests, public.mentee_interests, public.mentor_invites to service_role;

create function public.save_onboarding_step(p_step integer, p_data jsonb) returns public.mentee_profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_row public.mentee_profiles;
  v_institution uuid;
  v_referral uuid;
  v_other text;
  v_interests uuid[];
  v_first text;
  v_last text;
  v_username text;
  v_year integer;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.role is distinct from 'mentee'::public.app_role then raise exception 'Mentee account required' using errcode = '42501'; end if;
  select * into v_row from public.mentee_profiles where user_id = v_uid for update;
  if p_step is null or p_step not between 1 and 4 or jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'Invalid onboarding request' using errcode = '22023';
  end if;
  if p_step > v_row.onboarding_step then raise exception 'Complete preceding steps first' using errcode = '22023'; end if;
  -- Reject unknown keys rather than silently accepting ownership/privilege injection.
  if exists (select 1 from jsonb_object_keys(p_data) k where not (k = any(case p_step
    when 1 then array['first_name','last_name','username']
    when 2 then array['institution_id','major_or_faculty','cohort_year']
    when 3 then array['referral_source_id','referral_other_text']
    else array['interest_ids','other_interest_text'] end))) then
    raise exception 'Unexpected onboarding field' using errcode = '22023';
  end if;
  if p_step = 1 then
    v_first := nullif(btrim(p_data->>'first_name'), '');
    v_last := nullif(btrim(p_data->>'last_name'), '');
    v_username := nullif(btrim(p_data->>'username'), '');
    if v_first is null or char_length(v_first) > 100 or char_length(v_last) > 100
      or v_username is null or v_username !~ '^[A-Za-z0-9_]{3,30}$' then
      raise exception 'Enter a valid name and username' using errcode = '22023';
    end if;
    if v_profile.registration_method = 'email' and (v_profile.password_set_at is null or not exists (
      select 1 from auth.users where id = v_uid and nullif(encrypted_password, '') is not null
    )) then raise exception 'Set your account password first' using errcode = '22023'; end if;
    update public.profiles set first_name = v_first, last_name = v_last, username = v_username where id = v_uid;
  elsif p_step = 2 then
    v_institution := nullif(p_data->>'institution_id', '')::uuid;
    if not exists (select 1 from public.institutions where id = v_institution and (
      approval_status = 'approved' or (approval_status = 'pending' and submitted_by = v_uid)
    )) then raise exception 'Select an available institution' using errcode = '22023'; end if;
    v_year := nullif(p_data->>'cohort_year', '')::integer;
    if v_year is not null and (v_year < 1950 or v_year > extract(year from now())::integer + 1) then
      raise exception 'Enter a valid cohort year' using errcode = '22023';
    end if;
    update public.mentee_profiles set institution_id = v_institution,
      major_or_faculty = nullif(btrim(p_data->>'major_or_faculty'), ''), cohort_year = v_year where user_id = v_uid;
  elsif p_step = 3 then
    v_referral := nullif(p_data->>'referral_source_id', '')::uuid;
    v_other := nullif(btrim(p_data->>'referral_other_text'), '');
    if (v_referral is null) = (v_other is null) then raise exception 'Choose exactly one referral response' using errcode = '22023'; end if;
    if v_referral is not null and not exists (select 1 from public.referral_sources where id = v_referral and is_active) then
      raise exception 'Select an active referral source' using errcode = '22023';
    end if;
    update public.mentee_profiles set referral_source_id = v_referral, referral_other_text = v_other where user_id = v_uid;
  else
    if jsonb_typeof(p_data->'interest_ids') is distinct from 'array' or jsonb_array_length(p_data->'interest_ids') > 100 then
      raise exception 'Select valid interests' using errcode = '22023';
    end if;
    select coalesce(array_agg(distinct value::uuid), '{}'::uuid[]) into v_interests from jsonb_array_elements_text(p_data->'interest_ids');
    v_other := nullif(btrim(p_data->>'other_interest_text'), '');
    if cardinality(v_interests) = 0 and v_other is null then raise exception 'Select at least one interest' using errcode = '22023'; end if;
    if exists (select 1 from unnest(v_interests) i where i is null or not exists (select 1 from public.interests where id = i and is_active)) then
      raise exception 'Select active interests' using errcode = '22023';
    end if;
    if v_profile.first_name is null or v_profile.username is null or v_row.institution_id is null
      or (v_row.referral_source_id is null and v_row.referral_other_text is null) then
      raise exception 'Complete preceding steps first' using errcode = '22023';
    end if;
    if not exists (select 1 from public.institutions where id = v_row.institution_id and (
      approval_status = 'approved' or (approval_status = 'pending' and submitted_by = v_uid)
    )) then raise exception 'Select an available institution' using errcode = '22023'; end if;
    if v_row.referral_source_id is not null and not exists (
      select 1 from public.referral_sources where id = v_row.referral_source_id and is_active
    ) then raise exception 'Select an active referral source' using errcode = '22023'; end if;
    delete from public.mentee_interests where user_id = v_uid;
    insert into public.mentee_interests (user_id, interest_id) select v_uid, unnest(v_interests);
    update public.mentee_profiles set other_interest_text = v_other,
      onboarding_completed_at = coalesce(onboarding_completed_at, now()) where user_id = v_uid;
  end if;
  update public.mentee_profiles set onboarding_step = greatest(onboarding_step, least(p_step + 1, 4)) where user_id = v_uid returning * into v_row;
  return v_row;
end;
$$;

create function public.search_institutions(p_query text) returns setof public.institutions
language sql stable security invoker set search_path = '' as $$
  select * from public.institutions
  where char_length(public.normalize_institution_name(p_query)) between 2 and 250
    and normalized_name like '%' || replace(replace(replace(public.normalize_institution_name(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
  order by case when normalized_name = public.normalize_institution_name(p_query) then 0 else 1 end, name, city nulls last, id
  limit 25
$$;

create function public.submit_institution(p_name text, p_type public.institution_type, p_allow_duplicate boolean default false) returns public.institutions
language plpgsql security definer set search_path = '' as $$
declare v_row public.institutions; v_name text := public.clean_institution_name(p_name); v_uid uuid := auth.uid();
begin
  if not exists (select 1 from public.profiles where id = v_uid and role = 'mentee') then raise exception 'Mentee account required' using errcode = '42501'; end if;
  if v_name is null or char_length(v_name) not between 2 and 250 or p_type is null then raise exception 'Enter a valid institution' using errcode = '22023'; end if;
  -- Serialize repeated submissions by this account without conflating unrelated schools.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_type::text || ':' || public.normalize_institution_name(v_name), 0));
  select * into v_row from public.institutions where submitted_by = v_uid and approval_status = 'pending'
    and type = p_type and normalized_name = public.normalize_institution_name(v_name) order by created_at limit 1;
  if found then return v_row; end if;
  if p_allow_duplicate is distinct from true and exists (select 1 from public.institutions where approval_status = 'approved' and type = p_type
    and normalized_name = public.normalize_institution_name(v_name)) then
    raise exception 'An institution with this name exists; select it or explicitly confirm this is a different institution' using errcode = '23505';
  end if;
  insert into public.institutions (name, type, source, approval_status, submitted_by)
  values (v_name, p_type, 'user_submission', 'pending', v_uid) returning * into v_row;
  return v_row;
end;
$$;

create function public.complete_mentor_setup(p_first_name text, p_last_name text, p_username text) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare v_row public.profiles; v_uid uuid := auth.uid();
begin
  select * into v_row from public.profiles where id = v_uid for update;
  if v_row.role is distinct from 'mentor'::public.app_role then raise exception 'Mentor account required' using errcode = '42501'; end if;
  if nullif(btrim(p_first_name), '') is null or char_length(btrim(p_first_name)) > 100 or char_length(btrim(p_last_name)) > 100
    or p_username is null or btrim(p_username) !~ '^[A-Za-z0-9_]{3,30}$' then
    raise exception 'Enter a valid name and username' using errcode = '22023';
  end if;
  if v_row.password_set_at is null or not exists (select 1 from auth.users where id = v_uid and nullif(encrypted_password, '') is not null) then
    raise exception 'Set your account password first' using errcode = '22023';
  end if;
  update public.profiles set first_name = btrim(p_first_name), last_name = nullif(btrim(p_last_name), ''),
    username = btrim(p_username), mentor_setup_completed_at = coalesce(mentor_setup_completed_at, now())
  where id = v_uid returning * into v_row;
  return v_row;
end;
$$;

create function public.merge_institutions(p_from uuid, p_into uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  if p_from is null or p_into is null or p_from = p_into then raise exception 'Choose two different institutions' using errcode = '22023'; end if;
  perform id from public.institutions where id in (p_from, p_into) order by id for update;
  if not exists (select 1 from public.institutions where id = p_from)
    or not exists (select 1 from public.institutions where id = p_into and approval_status = 'approved') then
    raise exception 'Select an existing source and approved destination' using errcode = '22023';
  end if;
  update public.mentee_profiles set institution_id = p_into where institution_id = p_from;
  update public.institutions set approval_status = 'archived' where id = p_from;
end;
$$;

revoke all on function public.touch_updated_at(), public.clean_institution_name(text), public.normalize_institution_name(text), public.normalize_institution(), public.is_admin(), public.bootstrap_profile(), public.assign_invited_mentor(), public.record_password_set(),
  public.save_onboarding_step(integer, jsonb), public.search_institutions(text), public.submit_institution(text, public.institution_type, boolean),
  public.complete_mentor_setup(text, text, text), public.merge_institutions(uuid, uuid) from public, anon, authenticated;
grant execute on function public.is_admin(), public.clean_institution_name(text), public.normalize_institution_name(text), public.save_onboarding_step(integer, jsonb), public.search_institutions(text),
  public.submit_institution(text, public.institution_type, boolean), public.complete_mentor_setup(text, text, text), public.merge_institutions(uuid, uuid) to authenticated;
grant execute on function public.clean_institution_name(text), public.normalize_institution_name(text) to service_role;

insert into public.referral_sources (name, sort_order) values ('Teman', 1), ('Organisasi', 2), ('Instagram', 3), ('TikTok', 4);
insert into public.interests (name, sort_order) values ('Business Case', 1), ('Debat', 2), ('UI/UX', 3), ('KTI', 4);
