# Mentoring Catalog Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace inline Private Mentoring catalog editing with safe CRUD tables/modals, add a domain-owned Intensive Mentoring catalog, promote Competition Categories into a shared admin master, and render approved database-backed commercial data on the public mentoring pages.

**Architecture:** Keep Private Mentoring's existing domain tables and editorial/content boundary. Add explicit Intensive Mentoring domain tables and a typed server loader rather than reviving the retired generic Product Catalog. Admin pages use existing sortable-table, pagination, toolbar, badge, and native-dialog patterns; public pages keep source-backed editorial copy and inject database-backed catalog data only on dedicated mentoring detail routes.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript 5.7, Supabase/Postgres with RLS, existing CSS modules/global program CSS, Node test runner + tsx.

**Spec:** `docs/superpowers/specs/2026-09-16-mentoring-catalog-management-design.md`

## Global Constraints

- Work only on `feat/mentoring-catalog-management`, created from the latest `main` at `8d4ff81bf9b77cc08e0a9cb1fad15095d07787d8`.
- User requires at most three commits for the entire feature. The design and this plan consume two commits, so all implementation changes must ship in exactly one remaining bulk commit.
- Do not recreate the retired generic Product Catalog architecture.
- Private Mentoring editorial/marketing copy remains source-code owned; only true catalog/operational records are database-owned.
- Public commercial claims must be source-backed. The request explicitly approves using the supplied 2026 Private and Intensive guidebooks for package/add-on/bundle names and prices, but the repository's legal guardrail still blocks publishing refund/credit promises or detailed guarantee terms without separate legal approval.
- Therefore seed and manage the guidebook's `Win Guarantee Protection`/`Competition Assurance` records as admin-visible but inactive by default, and do not publish refund/credit language. Other approved guidebook package/add-on/bundle records may be active.
- Private Top Student 3-session package remains Rp885.000 total, Rp950.000 reference, with per-session price derived at runtime.
- Use existing `SortableTableHeader`, `TablePagination`, table-scroll, toolbar, badge, and `<dialog>` patterns.
- Tables are for scanning/comparison; create/edit uses modal dialogs rather than permanent inline editing.
- Safe delete: hard-delete only unreferenced master rows; referenced historical rows must be deactivated instead.
- Homepage `/` and `/program` remain high-level discovery surfaces; full DB-backed catalog appears only on `/program/private-mentoring` and `/program/intensive-mentoring`.
- No Intensive Mentoring checkout, entitlement, scheduling, or payment lifecycle is added in this feature.
- Before claiming completion, re-check latest `main`, run available verification, and document any verification that cannot be executed in this harness.

---

## File Structure

### Database/domain
- Create `supabase/migrations/202609160002_mentoring_catalog_management.sql` — Intensive catalog schema/RLS/seeds plus helper RPCs for safe admin CRUD of shared/private masters.
- Modify `lib/supabase/database.types.ts` — add Intensive table row/insert/update types.
- Create `lib/intensive-mentoring/types.ts` — public Intensive catalog view models.
- Create `lib/intensive-mentoring/server.ts` — server-only active public catalog loader.
- Keep `lib/private-mentoring/server.ts` as the Private public loader, changing only error/sorting behavior if needed.

### Admin
- Replace `components/admin/private-mentoring-management.tsx` — internal tabs, paginated/sortable tables, modal CRUD for learning paths/session topics, package edit modal.
- Create `components/admin/intensive-mentoring-management.tsx` — packages/add-ons/bundles tables and modal CRUD.
- Create `components/admin/competition-category-management.tsx` — shared category CRUD table/modal.
- Create `components/admin/mentoring-catalog-management.module.css` — shared focused styles for mentoring catalog tabs, dialogs, repeatable lists, and responsive table layouts while reusing `data-management.module.css` primitives.
- Modify `app/admin/page.tsx` — add Intensive Mentoring and Competition Categories product navigation entries and route components.

