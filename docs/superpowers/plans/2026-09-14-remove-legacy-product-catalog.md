# Legacy Product Catalog Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the legacy generic Product Catalog Master runtime/database architecture while preserving reusable frontend presentation and honest public marketing states.

**Architecture:** Apply a detach-and-preserve cleanup. A forward migration removes the old PostgreSQL catalog objects explicitly and without `CASCADE`; runtime pages move to approved editorial/static content or honest unavailable states; reusable admin/public layouts become prop-driven presentation-only components; the old catalog domain, generated types, compatibility checkout, and catalog-only tests are removed.

**Tech Stack:** Next.js 16.3, React 19, TypeScript 5.7, Supabase/PostgreSQL, node:test + tsx, Playwright, ESLint.

**Spec:** `docs/superpowers/specs/2026-09-14-remove-legacy-product-catalog-design.md`

## Global Constraints

- Revalidated against latest `main` commit `3a8820217ab3f13b0e3cd11c6754efb22bb8a805` after teammate Hero Poster changes.
- Keep `supabase/migrations/202609090001_product_catalog_master.sql` unchanged as migration history.
- Create `supabase/migrations/202609140002_remove_legacy_product_catalog.sql`, after `202609140001_marketing_hero_poster_natural_order.sql`.
- Do not use `DROP ... CASCADE`.
- Do not implement `digital_products`, Private Mentoring Domain, `commerce_items`, cart, checkout replacement, orders, payment, or Digital Product delivery.
- Preserve reusable frontend layout, cards, forms, filters, responsive behavior, visual states, and CSS when reasonably reusable.
- Do not turn old Product Catalog prices, packages, benefits, bundles, or add-ons into static production facts.
- Keep Mentor Domain, Auth/onboarding, institutions, referral sources/interests, Hero Posters/storage, and public mentor marketing behavior intact.
- Do not apply the destructive migration to the remote Supabase project from this task.
- Completion grep must show no active runtime dependency on `catalog_*`, `public_catalog_*`, `CatalogProduct`, or `CatalogCommercial*`.

## File Structure

**Create**
- `supabase/migrations/202609140002_remove_legacy_product_catalog.sql` — forward-only database teardown.
- `supabase/tests/catalog_removal.sql` — database regression proving catalog absence and unrelated-domain survival.
- `tests/catalog-removal.test.ts` — static regression for migration safety and runtime import removal.

**Refactor and preserve**
- `components/admin/catalog-management.tsx` — unmounted presentation-only two-pane admin shell.
- `components/admin/catalog-structures.tsx` — unmounted presentation-only structured editor section shell.
- `components/catalog/catalog-browser.tsx` — unmounted ordinary-props browser/list presentation; no catalog domain imports.
- `components/marketing/program-card.tsx` — ordinary marketing presentation type.
- `components/programs/program-detail.tsx` — editorial Mentoring detail presentation, no commercial data.
- `components/programs/program-comparison.tsx` — editorial comparison only.

**Modify runtime/content**
- `app/page.tsx`
- `app/program/page.tsx`
- `app/program/[slug]/page.tsx`
- `app/produk-digital/page.tsx`
- `app/checkout/[slug]/page.tsx`
- `app/admin/page.tsx`
- `components/marketing/home-page.tsx`
- `components/marketing/service-card.tsx`
- `lib/content/services.ts`
- `lib/content/marketing-content.ts`
- `lib/program-information.ts`
- `lib/demo-store.ts`
- `lib/supabase/database.types.ts`
- `scripts/test-database.ts`
- `supabase/tests/mentor_domain.sql`
- relevant browser/unit tests and current docs.

**Delete after references are removed**
- `lib/catalog/admin.ts`
- `lib/catalog/assemble.ts`
- `lib/catalog/compatibility.ts`
- `lib/catalog/format.ts`
- `lib/catalog/postgres-test-source.ts`
- `lib/catalog/presentation.ts`
- `lib/catalog/public-data.ts`
- `lib/catalog/public.ts`
- `lib/catalog/types.ts`
- `components/checkout/legacy-checkout.tsx`
- `tests/catalog.test.ts`
- `supabase/tests/product_catalog.sql`

---

### Task 1: Lock the database teardown contract

