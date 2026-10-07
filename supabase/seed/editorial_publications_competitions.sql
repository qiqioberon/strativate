-- Strativate editorial demo seed
-- Purpose: populate Publications + Competitions with safe, clearly-labelled demo content.
-- Safe to run more than once: rows are upserted by slug and taxonomy rows are only added when missing.
-- Workflow flags (publish/featured/order), uploaded cover metadata, and crop/source metadata are not overwritten on rerun.
--
-- Prerequisites:
--   - supabase/migrations/202609250001_publications_competitions.sql
--   - supabase/migrations/202610040005_editorial_experience_overhaul.sql
--   - supabase/migrations/202610040009_photo_crop_sources.sql
--
-- All seeded editorial rows start as drafts. Publish them from Admin when you intentionally want them public.

begin;

do $$
begin
  if to_regclass('public.publications') is null
     or to_regclass('public.competitions') is null
     or to_regclass('public.publication_categories') is null
     or to_regclass('public.competition_categories') is null then
    raise exception 'Editorial schema is incomplete. Apply the latest Strativate Supabase migrations before running this seed.';
  end if;
end
$$;

-- Publication taxonomy used by the demo articles.
with desired(name, position) as (
  values
    ('Competition Strategy', 1),
    ('Research & Insight', 2),
    ('Pitching & Communication', 3),
    ('Career Growth', 4)
),
base as (
  select coalesce(max(sort_order), 0) as max_sort_order
  from public.publication_categories
)
insert into public.publication_categories (name, sort_order, is_active)
select desired.name, base.max_sort_order + desired.position, true
from desired
cross join base
where not exists (
  select 1
  from public.publication_categories existing
  where lower(existing.name) = lower(desired.name)
);

-- Demo Publications.
with seed (
  slug,
  title,
  excerpt,
  body,
  category_name,
  published_at,
  default_featured,
  default_sort_order
) as (
  values
    (
      'demo-structure-a-winning-business-case',
      '[Demo] How to Structure a Winning Business Case',
      'A practical framework for turning an ambiguous case prompt into a clear, evidence-backed recommendation.',
      'Strong business cases usually begin with a precise problem statement, a small set of decision criteria, and a structured path from evidence to recommendation. Start by clarifying the objective, identify the few drivers that matter most, test assumptions with available data, and make the final recommendation explicit. The goal is not to show every analysis performed, but to make the logic easy to follow and defend.',
      'Competition Strategy',
      date '2026-10-01',
      true,
      1
    ),
    (
      'demo-research-from-data-to-insight',
      '[Demo] From Raw Data to Useful Insight',
      'How to move from collecting information to identifying the few insights that actually change a decision.',
      'Research becomes useful when it answers a decision, not when it simply produces more information. Define the question first, separate facts from assumptions, compare multiple signals, and write each insight as a complete statement with an implication. A useful insight should tell the reader what is happening, why it matters, and what should be considered next.',
      'Research & Insight',
      date '2026-09-28',
      false,
      2
    ),
    (
      'demo-pitch-deck-storytelling',
      '[Demo] Building a Pitch Deck That Tells One Story',
      'A simple way to make every slide support the same argument instead of feeling like separate pieces.',
      'A strong pitch deck has one narrative spine. Open with the problem and why it matters, show the evidence, explain the proposed solution, demonstrate why the solution is credible, and close with a clear recommendation or ask. Each slide should answer one question and make the next slide feel inevitable.',
      'Pitching & Communication',
      date '2026-09-22',
      true,
      3
    ),
    (
      'demo-competition-preparation-roadmap',
      '[Demo] A Four-Stage Competition Preparation Roadmap',
      'Plan competition work around diagnosis, solution design, validation, and delivery instead of last-minute slide production.',
      'A reliable preparation process can be divided into four stages: understand the brief, design the solution, validate the logic, and prepare the delivery. Set a decision deadline for each stage so the team does not keep reopening settled questions. Reserve the final stretch for communication quality, rehearsal, and challenge-response practice.',
      'Competition Strategy',
      date '2026-09-15',
      false,
      4
    ),
    (
      'demo-turn-feedback-into-action',
      '[Demo] Turning Mentor Feedback Into Better Work',
      'Use feedback as a decision system: clarify the issue, identify the underlying pattern, then convert it into one concrete revision.',
      'Feedback is easiest to act on when it is translated into a specific decision. Separate comments about logic, evidence, and communication. For each comment, write the underlying issue and the exact change that would resolve it. This prevents teams from applying surface-level edits while leaving the original problem untouched.',
      'Career Growth',
      date '2026-09-08',
      false,
      5
    ),
    (
      'demo-presenting-under-pressure',
      '[Demo] Presenting Under Pressure Without Losing Structure',
      'A compact method for keeping an answer clear when judges or stakeholders challenge the recommendation.',
      'Pressure often makes answers longer and less structured. Use a three-part response: answer the question directly, give the strongest supporting reason, then add one piece of evidence or qualification. If the question exposes a real weakness, acknowledge it and explain the mitigation rather than trying to defend every assumption.',
      'Pitching & Communication',
      date '2026-09-01',
      false,
      6
    )
)
insert into public.publications (
  slug,
  title,
  excerpt,
  body,
  body_json,
  category_id,
  published_at,
  is_published,
  is_featured,
  sort_order
)
select
  seed.slug,
  seed.title,
  seed.excerpt,
  seed.body,
  jsonb_build_object(
    'version', 1,
    'blocks', jsonb_build_array(
      jsonb_build_object(
        'type', 'paragraph',
        'align', 'left',
        'content', jsonb_build_array(jsonb_build_object('text', seed.body))
      )
    )
  ),
  (
    select category.id
    from public.publication_categories category
    where lower(category.name) = lower(seed.category_name)
    limit 1
  ),
  seed.published_at,
  false,
  seed.default_featured,
  seed.default_sort_order
