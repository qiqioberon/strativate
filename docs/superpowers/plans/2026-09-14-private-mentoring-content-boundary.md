# Private Mentoring Content Boundary Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the Phase 3 regression so Private Mentoring marketing/editorial content is source-owned again while real catalog, operational, and Shared Commerce data remain database-owned, with the pre-Phase-3 Program UI restored.

**Architecture:** Restore `lib/program-information.ts` and `lib/content/services.ts` as the static marketing source. Narrow the Private Mentoring server boundary to catalog records only: packages, learning paths, session focuses, and competition categories. Add one forward-only migration that removes the obsolete marketing-CMS tables and their parent columns after replacing the Shared Commerce resolver dependency. Preserve enrollments, sessions, Cart Links, payment fulfillment, and per-session admin scheduling unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.7, Supabase/PostgreSQL, Shared Commerce/Midtrans, Node test runner, Playwright.

**Spec:** User-supplied corrective brief, `Teks yang ditempel (1)(20260914-145532).txt`, 14 September 2026; pre-Phase-3 frontend reference commit `631d21337e2f5d186d6e4cf9214b78117bff1530`.

## Global Constraints

- Work from merged `main` commit `f4386dc5f23b7abb53acc7c0af327d1f5845ad8f` on `fix/private-mentoring-content-boundary`.
- Do not rewrite migrations `202609140009_phase3_private_mentoring.sql` or `202609140010_phase3_private_mentoring_admin_schedule.sql`.
- Static marketing owns title, slug, homepage/service-card copy, kicker, detail/hero copy, audience, highlights, journey, CTA and section-heading copy.
- Database owns packages, session focuses/topics, learning paths, competition categories, enrollments, sessions and existing operations.
- Keep Shared Commerce, carts, checkout, order snapshots, payment fulfillment and generic Admin Cart Links.
- Top Student 3 sessions remains `885000` total, `950000` reference, `295000/session` derived.
- No self-service mentor picker or schedule picker; mentee focus selection and admin same-tier scheduling stay intact.
- Preserve Intensive Mentoring's static/editorial behavior.
- Restore `/program` and `/program/private-mentoring` to the pre-Phase-3 visual language; add only catalog presentation required by Phase 3.

---

### Task 1: Lock the corrected ownership boundary with failing tests

**Files:**
- Create: `tests/private-mentoring-content-boundary.test.ts`
- Modify: `tests/private-mentoring-public-runtime.test.ts`
- Modify: `tests/private-mentoring-admin-ui.test.ts`
- Modify: `.github/workflows/phase3-private-mentoring-verify.yml`

**Interfaces:**
- Consumes: current merged Phase 3 implementation.
- Produces: executable assertions that static editorial is source-owned, catalog remains DB-owned, and the obsolete CMS has a forward cleanup migration.

- [ ] Add assertions that `lib/program-information.ts` owns the Private Mentoring editorial object and that `/` and `/program` do not query Private Mentoring DB data.
- [ ] Add assertions that the server boundary queries only packages, learning paths, session focuses, categories and mentor tiers for public catalog data.
- [ ] Add assertions that the Admin component has no title/kicker/audience/highlight/journey editor while retaining packages, session topics, learning paths and competition categories.
- [ ] Add assertions for a new corrective migration that replaces the resolver dependency and removes the three obsolete CMS tables without editing historical migrations.
- [ ] Run the branch verification workflow and confirm the new tests fail specifically because the regression still exists.

### Task 2: Restore static editorial and old public Program presentation

**Files:**
- Modify: `lib/program-information.ts`
- Modify: `lib/content/services.ts`
- Modify: `app/page.tsx`
- Modify: `components/marketing/home-page.tsx`
- Modify: `app/program/page.tsx`
- Modify: `app/program/[slug]/page.tsx`
- Modify: `components/programs/program-detail.tsx`
- Modify: `app/layout.tsx`
- Delete: `app/private-mentoring.css`

**Interfaces:**
- Consumes: pre-Phase-3 static editorial and existing `ProgramDetail` design classes.
- Produces: static `ProgramEditorial` for both Private and Intensive Mentoring plus old public composition with catalog injection only on the Private detail route.

- [ ] Restore the exact pre-Phase-3 Private Mentoring editorial object and service-card copy from commit `631d213...`.
- [ ] Restore homepage and `/program` composition from `631d213...`, removing unnecessary Private Mentoring DB reads.
- [ ] Make metadata and hero/audience/highlights/journey use `getProgramEditorialBySlug()` again.
- [ ] Keep the old detail-page section order and design language; render DB learning paths/focuses with existing `program-info-card` grids and packages with existing `program-price-table` styling.
- [ ] Keep WhatsApp CTA, marketing mentor-preference wording, and absence of mentor/schedule pickers.
- [ ] Remove the Phase 3-only stylesheet once no runtime component uses its classes.

