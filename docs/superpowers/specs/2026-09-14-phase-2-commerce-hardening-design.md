# Phase 2 Shared Commerce Hardening Design

## Goal

Harden the already-accepted Shared Commerce + Midtrans implementation without redesigning the commerce domain. Preserve the flow `Digital Product -> commerce_items -> carts -> cart_items -> orders -> order_items -> payment_attempts -> Midtrans Snap Embedded` and stop after Phase 2 hardening.

## Non-goals

Do not resurrect Product Catalog Master, add Digital-Product-specific commerce tables, implement Private Mentoring commerce, introduce content/download delivery, add discounts/coupons/shipping/subscriptions, invent publication state, or invent free-product checkout behavior.

## Checkout mutation boundary

`GET /checkout` is read-only. It accepts an existing `order` query parameter, authenticates a completed Mentee through the existing account/RLS boundary, loads only the owned Order and immutable Order Items, and renders them. A missing/invalid order parameter does not create or convert state.

The Cart uses an explicit POST/server-action checkout mutation. That action obtains the authenticated Mentee cart on the server, validates it, calls the existing idempotent `create_order_from_cart` RPC, and redirects to `/checkout?order=<id>`. Link prefetch is never the correctness boundary.

Payment-attempt creation is also explicit rather than a render side effect. The embedded checkout UI starts/resumes Snap only after an explicit user action; page render/prefetch does not create a Payment Attempt or contact Midtrans.

## Trusted payment status

One shared normalization function is used by both webhook verification and Get Status reconciliation. A paid result requires `status_code === "200"` plus either `transaction_status === "settlement"` or `transaction_status === "capture"` with accepted fraud status. Unknown, challenged, denied, malformed, or non-200 success-looking states never become paid. Existing exact signature verification, timing-safe comparison, exact raw `gross_amount`, expected-amount verification, known provider-order lookup, monotonic paid state, and browser inability to mark paid remain intact.

## Midtrans request adapter

Internal `order_items.name_snapshot` remains full and immutable. The Midtrans adapter creates a provider-safe name capped at 50 Unicode code points, trims/collapses whitespace, strips control characters, replaces vertical bars for channel compatibility, and never writes the normalized value back to the Order snapshot. Request item subtotals must equal the trusted Order total before Midtrans is contacted. Zero-value Orders fail closed pending a separate business decision.

Midtrans HTTP calls validate HTTP success, JSON object shape, required string fields, non-empty Snap token, and status response types. Calls use a bounded timeout. Browser-visible errors remain generic; provider/server secrets are never returned or logged.

## Snap expiry and concurrency

Add a forward-only migration after `202609140007_midtrans_payment_attempts.sql`. Persist Snap token creation/expiry timestamps and a short-lived atomic creation claim. The Snap request explicitly sets a 24-hour page expiry, matching Midtrans' documented regular Snap-token lifetime and making the stored expiry deterministic.

Only one request can claim Snap creation for a Payment Attempt. The database claim is atomic and short-lived; no database transaction is held open during external Midtrans HTTP. The winner calls Midtrans and stores the token only when its claim still matches. Losers reuse a valid token when it appears or retry safely; provider/network failure releases the matching claim so a later request can proceed. Expired tokens retire the attempt and a retry creates a fresh Payment Attempt/provider order ID for the same Strativate Order.

## Snap.js lifecycle

Keep official embedded Snap (`window.snap.embed`) and the environment-specific Snap.js URL. Use Next.js Script readiness semantics that fire on remount/navigation, guard against duplicate embed calls for the same token/container lifecycle, and permit a later remount or fresh token to embed again. Do not use `snap.pay`, redirect checkout, `window.location`, or custom iframe wrappers.

## Ownership and authorization

Checkout start/status routes remain authenticated, completed-Mentee-only. Order reads use the existing owner-scoped Supabase/RLS boundary before any privileged payment operation. Cross-user IDs resolve generically without leaking existence. Admin/Mentor accounts cannot enter the normal Mentee purchase path.

## Verification

Fix the brittle Digital Product storefront unit test by asserting component composition rather than child copy placement. Add executable mocked-fetch tests for the Midtrans HTTP client, status matrix, item formatting, failure handling, and request totals. Add SQL regression coverage for token expiry, retry, one-winner creation claims, monotonic paid state, and service-only payment writes. Add deterministic Playwright commerce coverage with fixture backends and stubbed `window.snap.embed`; CI never calls real Midtrans.

CI runs on pull requests to `main` and pushes to `main`, `feat/phase-2-shared-commerce`, and `fix/phase-2-commerce-hardening`, and reaches unit tests, typecheck, lint, architecture/security searches, both feature-flag builds, fresh Postgres bootstrap/SQL tests, and Playwright.

## Completion language

Automated verification does not equal real payment verification. Unless an actual Sandbox payment is completed with hosted migrations, real credentials, and webhook delivery, the final report must state: `Real Midtrans Sandbox transaction NOT tested.`