from seed
on conflict (slug) do update
set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  body_json = excluded.body_json,
  category_id = excluded.category_id,
  published_at = excluded.published_at;

-- Demo Competitions.
-- Existing shared competition categories are referenced by slug; if a category is absent,
-- category_id safely remains null because the column is nullable.
with seed (
  slug,
  name,
  category_slug,
  description,
  rules_url,
  registration_url,
  registration_deadline,
  default_status,
  default_featured,
  default_sort_order
) as (
  values
    (
      'demo-strativate-business-case-challenge-2026',
      '[Demo] Strativate Business Case Challenge 2026',
      'business-case-competition',
      'A demo business-case listing for validating the public competition directory, detail page, filters, badges, deadlines, and admin workflow.',
      'https://example.com/strativate-demo/business-case/rules',
      'https://example.com/strativate-demo/business-case/register',
      date '2026-11-15',
      'open',
      true,
      1
    ),
    (
      'demo-strativate-business-plan-sprint-2026',
      '[Demo] Strativate Business Plan Sprint 2026',
      'business-plan-competition',
      'A demo business-plan competition record intended for development and editorial UI validation.',
      'https://example.com/strativate-demo/business-plan/rules',
      'https://example.com/strativate-demo/business-plan/register',
      date '2026-11-30',
      'open',
      false,
      2
    ),
    (
      'demo-strativate-scientific-paper-challenge-2027',
      '[Demo] Strativate Scientific Paper Challenge 2027',
      'scientific-paper-competition',
      'A demo scientific-paper listing with a future deadline so upcoming-state presentation can be reviewed.',
      'https://example.com/strativate-demo/scientific-paper/rules',
      'https://example.com/strativate-demo/scientific-paper/register',
      date '2027-01-10',
      'upcoming',
      true,
      3
    ),
    (
      'demo-strativate-marketing-strategy-challenge-2027',
      '[Demo] Strativate Marketing Strategy Challenge 2027',
      'marketing-competition',
      'A demo marketing competition record for checking category rendering and competition detail hierarchy.',
      'https://example.com/strativate-demo/marketing/rules',
      'https://example.com/strativate-demo/marketing/register',
      date '2027-02-05',
      'upcoming',
      false,
      4
    ),
    (
      'demo-strativate-case-sprint-closed',
      '[Demo] Strativate Case Sprint — Closed Example',
      'business-case-competition',
      'A deliberately closed demo record for reviewing closed-state badges and CTA behavior.',
      'https://example.com/strativate-demo/closed-case/rules',
      null,
      date '2026-09-20',
      'closed',
      false,
      5
    ),
    (
      'demo-strativate-archived-competition',
      '[Demo] Strativate Archived Competition',
      'business-plan-competition',
      'A deliberately archived demo record for checking admin filters and non-active competition states.',
      null,
      null,
      date '2026-08-15',
      'archived',
      false,
      6
    )
)
insert into public.competitions (
  slug,
  name,
  category_id,
  description,
  rules_url,
  registration_url,
  registration_deadline,
  status,
  is_published,
  is_featured,
  sort_order
)
select
  seed.slug,
  seed.name,
  (
    select category.id
    from public.competition_categories category
    where category.slug = seed.category_slug
    limit 1
  ),
  seed.description,
  seed.rules_url,
  seed.registration_url,
  seed.registration_deadline,
  seed.default_status,
  false,
  seed.default_featured,
  seed.default_sort_order
from seed
on conflict (slug) do update
set
  name = excluded.name,
  category_id = excluded.category_id,
  description = excluded.description,
  rules_url = excluded.rules_url,
  registration_url = excluded.registration_url,
  registration_deadline = excluded.registration_deadline;

commit;

-- Verification:
-- select slug, title, is_published, is_featured, sort_order
-- from public.publications
-- where slug like 'demo-%'
-- order by sort_order;
--
-- select slug, name, status, is_published, is_featured, sort_order
-- from public.competitions
-- where slug like 'demo-%'
-- order by sort_order;
