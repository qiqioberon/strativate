# Phase 2 Shared Commerce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real public Digital Product storefront and a reusable, secure Cart → Checkout → Order → Midtrans Snap Embedded → paid ownership flow.

**Architecture:** PostgreSQL and RLS own identity, authorization, concurrency, totals, snapshots, and safe payment transitions. Thin Next.js server boundaries use those database contracts; focused client components own Cart interactions and Snap embedding, while Digital Product remains the first resolver adapter rather than the shape of shared commerce.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript 5.7, Supabase SSR/PostgreSQL/RLS/Storage, Midtrans HTTP APIs and Snap.js, Node test runner, pgTAP-style SQL regression runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-14-phase-2-shared-commerce-design.md`

## Global Constraints

- Work from base commit `300fa5af246b57204daab74a0e4a200e1103df66` on branch `feat/phase-2-shared-commerce`.
- Never edit migration `202609140004_mentor_account_status_weekly_availability.sql` or any earlier migration.
- Do not recreate legacy Product Catalog tables, functions, views, types, or runtime imports.
- Keep money as non-negative safe integer Rupiah; browser values never authorize price, total, user, or payment state.
- Keep actual product files, mentoring commerce, quantities, discounts, tax, shipping, subscriptions, refund UI, and invented business data out of scope.
- Keep `MIDTRANS_SERVER_KEY` and `SUPABASE_SECRET_KEY` server-only and commit no real credentials.
- Keep `FEATURE_DIGITAL_PRODUCTS` off unless its exact runtime value is `true`; admin CRUD remains available independently.
- Use `window.snap.embed` in the checkout page. Do not use redirect checkout, a custom iframe, or popup `snap.pay` as the primary flow.

---

### Task 1: Shared Commerce Registry and Public Digital Product Access

**Files:**
- Create: `supabase/migrations/202609140005_shared_commerce.sql`
- Create: `supabase/tests/shared_commerce.sql`
- Modify: `scripts/test-database.ts`
- Test: `tests/shared-commerce-migration.test.ts`

**Interfaces:**
- Produces: `commerce_items`, `carts`, `cart_items`, `orders`, `order_items`; `resolve_commerce_item(uuid)`; `get_or_create_active_cart()`; `add_cart_item(uuid)`; `remove_cart_item(uuid)`; `get_active_cart()`; `create_order_from_cart(uuid)`; `list_owned_digital_products()`.
- Consumes: `digital_products`, `profiles`, `mentee_profiles`, `touch_updated_at()`, `is_admin()`, and `auth.uid()`.

- [ ] Write static and SQL tests proving the migration is forward-only, makes product records/covers publicly readable without public writes, backfills/synchronizes commerce identity, and leaves legacy catalog objects absent.
- [ ] Run `pnpm test -- --test-name-pattern="shared commerce migration"` and `pnpm test:db -- --bootstrap`; verify the new assertions fail because migration `202609140005` does not exist.
- [ ] Implement the registry, resolver, Cart/Order tables, indexes, triggers, RLS, grants, Mentee guard, Cart RPCs, transactional idempotent Order RPC, immutable Order Item protection, and ownership query in `202609140005_shared_commerce.sql`.
- [ ] Register `supabase/tests/shared_commerce.sql` after Digital Product tests in `scripts/test-database.ts`.
- [ ] Run `pnpm test` and `pnpm test:db -- --bootstrap`; require all new registry, Cart, Order, RLS, snapshot, and ownership assertions to pass.
- [ ] Commit with `git add supabase/migrations/202609140005_shared_commerce.sql supabase/tests/shared_commerce.sql scripts/test-database.ts tests/shared-commerce-migration.test.ts && git commit -m "feat: add secure shared commerce domain"`.

### Task 2: Payment Attempt Persistence and Atomic Payment Transitions

**Files:**
- Create: `supabase/migrations/202609140006_midtrans_payment_attempts.sql`
- Create: `supabase/tests/payment_attempts.sql`
- Modify: `scripts/test-database.ts`
- Test: `tests/payment-attempt-migration.test.ts`

**Interfaces:**
- Produces: `payment_attempts`; `reserve_midtrans_payment_attempt(uuid)` returning attempt identity and expected amount; `store_midtrans_snap_token(uuid,text)`; `apply_midtrans_payment_status(uuid,text,text,text,text)` with monotonic Order transitions.
- Consumes: Task 1 `orders` and `order_items`; privileged `service_role` calls only.

- [ ] Write failing static/SQL tests for attempt uniqueness, retry after terminal failure, server-owned mutations, expected amount preservation, idempotent duplicate application, paid-state monotonicity, and exact `paid_at` preservation.
- [ ] Run focused unit and database tests and verify failure before the migration exists.
- [ ] Implement the table, checks, partial active-attempt uniqueness, RLS/grants, reservation/token functions, and payment-state application function in `202609140006_midtrans_payment_attempts.sql`.
- [ ] Register `payment_attempts.sql` in the database runner after `shared_commerce.sql`.
- [ ] Run `pnpm test` and `pnpm test:db -- --bootstrap` and require the payment persistence suite to pass.
- [ ] Commit with `git add supabase/migrations/202609140006_midtrans_payment_attempts.sql supabase/tests/payment_attempts.sql scripts/test-database.ts tests/payment-attempt-migration.test.ts && git commit -m "feat: add payment attempt state machine"`.

### Task 3: Shared TypeScript Commerce Contracts

**Files:**
- Modify: `lib/supabase/database.types.ts`
- Create: `lib/commerce/types.ts`
- Create: `lib/commerce/money.ts`
- Create: `lib/commerce/server.ts`
- Test: `tests/commerce-domain.test.ts`

**Interfaces:**
- Produces: `CommerceItem`, `ResolvedCommerceItem`, `Cart`, `CartItem`, `Order`, `OrderItem`, `OwnedDigitalProduct`, `PaymentAttempt`; `formatRupiah(number)`; typed server query functions `listPublicDigitalProducts`, `getPublicDigitalProduct`, `getActiveCart`, `createOrderFromCart`, `listOwnedDigitalProducts`.
- Consumes: Task 1/2 database rows and RPC signatures.

- [ ] Write tests for integer-Rupiah formatting, type names, RPC argument shapes, safe public cover URL construction, and server query error handling.
- [ ] Run the focused tests and verify they fail due to missing commerce modules.
- [ ] Extend generated-style database contracts without restoring any Catalog types; implement focused commerce types, money helper, and server-only query boundary.
- [ ] Run `pnpm test` and `pnpm typecheck` and require both to pass.
- [ ] Commit with `git add lib/supabase/database.types.ts lib/commerce tests/commerce-domain.test.ts && git commit -m "feat: add typed commerce resolver boundary"`.

### Task 4: Runtime Feature Flag and Public Storefront

**Files:**
- Modify: `.env.example`
- Modify: `lib/features.ts`
- Modify: `lib/content/marketing-content.ts`
- Modify: `components/marketing/marketing-shell.tsx`
- Modify: `components/marketing/site-header.tsx`
- Modify: `components/marketing/home-page.tsx`
- Modify: `app/page.tsx`
- Modify: `app/produk-digital/page.tsx`
- Create: `app/produk-digital/[slug]/page.tsx`
- Create: `components/digital-products/add-to-cart-button.tsx`
- Modify: `app/marketing.css`
- Test: `tests/digital-product-storefront.test.ts`

**Interfaces:**
- Produces: `isDigitalProductsEnabled()` server runtime check; storefront and detail routes; `AddToCartButton({ commerceItemId })`.
- Consumes: Task 3 public queries and Task 1 `add_cart_item` RPC.

- [ ] Write failing tests that require real database queries, public cover URLs, formatted prices, detail links, no placeholder runtime data, safe default-off behavior, and a server-provided header/home flag.
- [ ] Run the focused tests and confirm failure against the placeholder page.
- [ ] Implement a server-only runtime flag path, pass visibility into client navigation, render real product directory/detail states, and make Add to Cart authenticate through the normal `/auth` route before invoking the shared RPC.
- [ ] Add responsive storefront/detail styles reusing the existing marketing visual system and neutral cover fallback; do not add invented facts or product-file language.
- [ ] Run `pnpm test`, `pnpm typecheck`, and `pnpm lint`.
- [ ] Commit with `git add .env.example lib/features.ts lib/content/marketing-content.ts components/marketing components/digital-products app/page.tsx app/produk-digital app/marketing.css tests/digital-product-storefront.test.ts && git commit -m "feat: connect public digital product storefront"`.

### Task 5: Shared Cart Route and Interaction

**Files:**
- Modify: `lib/auth/routes.ts`
- Create: `app/cart/layout.tsx`
- Create: `app/cart/page.tsx`
- Create: `components/commerce/cart-view.tsx`
- Create: `components/commerce/cart-entry-link.tsx`
- Modify: `components/marketing/site-header.tsx`
- Modify: `app/globals.css`
- Test: `tests/cart-ui.test.ts`

**Interfaces:**
- Produces: protected `/cart`, `CartView`, remove/checkout interaction, shared Cart entry point.
- Consumes: Task 3 `getActiveCart`, Task 1 `remove_cart_item`, and runtime feature flag.

- [ ] Write failing tests for completed-Mentee protection, item label/kind/price, totals, no quantity controls, remove, empty state, and unavailable-item checkout blocking.
- [ ] Run the focused tests and verify the route/components are absent.
- [ ] Implement the protected server route and focused client mutation component; revalidate after mutations and preserve database errors as safe UI feedback.
- [ ] Add a compact Cart entry point to existing navigation without redesigning the site.
- [ ] Run `pnpm test`, `pnpm typecheck`, and `pnpm lint`.
- [ ] Commit with `git add lib/auth/routes.ts app/cart components/commerce components/marketing/site-header.tsx app/globals.css tests/cart-ui.test.ts && git commit -m "feat: add shared mentee cart"`.

### Task 6: Midtrans Server Module

**Files:**
- Create: `lib/payments/midtrans.ts`
- Create: `lib/payments/types.ts`
- Test: `tests/midtrans.test.ts`

**Interfaces:**
- Produces: `getMidtransConfig`, `createProviderOrderId`, `buildSnapRequest`, `createSnapTransaction`, `getTransactionStatus`, `createNotificationSignature`, `verifyNotificationSignature`, `normalizeMidtransStatus`.
- Consumes: Task 3 Order/OrderItem types; environment variables `MIDTRANS_SERVER_KEY`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`, `MIDTRANS_ENV`.