### Public
- Modify `app/program/[slug]/page.tsx` — load Intensive catalog only for the Intensive detail route, while keeping Private loader behavior.
- Modify `components/programs/program-detail.tsx` — render Private catalog and new Intensive packages/add-ons/bundles/shared categories with responsive public presentation and fallback states.
- Modify the existing program/detail stylesheet that owns `.program-*` pricing/card classes (determine exact file before editing) — add responsive Intensive cards and mobile-safe Private pricing behavior.

### Documentation / guardrails
- Modify `docs/strativate/source-conflicts.md` — record 16 Sep 2026 requester approval for guidebook package/add-on/bundle naming/pricing while keeping guarantee/refund legal wording blocked.

### Tests
- Create `tests/mentoring-catalog-migration.test.ts` — schema, constraints, RLS, seeds, legal guardrail, and safe CRUD helpers.
- Create `tests/mentoring-catalog-admin-ui.test.ts` — navigation, tables, sorting/pagination, modal CRUD, removal of inline edit layout.
- Create `tests/intensive-mentoring-public-runtime.test.ts` — explicit Intensive loader and public rendering; homepage remains high-level.
- Modify `tests/private-mentoring-public-runtime.test.ts` only if current assertions need extension for the redesigned public/private presentation without changing its source ownership boundary.

---

### Task 1: Lock source/legal guardrails with failing tests

**Files:**
- Create: `tests/mentoring-catalog-migration.test.ts`
- Create: `tests/mentoring-catalog-admin-ui.test.ts`
- Create: `tests/intensive-mentoring-public-runtime.test.ts`
- Modify: `docs/strativate/source-conflicts.md`

**Interfaces:**
- Consumes: existing source-conflict policy, existing Private migration/table names, admin page navigation patterns.
- Produces: executable source assertions that define the schema/UI/runtime contract for later tasks.

- [ ] **Step 1: Write migration contract tests**

Create tests that read `supabase/migrations/202609160002_mentoring_catalog_management.sql` and assert it contains:

```ts
for (const table of [
  'intensive_mentoring_packages',
  'intensive_mentoring_package_features',
  'intensive_mentoring_add_ons',
  'intensive_mentoring_add_on_features',
  'intensive_mentoring_bundles',
  'intensive_mentoring_bundle_items',
]) assert.match(sql, new RegExp(`create table public\\.${table}`))

assert.match(sql, /pricing_mode text not null check \(pricing_mode in \('fixed','consultation'\)\)/)
assert.match(sql, /item_type text not null check \(item_type in \('package','add_on','feature'\)\)/)
assert.match(sql, /enable row level security/)
assert.match(sql, /public\.is_admin\(\)/)
assert.match(sql, /Intensive/)
assert.match(sql, /1150000/)
assert.match(sql, /1400000/)
assert.match(sql, /Super Intensive/)
assert.match(sql, /2200000/)
assert.match(sql, /2800000/)
assert.match(sql, /Detailed Performance Report/)
assert.match(sql, /150000/)
assert.match(sql, /Judging Simulation/)
assert.match(sql, /300000/)
assert.match(sql, /Skill Builder/)
assert.match(sql, /1250000/)
assert.match(sql, /Competition Ready/)
assert.match(sql, /2500000/)
assert.match(sql, /Win Guarantee Protection[\s\S]*false/)
assert.match(sql, /Competition Assurance[\s\S]*false/)
assert.doesNotMatch(sql, /refund or credit/i)
```

Also assert the migration creates admin-safe CRUD helpers for shared/private masters, with deterministic identifier generation and delete returning a referenced/deactivate-required result rather than cascading through history.

- [ ] **Step 2: Write admin UI contract tests**

Assert `app/admin/page.tsx` contains Product navigation for Private Mentoring, Intensive Mentoring, Competition Categories, and Produk Digital. Assert each management component uses `SortableTableHeader`, `TablePagination`, and `<dialog`, and that the Private component no longer renders the old permanent inline `private-mentoring-catalog-row` / `private-mentoring-package-row` editor layout.

