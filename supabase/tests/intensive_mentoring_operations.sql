begin;

do $test$
declare v_default text;v_constraint text;
begin
 if to_regclass('public.intensive_mentoring_engagements') is null then raise exception 'intensive engagements table missing';end if;
 if to_regclass('public.intensive_mentoring_sessions') is null then raise exception 'intensive sessions table missing';end if;
 if to_regclass('public.intensive_mentoring_session_calendar_integrations') is null then raise exception 'intensive calendar integration table missing';end if;
 if to_regprocedure('public.admin_add_intensive_mentoring_session(uuid,integer,text)') is null then raise exception 'admin add session RPC missing';end if;
 if to_regprocedure('public.list_my_mentor_intensive_mentoring_sessions()') is null then raise exception 'mentor projection missing';end if;
 if to_regprocedure('public.list_admin_intensive_mentoring_calendar_sessions(timestamptz,timestamptz)') is null then raise exception 'admin calendar projection missing';end if;

 select column_default into v_default from information_schema.columns where table_schema='public' and table_name='intensive_mentoring_sessions' and column_name='topic_status';
 if v_default is null or v_default not like '%needs_input%' then raise exception 'topic_status default must be needs_input, got %',v_default;end if;

 if not exists(select 1 from public.intensive_mentoring_packages where code='INTENSIVE' and sessions_per_month=4 and price_amount=1150000 and reference_price_amount=1400000 and is_active) then raise exception 'INTENSIVE source values drifted';end if;
 if not exists(select 1 from public.intensive_mentoring_packages where code='SUPER_INTENSIVE' and sessions_per_month=8 and price_amount=2200000 and reference_price_amount=2800000 and is_active) then raise exception 'SUPER_INTENSIVE source values drifted';end if;
 if not exists(select 1 from public.intensive_mentoring_packages where code='INTERNATIONAL_COMPETITION' and pricing_mode='consultation' and price_amount is null and reference_price_amount is null and is_active) then raise exception 'international consultation package drifted';end if;
 if not exists(select 1 from public.intensive_mentoring_add_ons where code='WIN_GUARANTEE_PROTECTION' and price_amount=500000 and is_active) then raise exception 'Win Guarantee must be active at Rp500.000';end if;
 if not exists(select 1 from public.intensive_mentoring_bundles where code='COMPETITION_ASSURANCE' and price_amount=3000000 and is_active) then raise exception 'Competition Assurance must be active at Rp3.000.000';end if;
 if not exists(select 1 from public.intensive_mentoring_bundles b join public.intensive_mentoring_bundle_items bi on bi.bundle_id=b.id and bi.item_type='add_on' join public.intensive_mentoring_add_ons a on a.id=bi.add_on_id where b.code='COMPETITION_ASSURANCE' and a.code='WIN_GUARANTEE_PROTECTION') then raise exception 'Competition Assurance must retain Win Guarantee dependency';end if;

 select pg_get_constraintdef(oid) into v_constraint
 from pg_constraint
 where conrelid='public.intensive_mentoring_session_calendar_integrations'::regclass
   and contype='c' and pg_get_constraintdef(oid) ilike '%meeting_provider%';
 if v_constraint is null or v_constraint ilike '%google_meet%' then raise exception 'Intensive meeting provider constraint must remain Zoom-only: %',v_constraint;end if;
end
$test$;


-- Approved guarantee commerce + International custom offer end-to-end regression.
insert into auth.users(id,email,encrypted_password) values
 ('99500000-0000-0000-0000-000000000001','intensive-admin@test.invalid','hash'),
 ('99500000-0000-0000-0000-000000000002','intensive-mentee-a@test.invalid','hash'),
 ('99500000-0000-0000-0000-000000000003','intensive-mentee-b@test.invalid','hash');
update public.profiles set role='admin' where id='99500000-0000-0000-0000-000000000001';
update public.mentee_profiles set onboarding_completed_at=now() where user_id in('99500000-0000-0000-0000-000000000002','99500000-0000-0000-0000-000000000003');