**Files:**
- Create: `tests/catalog-removal.test.ts`
- Create: `supabase/migrations/202609140002_remove_legacy_product_catalog.sql`
- Create: `supabase/tests/catalog_removal.sql`
- Modify: `scripts/test-database.ts`
- Modify: `supabase/tests/mentor_domain.sql`
- Delete: `supabase/tests/product_catalog.sql`

**Interfaces:**
- Consumes: applied migration history through `202609140001_marketing_hero_poster_natural_order.sql`.
- Produces: a database where Product Catalog tables/views/functions/enums are absent and `public.mentor_tiers` plus Hero Poster/Auth objects remain.

- [ ] **Step 1: Add a failing migration-safety unit test**

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migrationPath = 'supabase/migrations/202609140002_remove_legacy_product_catalog.sql'

test('legacy catalog cleanup is explicit and never uses CASCADE', () => {
  const sql = readFileSync(migrationPath, 'utf8')
  assert.doesNotMatch(sql, /\bdrop\b[^;]*\bcascade\b/i)
  for (const object of [
    'public_catalog_products',
    'public_catalog_commercial_items',
    'catalog_products',
    'catalog_commercial_items',
    'catalog_mentor_tiers',
    'catalog_product_type',
  ]) assert.match(sql, new RegExp(`\\b${object}\\b`))
})
```

- [ ] **Step 2: Run the test and verify it fails because the migration does not exist**

Run: `pnpm exec tsx --test tests/catalog-removal.test.ts`
Expected: FAIL with `ENOENT` for `202609140002_remove_legacy_product_catalog.sql`.

- [ ] **Step 3: Add the forward migration with explicit dependency order**

The migration must begin by removing the 11 public views, then catalog RPCs, triggers/policies/indexes, tables, helper functions, and finally the eight enum types. The critical statements are:

```sql
-- Legacy Product Catalog Master teardown. Forward-only; no CASCADE.
drop view if exists public.public_catalog_digital_details;
drop view if exists public.public_catalog_bundle_components;
drop view if exists public.public_catalog_add_on_applicability;
drop view if exists public.public_catalog_item_benefits;
drop view if exists public.public_catalog_delivery_options;
drop view if exists public.public_catalog_bundles;
drop view if exists public.public_catalog_add_ons;
drop view if exists public.public_catalog_intensive_offerings;
drop view if exists public.public_catalog_private_offerings;
drop view if exists public.public_catalog_commercial_items;
drop view if exists public.public_catalog_products;

drop function if exists public.create_catalog_commercial_item(
  uuid, public.catalog_commercial_item_kind, text, text, text,
  public.catalog_pricing_mode, bigint, bigint, boolean, integer,
  uuid, uuid, bigint, public.catalog_intensive_scope, integer, boolean, text
);
drop function if exists public.set_catalog_product_status(uuid, public.catalog_lifecycle_status);
drop function if exists public.set_catalog_commercial_item_status(uuid, public.catalog_lifecycle_status);
drop function if exists public.catalog_validate_commercial_item(uuid);

