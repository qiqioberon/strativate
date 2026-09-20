-- Bounded, RLS-protected operational invalidation for canonical client refetches.

create table public.operational_invalidation_versions (
  id bigint generated always as identity primary key,
  recipient_role public.app_role not null,
  recipient_user_id uuid references public.profiles(id) on delete cascade,
  domain text not null check (
    domain in (
      'commerce',
      'cart',
      'library',
      'mentoring',
      'mentor-dashboard',
      'calendar',
      'availability',
      'provider',
      'admin-overview',
      'cart-links',
      'mentor-invitations'
    )
  ),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  check (
    recipient_user_id is not null
    or recipient_role in ('admin'::public.app_role, 'mentee'::public.app_role)
  )
);

create unique index operational_invalidation_user_scope_domain_key
  on public.operational_invalidation_versions (recipient_role, recipient_user_id, domain)
  where recipient_user_id is not null;

create unique index operational_invalidation_role_scope_domain_key
  on public.operational_invalidation_versions (recipient_role, domain)
  where recipient_user_id is null;

create index operational_invalidation_recipient_lookup
  on public.operational_invalidation_versions (recipient_role, recipient_user_id, domain, revision);

alter table public.operational_invalidation_versions enable row level security;

create policy operational_invalidation_read_current_scope
on public.operational_invalidation_versions
for select
to authenticated
using (
  recipient_role = (
    select profile.role
    from public.profiles as profile
    where profile.id = auth.uid()
  )
  and (
    recipient_user_id = auth.uid()
    or recipient_user_id is null
  )
);

revoke all on table public.operational_invalidation_versions from public, anon, authenticated;
grant select on table public.operational_invalidation_versions to authenticated;
grant all on table public.operational_invalidation_versions to service_role;
grant usage, select on sequence public.operational_invalidation_versions_id_seq to service_role;

create function public.bump_operational_invalidation(
  p_recipient_role public.app_role,
  p_recipient_user_id uuid,
  p_domain text
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if p_domain not in (
    'commerce',
    'cart',
    'library',
    'mentoring',
    'mentor-dashboard',
    'calendar',
    'availability',
    'provider',
    'admin-overview',
    'cart-links',
    'mentor-invitations'
  ) then
    raise exception 'Unsupported operational invalidation domain'
      using errcode = '22023';
  end if;

  if p_recipient_user_id is null then
    if p_recipient_role not in ('admin'::public.app_role, 'mentee'::public.app_role) then
      raise exception 'Role-wide operational invalidation is not supported for this role'
        using errcode = '22023';
    end if;

    insert into public.operational_invalidation_versions as versions (
      recipient_role,
      recipient_user_id,
      domain
    )
    values (p_recipient_role, null, p_domain)
    on conflict (recipient_role, domain)
      where recipient_user_id is null
    do update set
      revision = versions.revision + 1,
      updated_at = pg_catalog.now();
  else
    if not exists (
      select 1
      from public.profiles as profile
      where profile.id = p_recipient_user_id
        and profile.role = p_recipient_role
    ) then
      raise exception 'Operational invalidation recipient does not match the requested role'
        using errcode = '22023';
    end if;

    insert into public.operational_invalidation_versions as versions (
      recipient_role,
      recipient_user_id,
      domain
    )
    values (p_recipient_role, p_recipient_user_id, p_domain)
    on conflict (recipient_role, recipient_user_id, domain)
      where recipient_user_id is not null
    do update set
      revision = versions.revision + 1,
      updated_at = pg_catalog.now();
  end if;
end;
$$;
revoke all on function public.bump_operational_invalidation(public.app_role, uuid, text)
from public, anon, authenticated;
grant execute on function public.bump_operational_invalidation(public.app_role, uuid, text)
to service_role;

create function public.invalidate_order_operational_changes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  perform public.bump_operational_invalidation('mentee'::public.app_role, new.user_id, 'commerce');
  perform public.bump_operational_invalidation('mentee'::public.app_role, new.user_id, 'cart');

  if new.status = 'paid' then
    perform public.bump_operational_invalidation('mentee'::public.app_role, new.user_id, 'library');
    perform public.bump_operational_invalidation('mentee'::public.app_role, new.user_id, 'mentoring');
  end if;

  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'commerce');
  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'admin-overview');
  return new;
