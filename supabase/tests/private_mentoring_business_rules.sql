-- Disposable database only. Supersedes the original Phase 3 focus-auto-approval contract.
begin;

create schema test_private_mentoring_rules;
create function test_private_mentoring_rules.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;
create function test_private_mentoring_rules.denied(command text, message text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when insufficient_privilege or check_violation or unique_violation or foreign_key_violation or invalid_parameter_value or exclusion_violation or raise_exception then return;
  end;
  raise exception 'UNEXPECTEDLY ALLOWED: %', message;
end;
$$;
grant usage on schema test_private_mentoring_rules to anon, authenticated, service_role;
grant execute on all functions in schema test_private_mentoring_rules to anon, authenticated, service_role;

select test_private_mentoring_rules.assert(to_regclass('public.private_mentoring_session_topic_events') is not null, 'topic audit table exists');
select test_private_mentoring_rules.assert(to_regclass('public.private_mentoring_primary_mentor_changes') is not null, 'primary mentor audit table exists');
select test_private_mentoring_rules.assert(to_regclass('public.intensive_mentoring_entitlements') is not null, 'Intensive entitlement table exists');
select test_private_mentoring_rules.assert(
  (select count(*) >= 2 from public.commerce_items where item_kind='intensive_mentoring_package' and is_available),
  'fixed Intensive packages register as purchasable Commerce Items'
);
select test_private_mentoring_rules.assert(
  (select bool_and(not r.is_available)
   from public.intensive_mentoring_packages p
   cross join lateral public.resolve_commerce_item(p.id) r
   where p.pricing_mode='consultation'),
  'consultation Intensive packages remain outside checkout'
);

insert into auth.users (id,email,encrypted_password) values
 ('99100000-0000-0000-0000-000000000001','rules-admin@test.invalid','hash'),
 ('99100000-0000-0000-0000-000000000002','rules-mentee@test.invalid','hash'),
 ('99100000-0000-0000-0000-000000000003','rules-top-one@test.invalid','hash'),
 ('99100000-0000-0000-0000-000000000004','rules-top-two@test.invalid','hash'),
 ('99100000-0000-0000-0000-000000000005','rules-young@test.invalid','hash');
update public.profiles set role='admin' where id='99100000-0000-0000-0000-000000000001';
update public.profiles set role='mentor', mentor_setup_completed_at=now() where id in ('99100000-0000-0000-0000-000000000003','99100000-0000-0000-0000-000000000004','99100000-0000-0000-0000-000000000005');
delete from public.mentee_profiles where user_id in ('99100000-0000-0000-0000-000000000003','99100000-0000-0000-0000-000000000004','99100000-0000-0000-0000-000000000005');
update public.mentee_profiles set onboarding_completed_at=now() where user_id='99100000-0000-0000-0000-000000000002';
update public.mentor_profiles set tier_id=(select id from public.mentor_tiers where code='TOP_STUDENT'), is_active=true, timezone='Asia/Jakarta' where user_id in ('99100000-0000-0000-0000-000000000003','99100000-0000-0000-0000-000000000004');
update public.mentor_profiles set tier_id=(select id from public.mentor_tiers where code='YOUNG_PROFESSIONAL'), is_active=true, timezone='Asia/Jakarta' where user_id='99100000-0000-0000-0000-000000000005';

-- One invoice contains two distinct Private SKUs and one fixed Intensive SKU.
insert into public.carts(id,user_id,status) values ('99200000-0000-0000-0000-000000000001','99100000-0000-0000-0000-000000000002','active');
insert into public.orders(id,user_id,cart_id,status,total_amount) values ('99300000-0000-0000-0000-000000000001','99100000-0000-0000-0000-000000000002','99200000-0000-0000-0000-000000000001','pending_payment',1);
insert into public.order_items(order_id,commerce_item_id,item_kind_snapshot,name_snapshot,slug_snapshot,unit_price_amount)
select '99300000-0000-0000-0000-000000000001',p.id,'private_mentoring','Private 3','private-3',p.price_amount
from public.private_mentoring_packages p join public.mentor_tiers t on t.id=p.mentor_tier_id where t.code='TOP_STUDENT' and p.session_count=3
union all
select '99300000-0000-0000-0000-000000000001',p.id,'private_mentoring','Private 5','private-5',p.price_amount
from public.private_mentoring_packages p join public.mentor_tiers t on t.id=p.mentor_tier_id where t.code='TOP_STUDENT' and p.session_count=5
union all
select '99300000-0000-0000-0000-000000000001',p.id,'intensive_mentoring_package',p.name,p.slug,p.price_amount
from public.intensive_mentoring_packages p where p.pricing_mode='fixed' and p.is_active order by 5 limit 1;
update public.orders set status='paid', paid_at=now() where id='99300000-0000-0000-0000-000000000001';
select test_private_mentoring_rules.assert((select count(*)=2 from public.private_mentoring_enrollments where mentee_id='99100000-0000-0000-0000-000000000002'), 'multi-item invoice creates separate Private enrollments');
select test_private_mentoring_rules.assert((select count(*)=1 from public.intensive_mentoring_entitlements where mentee_id='99100000-0000-0000-0000-000000000002'), 'same invoice creates independent Intensive entitlement');

-- Repeat purchase of an existing Private SKU produces another independently auditable enrollment.
insert into public.carts(id,user_id,status) values ('99200000-0000-0000-0000-000000000002','99100000-0000-0000-0000-000000000002','converted');
insert into public.orders(id,user_id,cart_id,status,total_amount) values ('99300000-0000-0000-0000-000000000002','99100000-0000-0000-0000-000000000002','99200000-0000-0000-0000-000000000002','pending_payment',1);
insert into public.order_items(order_id,commerce_item_id,item_kind_snapshot,name_snapshot,slug_snapshot,unit_price_amount)
select '99300000-0000-0000-0000-000000000002',p.id,'private_mentoring','Private 3 repeat','private-3-repeat',p.price_amount
from public.private_mentoring_packages p join public.mentor_tiers t on t.id=p.mentor_tier_id where t.code='TOP_STUDENT' and p.session_count=3;
update public.orders set status='paid', paid_at=now() where id='99300000-0000-0000-0000-000000000002';
select test_private_mentoring_rules.assert((select count(*)=3 from public.private_mentoring_enrollments where mentee_id='99100000-0000-0000-0000-000000000002'), 'repeat purchase creates another enrollment');

set local role authenticated;
select set_config('request.jwt.claim.sub','99100000-0000-0000-0000-000000000002',true);
select public.submit_private_mentoring_topic_request(
 (select s.id from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id=auth.uid() and e.purchased_sessions=5 and s.session_number=1),
 (select id from public.private_mentoring_session_focuses where code='IDEA_PROBLEM_FRAMING'),
 'Saya ingin membahas validasi problem dan mempersempit target pengguna.'
);
select test_private_mentoring_rules.assert(
 (select topic_status='pending_review' and status='awaiting_focus' from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id=auth.uid() and e.purchased_sessions=5 and s.session_number=1),
 'mentee request requires admin review and does not auto-approve focus'
);

select set_config('request.jwt.claim.sub','99100000-0000-0000-0000-000000000001',true);
select test_private_mentoring_rules.denied($q$select public.admin_schedule_private_mentoring_session((select s.id from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id='99100000-0000-0000-0000-000000000002' and e.purchased_sessions=5 and s.session_number=1),'99100000-0000-0000-0000-000000000003',now()+interval '2 days')$q$,'pending topic cannot be scheduled');
select public.admin_resolve_private_mentoring_session_topic(
 (select s.id from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id='99100000-0000-0000-0000-000000000002' and e.purchased_sessions=5 and s.session_number=1),
 (select id from public.private_mentoring_session_focuses where code='IDEA_PROBLEM_FRAMING'),
 'Validasi problem statement dan ICP utama',
 'Arahkan mentee ke satu hipotesis utama sebelum eksperimen.'
);
select test_private_mentoring_rules.denied($q$select public.admin_set_private_mentoring_primary_mentor((select id from public.private_mentoring_enrollments where mentee_id='99100000-0000-0000-0000-000000000002' and purchased_sessions=5),'99100000-0000-0000-0000-000000000005',null)$q$,'wrong-tier primary mentor is rejected');
select public.admin_set_private_mentoring_primary_mentor((select id from public.private_mentoring_enrollments where mentee_id='99100000-0000-0000-0000-000000000002' and purchased_sessions=5),'99100000-0000-0000-0000-000000000003',null);
select test_private_mentoring_rules.assert((select primary_mentor_id='99100000-0000-0000-0000-000000000003' from public.private_mentoring_enrollments where mentee_id='99100000-0000-0000-0000-000000000002' and purchased_sessions=5), 'five-session enrollment stores primary mentor');

-- Dynamic future availability for both same-tier mentors.
insert into public.mentor_availability_rules(mentor_id,week_start_date,day_of_week,start_time,end_time)
select mentor_id,date_trunc('week',local_start)::date,extract(isodow from local_start)::integer,'08:00','18:00'
from (values
 ('99100000-0000-0000-0000-000000000003'::uuid,(now()+interval '2 days') at time zone 'Asia/Jakarta'),
 ('99100000-0000-0000-0000-000000000004'::uuid,(now()+interval '2 days') at time zone 'Asia/Jakarta'),
 ('99100000-0000-0000-0000-000000000003'::uuid,(now()+interval '3 days') at time zone 'Asia/Jakarta'),
 ('99100000-0000-0000-0000-000000000004'::uuid,(now()+interval '3 days') at time zone 'Asia/Jakarta')) as x(mentor_id,local_start)
on conflict do nothing;

select public.admin_schedule_private_mentoring_session(
 (select s.id from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id='99100000-0000-0000-0000-000000000002' and e.purchased_sessions=5 and s.session_number=1),
 '99100000-0000-0000-0000-000000000003',
 ((date_trunc('day',(now()+interval '2 days') at time zone 'Asia/Jakarta')+interval '10 hours') at time zone 'Asia/Jakarta')
);

-- Scheduled upcoming sessions can request a change; admin resolution returns the same session to confirmed and marks Calendar sync pending.
select set_config('request.jwt.claim.sub','99100000-0000-0000-0000-000000000002',true);
select public.submit_private_mentoring_topic_request(
 (select s.id from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id=auth.uid() and e.purchased_sessions=5 and s.session_number=1),
 null,
 'Saya ingin menggeser sesi ke review pitch deck yang sudah direvisi.'
);
select test_private_mentoring_rules.assert((select status='scheduled' and topic_status='pending_review' from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id=auth.uid() and e.purchased_sessions=5 and s.session_number=1), 'topic re-review does not destroy upcoming schedule');
select set_config('request.jwt.claim.sub','99100000-0000-0000-0000-000000000001',true);
select public.admin_resolve_private_mentoring_session_topic(
 (select s.id from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id='99100000-0000-0000-0000-000000000002' and e.purchased_sessions=5 and s.session_number=1),
 (select id from public.private_mentoring_session_focuses where code='PITCH_DECK'),
 'Review pitch deck final dan narrative flow',
 'Fokuskan feedback pada storyline dan slide problem-solution.'
);
select test_private_mentoring_rules.assert((select count(*)=1 and bool_and(sync_status='pending') from public.private_mentoring_session_calendar_integrations ci join public.private_mentoring_sessions s on s.id=ci.session_id join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id='99100000-0000-0000-0000-000000000002' and e.purchased_sessions=5 and s.session_number=1), 'topic resolution reuses one Calendar integration row and requests update');

-- Explicit mentor change is audited and becomes the default for subsequent sessions.
select public.admin_set_private_mentoring_primary_mentor((select id from public.private_mentoring_enrollments where mentee_id='99100000-0000-0000-0000-000000000002' and purchased_sessions=5),'99100000-0000-0000-0000-000000000004','Mentee membutuhkan spesialisasi mentor kedua untuk sesi lanjutan.');
select test_private_mentoring_rules.assert((select count(*)=2 from public.private_mentoring_primary_mentor_changes c join public.private_mentoring_enrollments e on e.id=c.enrollment_id where e.mentee_id='99100000-0000-0000-0000-000000000002' and e.purchased_sessions=5), 'initial assignment and explicit change are both audited');

-- Less-than-five package remains per-session flexible across same-tier mentors.
select set_config('request.jwt.claim.sub','99100000-0000-0000-0000-000000000002',true);
select public.submit_private_mentoring_topic_request((select s.id from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id=auth.uid() and e.purchased_sessions=3 order by e.created_at limit 1),null,'Review proposal untuk kompetisi nasional.');
select set_config('request.jwt.claim.sub','99100000-0000-0000-0000-000000000001',true);
select public.admin_resolve_private_mentoring_session_topic((select s.id from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id='99100000-0000-0000-0000-000000000002' and e.purchased_sessions=3 order by e.created_at limit 1),(select id from public.private_mentoring_session_focuses where code='PROPOSAL_WRITING_STORYLINE'),'Review proposal dan storyline utama',null);
select test_private_mentoring_rules.assert((select count(*)=2 from public.list_eligible_private_mentoring_enrollment_mentors((select id from public.private_mentoring_enrollments where mentee_id='99100000-0000-0000-0000-000000000002' and purchased_sessions=3 order by created_at limit 1))), 'small package exposes all active same-tier mentors');

select public.admin_set_private_mentoring_session_status(
 (select s.id from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id='99100000-0000-0000-0000-000000000002' and e.purchased_sessions=5 and s.session_number=1),
 'completed'
);
select set_config('request.jwt.claim.sub','99100000-0000-0000-0000-000000000002',true);
select test_private_mentoring_rules.denied($q$select public.submit_private_mentoring_topic_request((select s.id from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id='99100000-0000-0000-0000-000000000002' and e.purchased_sessions=5 and s.session_number=1),null,'Harus ditolak')$q$,'completed session topic is immutable');
select test_private_mentoring_rules.assert((select count(*)=1 from public.list_my_intensive_mentoring_entitlements()), 'mentee can read Intensive entitlement alongside active Private enrollments');

rollback;
select 'PASS: stakeholder Private Mentoring rules and Intensive commerce/entitlement' as result;