- [ ] **Step 3: Write public runtime contract tests**

Assert `app/program/[slug]/page.tsx` imports and calls `getPublicIntensiveMentoringCatalog` only for `intensive-mentoring`; assert `components/programs/program-detail.tsx` accepts an `intensiveMentoringCatalog` prop and renders package/add-on/bundle sections; assert `components/marketing/home-page.tsx` does not import the Intensive catalog loader.

- [ ] **Step 4: Update the conflict register before implementation**

Add a dated resolution note that the current requester approved using the supplied Intensive guidebook names/prices for the domain catalog, but `Win Guarantee Protection`, `Competition Assurance`, refund/credit promises, and detailed guarantee terms remain inactive/not public until legal approval is supplied.

- [ ] **Step 5: Verification checkpoint**

Run the three new test files with:

```bash
node --import tsx --test tests/mentoring-catalog-migration.test.ts tests/mentoring-catalog-admin-ui.test.ts tests/intensive-mentoring-public-runtime.test.ts
```

Expected before implementation: FAIL because the migration/components/loader do not exist yet.

Do not commit yet; the user requires one remaining bulk implementation commit.

---

### Task 2: Add normalized Intensive catalog schema, policies, seeds, and types

**Files:**
- Create: `supabase/migrations/202609160002_mentoring_catalog_management.sql`
- Modify: `lib/supabase/database.types.ts`
- Create: `lib/intensive-mentoring/types.ts`
- Create: `lib/intensive-mentoring/server.ts`
- Test: `tests/mentoring-catalog-migration.test.ts`
- Test: `tests/intensive-mentoring-public-runtime.test.ts`

**Interfaces:**
- Produces:
  - `getPublicIntensiveMentoringCatalog(): Promise<IntensiveMentoringCatalogView | null>`
  - `IntensiveMentoringCatalogView`
  - typed Supabase rows for all six new tables.
- Consumes: `createClient()` from `@/lib/supabase/server`, existing `public.is_admin()`, `public.touch_updated_at()`.

- [ ] **Step 1: Implement the forward-only migration**

Create all six normalized tables with UUID primary keys, trimmed-length checks, nonnegative `sort_order`, `is_active`, timestamps, and `touch_updated_at` triggers.

For packages use:

```sql
pricing_mode text not null check (pricing_mode in ('fixed','consultation')),
price_amount bigint,
reference_price_amount bigint,
check (
  (pricing_mode = 'fixed' and price_amount is not null and price_amount > 0)
  or
  (pricing_mode = 'consultation' and price_amount is null and reference_price_amount is null)
),
check (reference_price_amount is null or reference_price_amount >= price_amount)
```

For bundle items enforce one payload matching `item_type` with a single check constraint.

- [ ] **Step 2: Add RLS and grants**

For every new table:

```sql
alter table public.<table> enable row level security;
revoke all on public.<table> from anon, authenticated;
grant select on public.<table> to anon, authenticated;
grant insert, update, delete on public.<table> to authenticated;
```

Public SELECT policies expose only active rows whose active parent is public. Admin SELECT policy permits `public.is_admin()`. Mutation policies require `public.is_admin()`.

- [ ] **Step 3: Add safe admin helper RPCs for shared/private masters**

Provide security-definer helpers for creating/updating/deleting:

```sql
public.admin_upsert_private_mentoring_learning_path(...)
public.admin_upsert_private_mentoring_session_focus(...)
public.admin_upsert_competition_category(...)
public.admin_delete_mentoring_master(p_table text, p_id uuid)
```

Each helper starts with:

```sql
if not public.is_admin() then
  raise exception 'Admin access required' using errcode = '42501';
end if;
```

