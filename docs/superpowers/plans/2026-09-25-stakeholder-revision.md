# Stakeholder Website Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved stakeholder revision across public marketing, Publications and Competitions CMS, and Digital Product commerce while preserving existing product flows.

**Architecture:** Keep the route-native `MarketingShell`, existing Supabase server/client boundaries, and admin section architecture. Add two database-backed editorial domains with shared public/admin patterns, then extend Digital Product presentation and commerce through additive migrations and authoritative RPCs.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, CSS modules/global scoped marketing CSS, Supabase/Postgres/RLS, Node test runner, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-25-stakeholder-revision-design.md`

## Global Constraints

- Public marketing copy covered by the revision is English; authenticated dashboards retain their existing language unless directly touched.
- Use Poppins and the existing white/orange/orange-red visual system; green is reserved for WhatsApp consultation actions.
- Do not invent partners, institutions, awards, products, sales, prices, competitions, testimonials, or mentor credentials.
- Keep Digital Product feature flags, detail pages, paid-content delivery, add-to-cart, and Midtrans payment lifecycle behavior compatible.
- New migrations are forward-only after `202609210004_dev_mentor_account_seed.sql`; do not rewrite historical migrations.
- Work directly on `main`, use at most three substantive commits, and push only after fresh verification.

## Review Focus

- Anonymous reads must never see draft Publications/Competitions or purchaser data; cover with public-query and RLS tests in Task 4.
- Discount codes must not apply to incompatible products, expired/inactive codes, repeated applications, or client-supplied totals; cover with pure and SQL tests in Task 6.
- Existing published Digital Product checkout must continue using database prices and Midtrans order totals; cover with commerce regression tests in Task 6.
- Empty CMS, missing images, missing partner logos, and zero-search-result states must remain usable and non-factual; cover route/component tests in Tasks 3–5.
- Responsive dialogs and filters must not overflow narrow viewports or lose keyboard-close behavior; cover browser checks in Task 7.

### Task 1: Establish tooling, spec artifacts, and test contracts

**Files:**
- Create: `docs/superpowers/specs/2026-09-25-stakeholder-revision-design.md`
- Create: `docs/superpowers/plans/2026-09-25-stakeholder-revision.md`
- Create: `.superpowers/sdd/2026-09-25-stakeholder-revision/progress.md`
- Modify: `tests/marketing-content.test.ts`
- Create: `tests/stakeholder-revision-contract.test.ts`

**Interfaces:**
- Consumes: existing route/content/admin source files.
- Produces: executable contracts for English navigation, homepage ordering, no `TextType`, new routes/admin sections, and safe empty states.

- [ ] **Step 1: Confirm the clean main baseline and installed toolchain**

Run:

```powershell
git status --short --branch
git fetch origin main
git rev-parse HEAD
git rev-parse origin/main
$env:COREPACK_ENABLE_STRICT='0'; pnpm --version
```

Expected: branch is `main`, local and remote match before implementation, and the dependency install strategy is recorded if pnpm remains below `10.17.1`.

- [ ] **Step 2: Write failing source-contract tests**

Assert that the future sources contain English route labels, `/publications`, `/competitions`, the approved homepage section order, the approved hero copy, and no import/use of `TextType` in `components/marketing/home-page.tsx`.

- [ ] **Step 3: Run the contract tests and verify RED**

Run: `pnpm exec tsx --test tests/stakeholder-revision-contract.test.ts`

Expected: failures identify the current Indonesian navigation/order and remaining typing animation.

- [ ] **Step 4: Create the SDD ledger and record shared interfaces**

Start the ledger with `# SDD ledger — plan: docs/superpowers/plans/2026-09-25-stakeholder-revision.md`, then record that Task 2 consumes the marketing contracts, Task 4 consumes the shared competition category schema, Task 5 consumes the published-content types, and Task 6 consumes the Digital Product/order schema.

### Task 2: Apply the public marketing revision

**Files:**
- Modify: `lib/content/marketing-content.ts`
- Modify: `lib/content/services.ts`
- Modify: `lib/program-information.ts`
- Modify: `components/marketing/home-page.tsx`
- Modify: `components/marketing/site-header.tsx`
- Modify: `components/marketing/site-footer.tsx`
- Modify: `components/marketing/mentor-card.tsx`
- Modify: `components/marketing/mentor-portrait-media.tsx`
- Modify: `app/program/page.tsx`
- Modify: `app/mentor/page.tsx`
- Modify: `app/produk-digital/page.tsx`
- Modify: `app/tentang-kami/page.tsx`
- Modify: `app/tanya-jawab/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/marketing.css`
- Modify: `app/mentor-marquee.css`
- Modify: `tests/marketing-content.test.ts`
- Modify: `tests/homepage-testimonials.test.ts`
- Modify: `tests/browser/marketing.spec.ts`