end;
$$;

create trigger orders_operational_invalidation
after insert or update of status on public.orders
for each row execute function public.invalidate_order_operational_changes();

create function public.invalidate_payment_attempt_operational_changes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user_id uuid;
begin
  if tg_op = 'UPDATE'
    and old.status is not distinct from new.status
    and old.provider_status is not distinct from new.provider_status
    and old.snap_token is not distinct from new.snap_token
    and old.provider_transaction_id is not distinct from new.provider_transaction_id
  then
    return new;
  end if;

  select orders.user_id
  into v_user_id
  from public.orders as orders
  where orders.id = new.order_id;

  if v_user_id is not null then
    perform public.bump_operational_invalidation('mentee'::public.app_role, v_user_id, 'commerce');
  end if;
  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'commerce');
  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'admin-overview');
  return new;
end;
$$;

create trigger payment_attempts_operational_invalidation
after insert or update of status, provider_status, snap_token, provider_transaction_id
on public.payment_attempts
for each row execute function public.invalidate_payment_attempt_operational_changes();

create function public.invalidate_cart_operational_changes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user_id uuid;
  v_cart_id uuid;
begin
  if tg_table_name = 'carts' then
    if tg_op = 'UPDATE' and old.status is not distinct from new.status then
      return new;
    end if;
    v_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  else
    v_cart_id := case when tg_op = 'DELETE' then old.cart_id else new.cart_id end;
    select carts.user_id into v_user_id
    from public.carts as carts
    where carts.id = v_cart_id;
  end if;

  if v_user_id is not null then
    perform public.bump_operational_invalidation('mentee'::public.app_role, v_user_id, 'cart');
  end if;
  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'admin-overview');

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger carts_operational_invalidation
after insert or update of status on public.carts
for each row execute function public.invalidate_cart_operational_changes();

create trigger cart_items_operational_invalidation
after insert or delete on public.cart_items
for each row execute function public.invalidate_cart_operational_changes();

create function public.invalidate_cart_link_operational_changes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_mentee_id uuid;
  v_link_id uuid;
begin
  if tg_table_name = 'commerce_cart_links' then
    if tg_op = 'UPDATE'
      and old.status is not distinct from new.status
      and old.claimed_cart_id is not distinct from new.claimed_cart_id
    then
      return new;
    end if;
    v_mentee_id := case when tg_op = 'DELETE' then old.mentee_id else new.mentee_id end;
  else
    v_link_id := case when tg_op = 'DELETE' then old.cart_link_id else new.cart_link_id end;
    select links.mentee_id into v_mentee_id
    from public.commerce_cart_links as links
    where links.id = v_link_id;
  end if;

  if v_mentee_id is not null then
    perform public.bump_operational_invalidation('mentee'::public.app_role, v_mentee_id, 'cart');
  end if;
  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'cart-links');

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger cart_links_operational_invalidation
after insert or update of status, claimed_cart_id or delete on public.commerce_cart_links
for each row execute function public.invalidate_cart_link_operational_changes();

create trigger cart_link_items_operational_invalidation
after insert or delete on public.commerce_cart_link_items
for each row execute function public.invalidate_cart_link_operational_changes();

create function public.invalidate_private_enrollment_operational_changes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'UPDATE'
    and old.status is not distinct from new.status
    and old.primary_mentor_id is not distinct from new.primary_mentor_id
    and old.learning_path_id is not distinct from new.learning_path_id
    and old.competition_category_id is not distinct from new.competition_category_id
    and old.competition_name is not distinct from new.competition_name
  then
    return new;
  end if;

  perform public.bump_operational_invalidation('mentee'::public.app_role, new.mentee_id, 'mentoring');
  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'admin-overview');

  if tg_op = 'UPDATE'
    and old.primary_mentor_id is not null
    and old.primary_mentor_id is distinct from new.primary_mentor_id
  then
    perform public.bump_operational_invalidation('mentor'::public.app_role, old.primary_mentor_id, 'mentoring');
    perform public.bump_operational_invalidation('mentor'::public.app_role, old.primary_mentor_id, 'mentor-dashboard');
  end if;

  if new.primary_mentor_id is not null
    and (tg_op = 'INSERT' or old.primary_mentor_id is distinct from new.primary_mentor_id)
  then
    perform public.bump_operational_invalidation('mentor'::public.app_role, new.primary_mentor_id, 'mentoring');
    perform public.bump_operational_invalidation('mentor'::public.app_role, new.primary_mentor_id, 'mentor-dashboard');
  end if;

  return new;
