# Product / Catalog Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a secure, normalized Supabase Product Master that publishes the authoritative Private and Intensive Mentoring guidebook data and powers Strativate's admin and public catalog surfaces.

**Architecture:** PostgreSQL owns product, unified commercial-item, subtype, lifecycle, pricing, applicability, composition, delivery-option, and benefit invariants. Security-invoker views plus base-table RLS expose only published public data; typed TypeScript query/assembly boundaries feed the existing public and admin UI. Legacy checkout receives only a minimal fixed-price compatibility object derived from Product Master.

**Tech Stack:** PostgreSQL/Supabase migrations and RLS, Next.js 16 App Router, React 19, TypeScript 5.7, `@supabase/ssr`, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-09-product-catalog-master-design.md`

## Global Constraints

- Private and Intensive guidebooks are authoritative; persist printed values exactly without arithmetic correction.
- Bootstrap Private and Intensive as published/public, including offerings, add-ons, bundles, delivery options, and benefits.
- Do not seed Big Class or Digital Product demo records.
- Every offering, add-on, and bundle has a directly referenceable UUID in `catalog_commercial_items`.
- Benefits and delivery options are never commercial items.
- Product Master is the only current commercial identity/pricing source.
- Checkout compatibility is lookup replacement only; do not add cart, payment, order, or negotiation behavior.
- Existing/new user-facing copy stays natural Bahasa Indonesia.
- Preserve database-owned roles, `public.is_admin()`, RLS, explicit grants, and security-invoker views.
- Use test-first implementation and do not weaken existing authorization tests.

---

### Task 1: PostgreSQL catalog schema, lifecycle, security, and authoritative seed

**Files:**
- Create: `supabase/migrations/202609090001_product_catalog_master.sql`
- Create: `supabase/tests/product_catalog.sql`
- Modify: `scripts/test-database.ts`

**Interfaces:**
- Consumes: `public.profiles`, `public.is_admin()`, `auth.uid()`, and `public.touch_updated_at()` from migration `202609060001_auth_onboarding.sql`.
- Produces: catalog enums/tables/views; `public.set_catalog_product_status(uuid, catalog_lifecycle_status)`; `public.set_catalog_commercial_item_status(uuid, catalog_lifecycle_status)`; `public.create_catalog_commercial_item(...)`; authoritative published seed rows.

- [ ] **Step 1: Add the database test to the runner and write the failing catalog security/domain suite**

Add `product_catalog.sql` to the filenames in `scripts/test-database.ts`. The SQL test must begin a transaction, define an assertion/denial helper consistent with `auth_security.sql`, and assert exact guidebook data, including:

```sql
select test_catalog.assert((
  select ci.price_amount = 885000
    and ci.reference_price_amount = 950000
    and pc.per_session_price_amount = 285000
  from public.catalog_commercial_items ci
  join public.catalog_private_offering_configs pc on pc.id = ci.id
  join public.catalog_mentor_tiers mt on mt.id = pc.mentor_tier_id
  join public.catalog_session_packages sp on sp.id = pc.session_package_id
  where mt.code = 'top_student' and sp.session_count = 3
), 'guidebook Top Student 3-session values are stored verbatim');

select test_catalog.assert((
  select pricing_mode = 'quotation_required' and price_amount is null
  from public.catalog_commercial_items
  where code = 'international_custom'
), 'international mentoring is quotation-based without fake zero price');