- [ ] Write unit tests with mocked `fetch` for sandbox/production URLs, Basic Auth, order IDs, payload sums, exact-string signatures, invalid signatures, amount mismatch, every required status, fraud handling, and unknown-status safety.
- [ ] Run `pnpm test -- --test-name-pattern="Midtrans"` and verify missing-module failure.
- [ ] Implement the server-only module with strict environment/response validation and no SDK dependency.
- [ ] Run `pnpm test`, `pnpm typecheck`, and `pnpm lint`.
- [ ] Commit with `git add lib/payments tests/midtrans.test.ts && git commit -m "feat: add tested Midtrans provider module"`.

### Task 7: Checkout Start, Reconciliation, and Webhook APIs

**Files:**
- Create: `lib/payments/application.ts`
- Create: `app/api/checkout/start/route.ts`
- Create: `app/api/checkout/status/route.ts`
- Create: `app/api/payments/midtrans/webhook/route.ts`
- Test: `tests/payment-routes.test.ts`

**Interfaces:**
- Produces: `startCheckoutPayment(account)`, `reconcileOwnedOrder(account, orderId)`, `handleMidtransNotification(payload)` and the three POST endpoints.
- Consumes: Task 1 order creation, Task 2 privileged attempt/status functions, Task 6 Midtrans functions, existing `createAdminClient`, verified SSR session/account.

