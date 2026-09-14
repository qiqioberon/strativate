# Digital Products Commerce, Library, and Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Digital Product storefront-to-library flow with shared cart/order state, protected PDF/video access, admin protected-media management, and Strativate-consistent feedback/UI.

**Architecture:** Extend the existing Digital Product and Shared Commerce tables instead of creating parallel ownership/payment systems. Paid ownership remains `orders.status = 'paid' + order_items`; private content is authorized by a database RPC, then a server-only API issues short-lived Storage access and a personalized watermark session. UI work reuses existing marketing, cart, dashboard, and admin patterns with one lightweight toast provider and one homepage carousel component.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, Supabase Auth/Postgres/Storage/RLS, Midtrans shared commerce, Tailwind/global CSS + CSS Modules, Node test runner, Playwright, PostgreSQL regression tests, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-14-digital-products-commerce-library-protection-design.md`

## Global Constraints

- Use only branch `feat/digital-products-commerce-library-protection`; base remains latest inspected `main` SHA `631d21337e2f5d186d6e4cf9214b78117bff1530`.
- Preserve existing Shared Commerce and Midtrans architecture; do not create another cart, auth, or payment system.
- Do not add permanent public paid-content URLs or persist signed URLs/tokens.
- Do not claim web code can fully block OS screenshots/screen recordings.
- Existing product/business data must not be replaced with invented demo production facts.
- Use pnpm and the repository’s current scripts/dependencies; avoid a PDF dependency by using the protected internal browser viewer contract.
- Every production behavior change starts with a failing test; use the PR workflow as the executable test environment when local dependency installation is unavailable.

---

### Task 1: Lock down the protected-content data model

**Files:**
- Create: `supabase/migrations/202609140009_digital_product_content_delivery.sql`
- Modify: `lib/supabase/database.types.ts`
- Modify: `supabase/tests/digital_products.sql`
- Test: `tests/digital-product-protection.test.ts`

**Interfaces:**
- Produces `DigitalProductContentType = 'pdf' | 'video'` and the extended `DigitalProduct` row.
- Produces RPC `create_digital_product_access_session(p_product_id uuid)` returning session/product/content/order metadata.
- Produces private bucket `digital-product-content` and table `digital_product_access_sessions`.

- [ ] **Step 1: Write failing SQL/source-contract tests** asserting the migration contains private-bucket creation, draft/published policy, access-session table, paid-order ownership check, admin preview allowance, and no persistent signed URL column.
- [ ] **Step 2: Run `pnpm test` through the PR workflow and confirm the new contract test fails because migration/types are absent.**
- [ ] **Step 3: Add the forward-only migration** with nullable content metadata for existing rows, `is_published` preserving existing exposed rows while new rows default draft, private Storage policies, minimal access-session logging, and the authorization RPC.
- [ ] **Step 4: Update handwritten Supabase TypeScript types** to match the migration and RPC return contract.
- [ ] **Step 5: Extend `supabase/tests/digital_products.sql`** to exercise anon published reads, unpublished hiding, admin CRUD, private content bucket expectations, non-owner rejection, paid-owner authorization, and access-session creation.
- [ ] **Step 6: Re-run unit + DB workflow checks and keep the migration forward-only/non-destructive.**

### Task 2: Add protected-media validation and admin payload helpers

**Files:**
- Modify: `lib/digital-products/config.ts`
- Modify: `lib/digital-products/admin.ts`
- Modify: `tests/digital-product-admin.test.ts`

**Interfaces:**
- Produces `DIGITAL_PRODUCT_CONTENT_BUCKET`, MIME/size constants, `validateDigitalProductContentFile`, `buildDigitalProductContentPath`, and payload fields `content_type`, `content_path`, metadata, `is_published`.

- [ ] **Step 1: Add failing unit cases** for PDF MIME/extension acceptance, video MP4/WebM acceptance, cross-type rejection, maximum file size, safe path generation, preserving stored content on edit, and refusing publish without protected content.
- [ ] **Step 2: Run `pnpm test` and confirm failures are caused by missing helper behavior.**
- [ ] **Step 3: Implement the minimal helpers/config** with safe filenames and explicit per-type validation.
- [ ] **Step 4: Extend draft/payload types** without weakening existing cover validation.
- [ ] **Step 5: Re-run unit tests and refactor only after green.**

### Task 3: Extend admin Digital Product management for PDF/video

**Files:**
- Modify: `components/admin/digital-product-management.tsx`
- Modify: `components/admin/digital-product-management.module.css`
- Modify: `components/admin/digital-product-dialog.module.css` only if responsive dialog layout needs it
- Modify: `tests/digital-product-admin-ui.test.ts`
- Modify: `tests/browser/admin-digital-products.spec.ts`

**Interfaces:**
- Consumes Task 2 validation/path helpers and Task 1 DB fields.
- Produces admin UI that uploads private content to `digital-product-content`, keeps cover storage separate, and displays type/publication/protected-media state.

- [ ] **Step 1: Add failing UI-contract tests** for `Jenis Produk`, PDF/Video conditional file inputs, publish control, type/status/media columns, and removal of copy claiming storefront/files are unavailable.
- [ ] **Step 2: Add/extend Playwright coverage** for creating/editing a PDF and a Video with stubbed Supabase Storage/database behavior.
- [ ] **Step 3: Verify red in CI.**
- [ ] **Step 4: Extend draft/editor state** for type, publication, selected protected file, stored media metadata, and previews/labels.
- [ ] **Step 5: Upload protected content only to the private bucket** after client validation; write only the storage path/metadata to the row; reconcile failures using the existing cover pattern.
- [ ] **Step 6: Make form fields conditional by type and block publish until content exists.**
- [ ] **Step 7: Extend the admin table** with PDF/Video badge, published/draft badge, protected-media readiness, and existing actions.
- [ ] **Step 8: Re-run unit/browser checks and verify modal/table remain responsive.**

### Task 4: Introduce global toast feedback and explicit duplicate-cart errors

**Files:**
- Create: `components/ui/toast-provider.tsx`
- Modify: `app/layout.tsx`
- Modify: `components/digital-products/add-to-cart-button.tsx`
- Modify: `components/commerce/cart-view.tsx`
- Modify: `supabase/migrations/202609140009_digital_product_content_delivery.sql`
- Modify: `tests/digital-product-storefront-auth-ux.test.ts`
- Modify: `tests/cart-ui.test.ts`

**Interfaces:**
- Produces `useToast().show({ variant, message })` and a global top-center live-region host.
- Changes `add_cart_item` duplicate-in-active-cart behavior from silent update to safe domain error while retaining already-owned rejection.

- [ ] **Step 1: Add failing tests** proving Add-to-Cart no longer owns inline `message/added/Lihat keranjang` state, uses the toast hook, maps duplicate-cart vs already-owned feedback, and cart removal errors also toast.
- [ ] **Step 2: Verify red.**
- [ ] **Step 3: Implement the dependency-free toast provider** with success/error/info variants, auto-dismiss, viewport-safe width, accessible status semantics, and visible close control.
- [ ] **Step 4: Mount it once in `app/layout.tsx`.**
- [ ] **Step 5: Update the database add-to-cart RPC** to reject duplicate active-cart Digital Product rows explicitly before insert.
- [ ] **Step 6: Replace inline temporary Add-to-Cart/cart-removal feedback with toasts** and retain refresh after successful mutation.
- [ ] **Step 7: Re-run unit/DB checks.**

### Task 5: Build the homepage Digital Product carousel and polish storefront cards

**Files:**
- Create: `components/marketing/digital-product-carousel.tsx`
- Modify: `components/marketing/home-page.tsx`
- Modify: `app/marketing.css` and/or current marketing stylesheet containing `marketing-product-*`
- Modify: `app/digital-product-ux.css`
- Modify: `tests/digital-product-storefront.test.ts`
- Modify: `tests/digital-product-storefront-auth-ux.test.ts`

**Interfaces:**
- Consumes `PublicDigitalProduct[]`; displays cover/name/price only, never protected source media.
- Produces accessible previous/next, dot pagination, autoplay/pause/reduced-motion behavior.

- [ ] **Step 1: Add failing source/UI tests** for carousel component composition, buttons/dots, autoplay interval, hover/focus pause, reduced-motion handling, and cover aspect/object-fit contracts.
- [ ] **Step 2: Verify red.**
- [ ] **Step 3: Implement the client carousel** with a stable 6–8 second autoplay, looping navigation, interaction pause, and keyboard-operable controls.
- [ ] **Step 4: Replace the homepage static two-card stack** with the carousel while retaining the existing CTA and real product data.
- [ ] **Step 5: Keep public listing `Lihat detail` as a visually clear outline secondary action** and ensure card description/price/actions align at consistent heights without distorted images.
- [ ] **Step 6: Re-run tests/build and visually inspect desktop/mobile screenshots from Playwright if the workflow captures them.**

### Task 6: Add real dashboard cart and order/payment history

**Files:**
- Modify: `lib/commerce/server.ts`
- Modify: `lib/commerce/types.ts`
- Modify: `app/dashboard/page.tsx`
- Modify: `app/dashboard/dashboard-client.tsx`
- Modify: `components/commerce/cart-view.tsx`
- Modify: dashboard/shared CSS as required
- Modify: `tests/dashboard-digital-products.test.ts`
- Modify: `tests/digital-product-storefront-auth-ux.test.ts`

**Interfaces:**
- Produces `listUserOrders()` returning owner-scoped `OrderWithItems[]` and passes the existing `ActiveCart` to dashboard.
- Dashboard sidebar adds `Keranjang`; order section receives real Digital Product orders and reuses `/checkout?order=<id>` for pending payment.

- [ ] **Step 1: Add failing tests** for sidebar Cart, same `ActiveCart` data shape, empty state CTA, remove/checkout availability, real pending/paid/failed/expired/cancelled order rendering, and `Lanjutkan pembayaran` to existing checkout.
- [ ] **Step 2: Verify red.**
- [ ] **Step 3: Add owner-scoped order-list server query** using existing RLS and immutable order items.
- [ ] **Step 4: Load cart/orders/library together in the dashboard server component.**
- [ ] **Step 5: Add Dashboard `Keranjang` section** reusing `CartView` in embedded styling instead of copying mutation logic.
- [ ] **Step 6: Merge real Digital Product commerce orders into `Pesanan & pembayaran`** without pretending existing mentoring demo orders are production Digital Product purchases.
- [ ] **Step 7: Re-run unit/build/browser checks.**

### Task 7: Add paid library links and protected PDF/video reader

**Files:**
- Create: `app/api/digital-products/[id]/access/route.ts`
- Create: `app/dashboard/produk-digital/[id]/page.tsx`
- Create: `components/digital-products/protected-content-viewer.tsx`
- Create: `app/protected-digital-product.css` or colocated CSS module
- Modify: `app/dashboard/dashboard-client.tsx`
- Modify: `lib/commerce/server.ts`
- Modify: `lib/commerce/types.ts`
- Modify: `tests/digital-product-protection.test.ts`
- Modify: `tests/dashboard-digital-products.test.ts`

**Interfaces:**
- API returns `{ url, expiresAt, contentType, mimeType, watermark, sessionId }` only after RPC authorization.
- Protected viewer consumes that response and renders PDF or Video internally.

- [ ] **Step 1: Add failing tests** proving access route authenticates through existing server client, calls the entitlement RPC before admin Storage signing, uses the private bucket, uses a short expiry, and returns no permanent path.
- [ ] **Step 2: Add failing viewer tests** for no download CTA, PDF toolbar suppression, video `controlsList`, PiP disable, context-menu/print-save shortcut best-effort handling, and dynamic watermark overlay.
- [ ] **Step 3: Verify red.**
- [ ] **Step 4: Implement the server access route** with generic unauthorized/not-found errors and no leaked backend exception detail.
- [ ] **Step 5: Implement the protected viewer** that requests a fresh access session, shows loading/error state, overlays a periodically repositioned masked-email/order watermark, and blanks protected media while the document is hidden if doing so does not break playback state.
- [ ] **Step 6: Create the protected dashboard route** and server-side ownership precheck; do not rely on hidden UI.
- [ ] **Step 7: Add `Buka materi` / `Tonton video` to paid library cards** and display PDF/Video type.
- [ ] **Step 8: Re-run unit/DB/build checks.**

### Task 8: Update docs, workflow coverage, and browser verification

**Files:**
- Modify: `docs/strativate/asset-status.md`
- Modify: `.github/workflows/phase2-shared-commerce-verify.yml` if path/branch coverage needs extension
- Modify: relevant Playwright fixtures/specs

**Interfaces:**
- Documentation states protected delivery is implemented and clearly records browser capture limitations.

- [ ] **Step 1: Update durable asset/status documentation** from “delivery not implemented” to the actual private-content model, without claiming stakeholder content files exist when they do not.
- [ ] **Step 2: Ensure PR CI exercises unit, typecheck, lint, both feature-flag builds, DB bootstrap/tests, and Playwright.**
- [ ] **Step 3: Add deterministic browser coverage** for homepage carousel, storefront toast, dashboard cart/orders/library, and protected viewer using fixtures rather than real Midtrans/network.
- [ ] **Step 4: Run full PR workflow and inspect every failed step/log. Fix failures using systematic debugging, not guesswork.**
- [ ] **Step 5: Review `main...branch` diff for secrets, unrelated files, unsafe public URLs, and duplicate architecture.**
- [ ] **Step 6: Verify exactly one branch and exactly one PR target `main`; update final PR description with commands actually run and explicit `Real Midtrans Sandbox transaction NOT tested.` unless that transaction truly occurred.**