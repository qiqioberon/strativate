# Phase 3 Private Mentoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the domain-owned Private Mentoring product, database-backed public information, admin-assisted cart-link commerce, paid enrollment/session operations, and role-correct dashboards without reviving the retired generic Product Catalog.

**Architecture:** Private Mentoring owns editorial/master/package/enrollment/session data. Existing `mentor_tiers` and `mentor_profiles` remain the mentor source of truth, while Shared Commerce remains the thin `commerce_items -> carts -> orders -> payment_attempts` bridge. Public pages consume a server-side Private Mentoring view model; operational mutations are database-authorized RPCs with RLS and idempotent constraints.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.7, Supabase/PostgreSQL, Midtrans Shared Commerce, Node test runner, Playwright.

**Spec:** User-supplied Phase 3 implementation brief and Private Mentoring Guidebook (English), 14 September 2026.

## Global Constraints

- Private Mentoring package identity is only mentor tier × session count.
- Reuse `mentor_tiers`; never create a second mentor-tier master.
- Never create generic Product Catalog, generic offering, custom quote, custom price, self-service mentor selection, self-service scheduling, custom session focus, mentor expertise mapping, promo, subscription, chat, Zoom, or automatic matching systems.
- `commerce_items` is a thin identity registry; Private Mentoring remains authoritative for package names, prices, availability, and entitlement.
- Top Student 3 sessions is total `885000`; per-session price is derived as `295000`. Never persist or display `285000` as authoritative runtime pricing.
- Duration is 75 minutes; package supports up to 4 participants.
- Mentee selects a seeded Session Focus only. Admin selects mentor and confirmed schedule per session. Mentor must match the purchased package tier.
- Private Mentoring public content moves to the database; Intensive Mentoring remains in its present architecture.
- Migrations are forward-only; no production mutation or real payment API calls.

---

### Task 1: Phase 3 schema, seeds, security, and Shared Commerce resolver

**Files:**
- Create: `supabase/migrations/202609140009_phase3_private_mentoring.sql`
- Create: `supabase/tests/private_mentoring.sql`
- Modify: `scripts/test-database.ts`
- Test: `tests/private-mentoring-migration.test.ts`

**Interfaces:**
- Consumes: `mentor_tiers`, `mentor_profiles`, `commerce_items`, `orders`, `order_items`, `touch_updated_at()`, `is_admin()`, `current_completed_mentee_id()`.
- Produces: Private Mentoring public/master tables; `competition_categories`; `commerce_cart_links`; enrollments; sessions; Private Mentoring-aware `resolve_commerce_item(uuid)`; cart-link, enrollment, session RPCs.

- [ ] Write static and SQL tests for exact seed counts/prices, RLS, no duplicate masters, no forbidden fields/tables, resolver behavior, cart-link security/idempotency, paid enrollment fulfillment, entitlement limits, focus authority, tier-safe admin scheduling, and immutable historical snapshots.
- [ ] Run the unit/DB suite and verify Phase 3 tests fail because the migration does not exist yet.
- [ ] Add the forward-only migration with deterministic seeds, constraints, triggers, RLS and least-privilege RPC grants.
- [ ] Run the unit/DB suite until the new Phase 3 tests pass without changing older Digital Product behavior.

### Task 2: Typed Private Mentoring application boundary

**Files:**
- Create: `lib/private-mentoring/types.ts`
- Create: `lib/private-mentoring/server.ts`
- Create: `lib/private-mentoring/cart-links.ts`
- Modify: `lib/supabase/database.types.ts`
- Test: `tests/private-mentoring-public-runtime.test.ts`

**Interfaces:**
- Produces: `getPublicPrivateMentoring()`, `listMyPrivateMentoringSessions()`, `createAdminCartLink()` and strongly typed view models.
- Consumes: server Supabase client, admin client only where a server-only secret boundary is required.

- [ ] Write tests asserting a focused application layer exists and no UI scatters business-truth pricing logic.
- [ ] Verify tests fail first.
- [ ] Add typed queries/view-model assembly and derive per-session price from total/session count.
- [ ] Keep public retrieval graceful: return an unavailable state rather than fabricated business content when the DB cannot be read.
- [ ] Update generated/manual database type definitions for all new tables and RPC return types.