On create, normalize identifiers from the submitted name using lowercase/regexp replacement for slug and uppercase underscore replacement for code, and reject collisions clearly. On edit, preserve existing code/slug. Delete helper checks references from `private_mentoring_enrollments` / `private_mentoring_sessions` before deleting and returns a small result indicating `deleted` or `deactivate_required`.

- [ ] **Step 4: Seed approved catalog rows**

Seed active guidebook-backed:

- Intensive 4 sessions/month — 1,150,000 / reference 1,400,000;
- Super Intensive 8 sessions/month — 2,200,000 / reference 2,800,000;
- International Competition — consultation pricing;
- Detailed Performance Report — 150,000;
- Judging Simulation — 300,000;
- Skill Builder — 1,250,000;
- Competition Ready — 2,500,000.

Seed `Win Guarantee Protection` at 500,000 and `Competition Assurance` at 3,000,000 as `is_active = false`. Do not seed refund/credit promises or detailed legal terms.

Populate package/add-on features and bundle composition using only statements supported by the supplied guidebook, excluding blocked guarantee/refund language.

- [ ] **Step 5: Extend TypeScript database types**

Add interfaces and `Database['public']['Tables']` entries for all six new tables. Keep insert/update optionality consistent with existing manual database type style.

- [ ] **Step 6: Implement public Intensive loader**

Create `lib/intensive-mentoring/types.ts` with:

```ts
export type IntensiveMentoringFeatureView = { id:string; text:string; sortOrder:number }
export type IntensiveMentoringPackageView = { id:string; code:string; slug:string; name:string; description:string; competitionScope:'national'|'international'; sessionsPerMonth:number|null; pricingMode:'fixed'|'consultation'; priceAmount:number|null; referencePriceAmount:number|null; sortOrder:number; features:IntensiveMentoringFeatureView[] }
export type IntensiveMentoringAddOnView = { id:string; code:string; slug:string; name:string; description:string; priceAmount:number; termsNote:string|null; sortOrder:number; features:IntensiveMentoringFeatureView[] }
export type IntensiveMentoringBundleItemView = { id:string; itemType:'package'|'add_on'|'feature'; label:string; sortOrder:number }
export type IntensiveMentoringBundleView = { id:string; code:string; slug:string; name:string; description:string; priceAmount:number; badgeText:string|null; sortOrder:number; items:IntensiveMentoringBundleItemView[] }
export type IntensiveMentoringCatalogView = { packages:IntensiveMentoringPackageView[]; addOns:IntensiveMentoringAddOnView[]; bundles:IntensiveMentoringBundleView[]; competitionCategories:{id:string;code:string;slug:string;name:string;sortOrder:number}[] }
```

`getPublicIntensiveMentoringCatalog()` performs the necessary ordered selects, groups active child rows under parents, filters invalid/inactive bundle references defensively, and returns `null` on catalog load failure so the public page can retain editorial fallback behavior.

- [ ] **Step 7: Verification checkpoint**

Run migration/public tests. Expected: schema/type/loader assertions pass.

Do not commit yet.

---

### Task 3: Rebuild Private admin CRUD and shared Competition Categories

**Files:**
- Replace: `components/admin/private-mentoring-management.tsx`
- Create: `components/admin/competition-category-management.tsx`
- Create: `components/admin/mentoring-catalog-management.module.css`
- Modify: `app/admin/page.tsx`
- Test: `tests/mentoring-catalog-admin-ui.test.ts`

**Interfaces:**
- Consumes: existing `SortableTableHeader`, `TablePagination`, `createClient`, new master RPCs.
- Produces: clean admin views for Private and Competition Categories.

- [ ] **Step 1: Build shared local catalog UI helpers**

In `mentoring-catalog-management.module.css`, define only feature-specific layout: page shell, tab bar, dialog/panel, form grid, repeatable rows, action cluster, destructive confirmation, and mobile stacking. Reuse `data-management.module.css` for generic page/surface/table/toolbar/badge styles rather than duplicating them.

- [ ] **Step 2: Replace Private inline editor with internal tabs**

