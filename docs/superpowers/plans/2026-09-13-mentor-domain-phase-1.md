# Mentor Domain Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure operational Mentor Domain with tiered invitations, persistent recurring availability, and integrated admin/mentor management while preserving auth, Product Catalog, and public mentor marketing.

**Architecture:** A forward Supabase migration adds the normalized mentor tables and makes trusted database functions the mutation boundary for tiers and atomic weekly availability. Focused React components consume typed RPC/table reads inside the existing admin and mentor shells; pure TypeScript helpers own client-side availability normalization. Existing catalog tiers remain isolated as catalog-specific legacy data.

**Tech Stack:** PostgreSQL/Supabase migrations, RLS and security-definer RPCs, Next.js 16.3 App Router, React 19, TypeScript 5.7, Supabase JS, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-13-mentor-domain-phase-1-design.md`

## Global Constraints

- Start from `origin/main` at `3e98d257471b66f1bd83c617e570d47c8fb2804c`.
- Do not edit already-applied migration files; add a forward migration.
- Do not run migrations against the remote Supabase project.
- Do not modify `lib/content/mentors.ts`, public mentor marketing content, credentials, portraits, or cards.
- Do not replace or remove `catalog_mentor_tiers`; Product Catalog remains outside this redesign.
- New invitations require an active operational tier at the server and database boundaries.
- A new tiered invitation must atomically create a mentor profile with exactly that tier.
- Legacy mentor profiles and pre-migration invitations may retain `tier_id = NULL` without inferred data.
- Tier editing remains directly available in the admin mentor list.
- Weekly availability is saved atomically and uses day numbers `1 = Monday` through `7 = Sunday`.
- Read the relevant Next.js 16 guides under `node_modules/next/dist/docs/` before changing application code.
- Follow `docs/strativate/frontend-content-asset-requirements.md`, `docs/strativate/source-conflicts.md`, and `docs/strativate/asset-status.md` for frontend changes.

---

### Task 1: Add database-first Mentor Domain invariants

**Files:**
- Create: `supabase/tests/mentor_domain.sql`
- Create: `supabase/migrations/202609130001_mentor_domain.sql`
- Modify: `scripts/test-database.ts`
- Modify: `supabase/tests/auth_security.sql`
- Modify: `supabase/tests/mentor_invites.sql`

**Interfaces:**
- Consumes: existing `profiles`, `mentor_invites`, `is_admin()`, `bootstrap_profile()`, `assign_invited_mentor()`, and `touch_updated_at()`.
- Produces: `mentor_tiers`, `mentor_profiles`, `mentor_availability_rules`, `list_managed_mentors(integer,text,uuid,text)`, enriched `list_mentor_invites(integer)`, `set_mentor_tier(uuid,uuid)`, and `save_mentor_availability(uuid,jsonb)`.

- [ ] **Step 1: Register the new SQL test before its file exists**

Add `mentor_domain.sql` to the database runner after `mentor_invites.sql` and before `product_catalog.sql`:

```ts
for (const filename of [
  'auth_security.sql',
  'institution_import.sql',
  'mentor_invites.sql',
  'mentor_domain.sql',
  'product_catalog.sql',
]) {
```

- [ ] **Step 2: Run the database suite and verify RED**

Run: `pnpm test:db -- --bootstrap`

Expected: FAIL because `supabase/tests/mentor_domain.sql` does not exist.

- [ ] **Step 3: Write focused SQL assertions for schema, invitation, authorization, and availability**

Create a rollback-wrapped test that seeds admin, two mentors, and a mentee, then includes concrete assertions equivalent to:

```sql
select test_mentor.assert(
  (select array_agg(code order by sort_order) from public.mentor_tiers)
    = array['TOP_STUDENT','YOUNG_PROFESSIONAL'],
  'only approved operational tiers are seeded'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', :'admin_id', true);
select public.set_mentor_tier(:'mentor_a_id', :'top_student_id');
select test_mentor.assert(
  (select tier_id = :'top_student_id'::uuid from public.mentor_profiles where user_id = :'mentor_a_id'),
  'admin assigns mentor tier'
);

select set_config('request.jwt.claim.sub', :'mentor_a_id', true);
select test_mentor.denied(
  format('select public.set_mentor_tier(%L,%L)', :'mentor_a_id', :'young_professional_id'),
  '42501',
  'mentor cannot change own tier'
);

select test_mentor.denied(
  $$insert into public.mentor_invites(email, invited_by) values ('missing-tier@test.invalid', '10000000-0000-0000-0000-000000000001')$$,
  '22023',
  'new invitation requires a tier'
);

select public.save_mentor_availability(:'mentor_a_id', '[
  {"day_of_week":1,"start_time":"18:00","end_time":"21:00"},
  {"day_of_week":6,"start_time":"09:00","end_time":"12:00"},
  {"day_of_week":6,"start_time":"12:00","end_time":"14:00"}
]'::jsonb);
```

Cover all required allow/deny cases, invalid tier IDs, inactive tiers, legacy
null rows simulated by inserting with the new-insert guard temporarily disabled,
both trusted Auth invitation paths, exact tier propagation, direct mutation
denial, `start_time >= end_time`, overlapping ranges, adjacent ranges, cross-
mentor access, and rollback after a rejected whole-week replacement.

- [ ] **Step 4: Run the new test and verify RED against the missing schema**

Run: `pnpm test:db -- --bootstrap`

Expected: FAIL at the first `mentor_tiers`/RPC reference because the migration is absent.

- [ ] **Step 5: Add the forward migration**

Implement:

```sql
create table public.mentor_tiers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_]*$'),
  name text not null unique check (char_length(btrim(name)) between 1 and 100),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.mentor_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tier_id uuid references public.mentor_tiers(id),
  timezone text not null default 'Asia/Jakarta'
    check (char_length(btrim(timezone)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mentor_invites add column tier_id uuid references public.mentor_tiers(id);
create table public.mentor_availability_rules (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.mentor_profiles(user_id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time without time zone not null,
  end_time time without time zone not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time)
);
```

Add stable seed UUIDs, `touch_updated_at` triggers, role-owner triggers,
pre-existing mentor backfill, a new-invitation active-tier trigger, and a
concurrency-safe GiST exclusion constraint over half-open time ranges. Recreate
the two trusted Auth trigger functions so both paths upsert `mentor_profiles`
and assert exact propagation whenever `mentor_invites.tier_id` is non-null.

Create RLS policies and explicit grants so authenticated users can read only
their authorized mentor rows and cannot directly mutate tier or availability.
Create the four RPC boundaries from the Interfaces block with explicit
authorization, input validation, fixed `search_path`, revokes, and grants.

Add database comments stating that `catalog_mentor_tiers` remains a separate
catalog-specific legacy model pending the Private Mentoring redesign.

- [ ] **Step 6: Update existing invitation fixtures for the new invariant**

Look up the stable tier seed and add `tier_id` to every post-migration fixture
that represents a new invitation in `auth_security.sql` and
`mentor_invites.sql`. Do not weaken their existing role, race, deletion, or
rollback assertions.

- [ ] **Step 7: Run all database tests and verify GREEN**

Run: `pnpm test:db -- --bootstrap`

Expected: every migration and `auth_security.sql`, `institution_import.sql`,
`mentor_invites.sql`, `mentor_domain.sql`, and `product_catalog.sql` prints
`Passed` with no remote database access.

- [ ] **Step 8: Commit the database slice**

```bash
git add supabase/migrations/202609130001_mentor_domain.sql supabase/tests/mentor_domain.sql supabase/tests/auth_security.sql supabase/tests/mentor_invites.sql scripts/test-database.ts
git commit -m "feat: add secure mentor domain schema"
```

---

### Task 2: Add typed domain models and pure availability validation

**Files:**
- Create: `tests/mentor-domain.test.ts`
- Create: `lib/mentor/availability.ts`
- Modify: `lib/supabase/database.types.ts`

**Interfaces:**
- Consumes: database rows and RPC return shapes from Task 1.
- Produces: `MentorTier`, `MentorProfile`, `MentorAvailabilityRule`, `ManagedMentor`, enriched `MentorInviteSummary`, `AvailabilityDraftRange`, `validateAvailabilityDraft()`, `toAvailabilityPayload()`, and `groupAvailabilityByDay()`.

- [ ] **Step 1: Write failing unit tests for weekly normalization**

Add tests with exact expectations:

```ts
assert.deepEqual(
  toAvailabilityPayload([
    { key: 'b', dayOfWeek: 6, startTime: '12:00', endTime: '14:00' },
    { key: 'a', dayOfWeek: 1, startTime: '18:00', endTime: '21:00' },
  ]),
  [
    { day_of_week: 1, start_time: '18:00', end_time: '21:00' },
    { day_of_week: 6, start_time: '12:00', end_time: '14:00' },
  ],
)
assert.equal(validateAvailabilityDraft(overlappingSaturday), 'Rentang waktu hari Sabtu saling tumpang tindih.')
assert.equal(validateAvailabilityDraft(adjacentSaturday), null)
```

Also assert seven Indonesian day labels, invalid weekdays, malformed times,
equal/reversed ranges, and grouping of empty days.

- [ ] **Step 2: Run the unit test and verify RED**

Run: `pnpm test -- tests/mentor-domain.test.ts`

Expected: FAIL because `@/lib/mentor/availability` does not exist.

- [ ] **Step 3: Add exact generated-style database types**

Extend the central type file with the new row types and these RPC signatures:

```ts
list_managed_mentors: { Args: { p_offset?: number; p_query?: string; p_tier_id?: string | null; p_setup_status?: string }; Returns: ManagedMentor[] }
set_mentor_tier: { Args: { p_mentor_id: string; p_tier_id: string }; Returns: MentorProfile }
save_mentor_availability: { Args: { p_mentor_id: string; p_rules: Json }; Returns: MentorAvailabilityRule[] }
```

Update `MentorInvite`/`MentorInviteSummary` with nullable tier fields and add all
three tables without altering Product Catalog types.

- [ ] **Step 4: Implement minimal pure availability helpers**

Use `HH:mm` lexical comparison after strict 24-hour validation, sort by day and
start time, reject overlap only when `next.startTime < previous.endTime`, and
emit snake_case RPC payload without client-only keys.

- [ ] **Step 5: Run unit and type checks and verify GREEN**

Run: `pnpm test`

Run: `pnpm typecheck`

Expected: mentor-domain tests and all existing unit tests pass; TypeScript has
no missing database table or RPC types.

- [ ] **Step 6: Commit the typed domain slice**

```bash
git add tests/mentor-domain.test.ts lib/mentor/availability.ts lib/supabase/database.types.ts
git commit -m "feat: add typed mentor availability model"
```

---

### Task 3: Require an active tier in the server invitation flow

**Files:**
- Create: `lib/admin/mentor-invitation-input.ts`
- Modify: `tests/mentor-domain.test.ts`
- Modify: `lib/admin/invite-mentor.ts`
- Create: `components/admin/mentor-invite-form.tsx`

**Interfaces:**
- Consumes: active `mentor_tiers`, existing service-role invitation workflow, and `inviteMentor(emailInput, tierIdInput)`.
- Produces: tier-aware invitation validation and a form that preserves values on error.

- [ ] **Step 1: Add failing server-input tests**

```ts
assert.deepEqual(parseMentorInvitationInput(' Mentor@Example.test ', ''), {
  error: 'Pilih tier mentor yang aktif.',
})
assert.deepEqual(parseMentorInvitationInput(' Mentor@Example.test ', tierId), {
  email: 'mentor@example.test',
  tierId,
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --import tsx --test tests/mentor-domain.test.ts`

Expected: FAIL because the parser module does not exist.

- [ ] **Step 3: Implement validation and tier-aware server action**

The action must authenticate the current admin, query the service client for
`mentor_tiers.id = tierId AND is_active = true`, include `tier_id` in the first
registry insert, and include it when atomically claiming a failed invitation.
Return `Pilih tier mentor yang aktif.` for missing/unknown/inactive selections.
Never place role or tier data in Supabase Auth user metadata.

- [ ] **Step 4: Add the focused invitation form**

Render email and active-tier controls with HTML `required`, call the two-argument
server action, reset only after success, and announce loading, error, and success
states. The database and server validations remain authoritative.

- [ ] **Step 5: Run tests and typecheck and verify GREEN**

Run: `pnpm test`

Run: `pnpm typecheck`

Expected: all tests pass and the two-argument action has no stale callers.

- [ ] **Step 6: Commit the invitation slice**

```bash
git add lib/admin/mentor-invitation-input.ts lib/admin/invite-mentor.ts components/admin/mentor-invite-form.tsx tests/mentor-domain.test.ts
git commit -m "feat: require tiers for mentor invitations"
```

---

### Task 4: Build operational admin mentor management

**Files:**
- Create: `components/admin/mentor-management.tsx`
- Create: `components/admin/mentor-tier-select.tsx`
- Modify: `components/admin/mentor-invitations.tsx`
- Modify: `components/admin/people.tsx`
- Modify: `app/admin/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `list_managed_mentors`, enriched `list_mentor_invites`, `set_mentor_tier`, `MentorInviteForm`, and active `mentor_tiers`.
- Produces: the admin Mentors section, direct list-row tier editing, and selection of a mentor for the Manage panel.

- [ ] **Step 1: Add failing source-boundary assertions**

Extend `tests/mentor-domain.test.ts` to read source files and assert:

```ts
assert.match(adminPage, /<MentorManagement \/>/)
assert.doesNotMatch(peopleManagement, /inviteMentor|role === 'mentor'/)
assert.match(mentorManagement, /set_mentor_tier/)
assert.match(mentorManagement, /MentorInviteForm/)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --import tsx --test tests/mentor-domain.test.ts`

Expected: FAIL because `mentor-management.tsx` is missing and the old generic
mentor branch remains.

- [ ] **Step 3: Implement the mentor list orchestration**

Load active tiers and managed mentors, debounce search, filter by tier and setup
state, paginate at 25 rows, and render name, email, username, setup status,
availability status, inline tier selector, and Manage action. Use
`Tier belum ditentukan` for null legacy assignments.

Keep separate visual sections for active accounts and invitations. Update the
invitation list to show its selected tier and existing delete controls.

- [ ] **Step 4: Implement pessimistic inline tier changes**

Disable only the row being changed, call `set_mentor_tier`, announce success,
and call the mentor-list loader after an error so the select returns to the
database value. Do not move tier editing exclusively into Manage.

- [ ] **Step 5: Remove the obsolete generic mentor UI branch**

Change `PeopleManagement` into a mentee-only component or equivalent focused
export. Route the admin `Mentors` section to `MentorManagement` while retaining
the current Mentees section and admin shell behavior.

- [ ] **Step 6: Add responsive styles using existing dashboard tokens**

Add scoped classes for the management header, filters, mentor rows/cards,
status blocks, tier selector, invitation list, and Manage panel. Reuse current
buttons, form errors, role cards, colors, spacing, and mobile breakpoint.

- [ ] **Step 7: Run tests, typecheck, and lint and verify GREEN**

Run: `pnpm test`

Run: `pnpm typecheck`

Run: `pnpm lint`

Expected: all commands pass with no public mentor content changes.

- [ ] **Step 8: Commit the admin slice**

```bash
git add components/admin/mentor-management.tsx components/admin/mentor-tier-select.tsx components/admin/mentor-invitations.tsx components/admin/people.tsx app/admin/page.tsx app/globals.css tests/mentor-domain.test.ts
git commit -m "feat: manage operational mentors in admin"
```

---

### Task 5: Replace demo availability with the shared persistent editor

**Files:**
- Create: `components/mentor/availability-editor.tsx`
- Create: `components/mentor/mentor-domain-summary.tsx`
- Modify: `components/admin/mentor-management.tsx`
- Modify: `app/mentor/dashboard/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/mentor-domain.test.ts`

**Interfaces:**
- Consumes: `mentor_profiles`, active/readable `mentor_tiers`, authorized `mentor_availability_rules`, `save_mentor_availability`, and Task 2 helpers.
- Produces: `MentorAvailabilityEditor({ mentorId, mode })` shared by mentor and admin plus read-only tier/timezone summary.

- [ ] **Step 1: Add failing source and behavior tests**

Assert that the dashboard imports the shared editor and no longer contains the
hardcoded availability literals or fabricated metric:

```ts
assert.match(dashboard, /MentorAvailabilityEditor/)
assert.doesNotMatch(dashboard, /function Availability\(\)/)
assert.doesNotMatch(dashboard, /Waktu tersedia.*8 jam/)
assert.doesNotMatch(dashboard, /\['Senin', 'Selasa', 'Rabu'/)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --import tsx --test tests/mentor-domain.test.ts`

Expected: FAIL because the dashboard still renders hardcoded availability.

- [ ] **Step 3: Implement the shared availability editor**

Load the authorized mentor profile, tier, and sorted rules. Render all seven
days; allow add, edit, and remove; validate locally; and call one
`save_mentor_availability` RPC with the complete normalized array. Keep the
draft and show an error after failure. Replace the draft with returned rows and
show success after a successful save.

- [ ] **Step 4: Integrate mentor self-management**

Use `useAccount().id` as the RPC target in the dashboard Availability section,
show the read-only operational tier and `Asia/Jakarta` timezone, wire the
top-level “Atur ketersediaan” action to that section, and remove the fake hours
metric rather than calculating it from demo state.

- [ ] **Step 5: Integrate admin Manage panel**

When an admin chooses Manage, render the selected mentor identity, setup state,
tier summary, and the same editor with the selected mentor UUID. Keep the list
visible or provide a clear close/back control; leave the list-row tier selector
in place.

- [ ] **Step 6: Add accessible responsive styles**

Associate every time input with its weekday/range label, provide explicit
remove-button names, preserve keyboard focus, and make multi-range rows stack at
the existing mobile breakpoint.

- [ ] **Step 7: Run tests, typecheck, and lint and verify GREEN**

Run: `pnpm test`

Run: `pnpm typecheck`

Run: `pnpm lint`

Expected: all commands pass and repository search finds no hardcoded mentor
availability configuration.

- [ ] **Step 8: Commit the availability slice**

```bash
git add components/mentor/availability-editor.tsx components/mentor/mentor-domain-summary.tsx components/admin/mentor-management.tsx app/mentor/dashboard/page.tsx app/globals.css tests/mentor-domain.test.ts
git commit -m "feat: persist weekly mentor availability"
```

---

### Task 6: Lock down public-route and cleanup boundaries

**Files:**
- Create: `lib/auth/routes.ts`
- Modify: `proxy.ts`
- Modify: `tests/auth.test.ts`
- Modify: `tests/browser/public-auth.spec.ts`
- Modify: `docs/superpowers/specs/2026-09-13-mentor-domain-phase-1-design.md` only if implementation details require a factual correction

**Interfaces:**
- Consumes: current proxy behavior and protected role layouts.
- Produces: `isProtectedPath(pathname)` and regression coverage proving `/` is public while role routes remain protected.

- [ ] **Step 1: Write failing route-classification tests**

```ts
for (const path of ['/', '/program', '/mentor', '/produk-digital']) {
  assert.equal(isProtectedPath(path), false)
}
for (const path of ['/admin', '/mentor/dashboard', '/dashboard', '/onboarding', '/checkout/example']) {
  assert.equal(isProtectedPath(path), true)
}
```

- [ ] **Step 2: Run auth tests and verify RED**

Run: `node --import tsx --test tests/auth.test.ts`

Expected: FAIL because `lib/auth/routes.ts` does not exist.

- [ ] **Step 3: Extract the existing protected-path predicate**

Move only the current protected-route regular expressions into the pure helper
and call it from `proxy.ts`. Do not add `/` or ordinary marketing pages to the
proxy matcher and do not redirect authenticated sessions from public pages.

- [ ] **Step 4: Add browser regression coverage**

Add a test that installs a session-shaped Supabase cookie/local-storage value,
opens `/`, and asserts the Strativate marketing header and canonical root URL
remain visible. Retain the existing anonymous tests for `/admin`,
`/mentor/dashboard`, `/dashboard`, `/onboarding`, and checkout.

- [ ] **Step 5: Run unit and focused browser tests and verify GREEN**

Run: `pnpm test`

Run: `pnpm exec playwright test tests/browser/public-auth.spec.ts --workers 1`

Expected: public landing and all anonymous role guards pass.

- [ ] **Step 6: Commit the routing slice**

```bash
git add lib/auth/routes.ts proxy.ts tests/auth.test.ts tests/browser/public-auth.spec.ts docs/superpowers/specs/2026-09-13-mentor-domain-phase-1-design.md
git commit -m "test: preserve public navigation for signed-in users"
```

---

### Task 7: Run the cleanup audit and complete verification

**Files:**
- Modify only files implicated by a failing check or a stale-reference search.

**Interfaces:**
- Consumes: all earlier tasks.
- Produces: a verified Phase 1 branch and an evidence-based cleanup ledger.

- [ ] **Step 1: Search every changed database responsibility repository-wide**

Run:

```bash
rg -n "mentor_tiers|mentor_profiles|mentor_availability_rules|list_managed_mentors|list_mentor_invites|set_mentor_tier|save_mentor_availability|catalog_mentor_tiers|mentorOptions|Waktu tersedia|18:00–21:00" --glob '!public/**'
```

Expected: no stale RPC signatures, old invitation calls, direct unauthorized
mutations, hardcoded operational availability, orphaned types, or accidental
Product Catalog replacements. `catalog_mentor_tiers`, public mentor content,
and demo assignment options remain only in their documented scopes.

- [ ] **Step 2: Review all changed TSX against React conventions**

Check stable hook dependencies, loading/error state ownership, accessible labels,
button types, form preservation, and unnecessary rerenders. Apply only fixes
supported by the existing architecture.

- [ ] **Step 3: Run the complete unit suite**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 4: Run the clean disposable database bootstrap**

Run: `pnpm test:db -- --bootstrap`

Expected: every migration and SQL suite passes; Product Catalog assertions are
unchanged and pass.

- [ ] **Step 5: Run static verification**

Run: `pnpm typecheck`

Run: `pnpm lint`

Expected: both pass without warnings promoted to errors.

- [ ] **Step 6: Run the production build**

Run: `pnpm build`

Expected: Next.js production compilation and route generation pass.

- [ ] **Step 7: Run the complete browser suite**

Run: `pnpm exec playwright test --workers 3`

Expected: all marketing, auth, public-route, responsive, and program tests pass.

- [ ] **Step 8: Inspect the final diff and commit verification fixes**

Run:

```bash
git status --short
git diff --check
git diff origin/main...HEAD --stat
git log --oneline origin/main..HEAD
```

If verification required tracked fixes, stage only the relevant files shown by
`git status --short` from this plan's declared file lists, rerun the failed
command, and commit them:

```bash
git commit -m "fix: complete mentor domain verification"
```

The handoff report must list migrations, schema, RLS, invitation behavior,
admin UI, mentor availability, routing, tests, exact command results, excluded
future work, and this cleanup ledger:

```text
Removed:
- hardcoded operational availability and fabricated availability metric

Migrated:
- existing mentor accounts and trusted invitation propagation

Kept temporarily for backward compatibility:
- catalog_mentor_tiers and demo mentor-assignment fixtures

Reason:
- Product Catalog and future assignment-domain dependencies remain outside Phase 1
```