end;
$$;

create trigger private_enrollments_operational_invalidation
after insert or update of status, primary_mentor_id, learning_path_id, competition_category_id, competition_name
on public.private_mentoring_enrollments
for each row execute function public.invalidate_private_enrollment_operational_changes();

create function public.invalidate_private_session_operational_changes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_mentee_id uuid;
begin
  if tg_op = 'UPDATE'
    and old.session_focus_id is not distinct from new.session_focus_id
    and old.requested_focus_id is not distinct from new.requested_focus_id
    and old.mentee_topic_request is not distinct from new.mentee_topic_request
    and old.topic_status is not distinct from new.topic_status
    and old.resolved_topic is not distinct from new.resolved_topic
    and old.mentor_scope_notes is not distinct from new.mentor_scope_notes
    and old.mentor_id is not distinct from new.mentor_id
    and old.scheduled_start_at is not distinct from new.scheduled_start_at
    and old.scheduled_end_at is not distinct from new.scheduled_end_at
    and old.status is not distinct from new.status
  then
    return new;
  end if;

  select enrollments.mentee_id
  into v_mentee_id
  from public.private_mentoring_enrollments as enrollments
  where enrollments.id = new.enrollment_id;

  perform public.bump_operational_invalidation('mentee'::public.app_role, v_mentee_id, 'mentoring');
  perform public.bump_operational_invalidation('mentee'::public.app_role, v_mentee_id, 'calendar');
  perform public.bump_operational_invalidation('mentee'::public.app_role, null, 'availability');
  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'admin-overview');
  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'calendar');
  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'availability');

  if tg_op = 'UPDATE'
    and old.mentor_id is not null
    and old.mentor_id is distinct from new.mentor_id
  then
    perform public.bump_operational_invalidation('mentor'::public.app_role, old.mentor_id, 'mentoring');
    perform public.bump_operational_invalidation('mentor'::public.app_role, old.mentor_id, 'mentor-dashboard');
    perform public.bump_operational_invalidation('mentor'::public.app_role, old.mentor_id, 'calendar');
    perform public.bump_operational_invalidation('mentor'::public.app_role, old.mentor_id, 'availability');
  end if;

  if new.mentor_id is not null then
    perform public.bump_operational_invalidation('mentor'::public.app_role, new.mentor_id, 'mentoring');
    perform public.bump_operational_invalidation('mentor'::public.app_role, new.mentor_id, 'mentor-dashboard');
    perform public.bump_operational_invalidation('mentor'::public.app_role, new.mentor_id, 'calendar');
    perform public.bump_operational_invalidation('mentor'::public.app_role, new.mentor_id, 'availability');
  end if;

  return new;
end;
$$;

create trigger private_sessions_operational_invalidation
after insert or update of session_focus_id, requested_focus_id, mentee_topic_request, topic_status,
  resolved_topic, mentor_scope_notes, mentor_id, scheduled_start_at, scheduled_end_at, status
on public.private_mentoring_sessions
for each row execute function public.invalidate_private_session_operational_changes();

create function public.invalidate_private_provider_operational_changes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_mentee_id uuid;
  v_mentor_id uuid;
