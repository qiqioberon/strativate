# Mentor Public Profiles and Expertise Implementation Plan

**Goal:** Add mentor-owned public profiles and Mentor Expertise with the smallest architecture needed: account-owned Draft profiles, mentor self-service editing, admin expertise/publication controls, and a public-safe database query.

**Architecture:** Keep operational `mentor_profiles` unchanged. Add `mentor_public_profiles` as a 1:1 extension whose `mentor_user_id` is required and unique. The migration seeds only Mentor Expertise master data; it never seeds mentor people or creates a legacy roster/linking system.

**Spec:** `docs/superpowers/specs/2026-09-17-mentor-public-profiles-expertise-design.md`

## Constraints

- Do not infer or import mentor-person data in SQL.
- Public profiles are created only for real mentor accounts and default to Draft.
- Mentor writes use own-profile RPCs; admin controls expertise and publication.
- Public reads expose only published public fields.
- Keep existing public mentor presentation stable where practical.
- Keep new CSS scoped and prevent page-level horizontal overflow at 360px+.
- Use cohesive batch commits rather than micro-commits.
- Apply the pending Supabase migration before deploying runtime code that depends on it.

## Task 1 — Contract tests first

Update `tests/mentor-public-profile-domain.test.ts` and `tests/mentor-public-runtime.test.ts` to require:

- four normalized mentor-public/expertise tables;
- eight exact expertise seeds;
- no mentor roster/person seed block;
- required unique `mentor_user_id` FK to `mentor_profiles`;
- Draft-by-default creation;
- no account-linking subsystem;
- public RPC signature excludes private account fields;
- public pages use the DB-backed helper;
- mentor dashboard and admin expertise/publication surfaces are wired.

## Task 2 — Database domain

Edit the still-unapplied `supabase/migrations/202609170001_mentor_public_profiles_expertise.sql` in place:

- create public profile, achievement, expertise, and junction tables;
- make `mentor_user_id` `NOT NULL UNIQUE` with FK to `mentor_profiles(user_id)`;
- seed only the eight expertise master rows;
- create/get/save a mentor account's Draft profile;
- add admin expertise and publication RPCs;
- add `list_public_mentors()` with explicit safe fields;
- add RLS and grants;
- do not seed mentor people and do not add a profile-linking RPC.

Update `lib/supabase/database.types.ts` to match the corrected schema/RPC surface.

## Task 3 — Public runtime

Use the server-only public mentor query helper from `/mentor` and homepage. Keep card/filter/modal/marquee structure stable and do not fall back to a hardcoded runtime roster on DB failure.

## Task 4 — Mentor public-profile editor

Keep Account Information and Operational Mentor Status intact. Add Public Mentor Profile editing for display name, headline, LinkedIn, bio, portrait URL, expertise, and ordered achievements. Save through `save_my_mentor_public_profile` only.

## Task 5 — Admin management

Add responsive Mentor Expertise management under Data master and publication control in existing Mentor Management. Admin can create the selected mentor account's Draft profile and change Draft/Published status. There is no roster linking flow.

## Task 6 — Regression/docs

Update source-of-truth docs and deterministic browser fixtures/specs. Cover 360, 390, 768, 1024, 1366, 1440, and 1920 widths where applicable, modal bounds, and `document.documentElement.scrollWidth <= window.innerWidth`.

## Task 7 — Verification and PR

Run/fix until green:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
```

Use PR #42 as the verification surface. Do not merge automatically. If local dependency execution is unavailable, report that limitation and use CI as the fresh verification evidence.
