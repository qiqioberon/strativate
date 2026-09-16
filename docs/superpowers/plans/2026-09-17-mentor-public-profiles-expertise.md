# Mentor Public Profiles and Expertise Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded public mentor roster/expertise with a normalized Supabase domain, add mentor self-service public-profile management and admin expertise/publication controls, and keep public mentor UX/layout stable.

**Architecture:** Keep the existing operational `mentor_profiles` account domain unchanged and add a separate `mentor_public_profiles` domain whose account link is nullable/unique. All public reads go through a public-safe RPC, mentor writes go through an own-profile RPC, and admin lifecycle/master-data writes go through admin RPCs. Existing bundled mentor portrait assets remain in the asset registry and are referenced from DB by asset key.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/PostgreSQL/RLS, CSS Modules/scoped CSS, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-17-mentor-public-profiles-expertise-design.md`

## Global Constraints

- Base is `main` commit `2294f967f962cdb5fb1cef17d5460b28882abf3c`.
- Do not overload generic `profiles` or existing operational `mentor_profiles`.
- Never infer legacy public-profile account ownership.
- Database becomes the only runtime mentor profile/expertise source after migration.
- Preserve existing approved 26 mentor facts and current portrait asset/fallback behavior.
- Publication/tier/sort priority are admin-controlled; mentors cannot mutate them through frontend or RPC parameters.
- Anonymous users receive only published public-safe columns.
- New CSS must be locally scoped and page-level horizontal overflow must remain impossible at 360px+.
- No new UI/component library.
- Use meaningful batch commits rather than micro-commits.
- Hosted Supabase migration must be applied before the application code that switches the public roster to DB is deployed.

---

### Task 1: Lock the database and runtime contracts with RED tests

**Files:**
- Create: `tests/mentor-public-profile-domain.test.ts`
- Create: `tests/mentor-public-runtime.test.ts`

**Interfaces:**
- Consumes repository source files through `node:fs`.
- Produces static contract assertions used by later tasks.

- [ ] **Step 1: Add migration-contract assertions**

The domain test must read `supabase/migrations/202609170001_mentor_public_profiles_expertise.sql` and assert all required objects/guards exist:

```ts
for (const token of [
  'create table public.mentor_public_profiles',
  'create table public.mentor_public_achievements',
  'create table public.mentor_expertise',
  'create table public.mentor_public_profile_expertise',
  'save_my_mentor_public_profile',
  'admin_upsert_mentor_expertise',
  'admin_delete_mentor_expertise',
  'admin_set_mentor_publication',
  'list_public_mentors',
  'enable row level security',
]) assert.match(sql, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
```

Assert all eight required expertise labels/slugs appear exactly once in the seed section, public RPC return declarations do not contain `email`, `whatsapp`, or auth/account fields, and legacy mentor ownership seed does not set `mentor_user_id` to a non-null value.

- [ ] **Step 2: Add runtime-source assertions**

The runtime test must require:

- `lib/mentor/public-profile.ts` exports a server query helper;
- `app/mentor/page.tsx` and `app/page.tsx` call the DB-backed helper;
- marketing components import public mentor DTO types rather than `lib/content/mentors`;
- `lib/content/mentors.ts` is not imported by production runtime;
- mentor dashboard contains a public-profile editor;
- admin dashboard exposes Mentor Expertise.

- [ ] **Step 3: Run focused RED tests**

Run:

```bash
pnpm exec node --import tsx --test tests/mentor-public-profile-domain.test.ts tests/mentor-public-runtime.test.ts
```

Expected: FAIL because migration/runtime implementation files do not yet exist and current public pages still import the hardcoded roster.

### Task 2: Add normalized mentor-public database domain, RLS, RPCs, and legacy seed

**Files:**
- Create: `supabase/migrations/202609170001_mentor_public_profiles_expertise.sql`
- Modify: `lib/supabase/database.types.ts`
- Test: `tests/mentor-public-profile-domain.test.ts`

**Interfaces:**
- Produces tables `mentor_public_profiles`, `mentor_public_achievements`, `mentor_expertise`, `mentor_public_profile_expertise`.
- Produces RPCs `get_my_mentor_public_profile`, `save_my_mentor_public_profile`, `admin_upsert_mentor_expertise`, `admin_reorder_mentor_expertise`, `admin_delete_mentor_expertise`, `admin_ensure_mentor_public_profile`, `admin_set_mentor_publication`, `list_public_mentors`.
- Produces TypeScript rows `MentorPublicProfile`, `MentorPublicAchievement`, `MentorExpertise`, `PublicMentorDirectoryRow`, `MyMentorPublicProfileRow`.

- [ ] **Step 1: Create schema and constraints**

Use the exact columns/constraints from the design. Include trim/length checks, case-insensitive expertise-name uniqueness, slug checks, FK actions, lookup/order indexes, `touch_updated_at()` triggers, and RLS on all four tables.

- [ ] **Step 2: Add security policies and grants**

Keep direct table reads narrow to self/admin; expose public directory only through `list_public_mentors()` with explicit safe return fields. Grant execute on public RPC to `anon, authenticated`; mentor/admin RPCs to `authenticated`; service-role grants follow existing migration convention. Do not grant broad public updates.

- [ ] **Step 3: Implement mentor self-service RPC**

`save_my_mentor_public_profile` must:

```sql
if auth.uid() is null then raise exception 'Authentication required'; end if;
select ... from public.mentor_profiles where user_id = auth.uid() and is_active;
if not found then raise exception 'Active mentor account required'; end if;
```

Create a linked draft profile when missing, update only mentor-controlled fields, validate LinkedIn/portrait URL lengths, validate expertise IDs such that inactive IDs are allowed only when already assigned, replace expertise assignments transactionally, replace ordered achievements transactionally, and never accept publication/tier/sort/owner as parameters.

- [ ] **Step 4: Implement admin expertise/publication RPCs**

Create/update preserves existing expertise slug on rename; creation derives a stable lowercase hyphen slug and rejects collisions. Delete returns `deactivate_required` when referenced. Reorder validates a complete unique ID list. Publication control requires admin and ensures an account-linked draft profile exists without linking any legacy profile heuristically.

- [ ] **Step 5: Seed expertise and 26 approved mentor records**

Use deterministic expertise UUIDs and deterministic public-profile UUIDs. Seed with `ON CONFLICT ... DO NOTHING`/safe conflict handling. Insert each legacy public profile with `mentor_user_id = null`, then seed achievements and junction assignments from current approved `lib/content/mentors.ts` values. Preserve existing `portrait_asset_key` and `photo_status`.

- [ ] **Step 6: Update handwritten Supabase types**

Add all new table/RPC row definitions and `Database.public.Tables/Functions` entries. Do not rename existing operational `MentorProfile`.

- [ ] **Step 7: Run focused domain test**

Run the domain test and confirm all migration/security/seed assertions pass.

- [ ] **Step 8: Commit database/domain batch**

Commit message: `feat: add mentor public profile domain`

### Task 3: Add DB-backed public mentor query and preserve public presentation

**Files:**
- Create: `lib/mentor/public-profile.ts`
- Modify: `app/mentor/page.tsx`
- Modify: `app/page.tsx`
- Modify: `components/marketing/home-page.tsx`
- Modify: `components/marketing/mentor-directory.tsx`
- Modify: `components/marketing/mentor-card.tsx`
- Modify: `components/marketing/mentor-detail-modal.tsx`
- Modify: `components/marketing/mentor-marquee.tsx`
- Modify/Create: `components/marketing/mentor-portrait-media.tsx`
- Delete or demote: `lib/content/mentors.ts`
- Test: `tests/mentor-public-runtime.test.ts`

**Interfaces:**
- Produces `PublicMentor` and `listPublishedMentors(): Promise<PublicMentor[]>`.
- `PublicMentor` keeps current rendering semantics: slug, name, tier, title/headline, achievements/credentials, expertise, LinkedIn, portrait asset key/url, photo status, short bio.

- [ ] **Step 1: Implement server-only public query helper**

Use `createClient()` from `lib/supabase/server`, call `list_public_mentors`, map null/array values to a safe DTO, validate asset keys against `assetRegistry`, and return `[]` with a concise server warning if the DB RPC is unavailable. Do not use service role and do not fall back to the hardcoded roster.

- [ ] **Step 2: Switch `/mentor` to DB data**

Make the page async, call `listPublishedMentors()`, and pass the result to existing `MentorDirectory`.

- [ ] **Step 3: Switch homepage mentor marquee to DB data**

Load mentors in `app/page.tsx` in parallel with other public data where appropriate and add a `mentors` prop to `HomePage`; remove the static import.

- [ ] **Step 4: Update marketing types/media only as needed**

Move type imports to the new mentor-public domain. Add a small portrait renderer that uses the current registry `AssetMedia` for `portrait_asset_key`; if only `portrait_url` exists, render a responsive `next/image`; otherwise use the approved brand-mark fallback. Do not redesign card/grid/modal markup.

- [ ] **Step 5: Remove production hardcoded roster source**

Delete `lib/content/mentors.ts` after all production imports and tests are migrated. Keep `asset-registry.ts` because it remains static media metadata, not profile business data.

- [ ] **Step 6: Run focused runtime test**

Confirm no production import references `lib/content/mentors` and public pages use the DB helper.

### Task 4: Add Mentor Public Profile Management to the mentor dashboard

**Files:**
- Create: `components/mentor/mentor-public-profile-form.tsx`
- Create: `components/mentor/mentor-public-profile.module.css`
- Modify: `lib/mentor/dashboard.ts`
- Modify: `lib/mentor/dashboard-server.ts`
- Modify: `components/mentor/dashboard/mentor-secondary-sections.tsx`
- Test: `tests/mentor-public-runtime.test.ts`

**Interfaces:**
- Extends `MentorDashboardData` with `publicProfile` and `expertiseOptions` read data returned by `get_my_mentor_public_profile`.
- Produces `MentorPublicProfileForm` with local read/edit mode and one atomic `save_my_mentor_public_profile` call.

- [ ] **Step 1: Load mentor public-profile data server-side**

Query the read RPC alongside existing sessions/tier/availability. Return a stable empty draft DTO on no linked profile and a contained metadata error on query failure rather than breaking the operational dashboard.

- [ ] **Step 2: Build read-only public-profile card**

Show display name, admin-controlled tier/publication status, headline, LinkedIn, portrait status, selected expertise, bio, and achievements. Keep account identity in existing `ProfileForm` and operational status in the existing operational card.

- [ ] **Step 3: Add edit mode**

Fields: display name, headline, LinkedIn, public portrait URL, short bio, expertise checkboxes, achievement list. Use move-up/down/remove and add-achievement controls. Assigned inactive expertise remains visible with an inactive badge. Save uses only the mentor self-service RPC.

- [ ] **Step 4: Add scoped responsive CSS**

Desktop may use two columns for scalar fields; <=700px collapses to one. Every grid/flex child uses `min-width: 0`; URLs/achievement text use `overflow-wrap:anywhere`; action groups wrap/stack; expertise list scales without assuming eight options.

- [ ] **Step 5: Integrate into `MentorProfilePanel`**

Order cards as Account Information → Public Mentor Profile → Operational Mentor Status, preserving current account and operational functionality.

### Task 5: Add Admin Mentor Expertise and publication controls

**Files:**
- Create: `components/admin/mentor-expertise-management.tsx`
- Create: `components/admin/mentor-expertise-management.module.css`
- Create: `components/admin/mentor-publication-control.tsx`
- Modify: `app/admin/page.tsx`
- Modify: `components/admin/mentor-management.tsx`
- Test: `tests/mentor-public-runtime.test.ts`

**Interfaces:**
- Admin expertise UI calls `admin_upsert_mentor_expertise`, `admin_reorder_mentor_expertise`, and `admin_delete_mentor_expertise`.
- Publication control calls `admin_ensure_mentor_public_profile` and `admin_set_mentor_publication`.

- [ ] **Step 1: Add Mentor Expertise navigation**

Add `Mentor Expertise` under Data master and render the new management component without changing existing admin sections.

- [ ] **Step 2: Implement expertise management**

Load expertise rows, add search and active/inactive filter, use responsive cards/rows showing name, stable slug, order, status, edit, move up/down, activate/deactivate, and safe delete. Empty state reads `No expertise has been configured yet.`

- [ ] **Step 3: Implement constrained create/edit dialog**

Use explicit centered dialog styling: width `min(520px, calc(100vw - 32px))`, max-height `calc(100dvh - 32px)`, internal body scrolling, no global dialog selectors.

- [ ] **Step 4: Add mentor publication control inside existing Mentor Management detail flow**

For selected authenticated mentor, load its linked public profile. If absent, show `Belum memiliki profil publik` with an admin `Buat draft` action. If present, show status/slug and Draft/Published control. Never display or offer linking of the 26 unowned legacy profiles by inferred identity.

### Task 6: Update source documentation and add regression coverage

**Files:**
- Modify: `docs/strativate/asset-status.md`
- Modify: `docs/strativate/source-conflicts.md`
- Create: `tests/browser/mentor-public-profile-management.spec.ts`
- Create: `tests/browser/admin-mentor-expertise-management.spec.ts`
- Modify existing mentor marketing/browser tests where static count fixtures require DB-backed setup.

**Interfaces:**
- Browser tests exercise real layout/interaction surfaces and assert geometry rather than class names only.

- [ ] **Step 1: Update content source-of-truth docs**

Record database-backed mentor roster/profile ownership as authoritative, asset registry as media-only metadata, migration ownership rule (`legacy records remain unlinked`), and hosted migration-before-app deployment requirement.

- [ ] **Step 2: Add mentor profile viewport tests**

At 360×740, 390×844, 768×1024, 1024×768, 1366×768, 1440×900, and 1920×1080, assert:

```ts
expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
```

Open edit mode, populate long headline/URL/achievement text, verify cards/actions remain inside their bounding containers and form columns collapse on mobile.

- [ ] **Step 3: Add admin expertise viewport/dialog tests**

Assert the same page-overflow invariant, responsive row containment, dialog bounds inside viewport, wrapping labels, and action containment at mobile and desktop widths.

- [ ] **Step 4: Extend public directory tests**

Verify published records render; draft/private records do not; expertise/achievements come from DB-backed fixtures; private account fields are absent from page payload/rendering; existing card/filter/modal behavior remains intact.

### Task 7: Full verification, diff audit, and PR

**Files:**
- All files above.

- [ ] **Step 1: Run focused source/domain tests**

```bash
pnpm exec node --import tsx --test tests/mentor-public-profile-domain.test.ts tests/mentor-public-runtime.test.ts
```

- [ ] **Step 2: Run repository checks**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

- [ ] **Step 3: Run relevant Playwright suites**

At minimum run new mentor/admin suites plus current mentor directory, mentor dashboard, admin mentor management, auth/profile, scheduling, marketing, and dashboard shared-navigation suites.

- [ ] **Step 4: Compare branch to latest `main` again**

If main advanced, inspect changes for conflicts and rebase/merge latest main safely before final PR. Confirm no unrelated migration/business logic/global CSS/dependency changes.

- [ ] **Step 5: Commit meaningful UI/test/doc batches**

Use descriptive batch commits such as:

- `feat: add mentor public profile domain`
- `feat: manage mentor public profiles and expertise`
- `test: verify mentor public profile rollout`

Do not create per-file micro-commits.

- [ ] **Step 6: Open PR to `main` without merging**

PR body must include:

- exact migration filename and hosted Supabase manual-apply/deploy order;
- RLS/RPC boundary summary;
- 26-record migration and explicit no-inferred-account-link rule;
- portrait compatibility strategy;
- responsive viewport verification results;
- test/typecheck/lint/build/Playwright results with exact failures/limitations if any;
- known limitations (notably no new portrait upload subsystem).