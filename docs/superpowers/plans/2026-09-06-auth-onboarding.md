# Supabase authentication and onboarding implementation plan

**Goal:** Connect the existing Strativate UI to persistent Supabase authentication, role authorization, onboarding, and minimum administration.

**Architecture:** Next.js App Router with @supabase/ssr cookies and verified users, server layouts for route authorization, Postgres RLS and controlled transactional RPCs. Next.js server actions host mentor invitation credentials; browser data operations use the public key and RLS.

**Tech stack:** Existing Next.js 16, React 19, TypeScript, pnpm, Supabase Auth/Postgres. Node tests via tsx; SQL integration tests against real Postgres semantics.

**Spec:** User attachment `C:/Users/DELL/.codex/attachments/fb8792a2-b32b-48a6-98be-0eed62389cf5/pasted-text.txt`.

## Constraints and inspection

- Preserve existing layout/CSS and dashboard routes `/admin`, `/mentor`, `/dashboard`; shared login `/auth`.
- This checkout has no onboarding/register components, Supabase client, migrations, or tests. Add four steps using existing visual language.
- Public registration creates only mentee. Never use user metadata for roles. Profile and completion flags require trusted writes.
- CSV found at `../institution_scraper/outputs/institutions_all.csv`, 3479 data rows. Copy into `supabase/seed/` for reproducible import.
- Retain unrelated product/payment/session demo data. Remove demo identity and public role switching.
- Preserve user's existing `.gitignore` changes; never print or commit secrets.

## Task 1: Database security and persistence

Files: `supabase/migrations/202609060001_auth_onboarding.sql`, `supabase/tests/auth_security.sql`, `lib/supabase/database.types.ts`.

- [x] Write security tests for role escalation, visibility, master mutations, transactional completion and invitation role creation.
- [x] Add app_role, institution enums; profiles, mentee_profiles, institutions, referral_sources, interests, mentee_interests; trusted mentor_invites registry.
- [x] Create trusted profile bootstrap ignoring role metadata. An admin-authorized invitation registry keyed by normalized email is consumed by auth-user insert trigger so mentor role assignment precedes invitation acceptance.
- [x] Enable RLS, minimal column grants, safe definer search paths; protect role, registration method, setup completion and onboarding completion from arbitrary client writes.
- [x] RPC contracts: save_onboarding_step(p_step integer,p_data jsonb) returns mentee_profiles; submit_institution(p_name text,p_type institution_type) returns institutions; search_institutions(p_query text) returns setof institutions; complete_mentor_setup(p_first_name text,p_last_name text,p_username text) returns profiles; merge_institutions(p_from uuid,p_into uuid) admin-only.
- [x] Step 1 validates name/username and existing auth password for email accounts; step 2 saves institution, major/cohort; step 3 saves one referral; step 4 atomically saves interests/custom text and completion. Later steps reject skipped prerequisites. Re-saving earlier steps never regresses persisted progress.
- [x] Tests execute as anon/authenticated users with actual RLS; export typed table and RPC interfaces.

## Task 2: Authentication and route integration

Files: `lib/supabase/{client,server,admin}.ts`, `lib/auth/*`, `proxy.ts`, `app/auth/*`, protected layouts, `components/auth/*`.

- [x] Test role destination and input validation; run failure before implementation.
- [x] Centralize browser/server/admin clients, refresh cookies, verify getUser server-side.
- [x] Replace `/auth` role selector with email/password and Google; add registration email OTP mode. Callback exchanges code or verifies allowlisted token_hash types with fixed role routing.
- [x] Server guards and client auth event refresh; expose real profile to preserved dashboard shells. Logout invalidates Supabase session. Invited mentor must complete setup before dashboard.
- [x] Trusted mentor invitation action checks admin, inserts registry, uses inviteUserByEmail, checks resulting mentor profile, records state; handle retries without promoting existing public users.

## Task 3: Onboarding UI

Files: `app/onboarding/page.tsx`, `components/onboarding/*`, `lib/onboarding/*`.

- [x] Load saved data and active master options from database; persist only via RPC.
- [x] Step 1 updateUser password before profile RPC; Google optional password and reliable prefill.
- [x] Institution combobox: min 2 chars, 300 ms debounce, database limit 25, keyboard handling, pending personal submissions, useful errors.
- [x] Save referral, multiple interests and optional personal other text; only navigate after successful write. Resume after refresh/logout.

## Task 4: Administration and importer

Files: `components/admin/*`, existing `app/admin/page.tsx`, `scripts/import-institutions*`, tests, `docs/supabase-setup.md`.

- [x] Extend Mentors tab for invitations and profile list; real Mentees list.
- [x] Add institution search/filter/moderation/edit/archive and explicit duplicate resolution.
- [x] Add referral and interest create/edit/order/archive, backed by RLS.
- [x] Import CSV with parser, validated nullable columns, preserved source identity, batch upsert without overwriting submissions, accurate dry-run and mutation counts, idempotence tests.
- [x] Document exact config, bootstrap SQL, commands and manual email/Google/invite test paths.

## Task 5: Verification and review

- [x] Typecheck, lint, unit/integration tests, production build. Remove ignoreBuildErrors and fix existing type failures encountered.
- [x] Validate migration and attack tests using local Postgres/Supabase if available; external config blockers must be recorded honestly.
- [x] Browser check login/register, guards, onboarding and admin where authenticated test infrastructure permits.
- [x] Review all changes against user spec, inspect browser bundles for secret absence, document measured import/test outcomes and remaining manual setup.

## Execution record

Ruling: Implement source changes in the shared checkout requested by the user. No commit/push/deploy without need; retain unrelated changes.
Ruling: Next.js server actions provide the existing-framework trusted backend; no extra Edge Function deployment required.
Ruling: No onboarding design exists in this checkout. Reuse auth shell and existing editor/form visual styles.

## Verification record

- Source tasks complete; no commits or deployments.
- Fresh PostgreSQL 17 migration plus auth_security and institution_import suites passed. Auth suite has 94 checks.
- Import CLI: 3479 inserted; repeat 3479 skipped with zero updates/errors. Hosted import not run.
- Unit tests: 14 passed. Browser public-auth tests: 10 passed. Production build/typecheck passed. Lint: zero errors; nine warnings in unchanged landing page.
- Review fixed duplicate institution acknowledgement, Unicode normalizer alignment, intentional blank Google surname, and importer race accounting.
- Hosted validation still pending: migrations absent (GET PGRST205), Google disabled, APP_URL and email templates/SMTP/admin bootstrap require setup. SUPABASE_DB_URL unavailable; user was offered direct application or manual SQL route.
- Checkbox completion refers to source/local work. Actual email/OAuth/invitation acceptance remains a deployment acceptance gate documented in docs/supabase-setup.md.