select test_catalog.assert((
  select count(*) = 4
  from public.public_catalog_bundle_components
  where bundle_code = 'competition_assurance_bundle'
), 'competition assurance composition is relational');
```

The suite must also switch `request.jwt.claim.sub` among the bootstrap admin, mentee, and anonymous roles to prove draft/archived hiding, non-admin mutation denial, admin management, lifecycle validation, wrong-subtype rejection, cross-product rejection, immutable codes/ownership, positive sessions/quantities, valid PDF/video values, and absence of seeded Big Class/Digital Product rows.

- [ ] **Step 2: Run the database test and verify RED**

Run: `pnpm test:db -- --bootstrap`

Expected: migration/test runner fails because catalog relations and `product_catalog.sql` support do not yet exist.

- [ ] **Step 3: Implement enums, normalized tables, constraints, indexes, and audit triggers**

Create the tables described in the spec. Use shared-primary-key subtype tables and composite ownership keys. Core pricing constraint:

```sql
check (
  (pricing_mode is null and status = 'draft' and price_amount is null and reference_price_amount is null)
  or (pricing_mode = 'fixed' and price_amount is not null and price_amount >= 0
      and (reference_price_amount is null or reference_price_amount >= price_amount))
  or (pricing_mode = 'quotation_required' and price_amount is null and reference_price_amount is null)
)
```

Add validation/immutability triggers that raise `23514` for wrong product types/item kinds and `22023` for invalid lifecycle requests. `catalog_private_offering_configs.per_session_price_amount` is an independent nonnegative integer and is never calculated from the total.

- [ ] **Step 4: Implement lifecycle RPCs, RLS, grants, and security-invoker public views**

The product publication RPC must lock and validate its product, subtype, and at least one published offering. The item publication RPC must validate pricing and subtype completeness. Both must start with:

```sql
if not public.is_admin() then
  raise exception 'Administrator required' using errcode = '42501';
end if;
```

Enable RLS on every table. Add admin policies using `public.is_admin()` and public read policies requiring the full published/public parent path. Create views with:

```sql
create view public.public_catalog_products
with (security_invoker = true, security_barrier = true) as
select id, code, slug, product_type, default_purchase_flow, title,
       short_description, description, is_featured, sort_order, created_at, updated_at
from public.catalog_products
where status = 'published' and is_public;
```

Grant only explicit safe columns to `anon`/`authenticated`; never grant actor audit columns. Lifecycle columns are changed through RPCs, not broad update grants.

- [ ] **Step 5: Seed authoritative guidebook data with deterministic UUIDs**

Seed both mentoring products, ten Private offering identities, three Intensive offerings, three add-ons, and three bundles as published/public. Seed the exact prices from spec section 11, stable delivery-option/benefit codes, add-on applicability, offering benefits, and explicit bundle composition. Use fixed UUID literals so database tests and future migrations can reference stable bootstrap identities. Do not seed Big Class or Digital Product records.

- [ ] **Step 6: Run database tests and verify GREEN**

Run: `pnpm test:db -- --bootstrap`

Expected: all migrations and `auth_security.sql`, `institution_import.sql`, `mentor_invites.sql`, and `product_catalog.sql` pass.

- [ ] **Step 7: Commit the database slice**

```bash
git add supabase/migrations/202609090001_product_catalog_master.sql supabase/tests/product_catalog.sql scripts/test-database.ts
git commit -m "feat: add secure product catalog master schema"
```

### Task 2: Typed catalog domain and public row assembly

**Files:**
- Modify: `lib/supabase/database.types.ts`
- Create: `lib/catalog/types.ts`
- Create: `lib/catalog/format.ts`
- Create: `lib/catalog/assemble.ts`
- Create: `tests/catalog.test.ts`

**Interfaces:**
- Consumes: rows from `public_catalog_products`, `public_catalog_commercial_items`, and public configuration views.
- Produces: `CatalogProductSummary`, `CatalogProductDetail`, `CatalogCommercialItem`, `assembleCatalogSummaries(rows)`, `assembleCatalogDetail(rows)`, `formatRupiah(amount)`.

- [ ] **Step 1: Write failing domain tests**

Cover fixed versus quotation discrimination, exact `885000` formatting, stable IDs, Private matrix assembly, add-on applicability, bundle component assembly, PDF/video detail, and price sorting without treating quotation as zero:

```ts
test('keeps quotation offerings numeric-price free', () => {
  const item = assembleCommercialItem(quotationRow)
  assert.equal(item.pricingMode, 'quotation_required')
  assert.equal('priceAmount' in item, false)
})