begin
  if tg_op = 'UPDATE'
    and old.google_event_id is not distinct from new.google_event_id
    and old.meeting_provider is not distinct from new.meeting_provider
    and old.provider_meeting_id is not distinct from new.provider_meeting_id
    and old.provider_meeting_url is not distinct from new.provider_meeting_url
    and old.manual_meeting_url is not distinct from new.manual_meeting_url
    and old.provider_sync_status is not distinct from new.provider_sync_status
    and old.provider_sync_error is not distinct from new.provider_sync_error
    and old.sync_status is not distinct from new.sync_status
    and old.sync_error is not distinct from new.sync_error
    and old.recording_status is not distinct from new.recording_status
    and old.recording_error is not distinct from new.recording_error
  then
    return new;
  end if;

  select enrollments.mentee_id, sessions.mentor_id
  into v_mentee_id, v_mentor_id
  from public.private_mentoring_sessions as sessions
  join public.private_mentoring_enrollments as enrollments
    on enrollments.id = sessions.enrollment_id
  where sessions.id = new.session_id;

  perform public.bump_operational_invalidation('mentee'::public.app_role, v_mentee_id, 'provider');
  perform public.bump_operational_invalidation('mentee'::public.app_role, v_mentee_id, 'calendar');
  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'provider');
  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'calendar');

  if v_mentor_id is not null then
    perform public.bump_operational_invalidation('mentor'::public.app_role, v_mentor_id, 'provider');
    perform public.bump_operational_invalidation('mentor'::public.app_role, v_mentor_id, 'calendar');
    perform public.bump_operational_invalidation('mentor'::public.app_role, v_mentor_id, 'mentor-dashboard');
  end if;

  return new;
end;
$$;

create trigger private_provider_operational_invalidation
after insert or update of google_event_id, meeting_provider, provider_meeting_id, provider_meeting_url,
  manual_meeting_url, provider_sync_status, provider_sync_error, sync_status, sync_error,
  recording_status, recording_error
on public.private_mentoring_session_calendar_integrations
for each row execute function public.invalidate_private_provider_operational_changes();

create function public.invalidate_intensive_entitlement_operational_changes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'UPDATE'
    and old.status is not distinct from new.status
    and old.engagement_id is not distinct from new.engagement_id
  then
    return new;
  end if;

  perform public.bump_operational_invalidation('mentee'::public.app_role, new.mentee_id, 'mentoring');
  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'admin-overview');
  return new;
end;
$$;

create trigger intensive_entitlements_operational_invalidation
after insert or update of status, engagement_id on public.intensive_mentoring_entitlements
for each row execute function public.invalidate_intensive_entitlement_operational_changes();

create function public.invalidate_intensive_engagement_operational_changes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'UPDATE'
    and old.status is not distinct from new.status
    and old.primary_mentor_id is not distinct from new.primary_mentor_id
    and old.competition_category_id is not distinct from new.competition_category_id
    and old.competition_name is not distinct from new.competition_name
    and old.program_stage is not distinct from new.program_stage
    and old.progress_summary is not distinct from new.progress_summary
  then
    return new;
  end if;

  perform public.bump_operational_invalidation('mentee'::public.app_role, new.mentee_id, 'mentoring');
  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'admin-overview');

  if tg_op = 'UPDATE'
    and old.primary_mentor_id is not null
    and old.primary_mentor_id is distinct from new.primary_mentor_id
  then
    perform public.bump_operational_invalidation('mentor'::public.app_role, old.primary_mentor_id, 'mentoring');
    perform public.bump_operational_invalidation('mentor'::public.app_role, old.primary_mentor_id, 'mentor-dashboard');
  end if;

  if new.primary_mentor_id is not null then
    perform public.bump_operational_invalidation('mentor'::public.app_role, new.primary_mentor_id, 'mentoring');
    perform public.bump_operational_invalidation('mentor'::public.app_role, new.primary_mentor_id, 'mentor-dashboard');
  end if;

  return new;
end;
$$;

create trigger intensive_engagements_operational_invalidation
after insert or update of status, primary_mentor_id, competition_category_id, competition_name,
  program_stage, progress_summary
on public.intensive_mentoring_engagements
for each row execute function public.invalidate_intensive_engagement_operational_changes();

