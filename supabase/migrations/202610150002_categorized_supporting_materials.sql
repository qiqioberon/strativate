-- Categorized session references. Historical text arrays and audit records are
-- left untouched; NULL typed entries mean the legacy array remains the read source.
alter table public.private_mentoring_sessions add column if not exists supporting_material_entries jsonb;
alter table public.intensive_mentoring_sessions add column if not exists supporting_material_entries jsonb;
alter table public.private_mentoring_session_topic_events add column if not exists supporting_material_entries jsonb;

create or replace function public.normalize_supporting_material_entries(p_entries jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  v_entry jsonb;
  v_category text;
  v_kind text;
  v_value text;
  v_values text[] := '{}'::text[];
  v_categories text[] := '{}'::text[];
  v_result jsonb := '[]'::jsonb;
begin
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'Supporting materials must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_entries) > 20 then
    raise exception 'Add up to 20 materials in total' using errcode = '22023';
  end if;
  for v_entry in select value from jsonb_array_elements(p_entries) loop
    if jsonb_typeof(v_entry) <> 'object' then
      raise exception 'Invalid supporting material entry' using errcode = '22023';
    end if;
    if jsonb_typeof(v_entry -> 'category') is distinct from 'string'
      or jsonb_typeof(v_entry -> 'kind') is distinct from 'string'
      or jsonb_typeof(v_entry -> 'value') is distinct from 'string'
      or exists (select 1 from jsonb_object_keys(v_entry) as keys(key) where key not in ('category', 'kind', 'value')) then
      raise exception 'Invalid supporting material entry' using errcode = '22023';
    end if;
    v_category := v_entry ->> 'category';
    v_kind := v_entry ->> 'kind';
    v_value := regexp_replace(v_entry ->> 'value', '^[[:space:]]+|[[:space:]]+$', '', 'g');
    if v_category not in ('guidebook', 'pitch_deck', 'additional') or v_kind not in ('link', 'note') then
      raise exception 'Invalid supporting material category or kind' using errcode = '22023';
    end if;
    if char_length(v_value) not between 1 and 1000 then
      raise exception 'Each supporting material must contain 1 to 1000 characters' using errcode = '22023';
    end if;
    if v_kind = 'link' then
      -- Require a web URL with a host; whitespace and other URL protocols fail.
      if v_value !~* '^https?://([^/?#[:space:]@]+@)?(\[[0-9a-f:.]+\]|[^/?#:[:space:]@]+)(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' then
        raise exception 'Material links must use a valid http:// or https:// URL' using errcode = '22023';
      end if;
    elsif v_value ~* '^[a-z][a-z0-9+.-]*:' or left(v_value, 2) = '//' then
      raise exception 'Material links must use http:// or https://' using errcode = '22023';
    end if;
    if v_category <> 'additional' then
      if v_kind <> 'link' or v_category = any(v_categories) then
        raise exception 'Guidebook and Pitch Deck each allow one optional link' using errcode = '22023';
      end if;
      v_categories := array_append(v_categories, v_category);
    end if;
    if v_value = any(v_values) then
      raise exception 'Remove duplicate supporting materials' using errcode = '22023';
    end if;
    v_values := array_append(v_values, v_value);
    v_result := v_result || jsonb_build_array(jsonb_build_object('category', v_category, 'kind', v_kind, 'value', v_value));
  end loop;
  return v_result;
end;
$$;

alter table public.private_mentoring_sessions add constraint private_session_categorized_materials_valid
  check (supporting_material_entries is null or supporting_material_entries = public.normalize_supporting_material_entries(supporting_material_entries));
alter table public.intensive_mentoring_sessions add constraint intensive_session_categorized_materials_valid
  check (supporting_material_entries is null or supporting_material_entries = public.normalize_supporting_material_entries(supporting_material_entries));

create or replace function public.private_mentoring_topic_immutability_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status in ('completed', 'cancelled') and (
    new.requested_focus_id is distinct from old.requested_focus_id or new.requested_focus_custom_text is distinct from old.requested_focus_custom_text or
    new.mentee_topic_request is distinct from old.mentee_topic_request or new.topic_status is distinct from old.topic_status or
    new.session_focus_id is distinct from old.session_focus_id or new.final_focus_custom_text is distinct from old.final_focus_custom_text or
    new.resolved_topic is distinct from old.resolved_topic or new.mentor_scope_notes is distinct from old.mentor_scope_notes or
    new.supporting_materials is distinct from old.supporting_materials or new.supporting_material_entries is distinct from old.supporting_material_entries
  ) then raise exception 'Completed and cancelled session preferences are immutable' using errcode = '22023'; end if;
  return new;
end;
$$;

create or replace function public.intensive_mentoring_preference_immutability_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status in ('completed', 'cancelled') and (
    new.requested_focus_id is distinct from old.requested_focus_id or new.requested_focus_custom_text is distinct from old.requested_focus_custom_text or
    new.mentee_topic_request is distinct from old.mentee_topic_request or new.topic_status is distinct from old.topic_status or
    new.session_focus_id is distinct from old.session_focus_id or new.final_focus_custom_text is distinct from old.final_focus_custom_text or
    new.resolved_topic is distinct from old.resolved_topic or new.mentor_scope_notes is distinct from old.mentor_scope_notes or
    new.supporting_materials is distinct from old.supporting_materials or new.supporting_material_entries is distinct from old.supporting_material_entries
  ) then raise exception 'Completed and cancelled session preferences are immutable' using errcode = '22023'; end if;
  return new;
end;
$$;

create or replace function public.get_mentoring_session_preferences(p_kind text, p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb; v_owner uuid; v_mentor uuid; v_primary uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_kind = 'private' then
    select e.mentee_id, s.mentor_id, e.primary_mentor_id, jsonb_build_object(
      'sessionId', s.id, 'parentId', e.id, 'kind', 'private', 'status', s.status, 'scheduledStartAt', s.scheduled_start_at,
      'topicStatus', s.topic_status, 'requestedFocusId', s.requested_focus_id, 'requestedFocusName', rf.name,
      'requestedCustomFocus', s.requested_focus_custom_text, 'requestedTopic', s.mentee_topic_request,
      'focusId', s.session_focus_id, 'focusName', f.name, 'customFocus', s.final_focus_custom_text, 'topic', s.resolved_topic,
      'supportingMaterials', s.supporting_materials, 'supportingMaterialEntries', s.supporting_material_entries,
      'mentorNotes', s.mentor_scope_notes, 'competitionNames', e.competition_names
    ) into v_owner, v_mentor, v_primary, v_result
    from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id = s.enrollment_id
    left join public.private_mentoring_session_focuses rf on rf.id = s.requested_focus_id
    left join public.private_mentoring_session_focuses f on f.id = s.session_focus_id where s.id = p_session_id;
  elsif p_kind = 'intensive' then
    select e.mentee_id, s.mentor_id, e.primary_mentor_id, jsonb_build_object(
      'sessionId', s.id, 'parentId', e.id, 'kind', 'intensive', 'status', s.status, 'scheduledStartAt', s.scheduled_start_at,
      'topicStatus', s.topic_status, 'requestedFocusId', s.requested_focus_id, 'requestedFocusName', rf.name,
      'requestedCustomFocus', s.requested_focus_custom_text, 'requestedTopic', s.mentee_topic_request,
      'focusId', s.session_focus_id, 'focusName', f.name, 'customFocus', s.final_focus_custom_text, 'topic', s.resolved_topic,
      'supportingMaterials', s.supporting_materials, 'supportingMaterialEntries', s.supporting_material_entries,
      'mentorNotes', s.mentor_scope_notes, 'competitionNames', e.competition_names
    ) into v_owner, v_mentor, v_primary, v_result
    from public.intensive_mentoring_sessions s join public.intensive_mentoring_engagements e on e.id = s.engagement_id
    left join public.private_mentoring_session_focuses rf on rf.id = s.requested_focus_id
    left join public.private_mentoring_session_focuses f on f.id = s.session_focus_id where s.id = p_session_id;
  else raise exception 'Invalid mentoring kind' using errcode = '22023'; end if;
  if v_result is null then raise exception 'Mentoring session not found' using errcode = '22023'; end if;
  if not public.is_admin() and auth.uid() is distinct from v_owner and auth.uid() is distinct from v_mentor and auth.uid() is distinct from v_primary then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  return v_result;
end;
$$;

-- A separately named RPC with required arguments avoids defaulted overload ambiguity.
create or replace function public.save_mentoring_session_preferences_v2(
  p_kind text, p_session_id uuid, p_focus_id uuid, p_custom_focus text,
  p_topic text, p_supporting_material_entries jsonb, p_mentor_notes text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_custom text := nullif(btrim(coalesce(p_custom_focus, '')), '');
  v_topic text := nullif(btrim(coalesce(p_topic, '')), '');
  v_notes text := nullif(btrim(coalesce(p_mentor_notes, '')), '');
  v_entries jsonb;
  v_materials text[];
  v_admin boolean;
  v_private public.private_mentoring_sessions;
  v_intensive public.intensive_mentoring_sessions;
  v_calendar_change boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  v_admin := public.is_admin();
  v_entries := public.normalize_supporting_material_entries(p_supporting_material_entries);
  select coalesce(array_agg(entry ->> 'value' order by ordinal), '{}'::text[]) into v_materials
    from jsonb_array_elements(v_entries) with ordinality as materials(entry, ordinal);
  if v_custom is not null and char_length(v_custom) > 300 then raise exception 'Custom focus is too long' using errcode = '22023'; end if;
  if v_topic is not null and char_length(v_topic) > 3000 then raise exception 'Topic is too long' using errcode = '22023'; end if;
  if v_notes is not null and char_length(v_notes) > 3000 then raise exception 'Mentor notes are too long' using errcode = '22023'; end if;
  if p_focus_id is not null and not exists (select 1 from public.private_mentoring_session_focuses where id = p_focus_id and is_active) then
    raise exception 'Active focus required' using errcode = '22023';
  end if;
  if p_kind = 'private' then
    select * into v_private from public.private_mentoring_sessions where id = p_session_id for update;
    if not found then raise exception 'Session not found' using errcode = '22023'; end if;
    select mentee_id into v_owner from public.private_mentoring_enrollments where id = v_private.enrollment_id;
    if not v_admin and auth.uid() is distinct from v_owner then raise exception 'Forbidden' using errcode = '42501'; end if;
    if v_private.status in ('completed', 'cancelled') then raise exception 'Closed session preferences are immutable' using errcode = '22023'; end if;
    if v_private.status = 'scheduled' and v_private.scheduled_start_at <= now() then
      raise exception 'Only an upcoming scheduled session can change preferences' using errcode = '22023';
    end if;
    if v_admin then
      v_calendar_change := v_private.status = 'scheduled' and (
        v_private.session_focus_id is distinct from p_focus_id or
        v_private.final_focus_custom_text is distinct from case when p_focus_id is null then v_custom end or
        v_private.resolved_topic is distinct from v_topic
      );
      update public.private_mentoring_sessions set session_focus_id = p_focus_id,
        final_focus_custom_text = case when p_focus_id is null then v_custom end,
        resolved_topic = v_topic, mentor_scope_notes = v_notes, supporting_materials = v_materials,
        supporting_material_entries = v_entries, topic_status = 'confirmed', topic_updated_at = now(),
        status = case when status = 'awaiting_focus' then 'awaiting_scheduling' else status end
      where id = p_session_id returning * into v_private;
    else
      update public.private_mentoring_sessions set requested_focus_id = p_focus_id,
        requested_focus_custom_text = case when p_focus_id is null then v_custom end, mentee_topic_request = v_topic,
        supporting_materials = v_materials, supporting_material_entries = v_entries,
        topic_status = 'pending_review', topic_updated_at = now()
      where id = p_session_id returning * into v_private;
    end if;
    insert into public.private_mentoring_session_topic_events(
      session_id, event_type, requested_focus_id, requested_focus_custom_text, mentee_topic_request,
      resolved_focus_id, resolved_focus_custom_text, resolved_topic, supporting_materials, supporting_material_entries, mentor_scope_notes, actor_id
    ) values (
      p_session_id, case when v_admin then 'admin_resolution' else 'mentee_request' end,
      v_private.requested_focus_id, v_private.requested_focus_custom_text, v_private.mentee_topic_request,
      v_private.session_focus_id, v_private.final_focus_custom_text, v_private.resolved_topic,
      v_private.supporting_materials, v_private.supporting_material_entries, v_private.mentor_scope_notes, auth.uid()
    );
    if v_admin and v_calendar_change then
      insert into public.private_mentoring_session_calendar_integrations(session_id, organizer_user_id, sync_status, sync_error)
      values (p_session_id, auth.uid(), 'pending', null) on conflict (session_id) do update
      set sync_status = 'pending', sync_error = null, organizer_user_id = coalesce(public.private_mentoring_session_calendar_integrations.organizer_user_id, excluded.organizer_user_id);
    end if;
  elsif p_kind = 'intensive' then
    select * into v_intensive from public.intensive_mentoring_sessions where id = p_session_id for update;
    if not found then raise exception 'Session not found' using errcode = '22023'; end if;
    select mentee_id into v_owner from public.intensive_mentoring_engagements where id = v_intensive.engagement_id;
    if not v_admin and auth.uid() is distinct from v_owner then raise exception 'Forbidden' using errcode = '42501'; end if;
    if v_intensive.status in ('completed', 'cancelled') then raise exception 'Closed session preferences are immutable' using errcode = '22023'; end if;
    if v_intensive.status = 'scheduled' and v_intensive.scheduled_start_at <= now() then
      raise exception 'Only an upcoming scheduled session can change preferences' using errcode = '22023';
    end if;
    if v_admin then
      v_calendar_change := v_intensive.status = 'scheduled' and (
        v_intensive.session_focus_id is distinct from p_focus_id or
        v_intensive.final_focus_custom_text is distinct from case when p_focus_id is null then v_custom end or
        v_intensive.resolved_topic is distinct from v_topic
      );
      update public.intensive_mentoring_sessions set session_focus_id = p_focus_id,
        final_focus_custom_text = case when p_focus_id is null then v_custom end,
        resolved_topic = v_topic, mentor_scope_notes = v_notes, supporting_materials = v_materials,
        supporting_material_entries = v_entries, topic_status = 'confirmed',
        status = case when status = 'awaiting_focus' then 'awaiting_scheduling' else status end
      where id = p_session_id returning * into v_intensive;
    else
      update public.intensive_mentoring_sessions set requested_focus_id = p_focus_id,
        requested_focus_custom_text = case when p_focus_id is null then v_custom end, mentee_topic_request = v_topic,
        supporting_materials = v_materials, supporting_material_entries = v_entries, topic_status = 'pending_review'
      where id = p_session_id returning * into v_intensive;
    end if;
    insert into public.intensive_mentoring_session_events(session_id, event_type, actor_user_id, metadata)
    values (p_session_id, case when v_admin then 'preferences_reviewed' else 'preferences_submitted' end, auth.uid(), jsonb_build_object(
      'requestedFocusId', v_intensive.requested_focus_id, 'requestedCustomFocus', v_intensive.requested_focus_custom_text,
      'requestedTopic', v_intensive.mentee_topic_request, 'finalFocusId', v_intensive.session_focus_id,
      'finalCustomFocus', v_intensive.final_focus_custom_text, 'finalTopic', v_intensive.resolved_topic,
      'supportingMaterials', to_jsonb(v_intensive.supporting_materials), 'supportingMaterialEntries', v_intensive.supporting_material_entries,
      'mentorNotes', v_intensive.mentor_scope_notes
    ));
    if v_admin and v_calendar_change then
      insert into public.intensive_mentoring_session_calendar_integrations(session_id, organizer_user_id, sync_status, sync_error)
      values (p_session_id, auth.uid(), 'pending', null) on conflict (session_id) do update
      set sync_status = 'pending', sync_error = null, organizer_user_id = coalesce(public.intensive_mentoring_session_calendar_integrations.organizer_user_id, excluded.organizer_user_id);
    end if;
  else raise exception 'Invalid mentoring kind' using errcode = '22023'; end if;
  return public.get_mentoring_session_preferences(p_kind, p_session_id);
end;
$$;

-- Preserve the original, single text[] signature for older callers. No overload is added.
create or replace function public.save_mentoring_session_preferences(
  p_kind text, p_session_id uuid, p_focus_id uuid default null, p_custom_focus text default null,
  p_topic text default null, p_supporting_materials text[] default '{}'::text[], p_mentor_notes text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_entries jsonb; v_existing jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  v_existing := public.get_mentoring_session_preferences(p_kind, p_session_id) -> 'supportingMaterialEntries';
  if jsonb_typeof(v_existing) is distinct from 'array' then v_existing := '[]'::jsonb; end if;
  if coalesce(array_length(p_supporting_materials, 1), 0) > 20 or exists (
    select 1 from unnest(coalesce(p_supporting_materials, '{}'::text[])) value where char_length(btrim(value)) > 1000
  ) then raise exception 'Supporting materials exceed the supported limit' using errcode = '22023'; end if;
  -- Older clients cannot assign categories, but unchanged references retain theirs.
  select coalesce(jsonb_agg(coalesce(
    (select entry from jsonb_array_elements(v_existing) as existing(entry) where entry ->> 'value' = materials.value limit 1),
    jsonb_build_object('category', 'additional', 'kind', case when value ~* '^https?://' then 'link' else 'note' end, 'value', value)
  ) order by ordinal), '[]'::jsonb) into v_entries
  from unnest(public.clean_text_values(p_supporting_materials, 20, 1000)) with ordinality as materials(value, ordinal);
  return public.save_mentoring_session_preferences_v2(p_kind, p_session_id, p_focus_id, p_custom_focus, p_topic, v_entries, p_mentor_notes);
end;
$$;

drop trigger if exists private_flexible_session_invalidation on public.private_mentoring_sessions;
create trigger private_flexible_session_invalidation after update of requested_focus_custom_text, final_focus_custom_text, supporting_materials, supporting_material_entries
on public.private_mentoring_sessions for each row execute function public.invalidate_flexible_session_change();
drop trigger if exists intensive_flexible_session_invalidation on public.intensive_mentoring_sessions;
create trigger intensive_flexible_session_invalidation after update of requested_focus_custom_text, final_focus_custom_text, supporting_materials, supporting_material_entries, mentor_scope_notes
on public.intensive_mentoring_sessions for each row execute function public.invalidate_flexible_session_change();

revoke all on function public.normalize_supporting_material_entries(jsonb), public.get_mentoring_session_preferences(text, uuid),
  public.save_mentoring_session_preferences_v2(text, uuid, uuid, text, text, jsonb, text),
  public.save_mentoring_session_preferences(text, uuid, uuid, text, text, text[], text) from public, anon;
grant execute on function public.normalize_supporting_material_entries(jsonb), public.get_mentoring_session_preferences(text, uuid),
  public.save_mentoring_session_preferences_v2(text, uuid, uuid, text, text, jsonb, text),
  public.save_mentoring_session_preferences(text, uuid, uuid, text, text, text[], text) to authenticated, service_role;