test('formats the guidebook package total without recomputing it', () => {
  assert.equal(formatRupiah(885000), 'Rp885.000')
})
```

- [ ] **Step 2: Run the focused unit test and verify RED**

Run: `pnpm test -- tests/catalog.test.ts`

Expected: module-not-found failures for the new catalog domain files.

- [ ] **Step 3: Add schema-aligned Supabase and domain types**

Extend `Database` with every table/view/function/enum used by browser/server code. Define discriminated commercial types:

```ts
export type FixedCatalogItem = CatalogItemBase & {
  pricingMode: 'fixed'; priceAmount: number; referencePriceAmount: number | null
}
export type QuotationCatalogItem = CatalogItemBase & {
  pricingMode: 'quotation_required'
}
export type CatalogCommercialItem = FixedCatalogItem | QuotationCatalogItem
```

Do not use `any` or parse labels to create domain fields.

- [ ] **Step 4: Implement pure formatting and assembly functions**

Keep database snake_case confined to assembly input types and expose camelCase domain models. Treat absent optional related rows as empty arrays, but throw on impossible published shapes such as a fixed item without a price.

- [ ] **Step 5: Run unit tests and typecheck**

Run: `pnpm test -- tests/catalog.test.ts`

Run: `pnpm typecheck`

Expected: catalog tests and typecheck pass.

- [ ] **Step 6: Commit the typed domain slice**

```bash
git add lib/supabase/database.types.ts lib/catalog tests/catalog.test.ts
git commit -m "feat: add typed catalog domain interface"
```

### Task 3: Supabase public query boundary

**Files:**
- Create: `lib/catalog/public.ts`
- Create: `lib/catalog/compatibility.ts`
- Modify: `tests/catalog.test.ts`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/server.ts` and Task 2 assemblers.
- Produces: `listPublicCatalog(): Promise<CatalogProductSummary[]>`, `getPublicCatalogProduct(slug): Promise<CatalogProductDetail | null>`, `toLegacyCheckoutItem(detail, commercialItemId?)`.

- [ ] **Step 1: Write failing query-boundary and compatibility tests**

Use an injected typed query adapter for pure tests. Verify errors are thrown rather than replaced with demo data, no rows returns `[]`/`null`, quotation items cannot map to checkout, and a fixed offering maps its actual UUID and current catalog amount.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm test -- tests/catalog.test.ts`

Expected: missing public query/compatibility exports.

- [ ] **Step 3: Implement public reads and minimal checkout mapping**

Query only `public_catalog_*` views with explicit columns. The compatibility result is limited to:

```ts
export type LegacyCheckoutCatalogItem = {
  productId: string
  commercialItemId: string
  slug: string
  title: string
  productType: CatalogProductType
  priceAmount: number
  priceLabel: string
}
```

Return `null` for quotation-required or non-sellable offerings. Add no checkout state or behavior.

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm test -- tests/catalog.test.ts`

Run: `pnpm typecheck`

Expected: pass.

- [ ] **Step 5: Commit the query boundary**

```bash
git add lib/catalog/public.ts lib/catalog/compatibility.ts tests/catalog.test.ts
git commit -m "feat: add public catalog query boundary"
```

### Task 4: Public catalog and program pages consume Product Master

**Files:**
- Delete: `lib/catalog.ts`
- Modify: `lib/program-information.ts`
- Create: `components/catalog/catalog-browser.tsx`
- Modify: `app/explore/page.tsx`
- Modify: `app/program/[slug]/page.tsx`
- Modify: `components/programs/program-detail.tsx`
- Modify: `app/page.tsx`
- Modify: `tests/browser/program-information.spec.ts`

**Interfaces:**
- Consumes: `listPublicCatalog()` and `getPublicCatalogProduct(slug)` from Task 3; editorial maps keyed by catalog codes.
- Produces: server-backed catalog cards, published program details, authoritative package/add-on/bundle rendering, and honest Digital/Big Class empty states.

- [ ] **Step 1: Replace browser expectations with failing Product Master assertions**

Assert `/explore` shows only the two seeded mentoring products, Private shows the printed `Rp885.000` total and `Rp285.000` per session, Intensive shows fixed/reference prices, quotation copy, add-ons, and relational bundle components. Assert no hardcoded Digital/Big Class cards or download claims are shown.

- [ ] **Step 2: Run the public browser suite and verify RED**

Run: `pnpm exec playwright test tests/browser/program-information.spec.ts`

Expected: failures because pages still import `lib/catalog.ts` and old commercial arrays.

- [ ] **Step 3: Narrow editorial data to code-keyed explanation maps**