-- Explicit trigger drops before helper functions.
drop trigger if exists catalog_products_audit on public.catalog_products;
drop trigger if exists catalog_items_audit on public.catalog_commercial_items;
drop trigger if exists catalog_products_identity on public.catalog_products;
drop trigger if exists catalog_items_identity on public.catalog_commercial_items;
drop trigger if exists catalog_mentor_tiers_touch on public.catalog_mentor_tiers;
drop trigger if exists catalog_session_packages_touch on public.catalog_session_packages;
drop trigger if exists catalog_delivery_options_touch on public.catalog_delivery_options;
drop trigger if exists catalog_benefits_touch on public.catalog_benefits;
drop trigger if exists catalog_mentor_tiers_identity on public.catalog_mentor_tiers;
drop trigger if exists catalog_session_packages_identity on public.catalog_session_packages;
drop trigger if exists catalog_delivery_options_identity on public.catalog_delivery_options;
drop trigger if exists catalog_benefits_identity on public.catalog_benefits;
drop trigger if exists catalog_offerings_identity on public.catalog_offerings;
drop trigger if exists catalog_add_ons_identity on public.catalog_add_ons;
drop trigger if exists catalog_bundles_identity on public.catalog_bundles;
drop trigger if exists catalog_private_configs_identity on public.catalog_private_offering_configs;
drop trigger if exists catalog_intensive_configs_identity on public.catalog_intensive_offering_configs;
drop trigger if exists catalog_digital_details_identity on public.catalog_digital_product_details;
drop trigger if exists catalog_offerings_delete_guard on public.catalog_offerings;
drop trigger if exists catalog_add_ons_delete_guard on public.catalog_add_ons;
drop trigger if exists catalog_bundles_delete_guard on public.catalog_bundles;
drop trigger if exists catalog_private_configs_delete_guard on public.catalog_private_offering_configs;
drop trigger if exists catalog_intensive_configs_delete_guard on public.catalog_intensive_offering_configs;
drop trigger if exists catalog_private_details_delete_guard on public.catalog_private_mentoring_details;
drop trigger if exists catalog_digital_details_delete_guard on public.catalog_digital_product_details;
drop trigger if exists catalog_products_delete_guard on public.catalog_products;
drop trigger if exists catalog_items_delete_guard on public.catalog_commercial_items;
drop trigger if exists catalog_mentor_tiers_delete_guard on public.catalog_mentor_tiers;
drop trigger if exists catalog_session_packages_delete_guard on public.catalog_session_packages;
drop trigger if exists catalog_delivery_options_delete_guard on public.catalog_delivery_options;
drop trigger if exists catalog_benefits_delete_guard on public.catalog_benefits;
drop trigger if exists catalog_offering_benefits_draft on public.catalog_offering_benefits;
drop trigger if exists catalog_add_on_applicability_draft on public.catalog_add_on_applicability;
drop trigger if exists catalog_bundle_offerings_draft on public.catalog_bundle_offerings;
drop trigger if exists catalog_bundle_add_ons_draft on public.catalog_bundle_add_ons;
drop trigger if exists catalog_bundle_benefits_draft on public.catalog_bundle_benefits;
drop trigger if exists catalog_items_validate_published on public.catalog_commercial_items;

-- Table-owned policies/indexes are catalog-only; remove named indexes explicitly.
drop index if exists public.catalog_products_public_order;
drop index if exists public.catalog_items_product_order;
drop index if exists public.catalog_delivery_product_order;
drop index if exists public.catalog_benefits_product_order;

-- Relationship/composition tables first.
drop table if exists public.catalog_bundle_benefits;
drop table if exists public.catalog_bundle_add_ons;
drop table if exists public.catalog_bundle_offerings;
drop table if exists public.catalog_add_on_applicability;
drop table if exists public.catalog_offering_benefits;
drop table if exists public.catalog_private_offering_configs;
drop table if exists public.catalog_intensive_offering_configs;
drop table if exists public.catalog_digital_product_details;
drop table if exists public.catalog_private_mentoring_details;
drop table if exists public.catalog_delivery_options;
drop table if exists public.catalog_benefits;
drop table if exists public.catalog_session_packages;
drop table if exists public.catalog_mentor_tiers;
drop table if exists public.catalog_bundles;
drop table if exists public.catalog_add_ons;
drop table if exists public.catalog_offerings;
drop table if exists public.catalog_commercial_items;
drop table if exists public.catalog_products;

-- Trigger helpers can now be removed without CASCADE.
drop function if exists public.catalog_validate_published_item_trigger();
drop function if exists public.catalog_require_draft_composition();
drop function if exists public.catalog_protect_deletion();
drop function if exists public.catalog_protect_structure_deletion();
drop function if exists public.catalog_protect_typed_structure();
drop function if exists public.catalog_protect_definition_identity();
drop function if exists public.catalog_protect_identity();
drop function if exists public.catalog_set_audit_fields();

