# Branch Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce and publish a validated semantic union of the Marketing Revision and Mentor Domain on `emergent-qq`, then open an unmerged PR to `main`.

**Architecture:** Start from the audited `origin/emergent-qq` tip in an isolated worktree and merge `origin/main` normally. Resolve shared application and database boundaries explicitly, remove only verified workspace artifacts, and validate the complete local application before any push or PR action.

**Tech Stack:** Git, Next.js 16.3 App Router, React 19, TypeScript 5.7, pnpm, Supabase/PostgreSQL/RLS/Storage, Node test runner, Playwright, GitHub CLI.

**Spec:** `docs/superpowers/specs/2026-09-13-branch-integration-design.md`

## Global Constraints

- Source SHA: `d940d8f6a869c393418adb6645187b9ffe082caf` plus the committed design/plan preparation.
- Main SHA: `ce29bc1983871a0f7ab3ba9c70b7dde93122bb4c`.
- Merge base: `3e98d257471b66f1bd83c617e570d47c8fb2804c`.
- Use a normal merge; do not force-push or rewrite `main`.
- Preserve both published migrations with their existing filenames and contents.
- Preserve the Mentor Domain and Marketing Revision as a semantic union.
- Do not invent stakeholder content, assets, claims, prices, credentials, policies, or conflict resolutions.
- Do not perform destructive hosted Supabase operations.
- Read relevant guides under `node_modules/next/dist/docs/` before changing framework-sensitive code.
- Stop after creating the `emergent-qq` to `main` PR; do not merge it.

---

### Task 1: Create the isolated baseline and perform the merge

**Files:**
- Modify: Git history and the merge index only.
- Test: all existing unit tests before and immediately after the merge.

**Interfaces:**
- Consumes: the two audited remote tips and the path ownership matrix in the spec.
- Produces: a normal merge state containing every one-sided addition and explicit conflicts for shared files.

- [ ] **Step 1: Commit the approved design, plan, and ignored worktree directory**

```powershell
git add .gitignore docs/superpowers/specs/2026-09-13-branch-integration-design.md docs/superpowers/plans/2026-09-13-branch-integration.md
git commit -m "docs: plan branch integration"
```

- [ ] **Step 2: Create an integration worktree and install exactly from the lockfile**

```powershell
git worktree add .worktrees/integrate-main -b integration/emergent-main emergent-qq
pnpm install --frozen-lockfile
```

- [ ] **Step 3: Verify the emergent baseline**

Run: `pnpm test`

Expected: the existing Marketing Revision unit suite passes before main is merged.

- [ ] **Step 4: Merge main without auto-committing**

```powershell
git merge --no-ff --no-commit origin/main
```

- [ ] **Step 5: Record conflicts and run the combined tests in RED state**

Run: `git diff --name-only --diff-filter=U`

Run: `pnpm test`

Expected: conflicts are limited to audited shared paths and/or tests fail because the unresolved combined tree is not yet executable.

### Task 2: Reconcile application behavior and Next.js configuration

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `app/globals.css`
- Modify: `app/mentor/dashboard/page.tsx`
- Modify: `app/admin/layout.tsx`
- Modify: `proxy.ts`
- Modify: `next.config.mjs`
- Test: `tests/auth.test.ts`
- Test: `tests/frontend-handoff.test.ts`
- Test: `tests/mentor-domain.test.ts`

**Interfaces:**
- Consumes: `MentorManagement`, `MenteeManagement`, `MentorAvailabilityEditor`, `featureFlags`, and `isProtectedApplicationPath()`.
- Produces: one admin surface, persistent mentor availability, approved naming, protected workspace routes, and coherent public redirects.

- [ ] **Step 1: Add or retain failing semantic-union assertions**

Ensure tests assert all of these before resolving implementation:

```ts
assert.equal(isProtectedApplicationPath('/mentor'), false)
assert.equal(isProtectedApplicationPath('/mentor/dashboard'), true)
assert.equal(featureFlags.digitalProducts, false)
assert.match(adminPageSource, /<MentorManagement \/>/)
assert.match(adminPageSource, /featureFlags\.digitalProducts/)
assert.match(mentorDashboardSource, /MentorAvailabilityEditor/)
```

- [ ] **Step 2: Run focused tests and observe the expected failure**

Run: `node --import tsx --test tests/auth.test.ts tests/frontend-handoff.test.ts tests/mentor-domain.test.ts`

Expected: at least one assertion or compilation step fails until conflicts are resolved as a union.

- [ ] **Step 3: Resolve the three shared application files minimally**

Use main's real Mentor/Mentee and availability components, emergent's flag and
approved labels, and the union of both scoped CSS blocks. Remove every conflict
marker without dropping either domain's imports or selectors.

- [ ] **Step 4: Reconcile framework-sensitive routing/configuration**

