# Product / Catalog Master Main-First Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the verified Product / Catalog Master implementation onto the latest `main` while preserving the new marketing frontend and updating PR #6 without a force-push.

**Architecture:** Start from `origin/main`, merge `68e485b` as the second parent, and resolve textual conflicts in favor of the current marketing architecture. Retain the Product Master database/domain/admin boundary, then add pure catalog presentation helpers so server pages can feed authoritative catalog data into the current `MarketingShell` components and type-specific detail pages.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript 5.7, Supabase/PostgreSQL with RLS, Node test runner via `tsx`, Playwright 1.63, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-10-product-catalog-main-integration-design.md`

## Global Constraints

- `origin/main` at `2ab6b2c` is the authoritative first-parent baseline.
- Preserve the latest marketing layout, components, CSS, asset registry, public routes, and responsive behavior.
- `/mentor` remains public; `/mentor/dashboard` remains protected.
- Product Master is the only runtime source for commercial identity, offerings, add-ons, bundles, prices, purchase flow, and publication state.
- Preserve Rp285.000 per session, Rp885.000 package price, and Rp950.000 reference price for the Top Student three-session offering.
- Do not seed fake Big Class or Digital Product production records.
- Do not modify or apply migrations to the remote Supabase project.
- Do not read, modify, stage, or commit the original checkout's `.playwright-cli/` directory.
- Update PR #6 through a fast-forward push to `feat/indonesian-copy-polish`; do not force-push and do not merge the PR.

---

### Task 1: Create the main-first Product Master merge

**Files:**
- Merge from: commit `68e485b`
- Preserve from main during conflicts: `app/page.tsx`
- Preserve and later adapt: `tests/browser/program-information.spec.ts`
- Preserve from main: `tests/browser/public-auth.spec.ts`
- Carry forward: `supabase/migrations/202609090001_product_catalog_master.sql`
- Carry forward: `supabase/tests/product_catalog.sql`
- Carry forward: `lib/catalog/**`
- Carry forward: `components/admin/catalog-*.tsx`
- Carry forward: `components/checkout/legacy-checkout.tsx`

**Interfaces:**
- Consumes: `origin/main` first-parent baseline and Product Master commit `68e485b`.
- Produces: a merge commit whose first parent is `main`, whose second parent contains `68e485b`, and whose tree preserves the current public routing shell before semantic adaptation.

- [ ] **Step 1: Start a no-commit merge from the Product Master head**

```powershell
git merge --no-ff --no-commit 68e485b
```

Expected: conflicts only in the overlapping homepage and browser-test files; all non-overlapping Product Master database/domain/admin files are staged.

- [ ] **Step 2: Inspect every conflict against both parent versions**

```powershell
git diff --name-only --diff-filter=U
git diff --cc -- app/page.tsx tests/browser/program-information.spec.ts tests/browser/public-auth.spec.ts
```

Expected: each conflict is understood in terms of current route/design intent rather than resolved mechanically.

- [ ] **Step 3: Resolve the homepage to the current shell before later data integration**

```tsx
import { HomePage } from '@/components/marketing/home-page'
import { MarketingShell } from '@/components/marketing/marketing-shell'

export default function Page() {
  return <MarketingShell><HomePage /></MarketingShell>
}
```

- [ ] **Step 4: Resolve browser tests to keep current navigation/auth expectations and Product Master pricing assertions**

Keep `Navigasi utama`, `/mentor/dashboard`, and current auth copy from `main`; retain the Product Master assertion that the three-session package is `Rp885.000` and does not expose checkout for consultation-led mentoring.

- [ ] **Step 5: Verify conflict resolution and main-only routing files**

```powershell
git diff --check
git diff --name-only --diff-filter=U
git diff origin/main -- proxy.ts app/mentor/page.tsx app/mentor/dashboard/layout.tsx app/marketing.css components/marketing
```

Expected: no unresolved conflicts; `proxy.ts` keeps `/mentor` public and protects `/mentor/dashboard`; marketing changes are limited to intentional later Product Master consumers.

- [ ] **Step 6: Commit the first-parent merge**

```powershell
git commit -m "merge: integrate product catalog onto latest main"
git show --no-patch --pretty=raw HEAD
```

Expected: first parent is `2ab6b2c`; second parent is `68e485b`.

### Task 2: Add the catalog-to-marketing presentation boundary

**Files:**
- Create: `lib/catalog/presentation.ts`
- Modify: `components/marketing/program-card.tsx`
- Modify: `components/catalog/catalog-browser.tsx`
- Modify: `tests/catalog.test.ts`

**Interfaces:**
- Consumes: `CatalogProductSummary`, `CatalogProductDetail`, and `AssetKey`.
- Produces: `CatalogMarketingProgram`, `CatalogMarketingDigitalProduct`, `catalogPriceLabel(product)`, `toMarketingProgram(product, index)`, `selectHomepagePrograms(products)`, `selectProgramDirectory(products)`, `selectDigitalProducts(products)`, and `directCheckoutOfferings(product)`.

- [ ] **Step 1: Write failing presentation tests**

```ts
test('catalog presentation uses fixed, quotation, and coming-soon labels without fake prices', () => {
  assert.equal(catalogPriceLabel(fixedSummary), 'Mulai Rp885.000')
  assert.equal(catalogPriceLabel(quoteSummary), 'Sesuai konsultasi')
  assert.equal(catalogPriceLabel(emptySummary), 'Segera hadir')
})

test('marketing selectors respect product type, featured state, and Product Master order', () => {
  assert.deepEqual(selectProgramDirectory(products).map(item => item.id), ['private', 'intensive', 'big'])
  assert.deepEqual(selectDigitalProducts(products).map(item => item.id), ['digital'])
  assert.deepEqual(selectHomepagePrograms(products).map(item => item.id), ['private', 'intensive', 'big'])
})

test('checkout presentation returns only fixed sellable direct-checkout offerings', () => {
  assert.deepEqual(directCheckoutOfferings(digitalDetail).map(item => item.id), ['digital-fixed'])
  assert.deepEqual(directCheckoutOfferings(consultationDetail), [])
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec tsx --test tests/catalog.test.ts`

Expected: FAIL because `lib/catalog/presentation.ts` and its exports do not exist.

- [ ] **Step 3: Implement the minimal pure presentation helpers**

```ts
export function catalogPriceLabel(product: CatalogProductSummary) {
  if (product.startingPriceAmount !== null) return `Mulai ${formatRupiah(product.startingPriceAmount)}`
  return product.hasQuotationPricing ? 'Sesuai konsultasi' : 'Segera hadir'
}

export function selectProgramDirectory(products: CatalogProductSummary[]) {
  return products.filter(product => product.productType !== 'digital_product')
}

export function selectDigitalProducts(products: CatalogProductSummary[]) {
  return products.filter(product => product.productType === 'digital_product')
}

export function directCheckoutOfferings(product: CatalogProductDetail) {
  if (product.defaultPurchaseFlow !== 'direct_checkout') return []
  return product.offerings.filter(offering => offering.isSellable && offering.pricingMode === 'fixed')
}
```

Add deterministic type-to-label, tone, and placeholder-asset mappings and use the shared price helper in `CatalogBrowser`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm exec tsx --test tests/catalog.test.ts`

Expected: all catalog tests pass.

- [ ] **Step 5: Commit the presentation boundary**

```powershell
git add lib/catalog/presentation.ts components/marketing/program-card.tsx components/catalog/catalog-browser.tsx tests/catalog.test.ts
git commit -m "feat: add catalog marketing presentation boundary"
```

### Task 3: Connect the current homepage and directories to Product Master

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/marketing/home-page.tsx`
- Modify: `app/program/page.tsx`
- Modify: `app/produk-digital/page.tsx`
- Modify: `app/explore/page.tsx`
- Modify: `tests/browser/marketing.spec.ts`
- Modify: `tests/browser/program-information.spec.ts`

**Interfaces:**
- Consumes: `listPublicCatalog()` and the presentation helpers from Task 2.
- Produces: server-loaded Product Master props for the existing marketing homepage, program directory, digital directory, and all-product explore page.

- [ ] **Step 1: Add failing browser expectations for the preserved shell and authoritative records**

```ts
await page.goto('/program')
await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible()
await expect(page.locator('.marketing-program-card').filter({ hasText: 'Mentoring Privat' })).toContainText('Rp300.000')
await expect(page.getByText('Kelas Besar Kasus Bisnis')).toHaveCount(0)

await page.goto('/produk-digital')
await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible()
await expect(page.getByText('Belum tersedia untuk pembelian')).toHaveCount(2)
```

Update the homepage assertion to require its existing headings and navigation while the program prices and links come from Product Master.

- [ ] **Step 2: Build and run the focused browser tests to verify RED**

Start an isolated local PostgreSQL instance and bootstrap its exact disposable
database before the first Product Master browser run:

```powershell
initdb -D .test-postgres/data -A trust -U postgres
pg_ctl -D .test-postgres/data -o "-p 55440 -h 127.0.0.1" -l .test-postgres/server.log start
createdb -h 127.0.0.1 -p 55440 -U postgres strativate_test_catalog_integration
$env:TEST_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55440/strativate_test_catalog_integration'
pnpm test:db -- --bootstrap
pnpm build
pnpm exec playwright test tests/browser/marketing.spec.ts tests/browser/program-information.spec.ts --workers 1
```

Expected: FAIL because `main` still sources mentoring cards from `lib/program-information.ts` and the Product Master branch's `/explore` is not wrapped in `MarketingShell`.

- [ ] **Step 3: Make homepage and directory pages server-backed without changing their visual hierarchy**

```tsx
export default async function Page() {
  const catalogProducts = await listPublicCatalog()
  return <MarketingShell><HomePage catalogProducts={catalogProducts} /></MarketingShell>
}
```

Apply the same server-read pattern to `/program` and `/produk-digital`. Keep current placeholder arrays only when the corresponding published Product Master type is absent. Wrap `/explore` in `MarketingShell` while retaining `CatalogBrowser` filtering.

- [ ] **Step 4: Run focused unit, build, and browser tests to verify GREEN**

Run: `pnpm test && pnpm build && pnpm exec playwright test tests/browser/marketing.spec.ts tests/browser/program-information.spec.ts --workers 1`

Expected: unit tests and both browser specs pass with the new design intact.

- [ ] **Step 5: Commit public catalog directories**

```powershell
git add app/page.tsx app/program/page.tsx app/produk-digital/page.tsx app/explore/page.tsx components/marketing/home-page.tsx tests/browser/marketing.spec.ts tests/browser/program-information.spec.ts
git commit -m "feat: connect marketing pages to product master"
```

### Task 4: Add type-specific Product Master detail rendering

**Files:**
- Modify: `app/program/[slug]/page.tsx`
- Modify: `components/programs/program-detail.tsx`
- Modify: `tests/catalog.test.ts`
- Modify: `tests/browser/program-information.spec.ts`

**Interfaces:**
- Consumes: `CatalogProductDetail`, `directCheckoutOfferings(product)`, and code-keyed editorial content.
- Produces: mentoring, Big Class, and Digital Product detail branches inside `MarketingShell`; fixed Digital Product checkout links in the form `/checkout/<slug>?item=<offering-uuid>`.

- [ ] **Step 1: Add failing type-specific behavior tests**

```ts
test('consultation products expose no direct checkout offerings', () => {
  assert.deepEqual(directCheckoutOfferings(privateDetail), [])
})

test('digital direct checkout preserves the fixed commercial-item UUID', () => {
  assert.deepEqual(directCheckoutOfferings(digitalDetail).map(item => item.id), ['digital-fixed'])
})
```

Add a browser assertion that mentoring details retain the marketing navigation and contain no checkout link.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm exec tsx --test tests/catalog.test.ts`

Expected: the new fixture/behavior fails until the type-specific rendering boundary is complete.

- [ ] **Step 3: Split detail rendering by Product Master type**

```tsx
export function ProductDetail(props: ProductDetailProps) {
  if (props.product.productType === 'private_mentoring' || props.product.productType === 'intensive_mentoring') {
    return <MentoringProductDetail {...props} />
  }
  return <GeneralCatalogProductDetail product={props.product} />
}
```

The general detail renders only Product Master title, description, digital type when present, published offerings, price mode, and eligible direct-checkout actions. It does not render Intensive Mentoring packages, competition categories, or unsupported cohort/file-delivery claims.

- [ ] **Step 4: Wrap the route in the current marketing shell**

```tsx
return <MarketingShell><ProductDetail product={product} comparisons={comparisons} /></MarketingShell>
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `pnpm test && pnpm build && pnpm exec playwright test tests/browser/program-information.spec.ts --workers 1`

Expected: mentoring prices/add-ons/bundles remain correct, navigation is present, and consultation pages contain no checkout action.

- [ ] **Step 6: Commit type-specific detail pages**

```powershell
git add app/program/[slug]/page.tsx components/programs/program-detail.tsx tests/catalog.test.ts tests/browser/program-information.spec.ts
git commit -m "feat: render catalog details by product type"
```

### Task 5: Remove parallel commercial sources and retain admin management

**Files:**
- Delete: `lib/catalog.ts`
- Modify: `app/admin/page.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `lib/demo-store.ts`
- Modify: `package.json`
- Modify: `tests/catalog.test.ts`
- Modify: `tests/marketing-content.test.ts`

**Interfaces:**
- Consumes: Product Master admin components and public `/explore` route.
- Produces: no runtime hardcoded catalog arrays; admin “Katalog Produk”; dashboard discovery links to Product Master; unit command includes all `tests/*.test.ts`.

- [ ] **Step 1: Add a failing source-ownership regression test**

```ts
test('runtime source files do not restore legacy commercial catalogs', () => {
  for (const source of runtimeSources) {
    assert.doesNotMatch(source.text, /programOptions|const services = \[/)
  }
})
```

The test reads only the named runtime source files and asserts absence of the retired identifiers; it does not scan fixtures or migration seed data.

- [ ] **Step 2: Run the ownership test and verify RED**

Run: `pnpm test`

Expected: FAIL because `main` still contains `programOptions` and fake admin services after the merge baseline.

- [ ] **Step 3: Remove the parallel arrays and wire existing Product Master admin UI**

Use `CatalogManagement` for the admin product section. Replace dashboard quick-purchase/configuration behavior with links to `/explore`; keep previously purchased simulated orders as explicitly demo operational state. Retain `commercialItemId` in checkout-created demo orders.

- [ ] **Step 4: Audit runtime commercial references**

```powershell
rg -n "catalogItems|getCatalogItem|programOptions|const services = \[|Rp 750 ribu|Rp 1,2 juta|Rp 450 ribu|Rp 79 ribu" app components lib --glob '!lib/demo-labels.ts'
```

Expected: no current-catalog owner outside `lib/catalog/`; any remaining amount is clearly historical simulated order data and not used for a current offering or purchase.

- [ ] **Step 5: Run unit tests and verify GREEN**

Run: `pnpm test`

Expected: all current main and Product Master unit tests pass.

- [ ] **Step 6: Commit source retirement and admin integration**

```powershell
git add -A app/admin/page.tsx app/dashboard/page.tsx lib/catalog.ts lib/demo-store.ts package.json tests/catalog.test.ts tests/marketing-content.test.ts
git commit -m "feat: retire parallel commercial catalog sources"
```

### Task 6: Verify database security locally without remote Supabase access

**Files:**
- Verify: `supabase/migrations/202609090001_product_catalog_master.sql`
- Verify: `supabase/tests/product_catalog.sql`
- Verify: `scripts/test-database.ts`
- Verify: `lib/supabase/database.types.ts`

**Interfaces:**
- Consumes: an empty disposable local PostgreSQL database named `strativate_test_*` via `TEST_DATABASE_URL`.
- Produces: evidence that every migration, RLS policy, grant, lifecycle rule, authoritative price, and Product Master SQL test passes.

- [ ] **Step 1: Recreate the exact disposable local test database**

```powershell
dropdb -h 127.0.0.1 -p 55440 -U postgres --if-exists strativate_test_catalog_integration
createdb -h 127.0.0.1 -p 55440 -U postgres strativate_test_catalog_integration
$env:TEST_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55440/strativate_test_catalog_integration'
```

The value must point to localhost/local PostgreSQL and the database name must begin with `strativate_test_`. No `NEXT_PUBLIC_SUPABASE_URL` or remote Supabase credential is used.

- [ ] **Step 2: Run the full migration and SQL suite**

Run: `pnpm test:db -- --bootstrap`

Expected: every migration and `auth_security.sql`, `institution_import.sql`, `mentor_invites.sql`, and `product_catalog.sql` pass.

- [ ] **Step 3: If a database assertion fails, reproduce it in the relevant SQL suite before changing migration code**

Run: `pnpm test:db -- --bootstrap` against a newly emptied disposable database after each migration correction.

Expected: correction is driven by a failing SQL assertion and the full suite returns green.

### Task 7: Run complete application verification and repair regressions test-first

**Files:**
- Verify: all changed application, migration, test, and documentation files.
- Modify if failures require: the narrowest source and corresponding regression test.

**Interfaces:**
- Consumes: completed Tasks 1–6.
- Produces: a clean worktree with all requested verification commands passing.

- [ ] **Step 1: Run unit tests and typecheck**

```powershell
pnpm test
pnpm typecheck
```

Expected: zero failures.

- [ ] **Step 2: Run lint and production build**

```powershell
pnpm lint
pnpm build
```

Expected: zero errors and a successful Next.js production build.

- [ ] **Step 3: Run the complete browser suite against the disposable Product Master database**

```powershell
pnpm exec playwright test --workers 3
```

Expected: every existing marketing, auth, onboarding, public route, Product Master, and mobile layout test passes with no browser exceptions or horizontal overflow.

- [ ] **Step 4: Apply the systematic-debugging workflow to any failure**

For each failure, capture the exact output, isolate the root cause, add or confirm a failing regression test, make the smallest correction, rerun the focused test, then rerun the affected full command.

- [ ] **Step 5: Review the final diff against both parents**

```powershell
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
git log --first-parent --oneline origin/main..HEAD
git merge-base --is-ancestor origin/main HEAD
git merge-base --is-ancestor 68e485b HEAD
git status --short --branch
```

Expected: both source heads are ancestors, `main` is first-parent, no unrelated files are present, and the worktree is clean after any final verification commit.

- [ ] **Step 6: Commit any verification-driven fixes**

```powershell
git status --short
git diff --check
git add -A
git commit -m "fix: resolve catalog integration regressions"
```

Skip this commit only when no verification-driven edits were needed.

### Task 8: Update and verify PR #6

**Files:**
- Remote branch: `origin/feat/indonesian-copy-polish`
- Pull request: `https://github.com/qiqioberon/strativate/pull/6`

**Interfaces:**
- Consumes: verified local integration `HEAD` containing both `origin/main` and `68e485b`.
- Produces: a fast-forward update of PR #6 with a mergeable, open, unmerged status.

- [ ] **Step 1: Re-fetch and confirm remote branch ancestry before pushing**

```powershell
git fetch origin --prune
git merge-base --is-ancestor origin/feat/indonesian-copy-polish HEAD
git merge-base --is-ancestor origin/main HEAD
```

Expected: both commands exit zero. If `origin/main` advanced, integrate the new main commit as first-parent work before continuing verification.

- [ ] **Step 2: Push without force to the existing PR branch**

```powershell
git push origin HEAD:feat/indonesian-copy-polish
```

Expected: fast-forward update succeeds; no new PR is created.

- [ ] **Step 3: Verify PR state through the GitHub API**

```powershell
Invoke-RestMethod -Headers @{ Accept='application/vnd.github+json'; 'User-Agent'='Codex-Strativate' } -Uri 'https://api.github.com/repos/qiqioberon/strativate/pulls/6'
```

Expected: PR #6 is open, base is `main`, head SHA equals the pushed commit, and `mergeable_state` is not `dirty`. Poll only long enough for GitHub to finish recalculating mergeability/checks.

- [ ] **Step 4: Report completion**

Report the Product Master functionality moved, semantic conflicts found, frontend adaptations, confirmation that current `main` design/routing remains intact, every verification result, final commit SHA, PR #6 mergeability/check status, and any remaining caveat such as the intentionally unapplied remote migration.