**Interfaces:**
- Consumes: existing server-loaded hero posters, mentors, testimonials, Digital Products, public contact, program editorial data, and `MarketingShell`.
- Produces: English public pages, revised homepage ordering, green WhatsApp emphasis, consistent mentor media, responsive navigation, and public Digital Product discovery props.

- [ ] **Step 1: Add failing tests for English copy and homepage order**

Assert exact approved phrases including `Win Business Competitions with Expert Mentoring`, `Where Future-Ready Skills Meet Competition Success`, `What We Specialize In`, `Partnered with Leading Organizations`, and section index order `homepage-success-proof-section < homepage-who-we-are-section < homepage-programs-section < homepage-products-section < homepage-expertise-section < homepage-mentors-section < homepage-why-choose-section`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm exec tsx --test tests/marketing-content.test.ts tests/homepage-testimonials.test.ts tests/stakeholder-revision-contract.test.ts`

Expected: current Indonesian strings, obsolete section order, and `TextType` assertions fail.

- [ ] **Step 3: Implement the English editorial source and navigation**

Change public labels/copy to the approved English wording, add Publications and Competitions navigation entries, keep Digital Products filtered by its feature flag, set the root document language/metadata locale to English for public marketing, and retain source-backed contact data.

- [ ] **Step 4: Replace the homepage composition**

Remove the `TextType` import and render the approved static hero. Add compact proof, Who We Are, Programs, Products, eight editorial expertise cards, Mentors, six concise Why Choose cards, conditional testimonial stories, and a Trusted Partners placeholder. Keep existing real data queries and links; never render fabricated logos or records.

- [ ] **Step 5: Revise program, mentor, about, FAQ, and storefront presentation**

Use the approved English Programs services and mentoring-path copy, remove `Mulai dari kebutuhanmu`, make mentor role/headline rows prominent, normalize portrait frame/object positioning, translate About/FAQ content, and add search/filter/sort controls to the Digital Product directory using real fields only.

- [ ] **Step 6: Update scoped responsive CSS and reduced-motion behavior**

Add the orange/red gradient headers, compact whitespace/dividers, green WhatsApp CTA, mobile filter stacking, consistent portrait frame, focus states, and `prefers-reduced-motion` fallbacks without changing dashboard styles.

- [ ] **Step 7: Run focused unit checks and commit Batch 1**

Run:

```powershell
pnpm exec tsx --test tests/marketing-content.test.ts tests/homepage-testimonials.test.ts tests/stakeholder-revision-contract.test.ts
pnpm lint
```

Expected: focused tests and lint pass. Commit the spec plus this completed public marketing batch as `feat(marketing): apply stakeholder website revision`.

### Task 3: Add Publications and Competitions public domain helpers

**Files:**
- Create: `lib/publications/types.ts`
- Create: `lib/publications/validation.ts`
- Create: `lib/publications/server.ts`
- Create: `lib/competitions/types.ts`
- Create: `lib/competitions/validation.ts`
- Create: `lib/competitions/server.ts`
- Create: `tests/publications-validation.test.ts`
- Create: `tests/competitions-validation.test.ts`

**Interfaces:**
- Consumes: Supabase server client, public storage URL helpers, and shared database types.
- Produces: `validatePublicationInput`, `validateCompetitionInput`, `listPublishedPublications`, and `listPublishedCompetitions` with typed public rows.

- [ ] **Step 1: Write failing validation tests**

Cover trimmed required fields, slug normalization, safe optional URLs, publication body length, competition deadline parsing, registration URL requirements, and rejection of path traversal/image paths outside the dedicated bucket prefix.

- [ ] **Step 2: Run validation tests and verify RED**

Run: `pnpm exec tsx --test tests/publications-validation.test.ts tests/competitions-validation.test.ts`

Expected: module/export failures.

- [ ] **Step 3: Implement pure validators and typed server readers**

Return field-level errors without rendering raw HTML. Public readers select only published rows, order featured content first, and convert approved cover paths to public storage URLs.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm exec tsx --test tests/publications-validation.test.ts tests/competitions-validation.test.ts`

Expected: all validation cases pass.

### Task 4: Add forward migrations, types, storage, and database tests

**Files:**
- Create: `supabase/migrations/202609250001_marketing_publications_competitions.sql`
- Create: `supabase/tests/marketing_publications_competitions.sql`
- Modify: `lib/supabase/database.types.ts`
- Modify: `tests/stakeholder-revision-contract.test.ts`

**Interfaces:**
- Consumes: current latest migration `202609210004_dev_mentor_account_seed.sql`, existing `is_admin()` and `touch_updated_at()` helpers, and `competition_categories`.
- Produces: `marketing_publications`, `marketing_competitions`, dedicated cover buckets/policies, admin/public RLS, and typed table rows/RPC signatures where used.

