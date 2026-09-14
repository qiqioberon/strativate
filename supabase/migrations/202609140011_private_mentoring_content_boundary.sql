-- Correct Phase 3 ownership: Private Mentoring marketing/editorial content belongs to source code,
-- while catalog, operational, and Shared Commerce data remain database-owned.

-- Shared Commerce must resolve Private Mentoring packages without depending on a marketing CMS row.
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
    'Private Mentoring package'::text,
    null::text,
    p.price_amount,
    (ci.is_available and p.is_active and t.is_active)
  from public.commerce_items ci
  join public.private_mentoring_packages p on p.id = ci.id
  join public.mentor_tiers t on t.id = p.mentor_tier_id
  where ci.id = p_commerce_item_id and ci.item_kind = 'private_mentoring';
$$;

-- Learning paths and session topics are true Private Mentoring catalog masters. They no longer need
-- a parent marketing-program row because Private Mentoring is a single explicit domain in Phase 3.
alter table public.private_mentoring_learning_paths
  drop constraint if exists private_mentoring_learning_paths_program_id_fkey;
alter table public.private_mentoring_learning_paths
  drop column if exists program_id;

alter table public.private_mentoring_session_focuses
  drop constraint if exists private_mentoring_session_focuses_program_id_fkey;
alter table public.private_mentoring_session_focuses
  drop column if exists program_id;

-- These tables existed only to make static website copy database-editable. No runtime or admin path
-- should depend on them after this migration.
drop table if exists public.private_mentoring_journey_steps;
drop table if exists public.private_mentoring_highlights;
drop table if exists public.private_mentoring_programs;