do $commerce_resolution$
declare v_win uuid;v_assurance uuid;
begin
 select id into v_win from public.intensive_mentoring_add_ons where code='WIN_GUARANTEE_PROTECTION';
 select id into v_assurance from public.intensive_mentoring_bundles where code='COMPETITION_ASSURANCE';
 if not exists(select 1 from public.resolve_commerce_item(v_win) where is_available and price_amount=500000) then raise exception 'Win Guarantee commerce item unavailable';end if;
 if not exists(select 1 from public.resolve_commerce_item(v_assurance) where is_available and price_amount=3000000) then raise exception 'Competition Assurance commerce item unavailable';end if;
end
$commerce_resolution$;

set local role authenticated;
select set_config('request.jwt.claim.sub','99500000-0000-0000-0000-000000000001',true);

do $commerce$
declare
 v_win uuid;v_assurance uuid;v_offer uuid;v_link uuid;
begin
 select id into v_win from public.intensive_mentoring_add_ons where code='WIN_GUARANTEE_PROTECTION';
 select id into v_assurance from public.intensive_mentoring_bundles where code='COMPETITION_ASSURANCE';
 if not exists(select 1 from public.list_admin_cart_link_items('99500000-0000-0000-0000-000000000002','Win Guarantee') where commerce_item_id=v_win) then raise exception 'Win Guarantee missing from Cart Link discovery';end if;
 if not exists(select 1 from public.list_admin_cart_link_items('99500000-0000-0000-0000-000000000002','Competition Assurance') where commerce_item_id=v_assurance) then raise exception 'Competition Assurance missing from Cart Link discovery';end if;

 v_offer:=public.admin_save_intensive_custom_offer(
   null,'99500000-0000-0000-0000-000000000002',null,'Harvard Global Case Competition',
   6,4750000,null,array[v_win],array['International pitch deck review','Additional mock Q&A']
 );
 if not exists(select 1 from public.list_admin_cart_link_items('99500000-0000-0000-0000-000000000002','Harvard') where commerce_item_id=v_offer) then raise exception 'Intended mentee cannot discover custom offer';end if;
 if exists(select 1 from public.list_admin_cart_link_items('99500000-0000-0000-0000-000000000003','Harvard') where commerce_item_id=v_offer) then raise exception 'Wrong mentee can discover custom offer';end if;
 v_link:=public.create_commerce_cart_link_with_context('99500000-0000-0000-0000-000000000002',repeat('a',64),array[v_offer],null,null);
 if v_link is null then raise exception 'Custom offer Cart Link not created';end if;
end
$commerce$;
reset role;

do $custom_offer_resolution$
declare v_offer uuid;
begin
 select id into v_offer from public.intensive_mentoring_custom_offers where competition_name='Harvard Global Case Competition';
 if not exists(select 1 from public.resolve_commerce_item(v_offer) where item_kind='intensive_mentoring_custom_offer' and price_amount=4750000 and is_available) then raise exception 'Custom offer resolver drifted';end if;
end
$custom_offer_resolution$;

set local role authenticated;
select set_config('request.jwt.claim.sub','99500000-0000-0000-0000-000000000003',true);
do $wrong_recipient$
declare v_offer uuid;
begin
 select id into v_offer from public.intensive_mentoring_custom_offers where competition_name='Harvard Global Case Competition';
 begin
  perform public.add_cart_item(v_offer);
  raise exception 'Wrong mentee unexpectedly added custom offer';
 exception
  when insufficient_privilege then null;
  when invalid_parameter_value then null;
 end;
 begin
  perform public.claim_commerce_cart_link(repeat('a',64));
  raise exception 'Wrong mentee unexpectedly claimed custom offer Cart Link';
 exception
  when insufficient_privilege then null;
  when invalid_parameter_value then null;
 end;