### Task 3: Narrow the Private Mentoring application boundary to catalog data

**Files:**
- Modify: `lib/private-mentoring/types.ts`
- Modify: `lib/private-mentoring/server.ts`
- Modify: `app/dashboard/page.tsx`
- Modify: `components/dashboard/private-mentoring-sessions.tsx` only if type imports require it
- Modify: `tests/fixtures/commerce-backend/server.mjs`

**Interfaces:**
- Produces: `getPublicPrivateMentoringCatalog(): Promise<PrivateMentoringCatalogView | null>` and existing `listMyPrivateMentoringSessions()`.
- `PrivateMentoringCatalogView` contains only `packages`, `learningPaths`, `sessionFocuses`, and `competitionCategories`.

- [ ] Replace the giant DB marketing-page view with a catalog-only typed view.
- [ ] Derive `pricePerSession` from authoritative `price_amount / session_count` in the server view model.
- [ ] Keep dashboard focus options DB-backed without reintroducing marketing DB queries.
- [ ] Remove obsolete marketing-table endpoints/data from the deterministic browser fixture while retaining catalog endpoints.
- [ ] Run focused unit tests and ensure the corrected boundary is green.

### Task 4: Remove the CMS schema through a forward-only corrective migration

**Files:**
- Create: `supabase/migrations/202609140011_private_mentoring_content_boundary.sql`
- Modify: `lib/supabase/database.types.ts`
- Modify: `supabase/tests/private_mentoring.sql`
- Modify: `tests/private-mentoring-migration.test.ts`

**Interfaces:**
- Consumes: schema resulting from migrations 009 and 010.
- Produces: catalog tables without `program_id`, a Private-Mentoring-aware `resolve_commerce_item(uuid)` with no marketing-table dependency, and no obsolete CMS tables.

- [ ] Replace `resolve_commerce_item(uuid)` so Private Mentoring name/slug/description/availability derive from package + mentor tier + stable fixed product identity only.
- [ ] Drop `program_id` FK/columns from learning paths and session focuses, then drop journey/highlights/program marketing tables.
- [ ] Remove obsolete CMS table types and preserve catalog/admin/operational types.
- [ ] Update SQL tests to assert the final schema has no CMS tables, no browser mutation path for marketing copy, exact package prices, and unchanged operations/Cart Link behavior.
- [ ] Run fresh bootstrap DB tests so both historical migrations and the corrective migration execute in order.

### Task 5: Correct Admin catalog UI and documentation

**Files:**
- Modify: `components/admin/private-mentoring-management.tsx`
- Modify: `docs/strativate/source-conflicts.md`
- Modify: `docs/strativate/asset-status.md`

**Interfaces:**
- Admin reads/mutates only `private_mentoring_packages`, `private_mentoring_learning_paths`, `private_mentoring_session_focuses`, `competition_categories`, and mentor-tier display data.

- [ ] Remove all program/highlight/journey marketing-content queries and mutation controls.
- [ ] Rename the surface to `Private Mentoring Catalog` and retain editing of package configuration, session topics, learning paths and competition categories.
- [ ] Keep package tier/session-count immutable and preserve active/order/price/reference/duration/max-participant controls.
- [ ] Update docs to state static marketing + DB catalog ownership and record that no new image assets are required.

### Task 6: Browser regression, full verification, review, and PR

**Files:**
- Modify: `tests/browser/program-information.spec.ts`
- Modify: `.github/workflows/phase3-private-mentoring-verify.yml` as needed for the corrective branch.

**Interfaces:**
- Browser fixture supplies only catalog records required by public detail tests.

- [ ] Verify `/program` preserves its pre-Phase-3 primary/secondary/supporting hierarchy, journey and consultation band.
- [ ] Verify `/program/private-mentoring` uses static hero/audience/highlights/journey plus DB paths/topics/categories/packages, including `Rp885.000` and derived `Rp295.000/session`.
- [ ] Verify no direct checkout, mentor picker or schedule picker exists and WhatsApp CTA remains.
- [ ] Run `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`, repository-canonical DB bootstrap tests, builds with Digital Products both disabled/enabled, `pnpm exec playwright test`, and `git diff --check` through CI/local tooling available to this environment.
- [ ] Search runtime/admin code for `private_mentoring_programs`, `private_mentoring_highlights`, and `private_mentoring_journey_steps`; only historical migration/tests documenting their removal may remain.
- [ ] Compare branch against latest `main`; if `main` moved, integrate safely and rerun verification.
- [ ] Request code review, create PR `Fix Private Mentoring content ownership and restore program UI`, and report exact verification evidence.