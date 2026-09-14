-- Phase 3: domain-owned Private Mentoring, admin-assisted cart links, paid enrollments, and per-session operations.
-- Business source: Private Mentoring Guidebook (English), with the explicit stakeholder correction that
-- Top Student 3 sessions is Rp885.000 total and therefore Rp295.000/session when derived at runtime.

-- Shared competition taxonomy for mentoring and future competition-related domains.
create table public.competition_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(btrim(code)) and code ~ '^[A-Z0-9_]+$'),
  slug text not null unique check (slug = btrim(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 160),
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.private_mentoring_programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = 'private-mentoring'),
  title text not null check (title = btrim(title) and char_length(title) between 1 and 160),
  short_description text not null check (short_description = btrim(short_description) and char_length(short_description) between 1 and 1000),
  kicker text not null check (kicker = btrim(kicker) and char_length(kicker) between 1 and 160),
  detail text not null check (detail = btrim(detail) and char_length(detail) between 1 and 5000),
  audience text not null check (audience = btrim(audience) and char_length(audience) between 1 and 5000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.private_mentoring_highlights (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.private_mentoring_programs(id),
  text text not null check (text = btrim(text) and char_length(text) between 1 and 500),
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, sort_order)
);

create table public.private_mentoring_journey_steps (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.private_mentoring_programs(id),
  title text not null check (title = btrim(title) and char_length(title) between 1 and 160),
  description text not null check (description = btrim(description) and char_length(description) between 1 and 3000),
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, sort_order)
);