- [ ] Write route/application tests proving wrong roles and ownership fail, browser prices are ignored, paid Orders reject starts, active tokens resume, provider requests use snapshots, invalid webhook signature/amount/unknown ID fail, and duplicate/stale notifications stay safe.
- [ ] Run focused tests and verify failure because the routes do not exist.
- [ ] Implement the authenticated start/status boundaries and sessionless webhook using one shared status-application function; return sanitized JSON and appropriate HTTP status codes.
- [ ] Confirm no browser payload can select `user_id`, price, total, or paid status and no Server Key appears in returned data/logging.
- [ ] Run `pnpm test`, `pnpm typecheck`, and `pnpm lint`.
- [ ] Commit with `git add lib/payments/application.ts app/api tests/payment-routes.test.ts && git commit -m "feat: add secure Midtrans payment endpoints"`.

### Task 8: Cart Checkout Page and Snap Embedded Component

**Files:**
- Modify: `app/checkout/layout.tsx`
- Create: `app/checkout/page.tsx`
- Modify: `app/checkout/[slug]/page.tsx`
- Create: `components/commerce/midtrans-snap-embed.tsx`
- Create: `components/commerce/checkout-view.tsx`
- Modify: `app/globals.css`
- Test: `tests/checkout-ui.test.ts`