State:

```ts
type PrivateTab = 'learning-paths' | 'session-topics' | 'packages'
```

Learning Paths and Session Topics each load all admin-visible rows, support search/status filter, client-side sortable columns, `TablePagination`, and modal create/edit. The modal calls the corresponding admin RPC. Delete calls `admin_delete_mentoring_master`; `deactivate_required` produces a clear message and leaves the row intact so the admin can set `is_active=false`.

- [ ] **Step 3: Implement Private package table/edit dialog**

Load mentor tiers + packages. Render sortable columns for tier/sessions/price/reference price/duration/status. `Kelola` opens a dialog where tier and session count are read-only while price, reference price, duration, max participants, sort order, and active state are editable. Reuse `validatePrivateMentoringPackageDraft()` before update.

- [ ] **Step 4: Create Competition Categories admin page**

Implement search, status filter, sort, pagination, create/edit dialog, active toggle/edit, and safe delete through the shared admin RPCs. UI copy states the categories are shared by Private and Intensive Mentoring.

- [ ] **Step 5: Update admin navigation**

Add `Intensive Mentoring` and `Competition Categories` to the Product section; wire `Competition Categories` to the new management component. Remove competition category editing from Private Management.

- [ ] **Step 6: Verification checkpoint**

Run `tests/mentoring-catalog-admin-ui.test.ts` plus existing admin sortable/pagination tests.

Do not commit yet.

---

### Task 4: Build Intensive Mentoring admin catalog management

**Files:**
- Create: `components/admin/intensive-mentoring-management.tsx`
- Reuse: `components/admin/mentoring-catalog-management.module.css`
- Modify: `app/admin/page.tsx`
- Test: `tests/mentoring-catalog-admin-ui.test.ts`

**Interfaces:**
- Consumes: new Intensive tables, existing sortable/pagination components.
- Produces: admin CRUD for packages, add-ons, bundles and their ordered child lists.

- [ ] **Step 1: Create tabbed Intensive page**

Use:

```ts
type IntensiveTab = 'packages' | 'add-ons' | 'bundles'
```

Each tab has count, search/status filters where useful, sortable columns, page state, and `TablePagination`.

- [ ] **Step 2: Package create/edit dialog**

Fields: name, description, competition scope, sessions/month, pricing mode, current/reference price, sort order, active state, ordered repeatable feature rows.

For `consultation`, disable and persist null price fields. Save parent first, then replace its child feature rows in one client workflow; if child save fails, surface an error and reload canonical DB state rather than claiming success.

- [ ] **Step 3: Add-on create/edit dialog**

Fields: name, description, additional price, optional terms note, sort order, active state, ordered feature rows. For the inactive guarantee record, include a visible admin note that legal/refund wording is intentionally not public-approved.

- [ ] **Step 4: Bundle create/edit dialog**

Fields: name, description, price, badge text, sort order, active state, repeatable bundle items. Each item chooses `package`, `add_on`, or `feature`; package/add-on types use selectors and feature type uses text. Prevent selecting inactive guarantee-linked entities for an active public bundle, and block activation of Competition Assurance while its guarantee/legal dependency remains inactive.

- [ ] **Step 5: Delete semantics**

Allow hard-delete for Intensive parents only when not referenced by another Intensive catalog row. When referenced, surface a message to deactivate/repair references. Child feature/item rows may be replaced/deleted because they are display composition, not operational history.

- [ ] **Step 6: Verification checkpoint**

Run admin UI contract test and typecheck when available.

Do not commit yet.

---

### Task 5: Integrate Intensive catalog into public mentoring detail UI

**Files:**
- Modify: `app/program/[slug]/page.tsx`
- Modify: `components/programs/program-detail.tsx`
- Modify: existing program detail CSS file owning `.program-*` classes
- Test: `tests/intensive-mentoring-public-runtime.test.ts`
- Modify if needed: `tests/private-mentoring-public-runtime.test.ts`

