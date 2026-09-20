-- Intensive Mentoring operational domain, engagement grouping, flexible sessions, and catalog guardrails.
-- Forward-only: immutable order/order-item snapshots are never updated.

-- Keep source-backed national catalog values explicit while preserving consultation-only international and the latest approved guarantee availability.
update public.intensive_mentoring_packages
set sessions_per_month=4, price_amount=1150000, reference_price_amount=1400000, pricing_mode='fixed', is_active=true
where code='INTENSIVE';
update public.intensive_mentoring_packages
set sessions_per_month=8, price_amount=2200000, reference_price_amount=2800000, pricing_mode='fixed', is_active=true
where code='SUPER_INTENSIVE';
update public.intensive_mentoring_packages
set sessions_per_month=null, price_amount=null, reference_price_amount=null, pricing_mode='consultation', is_active=true
where code='INTERNATIONAL_COMPETITION';

update public.intensive_mentoring_add_ons set price_amount=150000,is_active=true where code='DETAILED_PERFORMANCE_REPORT';
update public.intensive_mentoring_add_ons set price_amount=300000,is_active=true where code='JUDGING_SIMULATION';
update public.intensive_mentoring_add_ons set price_amount=500000,is_active=true where code='WIN_GUARANTEE_PROTECTION';

update public.intensive_mentoring_bundles set price_amount=1250000,is_active=true where code='SKILL_BUILDER';
update public.intensive_mentoring_bundles set price_amount=2500000,is_active=true where code='COMPETITION_READY';
update public.intensive_mentoring_bundles set price_amount=3000000,is_active=true where code='COMPETITION_ASSURANCE';

create table if not exists public.intensive_mentoring_engagements(
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid not null references public.profiles(id),
  base_entitlement_id uuid not null unique references public.intensive_mentoring_entitlements(id),
  status text not null default 'active' check(status in ('active','completed','cancelled')),
  primary_mentor_id uuid references public.mentor_profiles(user_id),
  baseline_sessions_per_month integer check(baseline_sessions_per_month is null or baseline_sessions_per_month between 1 and 100),
  competition_category_id uuid references public.competition_categories(id),
  competition_name text check(competition_name is null or char_length(btrim(competition_name)) between 2 and 300),
  program_stage text not null default 'goal_setting' check(program_stage in ('goal_setting','initial_assessment','guided_development','practice_application','review_refinement','final_evaluation')),
  progress_summary text check(progress_summary is null or char_length(btrim(progress_summary))<=3000),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check((status='completed')=(completed_at is not null))
);
create index if not exists intensive_engagements_mentee_idx on public.intensive_mentoring_engagements(mentee_id,status,created_at desc,id);
create index if not exists intensive_engagements_mentor_idx on public.intensive_mentoring_engagements(primary_mentor_id,status) where primary_mentor_id is not null;
drop trigger if exists intensive_mentoring_engagements_touch_updated_at on public.intensive_mentoring_engagements;
create trigger intensive_mentoring_engagements_touch_updated_at before update on public.intensive_mentoring_engagements for each row execute function public.touch_updated_at();

alter table public.intensive_mentoring_entitlements add column if not exists engagement_id uuid references public.intensive_mentoring_engagements(id) on delete set null;
create index if not exists intensive_entitlements_engagement_idx on public.intensive_mentoring_entitlements(engagement_id) where engagement_id is not null;

create table if not exists public.intensive_mentoring_entitlement_attachment_events(
 id uuid primary key default gen_random_uuid(),
 entitlement_id uuid not null references public.intensive_mentoring_entitlements(id),
 engagement_id uuid references public.intensive_mentoring_engagements(id),
 event_type text not null check(event_type in ('auto_attached','admin_attached','detached')),
 actor_user_id uuid references public.profiles(id),
 note text,
 created_at timestamptz not null default now()
);

create table if not exists public.intensive_mentoring_primary_mentor_changes(
 id uuid primary key default gen_random_uuid(),
 engagement_id uuid not null references public.intensive_mentoring_engagements(id) on delete cascade,
 previous_mentor_id uuid references public.mentor_profiles(user_id),
 mentor_id uuid references public.mentor_profiles(user_id),
 changed_by uuid not null references public.profiles(id),
 reason text,
 created_at timestamptz not null default now()
);

create table if not exists public.intensive_mentoring_sessions(
 id uuid primary key default gen_random_uuid(),
 engagement_id uuid not null references public.intensive_mentoring_engagements(id) on delete cascade,
 session_number integer not null check(session_number>0),
 duration_minutes integer not null check(duration_minutes between 15 and 240),
 session_focus_id uuid references public.private_mentoring_session_focuses(id),
 requested_focus_id uuid references public.private_mentoring_session_focuses(id),
 mentee_topic_request text,
 topic_status text not null default 'needs_input' check(topic_status in ('needs_input','pending_review','confirmed')),
 resolved_topic text,
 mentor_id uuid references public.mentor_profiles(user_id),
 scheduled_start_at timestamptz,
 scheduled_end_at timestamptz,
 status text not null default 'awaiting_focus' check(status in ('awaiting_focus','awaiting_scheduling','scheduled','completed','cancelled')),
 creation_source text not null default 'admin_added' check(creation_source in ('admin_added','baseline')),
 creation_reason text,
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(engagement_id,session_number),
 check((scheduled_start_at is null)=(scheduled_end_at is null)),
 check(scheduled_end_at is null or scheduled_end_at>scheduled_start_at),
 check(mentee_topic_request is null or char_length(btrim(mentee_topic_request)) between 5 and 3000),
 check(resolved_topic is null or char_length(btrim(resolved_topic)) between 2 and 3000),
 check(status not in ('scheduled','completed') or (mentor_id is not null and scheduled_start_at is not null and session_focus_id is not null and resolved_topic is not null))
);
create index if not exists intensive_sessions_engagement_idx on public.intensive_mentoring_sessions(engagement_id,session_number);
create index if not exists intensive_sessions_mentor_idx on public.intensive_mentoring_sessions(mentor_id,scheduled_start_at) where mentor_id is not null;
drop trigger if exists intensive_mentoring_sessions_touch_updated_at on public.intensive_mentoring_sessions;
create trigger intensive_mentoring_sessions_touch_updated_at before update on public.intensive_mentoring_sessions for each row execute function public.touch_updated_at();

