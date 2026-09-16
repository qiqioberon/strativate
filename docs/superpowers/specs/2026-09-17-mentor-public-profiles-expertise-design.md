# Mentor Public Profiles and Expertise Design

**Date:** 2026-09-17  
**Repository:** `qiqioberon/strativate`  
**Branch:** `feat/mentor-public-profiles-expertise`

## Goal

Add database-backed public mentor profiles and Mentor Expertise without mixing public/editorial data into the existing operational `mentor_profiles` domain.

The feature provides:

- one public profile per authenticated mentor account;
- structured achievements;
- normalized Mentor Expertise and many-to-many assignments;
- mentor self-service editing;
- admin expertise management and Draft/Published control;
- public homepage/directory reads from a safe database RPC.

## Domain Boundary

`public.profiles` remains generic account identity. `public.mentor_profiles` remains the operational mentor-account domain for tier, timezone, active status, scheduling, and availability.

`public.mentor_public_profiles` stores only public/editorial profile data. Every row belongs to a real operational mentor account through a required unique `mentor_user_id` foreign key. There is no separate roster ownership/linking subsystem.

## Database Model

### `mentor_public_profiles`

- `id uuid primary key`
- `mentor_user_id uuid not null unique references mentor_profiles(user_id) on delete cascade`
- `public_slug text not null unique`
- `display_name text not null`
- `tier_id uuid null references mentor_tiers(id)`
- `headline text null`
- `linkedin_url text null`
- `short_bio text null`
- `portrait_asset_key text null`
- `portrait_url text null`
- `photo_status text not null default 'missing'`
- `publication_status text not null default 'draft'`
- `sort_order integer not null default 0`
- timestamps

A profile is created only for an existing mentor account and starts as Draft. Mentor self-service cannot change ownership, tier, publication status, or sort order.

### `mentor_public_achievements`

Ordered achievement rows belonging to a public profile. Save replaces the mentor-owned ordered list transactionally.

### `mentor_expertise`

Admin-owned master data with stable UUID, name, stable slug, sort order, active status, and timestamps. Case-insensitive name uniqueness prevents duplicate labels. Rename preserves slug.

### `mentor_public_profile_expertise`

Many-to-many junction between a mentor public profile and expertise. Referenced expertise cannot be hard-deleted; it can be deactivated instead.

## Migration Data

The migration seeds **only** the eight agreed Mentor Expertise master values:

1. Lintas kategori kompetisi
2. Business Plan
3. Business Case
4. Marketing
5. Finance
6. Economics
7. Accounting
8. Proposal Development

The migration does **not** seed, import, copy, or infer any mentor/person roster. Existing hardcoded mentor content is not automatically inserted into Supabase. A public profile is created only from a real mentor account through the mentor/admin workflow.

Because `202609170001_mentor_public_profiles_expertise.sql` has not been applied to hosted Supabase yet, this correction edits that pending migration directly; no corrective migration is required.

## Mutation API

### Mentor

`get_my_mentor_public_profile()` reads the authenticated mentor's profile/editor options.

`save_my_mentor_public_profile(...)`:

- requires an active authenticated mentor account;
- creates that account's Draft profile when missing;
- updates mentor-controlled fields only;
- validates URLs, achievements, and expertise selections;
- permits an already-assigned inactive expertise to remain or be removed;
- never changes publication status, tier, sort order, or ownership.

### Admin

Admin RPCs:

- create/update/reorder/activate/deactivate/safely delete expertise;
- ensure a Draft public profile exists for a selected mentor account;
- set that mentor account's public profile to Draft or Published.

No account-linking RPC is needed because ownership is established when the profile is created.

## Security

All new tables enable RLS. Direct browser reads are limited to admin/self requirements; writes happen through scoped RPCs.

`list_public_mentors()` is the public boundary and returns only explicit published fields. It never returns account IDs, email, WhatsApp, auth metadata, timezone, availability, active-account state, or Draft profiles.

## Runtime Integration

`app/mentor/page.tsx` and `app/page.tsx` load published profiles through the server-only `listPublishedMentors()` helper. The public UI keeps its existing card, filter, modal, and marquee presentation as much as possible.

`lib/content/mentors.ts` must not be a production runtime source after the DB integration. Bundled media metadata may remain in the asset registry; it is not a mentor roster source of truth.

## Mentor UX

The mentor Profile section remains split into:

1. Account Information
2. Public Mentor Profile
3. Operational Mentor Status

The public-profile editor supports display name, headline, LinkedIn, bio, portrait URL, expertise, and ordered achievements. Layout must remain contained without horizontal overflow on mobile.

## Admin UX

Admin Data master adds Mentor Expertise with responsive management rows/cards and a centered, internally scrollable create/edit dialog.

Existing Mentor Management gets publication controls for the selected mentor account. If no public profile exists, admin can create its Draft directly; there is no roster matching/linking UI.

## Deployment Safety

Apply `202609170001_mentor_public_profiles_expertise.sql` to hosted Supabase before deploying application code that expects the new tables/RPCs.

The migration is currently unapplied, so it is safe to correct it in place before deployment.

## Verification

Required checks include:

- exactly eight expertise seed rows;
- no mentor/person seed data in the migration;
- required `mentor_user_id` ownership;
- Draft-by-default profile creation;
- RLS/RPC/public-field boundaries;
- mentor self-service and admin expertise/publication behavior;
- production runtime no longer imports the hardcoded mentor roster;
- responsive/no-horizontal-overflow browser checks;
- repository `test`, `typecheck`, `lint`, `build`, and relevant Playwright suites.

Do not merge until CI provides fresh evidence for the repository checks.