- [ ] **Step 1: Write failing migration contract assertions**

Assert the migration declares UUID primary keys, constraints, indexes, updated-at triggers, published-only anon/authenticated policies, admin-only writes, category reuse with `on delete set null`, dedicated storage prefixes, MIME restrictions, and grants.

- [ ] **Step 2: Run the migration contract and database test to verify RED**

Run: `pnpm exec tsx --test tests/stakeholder-revision-contract.test.ts`; if local PostgreSQL is available, run `pnpm test:db -- --bootstrap` after adding the SQL test.

Expected: source contract fails because the migration and types do not exist; database test cannot pass until the schema is present.

- [ ] **Step 3: Implement the forward migration**

Create both tables with safe constraints, indexes, triggers, published-read/admin-write RLS, explicit grants, storage buckets and policies, and admin-only management functions where direct client table writes would not provide the required validation.

- [ ] **Step 4: Update generated-style TypeScript types**

Add row/table definitions and any RPC return signatures used by the server/admin layers. Keep type names aligned with the exact SQL columns.

- [ ] **Step 5: Add SQL security/domain tests and run them**

Test draft invisibility, published visibility, anonymous write denial, admin CRUD, storage path/MIME denial, category FK behavior, and safe competition/publication constraints. Run `pnpm test:db -- --bootstrap` when the local database environment supports it; record unavailable external credentials accurately if it does not.

- [ ] **Step 6: Implement public route pages**

Create `app/publications/page.tsx` and `app/competitions/page.tsx` using `MarketingShell`, gradient headers, featured/catalogue sections, clear empty states, safe external CTAs, and responsive cards. Add browser/source tests for both routes.

### Task 5: Add admin Publications and Competitions management

**Files:**
- Create: `components/admin/publication-management.tsx`
- Create: `components/admin/competition-management.tsx`
- Create: `components/admin/marketing-content-management.module.css`
- Modify: `app/admin/page.tsx`
- Create: `tests/publication-admin.test.ts`
- Create: `tests/competition-admin.test.ts`
- Create: `tests/browser/admin-marketing-content.spec.ts`

**Interfaces:**
- Consumes: typed Supabase client, validators/server helpers, existing `data-management.module.css`, dialog conventions, and shared competition categories.
- Produces: `Publications` and `Competitions` sections under `Konten`, list/search/filter views, modal add/edit, upload preview, draft/publish, delete, and feedback states.

- [ ] **Step 1: Write failing admin source/UI contracts**

Assert section union/groups/render branches, `Add Publication`, `Add Competition`, modal dialog semantics, `showModal`, `onCancel`, `aria-label` close controls, upload accept lists, draft/publish actions, and validator usage.

- [ ] **Step 2: Run focused admin tests and verify RED**

Run: `pnpm exec tsx --test tests/publication-admin.test.ts tests/competition-admin.test.ts`

Expected: missing component and admin section assertions fail.

- [ ] **Step 3: Implement the publication manager**

Use the existing Digital Product manager layout: loading/error/empty states, search, featured/published badges, edit dialog, plain-text fields, cover upload preview, validation, delete confirmation, and responsive sticky/clear action footer.

- [ ] **Step 4: Implement the competition manager**

Add organizer/category/audience/deadline/prize/detail/registration fields, category select from `competition_categories`, date validation, cover upload, search/status filtering, publication toggles, edit/delete feedback, and mobile-safe dialog behavior.

- [ ] **Step 5: Wire both sections into the existing admin dashboard**

Add both IDs to the `Section` union and `Konten` group, import/render managers, and keep admin interaction language consistent with existing dashboard conventions.

- [ ] **Step 6: Run admin tests and commit Batch 2**

Run:

```powershell
pnpm exec tsx --test tests/publication-admin.test.ts tests/competition-admin.test.ts tests/publications-validation.test.ts tests/competitions-validation.test.ts
pnpm lint
```

Expected: content helpers, admin contracts, and lint pass. Commit as `feat(content): add publications and competitions CMS`.

### Task 6: Implement sales proof and discount-code commerce

**Files:**
- Create: `supabase/migrations/202609250002_digital_product_sales_and_discounts.sql`
- Create: `supabase/tests/digital_product_sales_discounts.sql`
- Create: `lib/commerce/discounts.ts`
- Create: `lib/commerce/sales-proof.ts`
- Create: `components/admin/discount-code-management.tsx`
- Create: `components/admin/discount-code-management.module.css`
- Modify: `lib/supabase/database.types.ts`
- Modify: `lib/commerce/server.ts`
- Modify: `lib/commerce/types.ts`
- Modify: `components/commerce/cart-view.tsx`
- Modify: `components/admin/digital-product-management.tsx`
- Modify: `app/admin/page.tsx`
- Modify: `app/produk-digital/page.tsx`
- Modify: `app/produk-digital/[slug]/page.tsx`
- Create: `tests/commerce-discounts.test.ts`
- Create: `tests/sales-proof.test.ts`
- Modify: `tests/digital-product-storefront.test.ts`