drop type if exists public.catalog_intensive_scope;
drop type if exists public.catalog_delivery_option_kind;
drop type if exists public.catalog_digital_content_type;
drop type if exists public.catalog_commercial_item_kind;
drop type if exists public.catalog_pricing_mode;
drop type if exists public.catalog_purchase_flow;
drop type if exists public.catalog_lifecycle_status;
drop type if exists public.catalog_product_type;
```

Before finalizing this file, compare every trigger/function/table/view/type name against `202609090001_product_catalog_master.sql`. Do not add unrelated `DROP` statements.

- [ ] **Step 4: Add post-migration SQL regression coverage**

```sql
begin;
create schema test_catalog_removal;
create function test_catalog_removal.assert(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_condition is distinct from true then
    raise exception 'ASSERTION FAILED: %', p_message;
  end if;
end $$;

select test_catalog_removal.assert(to_regclass('public.catalog_products') is null, 'catalog_products removed');
select test_catalog_removal.assert(to_regclass('public.catalog_commercial_items') is null, 'catalog_commercial_items removed');
select test_catalog_removal.assert(to_regclass('public.catalog_mentor_tiers') is null, 'legacy catalog mentor tiers removed');
select test_catalog_removal.assert(to_regclass('public.public_catalog_products') is null, 'public catalog views removed');
select test_catalog_removal.assert(to_regclass('public.mentor_tiers') is not null, 'operational mentor tiers survive');
select test_catalog_removal.assert(to_regclass('public.marketing_hero_posters') is not null, 'hero posters survive');
select test_catalog_removal.assert(to_regclass('public.profiles') is not null, 'auth profiles survive');
rollback;
```

- [ ] **Step 5: Replace the old catalog SQL test in the DB runner**

Change the runner test list to:

```ts
for (const filename of [
  'auth_security.sql',
  'institution_import.sql',
  'mentor_invites.sql',
  'marketing_hero_posters.sql',
  'mentor_domain.sql',
  'catalog_removal.sql',
]) {
```

Delete `supabase/tests/product_catalog.sql`. Update the final `catalog_mentor_tiers` assertion in `mentor_domain.sql` from “remains intact” to `to_regclass('public.catalog_mentor_tiers') is null` while leaving all operational Mentor Domain assertions intact.

- [ ] **Step 6: Run focused and database tests**

Run: `pnpm exec tsx --test tests/catalog-removal.test.ts`
Expected: PASS.

Run: `TEST_DATABASE_URL=<disposable strativate_test_*> pnpm test:db -- --bootstrap`
Expected: all migrations including `202609140002_remove_legacy_product_catalog.sql` pass; Auth, Hero Poster, Mentor Domain, and `catalog_removal.sql` pass.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/202609140002_remove_legacy_product_catalog.sql supabase/tests/catalog_removal.sql supabase/tests/mentor_domain.sql scripts/test-database.ts tests/catalog-removal.test.ts
git rm supabase/tests/product_catalog.sql
git commit -m "chore(db): remove legacy product catalog"
```

### Task 2: Detach public program content from Product Catalog

**Files:**
- Modify: `lib/content/services.ts`
- Modify: `components/marketing/service-card.tsx`
- Modify: `app/program/page.tsx`
- Modify: `lib/program-information.ts`
- Modify: `components/programs/program-detail.tsx`
- Modify: `components/programs/program-comparison.tsx`
- Modify: `app/program/[slug]/page.tsx`
- Modify: `tests/browser/program-information.spec.ts`

**Interfaces:**
- Produces: `ServiceOverview` values with optional direct editorial `href`; `ProgramEditorial` with canonical `slug`, `title`, `shortDescription`, `tone`, `assetKey`; `getProgramEditorialBySlug(slug)`; a Product-Catalog-free `ProgramDetail`.

- [ ] **Step 1: Rewrite browser expectations before runtime code**

Replace price/package assertions with editorial/unavailable-state assertions:

```ts
await page.goto('/program/private-mentoring')
await expect(page).toHaveTitle('Private Mentoring | Strativate')
await expect(page.getByRole('heading', { level: 1 })).toHaveText('Private Mentoring')
await expect(page.getByRole('heading', { name: 'Paket dan harga' })).toBeVisible()
await expect(page.getByText(/rincian paket dan harga.*belum tersedia/i)).toBeVisible()
await expect(page.locator('a[href*="/checkout/"]')).toHaveCount(0)
await expect(page.getByText(/Rp\s?885\.000/)).toHaveCount(0)
```

Retain tests for eight service cards, the two primary cards, legacy slug redirects, direct `/checkout/<mentoring-slug>` redirects, and mobile overflow.

- [ ] **Step 2: Run the focused browser test and confirm old catalog-rendered pricing makes it fail**

Run: `pnpm exec playwright test tests/browser/program-information.spec.ts`
Expected: FAIL on the new unavailable-state/pricing-absence assertions.

- [ ] **Step 3: Make `services.ts` static/editorial only**

Use ordinary props and direct canonical links:

```ts
export type ServiceOverview = {
  id: string
  name: string
  description: string
  icon: LucideIcon
  href?: string
  detailLabel?: string
}

// Private Mentoring
href: '/program/private-mentoring',
detailLabel: 'Lihat Private Mentoring',

// Intensive Mentoring
href: '/program/intensive-mentoring',
detailLabel: 'Lihat Intensive Mentoring',
```

Delete `CatalogProductSummary`, `CatalogProductType`, and `connectServicesToCatalog`. Change `ServiceCard` to accept `ServiceOverview` directly. In `/program`, use `services` directly and replace Product Master copy with neutral wording about available program information.

- [ ] **Step 4: Turn `program-information.ts` into the approved editorial model**

Extend each existing Private/Intensive record with presentation metadata already represented elsewhere in the repository:

```ts
export type ProgramEditorial = {
  slug: 'private-mentoring' | 'intensive-mentoring'
  title: 'Private Mentoring' | 'Intensive Mentoring'
  shortDescription: string
  kicker: string
  detail: string
  audience: string
  highlights: string[]
  journey: ContentItem[]
  tone: 'orange' | 'red'
  assetKey: 'programs.private.cover' | 'programs.intensive.cover'
}

export function getProgramEditorialBySlug(slug: string): ProgramEditorial | null {
  return Object.values(programEditorial).find(program => program.slug === slug) ?? null
}
```

Keep existing approved editorial wording. Delete Product-Catalog-only `deliveryOptionEditorial` and `commercialItemEditorial` once their consumers are gone. Keep `competitionCategories`.

- [ ] **Step 5: Rewrite detail/comparison components as presentation-only**

`ProgramDetail` receives one `ProgramEditorial` and renders the existing breadcrumb, hero, audience, highlights, journey, competition categories, comparison, and contact styling. Preserve `#packages`, but make it truthful:

```tsx
<section id="packages" className="program-section program-section--surface" data-reveal>
  <div className="program-section-heading">
    <p className="kicker">Paket dan harga</p>
    <h2>Rincian paket dan harga belum tersedia.</h2>
    <p>Hubungi tim Strativate untuk membahas kebutuhanmu sementara domain program sedang disiapkan.</p>
  </div>
</section>
```

`ProgramComparison` takes `ProgramEditorial[]` or reads the two editorial records; it must not accept `CatalogProductSummary`.

- [ ] **Step 6: Rewrite the dynamic route to editorial slugs only**

```ts
const canonical = resolveMentoringSlug(slug)
if (!canonical) notFound()
if (canonical !== slug) permanentRedirect(`/program/${canonical}`)
const program = getProgramEditorialBySlug(canonical)
if (!program) notFound()
return <MarketingShell><ProgramDetail program={program} /></MarketingShell>
```

Metadata uses `program.title`, `program.shortDescription`, and `/program/${canonical}`. There is no generic product fallback.

- [ ] **Step 7: Run browser test**

Run: `pnpm exec playwright test tests/browser/program-information.spec.ts`
Expected: PASS with no price/package rows and no checkout CTA.

- [ ] **Step 8: Commit**

```bash
git add lib/content/services.ts components/marketing/service-card.tsx app/program/page.tsx lib/program-information.ts components/programs/program-detail.tsx components/programs/program-comparison.tsx app/program/'[slug]'/page.tsx tests/browser/program-information.spec.ts
git commit -m "refactor: detach program pages from product catalog"
```

### Task 3: Preserve homepage and Digital Product presentation without catalog data

**Files:**
- Modify: `components/marketing/program-card.tsx`
- Modify: `components/marketing/home-page.tsx`
- Modify: `app/page.tsx`
- Modify: `app/produk-digital/page.tsx`
- Modify: `lib/content/marketing-content.ts`
- Modify: relevant `tests/browser/marketing.spec.ts` and `tests/marketing-content.test.ts` assertions.

**Interfaces:**
- `HomePage({ heroPosters }: { heroPosters: MarketingHeroPosterView[] })`.
- `MarketingProgram` becomes a presentation-only type.
- Digital Product page consumes only existing `productPlaceholders` while enabled.

- [ ] **Step 1: Update tests to reject Product Master copy/data**

Add assertions that the homepage/program card links remain, Digital Product placeholders remain honest, and old “Product Master/master produk” wording is absent from public output.

- [ ] **Step 2: Run focused marketing tests and confirm failure before implementation**

Run: `pnpm test`
Expected: updated marketing assertions fail against old catalog-backed copy/props.

- [ ] **Step 3: Make `MarketingProgram` a plain presentation type**

```ts
export type MarketingProgram = {
  id: string
  number: string
  title: string
  kicker: string
  description: string
  highlights: readonly string[]
  href?: string
  assetKey: 'programs.private.cover' | 'programs.intensive.cover' | 'programs.bigClass.cover'
  status: 'information' | 'overview'
  tone: 'orange' | 'red' | 'yellow'
}
```

When no price exists, render an honest non-commercial label such as `Detail komersial belum tersedia`, not a copied Product Catalog price.

- [ ] **Step 4: Build homepage program cards from approved editorial content**

Remove all imports from `@/lib/catalog/*`. Map Private/Intensive editorial records plus `bigClassPlaceholder` into `MarketingProgram[]`. Keep Hero Carousel, mentor, about, social-proof, and FAQ sections unchanged. Digital Product section maps only `productPlaceholders` when the feature flag is on.

Change `app/page.tsx` to:

```ts
export default async function Page() {
  const heroPosters = await listActiveHeroPosters()
  return <MarketingShell><HomePage heroPosters={heroPosters} /></MarketingShell>
}
```

- [ ] **Step 5: Keep `/produk-digital` visual layout but remove catalog query**

After the feature-flag redirect, render `productPlaceholders` directly. Keep current card/image/button composition and `Belum tersedia untuk pembelian` state. Replace “master produk” wording with neutral approval/final-detail wording.

- [ ] **Step 6: Run marketing tests**

Run: `pnpm test`
Expected: PASS for updated unit tests.

Run: `pnpm exec playwright test tests/browser/marketing.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/marketing/program-card.tsx components/marketing/home-page.tsx app/page.tsx app/produk-digital/page.tsx lib/content/marketing-content.ts tests/marketing-content.test.ts tests/browser/marketing.spec.ts
git commit -m "refactor: preserve marketing UI without catalog backend"
```

### Task 4: Unmount admin Product Catalog while preserving reusable admin UI

**Files:**
- Modify: `app/admin/page.tsx`
- Rewrite: `components/admin/catalog-management.tsx`
- Rewrite: `components/admin/catalog-structures.tsx`
- Rewrite: `components/catalog/catalog-browser.tsx`
- Preserve: catalog/program CSS unless proven orphaned.

**Interfaces:**
- `CatalogManagement` is presentation-only and accepts ordinary props/children; it performs no Supabase IO.
- `CatalogStructures` is a presentation-only grouping wrapper.
- `CatalogBrowser` accepts UI item props and contains only local search/filter presentation.

- [ ] **Step 1: Add/adjust an admin regression assertion**

In the existing admin/browser source test, assert the navigation contains no `Katalog Produk` button and no mounted `CatalogManagement` import.

- [ ] **Step 2: Remove active admin mounting**

Delete the `CatalogManagement` import, remove `Katalog Produk` from the `Produk` group, and remove:

```tsx
{section === 'Katalog Produk' && <CatalogManagement />}
```

Do not replace it with Digital Product or another future domain.

- [ ] **Step 3: Rewrite `CatalogManagement` as a pure presentation shell**

Use a prop surface similar to:

```ts
export type CatalogManagementItem = { id: string; title: string; meta?: string }
export type CatalogManagementProps = {
  title: string
  description: string
  items: readonly CatalogManagementItem[]
  selectedId?: string
  query: string
  onQueryChange: (value: string) => void
  onSelect: (id: string) => void
  editor?: ReactNode
}
```

Render the existing `catalog-admin-layout`, `catalog-admin-list`, `catalog-admin-filters`, product-row visual, and editor/empty-state classes. Do not import Supabase, `database.types`, `lib/catalog`, feature flags, or catalog RPCs. Keep the component unmounted.

- [ ] **Step 4: Rewrite `CatalogStructures` as a pure reusable section wrapper**

```tsx
export function CatalogStructures({ title, description, children }: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return <section className="catalog-structures">
    <div className="role-card-heading"><div><p className="kicker">Struktur</p><h2>{title}</h2>{description ? <p>{description}</p> : null}</div></div>
    {children}
  </section>
}
```

- [ ] **Step 5: Refactor orphaned `CatalogBrowser` to ordinary display props**

Keep its card/filter/list layout but define a local presentation item type with `id`, `title`, `description`, `category`, optional `href` and `meta`. Search/filter locally; remove price/business sorting and all `lib/catalog` imports. Keep it unmounted for later reuse.

- [ ] **Step 6: Run typecheck/lint focused validation**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS; preserved components compile without removed database objects.

- [ ] **Step 7: Commit**

```bash
git add app/admin/page.tsx components/admin/catalog-management.tsx components/admin/catalog-structures.tsx components/catalog/catalog-browser.tsx app/globals.css app/marketing.css app/program-information.css
git commit -m "refactor: preserve catalog presentation without backend"
```

### Task 5: Remove legacy checkout compatibility and catalog runtime modules

**Files:**
- Modify: `app/checkout/[slug]/page.tsx`
- Modify: `lib/demo-store.ts`
- Delete: `components/checkout/legacy-checkout.tsx`
- Delete: all files under `lib/catalog/`
- Delete: `tests/catalog.test.ts`

**Interfaces:**
- `/checkout/<known mentoring slug>` remains a compatibility redirect to the canonical program information route.
- Unknown checkout slugs are `notFound()`; no purchase flow exists.

- [ ] **Step 1: Update checkout browser assertions**

Keep cases such as `/checkout/private-mentoring` and `/checkout/business-case-intensive` redirecting to `/program/...`; add an unsupported checkout slug case that returns the normal not-found page. Assert zero “Beli/Bayar” purchase controls.

- [ ] **Step 2: Simplify checkout route**

```ts
export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const mentoringSlug = resolveMentoringSlug(slug)
  if (mentoringSlug) permanentRedirect(`/program/${mentoringSlug}`)
  notFound()
}
```

No feature flag, Product Catalog query, compatibility adapter, or `LegacyCheckout` import remains.

- [ ] **Step 3: Remove legacy checkout identity from demo store**

Remove optional `commercialItemId` from `DemoOrder` and from `createPendingOrder` input/return shape. Keep unrelated demo `productId`/operational records unchanged unless a reference check proves they exist only for removed checkout.

- [ ] **Step 4: Delete catalog runtime and catalog-only tests**

Delete the eight `lib/catalog/*.ts` files, `components/checkout/legacy-checkout.tsx`, and `tests/catalog.test.ts` after repo-wide reference search reports no consumers.

- [ ] **Step 5: Run unit/type/browser checks**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

Run: `pnpm exec playwright test tests/browser/program-information.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/checkout/'[slug]'/page.tsx lib/demo-store.ts tests/browser/program-information.spec.ts
git rm components/checkout/legacy-checkout.tsx tests/catalog.test.ts lib/catalog/*.ts
git commit -m "chore: remove legacy catalog runtime and checkout"
```

### Task 6: Remove Product Catalog generated TypeScript definitions

**Files:**
- Modify: `lib/supabase/database.types.ts`
- Test: `tests/catalog-removal.test.ts`

**Interfaces:**
- `Database` retains valid Auth/onboarding/institution/Hero Poster/Mentor Domain tables, functions, and enums only.

- [ ] **Step 1: Extend the static cleanup test**

```ts
const databaseTypes = readFileSync('lib/supabase/database.types.ts', 'utf8')
assert.doesNotMatch(databaseTypes, /\bCatalogProduct\b/)
assert.doesNotMatch(databaseTypes, /\bcatalog_products\s*:/)
assert.doesNotMatch(databaseTypes, /\bpublic_catalog_products\s*:/)
```

- [ ] **Step 2: Run test and verify failure**

Run: `pnpm exec tsx --test tests/catalog-removal.test.ts`
Expected: FAIL while old generated/manual catalog definitions remain.

- [ ] **Step 3: Delete only Product Catalog definitions**

Remove catalog enum aliases, all `Catalog*`/`PublicCatalog*` type aliases, the 18 catalog `Tables` entries, 11 public catalog `Views` entries, catalog RPC signatures, and catalog-only `Enums` entries. Do not alter `MentorTier`, `MarketingHeroPoster`, Auth/onboarding, institution, or mentor function definitions.

- [ ] **Step 4: Run typecheck and static test**

Run: `pnpm exec tsx --test tests/catalog-removal.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/database.types.ts tests/catalog-removal.test.ts
git commit -m "chore: remove legacy catalog database types"
```

### Task 7: Update current source-of-truth docs without rewriting history

**Files:**
- Modify: `README.md`
- Modify: `docs/program-information.md`
- Modify: `docs/supabase-setup.md`
- Modify: `docs/strativate/asset-status.md`
- Modify: `docs/strativate/source-conflicts.md` only where it currently calls Product Master authoritative/current.
- Modify: `memory/SPEC.md`
- Preserve: historical `docs/superpowers/specs/2026-09-09-*` and `docs/superpowers/plans/2026-09-09-*` / `2026-09-10-*`.

**Interfaces:**
- Current docs state: each business/product type owns its domain model; shared commerce will later unify cart/checkout/order/payment.

- [ ] **Step 1: Replace current-authoritative Product Master claims**

Use concise wording:

```md
The former generic Product Catalog Master is migration history and is no longer the runtime architecture.
Each business/product type owns its own domain model. Shared commerce will later unify cart, checkout, order, and payment.
```

Document `202609140002_remove_legacy_product_catalog.sql` after the Hero Poster natural-order migration. Do not describe future Phase 2 schemas in detail.

- [ ] **Step 2: Update asset/source status**

Change status rows that say “Ready via Product Master” to explain that Private/Intensive commercial details are intentionally unavailable during domain rebuild; keep source conflicts as historical provenance and unresolved stakeholder facts, not current runtime authority.

- [ ] **Step 3: Run doc/runtime grep audit**

Run:

```bash
rg -n "Product Master|Product Catalog|catalog_|public_catalog_|CatalogProduct|CatalogCommercial|@/lib/catalog|lib/catalog/" . \
  -g '!supabase/migrations/202609090001_product_catalog_master.sql' \
  -g '!docs/superpowers/specs/2026-09-09-*' \
  -g '!docs/superpowers/plans/2026-09-09-*' \
  -g '!docs/superpowers/specs/2026-09-10-*' \
  -g '!docs/superpowers/plans/2026-09-10-*'
```

Expected: only the new cleanup migration/tests/spec/plan, explicitly historical Mentor Domain migration comments, or justified presentation-only component names remain; no runtime query/import/generated type/current-authority claim remains.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/program-information.md docs/supabase-setup.md docs/strativate/asset-status.md docs/strativate/source-conflicts.md memory/SPEC.md
git commit -m "docs: retire product catalog as current architecture"
```

### Task 8: Full verification and cleanup gate

**Files:**
- Modify only files required to fix verification regressions caused by this cleanup.

- [ ] **Step 1: Run exact repo-wide quality-gate searches**

```bash
rg -n "catalog_"
rg -n "public_catalog_"
rg -n "CatalogManagement"
rg -n "CatalogStructures"
rg -n "CatalogProduct"
rg -n "CatalogCommercial"
rg -n "@/lib/catalog|lib/catalog/"
```

Classify every remaining match as migration history, historical docs, cleanup regression coverage, or intentionally preserved presentation-only naming. Any active runtime/database-type/test-adapter match is a blocker.

- [ ] **Step 2: Run the full relevant verification suite**

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm test
TEST_DATABASE_URL=<disposable strativate_test_*> pnpm test:db -- --bootstrap
pnpm test:e2e
```

Expected: all cleanup-related checks pass. If an unrelated pre-existing/environment failure occurs, record the exact command/output separately instead of hiding it.

- [ ] **Step 3: Review the frontend preservation diff**

Confirm that program/product/admin CSS was not removed merely because its old data source disappeared; `CatalogManagement`, `CatalogStructures`, and `CatalogBrowser` (if retained) compile with ordinary props and have no Supabase/catalog-domain imports; public marketing composition remains intact.

- [ ] **Step 4: Confirm remote safety**

Do not run `supabase db push`, `supabase migration up` against production, or any remote destructive command. The completion report must name `supabase/migrations/202609140002_remove_legacy_product_catalog.sql` as the migration requiring controlled/manual application.

- [ ] **Step 5: Final commit if verification fixes were needed**

```bash
git add -A
git commit -m "test: verify legacy product catalog removal"
```

## Completion Report Checklist

Report all of the following:

1. Base commit: `3a8820217ab3f13b0e3cd11c6754efb22bb8a805`.
2. Product Catalog runtime files removed.
3. Admin UI/navigation changes and preserved presentation components.
4. Public route adaptations.
5. Legacy checkout changes.
6. Database objects removed by `202609140002_remove_legacy_product_catalog.sql`.
7. Type definitions removed.
8. Tests removed/rewritten.
9. Current docs updated.
10. Verification results, including any environment/pre-existing failures.
11. Historical Product Catalog references intentionally retained.
12. Exact forward migration filename for Supabase.
13. Reusable frontend/CSS deliberately preserved for later domain-specific work.