Remove all commercial prices, package arrays, add-on arrays, bundle arrays, and independent option lists from `lib/program-information.ts`. Retain program storytelling keyed by product code and explanatory maps such as:

```ts
export const deliveryOptionEditorial: Record<string, { description: string }> = {
  end_to_end_learning: { description: 'Mulai dari dasar hingga siap tampil dalam kompetisi.' },
  competition_focused: { description: 'Persiapan terarah untuk satu target kompetisi.' },
}
```

Labels and iteration order must come from Product Master, not these maps.

- [ ] **Step 4: Convert public pages to server-backed Product Master consumers**

Make `/explore` a server component that passes typed summaries into `CatalogBrowser`. Load detail by slug in `/program/[slug]`; render package matrices, add-ons, bundles, benefits, delivery options, and quotation labels from `CatalogProductDetail`. Retain editorial descriptions only when a matching code exists. Use `notFound()` for unpublished/unknown product slugs.

On the homepage, replace hardcoded commercial program/digital arrays with summaries from `listPublicCatalog()`. Preserve unrelated mentor/about/FAQ editorial content and existing Indonesian copy.

- [ ] **Step 5: Verify unit, type, and public browser tests GREEN**

Run: `pnpm test`

Run: `pnpm typecheck`

Run: `pnpm exec playwright test tests/browser/program-information.spec.ts`

Expected: all pass; public prices come from Product Master.

- [ ] **Step 6: Commit public integration**

```bash
git add app/page.tsx app/explore/page.tsx app/program components/catalog components/programs/program-detail.tsx lib/program-information.ts tests/browser/program-information.spec.ts
git rm lib/catalog.ts
git commit -m "feat: power public catalog from product master"
```

### Task 5: Persistent admin catalog management

**Files:**
- Create: `lib/catalog/admin.ts`
- Create: `components/admin/catalog-management.tsx`
- Create: `components/admin/catalog-product-form.tsx`
- Create: `components/admin/catalog-commercial-items.tsx`
- Create: `components/admin/catalog-private-fields.tsx`
- Create: `components/admin/catalog-intensive-fields.tsx`
- Create: `components/admin/catalog-digital-fields.tsx`
- Modify: `app/admin/page.tsx`
- Modify: `app/globals.css`
- Create: `tests/browser/catalog-admin.spec.ts`

**Interfaces:**
- Consumes: typed Supabase tables/RPCs and existing admin shell/account authorization.
- Produces: real list/create/edit/publish/archive flows and structured subtype editors.

- [ ] **Step 1: Write failing authenticated admin browser coverage**

Reuse the repository's Supabase test-account setup. Test persisted product edits across reload, lifecycle actions, type-specific fields, structured selectors for applicability/composition, and Indonesian loading/error/empty states. Add a mobile overflow assertion.

- [ ] **Step 2: Run the admin browser test and verify RED**

Run: `pnpm exec playwright test tests/browser/catalog-admin.spec.ts`

Expected: “Katalog Produk” navigation and persistent editor are missing.

- [ ] **Step 3: Implement typed admin mutation helpers and common product management**

Use browser Supabase with explicit column lists and RLS. Common forms edit code/slug only while draft, plus title, descriptions, purchase flow, public/featured/order fields. Publish/archive buttons call lifecycle RPCs. Errors pass through `formError()` and remain visible without clearing form input.

- [ ] **Step 4: Implement structured type-specific editors**

Private UI manages service details, tiers, session packages, per-session/package/reference prices, delivery options, and offering benefits. Intensive UI manages fixed/quotation offerings, add-ons, applicability checkboxes, bundles, component selectors, and benefits. Digital UI manages PDF/video and offering pricing. Big Class exposes only shared product/offering controls. No form edits opaque JSON.

- [ ] **Step 5: Replace demo product admin sections**

Replace “Services”, “Big Class”, and “Digital Products” navigation entries and their demo arrays with one “Katalog Produk” entry rendering `CatalogManagement`. Leave unrelated order/mentor/payment dashboard simulation untouched.

- [ ] **Step 6: Run typecheck, lint, and admin browser test**

Run: `pnpm typecheck`

Run: `pnpm lint`

Run: `pnpm exec playwright test tests/browser/catalog-admin.spec.ts`

Expected: pass.