**Interfaces:**
- Consumes: `getPublicIntensiveMentoringCatalog()`, `IntensiveMentoringCatalogView`, existing `ProgramEditorial`, existing Private catalog.
- Produces: complete dedicated public catalog rendering with graceful fallback.

- [ ] **Step 1: Load Intensive catalog only on Intensive route**

In `app/program/[slug]/page.tsx`:

```ts
const privateMentoringCatalog = canonical === 'private-mentoring' ? await getPublicPrivateMentoringCatalog() : null
const intensiveMentoringCatalog = canonical === 'intensive-mentoring' ? await getPublicIntensiveMentoringCatalog() : null
```

Pass both to `ProgramDetail`.

- [ ] **Step 2: Extend ProgramDetail props and route-specific rendering**

Private sections remain source editorial + DB learning paths/session topics/packages/categories.

For Intensive render after journey:

- Packages & Pricing cards;
- Optional Add-Ons cards;
- Best-Value Bundles cards;
- shared Competition Categories;
- existing ProgramComparison/contact.

Fixed packages use `formatRupiah`; reference price uses `<del>` when present. Consultation package shows consultation copy/CTA and never `Rp0`.

- [ ] **Step 3: Respect legal publication guardrail**

Because the guarantee-dependent records are inactive by default, the public loader naturally excludes them. Do not hardcode Win Guarantee, Competition Assurance, refund, or credit text in the public component.

- [ ] **Step 4: Add graceful fallback**

If the route-specific catalog is null/unavailable, keep hero/audience/journey/contact visible and show a neutral package section message directing users to contact Strativate, matching the current Private fallback philosophy.

- [ ] **Step 5: Responsive styling**

Desktop: Intensive packages/add-ons/bundles use compact comparison/card grids consistent with existing Program UI.

Mobile: grids collapse to one column; Private package tables either become a card-like stacked row treatment or remain horizontally scrollable inside a clearly bounded responsive container without page overflow. Long descriptions and optional badges must wrap.

- [ ] **Step 6: Verification checkpoint**

Run Intensive and Private public runtime tests. If browser verification is available, check desktop and mobile for both detail routes plus `/program` and homepage to ensure the latter remain high-level.

Do not commit yet.

---

### Task 6: Full verification, main re-check, and one bulk implementation commit

**Files:**
- All implementation/test/doc files above.

**Interfaces:**
- Produces: one final implementation commit, preserving the user's maximum-three-commit requirement.

- [ ] **Step 1: Run unit tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run static quality checks**

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: exit 0 for each. If lint contains existing unrelated warnings, document them and ensure no new feature errors are introduced.

- [ ] **Step 3: Run database verification when configured**

```bash
npm run test:db
```

Expected: forward migration applies to a fresh test database and RLS/schema assertions pass. If the required database environment is unavailable, record that limitation explicitly rather than claiming execution.

- [ ] **Step 4: Visual verification**

Verify admin Private, Intensive, Competition Categories and public Private/Intensive on desktop + mobile. Check modal focus/close behavior, table overflow, pagination, empty/loading/error states, price formatting, consultation mode, and long-text wrapping.

- [ ] **Step 5: Re-check latest main before commit**

Compare branch base against current `main`. If `main` advanced in a way that touches these files or schema sequence, integrate carefully before committing; do not overwrite unrelated changes.

- [ ] **Step 6: Create the only implementation commit**

Stage every implementation/test/doc change and create exactly one commit:

```bash
git add app components lib supabase tests docs/strativate/source-conflicts.md
git commit -m "feat: add mentoring catalog management"
```

This must be the third and final commit on the feature branch relative to its original base.

- [ ] **Step 7: Verify final branch diff and commit count**

Confirm the branch contains exactly:

1. design commit;
2. plan commit;
3. one bulk implementation commit.

Report changed areas, verification evidence, and any environment-limited checks without overstating success.