create table public.private_mentoring_learning_paths (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.private_mentoring_programs(id),
  code text not null unique check (code = upper(btrim(code)) and code ~ '^[A-Z0-9_]+$'),
  slug text not null unique check (slug = btrim(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 160),
  description text not null check (description = btrim(description) and char_length(description) between 1 and 3000),
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.private_mentoring_session_focuses (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.private_mentoring_programs(id),
  code text not null unique check (code = upper(btrim(code)) and code ~ '^[A-Z0-9_]+$'),
  slug text not null unique check (slug = btrim(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 160),
  description text not null check (description = btrim(description) and char_length(description) between 1 and 3000),
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.private_mentoring_packages (
  id uuid primary key default gen_random_uuid(),
  mentor_tier_id uuid not null references public.mentor_tiers(id),
  session_count integer not null check (session_count > 0 and session_count <= 100),
  price_amount bigint not null check (price_amount > 0 and price_amount <= 9007199254740991),
  reference_price_amount bigint check (reference_price_amount is null or (reference_price_amount >= price_amount and reference_price_amount <= 9007199254740991)),
  duration_minutes integer not null default 75 check (duration_minutes > 0 and duration_minutes <= 480),
  max_participants integer not null default 4 check (max_participants > 0 and max_participants <= 100),
  is_active boolean not null default true,
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mentor_tier_id, session_count)
);

-- Shared Commerce admin cart links. The raw claim token never enters the database.
create table public.commerce_cart_links (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid not null references public.profiles(id),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'active' check (status in ('active', 'claimed', 'revoked')),
  claimed_cart_id uuid references public.carts(id),
  created_by uuid not null references public.profiles(id),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'claimed') = (claimed_cart_id is not null and claimed_at is not null))
);

create table public.commerce_cart_link_items (
  cart_link_id uuid not null references public.commerce_cart_links(id) on delete cascade,
  commerce_item_id uuid not null references public.commerce_items(id),
  created_at timestamptz not null default now(),
  primary key (cart_link_id, commerce_item_id)
);

create table public.private_mentoring_enrollments (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid not null references public.profiles(id),
  order_item_id uuid not null unique references public.order_items(id),
  package_id uuid not null references public.private_mentoring_packages(id),
  purchased_sessions integer not null check (purchased_sessions > 0 and purchased_sessions <= 100),
  learning_path_id uuid references public.private_mentoring_learning_paths(id),
  competition_category_id uuid references public.competition_categories(id),
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.private_mentoring_sessions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.private_mentoring_enrollments(id),
  session_number integer not null check (session_number > 0),
  session_focus_id uuid references public.private_mentoring_session_focuses(id),
  mentor_id uuid references public.mentor_profiles(user_id),
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  status text not null default 'awaiting_focus' check (status in ('awaiting_focus', 'awaiting_scheduling', 'scheduled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, session_number),
  check ((scheduled_start_at is null) = (scheduled_end_at is null)),
  check (scheduled_end_at is null or scheduled_end_at > scheduled_start_at),
  check ((status = 'scheduled' or status = 'completed') = (mentor_id is not null and scheduled_start_at is not null and session_focus_id is not null))
);

create index competition_categories_public_order on public.competition_categories (is_active, sort_order, id);
create index private_mentoring_packages_public_order on public.private_mentoring_packages (is_active, sort_order, id);
create index commerce_cart_links_mentee_history on public.commerce_cart_links (mentee_id, created_at desc, id);
create index private_mentoring_enrollments_mentee on public.private_mentoring_enrollments (mentee_id, created_at desc, id);
create index private_mentoring_sessions_enrollment on public.private_mentoring_sessions (enrollment_id, session_number);
create index private_mentoring_sessions_mentor on public.private_mentoring_sessions (mentor_id, scheduled_start_at) where mentor_id is not null;

create trigger competition_categories_touch_updated_at before update on public.competition_categories for each row execute function public.touch_updated_at();
create trigger private_mentoring_programs_touch_updated_at before update on public.private_mentoring_programs for each row execute function public.touch_updated_at();
create trigger private_mentoring_highlights_touch_updated_at before update on public.private_mentoring_highlights for each row execute function public.touch_updated_at();
create trigger private_mentoring_journey_steps_touch_updated_at before update on public.private_mentoring_journey_steps for each row execute function public.touch_updated_at();
create trigger private_mentoring_learning_paths_touch_updated_at before update on public.private_mentoring_learning_paths for each row execute function public.touch_updated_at();
create trigger private_mentoring_session_focuses_touch_updated_at before update on public.private_mentoring_session_focuses for each row execute function public.touch_updated_at();
create trigger private_mentoring_packages_touch_updated_at before update on public.private_mentoring_packages for each row execute function public.touch_updated_at();
create trigger commerce_cart_links_touch_updated_at before update on public.commerce_cart_links for each row execute function public.touch_updated_at();
create trigger private_mentoring_enrollments_touch_updated_at before update on public.private_mentoring_enrollments for each row execute function public.touch_updated_at();
create trigger private_mentoring_sessions_touch_updated_at before update on public.private_mentoring_sessions for each row execute function public.touch_updated_at();

-- Guidebook-backed baseline public information.
insert into public.private_mentoring_programs (id, slug, title, short_description, kicker, detail, audience) values (
  '97000000-0000-0000-0000-000000000001',
  'private-mentoring',
  'Private Mentoring',
  'A flexible per-session mentoring service designed to help students solve a specific challenge, improve a selected deliverable, or prepare for an upcoming competition stage.',
  'Personalized Mentoring, Focused Sessions, Measurable Progress.',
  'Book a focused session whenever you need targeted guidance, practical feedback, and mentoring support. Each session works on one specific topic or challenge with direct practical guidance, applied examples, and actionable support.',
  'For beginners learning from the basics, individuals or teams preparing for a competition, and students who need focused feedback on an idea, proposal, deck, model, analysis, or pitch.'
);

insert into public.private_mentoring_highlights (id, program_id, text, sort_order) values
  ('97010000-0000-0000-0000-000000000001','97000000-0000-0000-0000-000000000001','Focused on Your Goal',1),
  ('97010000-0000-0000-0000-000000000002','97000000-0000-0000-0000-000000000001','Belajar bersama mentor pilihan',2),
  ('97010000-0000-0000-0000-000000000003','97000000-0000-0000-0000-000000000001','Hands-On Practical',3);

insert into public.private_mentoring_journey_steps (id, program_id, title, description, sort_order) values
  ('97020000-0000-0000-0000-000000000001','97000000-0000-0000-0000-000000000001','Initial Consultation','Tell us your goals, current progress, materials, and the areas where you need support.',1),
  ('97020000-0000-0000-0000-000000000002','97000000-0000-0000-0000-000000000001','Mentor Match & Plan','We match you with the right mentor and set the focus for a productive session.',2),
  ('97020000-0000-0000-0000-000000000003','97000000-0000-0000-0000-000000000001','Live Mentoring Session','Engage in a 75 minutes interactive session with your mentor to discuss, analyze, and solve.',3),
  ('97020000-0000-0000-0000-000000000004','97000000-0000-0000-0000-000000000001','Action Plan & Next Steps','We wrap up with a clear action plan so you know exactly what to do next.',4);

insert into public.private_mentoring_learning_paths (id, program_id, code, slug, name, description, sort_order) values
  ('97100000-0000-0000-0000-000000000001','97000000-0000-0000-0000-000000000001','END_TO_END','end-to-end-learning','End-to-End Learning','Best for students who want to learn from the ground up. Sessions follow Strativate’s curriculum from competition understanding and problem identification through analysis, proposal development, and pitching.',1),
  ('97100000-0000-0000-0000-000000000002','97000000-0000-0000-0000-000000000001','COMPETITION_FOCUSED','competition-focused-mentoring','Competition-Focused Mentoring','Best for students who already have a competition target, from early-stage strategy and proposal development through mock presentation, Q&A drills, and final refinement.',2);

insert into public.private_mentoring_session_focuses (id, program_id, code, slug, name, description, sort_order) values
  ('97200000-0000-0000-0000-000000000001','97000000-0000-0000-0000-000000000001','IDEA_PROBLEM_FRAMING','idea-problem-framing','Idea & Problem Framing','Clarify your problem, validate it, and shape a strong concept or solution.',1),
  ('97200000-0000-0000-0000-000000000002','97000000-0000-0000-0000-000000000001','BUSINESS_ANALYSIS_CASE_STRUCTURING','business-analysis-case-structuring','Business Analysis & Case Structuring','Build a solid analysis using frameworks and data to strengthen your case.',2),
  ('97200000-0000-0000-0000-000000000003','97000000-0000-0000-0000-000000000001','PROPOSAL_WRITING_STORYLINE','proposal-writing-storyline','Proposal Writing & Storyline','Create a clear, logical, and compelling proposal that tells your story.',3),
  ('97200000-0000-0000-0000-000000000004','97000000-0000-0000-0000-000000000001','FINANCIAL_ANALYSIS_VALUATION','financial-analysis-valuation','Financial Analysis & Valuation','Strengthen your numbers with accurate analysis and sound assumptions.',4),
  ('97200000-0000-0000-0000-000000000005','97000000-0000-0000-0000-000000000001','SLIDE_DECK_VISUAL_DESIGN','slide-deck-visual-design','Slide Deck & Visual Design','Improve the structure, visuals, and impact of your presentation.',5),
  ('97200000-0000-0000-0000-000000000006','97000000-0000-0000-0000-000000000001','PITCHING_PRESENTATION_SKILLS','pitching-presentation-skills','Pitching & Presentation Skills','Deliver your message confidently and handle Q&A with impact.',6);

insert into public.competition_categories (id, code, slug, name, sort_order) values
  ('97400000-0000-0000-0000-000000000001','BUSINESS_PLAN','business-plan-competition','Business Plan Competition',1),
  ('97400000-0000-0000-0000-000000000002','BUSINESS_CASE','business-case-competition','Business Case Competition',2),
  ('97400000-0000-0000-0000-000000000003','SCIENTIFIC_PAPER','scientific-paper-competition','Scientific Paper Competition',3),
  ('97400000-0000-0000-0000-000000000004','MARKETING','marketing-competition','Marketing Competition',4),
  ('97400000-0000-0000-0000-000000000005','ACCOUNTING_FINANCE','accounting-and-finance-competition','Accounting and Finance Competition',5),
  ('97400000-0000-0000-0000-000000000006','PITCHING','pitching-competition','Pitching Competition',6),
  ('97400000-0000-0000-0000-000000000007','BUSINESS_ESSAY','business-essay-competition','Business Essay Competition',7),
  ('97400000-0000-0000-0000-000000000008','EQUITY_RESEARCH','equity-research-competition','Equity Research Competition',8),
  ('97400000-0000-0000-0000-000000000009','ECONOMIC_POLICY_CASE','economic-policy-case-competition','Economic & Policy Case Competition',9);

insert into public.private_mentoring_packages (id, mentor_tier_id, session_count, price_amount, reference_price_amount, duration_minutes, max_participants, sort_order) values
  ('97300000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001',1,300000,null,75,4,1),
  ('97300000-0000-0000-0000-000000000002','81000000-0000-0000-0000-000000000001',3,885000,950000,75,4,2),
  ('97300000-0000-0000-0000-000000000003','81000000-0000-0000-0000-000000000001',5,1395000,1500000,75,4,3),
  ('97300000-0000-0000-0000-000000000004','81000000-0000-0000-0000-000000000001',7,1890000,2100000,75,4,4),
  ('97300000-0000-0000-0000-000000000005','81000000-0000-0000-0000-000000000001',10,2500000,3000000,75,4,5),
  ('97300000-0000-0000-0000-000000000006','81000000-0000-0000-0000-000000000002',1,350000,null,75,4,6),
  ('97300000-0000-0000-0000-000000000007','81000000-0000-0000-0000-000000000002',3,1005000,1050000,75,4,7),
  ('97300000-0000-0000-0000-000000000008','81000000-0000-0000-0000-000000000002',5,1645000,1750000,75,4,8),
  ('97300000-0000-0000-0000-000000000009','81000000-0000-0000-0000-000000000002',7,2240000,2450000,75,4,9),
  ('97300000-0000-0000-0000-000000000010','81000000-0000-0000-0000-000000000002',10,3000000,3500000,75,4,10);

-- Package identity is historical business identity; only price/reference/duration/availability/order may change.
create function public.private_mentoring_package_guard_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.mentor_tier_id is distinct from old.mentor_tier_id or new.session_count is distinct from old.session_count then
    raise exception 'Private Mentoring package tier and session count are immutable' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger private_mentoring_package_guard_identity before update on public.private_mentoring_packages for each row execute function public.private_mentoring_package_guard_identity();

create function public.sync_private_mentoring_commerce_item()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    update public.commerce_items set is_available = false where id = old.id and item_kind = 'private_mentoring';
    return old;
  end if;
  if exists (select 1 from public.commerce_items where id = new.id and item_kind <> 'private_mentoring') then
    raise exception 'Commerce Item identity collision' using errcode = '23505';
  end if;
  insert into public.commerce_items(id, item_kind, is_available)
  values (new.id, 'private_mentoring', new.is_active)
  on conflict (id) do update set is_available = excluded.is_available;
  return new;
end;
$$;
create trigger private_mentoring_package_sync_commerce after insert or update of is_active on public.private_mentoring_packages for each row execute function public.sync_private_mentoring_commerce_item();
create trigger private_mentoring_package_retire_commerce after delete on public.private_mentoring_packages for each row execute function public.sync_private_mentoring_commerce_item();

-- Seeds predate the sync trigger, so register all canonical packages once.
insert into public.commerce_items (id, item_kind, is_available)
select id, 'private_mentoring', is_active from public.private_mentoring_packages
on conflict (id) do update set item_kind = excluded.item_kind, is_available = excluded.is_available;

-- Extend the Shared Commerce resolver without making commerce_items the business source of truth.
create or replace function public.resolve_commerce_item(p_commerce_item_id uuid)
returns table (
  commerce_item_id uuid,
  item_kind text,
  name text,
  slug text,
  description text,
  image_path text,
  price_amount bigint,
  is_available boolean
)
language sql stable security definer set search_path = '' as $$
  select
    ci.id,
    ci.item_kind,
    dp.name,
    dp.slug,
    dp.description,
    dp.image_path,
    dp.price_amount,
    (ci.is_available and dp.id is not null)
  from public.commerce_items ci
  left join public.digital_products dp on dp.id = ci.id
  where ci.id = p_commerce_item_id and ci.item_kind = 'digital_product'

  union all

  select
    ci.id,
    ci.item_kind,
    'Private Mentoring - ' || t.name || ' - ' || p.session_count || case when p.session_count = 1 then ' Session' else ' Sessions' end,
    'private-mentoring-' || lower(replace(t.code, '_', '-')) || '-' || p.session_count || case when p.session_count = 1 then '-session' else '-sessions' end,
    pm.short_description,
    null::text,
    p.price_amount,
    (ci.is_available and p.is_active and t.is_active and pm.is_active)
  from public.commerce_items ci
  join public.private_mentoring_packages p on p.id = ci.id
  join public.mentor_tiers t on t.id = p.mentor_tier_id
  join public.private_mentoring_programs pm on pm.slug = 'private-mentoring'
  where ci.id = p_commerce_item_id and ci.item_kind = 'private_mentoring';
$$;

-- Admin-only discovery surfaces for generic Cart Links.
create function public.list_cart_link_mentees(p_query text default '')
returns table (user_id uuid, email text, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, coalesce(u.email,''), nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), '')
  from public.profiles p
  join public.mentee_profiles mp on mp.user_id = p.id and mp.onboarding_completed_at is not null
  join auth.users u on u.id = p.id
  where public.is_admin()
    and p.role = 'mentee'::public.app_role
    and (btrim(coalesce(p_query,'')) = '' or concat_ws(' ', u.email, p.first_name, p.last_name, p.username) ilike '%' || btrim(p_query) || '%')
  order by p.created_at desc, p.id
  limit 50;
$$;

create function public.list_purchasable_commerce_items(p_query text default '')
returns table (commerce_item_id uuid, item_kind text, name text, slug text, price_amount bigint)
language sql stable security definer set search_path = '' as $$
  select r.commerce_item_id, r.item_kind, r.name, r.slug, r.price_amount
  from public.commerce_items ci
  cross join lateral public.resolve_commerce_item(ci.id) r
  where public.is_admin()
    and r.is_available
    and r.name is not null
    and r.price_amount is not null
    and (btrim(coalesce(p_query,'')) = '' or concat_ws(' ', r.name, r.slug, r.item_kind) ilike '%' || btrim(p_query) || '%')
  order by r.item_kind, r.name, r.commerce_item_id
  limit 100;
$$;

create function public.create_commerce_cart_link(p_mentee_id uuid, p_token_hash text, p_commerce_item_ids uuid[])
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_link_id uuid := gen_random_uuid();
  v_item_id uuid;
  v_resolved record;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Secure token hash required' using errcode = '22023'; end if;
  if p_commerce_item_ids is null or cardinality(p_commerce_item_ids) = 0 or cardinality(p_commerce_item_ids) > 50 then
    raise exception 'Select between 1 and 50 Commerce Items' using errcode = '22023';
  end if;
  if cardinality(array(select distinct x from unnest(p_commerce_item_ids) x)) <> cardinality(p_commerce_item_ids) then
    raise exception 'Duplicate Commerce Items are not allowed' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles p join public.mentee_profiles mp on mp.user_id=p.id
    where p.id=p_mentee_id and p.role='mentee'::public.app_role and mp.onboarding_completed_at is not null
  ) then raise exception 'Completed mentee account required' using errcode = '22023'; end if;

  foreach v_item_id in array p_commerce_item_ids loop
    select * into v_resolved from public.resolve_commerce_item(v_item_id);
    if not found or not coalesce(v_resolved.is_available,false) or v_resolved.price_amount is null then
      raise exception 'Cart Link item is unavailable' using errcode = '22023';
    end if;
  end loop;

  insert into public.commerce_cart_links(id, mentee_id, token_hash, created_by)
  values (v_link_id, p_mentee_id, p_token_hash, auth.uid());
  insert into public.commerce_cart_link_items(cart_link_id, commerce_item_id)
  select v_link_id, unnest(p_commerce_item_ids);
  return v_link_id;
end;
$$;

create function public.list_admin_cart_links()
returns table (id uuid, mentee_id uuid, mentee_email text, status text, item_count bigint, created_at timestamptz, claimed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.id, l.mentee_id, coalesce(u.email,''), l.status, count(li.commerce_item_id), l.created_at, l.claimed_at
  from public.commerce_cart_links l
  join auth.users u on u.id=l.mentee_id
  left join public.commerce_cart_link_items li on li.cart_link_id=l.id
  where public.is_admin()
  group by l.id, u.email
  order by l.created_at desc, l.id desc
  limit 100;
$$;

create function public.claim_commerce_cart_link(p_token_hash text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.current_completed_mentee_id();
  v_link public.commerce_cart_links;
  v_cart public.carts;
  v_item record;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid Cart Link' using errcode = '22023'; end if;
  select * into v_link from public.commerce_cart_links where token_hash=p_token_hash for update;
  if not found or v_link.status='revoked' then raise exception 'Cart Link is invalid or unavailable' using errcode = '22023'; end if;
  if v_link.mentee_id is distinct from v_uid then raise exception 'Cart Link belongs to another mentee' using errcode = '42501'; end if;
  if v_link.status='claimed' then return v_link.claimed_cart_id; end if;

  for v_item in
    select li.commerce_item_id, r.is_available, r.price_amount
    from public.commerce_cart_link_items li
    left join lateral public.resolve_commerce_item(li.commerce_item_id) r on true
    where li.cart_link_id=v_link.id
  loop
    if v_item.is_available is distinct from true or v_item.price_amount is null then
      raise exception 'Cart Link contains an unavailable item' using errcode = '22023';
    end if;
  end loop;

  v_cart := public.get_or_create_active_cart();
  insert into public.cart_items(cart_id, commerce_item_id)
  select v_cart.id, li.commerce_item_id from public.commerce_cart_link_items li where li.cart_link_id=v_link.id
  on conflict (cart_id, commerce_item_id) do nothing;

  update public.commerce_cart_links
  set status='claimed', claimed_cart_id=v_cart.id, claimed_at=now()
  where id=v_link.id;
  return v_cart.id;
end;
$$;

-- Paid-order fulfillment is idempotent and snapshots the purchased session entitlement.
create function public.fulfill_paid_private_mentoring_order(p_order_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_item public.order_items;
  v_package public.private_mentoring_packages;
  v_enrollment_id uuid;
begin
  select * into v_order from public.orders where id=p_order_id;
  if not found or v_order.status <> 'paid' then return; end if;

  for v_item in select * from public.order_items where order_id=p_order_id and item_kind_snapshot='private_mentoring' loop
    select * into v_package from public.private_mentoring_packages where id=v_item.commerce_item_id;
    if not found then raise exception 'Paid Private Mentoring package is missing' using errcode = '23503'; end if;

    insert into public.private_mentoring_enrollments(mentee_id, order_item_id, package_id, purchased_sessions)
    values (v_order.user_id, v_item.id, v_package.id, v_package.session_count)
    on conflict (order_item_id) do nothing;

    select id into strict v_enrollment_id from public.private_mentoring_enrollments where order_item_id=v_item.id;
    insert into public.private_mentoring_sessions(enrollment_id, session_number)
    select v_enrollment_id, n from generate_series(1, v_package.session_count) n
    on conflict (enrollment_id, session_number) do nothing;
  end loop;
end;
$$;

create function public.fulfill_paid_private_mentoring_order_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status='paid' then perform public.fulfill_paid_private_mentoring_order(new.id); end if;
  return new;
end;
$$;
create trigger orders_fulfill_private_mentoring after insert or update of status on public.orders for each row when (new.status='paid') execute function public.fulfill_paid_private_mentoring_order_trigger();

create function public.private_mentoring_session_entitlement_guard()
returns trigger language plpgsql set search_path = '' as $$
declare v_purchased integer;
begin
  select purchased_sessions into v_purchased from public.private_mentoring_enrollments where id=new.enrollment_id;
  if new.session_number > v_purchased then raise exception 'Session exceeds purchased entitlement' using errcode = '23514'; end if;
  return new;
end;
$$;
create trigger private_mentoring_session_entitlement_guard before insert or update of enrollment_id, session_number on public.private_mentoring_sessions for each row execute function public.private_mentoring_session_entitlement_guard();

create function public.set_private_mentoring_session_focus(p_session_id uuid, p_focus_id uuid)
returns public.private_mentoring_sessions
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.current_completed_mentee_id();
  v_session public.private_mentoring_sessions;
begin
  if not exists (select 1 from public.private_mentoring_session_focuses where id=p_focus_id and is_active) then
    raise exception 'Active Session Focus required' using errcode = '22023';
  end if;
  select s.* into v_session
  from public.private_mentoring_sessions s
  join public.private_mentoring_enrollments e on e.id=s.enrollment_id
  where s.id=p_session_id and e.mentee_id=v_uid
  for update of s;
  if not found then raise exception 'Private Mentoring session not found' using errcode = '42501'; end if;
  if v_session.status not in ('awaiting_focus','awaiting_scheduling') then raise exception 'Session Focus is operationally locked' using errcode = '22023'; end if;

  update public.private_mentoring_sessions set session_focus_id=p_focus_id, status='awaiting_scheduling' where id=p_session_id returning * into v_session;
  return v_session;
end;
$$;

create function public.admin_schedule_private_mentoring_session(p_session_id uuid, p_mentor_id uuid, p_scheduled_start_at timestamptz)
returns public.private_mentoring_sessions
language plpgsql security definer set search_path = '' as $$
declare
  v_session public.private_mentoring_sessions;
  v_required_tier uuid;
  v_duration integer;
  v_mentor_tier uuid;
  v_mentor_active boolean;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_scheduled_start_at is null then raise exception 'Schedule is required' using errcode = '22023'; end if;

  select s.*, p.mentor_tier_id, p.duration_minutes
  into v_session, v_required_tier, v_duration
  from public.private_mentoring_sessions s
  join public.private_mentoring_enrollments e on e.id=s.enrollment_id
  join public.private_mentoring_packages p on p.id=e.package_id
  where s.id=p_session_id
  for update of s;
  if not found then raise exception 'Private Mentoring session not found' using errcode = '22023'; end if;
  if v_session.session_focus_id is null or v_session.status not in ('awaiting_scheduling','scheduled') then
    raise exception 'Session must have a focus and be schedulable' using errcode = '22023';
  end if;

  select tier_id, is_active into v_mentor_tier, v_mentor_active from public.mentor_profiles where user_id=p_mentor_id;
  if not found or not v_mentor_active then raise exception 'Active mentor required' using errcode = '22023'; end if;
  if v_mentor_tier is distinct from v_required_tier then raise exception 'Mentor tier does not match purchased package' using errcode = '22023'; end if;

  update public.private_mentoring_sessions
  set mentor_id=p_mentor_id,
      scheduled_start_at=p_scheduled_start_at,
      scheduled_end_at=p_scheduled_start_at + make_interval(mins => v_duration),
      status='scheduled'
  where id=p_session_id returning * into v_session;
  return v_session;
end;
$$;

create function public.admin_set_private_mentoring_session_status(p_session_id uuid, p_status text)
returns public.private_mentoring_sessions
language plpgsql security definer set search_path = '' as $$
declare v_session public.private_mentoring_sessions;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_status <> 'completed' then raise exception 'Only completion is supported in Phase 3' using errcode = '22023'; end if;
  select * into v_session from public.private_mentoring_sessions where id=p_session_id for update;
  if not found or v_session.status <> 'scheduled' then raise exception 'Only a scheduled session can be completed' using errcode = '22023'; end if;
  update public.private_mentoring_sessions set status='completed' where id=p_session_id returning * into v_session;
  if not exists (select 1 from public.private_mentoring_sessions where enrollment_id=v_session.enrollment_id and status <> 'completed') then
    update public.private_mentoring_enrollments set status='completed' where id=v_session.enrollment_id;
  end if;
  return v_session;
end;
$$;

create function public.list_my_private_mentoring_sessions()
returns table (
  session_id uuid, enrollment_id uuid, session_number integer, status text,
  session_focus_id uuid, focus_name text, mentor_id uuid, mentor_name text,
  scheduled_start_at timestamptz, scheduled_end_at timestamptz,
  mentor_tier_code text, mentor_tier_name text, package_id uuid, purchased_sessions integer
)
language sql stable security definer set search_path = '' as $$
  select s.id, e.id, s.session_number, s.status, s.session_focus_id, f.name, s.mentor_id,
    nullif(btrim(concat_ws(' ', mp.first_name, mp.last_name)), ''),
    s.scheduled_start_at, s.scheduled_end_at, t.code, t.name, e.package_id, e.purchased_sessions
  from public.private_mentoring_enrollments e
  join public.private_mentoring_sessions s on s.enrollment_id=e.id
  join public.private_mentoring_packages p on p.id=e.package_id
  join public.mentor_tiers t on t.id=p.mentor_tier_id
  left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id
  left join public.profiles mp on mp.id=s.mentor_id
  where e.mentee_id=public.current_completed_mentee_id()
  order by e.created_at desc, e.id, s.session_number;
$$;

create function public.list_admin_private_mentoring_sessions(p_query text default '')
returns table (
  session_id uuid, enrollment_id uuid, mentee_id uuid, mentee_email text, session_number integer, status text,
  session_focus_id uuid, focus_name text, mentor_id uuid, mentor_name text,
  scheduled_start_at timestamptz, scheduled_end_at timestamptz,
  mentor_tier_id uuid, mentor_tier_code text, mentor_tier_name text, purchased_sessions integer
)
language sql stable security definer set search_path = '' as $$
  select s.id, e.id, e.mentee_id, coalesce(u.email,''), s.session_number, s.status, s.session_focus_id, f.name, s.mentor_id,
    nullif(btrim(concat_ws(' ', mentor.first_name, mentor.last_name)), ''), s.scheduled_start_at, s.scheduled_end_at,
    t.id, t.code, t.name, e.purchased_sessions
  from public.private_mentoring_sessions s
  join public.private_mentoring_enrollments e on e.id=s.enrollment_id
  join auth.users u on u.id=e.mentee_id
  join public.private_mentoring_packages p on p.id=e.package_id
  join public.mentor_tiers t on t.id=p.mentor_tier_id
  left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id
  left join public.profiles mentor on mentor.id=s.mentor_id
  where public.is_admin()
    and (btrim(coalesce(p_query,''))='' or concat_ws(' ',u.email,t.name,f.name,mentor.first_name,mentor.last_name) ilike '%' || btrim(p_query) || '%')
  order by e.created_at desc, e.id, s.session_number
  limit 200;
$$;

create function public.list_eligible_private_mentoring_mentors(p_session_id uuid)
returns table (mentor_id uuid, mentor_name text, tier_id uuid, tier_code text, tier_name text)
language sql stable security definer set search_path = '' as $$
  select mp.user_id, coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''), p.username, mp.user_id::text),
    t.id, t.code, t.name
  from public.private_mentoring_sessions s
  join public.private_mentoring_enrollments e on e.id=s.enrollment_id
  join public.private_mentoring_packages pkg on pkg.id=e.package_id
  join public.mentor_profiles mp on mp.tier_id=pkg.mentor_tier_id and mp.is_active
  join public.profiles p on p.id=mp.user_id and p.role='mentor'::public.app_role
  join public.mentor_tiers t on t.id=mp.tier_id
  where public.is_admin() and s.id=p_session_id
  order by p.first_name nulls last, p.last_name nulls last, mp.user_id;
$$;

-- RLS: public editorial/master rows are readable only when active; operational data is never public.
alter table public.competition_categories enable row level security;
alter table public.private_mentoring_programs enable row level security;
alter table public.private_mentoring_highlights enable row level security;
alter table public.private_mentoring_journey_steps enable row level security;
alter table public.private_mentoring_learning_paths enable row level security;
alter table public.private_mentoring_session_focuses enable row level security;
alter table public.private_mentoring_packages enable row level security;
alter table public.commerce_cart_links enable row level security;
alter table public.commerce_cart_link_items enable row level security;
alter table public.private_mentoring_enrollments enable row level security;
alter table public.private_mentoring_sessions enable row level security;

create policy competition_categories_public_read on public.competition_categories for select to anon, authenticated using (is_active or public.is_admin());
create policy private_mentoring_programs_public_read on public.private_mentoring_programs for select to anon, authenticated using (is_active or public.is_admin());
create policy private_mentoring_highlights_public_read on public.private_mentoring_highlights for select to anon, authenticated using (is_active or public.is_admin());
create policy private_mentoring_journey_public_read on public.private_mentoring_journey_steps for select to anon, authenticated using (is_active or public.is_admin());
create policy private_mentoring_learning_paths_public_read on public.private_mentoring_learning_paths for select to anon, authenticated using (is_active or public.is_admin());
create policy private_mentoring_focuses_public_read on public.private_mentoring_session_focuses for select to anon, authenticated using (is_active or public.is_admin());
create policy private_mentoring_packages_public_read on public.private_mentoring_packages for select to anon, authenticated using (is_active or public.is_admin());

create policy competition_categories_admin_insert on public.competition_categories for insert to authenticated with check (public.is_admin());
create policy competition_categories_admin_update on public.competition_categories for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy private_mentoring_programs_admin_insert on public.private_mentoring_programs for insert to authenticated with check (public.is_admin());
create policy private_mentoring_programs_admin_update on public.private_mentoring_programs for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy private_mentoring_highlights_admin_insert on public.private_mentoring_highlights for insert to authenticated with check (public.is_admin());
create policy private_mentoring_highlights_admin_update on public.private_mentoring_highlights for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy private_mentoring_journey_admin_insert on public.private_mentoring_journey_steps for insert to authenticated with check (public.is_admin());
create policy private_mentoring_journey_admin_update on public.private_mentoring_journey_steps for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy private_mentoring_paths_admin_insert on public.private_mentoring_learning_paths for insert to authenticated with check (public.is_admin());
create policy private_mentoring_paths_admin_update on public.private_mentoring_learning_paths for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy private_mentoring_focuses_admin_insert on public.private_mentoring_session_focuses for insert to authenticated with check (public.is_admin());
create policy private_mentoring_focuses_admin_update on public.private_mentoring_session_focuses for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy private_mentoring_packages_admin_insert on public.private_mentoring_packages for insert to authenticated with check (public.is_admin());
create policy private_mentoring_packages_admin_update on public.private_mentoring_packages for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy private_mentoring_enrollments_read on public.private_mentoring_enrollments for select to authenticated using (mentee_id=auth.uid() or public.is_admin());
create policy private_mentoring_sessions_read on public.private_mentoring_sessions for select to authenticated using (
  public.is_admin()
  or mentor_id=auth.uid()
  or exists (select 1 from public.private_mentoring_enrollments e where e.id=enrollment_id and e.mentee_id=auth.uid())
);

-- Active Mentor Tier names are public program/package taxonomy; mutation remains under existing Mentor Domain rules.
create policy mentor_tiers_public_active_read on public.mentor_tiers for select to anon, authenticated using (is_active);
grant select on public.mentor_tiers to anon;

revoke all on public.competition_categories, public.private_mentoring_programs, public.private_mentoring_highlights,
  public.private_mentoring_journey_steps, public.private_mentoring_learning_paths, public.private_mentoring_session_focuses,
  public.private_mentoring_packages, public.commerce_cart_links, public.commerce_cart_link_items,
  public.private_mentoring_enrollments, public.private_mentoring_sessions from anon, authenticated;

grant select on public.competition_categories, public.private_mentoring_programs, public.private_mentoring_highlights,
  public.private_mentoring_journey_steps, public.private_mentoring_learning_paths, public.private_mentoring_session_focuses,
  public.private_mentoring_packages to anon, authenticated;
grant insert, update on public.competition_categories, public.private_mentoring_programs, public.private_mentoring_highlights,
  public.private_mentoring_journey_steps, public.private_mentoring_learning_paths, public.private_mentoring_session_focuses,
  public.private_mentoring_packages to authenticated;
grant select on public.private_mentoring_enrollments, public.private_mentoring_sessions to authenticated;
grant all on public.competition_categories, public.private_mentoring_programs, public.private_mentoring_highlights,
  public.private_mentoring_journey_steps, public.private_mentoring_learning_paths, public.private_mentoring_session_focuses,
  public.private_mentoring_packages, public.commerce_cart_links, public.commerce_cart_link_items,
  public.private_mentoring_enrollments, public.private_mentoring_sessions to service_role;

revoke all on function public.list_cart_link_mentees(text), public.list_purchasable_commerce_items(text),
  public.create_commerce_cart_link(uuid,text,uuid[]), public.list_admin_cart_links(), public.claim_commerce_cart_link(text),
  public.set_private_mentoring_session_focus(uuid,uuid), public.admin_schedule_private_mentoring_session(uuid,uuid,timestamptz),
  public.admin_set_private_mentoring_session_status(uuid,text), public.list_my_private_mentoring_sessions(),
  public.list_admin_private_mentoring_sessions(text), public.list_eligible_private_mentoring_mentors(uuid)
from public, anon, authenticated;

grant execute on function public.list_cart_link_mentees(text), public.list_purchasable_commerce_items(text),
  public.create_commerce_cart_link(uuid,text,uuid[]), public.list_admin_cart_links(), public.claim_commerce_cart_link(text),
  public.set_private_mentoring_session_focus(uuid,uuid), public.admin_schedule_private_mentoring_session(uuid,uuid,timestamptz),
  public.admin_set_private_mentoring_session_status(uuid,text), public.list_my_private_mentoring_sessions(),
  public.list_admin_private_mentoring_sessions(text), public.list_eligible_private_mentoring_mentors(uuid)
to authenticated, service_role;

revoke all on function public.fulfill_paid_private_mentoring_order(uuid) from public, anon, authenticated;
grant execute on function public.fulfill_paid_private_mentoring_order(uuid) to service_role;