- [ ] **Step 7: Commit admin management**

```bash
git add lib/catalog/admin.ts components/admin app/admin/page.tsx app/globals.css tests/browser/catalog-admin.spec.ts
git commit -m "feat: add persistent admin catalog management"
```

### Task 6: Minimal legacy checkout/catalog compatibility and demo-source retirement

**Files:**
- Modify: `app/checkout/[slug]/page.tsx`
- Create: `components/checkout/legacy-checkout.tsx`
- Modify: `lib/demo-store.ts`
- Modify: `app/dashboard/page.tsx`
- Modify: `tests/browser/public-auth.spec.ts`
- Modify: `tests/catalog.test.ts`

**Interfaces:**
- Consumes: `getPublicCatalogProduct()` and `toLegacyCheckoutItem()` from Task 3.
- Produces: existing simulation receives Product Master IDs/prices only; no legacy catalog option arrays remain.

- [ ] **Step 1: Write failing compatibility assertions**

Assert a fixed published Digital Product can be mapped only from its commercial UUID/current price, quotation offerings cannot enter simulated payment, protected checkout routes retain authentication behavior, and `programOptions`/`services` exports no longer exist.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm test -- tests/catalog.test.ts`

Run: `pnpm exec playwright test tests/browser/public-auth.spec.ts`

Expected: current checkout still imports deleted `lib/catalog.ts` and demo-store catalog options.

- [ ] **Step 3: Add server lookup wrapper around the existing checkout client**

Move the existing interactive simulation into `LegacyCheckout`, pass only `LegacyCheckoutCatalogItem`, and preserve its current steps/actions. The route server component loads the published product and fixed offering. Do not add new workflow state, cart behavior, payment methods, negotiation, or persistence.

- [ ] **Step 4: Remove demo-store catalog ownership**

Remove `programOptions`, `services`, and `programOptionsFor`. Where the demo dashboard needs labels for existing simulated fulfillment records, keep those labels inside the fixture that owns the simulated record rather than exposing reusable catalog data. Do not alter unrelated demo order/enrollment semantics.

- [ ] **Step 5: Run unit/auth browser tests and typecheck**

Run: `pnpm test`

Run: `pnpm typecheck`

Run: `pnpm exec playwright test tests/browser/public-auth.spec.ts`

Expected: pass with existing route protection preserved.

- [ ] **Step 6: Commit compatibility cleanup**

```bash
git add app/checkout components/checkout lib/demo-store.ts app/dashboard/page.tsx tests
git commit -m "refactor: isolate checkout from legacy catalog data"
```

### Task 7: Full verification and documentation alignment

**Files:**
- Modify: `docs/program-information.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified integrated subsystem and accurate repository documentation.

- [ ] **Step 1: Update source-of-truth documentation**

Document that the two guidebooks seed published Product Master, note the printed `Rp885.000` value is preserved verbatim, identify Product Master versus editorial ownership, list Big Class/Digital empty-state behavior, and state checkout remains simulated/out of scope.

- [ ] **Step 2: Run all unit and database tests**

Run: `pnpm test`

Run: `pnpm test:db -- --bootstrap`

Expected: pass without skipped security assertions.

- [ ] **Step 3: Run static verification**

Run: `pnpm typecheck`

Run: `pnpm lint`

Expected: pass without errors or warnings introduced by this feature.

- [ ] **Step 4: Run complete browser verification**

Run: `pnpm exec playwright test --workers 3`

Expected: all public, auth/onboarding, responsive, and admin catalog scenarios pass.

- [ ] **Step 5: Run production build**

Run: `pnpm build`

Expected: Next.js production build succeeds.

- [ ] **Step 6: Inspect commercial-source duplication and working tree**

Run:

```bash
rg -n "catalogItems|programOptions|intensivePackages|intensiveAddOns|intensiveBundles|Rp79\.000|Rp450\.000" app components lib
git diff --check
git status --short
```

Expected: no competing hardcoded commercial master remains; only explicitly scoped demo fulfillment fixtures or tests may contain demo transaction values.

- [ ] **Step 7: Commit final verification/documentation fixes**

```bash
git add README.md docs/program-information.md
git commit -m "docs: document product catalog master"
```
