-- 2026-09-18 forward-only operational hardening.
-- Keeps historical order snapshots and Google Meet identities unchanged.

alter table public.profiles add column if not exists calendar_color text;
update public.profiles p
set calendar_color=(array['#B42318','#B54708','#027A48','#175CD3','#6941C6','#C11574','#026AA2','#344054'])[
  1+mod((hashtextextended(p.id::text,0) & 2147483647),8)::int
]
where calendar_color is null;
alter table public.profiles alter column calendar_color set not null;

create or replace function public.assign_profile_calendar_color()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.calendar_color is null then
   new.calendar_color:=(array['#B42318','#B54708','#027A48','#175CD3','#6941C6','#C11574','#026AA2','#344054'])[1+mod((hashtextextended(new.id::text,0) & 2147483647),8)::int];
 end if;
 return new;
end; $$;
drop trigger if exists profiles_assign_calendar_color on public.profiles;
create trigger profiles_assign_calendar_color before insert on public.profiles for each row execute function public.assign_profile_calendar_color();

alter table public.private_mentoring_enrollments add column if not exists competition_name text;
alter table public.private_mentoring_enrollments add column if not exists competition_updated_at timestamptz;

create or replace function public.set_private_mentoring_competition(p_enrollment_id uuid,p_competition_category_id uuid default null,p_competition_name text default null)
returns public.private_mentoring_enrollments language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=public.current_completed_mentee_id();v_name text:=nullif(btrim(coalesce(p_competition_name,'')),'');v_row public.private_mentoring_enrollments;
begin
 if v_name is null or char_length(v_name)<2 or char_length(v_name)>300 then raise exception 'Competition / bidang lomba wajib diisi (2-300 karakter)' using errcode='22023'; end if;
 if p_competition_category_id is not null and not exists(select 1 from public.competition_categories c where c.id=p_competition_category_id and c.is_active) then raise exception 'Competition category is not active' using errcode='22023'; end if;
 update public.private_mentoring_enrollments set competition_category_id=p_competition_category_id,competition_name=v_name,competition_updated_at=now()
 where id=p_enrollment_id and mentee_id=v_uid returning * into v_row;
 if not found then raise exception 'Private Mentoring enrollment not found' using errcode='42501'; end if;
 return v_row;
end; $$;

create or replace function public.admin_set_private_mentoring_competition(p_enrollment_id uuid,p_competition_category_id uuid default null,p_competition_name text default null)
returns public.private_mentoring_enrollments language plpgsql security definer set search_path='' as $$
declare v_name text:=nullif(btrim(coalesce(p_competition_name,'')),'');v_row public.private_mentoring_enrollments;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 if v_name is null or char_length(v_name)<2 or char_length(v_name)>300 then raise exception 'Competition / bidang lomba wajib diisi (2-300 karakter)' using errcode='22023'; end if;
 if p_competition_category_id is not null and not exists(select 1 from public.competition_categories c where c.id=p_competition_category_id and c.is_active) then raise exception 'Competition category is not active' using errcode='22023'; end if;
 update public.private_mentoring_enrollments set competition_category_id=p_competition_category_id,competition_name=v_name,competition_updated_at=now() where id=p_enrollment_id returning * into v_row;
 if not found then raise exception 'Private Mentoring enrollment not found' using errcode='22023'; end if;
 return v_row;
end; $$;

create or replace function public.list_my_private_mentoring_competitions()
returns table(enrollment_id uuid,competition_category_id uuid,competition_category_name text,competition_name text,competition_updated_at timestamptz)
language sql stable security definer set search_path='' as $$
 select e.id,e.competition_category_id,c.name::text,e.competition_name,e.competition_updated_at
 from public.private_mentoring_enrollments e left join public.competition_categories c on c.id=e.competition_category_id
 where e.mentee_id=auth.uid() order by e.created_at desc;
$$;

