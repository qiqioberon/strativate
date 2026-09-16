# Mentor Public Profiles and Expertise Design

**Date:** 2026-09-17  
**Repository:** `qiqioberon/strativate`  
**Base:** `main` at `2294f967f962cdb5fb1cef17d5460b28882abf3c`  
**Branch:** `feat/mentor-public-profiles-expertise`

## 1. Goal

Move the approved public mentor roster and mentor expertise out of hardcoded frontend business data and into a normalized, security-scoped Supabase domain, while preserving the existing public mentor card/directory presentation and the existing operational mentor/account model.

The feature adds:

- database-backed public mentor profiles;
- structured mentor achievements;
- normalized mentor expertise master data;
- mentor-to-expertise many-to-many assignments;
- mentor self-service public-profile editing;
- admin expertise management and mentor publication control;
- database-backed homepage/directory mentor rendering;
- safe migration of the current 26 approved public mentor records without inventing account ownership.

## 2. Existing Architecture and Boundary

`public.profiles` remains the generic account identity table. The existing `public.mentor_profiles` table is already the canonical **operational mentor-account domain**: its primary key is `user_id`, it requires an authenticated mentor account, and it owns tier/timezone/account-lifecycle relationships used by scheduling and availability.

It must not be repurposed into the public marketing roster because the approved public roster contains entries that may not yet correspond to authenticated mentor accounts.

Therefore public presentation data gets its own domain rather than overloading either `profiles` or operational `mentor_profiles`.

## 3. Approaches Considered

### A. Extend operational `mentor_profiles` — rejected

This would force every public roster entry to have an authenticated mentor account and would mix scheduling/account lifecycle with editorial public-profile state. It also risks inventing ownership mappings for existing mentor records.

### B. Dedicated public-profile domain with nullable account ownership — selected

Create `mentor_public_profiles` with its own UUID identity and an optional unique `mentor_user_id` link to the operational mentor account. Existing approved roster entries can remain valid public records with no account owner; an authenticated mentor can own at most one linked public profile.

Advantages:

- preserves all approved legacy directory data;
- no inferred account mapping;
- clean separation of account identity, operational mentor state, and public marketing state;
- supports draft/published publication lifecycle;
- supports future explicit account-linking without data migration churn.

### C. Keep hardcoded roster as fallback/source alongside DB — rejected

This creates two writable sources of truth and makes publication/security behavior ambiguous. Once the migration is deployed, database records are authoritative. Static code remains only for media asset registry metadata where required.

## 4. Database Model

### 4.1 `mentor_public_profiles`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `mentor_user_id uuid null unique references mentor_profiles(user_id) on delete set null`
- `public_slug text not null unique`
- `display_name text not null`
- `tier_id uuid null references mentor_tiers(id) on delete restrict`
- `headline text null`
- `linkedin_url text null`
- `short_bio text null`
- `portrait_asset_key text null`
- `portrait_url text null`
- `photo_status text not null default 'missing' check in ('ready','missing')`
- `publication_status text not null default 'draft' check in ('draft','published')`
- `sort_order integer not null default 0`
- timestamps with the repository's `touch_updated_at()` trigger

`mentor_user_id` is the ownership link. It is intentionally nullable for imported public mentor records. No name/email matching is performed automatically.

`tier_id`, `publication_status`, and `sort_order` are admin-controlled. Mentor self-service RPCs cannot mutate them.

### 4.2 `mentor_public_achievements`

Structured repeatable public credentials/achievements:

- `id uuid primary key`
- `mentor_public_profile_id uuid not null references mentor_public_profiles(id) on delete cascade`
- `achievement text not null`
- `sort_order integer not null`
- timestamps

Achievement content is trimmed and length-constrained. UI reorder uses move-up/move-down; save RPC rewrites the owned ordered list transactionally.

### 4.3 `mentor_expertise`

Normalized admin-owned master data:

- `id uuid primary key`
- `name text not null`
- `slug text not null unique`
- `sort_order integer not null`
- `is_active boolean not null default true`
- timestamps

Name is trimmed; a case-insensitive unique index prevents duplicate labels. Slug is generated once at creation and remains unchanged during rename so relationships and external identity are stable.

### 4.4 `mentor_public_profile_expertise`