### Task 3: Database-backed public Private Mentoring pages

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/marketing/home-page.tsx`
- Modify: `app/program/page.tsx`
- Modify: `app/program/[slug]/page.tsx`
- Modify: `components/programs/program-detail.tsx`
- Modify: `lib/program-information.ts`
- Modify: `app/program-information.css`
- Test: `tests/browser/program-information.spec.ts`

**Interfaces:**
- Consumes: `getPublicPrivateMentoring()`.
- Preserves: existing ProgramCard, ServiceCard, ProgramDetail shell, MarketingShell, responsive layout and Intensive Mentoring behavior.

- [ ] Change browser/static tests first to require DB-backed Private Mentoring and its package matrix while retaining the Intensive placeholder.
- [ ] Verify the changed tests fail first.
- [ ] Feed Private Mentoring DB data into `/`, `/program`, and `/program/private-mentoring` while leaving other services on their current sources.
- [ ] Render exact learning paths, focuses, competition categories, packages grouped by tier, reference totals, 75-minute duration, and up-to-4 team size.
- [ ] Preserve WhatsApp as the sales CTA and preserve mentor-preference marketing copy without adding a mentor picker or schedule picker.

### Task 4: Secure generic Admin Cart Links

**Files:**
- Create: `app/api/admin/cart-links/route.ts`
- Create: `app/cart-link/[token]/route.ts`
- Create: `components/admin/commerce-cart-link-management.tsx`
- Modify: `app/auth/continue/route.ts`
- Modify: `app/admin/page.tsx`
- Modify: `app/cart/page.tsx`
- Modify: `components/commerce/cart-view.tsx`
- Test: `tests/private-mentoring-admin-ui.test.ts`

**Interfaces:**
- Admin generates raw cryptographically random token once; database stores only SHA-256 token hash.
- Cart-link claim is user-bound, atomic, idempotent and inserts only currently available referenced commerce items.

- [ ] Write tests for no manual UUID entry, mixed-domain selection, hash-only persistence and safe return-through-auth.
- [ ] Verify tests fail first.
- [ ] Implement admin search/select/generate/copy UI and server token generation.
- [ ] Implement exact internal return cookie for unauthenticated claims without accepting arbitrary `next`/`returnTo` URLs.
- [ ] Remove the Digital-Product-only gate from the shared `/cart` route and label Private Mentoring cart rows correctly.

### Task 5: Paid enrollment, mentee focus, and admin session scheduling

**Files:**
- Create: `components/dashboard/private-mentoring-sessions.tsx`
- Create: `components/admin/private-mentoring-session-management.tsx`
- Create: `components/admin/private-mentoring-management.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `app/dashboard/dashboard-client.tsx`
- Modify: `app/admin/page.tsx`
- Test: `tests/private-mentoring-dashboard-ui.test.ts`

**Interfaces:**
- Payment DB transition creates one enrollment per paid Private Mentoring order item and exactly the purchased number of session rows.
- Mentee can only choose an active seeded focus; admin can assign a same-tier active mentor and confirmed schedule; scheduling alone does not consume entitlement.

- [ ] Write UI/static tests that reject the old mentee self-scheduling controls.
- [ ] Verify tests fail first.
- [ ] Show real Private Mentoring sessions in the mentee dashboard with focus controls only and read-only confirmed mentor/schedule.
- [ ] Add Private Mentoring admin content/package management with deactivation instead of destructive package deletion.
- [ ] Add admin operational session scheduling controls filtered by the required mentor tier.

### Task 6: Deterministic browser fixtures, docs, and final verification

**Files:**
- Modify: `tests/fixtures/commerce-backend/server.mjs`
- Create: `tests/browser/private-mentoring-phase3.spec.ts`
- Create: `.github/workflows/phase3-private-mentoring-verify.yml`
- Modify: `docs/strativate/source-conflicts.md`
- Modify: `docs/strativate/asset-status.md`

**Interfaces:**
- Browser fixture emulates only deterministic Supabase/Auth behavior; it never calls production Supabase or Midtrans.

- [ ] Extend the fixture for Private Mentoring public data, cart-link claim and session-focus surfaces used by browser tests.
- [ ] Record the stakeholder resolution: Top Student 3 sessions total 885000 / derived 295000 and WhatsApp consultation → admin cart link → normal checkout.
- [ ] Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test:db -- --bootstrap`, both storefront builds, and `pnpm exec playwright test` in the Phase 3 verification workflow.
- [ ] Review `git diff --check`, the complete diff, forbidden architecture names, credentials, migration ordering and source-of-truth duplication.
- [ ] Fetch current `origin/main`, integrate safely if it moved, rerun verification, push, request review, and create the PR only after fresh evidence is green.