create or replace function public.get_admin_private_mentoring_competition(p_enrollment_id uuid)
returns table(enrollment_id uuid,competition_category_id uuid,competition_category_name text,competition_name text,competition_updated_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 return query select e.id,e.competition_category_id,c.name::text,e.competition_name,e.competition_updated_at
 from public.private_mentoring_enrollments e left join public.competition_categories c on c.id=e.competition_category_id where e.id=p_enrollment_id;
end; $$;

create or replace function public.require_private_mentoring_competition_before_schedule()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='scheduled' and old.status not in ('scheduled','completed') and not exists(
   select 1 from public.private_mentoring_enrollments e where e.id=new.enrollment_id and nullif(btrim(coalesce(e.competition_name,'')),'') is not null
 ) then raise exception 'Competition / bidang lomba wajib dilengkapi sebelum scheduling' using errcode='22023'; end if;
 return new;
end; $$;
drop trigger if exists private_mentoring_competition_schedule_guard on public.private_mentoring_sessions;
create trigger private_mentoring_competition_schedule_guard before update of status on public.private_mentoring_sessions
for each row execute function public.require_private_mentoring_competition_before_schedule();

create table if not exists public.private_mentoring_session_status_events(
 id uuid primary key default gen_random_uuid(),session_id uuid not null references public.private_mentoring_sessions(id) on delete cascade,
 from_status text not null,to_status text not null,actor_id uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
alter table public.private_mentoring_session_status_events enable row level security;
revoke all on public.private_mentoring_session_status_events from public,anon,authenticated;
grant all on public.private_mentoring_session_status_events to service_role;
create policy private_mentoring_status_events_admin_read on public.private_mentoring_session_status_events
for select to authenticated using (public.is_admin());
grant select on public.private_mentoring_session_status_events to authenticated;

create or replace function public.admin_set_private_mentoring_session_status(p_session_id uuid,p_status text)
returns public.private_mentoring_sessions language plpgsql security definer set search_path='' as $$
declare v_session public.private_mentoring_sessions;v_from text;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 if p_status not in ('completed','scheduled') then raise exception 'Unsupported status transition' using errcode='22023'; end if;
 select * into v_session from public.private_mentoring_sessions where id=p_session_id for update;
 if not found then raise exception 'Private Mentoring session not found' using errcode='22023'; end if;
 if v_session.status=p_status then return v_session; end if;
 if not ((v_session.status='scheduled' and p_status='completed') or (v_session.status='completed' and p_status='scheduled')) then raise exception 'Only scheduled -> completed or completed -> scheduled is allowed' using errcode='22023'; end if;
 if p_status='completed' and v_session.topic_status<>'confirmed' then raise exception 'Resolve the session topic before completion' using errcode='22023'; end if;
 v_from:=v_session.status::text;
 update public.private_mentoring_sessions set status=p_status where id=p_session_id returning * into v_session;
 insert into public.private_mentoring_session_status_events(session_id,from_status,to_status,actor_id) values(p_session_id,v_from,p_status,auth.uid());
 if p_status='scheduled' then update public.private_mentoring_enrollments set status='active' where id=v_session.enrollment_id;
 elsif not exists(select 1 from public.private_mentoring_sessions s where s.enrollment_id=v_session.enrollment_id and s.status not in ('completed','cancelled')) then update public.private_mentoring_enrollments set status='completed' where id=v_session.enrollment_id;
 else update public.private_mentoring_enrollments set status='active' where id=v_session.enrollment_id; end if;
 return v_session;
end; $$;

create table if not exists public.notifications(
 id uuid primary key default gen_random_uuid(),recipient_user_id uuid references public.profiles(id) on delete cascade,recipient_role public.app_role not null,
 type text not null,title text not null,message text not null,related_entity text,related_entity_id text,idempotency_key text not null,read_at timestamptz,created_at timestamptz not null default now()
);
create unique index if not exists notifications_dedupe_idx on public.notifications(recipient_role,coalesce(recipient_user_id,'00000000-0000-0000-0000-000000000000'::uuid),idempotency_key);
create index if not exists notifications_recipient_idx on public.notifications(recipient_user_id,created_at desc);
alter table public.notifications enable row level security;
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications for select to authenticated using(
 (recipient_user_id=auth.uid() and recipient_role=(select p.role from public.profiles p where p.id=auth.uid()))
 or (recipient_role='admin'::public.app_role and public.is_admin())
);
revoke all on public.notifications from public,anon,authenticated;
grant select on public.notifications to authenticated;
grant all on public.notifications to service_role;

create or replace function public.emit_notification(p_recipient_user_id uuid,p_recipient_role public.app_role,p_type text,p_title text,p_message text,p_related_entity text,p_related_entity_id text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 insert into public.notifications(recipient_user_id,recipient_role,type,title,message,related_entity,related_entity_id,idempotency_key)
 values(p_recipient_user_id,p_recipient_role,p_type,p_title,p_message,p_related_entity,p_related_entity_id,p_idempotency_key)
 on conflict do nothing returning id into v_id;
 if v_id is null then select n.id into v_id from public.notifications n where n.recipient_role=p_recipient_role and coalesce(n.recipient_user_id,'00000000-0000-0000-0000-000000000000'::uuid)=coalesce(p_recipient_user_id,'00000000-0000-0000-0000-000000000000'::uuid) and n.idempotency_key=p_idempotency_key limit 1; end if;
 return v_id;
end; $$;
revoke all on function public.emit_notification(uuid,public.app_role,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.emit_notification(uuid,public.app_role,text,text,text,text,text,text) to service_role;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin update public.notifications n set read_at=coalesce(n.read_at,now()) where n.id=p_notification_id and ((n.recipient_user_id=auth.uid() and n.recipient_role=(select p.role from public.profiles p where p.id=auth.uid())) or (n.recipient_role='admin'::public.app_role and public.is_admin())); end; $$;
create or replace function public.mark_all_notifications_read()
returns void language plpgsql security definer set search_path='' as $$
begin update public.notifications n set read_at=coalesce(n.read_at,now()) where n.read_at is null and ((n.recipient_user_id=auth.uid() and n.recipient_role=(select p.role from public.profiles p where p.id=auth.uid())) or (n.recipient_role='admin'::public.app_role and public.is_admin())); end; $$;

do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications')
 then execute 'alter publication supabase_realtime add table public.notifications'; end if;
end $$;

create or replace function public.notify_order_operational_changes()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then perform public.emit_notification(null,'admin','order_pending','Checkout baru','Ada order baru yang menunggu pembayaran.','order',new.id::text,'order:'||new.id||':pending');
 elsif old.status is distinct from new.status and new.status='paid' then
  perform public.emit_notification(null,'admin','payment_paid','Pembayaran berhasil','Order sudah terverifikasi lunas dan fulfillment dijalankan.','order',new.id::text,'order:'||new.id||':paid:admin');
  perform public.emit_notification(new.user_id,'mentee','payment_paid','Pembayaran berhasil','Produk atau mentoring yang dibeli sudah tersedia di dashboard.','order',new.id::text,'order:'||new.id||':paid:mentee');
 end if; return new;
end; $$;
drop trigger if exists orders_operational_notifications on public.orders;
create trigger orders_operational_notifications after insert or update of status on public.orders for each row execute function public.notify_order_operational_changes();

alter table public.private_mentoring_session_calendar_integrations add column if not exists meeting_provider text;
alter table public.private_mentoring_session_calendar_integrations add column if not exists provider_meeting_id text;
alter table public.private_mentoring_session_calendar_integrations add column if not exists provider_host_id text;
alter table public.private_mentoring_session_calendar_integrations add column if not exists provider_sync_status text not null default 'pending';
alter table public.private_mentoring_session_calendar_integrations add column if not exists provider_sync_error text;
alter table public.private_mentoring_session_calendar_integrations add column if not exists provider_sync_started_at timestamptz;
alter table public.private_mentoring_session_calendar_integrations add column if not exists recording_status text not null default 'expected';
alter table public.private_mentoring_session_calendar_integrations add column if not exists recording_error text;
alter table public.private_mentoring_session_calendar_integrations add column if not exists recording_metadata jsonb;
alter table public.private_mentoring_session_calendar_integrations add column if not exists recording_available_at timestamptz;
alter table public.private_mentoring_session_calendar_integrations
  add constraint private_mentoring_meeting_provider_check check (meeting_provider is null or meeting_provider in ('zoom','google_meet','manual'));
alter table public.private_mentoring_session_calendar_integrations
  add constraint private_mentoring_provider_sync_status_check check (provider_sync_status in ('pending','creating','ready','failed','cancelled'));
alter table public.private_mentoring_session_calendar_integrations
  add constraint private_mentoring_recording_status_check check (recording_status in ('expected','processing','available','failed','unavailable','not_applicable'));
update public.private_mentoring_session_calendar_integrations
set meeting_provider=case
  when provider_meeting_url ilike '%meet.google.com/%' then 'google_meet'
  when provider_meeting_url ilike '%zoom.%/%' then 'zoom'
  when coalesce(provider_meeting_url,manual_meeting_url) is not null then 'manual'
  else null
end
where meeting_provider is null;
update public.private_mentoring_session_calendar_integrations
set provider_sync_status='ready'
where provider_meeting_url is not null and provider_sync_status='pending';
update public.private_mentoring_session_calendar_integrations
set recording_status='not_applicable'
where meeting_provider in ('google_meet','manual');

create table if not exists public.zoom_webhook_events(event_key text primary key,event_type text not null,provider_meeting_id text,received_at timestamptz not null default now());
revoke all on public.zoom_webhook_events from public,anon,authenticated;grant all on public.zoom_webhook_events to service_role;

create or replace function public.service_get_zoom_meeting_context(p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 select jsonb_build_object('sessionId',s.id,'status',s.status,'start',s.scheduled_start_at,'end',s.scheduled_end_at,'sessionNumber',s.session_number,'purchasedSessions',e.purchased_sessions,'topic',coalesce(s.resolved_topic,f.name,'Mentoring Session'),'mentorId',s.mentor_id,'menteeId',e.mentee_id,'meetingProvider',ci.meeting_provider,'providerMeetingId',ci.provider_meeting_id,'providerMeetingUrl',ci.provider_meeting_url,'providerSyncStatus',ci.provider_sync_status)
 into v_result from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id left join public.private_mentoring_session_calendar_integrations ci on ci.session_id=s.id where s.id=p_session_id;
 if v_result is null then raise exception 'Private Mentoring session not found' using errcode='22023'; end if; return v_result;
end; $$;

create or replace function public.service_claim_zoom_meeting_creation(p_session_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_row public.private_mentoring_session_calendar_integrations;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 insert into public.private_mentoring_session_calendar_integrations(session_id,meeting_provider,provider_sync_status,sync_status) values(p_session_id,'zoom','pending','pending') on conflict(session_id) do nothing;
 select * into v_row from public.private_mentoring_session_calendar_integrations where session_id=p_session_id for update;
 if v_row.meeting_provider in ('google_meet','manual') then return 'legacy'; end if;
 if v_row.provider_meeting_id is not null then update public.private_mentoring_session_calendar_integrations set meeting_provider='zoom',provider_sync_status='pending',provider_sync_error=null where session_id=p_session_id;return 'update';end if;
 if v_row.provider_sync_status='creating' and v_row.provider_sync_started_at>now()-interval '5 minutes' then return 'wait';end if;
 update public.private_mentoring_session_calendar_integrations set meeting_provider='zoom',provider_sync_status='creating',provider_sync_error=null,provider_sync_started_at=now() where session_id=p_session_id;return 'create';
end; $$;

create or replace function public.service_store_zoom_meeting(p_session_id uuid,p_meeting_id text,p_join_url text,p_host_id text,p_recording_status text,p_recording_error text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 update public.private_mentoring_session_calendar_integrations set meeting_provider='zoom',provider_meeting_id=p_meeting_id,provider_meeting_url=p_join_url,provider_host_id=p_host_id,provider_sync_status='ready',provider_sync_error=null,recording_status=p_recording_status,recording_error=p_recording_error where session_id=p_session_id;
end; $$;
create or replace function public.service_mark_zoom_sync(p_session_id uuid,p_status text,p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
begin if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501';end if;update public.private_mentoring_session_calendar_integrations set provider_sync_status=p_status,provider_sync_error=p_error where session_id=p_session_id;end; $$;

revoke all on function public.service_get_zoom_meeting_context(uuid),public.service_claim_zoom_meeting_creation(uuid),public.service_store_zoom_meeting(uuid,text,text,text,text,text),public.service_mark_zoom_sync(uuid,text,text) from public,anon,authenticated;
grant execute on function public.service_get_zoom_meeting_context(uuid),public.service_claim_zoom_meeting_creation(uuid),public.service_store_zoom_meeting(uuid,text,text,text,text,text),public.service_mark_zoom_sync(uuid,text,text) to service_role;

-- Optional Cart Link prefill for Private Mentoring; never part of immutable order snapshots.
alter table public.commerce_cart_links add column if not exists private_competition_category_id uuid references public.competition_categories(id);
alter table public.commerce_cart_links add column if not exists private_competition_name text;

create or replace function public.create_commerce_cart_link_with_context(
 p_mentee_id uuid,p_token_hash text,p_commerce_item_ids uuid[],
 p_competition_category_id uuid default null,p_competition_name text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_link_id uuid;v_name text:=nullif(btrim(coalesce(p_competition_name,'')),'');
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 if p_competition_category_id is not null and not exists(select 1 from public.competition_categories c where c.id=p_competition_category_id and c.is_active) then raise exception 'Active competition category required' using errcode='22023';end if;
 if v_name is not null and (char_length(v_name)<2 or char_length(v_name)>300) then raise exception 'Competition / bidang lomba must be 2-300 characters' using errcode='22023';end if;
 if (p_competition_category_id is not null or v_name is not null) and not exists(select 1 from public.commerce_items ci where ci.id=any(p_commerce_item_ids) and ci.item_kind='private_mentoring') then raise exception 'Competition prefill only applies to Private Mentoring items' using errcode='22023';end if;
 v_link_id:=public.create_commerce_cart_link(p_mentee_id,p_token_hash,p_commerce_item_ids);
 update public.commerce_cart_links set private_competition_category_id=p_competition_category_id,private_competition_name=v_name where id=v_link_id;
 return v_link_id;
end; $$;

create or replace function public.fulfill_paid_private_mentoring_order(p_order_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
 v_order public.orders;v_item public.order_items;v_package public.private_mentoring_packages;v_enrollment_id uuid;
 v_competition_category_id uuid;v_competition_name text;
begin
 select * into v_order from public.orders where id=p_order_id;
 if not found or v_order.status<>'paid' then return;end if;
 for v_item in select * from public.order_items where order_id=p_order_id and item_kind_snapshot='private_mentoring' loop
  select * into v_package from public.private_mentoring_packages where id=v_item.commerce_item_id;
  if not found then raise exception 'Paid Private Mentoring package is missing' using errcode='23503';end if;
  v_competition_category_id:=null;v_competition_name:=null;
  select l.private_competition_category_id,l.private_competition_name into v_competition_category_id,v_competition_name
  from public.commerce_cart_links l join public.commerce_cart_link_items li on li.cart_link_id=l.id and li.commerce_item_id=v_item.commerce_item_id
  where l.claimed_cart_id=v_order.cart_id and (l.private_competition_category_id is not null or l.private_competition_name is not null)
  order by l.claimed_at desc nulls last,l.created_at desc limit 1;
  insert into public.private_mentoring_enrollments(mentee_id,order_item_id,package_id,purchased_sessions,competition_category_id,competition_name,competition_updated_at)
  values(v_order.user_id,v_item.id,v_package.id,v_package.session_count,v_competition_category_id,v_competition_name,case when v_competition_category_id is not null or v_competition_name is not null then now() else null end)
  on conflict(order_item_id) do nothing;
  select id into strict v_enrollment_id from public.private_mentoring_enrollments where order_item_id=v_item.id;
  insert into public.private_mentoring_sessions(enrollment_id,session_number)
  select v_enrollment_id,n from generate_series(1,v_package.session_count)n on conflict(enrollment_id,session_number) do nothing;
 end loop;
end; $$;

revoke all on function public.create_commerce_cart_link_with_context(uuid,text,uuid[],uuid,text) from public,anon;
grant execute on function public.create_commerce_cart_link_with_context(uuid,text,uuid[],uuid,text) to authenticated,service_role;

create or replace function public.guard_owned_digital_product_cart_link_item()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_mentee uuid;v_kind text;
begin
 select cl.mentee_id into v_mentee from public.commerce_cart_links cl where cl.id=new.cart_link_id;
 select ci.item_kind into v_kind from public.commerce_items ci where ci.id=new.commerce_item_id;
 if v_kind='digital_product' and exists(select 1 from public.order_items oi join public.orders o on o.id=oi.order_id where o.user_id=v_mentee and o.status='paid' and oi.commerce_item_id=new.commerce_item_id and oi.item_kind_snapshot='digital_product')
 then raise exception 'Digital product already owned by selected mentee' using errcode='23505';end if;
 return new;
end; $$;
drop trigger if exists cart_link_owned_digital_product_guard on public.commerce_cart_link_items;
create trigger cart_link_owned_digital_product_guard before insert on public.commerce_cart_link_items for each row execute function public.guard_owned_digital_product_cart_link_item();

create or replace function public.claim_commerce_cart_link(p_token_hash text)
returns uuid
language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid:=public.current_completed_mentee_id();
  v_link public.commerce_cart_links;
  v_cart public.carts;
  v_item record;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid Cart Link' using errcode='22023'; end if;
  select * into v_link from public.commerce_cart_links where token_hash=p_token_hash for update;
  if not found or v_link.status='revoked' then raise exception 'Cart Link is invalid or unavailable' using errcode='22023'; end if;
  if v_link.mentee_id is distinct from v_uid then raise exception 'Cart Link belongs to another mentee' using errcode='42501'; end if;
  if v_link.status='claimed' then return v_link.claimed_cart_id; end if;

  for v_item in
    select li.commerce_item_id,ci.item_kind,r.is_available,r.price_amount
    from public.commerce_cart_link_items li
    join public.commerce_items ci on ci.id=li.commerce_item_id
    left join lateral public.resolve_commerce_item(li.commerce_item_id) r on true
    where li.cart_link_id=v_link.id
  loop
    if v_item.is_available is distinct from true or v_item.price_amount is null then
      raise exception 'Cart Link contains an unavailable item' using errcode='22023';
    end if;
    if v_item.item_kind='digital_product' and exists(
      select 1 from public.order_items oi join public.orders o on o.id=oi.order_id
      where o.user_id=v_uid and o.status='paid' and oi.commerce_item_id=v_item.commerce_item_id and oi.item_kind_snapshot='digital_product'
    ) then raise exception 'Cart Link contains a digital product already owned by this mentee' using errcode='23505'; end if;
  end loop;

  v_cart:=public.get_or_create_active_cart();
  insert into public.cart_items(cart_id,commerce_item_id)
  select v_cart.id,li.commerce_item_id from public.commerce_cart_link_items li where li.cart_link_id=v_link.id
  on conflict(cart_id,commerce_item_id) do nothing;

  update public.commerce_cart_links set status='claimed',claimed_cart_id=v_cart.id,claimed_at=now() where id=v_link.id;
  return v_cart.id;
end;
$$;

create or replace function public.list_admin_cart_link_items(p_mentee_id uuid,p_query text default '')
returns table(commerce_item_id uuid,item_kind text,name text,slug text,price_amount bigint,description text,image_path text,owned_by_mentee boolean,family_label text,session_count integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then return;end if;
 return query
 select ci.id,ci.item_kind,
 case when ci.item_kind='digital_product' then dp.name when ci.item_kind='private_mentoring' then tier.name||' · '||pm.session_count||' sesi' when ci.item_kind='intensive_mentoring_package' then ip.name when ci.item_kind='intensive_mentoring_bundle' then ib.name when ci.item_kind='intensive_mentoring_add_on' then ia.name else ci.item_kind end::text,
 coalesce(dp.slug,ip.slug,ib.slug,ia.slug,('private-'||pm.id::text))::text,
 coalesce(dp.price_amount,pm.price_amount,ip.price_amount,ib.price_amount,ia.price_amount)::bigint,
 coalesce(dp.description,ip.description,ib.description,ia.description)::text,dp.image_path::text,
 (ci.item_kind='digital_product' and exists(select 1 from public.order_items oi join public.orders o on o.id=oi.order_id where o.user_id=p_mentee_id and o.status='paid' and oi.commerce_item_id=ci.id and oi.item_kind_snapshot='digital_product')),
 case when ci.item_kind='private_mentoring' then tier.name when ci.item_kind like 'intensive_mentoring_%' then 'Intensive Mentoring' when ci.item_kind='digital_product' then 'Produk Digital' else 'Lainnya' end::text,pm.session_count
 from public.commerce_items ci
 left join public.digital_products dp on dp.id=ci.id and ci.item_kind='digital_product'
 left join public.private_mentoring_packages pm on pm.id=ci.id and ci.item_kind='private_mentoring'
 left join public.mentor_tiers tier on tier.id=pm.mentor_tier_id
 left join public.intensive_mentoring_packages ip on ip.id=ci.id and ci.item_kind='intensive_mentoring_package'
 left join public.intensive_mentoring_bundles ib on ib.id=ci.id and ci.item_kind='intensive_mentoring_bundle'
 left join public.intensive_mentoring_add_ons ia on ia.id=ci.id and ci.item_kind='intensive_mentoring_add_on'
 where ci.is_available and (coalesce(p_query,'')='' or lower(coalesce(dp.name,tier.name,ip.name,ib.name,ia.name,'')) like '%'||lower(p_query)||'%')
 order by 2,9,10 nulls last,3;
end; $$;

create or replace function public.get_calendar_person_color(p_user_id uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare v_color text;
begin
 if p_user_id<>auth.uid() and not public.is_admin() and not exists(select 1 from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where s.mentor_id=auth.uid() and e.mentee_id=p_user_id) then raise exception 'Forbidden' using errcode='42501';end if;
 select calendar_color into v_color from public.profiles where id=p_user_id;return v_color;
end; $$;

create or replace function public.notify_private_mentoring_competition_changes()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_actor_role public.app_role; v_key text;
begin
 if old.competition_name is not distinct from new.competition_name and old.competition_category_id is not distinct from new.competition_category_id then return new; end if;
 select p.role into v_actor_role from public.profiles p where p.id=auth.uid();
 v_key:='enrollment:'||new.id||':competition:'||md5(coalesce(new.competition_name,'')||':'||coalesce(new.competition_category_id::text,''));
 if v_actor_role='mentee'::public.app_role then
   perform public.emit_notification(null,'admin','competition_updated','Competition mentoring diperbarui','Mentee melengkapi atau mengubah competition / bidang lomba Private Mentoring.','enrollment',new.id::text,v_key||':admin');
 elsif v_actor_role='admin'::public.app_role then
   perform public.emit_notification(new.mentee_id,'mentee','competition_reviewed','Competition mentoring diperbarui admin','Admin sudah memperbarui competition / bidang lomba untuk enrollment Private Mentoring Anda.','enrollment',new.id::text,v_key||':mentee');
 end if;
 return new;
end; $$;
drop trigger if exists private_mentoring_competition_notifications on public.private_mentoring_enrollments;
create trigger private_mentoring_competition_notifications after update of competition_name,competition_category_id on public.private_mentoring_enrollments
for each row execute function public.notify_private_mentoring_competition_changes();

create or replace function public.notify_private_mentoring_session_changes()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_mentee uuid;v_mentor uuid;v_key text;
begin
 select e.mentee_id into v_mentee from public.private_mentoring_enrollments e where e.id=new.enrollment_id;v_mentor:=new.mentor_id;
 if old.mentor_id is distinct from new.mentor_id and new.mentor_id is not null then
  perform public.emit_notification(new.mentor_id,'mentor','mentor_assigned','Sesi mentoring ditugaskan','Anda ditugaskan ke sesi mentoring baru.','session',new.id::text,'session:'||new.id||':mentor:'||new.mentor_id);
  perform public.emit_notification(v_mentee,'mentee','mentor_assigned','Mentor sudah ditetapkan','Mentor untuk sesi mentoring Anda sudah ditetapkan.','session',new.id::text,'session:'||new.id||':mentor-mentee:'||new.mentor_id);
 end if;
 if new.topic_status='pending_review' and old.topic_status is distinct from new.topic_status then perform public.emit_notification(null,'admin','mentoring_attention','Topik mentoring perlu direview','Mentee mengirim atau mengubah topik/scope sesi Private Mentoring.','session',new.id::text,'session:'||new.id||':topic:'||coalesce(new.topic_updated_at::text,now()::text));end if;
 if new.topic_status='confirmed' and old.topic_status is distinct from new.topic_status then
  perform public.emit_notification(v_mentee,'mentee','topic_reviewed','Topik mentoring sudah direview','Admin sudah mengonfirmasi topic / scope final sesi mentoring Anda.','session',new.id::text,'session:'||new.id||':topic-confirmed:'||coalesce(new.topic_updated_at::text,now()::text));
  if v_mentor is not null then perform public.emit_notification(v_mentor,'mentor','scope_updated','Scope mentoring diperbarui','Topic / scope final sesi mentoring yang ditugaskan kepada Anda sudah diperbarui.','session',new.id::text,'session:'||new.id||':scope:'||coalesce(new.topic_updated_at::text,now()::text));end if;
 end if;
 if new.status='scheduled' and (old.status is distinct from 'scheduled' or old.scheduled_start_at is distinct from new.scheduled_start_at) then
  v_key:='session:'||new.id||':schedule:'||coalesce(new.scheduled_start_at::text,'');
  if v_mentor is not null then perform public.emit_notification(v_mentor,'mentor','session_scheduled','Jadwal mentoring diperbarui','Jadwal sesi mentoring tersedia atau berubah.','session',new.id::text,v_key||':mentor');end if;
  perform public.emit_notification(v_mentee,'mentee','session_scheduled','Jadwal mentoring diperbarui','Jadwal sesi mentoring tersedia atau berubah.','session',new.id::text,v_key||':mentee');
 end if;
 if new.status='cancelled' and old.status is distinct from 'cancelled' then
  if v_mentor is not null then perform public.emit_notification(v_mentor,'mentor','session_cancelled','Sesi mentoring dibatalkan','Sesi mentoring telah dibatalkan.','session',new.id::text,'session:'||new.id||':cancelled:mentor');end if;
  perform public.emit_notification(v_mentee,'mentee','session_cancelled','Sesi mentoring dibatalkan','Sesi mentoring telah dibatalkan.','session',new.id::text,'session:'||new.id||':cancelled:mentee');
 end if;return new;
end; $$;
drop trigger if exists private_mentoring_session_notifications on public.private_mentoring_sessions;
create trigger private_mentoring_session_notifications after update on public.private_mentoring_sessions for each row execute function public.notify_private_mentoring_session_changes();

create or replace function public.notify_private_mentoring_integration_changes()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_mentee uuid;v_mentor uuid;v_effective text;v_old_effective text;
begin
 select e.mentee_id,s.mentor_id into v_mentee,v_mentor from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where s.id=new.session_id;
 v_effective:=coalesce(new.manual_meeting_url,new.provider_meeting_url);v_old_effective:=coalesce(old.manual_meeting_url,old.provider_meeting_url);
 if v_effective is distinct from v_old_effective and v_effective is not null then
  if v_mentor is not null then perform public.emit_notification(v_mentor,'mentor','meeting_url_changed','Meeting link tersedia','Meeting link sesi mentoring tersedia atau berubah.','session',new.session_id::text,'session:'||new.session_id||':meeting:'||md5(v_effective)||':mentor');end if;
  perform public.emit_notification(v_mentee,'mentee','meeting_url_changed','Meeting link tersedia','Meeting link sesi mentoring tersedia atau berubah.','session',new.session_id::text,'session:'||new.session_id||':meeting:'||md5(v_effective)||':mentee');
 end if;
 if new.provider_sync_status='failed' and old.provider_sync_status is distinct from 'failed' then perform public.emit_notification(null,'admin','zoom_failed','Zoom sync gagal',coalesce(new.provider_sync_error,'Zoom meeting belum tersinkron.'),'session',new.session_id::text,'session:'||new.session_id||':zoom-failed:'||md5(coalesce(new.provider_sync_error,'')));end if;
 if new.sync_status='failed' and old.sync_status is distinct from 'failed' then perform public.emit_notification(null,'admin','calendar_failed','Google Calendar sync gagal',coalesce(new.sync_error,'Google Calendar belum tersinkron.'),'session',new.session_id::text,'session:'||new.session_id||':calendar-failed:'||md5(coalesce(new.sync_error,'')));end if;
 if new.recording_status in ('failed','unavailable') and old.recording_status is distinct from new.recording_status then perform public.emit_notification(null,'admin','recording_failed','Recording Zoom perlu perhatian',coalesce(new.recording_error,'Cloud recording tidak tersedia.'),'session',new.session_id::text,'session:'||new.session_id||':recording:'||new.recording_status);end if;
 return new;
end; $$;
drop trigger if exists private_mentoring_integration_notifications on public.private_mentoring_session_calendar_integrations;
create trigger private_mentoring_integration_notifications after update on public.private_mentoring_session_calendar_integrations for each row execute function public.notify_private_mentoring_integration_changes();

revoke all on function public.set_private_mentoring_competition(uuid,uuid,text),public.admin_set_private_mentoring_competition(uuid,uuid,text),public.list_my_private_mentoring_competitions(),public.get_admin_private_mentoring_competition(uuid),public.mark_notification_read(uuid),public.mark_all_notifications_read(),public.list_admin_cart_link_items(uuid,text),public.get_calendar_person_color(uuid) from public,anon;
grant execute on function public.set_private_mentoring_competition(uuid,uuid,text),public.admin_set_private_mentoring_competition(uuid,uuid,text),public.list_my_private_mentoring_competitions(),public.get_admin_private_mentoring_competition(uuid),public.mark_notification_read(uuid),public.mark_all_notifications_read(),public.list_admin_cart_link_items(uuid,text),public.get_calendar_person_color(uuid) to authenticated;
grant execute on function public.get_calendar_person_color(uuid) to service_role;

comment on table public.notifications is 'Realtime role-isolated operational notifications; authenticated clients cannot insert arbitrary notifications.';
comment on column public.private_mentoring_enrollments.competition_name is 'Enrollment-wide competition/bidang lomba; distinct from per-session topic/scope.';