create table if not exists public.intensive_mentoring_session_events(
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.intensive_mentoring_sessions(id) on delete cascade,
 event_type text not null,
 actor_user_id uuid references public.profiles(id),
 from_status text,
 to_status text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists intensive_session_events_idx on public.intensive_mentoring_session_events(session_id,created_at,id);

create table if not exists public.intensive_mentoring_session_calendar_integrations(
 session_id uuid primary key references public.intensive_mentoring_sessions(id) on delete cascade,
 organizer_user_id uuid references public.profiles(id) on delete set null,
 google_calendar_id text not null default 'primary',
 google_event_id text,
 google_ical_uid text,
 meeting_provider text check(meeting_provider is null or meeting_provider='zoom'),
 provider_meeting_id text,
 provider_meeting_url text check(provider_meeting_url is null or provider_meeting_url ~ '^https://'),
 provider_host_id text,
 manual_meeting_url text check(manual_meeting_url is null or manual_meeting_url ~ '^https://'),
 provider_sync_status text not null default 'pending' check(provider_sync_status in ('pending','creating','ready','failed','cancelled')),
 provider_sync_error text,
 provider_sync_started_at timestamptz,
 sync_status text not null default 'pending' check(sync_status in ('pending','synced','failed','cancelled')),
 sync_error text,
 last_synced_at timestamptz,
 recording_status text not null default 'expected' check(recording_status in ('expected','processing','available','failed','unavailable','not_applicable')),
 recording_error text,
 recording_metadata jsonb,
 recording_available_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists intensive_zoom_provider_meeting_idx on public.intensive_mentoring_session_calendar_integrations(provider_meeting_id) where provider_meeting_id is not null;
drop trigger if exists intensive_session_integrations_touch_updated_at on public.intensive_mentoring_session_calendar_integrations;
create trigger intensive_session_integrations_touch_updated_at before update on public.intensive_mentoring_session_calendar_integrations for each row execute function public.touch_updated_at();

-- Backfill: every paid package/bundle entitlement owns exactly one base engagement.
insert into public.intensive_mentoring_engagements(mentee_id,base_entitlement_id,baseline_sessions_per_month,created_at,started_at)
select e.mentee_id,e.id,e.purchased_sessions,e.created_at,e.created_at
from public.intensive_mentoring_entitlements e
where e.entitlement_kind in ('package','bundle')
on conflict(base_entitlement_id) do nothing;

update public.intensive_mentoring_entitlements e
set engagement_id=g.id
from public.intensive_mentoring_engagements g
where g.base_entitlement_id=e.id and e.engagement_id is distinct from g.id;

-- Historical add-ons are attached only when their immutable order has one unambiguous base engagement.
with addon_candidates as(
 select addon.id as entitlement_id,(array_agg(distinct base.engagement_id))[1] as engagement_id,count(distinct base.engagement_id) as candidate_count
 from public.intensive_mentoring_entitlements addon
 join public.order_items addon_oi on addon_oi.id=addon.order_item_id
 join public.order_items base_oi on base_oi.order_id=addon_oi.order_id
 join public.intensive_mentoring_entitlements base on base.order_item_id=base_oi.id and base.entitlement_kind in ('package','bundle')
 where addon.entitlement_kind='add_on' and addon.engagement_id is null
 group by addon.id
)
update public.intensive_mentoring_entitlements addon
set engagement_id=c.engagement_id
from addon_candidates c
where addon.id=c.entitlement_id and c.candidate_count=1;

insert into public.intensive_mentoring_entitlement_attachment_events(entitlement_id,engagement_id,event_type,note)
select e.id,e.engagement_id,'auto_attached','Historical same-order add-on had exactly one base engagement.'
from public.intensive_mentoring_entitlements e
where e.entitlement_kind='add_on' and e.engagement_id is not null
and not exists(select 1 from public.intensive_mentoring_entitlement_attachment_events ev where ev.entitlement_id=e.id and ev.engagement_id=e.engagement_id and ev.event_type='auto_attached');

create or replace function public.reconcile_intensive_order_entitlements(p_order_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_count integer;v_engagement uuid;
begin
 insert into public.intensive_mentoring_engagements(mentee_id,base_entitlement_id,baseline_sessions_per_month,created_at,started_at)
 select e.mentee_id,e.id,e.purchased_sessions,e.created_at,e.created_at
 from public.intensive_mentoring_entitlements e join public.order_items oi on oi.id=e.order_item_id
 where oi.order_id=p_order_id and e.entitlement_kind in ('package','bundle')
 on conflict(base_entitlement_id) do nothing;

 update public.intensive_mentoring_entitlements e set engagement_id=g.id
 from public.intensive_mentoring_engagements g,public.order_items oi
 where oi.id=e.order_item_id and oi.order_id=p_order_id and g.base_entitlement_id=e.id
 and e.entitlement_kind in ('package','bundle') and e.engagement_id is distinct from g.id;

 select count(distinct e.engagement_id),(array_agg(distinct e.engagement_id))[1] into v_count,v_engagement
 from public.intensive_mentoring_entitlements e join public.order_items oi on oi.id=e.order_item_id
 where oi.order_id=p_order_id and e.entitlement_kind in ('package','bundle') and e.engagement_id is not null;

 if v_count=1 then
  with changed as(
   update public.intensive_mentoring_entitlements e set engagement_id=v_engagement
   from public.order_items oi
   where oi.id=e.order_item_id and oi.order_id=p_order_id and e.entitlement_kind='add_on' and e.engagement_id is null
   returning e.id,e.engagement_id
  )
  insert into public.intensive_mentoring_entitlement_attachment_events(entitlement_id,engagement_id,event_type,note)
  select id,engagement_id,'auto_attached','Same paid order has exactly one base Intensive engagement.' from changed;
 end if;
end; $$;

-- Replaces the entitlement-only fulfillment while preserving immutable paid snapshots.
create or replace function public.fulfill_paid_intensive_mentoring_order(p_order_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_order public.orders;v_item public.order_items;v_sessions integer;
begin
 select * into v_order from public.orders where id=p_order_id;
 if not found or v_order.status<>'paid' then return;end if;
 for v_item in select * from public.order_items where order_id=p_order_id and item_kind_snapshot in ('intensive_mentoring_package','intensive_mentoring_bundle','intensive_mentoring_add_on') loop
  v_sessions:=null;
  if v_item.item_kind_snapshot='intensive_mentoring_package' then
   select sessions_per_month into v_sessions from public.intensive_mentoring_packages where id=v_item.commerce_item_id;
   if not found then raise exception 'Paid Intensive Mentoring package is missing' using errcode='23503';end if;
   insert into public.intensive_mentoring_entitlements(mentee_id,order_item_id,entitlement_kind,package_id,purchased_sessions)
   values(v_order.user_id,v_item.id,'package',v_item.commerce_item_id,v_sessions) on conflict(order_item_id) do nothing;
  elsif v_item.item_kind_snapshot='intensive_mentoring_bundle' then
   select max(p.sessions_per_month) into v_sessions from public.intensive_mentoring_bundle_items bi join public.intensive_mentoring_packages p on p.id=bi.package_id where bi.bundle_id=v_item.commerce_item_id and bi.item_type='package' and bi.is_active;
   if not exists(select 1 from public.intensive_mentoring_bundles where id=v_item.commerce_item_id) then raise exception 'Paid Intensive Mentoring bundle is missing' using errcode='23503';end if;
   insert into public.intensive_mentoring_entitlements(mentee_id,order_item_id,entitlement_kind,bundle_id,purchased_sessions)
   values(v_order.user_id,v_item.id,'bundle',v_item.commerce_item_id,v_sessions) on conflict(order_item_id) do nothing;
  else
   if not exists(select 1 from public.intensive_mentoring_add_ons where id=v_item.commerce_item_id) then raise exception 'Paid Intensive Mentoring add-on is missing' using errcode='23503';end if;
   insert into public.intensive_mentoring_entitlements(mentee_id,order_item_id,entitlement_kind,add_on_id)
   values(v_order.user_id,v_item.id,'add_on',v_item.commerce_item_id) on conflict(order_item_id) do nothing;
  end if;
 end loop;
 perform public.reconcile_intensive_order_entitlements(p_order_id);
end; $$;

create or replace function public.admin_attach_intensive_add_on(p_entitlement_id uuid,p_engagement_id uuid,p_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_ent public.intensive_mentoring_entitlements;v_eng public.intensive_mentoring_engagements;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 select * into v_ent from public.intensive_mentoring_entitlements where id=p_entitlement_id for update;
 select * into v_eng from public.intensive_mentoring_engagements where id=p_engagement_id for update;
 if v_ent.entitlement_kind is distinct from 'add_on' then raise exception 'Add-on entitlement required' using errcode='22023';end if;
 if v_ent.mentee_id is distinct from v_eng.mentee_id then raise exception 'Add-on and engagement must belong to the same mentee' using errcode='22023';end if;
 if v_eng.status<>'active' then raise exception 'Active engagement required' using errcode='22023';end if;
 update public.intensive_mentoring_entitlements set engagement_id=p_engagement_id where id=p_entitlement_id;
 insert into public.intensive_mentoring_entitlement_attachment_events(entitlement_id,engagement_id,event_type,actor_user_id,note)
 values(p_entitlement_id,p_engagement_id,'admin_attached',auth.uid(),nullif(btrim(coalesce(p_note,'')),''));
end; $$;

create or replace function public.admin_set_intensive_primary_mentor(p_engagement_id uuid,p_mentor_id uuid,p_reason text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_eng public.intensive_mentoring_engagements;v_prev uuid;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 if not exists(select 1 from public.mentor_profiles mp join public.profiles p on p.id=mp.user_id where mp.user_id=p_mentor_id and mp.is_active and p.role='mentor'::public.app_role) then raise exception 'Active mentor required' using errcode='22023';end if;
 select * into v_eng from public.intensive_mentoring_engagements where id=p_engagement_id for update;
 if not found then raise exception 'Intensive engagement not found' using errcode='22023';end if;
 v_prev:=v_eng.primary_mentor_id;
 update public.intensive_mentoring_engagements set primary_mentor_id=p_mentor_id where id=p_engagement_id;
 insert into public.intensive_mentoring_primary_mentor_changes(engagement_id,previous_mentor_id,mentor_id,changed_by,reason) values(p_engagement_id,v_prev,p_mentor_id,auth.uid(),nullif(btrim(coalesce(p_reason,'')),''));
 perform public.emit_notification(v_eng.mentee_id,'mentee'::public.app_role,'mentor_assigned','Mentor Intensive Mentoring diperbarui','Mentor utama untuk engagement Intensive Mentoring kamu telah ditetapkan.','intensive_mentoring_engagement',p_engagement_id::text,'intensive:mentor:mentee:'||p_engagement_id::text||':'||p_mentor_id::text);
 perform public.emit_notification(p_mentor_id,'mentor'::public.app_role,'mentor_assigned','Penugasan Intensive Mentoring','Kamu ditetapkan sebagai primary mentor untuk engagement Intensive Mentoring.','intensive_mentoring_engagement',p_engagement_id::text,'intensive:mentor:mentor:'||p_engagement_id::text||':'||p_mentor_id::text);
end; $$;

create or replace function public.admin_set_intensive_program_stage(p_engagement_id uuid,p_stage text,p_progress_summary text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 if p_stage not in ('goal_setting','initial_assessment','guided_development','practice_application','review_refinement','final_evaluation') then raise exception 'Invalid program stage' using errcode='22023';end if;
 update public.intensive_mentoring_engagements set program_stage=p_stage,progress_summary=nullif(btrim(coalesce(p_progress_summary,'')),'') where id=p_engagement_id;
 if not found then raise exception 'Intensive engagement not found' using errcode='22023';end if;
end; $$;

create or replace function public.admin_add_intensive_mentoring_session(p_engagement_id uuid,p_duration_minutes integer,p_reason text default null)
returns public.intensive_mentoring_sessions language plpgsql security definer set search_path='' as $$
declare v_eng public.intensive_mentoring_engagements;v_session public.intensive_mentoring_sessions;v_number integer;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 if p_duration_minutes not between 15 and 240 then raise exception 'Duration must be between 15 and 240 minutes' using errcode='22023';end if;
 select * into v_eng from public.intensive_mentoring_engagements where id=p_engagement_id for update;
 if not found or v_eng.status<>'active' then raise exception 'Active Intensive engagement required' using errcode='22023';end if;
 select coalesce(max(session_number),0)+1 into v_number from public.intensive_mentoring_sessions where engagement_id=p_engagement_id;
 insert into public.intensive_mentoring_sessions(engagement_id,session_number,duration_minutes,mentor_id,created_by,creation_source,creation_reason)
 values(p_engagement_id,v_number,p_duration_minutes,v_eng.primary_mentor_id,auth.uid(),'admin_added',nullif(btrim(coalesce(p_reason,'')),''))
 returning * into v_session;
 insert into public.intensive_mentoring_session_events(session_id,event_type,actor_user_id,metadata)
 values(v_session.id,'session_created',auth.uid(),jsonb_build_object('source','admin_added','durationMinutes',p_duration_minutes,'reason',p_reason,'baselineSessionsPerMonth',v_eng.baseline_sessions_per_month));
 return v_session;
end; $$;

create or replace function public.submit_intensive_mentoring_topic_request(p_session_id uuid,p_requested_focus_id uuid,p_topic_request text)
returns void language plpgsql security definer set search_path='' as $$
declare v_session public.intensive_mentoring_sessions;v_eng public.intensive_mentoring_engagements;v_topic text:=btrim(coalesce(p_topic_request,''));
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 if char_length(v_topic)<5 or char_length(v_topic)>3000 then raise exception 'Topic request must be 5-3000 characters' using errcode='22023';end if;
 select s.* into v_session from public.intensive_mentoring_sessions s join public.intensive_mentoring_engagements e on e.id=s.engagement_id where s.id=p_session_id and e.mentee_id=auth.uid() for update of s;
 if not found then raise exception 'Intensive session not found' using errcode='22023';end if;
 select * into v_eng from public.intensive_mentoring_engagements where id=v_session.engagement_id;
 if v_session.status in ('completed','cancelled') then raise exception 'Closed session topic is immutable' using errcode='22023';end if;
 if p_requested_focus_id is not null and not exists(select 1 from public.private_mentoring_session_focuses f where f.id=p_requested_focus_id and f.is_active) then raise exception 'Active session focus required' using errcode='22023';end if;
 update public.intensive_mentoring_sessions set requested_focus_id=p_requested_focus_id,mentee_topic_request=v_topic,topic_status='pending_review',status=case when status='awaiting_focus' then 'awaiting_focus' else status end where id=p_session_id;
 insert into public.intensive_mentoring_session_events(session_id,event_type,actor_user_id,metadata) values(p_session_id,'topic_requested',auth.uid(),jsonb_build_object('topic',v_topic,'requestedFocusId',p_requested_focus_id));
end; $$;

create or replace function public.admin_resolve_intensive_mentoring_topic(p_session_id uuid,p_focus_id uuid,p_resolved_topic text,p_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_session public.intensive_mentoring_sessions;v_eng public.intensive_mentoring_engagements;v_topic text:=btrim(coalesce(p_resolved_topic,''));
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 if char_length(v_topic)<2 or char_length(v_topic)>3000 then raise exception 'Resolved topic must be 2-3000 characters' using errcode='22023';end if;
 if not exists(select 1 from public.private_mentoring_session_focuses f where f.id=p_focus_id and f.is_active) then raise exception 'Active session focus required' using errcode='22023';end if;
 select s.* into v_session from public.intensive_mentoring_sessions s where s.id=p_session_id for update;
 if not found or v_session.status in ('completed','cancelled') then raise exception 'Open Intensive session required' using errcode='22023';end if;
 select * into v_eng from public.intensive_mentoring_engagements where id=v_session.engagement_id;
 update public.intensive_mentoring_sessions set session_focus_id=p_focus_id,resolved_topic=v_topic,topic_status='confirmed',status=case when status='awaiting_focus' then 'awaiting_scheduling' else status end where id=p_session_id;
 insert into public.intensive_mentoring_session_events(session_id,event_type,actor_user_id,metadata) values(p_session_id,'topic_resolved',auth.uid(),jsonb_build_object('resolvedTopic',v_topic,'focusId',p_focus_id,'note',p_note));
 perform public.emit_notification(v_eng.mentee_id,'mentee'::public.app_role,'topic_resolved','Topik Intensive Mentoring dikonfirmasi','Admin telah mengonfirmasi fokus sesi Intensive Mentoring kamu.','intensive_mentoring_session',p_session_id::text,'intensive:topic:'||p_session_id::text||':'||md5(v_topic));
end; $$;

create or replace function public.admin_assign_intensive_session_mentor(p_session_id uuid,p_mentor_id uuid,p_reason text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_session public.intensive_mentoring_sessions;v_old uuid;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 if not exists(select 1 from public.mentor_profiles mp join public.profiles p on p.id=mp.user_id where mp.user_id=p_mentor_id and mp.is_active and p.role='mentor'::public.app_role) then raise exception 'Active mentor required' using errcode='22023';end if;
 select * into v_session from public.intensive_mentoring_sessions where id=p_session_id for update;
 if not found or v_session.status in ('completed','cancelled') then raise exception 'Open Intensive session required' using errcode='22023';end if;
 v_old:=v_session.mentor_id;
 update public.intensive_mentoring_sessions set mentor_id=p_mentor_id where id=p_session_id;
 insert into public.intensive_mentoring_session_events(session_id,event_type,actor_user_id,metadata) values(p_session_id,'mentor_reassigned',auth.uid(),jsonb_build_object('from',v_old,'to',p_mentor_id,'reason',p_reason));
 perform public.emit_notification(p_mentor_id,'mentor'::public.app_role,'mentor_assigned','Penugasan sesi Intensive Mentoring','Kamu ditugaskan untuk satu sesi Intensive Mentoring.','intensive_mentoring_session',p_session_id::text,'intensive:session-mentor:'||p_session_id::text||':'||p_mentor_id::text);
end; $$;

create or replace function public.admin_schedule_intensive_mentoring_session(p_session_id uuid,p_mentor_id uuid,p_scheduled_start_at timestamptz)
returns public.intensive_mentoring_sessions language plpgsql security definer set search_path='' as $$
declare v_session public.intensive_mentoring_sessions;v_eng public.intensive_mentoring_engagements;v_timezone text;v_end timestamptz;v_local_start timestamp;v_local_end timestamp;v_week_start date;v_day smallint;v_previous_status text;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 if p_scheduled_start_at is null or p_scheduled_start_at<=now() then raise exception 'Future schedule required' using errcode='22023';end if;
 select * into v_session from public.intensive_mentoring_sessions where id=p_session_id for update;
 if not found or v_session.status not in ('awaiting_scheduling','scheduled') or v_session.session_focus_id is null or v_session.resolved_topic is null then raise exception 'Resolved schedulable Intensive session required' using errcode='22023';end if;
 select * into v_eng from public.intensive_mentoring_engagements where id=v_session.engagement_id;
 v_previous_status:=v_session.status;
 select mp.timezone into v_timezone from public.mentor_profiles mp join public.profiles p on p.id=mp.user_id where mp.user_id=p_mentor_id and mp.is_active and p.role='mentor'::public.app_role;
 if not found then raise exception 'Active mentor required' using errcode='22023';end if;
 v_end:=p_scheduled_start_at+make_interval(mins=>v_session.duration_minutes);
 v_local_start:=p_scheduled_start_at at time zone v_timezone;v_local_end:=v_end at time zone v_timezone;v_week_start:=date_trunc('week',v_local_start)::date;v_day:=extract(isodow from v_local_start)::smallint;
 if v_local_end::date<>v_local_start::date or not exists(select 1 from public.mentor_availability_rules a where a.mentor_id=p_mentor_id and a.week_start_date=v_week_start and a.day_of_week=v_day and a.start_time<=v_local_start::time and a.end_time>=v_local_end::time) then raise exception 'Selected slot is outside declared mentor availability' using errcode='22023';end if;
 if exists(select 1 from public.private_mentoring_sessions s where s.mentor_id=p_mentor_id and s.status in ('scheduled','completed') and tstzrange(s.scheduled_start_at,s.scheduled_end_at,'[)')&&tstzrange(p_scheduled_start_at,v_end,'[)')) or exists(select 1 from public.intensive_mentoring_sessions s where s.id<>p_session_id and s.mentor_id=p_mentor_id and s.status in ('scheduled','completed') and tstzrange(s.scheduled_start_at,s.scheduled_end_at,'[)')&&tstzrange(p_scheduled_start_at,v_end,'[)')) then raise exception 'Selected slot conflicts with another Strativate mentor session' using errcode='23P01';end if;
 if exists(select 1 from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id=v_eng.mentee_id and s.status in ('scheduled','completed') and tstzrange(s.scheduled_start_at,s.scheduled_end_at,'[)')&&tstzrange(p_scheduled_start_at,v_end,'[)')) or exists(select 1 from public.intensive_mentoring_sessions s join public.intensive_mentoring_engagements e on e.id=s.engagement_id where s.id<>p_session_id and e.mentee_id=v_eng.mentee_id and s.status in ('scheduled','completed') and tstzrange(s.scheduled_start_at,s.scheduled_end_at,'[)')&&tstzrange(p_scheduled_start_at,v_end,'[)')) then raise exception 'Selected slot conflicts with another mentee session' using errcode='23P01';end if;
 update public.intensive_mentoring_sessions set mentor_id=p_mentor_id,scheduled_start_at=p_scheduled_start_at,scheduled_end_at=v_end,status='scheduled' where id=p_session_id returning * into v_session;
 insert into public.intensive_mentoring_session_calendar_integrations(session_id,organizer_user_id,meeting_provider,provider_sync_status,sync_status) values(p_session_id,auth.uid(),'zoom','pending','pending') on conflict(session_id) do update set organizer_user_id=coalesce(public.intensive_mentoring_session_calendar_integrations.organizer_user_id,excluded.organizer_user_id),meeting_provider='zoom',provider_sync_status='pending',provider_sync_error=null,sync_status='pending',sync_error=null;
 insert into public.intensive_mentoring_session_events(session_id,event_type,actor_user_id,from_status,to_status,metadata) values(p_session_id,case when v_previous_status='scheduled' then 'rescheduled' else 'scheduled' end,auth.uid(),v_previous_status,'scheduled',jsonb_build_object('mentorId',p_mentor_id,'start',p_scheduled_start_at,'end',v_end));
 perform public.emit_notification(v_eng.mentee_id,'mentee'::public.app_role,'session_scheduled','Sesi Intensive Mentoring dijadwalkan','Sesi Intensive Mentoring kamu telah dijadwalkan.','intensive_mentoring_session',p_session_id::text,'intensive:schedule:mentee:'||p_session_id::text||':'||extract(epoch from p_scheduled_start_at)::bigint::text);
 perform public.emit_notification(p_mentor_id,'mentor'::public.app_role,'session_scheduled','Sesi Intensive Mentoring dijadwalkan','Sesi Intensive Mentoring baru telah dijadwalkan untuk kamu.','intensive_mentoring_session',p_session_id::text,'intensive:schedule:mentor:'||p_session_id::text||':'||extract(epoch from p_scheduled_start_at)::bigint::text);
 return v_session;
end; $$;

create or replace function public.admin_cancel_intensive_mentoring_session(p_session_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_session public.intensive_mentoring_sessions;v_eng public.intensive_mentoring_engagements;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 select * into v_session from public.intensive_mentoring_sessions where id=p_session_id for update;
 if not found then raise exception 'Intensive session not found' using errcode='22023';end if;
 if v_session.status='cancelled' then return;end if;
 if v_session.status='completed' then raise exception 'Completed session cannot be cancelled' using errcode='22023';end if;
 select * into v_eng from public.intensive_mentoring_engagements where id=v_session.engagement_id;
 update public.intensive_mentoring_sessions set status='cancelled' where id=p_session_id;
 update public.intensive_mentoring_session_calendar_integrations set provider_sync_status='cancelled',sync_status='pending' where session_id=p_session_id;
 insert into public.intensive_mentoring_session_events(session_id,event_type,actor_user_id,from_status,to_status) values(p_session_id,'cancelled',auth.uid(),v_session.status,'cancelled');
 perform public.emit_notification(v_eng.mentee_id,'mentee'::public.app_role,'session_cancelled','Sesi Intensive Mentoring dibatalkan','Sesi Intensive Mentoring telah dibatalkan oleh admin.','intensive_mentoring_session',p_session_id::text,'intensive:cancel:'||p_session_id::text);
 if v_session.mentor_id is not null then perform public.emit_notification(v_session.mentor_id,'mentor'::public.app_role,'session_cancelled','Sesi Intensive Mentoring dibatalkan','Sesi Intensive Mentoring yang ditugaskan kepada kamu telah dibatalkan.','intensive_mentoring_session',p_session_id::text,'intensive:cancel:mentor:'||p_session_id::text);end if;
end; $$;

create or replace function public.admin_set_intensive_session_status(p_session_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare v_session public.intensive_mentoring_sessions;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 if p_status not in ('scheduled','completed') then raise exception 'Only scheduled/completed status transition is supported' using errcode='22023';end if;
 select * into v_session from public.intensive_mentoring_sessions where id=p_session_id for update;
 if not found then raise exception 'Intensive session not found' using errcode='22023';end if;
 if p_status='completed' and v_session.status<>'scheduled' then raise exception 'Only scheduled session can be completed' using errcode='22023';end if;
 if p_status='scheduled' and v_session.status<>'completed' then raise exception 'Only completed session can be reopened' using errcode='22023';end if;
 update public.intensive_mentoring_sessions set status=p_status where id=p_session_id;
 insert into public.intensive_mentoring_session_events(session_id,event_type,actor_user_id,from_status,to_status) values(p_session_id,case when p_status='completed' then 'completed' else 'completion_reverted' end,auth.uid(),v_session.status,p_status);
end; $$;

create or replace function public.intensive_engagement_add_ons_json(p_engagement_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'entitlementId',x.entitlement_id,'name',x.name,'code',x.code,'status',x.status,'source',x.source
 ) order by x.sort_order,x.name),'[]'::jsonb)
 from (
   select a.id entitlement_id,ao.name,ao.code,a.status::text status,'attached'::text source,1000+ao.sort_order sort_order,ao.id add_on_id
   from public.intensive_mentoring_entitlements a
   join public.intensive_mentoring_add_ons ao on ao.id=a.add_on_id
   where a.engagement_id=p_engagement_id and a.entitlement_kind='add_on'
   union all
   select null::uuid,ao.name,ao.code,'included'::text,'bundle'::text source,ao.sort_order,ao.id
   from public.intensive_mentoring_engagements g
   join public.intensive_mentoring_entitlements base on base.id=g.base_entitlement_id and base.entitlement_kind='bundle'
   join public.intensive_mentoring_bundle_items bi on bi.bundle_id=base.bundle_id and bi.item_type='add_on' and bi.is_active
   join public.intensive_mentoring_add_ons ao on ao.id=bi.add_on_id
   where g.id=p_engagement_id
     and not exists(
       select 1 from public.intensive_mentoring_entitlements attached
       where attached.engagement_id=g.id and attached.entitlement_kind='add_on' and attached.add_on_id=ao.id
     )
 ) x;
$$;
revoke all on function public.intensive_engagement_add_ons_json(uuid) from public,anon,authenticated;
grant execute on function public.intensive_engagement_add_ons_json(uuid) to service_role;

create or replace function public.list_my_intensive_mentoring_engagements()
returns table(
 engagement_id uuid,base_entitlement_id uuid,base_kind text,program_name text,status text,baseline_sessions_per_month integer,
 primary_mentor_id uuid,primary_mentor_name text,competition_name text,program_stage text,progress_summary text,started_at timestamptz,
 add_ons jsonb,sessions jsonb
) language sql stable security definer set search_path='' as $$
 select g.id,g.base_entitlement_id,e.entitlement_kind,coalesce(p.name,b.name)::text,g.status,g.baseline_sessions_per_month,g.primary_mentor_id,
 nullif(btrim(concat_ws(' ',mentor.first_name,mentor.last_name)),'')::text,g.competition_name,g.program_stage,g.progress_summary,g.started_at,
 public.intensive_engagement_add_ons_json(g.id),
 coalesce((select jsonb_agg(jsonb_build_object('sessionId',s.id,'sessionNumber',s.session_number,'durationMinutes',s.duration_minutes,'status',s.status,'focusId',s.session_focus_id,'focusName',f.name,'menteeTopicRequest',s.mentee_topic_request,'topicStatus',s.topic_status,'resolvedTopic',s.resolved_topic,'mentorId',s.mentor_id,'mentorName',nullif(btrim(concat_ws(' ',sm.first_name,sm.last_name)),''),'scheduledStartAt',s.scheduled_start_at,'scheduledEndAt',s.scheduled_end_at,'meetingUrl',case when s.status='scheduled' then coalesce(ci.manual_meeting_url,ci.provider_meeting_url) end,'googleSyncStatus',coalesce(ci.sync_status,'pending'),'recordingStatus',coalesce(ci.recording_status,'expected'),'creationSource',s.creation_source) order by s.session_number) from public.intensive_mentoring_sessions s left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id left join public.profiles sm on sm.id=s.mentor_id left join public.intensive_mentoring_session_calendar_integrations ci on ci.session_id=s.id where s.engagement_id=g.id),'[]'::jsonb)
 from public.intensive_mentoring_engagements g join public.intensive_mentoring_entitlements e on e.id=g.base_entitlement_id
 left join public.intensive_mentoring_packages p on p.id=e.package_id left join public.intensive_mentoring_bundles b on b.id=e.bundle_id left join public.profiles mentor on mentor.id=g.primary_mentor_id
 where g.mentee_id=auth.uid() order by g.created_at desc,g.id;
$$;

create or replace function public.list_admin_intensive_mentoring_engagements()
returns table(
 engagement_id uuid,mentee_id uuid,mentee_name text,mentee_email text,base_entitlement_id uuid,base_kind text,program_name text,status text,
 baseline_sessions_per_month integer,primary_mentor_id uuid,primary_mentor_name text,program_stage text,progress_summary text,created_at timestamptz,
 add_ons jsonb,sessions jsonb,unassigned_add_ons jsonb
) language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 return query select g.id,g.mentee_id,nullif(btrim(concat_ws(' ',mp.first_name,mp.last_name)),''),coalesce(mu.email,'')::text,g.base_entitlement_id,e.entitlement_kind,coalesce(p.name,b.name)::text,g.status,g.baseline_sessions_per_month,g.primary_mentor_id,nullif(btrim(concat_ws(' ',mentor.first_name,mentor.last_name)),'')::text,g.program_stage,g.progress_summary,g.created_at,
 public.intensive_engagement_add_ons_json(g.id),
 coalesce((select jsonb_agg(jsonb_build_object('sessionId',s.id,'sessionNumber',s.session_number,'durationMinutes',s.duration_minutes,'status',s.status,'focusId',s.session_focus_id,'focusName',f.name,'menteeTopicRequest',s.mentee_topic_request,'topicStatus',s.topic_status,'resolvedTopic',s.resolved_topic,'mentorId',s.mentor_id,'mentorName',nullif(btrim(concat_ws(' ',sm.first_name,sm.last_name)),''),'scheduledStartAt',s.scheduled_start_at,'scheduledEndAt',s.scheduled_end_at,'meetingUrl',case when s.status='scheduled' then coalesce(ci.manual_meeting_url,ci.provider_meeting_url) end,'providerSyncStatus',coalesce(ci.provider_sync_status,'pending'),'googleSyncStatus',coalesce(ci.sync_status,'pending'),'recordingStatus',coalesce(ci.recording_status,'expected'),'creationSource',s.creation_source,'creationReason',s.creation_reason) order by s.session_number) from public.intensive_mentoring_sessions s left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id left join public.profiles sm on sm.id=s.mentor_id left join public.intensive_mentoring_session_calendar_integrations ci on ci.session_id=s.id where s.engagement_id=g.id),'[]'::jsonb),
 coalesce((select jsonb_agg(jsonb_build_object('entitlementId',a.id,'name',ao.name,'code',ao.code,'createdAt',a.created_at) order by a.created_at,a.id) from public.intensive_mentoring_entitlements a join public.intensive_mentoring_add_ons ao on ao.id=a.add_on_id where a.mentee_id=g.mentee_id and a.entitlement_kind='add_on' and a.engagement_id is null),'[]'::jsonb)
 from public.intensive_mentoring_engagements g join public.intensive_mentoring_entitlements e on e.id=g.base_entitlement_id join public.profiles mp on mp.id=g.mentee_id join auth.users mu on mu.id=g.mentee_id left join public.intensive_mentoring_packages p on p.id=e.package_id left join public.intensive_mentoring_bundles b on b.id=e.bundle_id left join public.profiles mentor on mentor.id=g.primary_mentor_id order by g.created_at desc,g.id;
end; $$;

create or replace function public.list_my_mentor_intensive_mentoring_sessions()
returns table(
 session_id uuid,engagement_id uuid,mentee_id uuid,mentee_name text,mentee_email text,program_name text,session_number integer,status text,focus_name text,resolved_topic text,
 scheduled_start_at timestamptz,scheduled_end_at timestamptz,mentor_timezone text,duration_minutes integer,meeting_url text,google_event_id text,google_ical_uid text,google_sync_status text,recording_status text,add_ons jsonb
) language sql stable security definer set search_path='' as $$
 select s.id,g.id,g.mentee_id,nullif(btrim(concat_ws(' ',mp.first_name,mp.last_name)),''),coalesce(mu.email,'')::text,coalesce(p.name,b.name)::text,s.session_number,s.status,f.name,s.resolved_topic,s.scheduled_start_at,s.scheduled_end_at,mentor_profile.timezone,s.duration_minutes,case when s.status='scheduled' then coalesce(ci.manual_meeting_url,ci.provider_meeting_url) end,ci.google_event_id,ci.google_ical_uid,coalesce(ci.sync_status,'pending'),coalesce(ci.recording_status,'expected'),
 public.intensive_engagement_add_ons_json(g.id)
 from public.intensive_mentoring_sessions s join public.intensive_mentoring_engagements g on g.id=s.engagement_id join public.intensive_mentoring_entitlements e on e.id=g.base_entitlement_id join public.profiles mp on mp.id=g.mentee_id join auth.users mu on mu.id=g.mentee_id join public.mentor_profiles mentor_profile on mentor_profile.user_id=s.mentor_id left join public.intensive_mentoring_packages p on p.id=e.package_id left join public.intensive_mentoring_bundles b on b.id=e.bundle_id left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id left join public.intensive_mentoring_session_calendar_integrations ci on ci.session_id=s.id
 where s.mentor_id=auth.uid() order by s.scheduled_start_at nulls last,s.session_number;
$$;

create or replace function public.admin_get_intensive_mentoring_slot_context(p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 select jsonb_build_object('sessionId',s.id,'status',s.status,'focusName',coalesce(s.resolved_topic,f.name),'requiredTierId',null,'durationMinutes',s.duration_minutes,'menteeId',g.mentee_id,'purchasedSessions',g.baseline_sessions_per_month,'sessionNumber',s.session_number,'primaryMentorId',g.primary_mentor_id,
 'mentors',coalesce((select jsonb_agg(jsonb_build_object('mentorId',m.user_id,'mentorName',coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),u.email),'tierId',m.tier_id,'active',m.is_active,'timezone',m.timezone,'availability',coalesce((select jsonb_agg(jsonb_build_object('start',(((a.week_start_date+(a.day_of_week-1))::date+a.start_time) at time zone m.timezone),'end',(((a.week_start_date+(a.day_of_week-1))::date+a.end_time) at time zone m.timezone)) order by a.week_start_date,a.day_of_week,a.start_time) from public.mentor_availability_rules a where a.mentor_id=m.user_id and a.week_start_date in(date_trunc('week',current_timestamp at time zone m.timezone)::date,date_trunc('week',current_timestamp at time zone m.timezone)::date+7)),'[]'::jsonb),'strativate_busy',coalesce((select jsonb_agg(jsonb_build_object('start',busy.start_at,'end',busy.end_at) order by busy.start_at) from (select ps.scheduled_start_at start_at,ps.scheduled_end_at end_at from public.private_mentoring_sessions ps where ps.mentor_id=m.user_id and ps.status in('scheduled','completed') union all select isess.scheduled_start_at,isess.scheduled_end_at from public.intensive_mentoring_sessions isess where isess.mentor_id=m.user_id and isess.id<>s.id and isess.status in('scheduled','completed'))busy),'[]'::jsonb)) order by case when m.user_id=g.primary_mentor_id then 0 else 1 end,coalesce(p.first_name,''),coalesce(p.last_name,'')) from public.mentor_profiles m join public.profiles p on p.id=m.user_id and p.role='mentor'::public.app_role join auth.users u on u.id=m.user_id where m.is_active),'[]'::jsonb))
 into v_result from public.intensive_mentoring_sessions s join public.intensive_mentoring_engagements g on g.id=s.engagement_id left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id where s.id=p_session_id;
 if v_result is null then raise exception 'Intensive session not found' using errcode='22023';end if;
 return v_result;
end; $$;

-- Provider contexts reuse the same Zoom/Calendar server helpers but keep Intensive storage separate.
create or replace function public.service_get_intensive_zoom_meeting_context(p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501';end if;
 select jsonb_build_object('sessionId',s.id,'status',s.status,'start',s.scheduled_start_at,'end',s.scheduled_end_at,'sessionNumber',s.session_number,'purchasedSessions',g.baseline_sessions_per_month,'topic',coalesce(s.resolved_topic,f.name,'Intensive Mentoring Session'),'mentorId',s.mentor_id,'menteeId',g.mentee_id,'meetingProvider',ci.meeting_provider,'providerMeetingId',ci.provider_meeting_id,'providerMeetingUrl',ci.provider_meeting_url,'providerSyncStatus',ci.provider_sync_status)
 into v_result from public.intensive_mentoring_sessions s join public.intensive_mentoring_engagements g on g.id=s.engagement_id left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id left join public.intensive_mentoring_session_calendar_integrations ci on ci.session_id=s.id where s.id=p_session_id;
 if v_result is null then raise exception 'Intensive session not found' using errcode='22023';end if;return v_result;
end; $$;

create or replace function public.service_claim_intensive_zoom_meeting_creation(p_session_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_row public.intensive_mentoring_session_calendar_integrations;v_status text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501';end if;
 select status into v_status from public.intensive_mentoring_sessions where id=p_session_id for update;
 if not found then raise exception 'Intensive session not found' using errcode='22023';end if;
 insert into public.intensive_mentoring_session_calendar_integrations(session_id,meeting_provider,provider_sync_status,sync_status) values(p_session_id,case when v_status in('completed','cancelled') then null else 'zoom' end,case when v_status='cancelled' then 'cancelled' else 'pending' end,'pending') on conflict(session_id) do nothing;
 select * into v_row from public.intensive_mentoring_session_calendar_integrations where session_id=p_session_id for update;
 if v_status in('completed','cancelled') then update public.intensive_mentoring_session_calendar_integrations set meeting_provider=null,provider_sync_started_at=null where session_id=p_session_id;return 'inactive';end if;
 if v_row.provider_meeting_id is not null then update public.intensive_mentoring_session_calendar_integrations set meeting_provider='zoom',provider_sync_status='pending',provider_sync_error=null where session_id=p_session_id;return 'update';end if;
 if v_row.provider_sync_status='creating' and v_row.provider_sync_started_at>now()-interval '5 minutes' then return 'wait';end if;
 update public.intensive_mentoring_session_calendar_integrations set meeting_provider='zoom',provider_sync_status='creating',provider_sync_error=null,provider_sync_started_at=now() where session_id=p_session_id;return 'create';
end; $$;

create or replace function public.service_store_intensive_zoom_meeting(p_session_id uuid,p_meeting_id text,p_join_url text,p_host_id text,p_recording_status text,p_recording_error text default null)
returns void language plpgsql security definer set search_path='' as $$
begin if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501';end if;update public.intensive_mentoring_session_calendar_integrations set meeting_provider='zoom',provider_meeting_id=p_meeting_id,provider_meeting_url=p_join_url,provider_host_id=p_host_id,provider_sync_status='ready',provider_sync_error=null,recording_status=p_recording_status,recording_error=p_recording_error where session_id=p_session_id;end; $$;

create or replace function public.service_mark_intensive_zoom_sync(p_session_id uuid,p_status text,p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
begin if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501';end if;update public.intensive_mentoring_session_calendar_integrations set provider_sync_status=p_status,provider_sync_error=p_error where session_id=p_session_id;end; $$;

create or replace function public.service_get_intensive_mentoring_sync_context(p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501';end if;
 select jsonb_build_object('sessionId',s.id,'sessionNumber',s.session_number,'purchasedSessions',g.baseline_sessions_per_month,'status',s.status,'focusName',coalesce(s.resolved_topic,f.name),'resolvedTopic',s.resolved_topic,'start',s.scheduled_start_at,'end',s.scheduled_end_at,'menteeEmail',mentee.email,'mentorEmail',mentor.email,'organizerUserId',ci.organizer_user_id,'calendarId',coalesce(ci.google_calendar_id,'primary'),'eventId',ci.google_event_id,'iCalUID',ci.google_ical_uid,'providerMeetingUrl',case when s.status='scheduled' and ci.meeting_provider='zoom' then ci.provider_meeting_url end,'manualMeetingUrl',case when s.status='scheduled' then ci.manual_meeting_url end)
 into v_result from public.intensive_mentoring_sessions s join public.intensive_mentoring_engagements g on g.id=s.engagement_id join auth.users mentee on mentee.id=g.mentee_id left join auth.users mentor on mentor.id=s.mentor_id left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id left join public.intensive_mentoring_session_calendar_integrations ci on ci.session_id=s.id where s.id=p_session_id;
 if v_result is null then raise exception 'Intensive session not found' using errcode='22023';end if;return v_result;
end; $$;

alter table public.intensive_mentoring_engagements enable row level security;
alter table public.intensive_mentoring_entitlement_attachment_events enable row level security;
alter table public.intensive_mentoring_primary_mentor_changes enable row level security;
alter table public.intensive_mentoring_sessions enable row level security;
alter table public.intensive_mentoring_session_events enable row level security;
alter table public.intensive_mentoring_session_calendar_integrations enable row level security;

drop policy if exists intensive_engagement_owner_read on public.intensive_mentoring_engagements;
create policy intensive_engagement_owner_read on public.intensive_mentoring_engagements for select to authenticated using(mentee_id=auth.uid());
drop policy if exists intensive_engagement_admin_read on public.intensive_mentoring_engagements;
create policy intensive_engagement_admin_read on public.intensive_mentoring_engagements for select to authenticated using(public.is_admin());
drop policy if exists intensive_engagement_mentor_read on public.intensive_mentoring_engagements;
create policy intensive_engagement_mentor_read on public.intensive_mentoring_engagements for select to authenticated using(primary_mentor_id=auth.uid() or exists(select 1 from public.intensive_mentoring_sessions s where s.engagement_id=intensive_mentoring_engagements.id and s.mentor_id=auth.uid()));
drop policy if exists intensive_sessions_owner_read on public.intensive_mentoring_sessions;
create policy intensive_sessions_owner_read on public.intensive_mentoring_sessions for select to authenticated using(exists(select 1 from public.intensive_mentoring_engagements g where g.id=engagement_id and g.mentee_id=auth.uid()));
drop policy if exists intensive_sessions_admin_read on public.intensive_mentoring_sessions;
create policy intensive_sessions_admin_read on public.intensive_mentoring_sessions for select to authenticated using(public.is_admin());
drop policy if exists intensive_sessions_mentor_read on public.intensive_mentoring_sessions;
create policy intensive_sessions_mentor_read on public.intensive_mentoring_sessions for select to authenticated using(mentor_id=auth.uid());
drop policy if exists intensive_session_events_owner_read on public.intensive_mentoring_session_events;
create policy intensive_session_events_owner_read on public.intensive_mentoring_session_events for select to authenticated using(exists(select 1 from public.intensive_mentoring_sessions s join public.intensive_mentoring_engagements g on g.id=s.engagement_id where s.id=session_id and g.mentee_id=auth.uid()));
drop policy if exists intensive_session_events_admin_read on public.intensive_mentoring_session_events;
create policy intensive_session_events_admin_read on public.intensive_mentoring_session_events for select to authenticated using(public.is_admin());
drop policy if exists intensive_session_events_mentor_read on public.intensive_mentoring_session_events;
create policy intensive_session_events_mentor_read on public.intensive_mentoring_session_events for select to authenticated using(exists(select 1 from public.intensive_mentoring_sessions s where s.id=session_id and s.mentor_id=auth.uid()));

revoke all on public.intensive_mentoring_engagements,public.intensive_mentoring_entitlement_attachment_events,public.intensive_mentoring_primary_mentor_changes,public.intensive_mentoring_sessions,public.intensive_mentoring_session_events,public.intensive_mentoring_session_calendar_integrations from public,anon,authenticated;
grant select on public.intensive_mentoring_engagements,public.intensive_mentoring_sessions,public.intensive_mentoring_session_events to authenticated;
grant all on public.intensive_mentoring_engagements,public.intensive_mentoring_entitlement_attachment_events,public.intensive_mentoring_primary_mentor_changes,public.intensive_mentoring_sessions,public.intensive_mentoring_session_events,public.intensive_mentoring_session_calendar_integrations to service_role;

revoke all on function public.reconcile_intensive_order_entitlements(uuid) from public,anon,authenticated;
grant execute on function public.reconcile_intensive_order_entitlements(uuid) to service_role;
revoke all on function public.admin_attach_intensive_add_on(uuid,uuid,text),public.admin_set_intensive_primary_mentor(uuid,uuid,text),public.admin_set_intensive_program_stage(uuid,text,text),public.admin_add_intensive_mentoring_session(uuid,integer,text),public.submit_intensive_mentoring_topic_request(uuid,uuid,text),public.admin_resolve_intensive_mentoring_topic(uuid,uuid,text,text),public.admin_assign_intensive_session_mentor(uuid,uuid,text),public.admin_schedule_intensive_mentoring_session(uuid,uuid,timestamptz),public.admin_cancel_intensive_mentoring_session(uuid),public.admin_set_intensive_session_status(uuid,text),public.list_my_intensive_mentoring_engagements(),public.list_admin_intensive_mentoring_engagements(),public.list_my_mentor_intensive_mentoring_sessions(),public.admin_get_intensive_mentoring_slot_context(uuid) from public,anon;
grant execute on function public.admin_attach_intensive_add_on(uuid,uuid,text),public.admin_set_intensive_primary_mentor(uuid,uuid,text),public.admin_set_intensive_program_stage(uuid,text,text),public.admin_add_intensive_mentoring_session(uuid,integer,text),public.submit_intensive_mentoring_topic_request(uuid,uuid,text),public.admin_resolve_intensive_mentoring_topic(uuid,uuid,text,text),public.admin_assign_intensive_session_mentor(uuid,uuid,text),public.admin_schedule_intensive_mentoring_session(uuid,uuid,timestamptz),public.admin_cancel_intensive_mentoring_session(uuid),public.admin_set_intensive_session_status(uuid,text),public.list_my_intensive_mentoring_engagements(),public.list_admin_intensive_mentoring_engagements(),public.list_my_mentor_intensive_mentoring_sessions(),public.admin_get_intensive_mentoring_slot_context(uuid) to authenticated,service_role;

revoke all on function public.service_get_intensive_zoom_meeting_context(uuid),public.service_claim_intensive_zoom_meeting_creation(uuid),public.service_store_intensive_zoom_meeting(uuid,text,text,text,text,text),public.service_mark_intensive_zoom_sync(uuid,text,text),public.service_get_intensive_mentoring_sync_context(uuid) from public,anon,authenticated;
grant execute on function public.service_get_intensive_zoom_meeting_context(uuid),public.service_claim_intensive_zoom_meeting_creation(uuid),public.service_store_intensive_zoom_meeting(uuid,text,text,text,text,text),public.service_mark_intensive_zoom_sync(uuid,text,text),public.service_get_intensive_mentoring_sync_context(uuid) to service_role;

comment on table public.intensive_mentoring_engagements is 'One operational Intensive Mentoring program instance per paid base package/bundle entitlement.';
comment on table public.intensive_mentoring_sessions is 'Flexible operational sessions. baseline_sessions_per_month is guidance, never a hard cap and never mutates paid order totals.';
comment on table public.intensive_mentoring_session_calendar_integrations is 'Server-only Zoom and Google Calendar identity/sync state for Intensive Mentoring sessions.';


-- Keep one Zoom server implementation: the existing service RPC names dispatch by session ownership.
create or replace function public.service_get_zoom_meeting_context(p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501';end if;
 if exists(select 1 from public.intensive_mentoring_sessions where id=p_session_id) then
  return public.service_get_intensive_zoom_meeting_context(p_session_id);
 end if;
 select jsonb_build_object(
  'sessionId',s.id,'status',s.status,'start',s.scheduled_start_at,'end',s.scheduled_end_at,
  'sessionNumber',s.session_number,'purchasedSessions',e.purchased_sessions,
  'topic',coalesce(s.resolved_topic,f.name,'Mentoring Session'),'mentorId',s.mentor_id,'menteeId',e.mentee_id,
  'meetingProvider',ci.meeting_provider,'providerMeetingId',ci.provider_meeting_id,
  'providerMeetingUrl',ci.provider_meeting_url,'providerSyncStatus',ci.provider_sync_status
 ) into v_result
 from public.private_mentoring_sessions s
 join public.private_mentoring_enrollments e on e.id=s.enrollment_id
 left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id
 left join public.private_mentoring_session_calendar_integrations ci on ci.session_id=s.id
 where s.id=p_session_id;
 if v_result is null then raise exception 'Mentoring session not found' using errcode='22023';end if;
 return v_result;
end; $$;

create or replace function public.service_claim_zoom_meeting_creation(p_session_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_row public.private_mentoring_session_calendar_integrations;v_status text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501';end if;
 if exists(select 1 from public.intensive_mentoring_sessions where id=p_session_id) then
  return public.service_claim_intensive_zoom_meeting_creation(p_session_id);
 end if;
 select s.status::text into v_status from public.private_mentoring_sessions s where s.id=p_session_id for update;
 if not found then raise exception 'Private Mentoring session not found' using errcode='22023';end if;
 insert into public.private_mentoring_session_calendar_integrations(session_id,meeting_provider,provider_sync_status,sync_status)
 values(p_session_id,case when v_status in('completed','cancelled') then null else 'zoom' end,case when v_status='cancelled' then 'cancelled' else 'pending' end,'pending')
 on conflict(session_id) do nothing;
 select * into v_row from public.private_mentoring_session_calendar_integrations where session_id=p_session_id for update;
 if v_status in('completed','cancelled') then
  update public.private_mentoring_session_calendar_integrations set meeting_provider=null,provider_sync_started_at=null where session_id=p_session_id;
  return 'inactive';
 end if;
 if v_row.provider_meeting_id is not null and v_row.meeting_provider='zoom' then
  update public.private_mentoring_session_calendar_integrations set meeting_provider='zoom',provider_sync_status='pending',provider_sync_error=null where session_id=p_session_id;
  return 'update';
 end if;
 if v_row.provider_sync_status='creating' and v_row.provider_sync_started_at>now()-interval '5 minutes' then return 'wait';end if;
 update public.private_mentoring_session_calendar_integrations set meeting_provider='zoom',provider_sync_status='creating',provider_sync_error=null,provider_sync_started_at=now() where session_id=p_session_id;
 return 'create';
end; $$;

create or replace function public.service_store_zoom_meeting(p_session_id uuid,p_meeting_id text,p_join_url text,p_host_id text,p_recording_status text,p_recording_error text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501';end if;
 if exists(select 1 from public.intensive_mentoring_sessions where id=p_session_id) then
  perform public.service_store_intensive_zoom_meeting(p_session_id,p_meeting_id,p_join_url,p_host_id,p_recording_status,p_recording_error);
  return;
 end if;
 update public.private_mentoring_session_calendar_integrations
 set meeting_provider='zoom',provider_meeting_id=p_meeting_id,provider_meeting_url=p_join_url,provider_host_id=p_host_id,
     provider_sync_status='ready',provider_sync_error=null,recording_status=p_recording_status,recording_error=p_recording_error
 where session_id=p_session_id;
end; $$;

create or replace function public.service_mark_zoom_sync(p_session_id uuid,p_status text,p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501';end if;
 if exists(select 1 from public.intensive_mentoring_sessions where id=p_session_id) then
  perform public.service_mark_intensive_zoom_sync(p_session_id,p_status,p_error);
  return;
 end if;
 update public.private_mentoring_session_calendar_integrations set provider_sync_status=p_status,provider_sync_error=p_error where session_id=p_session_id;
end; $$;


create table if not exists public.intensive_mentoring_engagement_events(
 id uuid primary key default gen_random_uuid(),
 engagement_id uuid not null references public.intensive_mentoring_engagements(id) on delete cascade,
 event_type text not null,
 actor_user_id uuid references public.profiles(id),
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists intensive_engagement_events_idx on public.intensive_mentoring_engagement_events(engagement_id,created_at,id);
alter table public.intensive_mentoring_engagement_events enable row level security;
drop policy if exists intensive_engagement_events_owner_read on public.intensive_mentoring_engagement_events;
create policy intensive_engagement_events_owner_read on public.intensive_mentoring_engagement_events for select to authenticated using(exists(select 1 from public.intensive_mentoring_engagements g where g.id=engagement_id and g.mentee_id=auth.uid()));
drop policy if exists intensive_engagement_events_admin_read on public.intensive_mentoring_engagement_events;
create policy intensive_engagement_events_admin_read on public.intensive_mentoring_engagement_events for select to authenticated using(public.is_admin());
drop policy if exists intensive_engagement_events_mentor_read on public.intensive_mentoring_engagement_events;
create policy intensive_engagement_events_mentor_read on public.intensive_mentoring_engagement_events for select to authenticated using(exists(select 1 from public.intensive_mentoring_engagements g where g.id=engagement_id and (g.primary_mentor_id=auth.uid() or exists(select 1 from public.intensive_mentoring_sessions s where s.engagement_id=g.id and s.mentor_id=auth.uid()))));
revoke all on public.intensive_mentoring_engagement_events from public,anon,authenticated;
grant select on public.intensive_mentoring_engagement_events to authenticated;
grant all on public.intensive_mentoring_engagement_events to service_role;

create or replace function public.admin_set_intensive_program_stage(p_engagement_id uuid,p_stage text,p_progress_summary text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_before public.intensive_mentoring_engagements;v_summary text:=nullif(btrim(coalesce(p_progress_summary,'')),'');
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 if p_stage not in ('goal_setting','initial_assessment','guided_development','practice_application','review_refinement','final_evaluation') then raise exception 'Invalid program stage' using errcode='22023';end if;
 select * into v_before from public.intensive_mentoring_engagements where id=p_engagement_id for update;
 if not found then raise exception 'Intensive engagement not found' using errcode='22023';end if;
 update public.intensive_mentoring_engagements set program_stage=p_stage,progress_summary=v_summary where id=p_engagement_id;
 insert into public.intensive_mentoring_engagement_events(engagement_id,event_type,actor_user_id,metadata)
 values(p_engagement_id,'program_progress_updated',auth.uid(),jsonb_build_object('fromStage',v_before.program_stage,'toStage',p_stage,'previousSummary',v_before.progress_summary,'progressSummary',v_summary));
end; $$;

create or replace function public.notify_intensive_mentoring_integration_changes()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_mentee uuid;v_mentor uuid;v_effective text;v_old_effective text;
begin
 select g.mentee_id,s.mentor_id into v_mentee,v_mentor from public.intensive_mentoring_sessions s join public.intensive_mentoring_engagements g on g.id=s.engagement_id where s.id=new.session_id;
 v_effective:=coalesce(new.manual_meeting_url,new.provider_meeting_url);v_old_effective:=coalesce(old.manual_meeting_url,old.provider_meeting_url);
 if v_effective is distinct from v_old_effective and v_effective is not null then
  if v_mentor is not null then perform public.emit_notification(v_mentor,'mentor'::public.app_role,'meeting_url_changed','Meeting link Intensive tersedia','Meeting link sesi Intensive Mentoring tersedia atau berubah.','intensive_mentoring_session',new.session_id::text,'intensive:session:'||new.session_id||':meeting:'||md5(v_effective)||':mentor');end if;
  perform public.emit_notification(v_mentee,'mentee'::public.app_role,'meeting_url_changed','Meeting link Intensive tersedia','Meeting link sesi Intensive Mentoring tersedia atau berubah.','intensive_mentoring_session',new.session_id::text,'intensive:session:'||new.session_id||':meeting:'||md5(v_effective)||':mentee');
 end if;
 if new.provider_sync_status='failed' and old.provider_sync_status is distinct from 'failed' then perform public.emit_notification(null,'admin'::public.app_role,'zoom_failed','Zoom Intensive sync gagal',coalesce(new.provider_sync_error,'Zoom meeting Intensive belum tersinkron.'),'intensive_mentoring_session',new.session_id::text,'intensive:session:'||new.session_id||':zoom-failed:'||md5(coalesce(new.provider_sync_error,'')));end if;
 if new.sync_status='failed' and old.sync_status is distinct from 'failed' then perform public.emit_notification(null,'admin'::public.app_role,'calendar_failed','Google Calendar Intensive sync gagal',coalesce(new.sync_error,'Google Calendar Intensive belum tersinkron.'),'intensive_mentoring_session',new.session_id::text,'intensive:session:'||new.session_id||':calendar-failed:'||md5(coalesce(new.sync_error,'')));end if;
 if new.recording_status in ('failed','unavailable') and old.recording_status is distinct from new.recording_status then perform public.emit_notification(null,'admin'::public.app_role,'recording_failed','Recording Zoom Intensive perlu perhatian',coalesce(new.recording_error,'Cloud recording tidak tersedia.'),'intensive_mentoring_session',new.session_id::text,'intensive:session:'||new.session_id||':recording:'||new.recording_status);end if;
 return new;
end; $$;
drop trigger if exists intensive_mentoring_integration_notifications on public.intensive_mentoring_session_calendar_integrations;
create trigger intensive_mentoring_integration_notifications after update on public.intensive_mentoring_session_calendar_integrations for each row execute function public.notify_intensive_mentoring_integration_changes();


create or replace function public.list_admin_intensive_mentoring_calendar_sessions(p_from timestamptz,p_to timestamptz)
returns table(
 session_id uuid,enrollment_id uuid,mentee_id uuid,mentee_name text,mentee_email text,
 mentor_id uuid,mentor_name text,mentor_tier_name text,session_number integer,purchased_sessions integer,
 status text,focus_name text,scheduled_start_at timestamptz,scheduled_end_at timestamptz,mentor_timezone text,duration_minutes integer,
 meeting_url text,provider_meeting_url text,manual_meeting_url text,google_event_id text,google_ical_uid text,google_sync_status text,google_sync_error text
) language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 return query
 select s.id,g.id,g.mentee_id,nullif(btrim(concat_ws(' ',mentee.first_name,mentee.last_name)),''),coalesce(mu.email,'')::text,
 s.mentor_id,nullif(btrim(concat_ws(' ',mentor.first_name,mentor.last_name)),''),tier.name,
 s.session_number,g.baseline_sessions_per_month,s.status,f.name,s.scheduled_start_at,s.scheduled_end_at,mp.timezone,s.duration_minutes,
 coalesce(ci.manual_meeting_url,ci.provider_meeting_url),ci.provider_meeting_url,ci.manual_meeting_url,
 ci.google_event_id,ci.google_ical_uid,coalesce(ci.sync_status,'pending'),ci.sync_error
 from public.intensive_mentoring_sessions s
 join public.intensive_mentoring_engagements g on g.id=s.engagement_id
 join public.profiles mentee on mentee.id=g.mentee_id join auth.users mu on mu.id=g.mentee_id
 left join public.profiles mentor on mentor.id=s.mentor_id left join public.mentor_profiles mp on mp.user_id=s.mentor_id
 left join public.mentor_tiers tier on tier.id=mp.tier_id
 left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id
 left join public.intensive_mentoring_session_calendar_integrations ci on ci.session_id=s.id
 where s.status<>'cancelled' and s.scheduled_start_at is not null
 and (p_from is null or s.scheduled_end_at>p_from) and (p_to is null or s.scheduled_start_at<p_to)
 order by s.scheduled_start_at,s.id;
end; $$;

create or replace function public.list_my_intensive_mentoring_calendar_sessions()
returns table(
 session_id uuid,enrollment_id uuid,mentee_id uuid,mentee_name text,mentee_email text,
 mentor_id uuid,mentor_name text,mentor_tier_name text,session_number integer,purchased_sessions integer,
 status text,focus_name text,scheduled_start_at timestamptz,scheduled_end_at timestamptz,mentor_timezone text,duration_minutes integer,
 meeting_url text,provider_meeting_url text,manual_meeting_url text,google_event_id text,google_ical_uid text,google_sync_status text,google_sync_error text
) language sql stable security definer set search_path='' as $$
 select s.id,g.id,g.mentee_id,nullif(btrim(concat_ws(' ',mentee.first_name,mentee.last_name)),''),''::text,
 s.mentor_id,nullif(btrim(concat_ws(' ',mentor.first_name,mentor.last_name)),''),tier.name,
 s.session_number,g.baseline_sessions_per_month,s.status,f.name,s.scheduled_start_at,s.scheduled_end_at,mp.timezone,s.duration_minutes,
 case when s.status='scheduled' then coalesce(ci.manual_meeting_url,ci.provider_meeting_url) end,
 null::text,null::text,ci.google_event_id,ci.google_ical_uid,coalesce(ci.sync_status,'pending'),null::text
 from public.intensive_mentoring_sessions s
 join public.intensive_mentoring_engagements g on g.id=s.engagement_id
 join public.profiles mentee on mentee.id=g.mentee_id
 left join public.profiles mentor on mentor.id=s.mentor_id left join public.mentor_profiles mp on mp.user_id=s.mentor_id
 left join public.mentor_tiers tier on tier.id=mp.tier_id
 left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id
 left join public.intensive_mentoring_session_calendar_integrations ci on ci.session_id=s.id
 where g.mentee_id=auth.uid() and s.status<>'cancelled'
 order by s.scheduled_start_at nulls last,s.session_number;
$$;

revoke all on function public.list_admin_intensive_mentoring_calendar_sessions(timestamptz,timestamptz),public.list_my_intensive_mentoring_calendar_sessions() from public,anon;
grant execute on function public.list_admin_intensive_mentoring_calendar_sessions(timestamptz,timestamptz),public.list_my_intensive_mentoring_calendar_sessions() to authenticated,service_role;


-- Stakeholder approval on 2026-09-21 supersedes the former inactive guarantee guard.
-- Keep reruns convergent by removing any guard objects left by a partial earlier execution.
drop trigger if exists intensive_legal_blocked_add_on_guard on public.intensive_mentoring_add_ons;
drop trigger if exists intensive_legal_blocked_bundle_guard on public.intensive_mentoring_bundles;
drop function if exists public.guard_intensive_legal_blocked_add_on();
drop function if exists public.guard_intensive_legal_blocked_bundle();