**Interfaces:**
- Consumes: current `digital_products`, `carts`, `orders`, `order_items`, `payment_attempts`, shared `resolve_commerce_item`, and existing cart UI.
- Produces: `calculateDiscount`, `validateDiscountCode`, `getVisibleSalesCount`, authoritative discount RPCs, public sales counts, and admin discount-code CRUD.

- [ ] **Step 1: Write failing pure tests**

Test percentage/fixed calculations, product scope, expiry/inactive/unknown/repeated-code rejection, no negative totals, paid-only sales counts, and `show_sales_count=false` hiding.

- [ ] **Step 2: Run pure tests and verify RED**

Run: `pnpm exec tsx --test tests/commerce-discounts.test.ts tests/sales-proof.test.ts`

Expected: missing helper/export failures.

- [ ] **Step 3: Implement pure pricing/privacy helpers**

Keep them deterministic and integer-based for IDR amounts. `getVisibleSalesCount` returns `null` unless explicitly enabled and otherwise returns only a count.

- [ ] **Step 4: Write failing SQL contract/security tests**

Cover authoritative cart application, paid-order-only counting, incompatible product scope, code status/validity, redemption limits, unique repeated redemption, immutable snapshots, and Midtrans total source.

- [ ] **Step 5: Run SQL tests and verify RED**

Run `pnpm test:db -- --bootstrap` when local PostgreSQL is configured. Expected: the new schema/function assertions fail before implementation.

- [ ] **Step 6: Implement the additive commerce migration**

Add discount tables, product scope, redemption table, cart/order/order-item snapshot columns, admin RLS, `apply_discount_code`, `remove_discount_code`, authoritative `get_active_cart` fields, and a locked/recalculated `create_order_from_cart` replacement. Add `show_sales_count` and a public server-safe sales-count query over paid order items.

- [ ] **Step 7: Wire server/UI paths**

Expose discounts in cart UI with apply/remove feedback, keep payment creation reading `orders.total_amount`, display guarded sales counts on catalogue/detail cards, add the admin flag to Digital Product editing, and add discount-code CRUD under the existing admin shell.

- [ ] **Step 8: Run commerce tests and commit Batch 3**

Run:

```powershell
pnpm exec tsx --test tests/commerce-discounts.test.ts tests/sales-proof.test.ts tests/digital-product-storefront.test.ts
pnpm lint
```

Expected: pure commerce tests, storefront contracts, and lint pass. Commit as `feat(commerce): enhance digital product discovery and discounts`.

### Task 7: Full application and browser verification

**Files:**
- Modify only the narrowest source/test files required by fresh failures.
- Verify: all changed files, migrations, tests, and docs.

**Interfaces:**
- Consumes: all completed batches and the approved spec.
- Produces: evidence-backed final state, clean worktree, and pushed `main`.

- [ ] **Step 1: Install the required pnpm toolchain or record the exact fallback**

Retry dependency installation with the configured package-manager version or an equivalent non-destructive workaround, ensuring `node_modules/next/dist/docs/` is read before relying on Next.js APIs.

- [ ] **Step 2: Run full unit/type/lint checks**

Run: `pnpm test`; `pnpm typecheck`; `pnpm lint`.

Expected: zero failures caused by the revision.

- [ ] **Step 3: Run database checks**

Run: `pnpm test:db -- --bootstrap` against a disposable local `strativate_test_*` database if available. Do not use production or remote destructive credentials.

- [ ] **Step 4: Run production build**

Run: `pnpm build` and inspect the complete output for route/type/static-generation failures.

- [ ] **Step 5: Run targeted browser checks**

Run the marketing, admin marketing content, Digital Product storefront, and existing responsive suites with viewport coverage for 360, 390, 768, 1024, and 1440 where the project configuration supports it. Check navigation, empty states, no horizontal overflow, dialogs, filters, mentor crops, and console errors.

- [ ] **Step 6: Reopen the PDF and perform the second manual comparison**

Compare every stakeholder page against the implemented routes and record any intentionally empty approved-asset slot. Do not claim completion while a requested behavior remains unimplemented.

- [ ] **Step 7: Review git state and remote movement**

Run `git status`, `git log --oneline -n 8`, `git fetch origin main`, and compare `origin/main` to `HEAD`. If remote `main` moved, rebase semantically, rerun affected checks, and verify the three commit ceiling remains satisfied.

- [ ] **Step 8: Push directly to main and verify**

Run `git push origin main`, then `git rev-parse HEAD`, `git status --short --branch`, and `git log --oneline -n 5`. Report the resulting SHA, commits, checks, inaccessible references, and approved assets left empty.
