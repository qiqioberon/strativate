# Phase 2 Shared Commerce Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make existing Phase 2 Shared Commerce deterministic, mutation-safe, provider-safe, concurrency-safe, and fully regression-tested before Midtrans Sandbox validation.

**Architecture:** Preserve the current shared-commerce schema and owner-scoped Supabase reads. Move Order creation behind an explicit server mutation, centralize trusted Midtrans status mapping, add a provider adapter and forward-only Payment Attempt hardening migration, and exercise the flow with unit/SQL/browser tests. Privileged payment mutations remain service-boundary-only.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript 5.7, Supabase SSR/PostgreSQL/RLS, Midtrans Snap/HTTP APIs, Node test runner via tsx, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-14-phase-2-commerce-hardening-design.md`

## Global Constraints

- Preserve `Digital Product -> commerce_items -> carts -> cart_items -> orders -> order_items -> payment_attempts -> Midtrans Snap Embedded`.
- Do not modify historical migrations `202609140006_shared_commerce.sql` or `202609140007_midtrans_payment_attempts.sql`.
- Do not add Product Catalog Master, Private Mentoring commerce, Digital Product downloads/content delivery, discounts, coupons, shipping, subscriptions, publication workflow, or zero-price payment behavior.
- `GET /checkout` and render/prefetch paths must not create Orders, convert Carts, create Payment Attempts, or contact Midtrans.
- Browser input never controls user ID, trusted amount, price, product name, provider gross amount, or paid state.
- Real Midtrans network calls are forbidden in CI.

---

### Task 1: Checkout mutation boundary

**Files:**
- Create: `app/cart/actions.ts`
- Modify: `components/commerce/cart-view.tsx`
- Modify: `app/checkout/page.tsx`
- Modify: `tests/checkout-ui.test.ts`
- Test: `tests/checkout-ui.test.ts`

**Interfaces:**
- Produces: `checkoutActiveCart(): Promise<never>` server action.
- Consumes: `getActiveCart()`, `createOrderFromCart(cartId)`, `redirect()`.

- [ ] Write failing tests asserting Checkout page source cannot call `createOrderFromCart`/`getActiveCart`, Cart composes an explicit form/server action, and `/checkout` without an Order is redirected/read-only.
- [ ] Run `pnpm test` and confirm the new assertions fail for the current render mutation.
- [ ] Add `app/cart/actions.ts` with `'use server'`, feature/account/role validation, trusted active-cart lookup, `cart.canCheckout` validation, idempotent Order creation, and redirect to the encoded Order ID.
- [ ] Replace the Cart `Link href="/checkout"` with a form/button bound to the server action; keep unavailable carts disabled.
- [ ] Make `app/checkout/page.tsx` only load an existing requested Order; a missing `order` redirects to `/cart`; remove Order creation imports.
- [ ] Run `pnpm test` and confirm checkout regression tests pass.

### Task 2: Trusted Midtrans status + provider adapter

**Files:**
- Modify: `lib/payments/midtrans-model.ts`
- Modify: `lib/payments/midtrans.ts`
- Modify: `tests/midtrans.test.ts`
- Test: `tests/midtrans.test.ts`

**Interfaces:**
- Produces: `normalizeMidtransStatus(statusCode, transactionStatus, fraudStatus)`, `toMidtransItemName(name)`.
- Consumes: exact provider strings parsed from webhook/Get Status.

- [ ] Write failing status-matrix tests for `200+settlement`, `200+capture+accept`, non-200 settlement, challenge/deny capture, unknown states, and terminal non-paid states.
- [ ] Write failing provider-name tests for 50 code points, >50 truncation, Unicode integrity, control characters, vertical bars, and empty-normalized fallback.
- [ ] Change normalization to require trusted success status code before `paid`; keep one shared mapper used by webhook and Get Status parsing.
- [ ] Add deterministic provider name normalization and apply it only while building `item_details`; preserve input snapshots.
- [ ] Reject zero gross amount and verify item subtotal equality before provider contact.
- [ ] Run `pnpm test`.

### Task 3: Execute Midtrans HTTP client tests and harden failures

**Files:**
- Modify: `lib/payments/midtrans.ts`
- Create or modify: `tests/midtrans-http.test.ts`

**Interfaces:**
- Consumes: global `fetch`, Midtrans environment variables.
- Produces: validated Snap token and validated `MidtransStatus` only.

- [ ] Add mocked-fetch tests that actually call `createMidtransSnapTransaction` and `getMidtransTransactionStatus` for sandbox/production URLs, Basic Auth, payload fields, safe item names, successful response, 4xx, 5xx, malformed JSON, missing/blank token, network rejection, timeout-compatible abort behavior, valid status, and malformed status.
- [ ] Run the new test file and confirm failures expose current gaps rather than regex/source placement.
- [ ] Add a bounded request timeout, strict non-empty string validation, safe error wrapping, and no-secret returned errors.
- [ ] Re-run the focused tests and full `pnpm test`.

### Task 4: Forward Payment Attempt hardening migration

**Files:**
- Create: `supabase/migrations/202609140008_phase2_payment_hardening.sql`
- Modify: `lib/supabase/database.types.ts`
- Modify: `supabase/tests/payment_attempts.sql`
- Modify: `scripts/test-database.ts` only if explicit test registration is required.
- Modify: `tests/payment-attempt-migration.test.ts`

**Interfaces:**
- Adds columns: `snap_token_created_at`, `snap_token_expires_at`, `snap_creation_claim_token`, `snap_creation_claimed_at`, `snap_creation_claim_expires_at`.
- Produces/updates RPCs: `reserve_midtrans_payment_attempt`, `claim_midtrans_snap_creation`, `store_midtrans_snap_token`, `release_midtrans_snap_creation`.

- [ ] Write static migration assertions first for a new forward migration and unchanged historical migration references.
- [ ] Extend SQL regression tests for expired token retirement/new retry provider ID, stale claim recovery, exactly one winner among competing claim tokens, matching-claim token storage, matching-claim release, and service-only execution.
- [ ] Run `pnpm test` and `pnpm test:db -- --bootstrap` in CI once the test-first commit is pushed; confirm expected red state.
- [ ] Add the forward migration. Reservation retires expired pending tokens, clears stale creation claims, and creates a new attempt only when no active usable attempt exists. Claim acquisition is atomic and uses a short TTL. Store requires the matching claim and sets 24-hour token timestamps; release only clears the matching claim.
- [ ] Update TypeScript database types/RPC signatures.
- [ ] Re-run unit/static and SQL tests.

### Task 5: Concurrency-safe application orchestration

**Files:**
- Modify: `lib/payments/application.ts`
- Modify: `lib/payments/types.ts` if sanitized payment metadata requires a validity flag (never expose claim tokens).
- Create or modify: `tests/payment-application.test.ts`

**Interfaces:**
- Consumes: reserve/claim/store/release RPCs and Midtrans HTTP client.
- Produces: one provider session per claimed attempt and reusable valid token.

- [ ] Add tests around extracted pure orchestration helpers where practical: valid token reuse, expired token refusal, one-winner claim semantics, provider failure releasing claim, and item-total fail-closed behavior.
- [ ] Generate an application-side UUID claim token, reserve the attempt, reuse only unexpired tokens, atomically claim before external HTTP, and never expose claim fields to browser output.
- [ ] If another request owns creation, poll/re-read briefly for a completed token and fail safely if it remains in progress; do not call Midtrans as the loser.
- [ ] On Midtrans failure, release only the matching claim and rethrow a generic application error; do not strand `creating` forever.
- [ ] Store token with the matching claim. Same Strativate Order remains; retries create fresh Payment Attempts/provider IDs only after terminal/expired attempts.
- [ ] Run full unit tests.

### Task 6: Snap embed lifecycle and explicit payment start

**Files:**
- Modify: `components/commerce/midtrans-embed.tsx`
- Modify: `tests/checkout-ui.test.ts`
- Test: browser commerce spec from Task 8.

**Interfaces:**
- Consumes: `/api/checkout/start`, `/api/checkout/status`, `window.snap.embed`.
- Produces: explicit user-started/resumed embedded payment UI.

- [ ] Add failing source/behavior assertions that initial render does not automatically POST checkout start, `Script` uses remount-safe readiness semantics, and embedded Snap remains the only provider UI call.
- [ ] Change Script handling from one-shot `onLoad` to `onReady`; initialize readiness on remount without loading duplicate scripts.
- [ ] Gate `/api/checkout/start` behind a user button rather than mount effect. Preserve explicit status verification and retry controls.
- [ ] Guard one embed per token/container lifecycle; clear the guard only when terminal/retry/remount state requires a fresh embed.
- [ ] Run unit tests.

### Task 7: Fix brittle unit test and CI coverage

**Files:**
- Modify: `tests/digital-product-storefront.test.ts`
- Modify: `.github/workflows/phase2-shared-commerce-verify.yml`

**Interfaces:**
- CI triggers on PR `main` and pushes to `main`, `feat/phase-2-shared-commerce`, `fix/phase-2-commerce-hardening`.

- [ ] Fix the storefront test so the detail page asserts composition of `AddToCartButton`, while the button label/assertions stay in the child component test source.
- [ ] Expand security grep checks for required searches and keep no real Midtrans calls.
- [ ] Configure workflow triggers and ensure all stages run: install, unit, typecheck, lint, security/architecture checks, both flag builds, Postgres bootstrap/SQL, Playwright.
- [ ] Ensure the browser stage uses Digital Products enabled for commerce coverage while still separately verifying disabled behavior.

### Task 8: Deterministic commerce browser coverage

**Files:**
- Create: `tests/browser/commerce.spec.ts`
- Create fixture support under `tests/fixtures/commerce/` as required.
- Modify: `playwright.config.ts` only for deterministic fixture servers/environment.
- Modify: CI browser setup from Task 7 as required.

**Interfaces:**
- Fixture boundary emulates Supabase/API responses and Snap.js; it never calls real Midtrans.

- [ ] Build deterministic fixtures for public Digital Product rows/covers, completed Mentee/anonymous/non-Mentee roles, Cart/Order ownership state, checkout APIs, and Snap embed.
- [ ] Cover public directory/detail/price/cover/add-to-cart; repeated add without duplicate; anonymous auth path; Mentor/Admin no purchase flow.
- [ ] Cover Cart current price/total/remove/unavailable blocking.
- [ ] Prove merely loading/prefetching `/checkout` creates zero Orders; explicit checkout action creates exactly one and repeated action resolves the same Order.
- [ ] Stub `window.snap.embed`, assert container ID and absence of `snap.pay`/redirect, and verify callbacks invoke backend reconciliation.
- [ ] Exercise payment matrix: pending, trusted settlement paid, trusted capture accept paid, non-200 settlement not paid, challenge not paid, stale pending after paid, duplicate paid webhook semantics.
- [ ] Cover pending ownership absent, paid ownership exactly once, deleted-product historical ownership fallback, and absence of download/open/watch/library actions.
- [ ] Run `pnpm test:e2e`.

### Task 9: Final verification and report

**Files:**
- No production changes unless a failing verification identifies a root cause.

- [ ] Search every occurrence of `window.snap.pay`, `redirect_url`, `MIDTRANS_SERVER_KEY`, `SUPABASE_SECRET_KEY`, `createOrderFromCart`, `create_order_from_cart`, `snap_token`, `featureFlags.digitalProducts`, `catalog_products`, `catalog_commercial_items`, `public_catalog_`, and `digitalPurchases`.
- [ ] Run/verify `pnpm test`.
- [ ] Run/verify `pnpm typecheck`.
- [ ] Run/verify `pnpm lint`.
- [ ] Run/verify `FEATURE_DIGITAL_PRODUCTS=false pnpm build`.
- [ ] Run/verify `FEATURE_DIGITAL_PRODUCTS=true pnpm build`.
- [ ] Run/verify `pnpm test:db -- --bootstrap`.
- [ ] Run/verify `pnpm test:e2e`.
- [ ] Verify the hardening branch diff only contains intended Phase 2 hardening changes and the workflow reached all stages.
- [ ] Report real Sandbox status separately; absent a real transaction state exactly `Real Midtrans Sandbox transaction NOT tested.`