Use the checked-in Next.js 16.3 docs to keep valid Supabase Storage image
configuration, one `/explore` redirect mechanism, public `/mentor`, protected
`/mentor/dashboard`, and development-only preview origins when supported.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --import tsx --test tests/auth.test.ts tests/frontend-handoff.test.ts tests/mentor-domain.test.ts`

Expected: all focused unit tests pass.

### Task 3: Reconcile the complete database contract

**Files:**
- Modify: `lib/supabase/database.types.ts`
- Modify: `supabase/tests/bootstrap.sql`
- Modify: `supabase/tests/auth_security.sql`
- Modify: `supabase/tests/mentor_invites.sql`
- Modify: `scripts/test-database.ts`
- Preserve: `supabase/migrations/202609120001_marketing_hero_posters.sql`
- Preserve: `supabase/migrations/202609130001_mentor_domain.sql`
- Preserve: `supabase/tests/marketing_hero_posters.sql`
- Preserve: `supabase/tests/mentor_domain.sql`

**Interfaces:**
- Consumes: Auth/Product Catalog base schema, `touch_updated_at()`, `is_admin()`, profiles, invites, and Storage schema.
- Produces: typed Marketing Hero Poster and Mentor Domain tables/RPCs plus one database test bootstrap capable of exercising both.

- [ ] **Step 1: Retain a failing union contract before editing types**

Ensure TypeScript consumers reference both `MarketingHeroPoster` and
`ManagedMentor`, while the SQL runner lists both test files.

- [ ] **Step 2: Run typecheck/database bootstrap and observe RED if either union is incomplete**

Run: `pnpm typecheck`

Run: `pnpm test:db -- --bootstrap`

Expected: an incomplete merged type/schema/test contract fails; an unavailable local database is recorded as an environment block rather than altered remotely.

- [ ] **Step 3: Resolve database types as an explicit union**

Keep `MarketingHeroPoster`, `marketing_hero_posters`, and
`reorder_marketing_hero_posters` alongside `MentorTier`, `MentorProfile`,
`MentorAvailabilityRule`, `ManagedMentor`, all three Mentor Domain tables, and
all Mentor Domain RPCs. Keep invite tier fields and existing Auth/Product
Catalog definitions.

- [ ] **Step 4: Merge SQL bootstrap and fixtures**

Retain Storage prerequisites for hero posters and tier-aware invitation fixtures
for Mentor Domain. Keep every assertion in both domain suites.

- [ ] **Step 5: Run typecheck and local database tests and verify GREEN**

Run: `pnpm typecheck`

Run: `pnpm test:db -- --bootstrap`

Expected: TypeScript passes and all migrations/tests pass against a disposable local database, or the database command is accurately marked blocked by local tooling.

### Task 4: Remove verified artifacts and audit remaining prototypes

**Files:**
- Delete: `.emergent/**`
- Delete: `.gitconfig`
- Delete: `output/**`
- Delete: `test_reports/**`
- Delete: `design_guidelines.json`
- Delete: `pnpm-workspace.yaml`
- Review: `lib/demo-store.ts` and every `localStorage` consumer.

**Interfaces:**
- Consumes: the provenance audit recorded in the spec.
- Produces: a clean product repository with durable tests retained and remaining authenticated prototypes documented.

- [ ] **Step 1: Verify no application/tooling references each artifact**

Run: `rg -n "\.emergent|design_guidelines|test_reports|pnpm-workspace|output/" --glob '!docs/superpowers/**'`

Expected: no product or repository-tooling dependency requires the listed artifacts.

- [ ] **Step 2: Remove the verified artifact paths with explicit targets**

Delete only the exact tracked paths listed in this task; retain all source tests and approved assets.

- [ ] **Step 3: Audit mock persistence boundaries**

Run: `rg -n "demo-store|localStorage|DemoOrder|demo dashboard|legacy checkout" app components lib tests`

Expected: remaining occurrences are authenticated operational prototypes or tests, never Hero Poster persistence or public production facts.

### Task 5: Verify the complete application and local/hosted database boundary

**Files:**
- Modify only files implicated by a reproducible failing test, with a failing regression test first.

**Interfaces:**
- Consumes: the resolved integration tree.
- Produces: evidence for every required validation lane and a non-destructive hosted-state report.

- [ ] **Step 1: Run unit, static, and production verification**

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: every command passes.

- [ ] **Step 2: Run browser verification**

Run: `pnpm exec playwright test --workers 3`

Expected: public marketing, redirects, auth guards, responsive navigation, mentor modal, FAQ, WhatsApp, and program detail tests pass.

- [ ] **Step 3: Inspect Supabase CLI state without exposing credentials**

```powershell
supabase --version
supabase status
supabase projects list
supabase migration list
supabase db push --help
```

Expected: mutate nothing unless authenticated state and the linked project are unambiguous and migration history has no unexpected drift.

- [ ] **Step 4: Exercise graceful and full Hero Poster behavior where supported**

Confirm homepage fallback without the table, then use the local migrated schema
for table/bucket/policy tests. Do not claim hosted state from repository files.

### Task 6: Audit, commit, push, and create the PR

**Files:**
- Modify: documentation only if factual validation results need recording.

**Interfaces:**
- Consumes: a fully verified integration tree.
- Produces: the final `emergent-qq` commit and an unmerged PR to `main`.

- [ ] **Step 1: Run final integrity and secret checks**

```powershell
git status --short
$conflictTokens = @(('<' * 7), ('=' * 7), ('>' * 7))
$conflictTokens | ForEach-Object { git grep -n --fixed-strings $_ }
git diff --check
git diff origin/main...HEAD --stat
git log --oneline origin/main..HEAD
```

Inspect `git diff --cached` and scan staged additions for environment files,
Supabase/JWT/service-role keys, database passwords, tokens, cookies, GitHub
credentials, and credential-bearing URLs without printing secret values.

- [ ] **Step 2: Commit the semantic integration**

Run: `git commit` using a descriptive merge/integration message after all staged files are reviewed.

- [ ] **Step 3: Push normally to the source branch**

Run: `git push origin HEAD:emergent-qq`

Expected: a normal non-force update succeeds.

- [ ] **Step 4: Create and inspect the pull request**

Run `gh pr create --base main --head emergent-qq` with the verified summary,
database status, test results, blockers, retained prototypes, and removed
artifacts. Inspect mergeability with `gh pr view` and stop without merging.