- `mentor_public_profile_id uuid references mentor_public_profiles(id) on delete cascade`
- `expertise_id uuid references mentor_expertise(id) on delete restrict`
- `created_at timestamptz`
- composite primary key `(mentor_public_profile_id, expertise_id)`

Hard deletion of expertise is blocked while referenced. Deactivation does not detach existing mentor assignments.

## 5. Initial Data Migration

Seed the eight approved expertise values with deterministic UUIDs and stable slugs:

1. Lintas kategori kompetisi — `lintas-kategori-kompetisi`
2. Business Plan — `business-plan`
3. Business Case — `business-case`
4. Marketing — `marketing`
5. Finance — `finance`
6. Economics — `economics`
7. Accounting — `accounting`
8. Proposal Development — `proposal-development`

Seed operations use stable unique slugs/IDs and conflict-safe inserts so re-execution does not duplicate records.

Migrate all 26 approved records currently represented in `lib/content/mentors.ts` into `mentor_public_profiles` as published public records with `mentor_user_id = null`. Preserve:

- slug;
- public display name;
- tier mapping by canonical `mentor_tiers` value where supplied;
- headline/title;
- LinkedIn URL;
- portrait asset key and photo status;
- current ordering;
- achievements/credentials;
- expertise assignments.

Do not infer an authenticated account owner from name, slug, LinkedIn, email, or any other heuristic.

The existing asset registry remains the authoritative mapping for current bundled portrait files/fallbacks. `portrait_asset_key` preserves that compatibility. `portrait_url` is available for linked mentor-managed external/storage URLs without forcing an image-upload subsystem into this task.

## 6. Ownership and Mutation API

### Mentor

Mentors use a security-definer RPC such as `save_my_mentor_public_profile(...)` rather than broad table update grants. The RPC:

- requires `auth.uid()` to be a current active operational mentor;
- finds or creates that account's linked draft public profile;
- allows edits only to mentor-controlled fields: display name, headline, LinkedIn, short bio, portrait URL, achievements, and expertise assignments;
- never changes tier, publication status, sort order, or ownership;
- accepts only active expertise as new assignments;
- permits already-assigned inactive expertise to remain or be removed, so historical assignments do not disappear.

A read RPC/query returns the mentor's own profile plus assigned expertise/achievements and the expertise selection list (active master rows plus any inactive rows already assigned).

### Admin

Admin RPCs own sensitive lifecycle operations:

- upsert expertise master row;
- reorder expertise;
- safely delete unused expertise or return a `deactivate_required` result when referenced;
- activate/deactivate expertise;
- set a linked mentor profile's publication status;
- ensure a linked draft public profile exists when an admin wants to manage publication before the mentor has edited it.

Admin publication control is integrated into the existing Mentor Management detail flow rather than creating a second mentor-account management page.

## 7. RLS and Grants

All new tables enable RLS.

Direct browser table privileges remain narrow:

- service role: full access per repository convention;
- admin authenticated users: read according to admin policies; mutations happen through admin RPCs;
- mentor authenticated users: read only their linked public profile/children plus expertise needed for their selector; mutations happen through own-profile RPCs;
- anonymous users: no direct table mutation and no access to account/private profile tables.

Public directory rendering uses a dedicated safe function `list_public_mentors()` returning only explicit public columns for `publication_status = 'published'`. It never returns email, WhatsApp, auth metadata, operational availability, mentor-user ownership IDs, or unpublished records.

The public RPC may return inactive expertise still assigned to a published mentor so deactivation does not silently rewrite historical public data. Deactivation only prevents new mentor selection.

## 8. Runtime Types and Query Layer

Add clear mentor-public domain types under `lib/mentor/public-profile.ts` and update `lib/supabase/database.types.ts` for new tables/RPCs.

The public server helper follows the existing marketing server-query pattern: server-only Supabase publishable client, safe RPC, explicit DTO mapping, and an intentional empty list on query failure. No service-role credential is used to render public pages.

Public mentor DTO keeps the current card needs stable:

- slug/name/tier/headline;
- achievements;
- expertise;
- LinkedIn;
- public portrait asset key or URL;
- photo status;
- optional short bio.

## 9. Public Marketing Integration

`app/mentor/page.tsx` becomes async and loads published mentors from the database before rendering `MentorDirectory`.

`app/page.tsx` loads published mentors alongside hero posters and other public data and passes them to `HomePage`/`MentorMarquee`.