create function public.invalidate_intensive_session_operational_changes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_mentee_id uuid;
begin
  if tg_op = 'UPDATE'
    and old.session_focus_id is not distinct from new.session_focus_id
    and old.requested_focus_id is not distinct from new.requested_focus_id
    and old.mentee_topic_request is not distinct from new.mentee_topic_request
    and old.topic_status is not distinct from new.topic_status
    and old.resolved_topic is not distinct from new.resolved_topic
    and old.mentor_id is not distinct from new.mentor_id
    and old.scheduled_start_at is not distinct from new.scheduled_start_at
    and old.scheduled_end_at is not distinct from new.scheduled_end_at
    and old.status is not distinct from new.status
  then
    return new;
  end if;

  select engagements.mentee_id
  into v_mentee_id
  from public.intensive_mentoring_engagements as engagements
  where engagements.id = new.engagement_id;

  perform public.bump_operational_invalidation('mentee'::public.app_role, v_mentee_id, 'mentoring');
  perform public.bump_operational_invalidation('mentee'::public.app_role, v_mentee_id, 'calendar');
  perform public.bump_operational_invalidation('mentee'::public.app_role, null, 'availability');
  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'admin-overview');
  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'calendar');
  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'availability');

  if tg_op = 'UPDATE'
    and old.mentor_id is not null
    and old.mentor_id is distinct from new.mentor_id
  then
    perform public.bump_operational_invalidation('mentor'::public.app_role, old.mentor_id, 'mentoring');
    perform public.bump_operational_invalidation('mentor'::public.app_role, old.mentor_id, 'mentor-dashboard');
    perform public.bump_operational_invalidation('mentor'::public.app_role, old.mentor_id, 'calendar');
    perform public.bump_operational_invalidation('mentor'::public.app_role, old.mentor_id, 'availability');
  end if;

  if new.mentor_id is not null then
    perform public.bump_operational_invalidation('mentor'::public.app_role, new.mentor_id, 'mentoring');
    perform public.bump_operational_invalidation('mentor'::public.app_role, new.mentor_id, 'mentor-dashboard');
    perform public.bump_operational_invalidation('mentor'::public.app_role, new.mentor_id, 'calendar');
    perform public.bump_operational_invalidation('mentor'::public.app_role, new.mentor_id, 'availability');
  end if;

  return new;
end;
$$;

create trigger intensive_sessions_operational_invalidation
after insert or update of session_focus_id, requested_focus_id, mentee_topic_request, topic_status,
  resolved_topic, mentor_id, scheduled_start_at, scheduled_end_at, status
on public.intensive_mentoring_sessions
for each row execute function public.invalidate_intensive_session_operational_changes();

create function public.invalidate_intensive_provider_operational_changes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_mentee_id uuid;
  v_mentor_id uuid;
begin
  if tg_op = 'UPDATE'
    and old.google_event_id is not distinct from new.google_event_id
    and old.meeting_provider is not distinct from new.meeting_provider
    and old.provider_meeting_id is not distinct from new.provider_meeting_id
    and old.provider_meeting_url is not distinct from new.provider_meeting_url
    and old.manual_meeting_url is not distinct from new.manual_meeting_url
    and old.provider_sync_status is not distinct from new.provider_sync_status
    and old.provider_sync_error is not distinct from new.provider_sync_error
    and old.sync_status is not distinct from new.sync_status
    and old.sync_error is not distinct from new.sync_error
    and old.recording_status is not distinct from new.recording_status
    and old.recording_error is not distinct from new.recording_error
  then
    return new;
  end if;

  select engagements.mentee_id, sessions.mentor_id
  into v_mentee_id, v_mentor_id
  from public.intensive_mentoring_sessions as sessions
  join public.intensive_mentoring_engagements as engagements
    on engagements.id = sessions.engagement_id
  where sessions.id = new.session_id;

  perform public.bump_operational_invalidation('mentee'::public.app_role, v_mentee_id, 'provider');
  perform public.bump_operational_invalidation('mentee'::public.app_role, v_mentee_id, 'calendar');
  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'provider');
  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'calendar');

  if v_mentor_id is not null then
    perform public.bump_operational_invalidation('mentor'::public.app_role, v_mentor_id, 'provider');
    perform public.bump_operational_invalidation('mentor'::public.app_role, v_mentor_id, 'calendar');
    perform public.bump_operational_invalidation('mentor'::public.app_role, v_mentor_id, 'mentor-dashboard');
  end if;

  return new;
