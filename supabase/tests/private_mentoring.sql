-- Disposable database only. All fixtures and mutations are rolled back.
begin;

create schema test_private_mentoring;
grant usage on schema test_private_mentoring to anon, authenticated, service_role;

create function test_private_mentoring.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;

create function test_private_mentoring.denied(command text, message text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when insufficient_privilege or check_violation or unique_violation or foreign_key_violation or invalid_parameter_value or undefined_table or undefined_column or raise_exception then return;
  end;
  raise exception 'UNEXPECTEDLY ALLOWED: %', message;
end;
$$;

grant execute on all functions in schema test_private_mentoring to anon, authenticated, service_role;

select test_private_mentoring.assert(to_regclass('public.private_mentoring_programs') is null, 'marketing program CMS table is removed');
select test_private_mentoring.assert(to_regclass('public.private_mentoring_highlights') is null, 'marketing highlights CMS table is removed');
select test_private_mentoring.assert(to_regclass('public.private_mentoring_journey_steps') is null, 'marketing journey CMS table is removed');
select test_private_mentoring.assert(
  not exists (select 1 from information_schema.columns where table_schema='public' and table_name in ('private_mentoring_learning_paths','private_mentoring_session_focuses') and column_name='program_id'),
  'catalog masters do not retain obsolete marketing-program foreign keys'
);
select test_private_mentoring.assert((select count(*) = 2 from public.private_mentoring_learning_paths), 'exact two learning paths');
select test_private_mentoring.assert((select count(*) = 6 from public.private_mentoring_session_focuses), 'exact six session focuses');
select test_private_mentoring.assert((select count(*) = 9 from public.competition_categories), 'exact nine competition categories');
select test_private_mentoring.assert((select count(*) = 10 from public.private_mentoring_packages), 'exact ten packages');
select test_private_mentoring.assert(
  (select count(*) = 10 from public.private_mentoring_packages p join public.mentor_tiers t on t.id = p.mentor_tier_id),
  'all packages reuse canonical Mentor Domain tiers'
);
select test_private_mentoring.assert(
  (select price_amount = 885000 and reference_price_amount = 950000 and price_amount / session_count = 295000
   from public.private_mentoring_packages p join public.mentor_tiers t on t.id = p.mentor_tier_id
   where t.code = 'TOP_STUDENT' and p.session_count = 3),
  'Top Student three-session correction is 885000 total and 295000 derived'
);
select test_private_mentoring.assert(
  (select bool_and(duration_minutes = 75 and max_participants = 4) from public.private_mentoring_packages),
  'all packages use 75 minutes and max four participants'
);
select test_private_mentoring.assert(
  (select count(*) = 10 from public.commerce_items where item_kind = 'private_mentoring' and is_available),
  'active packages register as available shared Commerce Items'
);
select test_private_mentoring.assert(
  (select description = 'Private Mentoring package' from public.resolve_commerce_item('97300000-0000-0000-0000-000000000002')),
  'Shared Commerce resolver no longer depends on marketing copy'
);

set local role anon;
select test_private_mentoring.assert((select count(*) = 2 from public.private_mentoring_learning_paths where is_active), 'anon can read active learning paths');
select test_private_mentoring.assert((select count(*) = 6 from public.private_mentoring_session_focuses where is_active), 'anon can read active session topics');
select test_private_mentoring.assert((select count(*) = 9 from public.competition_categories where is_active), 'anon can read active competition categories');
select test_private_mentoring.assert((select count(*) = 10 from public.private_mentoring_packages where is_active), 'anon can read active package prices');
select test_private_mentoring.denied($$update public.private_mentoring_packages set price_amount = 1$$, 'anon cannot mutate package catalog');
reset role;

insert into auth.users (id, email, encrypted_password) values
  ('96000000-0000-0000-0000-000000000001', 'pm-admin@test.invalid', 'hash'),
  ('96000000-0000-0000-0000-000000000002', 'pm-mentee-a@test.invalid', 'hash'),
  ('96000000-0000-0000-0000-000000000003', 'pm-mentee-b@test.invalid', 'hash'),
  ('96000000-0000-0000-0000-000000000004', 'pm-top-one@test.invalid', 'hash'),
  ('96000000-0000-0000-0000-000000000005', 'pm-young@test.invalid', 'hash'),
  ('96000000-0000-0000-0000-000000000006', 'pm-top-two@test.invalid', 'hash');
update public.profiles set role = 'admin' where id = '96000000-0000-0000-0000-000000000001';
update public.profiles set role = 'mentor', mentor_setup_completed_at = now() where id in (
  '96000000-0000-0000-0000-000000000004',
  '96000000-0000-0000-0000-000000000005',
  '96000000-0000-0000-0000-000000000006'
);
delete from public.mentee_profiles where user_id in (
  '96000000-0000-0000-0000-000000000004',
  '96000000-0000-0000-0000-000000000005',
  '96000000-0000-0000-0000-000000000006'
);
update public.mentor_profiles set tier_id = '81000000-0000-0000-0000-000000000001' where user_id in (
  '96000000-0000-0000-0000-000000000004', '96000000-0000-0000-0000-000000000006'
);
update public.mentor_profiles set tier_id = '81000000-0000-0000-0000-000000000002' where user_id = '96000000-0000-0000-0000-000000000005';
update public.mentee_profiles set onboarding_completed_at = now() where user_id in (
  '96000000-0000-0000-0000-000000000002', '96000000-0000-0000-0000-000000000003'
);

-- Scheduling now requires a concrete declared availability window. Preserve the
-- original test scenarios by declaring only the exact current/next-week windows
-- used below rather than weakening the production RPC.
insert into public.mentor_availability_rules (mentor_id, week_start_date, day_of_week, start_time, end_time) values
  ('96000000-0000-0000-0000-000000000004', '2026-09-14', 7, '09:00', '12:00'),
  ('96000000-0000-0000-0000-000000000006', '2026-09-21', 1, '13:00', '16:00');

insert into public.digital_products (
  id, name, slug, description, image_path, price_amount,
  content_type, content_path, content_mime_type, content_file_name, content_size_bytes, is_published
) values
  ('96100000-0000-0000-0000-000000000001', 'Phase 3 Product A', 'phase-3-product-a', 'Digital Product mixed-cart fixture A.', 'products/phase-3-a.webp', 50000, 'pdf', 'products/phase-3-a/material.pdf', 'application/pdf', 'material.pdf', 1024, true),
  ('96100000-0000-0000-0000-000000000002', 'Phase 3 Existing Cart Item', 'phase-3-existing-cart-item', 'Existing unrelated cart fixture.', 'products/phase-3-existing.webp', 25000, 'pdf', 'products/phase-3-existing/material.pdf', 'application/pdf', 'material.pdf', 1024, true),
  ('96100000-0000-0000-0000-000000000003', 'Phase 3 Unavailable Product', 'phase-3-unavailable', 'Unavailable link fixture.', 'products/phase-3-unavailable.webp', 10000, 'pdf', 'products/phase-3-unavailable/material.pdf', 'application/pdf', 'material.pdf', 1024, true);

set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000001', true);
select test_private_mentoring.assert((select count(*) >= 2 from public.list_purchasable_commerce_items('Phase 3')), 'admin can search purchasable mixed-domain items');
select test_private_mentoring.assert((select count(*) = 2 from public.list_cart_link_mentees('pm-mentee')), 'admin can search completed mentees');
select public.create_commerce_cart_link(
  '96000000-0000-0000-0000-000000000002',
  repeat('a', 64),
  array[
    (select p.id from public.private_mentoring_packages p join public.mentor_tiers t on t.id = p.mentor_tier_id where t.code = 'TOP_STUDENT' and p.session_count = 3),
    '96100000-0000-0000-0000-000000000001'::uuid
  ]
);
select test_private_mentoring.assert(
  (select count(*) = 1 from public.list_admin_cart_links() where mentee_id = '96000000-0000-0000-0000-000000000002'),
  'admin lists the created cart link through the protected RPC'
);
set local role service_role;
select test_private_mentoring.assert(
  (select count(*) = 1 and bool_and(token_hash = repeat('a', 64)) from public.commerce_cart_links where mentee_id = '96000000-0000-0000-0000-000000000002'),
  'database persists only the supplied secure token hash'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000001', true);

select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000003', true);
select test_private_mentoring.denied($$select public.claim_commerce_cart_link(repeat('a',64))$$, 'wrong mentee cannot claim link');

select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000002', true);
select public.add_cart_item('96100000-0000-0000-0000-000000000002');
select public.claim_commerce_cart_link(repeat('a', 64));
select public.claim_commerce_cart_link(repeat('a', 64));
select test_private_mentoring.assert((select count(*) = 3 from public.get_active_cart()), 'repeated claim is idempotent and preserves unrelated cart item');
select test_private_mentoring.assert(
  (select count(*) = 1 from public.get_active_cart() where item_kind = 'private_mentoring' and price_amount = 885000),
  'claimed Private Mentoring resolves authoritative package price'
);
select public.create_order_from_cart((select id from public.carts where user_id = auth.uid() and status = 'active'));
reset role;

select test_private_mentoring.assert(
  (select unit_price_amount = 885000 from public.order_items where item_kind_snapshot = 'private_mentoring'),
  'Order Item snapshots Private Mentoring price'
);
update public.private_mentoring_packages set price_amount = 900000
where id = (select commerce_item_id from public.order_items where item_kind_snapshot = 'private_mentoring');
select test_private_mentoring.assert(
  (select unit_price_amount = 885000 from public.order_items where item_kind_snapshot = 'private_mentoring'),
  'later package edits do not rewrite historical Order Item price'
);

update public.orders set status = 'paid', paid_at = now() where user_id = '96000000-0000-0000-0000-000000000002';
select test_private_mentoring.assert((select count(*) = 1 from public.private_mentoring_enrollments where mentee_id = '96000000-0000-0000-0000-000000000002'), 'paid Private Mentoring creates one enrollment');
update public.private_mentoring_enrollments set competition_name='Fixture Competition', competition_updated_at=now() where mentee_id='96000000-0000-0000-0000-000000000002';
select test_private_mentoring.assert(
  (select purchased_sessions = 3 from public.private_mentoring_enrollments where mentee_id = '96000000-0000-0000-0000-000000000002'),
  'enrollment snapshots purchased session entitlement'
);
select test_private_mentoring.assert(
  (select count(*) = 3 from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id = s.enrollment_id where e.mentee_id = '96000000-0000-0000-0000-000000000002'),
  'paid three-session package creates exactly three operational sessions'
);
update public.orders set status = 'paid' where user_id = '96000000-0000-0000-0000-000000000002';
select test_private_mentoring.assert((select count(*) = 1 from public.private_mentoring_enrollments where mentee_id = '96000000-0000-0000-0000-000000000002'), 'duplicate paid reconciliation stays idempotent');

set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000002', true);
select public.set_private_mentoring_session_focus(
  (select s.id from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id=auth.uid() and s.session_number=1),
  (select id from public.private_mentoring_session_focuses where code='IDEA_PROBLEM_FRAMING')
);
select public.set_private_mentoring_session_focus(
  (select s.id from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id=auth.uid() and s.session_number=2),
  (select id from public.private_mentoring_session_focuses where code='PROPOSAL_WRITING_STORYLINE')
);
select test_private_mentoring.assert(
  (select count(*) = 2 from public.list_my_private_mentoring_sessions() where status = 'awaiting_scheduling'),
  'mentee can choose a seeded focus per session'
);
select test_private_mentoring.denied($$update public.private_mentoring_sessions set mentor_id='96000000-0000-0000-0000-000000000004'$$, 'mentee cannot assign mentor directly');
select test_private_mentoring.denied($$update public.private_mentoring_sessions set scheduled_start_at=now()$$, 'mentee cannot assign schedule directly');

select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000001', true);
select test_private_mentoring.denied(
  $$select public.admin_schedule_private_mentoring_session((select s.id from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id='96000000-0000-0000-0000-000000000002' and s.session_number=1),'96000000-0000-0000-0000-000000000005','2026-09-20 10:00+07')$$,
  'admin cannot assign wrong-tier mentor'
);
select public.admin_schedule_private_mentoring_session(
  (select s.id from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id='96000000-0000-0000-0000-000000000002' and s.session_number=1),
  '96000000-0000-0000-0000-000000000004',
  '2026-09-20 10:00+07'
);
select public.admin_schedule_private_mentoring_session(
  (select s.id from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id='96000000-0000-0000-0000-000000000002' and s.session_number=2),
  '96000000-0000-0000-0000-000000000006',
  '2026-09-21 14:00+07'
);
select test_private_mentoring.assert(
  (select count(distinct mentor_id) = 2 from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id='96000000-0000-0000-0000-000000000002' and s.status='scheduled'),
  'different same-tier mentors may be assigned per session'
);
select test_private_mentoring.assert(
  (select bool_and(scheduled_end_at - scheduled_start_at = interval '75 minutes') from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id='96000000-0000-0000-0000-000000000002' and s.status='scheduled'),
  'admin scheduling derives 75-minute end time'
);
select public.admin_set_private_mentoring_session_status(
  (select s.id from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id='96000000-0000-0000-0000-000000000002' and s.session_number=1),
  'completed'
);
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000002', true);
select test_private_mentoring.denied(
  $$select public.set_private_mentoring_session_focus((select s.id from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id='96000000-0000-0000-0000-000000000002' and s.session_number=1),(select id from public.private_mentoring_session_focuses limit 1))$$,
  'completed session focus is locked'
);
reset role;

-- An unavailable referenced item causes all-or-nothing claim failure.
set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000001', true);
select public.create_commerce_cart_link('96000000-0000-0000-0000-000000000003', repeat('b',64), array['96100000-0000-0000-0000-000000000003'::uuid]);
reset role;
delete from public.digital_products where id='96100000-0000-0000-0000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000003', true);
select test_private_mentoring.denied($$select public.claim_commerce_cart_link(repeat('b',64))$$, 'unavailable link item fails safely');
select test_private_mentoring.assert((select count(*) = 0 from public.get_active_cart()), 'failed claim does not partially insert items');
reset role;

rollback;
select 'PASS: corrected Private Mentoring catalog, commerce, enrollment, sessions, and security boundary' as result;