**Interfaces:**
- Produces: one active shared `/checkout`; `MidtransSnapEmbed({ token, clientKey, environment, orderId })` loading Snap.js once and calling `snap.embed` into `midtrans-snap-container`.
- Consumes: Task 7 API routes, Task 3 immutable Order data, known mentoring-slug compatibility resolver.

- [ ] Write failing tests for protected Mentee checkout, immutable item summary/customer identity, embedded container, `snap.embed`, callback-as-reconciliation behavior, close-as-pending behavior, and absence of redirect or popup payment calls.
- [ ] Run focused tests and verify the shared checkout page/component is absent.
- [ ] Implement the server checkout page and focused client payment component with responsive supported embed dimensions, explicit status refresh, and safe retry/resume states.
- [ ] Keep `[slug]` solely for known mentoring redirects and not-found unknowns so it cannot create Orders or payments.
- [ ] Run `pnpm test`, `pnpm typecheck`, and `pnpm lint`.
- [ ] Commit with `git add app/checkout components/commerce app/globals.css tests/checkout-ui.test.ts && git commit -m "feat: embed Midtrans Snap in shared checkout"`.

### Task 9: Real Mentee Digital Product Ownership

**Files:**
- Modify: `app/dashboard/page.tsx`
- Create: `components/dashboard/mentee-dashboard.tsx`
- Create: `components/dashboard/owned-digital-products.tsx`
- Modify: `app/dashboard/layout.tsx`
- Modify: `app/globals.css`
- Test: `tests/mentee-digital-products.test.ts`

**Interfaces:**
- Produces: server-fetched `Produk Digital` dashboard section using paid Order Items; client dashboard receives `ownedDigitalProducts` and `digitalProductsEnabled` props.
- Consumes: Task 3 `listOwnedDigitalProducts`; existing demo state only for untouched mentoring/dashboard prototypes.

- [ ] Write failing tests requiring paid-only ownership, snapshot name/date/price, current cover or neutral fallback, and absence of Download/PDF/video/open-file actions and `digitalPurchases` LocalStorage reads in the touched section.
- [ ] Run focused tests and verify the current `Library` implementation fails those requirements.
- [ ] Split the existing client dashboard into a server wrapper plus preserved client workspace and replace only the Digital Product library path with real ownership props.
- [ ] Keep unrelated mentoring demo flows unchanged and link purchase discovery to `/produk-digital` only when the feature is enabled.
- [ ] Run `pnpm test`, `pnpm typecheck`, and `pnpm lint`.
- [ ] Commit with `git add app/dashboard components/dashboard app/globals.css tests/mentee-digital-products.test.ts && git commit -m "feat: show paid digital products in mentee dashboard"`.

