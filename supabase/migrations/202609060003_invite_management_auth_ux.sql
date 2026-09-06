-- Require master interest selections; retain historical custom text until a profile is saved again.
-- Admin-only views of the private registry; no direct browser table grants.
create function public.list_mentor_invites(p_offset integer default 0)
returns table(email text, status text, created_at timestamptz, can_delete boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_offset is null or p_offset < 0 then raise exception 'Invalid offset' using errcode = '22023'; end if;
  return query
    select i.email, i.status, i.created_at,
      i.status <> 'pending' and (i.user_id is null or coalesce(
        p.role = 'mentor' and p.registration_method = 'invitation'
        and p.mentor_setup_completed_at is null and p.password_set_at is null
        and u.invited_at is not null and u.email_confirmed_at is null
        and u.last_sign_in_at is null and lower(btrim(u.email)) = i.email, false))
    from public.mentor_invites i
    left join public.profiles p on p.id = i.user_id
    left join auth.users u on u.id = i.user_id
    order by i.created_at desc, i.email
    limit 25 offset p_offset;
end;
$$;

create function public.delete_mentor_invite(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
  v_id uuid;
  v_invite public.mentor_invites;
  v_user auth.users;
  v_profile public.profiles;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  select user_id into v_id from public.mentor_invites where email = v_email;
  if not found then raise exception 'Invitation not found' using errcode = '22023'; end if;

  -- Auth verification locks the user before updating its profile. Match that order
  -- and recheck the registry under lock so activation/retries cannot race deletion.
  if v_id is not null then
    select * into v_user from auth.users where id = v_id for update;
    select * into v_profile from public.profiles where id = v_id for update;
  end if;
  select * into v_invite from public.mentor_invites where email = v_email for update;
  if not found then raise exception 'Invitation not found' using errcode = '22023'; end if;
  if v_invite.status = 'pending' or v_invite.user_id is distinct from v_id then
    raise exception 'Invitation is still being processed' using errcode = '22023';
  end if;
  if v_id is not null and (
    v_user.id is null or v_profile.id is null
    or v_profile.role is distinct from 'mentor'::public.app_role
    or v_profile.registration_method is distinct from 'invitation'
    or v_profile.mentor_setup_completed_at is not null or v_profile.password_set_at is not null
    or v_user.invited_at is null or v_user.email_confirmed_at is not null
    or v_user.last_sign_in_at is not null or lower(btrim(v_user.email)) is distinct from v_email
  ) then
    raise exception 'Active accounts cannot be deleted through invitations' using errcode = '22023';
  end if;

  -- Removing the unused Auth user also invalidates its invite token. Cascades
  -- remove the profile. Any FK failure rolls the entire operation back.
  delete from public.mentor_invites where email = v_email;
  if v_id is not null then delete from auth.users where id = v_id; end if;
end;
$$;

revoke all on function public.list_mentor_invites(integer) from public, anon, authenticated;
revoke all on function public.delete_mentor_invite(text) from public, anon, authenticated;
grant execute on function public.list_mentor_invites(integer) to authenticated;
grant execute on function public.delete_mentor_invite(text) to authenticated;

create or replace function public.save_onboarding_step(p_step integer, p_data jsonb) returns public.mentee_profiles
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
    if nullif(btrim(p_data->>'other_interest_text'), '') is not null then
      raise exception 'Custom interests are not supported' using errcode = '22023';
    end if;
    if cardinality(v_interests) = 0 then raise exception 'Select at least one interest' using errcode = '22023'; end if;
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
    update public.mentee_profiles set other_interest_text = null,
      onboarding_completed_at = coalesce(onboarding_completed_at, now()) where user_id = v_uid;
  end if;
  update public.mentee_profiles set onboarding_step = greatest(onboarding_step, least(p_step + 1, 4)) where user_id = v_uid returning * into v_row;
  return v_row;
end;
$$;