end;
$$;

create trigger intensive_provider_operational_invalidation
after insert or update of google_event_id, meeting_provider, provider_meeting_id, provider_meeting_url,
  manual_meeting_url, provider_sync_status, provider_sync_error, sync_status, sync_error,
  recording_status, recording_error
on public.intensive_mentoring_session_calendar_integrations
for each row execute function public.invalidate_intensive_provider_operational_changes();

create function public.invalidate_availability_operational_changes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_mentor_id uuid;
begin
  if tg_op = 'UPDATE'
    and old.week_start_date is not distinct from new.week_start_date
    and old.day_of_week is not distinct from new.day_of_week
    and old.start_time is not distinct from new.start_time
    and old.end_time is not distinct from new.end_time
  then
    return new;
  end if;

  v_mentor_id := case when tg_op = 'DELETE' then old.mentor_id else new.mentor_id end;

  -- Auth/profile deletion can cascade through mentor_profiles into availability
  -- after the canonical mentor recipient has already disappeared. Keep the
  -- helper strict and skip only the now-impossible user-scoped delivery.
  if exists (
    select 1
    from public.profiles as profile
    where profile.id = v_mentor_id
      and profile.role = 'mentor'::public.app_role
  ) then
    perform public.bump_operational_invalidation('mentor'::public.app_role, v_mentor_id, 'availability');
    perform public.bump_operational_invalidation('mentor'::public.app_role, v_mentor_id, 'mentor-dashboard');
  end if;

  perform public.bump_operational_invalidation('mentee'::public.app_role, null, 'availability');
  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'availability');
  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'calendar');

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger availability_operational_invalidation
after insert or update of week_start_date, day_of_week, start_time, end_time or delete
on public.mentor_availability_rules
for each row execute function public.invalidate_availability_operational_changes();

create function public.invalidate_mentor_invitation_operational_changes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'UPDATE'
    and old.status is not distinct from new.status
    and old.user_id is not distinct from new.user_id
    and old.tier_id is not distinct from new.tier_id
  then
    return new;
  end if;

  perform public.bump_operational_invalidation('admin'::public.app_role, null, 'mentor-invitations');
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger mentor_invitations_operational_invalidation
after insert or update of status, user_id, tier_id or delete on public.mentor_invites
for each row execute function public.invalidate_mentor_invitation_operational_changes();

revoke all on function public.invalidate_order_operational_changes() from public, anon, authenticated;
revoke all on function public.invalidate_payment_attempt_operational_changes() from public, anon, authenticated;
revoke all on function public.invalidate_cart_operational_changes() from public, anon, authenticated;
revoke all on function public.invalidate_cart_link_operational_changes() from public, anon, authenticated;
revoke all on function public.invalidate_private_enrollment_operational_changes() from public, anon, authenticated;
revoke all on function public.invalidate_private_session_operational_changes() from public, anon, authenticated;
revoke all on function public.invalidate_private_provider_operational_changes() from public, anon, authenticated;
revoke all on function public.invalidate_intensive_entitlement_operational_changes() from public, anon, authenticated;
revoke all on function public.invalidate_intensive_engagement_operational_changes() from public, anon, authenticated;
revoke all on function public.invalidate_intensive_session_operational_changes() from public, anon, authenticated;
revoke all on function public.invalidate_intensive_provider_operational_changes() from public, anon, authenticated;
revoke all on function public.invalidate_availability_operational_changes() from public, anon, authenticated;
revoke all on function public.invalidate_mentor_invitation_operational_changes() from public, anon, authenticated;

do $$
begin
  if exists (
    select 1 from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'operational_invalidation_versions'
  ) then
    execute 'alter publication supabase_realtime add table public.operational_invalidation_versions';
  end if;
end;
$$;