### Task 10: Browser Coverage with Supabase and Snap Stubs

**Files:**
- Create: `tests/browser/digital-product-commerce.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `tests/browser/admin-digital-products.spec.ts`

**Interfaces:**
- Produces: deterministic browser coverage that never calls real Midtrans and can enable the server runtime feature for the test application.
- Consumes: Tasks 4, 5, 8, and 9 UI contracts.

- [ ] Add route fixtures for public Digital Product reads/public covers, authenticated Cart/Order RPCs, payment APIs, dashboard ownership, and a controlled Snap.js stub exposing `snap.embed`.
- [ ] Assert public listing/detail real content and formatted prices; Cart add/deduplicate/remove/total/empty/unavailable states; checkout summary/embed call/no redirect/no popup; and unpaid-hidden/paid-visible ownership with no file actions.
- [ ] Preserve the existing admin Digital Product browser tests while updating only assertions invalidated by the new public flag behavior.
- [ ] Run `pnpm build` with `FEATURE_DIGITAL_PRODUCTS=true`, then `pnpm test:e2e`; require the commerce spec and existing browser suite to pass without Midtrans network access.
- [ ] Commit with `git add tests/browser playwright.config.ts && git commit -m "test: cover digital product commerce journey"`.

### Task 11: Living Documentation and Deployment Configuration

**Files:**
- Modify: `memory/SPEC.md`
- Modify: `README.md`
- Modify: `docs/supabase-setup.md`
- Modify: `docs/strativate/asset-status.md`
- Modify: `.env.example`
- Test: `tests/shared-commerce-documentation.test.ts`

**Interfaces:**
- Produces: current architecture, migration order, environment contract, webhook Dashboard instructions, rollout checklist, and honest scope documentation.
- Consumes: final names/routes from Tasks 1–10.

- [ ] Write a documentation regression test requiring both new migrations, all Midtrans variables, server-key warning, sandbox/production switch, webhook URL/HTTPS, embedded mode, paid Order Item ownership, disabled-by-default rollout, and product-file non-goal.
- [ ] Run the focused test and verify it fails against the Phase 2A documentation.
- [ ] Update living docs and asset status without rewriting historical Product Catalog documents or claiming hosted deployment/live payment success.
- [ ] Run `pnpm test` and require the documentation contract to pass.
- [ ] Commit with `git add memory/SPEC.md README.md docs/supabase-setup.md docs/strativate/asset-status.md .env.example tests/shared-commerce-documentation.test.ts && git commit -m "docs: document shared commerce and Midtrans rollout"`.

### Task 12: Full Verification and Final Audit

**Files:**
- Modify only files required to correct failures found by the prescribed verification.

**Interfaces:**
- Produces: evidence for the 28-point final report.
- Consumes: all prior tasks.

- [ ] Run `pnpm test` and record pass/fail counts.
- [ ] Run `pnpm typecheck` and record the exit result.
- [ ] Run `pnpm lint` and record the exit result.
- [ ] Run `pnpm build` with the public flag off and record the exit result.
- [ ] Run `pnpm test:db -- --bootstrap` against the guarded local test database and record the exact result; do not apply migrations to hosted Supabase.
- [ ] Run `pnpm test:e2e` against the controlled build and record the exact result.
- [ ] Run repository searches proving no real credential, legacy Catalog runtime, Digital Product file delivery, `snap.pay`, generic Midtrans redirect, or touched Digital Product LocalStorage ownership remains.
- [ ] Review `git diff origin/main...HEAD`, migration ordering, working-tree status, and all commits; correct and rerun any affected checks.
- [ ] Use `superpowers:verification-before-completion`, then provide the exact base commit, branch, migrations, schema/flow/security locations, flag state, test outcomes, mocked/live Midtrans status, remote migration list, and owner configuration steps.
