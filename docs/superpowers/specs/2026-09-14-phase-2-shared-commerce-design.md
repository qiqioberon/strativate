# Phase 2 Shared Commerce Design

## Goal

Ship the first production-backed Digital Product purchase path while keeping Digital Product business data independent from a reusable Cart, Checkout, Order, and Payment layer. Midtrans Snap is embedded inside Strativate, and paid Digital Product ownership is derived from immutable paid Order Items. Product file delivery remains out of scope.

## Boundaries

- `public.digital_products` remains the source of name, slug, description, cover path, and current integer-Rupiah price.
- `public.commerce_items` stores stable cross-domain sellable identity only. Its ID equals the source Digital Product ID and its normalized kind is `digital_product`.
- Cart and payment state never become Digital-Product-specific. Digital Product duplicate-ownership prevention is implemented as a domain rule invoked by the shared Cart boundary.
- Orders snapshot the resolved item kind, name, slug, and unit price. Historical snapshots do not change when source products change or are deleted.
- No downloadable product files, delivery entitlements, mentoring commerce, quantities, discounts, tax, shipping, subscriptions, or refunds are added.
- The public feature is controlled by the server-side runtime environment variable `FEATURE_DIGITAL_PRODUCTS`. Only the exact value `true` enables it; absent or malformed values remain off. Admin management is independent from this flag.

## Database Architecture

Two forward migrations follow `202609140004_mentor_account_status_weekly_availability.sql`:

1. `202609140005_shared_commerce.sql` makes Digital Product rows and cover images publicly readable, introduces `commerce_items`, `carts`, `cart_items`, `orders`, and `order_items`, backfills the registry, installs lifecycle synchronization, RLS, immutable snapshot protection, and authenticated Mentee RPCs.
2. `202609140006_midtrans_payment_attempts.sql` introduces server-owned `payment_attempts` plus privileged functions that reserve attempts and atomically apply normalized payment states without allowing paid-order downgrades.

`commerce_items` deliberately has no generic product name, description, cover, or price columns. A resolver function dispatches on `item_kind`; the current `digital_product` adapter reads those values from `digital_products`. A future domain registers the same identity and adds one resolver branch without changing Cart, Order, or Payment tables.

One partial unique index enforces at most one active cart per user. A unique `(cart_id, commerce_item_id)` key makes Add to Cart idempotent. Cart mutation functions derive ownership from `auth.uid()`, require a completed Mentee profile, and never accept a browser-provided `user_id`.

`create_order_from_cart` locks the active cart, returns an existing order for the same cart when retried, resolves every item at current authoritative prices, rejects missing/unavailable rows, creates immutable snapshots, calculates the trusted total, and converts the cart in one transaction. Order Items reject direct update/delete operations. Authenticated users can read only their own Orders and snapshots; they cannot write either table directly.

## Application Boundaries

`lib/commerce/` owns typed resolution, Cart, Order, money formatting, and ownership queries. Server Components read public products and owned commerce data with the normal SSR Supabase client. Focused client components perform authenticated Cart RPC mutations and host Snap Embedded.

`/produk-digital` queries real Digital Product rows and uses public Storage URLs for covers. `/produk-digital/[slug]` renders the real detail and Add to Cart action. Disabled deployments redirect these routes to `/program`.

`/cart` and `/checkout` are completed-Mentee routes. `/cart` shows current resolver data, including unavailable rows that can be removed but block checkout. `/checkout` creates or reuses the Order from authenticated cart state and renders its immutable summary. The historical `/checkout/[slug]` route remains only as a compatibility redirect for known mentoring slugs; it is not a second checkout architecture.

The dashboard keeps unrelated mentoring demo state untouched, but its Digital Product section receives real server-fetched ownership records. It contains no download/open/file controls.

## Midtrans Design

`lib/payments/midtrans.ts` is server-only and owns configuration, URLs, Basic Auth, provider Order IDs, Snap payload validation, HTTP calls, exact-string SHA-512 verification, and conservative status normalization. The Server Key never crosses a server boundary. Tests mock `fetch`; CI does not contact Midtrans.

Each Order can have multiple Payment Attempts. Only one attempt in a creating/pending state can be active at a time. A unique provider Order ID is generated from the server-created attempt UUID and stays below Midtrans limits. An existing attempt with a Snap token is resumable; expired, failed, or cancelled attempts allow a new attempt.

`POST /api/checkout/start` authenticates a completed Mentee, creates/reuses their Order, reserves/reuses their active attempt, creates a Snap transaction from Order snapshots, stores the token, and returns only the public payment data. `MidtransSnapEmbed` loads the environment-specific Snap.js once and calls `window.snap.embed`, never popup or redirect mode.

`POST /api/payments/midtrans/webhook` has no browser-session requirement. It looks up the expected attempt, verifies the exact notification signature and gross amount, normalizes status, and invokes the privileged atomic state-application function. `POST /api/checkout/status` authenticates the owning Mentee, calls Midtrans Get Status server-side, and passes the response through the same verification/normalization/application boundary.

Settlement and acceptable capture states pay the Order. Deny, cancel, and expire map conservatively. Unknown or unsafe fraud states never pay. Once paid, stale pending or failure notifications cannot downgrade the Order or rewrite `paid_at`.

## Error Handling

Database functions raise stable, user-safe domain errors for authentication, wrong role, incomplete onboarding, unavailable items, existing Digital Product ownership, empty carts, and invalid cart/order state. UI components surface concise Indonesian messages and permit retry where safe. Provider configuration failures return a server error without leaking credentials. Webhooks use non-2xx responses for unknown attempts, invalid signatures, or amount mismatch so Midtrans can retry valid transient failures.

## Testing

- SQL regression tests cover public reads, admin writes, registry synchronization, cart concurrency/ownership, order transactions and snapshots, RLS, immutability, and paid ownership.
- Unit tests cover feature flags, resolver helpers, money, Midtrans URLs/auth/payload/order IDs/signatures/status mapping, and application route contracts with mocked HTTP.
- Playwright tests use controlled Supabase and Snap.js stubs to cover the public directory/detail, Cart add/deduplicate/remove/total/empty behavior, checkout summary and embedded Snap invocation, and paid-only dashboard ownership.
- Final verification runs `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:db -- --bootstrap`, and `pnpm test:e2e`. Live Midtrans verification is reported separately and is never claimed without real credentials and a real transaction.

## Deployment

The public flag remains off by default. Owners must apply migrations `202609140005` and `202609140006`, configure Supabase, set Midtrans server/client keys and environment, configure `<APP_URL>/api/payments/midtrans/webhook` as the HTTPS Payment Notification URL, verify a sandbox payment, and only then set `FEATURE_DIGITAL_PRODUCTS=true`.