end
$wrong_recipient$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','99500000-0000-0000-0000-000000000002',true);
select public.claim_commerce_cart_link(repeat('a',64));
select public.create_order_from_cart((select id from public.carts where user_id=auth.uid() and status='active'));
do $snapshot$
declare v_offer uuid;
begin
 select id into v_offer from public.intensive_mentoring_custom_offers where competition_name='Harvard Global Case Competition';
 if not exists(select 1 from public.order_items oi join public.orders o on o.id=oi.order_id where o.user_id=auth.uid() and oi.commerce_item_id=v_offer and oi.item_kind_snapshot='intensive_mentoring_custom_offer' and oi.unit_price_amount=4750000 and oi.name_snapshot like 'International Competition%') then raise exception 'Custom offer order snapshot incorrect';end if;
 if not exists(select 1 from public.intensive_mentoring_custom_offers where id=v_offer and status='converted') then raise exception 'Custom offer must lock after conversion';end if;
end
$snapshot$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','99500000-0000-0000-0000-000000000001',true);
do $locked$
declare v_offer uuid;
begin
 select id into v_offer from public.intensive_mentoring_custom_offers where competition_name='Harvard Global Case Competition';
 begin
  perform public.admin_save_intensive_custom_offer(v_offer,'99500000-0000-0000-0000-000000000002',null,'Harvard Global Case Competition',6,9999999,null,'{}'::uuid[],'{}'::text[]);
  raise exception 'Converted offer unexpectedly editable';
 exception when check_violation then null;
 end;
end
$locked$;
reset role;

-- Database owner simulates a later source correction; immutable order snapshot must not change.
update public.intensive_mentoring_custom_offers set final_price_amount=5000000
where competition_name='Harvard Global Case Competition';
do $immutable_snapshot$
begin
 if not exists(select 1 from public.order_items where item_kind_snapshot='intensive_mentoring_custom_offer' and unit_price_amount=4750000) then raise exception 'Historical custom price snapshot mutated';end if;
end
$immutable_snapshot$;

update public.orders set status='paid',paid_at=now()
where user_id='99500000-0000-0000-0000-000000000002';

do $fulfilled$
declare v_offer uuid;v_engagement uuid;
begin
 select id into v_offer from public.intensive_mentoring_custom_offers where competition_name='Harvard Global Case Competition';
 if not exists(select 1 from public.intensive_mentoring_entitlements e where e.custom_offer_id=v_offer and e.entitlement_kind='custom_offer' and e.purchased_sessions=6) then raise exception 'Custom offer entitlement missing';end if;
 select g.id into v_engagement from public.intensive_mentoring_engagements g join public.intensive_mentoring_entitlements e on e.id=g.base_entitlement_id where e.custom_offer_id=v_offer;
 if v_engagement is null then raise exception 'Custom offer engagement missing';end if;
 if not exists(select 1 from public.intensive_mentoring_engagements where id=v_engagement and baseline_sessions_per_month=6 and competition_name='Harvard Global Case Competition') then raise exception 'Custom engagement metadata drifted';end if;
 if not (public.intensive_engagement_add_ons_json(v_engagement)::text like '%Win Guarantee Protection%' and public.intensive_engagement_add_ons_json(v_engagement)::text like '%International pitch deck review%') then raise exception 'Custom included support missing operationally';end if;
 if not exists(select 1 from public.intensive_mentoring_custom_offers where id=v_offer and status='purchased') then raise exception 'Custom offer lifecycle not purchased after payment';end if;
end
$fulfilled$;

-- Policy convergence: every intended owner/admin/mentor policy exists exactly once after bootstrap/repair.
do $policies$
declare v_count integer;
begin
 select count(*) into v_count from pg_policies where schemaname='public' and policyname in(
 'intensive_engagement_owner_read','intensive_engagement_admin_read','intensive_engagement_mentor_read',
 'intensive_sessions_owner_read','intensive_sessions_admin_read','intensive_sessions_mentor_read',
 'intensive_session_events_owner_read','intensive_session_events_admin_read','intensive_session_events_mentor_read',
 'intensive_engagement_events_owner_read','intensive_engagement_events_admin_read','intensive_engagement_events_mentor_read');
 if v_count<>12 then raise exception 'Expected 12 normalized Intensive policies, got %',v_count;end if;
end
$policies$;

rollback;