The existing MentorDirectory, card, marquee, and detail modal visual structure remains substantially unchanged. Their type import moves from hardcoded content to the public mentor DTO. Media rendering is extended only enough to support either the current asset-registry key or an explicit public portrait URL.

After database integration is complete, `lib/content/mentors.ts` is no longer imported by production runtime and is removed/demoted so it cannot remain a second source of truth.

## 10. Mentor Profile Management UX

The existing account `ProfileForm` remains intact.

The Mentor Profile page becomes three clear cards instead of one giant form:

1. **Account Information** — existing `ProfileForm` behavior unchanged.
2. **Public Mentor Profile** — read-only summary with an edit action, then a contained edit form for public fields/expertise/achievements.
3. **Operational Mentor Status** — existing tier/timezone/account/availability information remains read-only.

The public-profile form:

- uses responsive two-column fields only where useful and collapses to one column;
- renders expertise as a scalable checkbox list with wrapping labels;
- shows assigned inactive expertise with an explicit inactive status;
- supports achievement add/edit/remove and move-up/move-down actions;
- contains long URLs/text with `min-width: 0` and `overflow-wrap: anywhere`;
- preserves stable card geometry and scoped error/success states.

## 11. Admin Expertise UX

Add **Mentor Expertise** under Admin **Data master**.

Reuse existing surface/toolbar language but use a dedicated responsive row/card layout instead of a wide desktop-only table. Each row exposes name, stable slug, status, order, edit, and safe delete/deactivate behavior.

At narrow widths the row stacks naturally; the page never requires horizontal scrolling. The create/edit dialog is explicitly centered and constrained to `calc(100vw - mobile spacing)` and `calc(100dvh - vertical spacing)` with internal scroll when needed.

## 12. CSS Safety

New styling is locally scoped to mentor-public-profile and mentor-expertise surfaces. Do not add broad `dialog`, `form`, `table`, or `input` selectors.

Required invariants:

- all relevant grid/flex children have `min-width: 0`;
- user-generated text uses safe wrapping;
- no rigid responsive page widths;
- no `overflow: hidden` used to conceal broken geometry;
- no page-level horizontal overflow at 360px or larger;
- buttons/actions can wrap or stack rather than escape cards.

## 13. Error and Empty States

- no expertise configured: explicit empty state;
- mentor has no expertise: explicit `No expertise selected` state;
- no published mentors: directory renders its existing-style intentional empty state instead of crashing;
- DB query errors stay contained and do not expose backend details;
- public query failure does not fall back to hardcoded roster because the DB is the sole runtime source after migration.

## 14. Deployment / Migration Safety

Create a new forward migration `202609170001_mentor_public_profiles_expertise.sql`; never edit historical migrations.

The hosted Supabase project must receive this migration before deploying code that switches public mentor queries to the database. Otherwise the public query safely returns no mentor data, but the production roster would temporarily disappear.

The PR must explicitly call out this deployment order and manual hosted-Supabase migration requirement if automated migration deployment is not present.

## 15. Verification

Add tests for:

- exact eight expertise seeds and no duplicate seed identities;
- schema constraints, FKs, RLS, grants, and RPC boundaries;
- admin expertise create/rename/reorder/activation/deactivation/safe deletion;
- mentor own-profile save and cross-mentor denial;
- inactive expertise retention behavior;
- achievements persistence/order;
- published-only public query and absence of private account fields;
- 26-record migration preservation;
- production runtime no longer imports the hardcoded mentor roster;
- public directory/homepage receive database mentor DTOs;
- admin expertise and mentor profile layout stability at 360×740, 390×844, 768×1024, 1024×768, 1366×768, 1440×900, and a wide desktop;
- `document.documentElement.scrollWidth <= window.innerWidth` at required viewports;
- existing auth, scheduling, mentor management, profile management, marketing, and dashboard regressions.

Final commands:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
```

Use focused Playwright suites where the complete suite requires hosted dependencies not available in CI, but report exactly what was and was not executed.

## 16. Git / PR

Use meaningful logical batches, not micro-commits:

1. design/plan documentation;
2. database/domain migration + types/security;
3. mentor/admin/public UI integration + scoped styling;
4. tests/docs/final fixes as a verification batch where needed.

Open a PR into `main`; do not merge it. PR notes must include migration deployment order, RLS boundary, layout verification, test results, and known limitations.