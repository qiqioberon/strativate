# Digital Products Commerce, Library, and Protection Design

## Goal

Extend the existing Strativate Digital Product + shared-commerce domain into a complete paid-content experience: polished storefront and homepage previews, shared cart/order visibility in the Mentee dashboard, paid-only PDF/video consumption, and admin-managed protected assets. Preserve the current `digital_products -> commerce_items -> carts -> orders -> order_items -> payment_attempts` architecture rather than introducing a second commerce or ownership system.

## Source-of-truth and scope rules

- `public.digital_products` remains the Digital Product business-data source.
- Paid ownership continues to be derived from immutable `order_items` belonging to `orders.status = 'paid'`; no duplicate entitlement table is introduced.
- Existing Midtrans checkout/payment-state transitions remain authoritative. The browser cannot mark an order paid.
- Existing public cover images remain marketing assets. Paid PDF/video source objects use a separate private bucket.
- Existing approved product rows are preserved. A publication flag controls future draft/published state without resurrecting retired Product Catalog data.
- The task does not claim that browser screenshot or OS-level screen recording can be prevented. Protection is layered authorization, short-lived content access, UI friction, and personalized watermarking.

## Data model and storage

Add a forward migration after the current Phase 2 hardening migration. Extend `digital_products` with:

- `content_type`: `pdf | video` when protected content is configured;
- `content_path`: private object path, never a public URL;
- `content_mime_type`, `content_file_name`, `content_size_bytes`;
- optional `page_count` / `duration_seconds` metadata;
- `is_published`, preserving currently exposed rows as published while defaulting new rows to draft.

Publication requires a protected asset and content type. Public RLS reads only published rows while admins keep full CRUD access.

Create private bucket `digital-product-content` with admin-only Storage object CRUD policies. The browser never receives an unrestricted/public Storage URL for paid content. Admin uploads are validated in the application and constrained again by Storage MIME/size policy.

Add `digital_product_access_sessions` for minimal forensic traceability: user, product, paid order/order-item (nullable for admin preview), session id, created time, and expiry. It stores no signed URL or token.

Add a security-definer RPC `create_digital_product_access_session(product_id)` that:

1. requires an authenticated user;
2. permits admin preview or verifies a paid Digital Product `order_item` owned by `auth.uid()`;
3. rejects unpublished/missing protected content for non-admin access;
4. inserts a short-lived access-session row;
5. returns only protected-asset metadata plus order/session identifiers required for the server access route.

## Protected content delivery

A server-only API route authenticates through the existing SSR Supabase client, calls the authorization RPC, then uses the service-role Storage client only after authorization succeeds. The route returns a short-lived signed URL (about two minutes) and a personalized watermark label. Signed URLs are generated on demand and are never persisted.

For video, short-lived Storage URLs preserve byte-range streaming. The internal player uses `controlsList="nodownload noremoteplayback"`, disables picture-in-picture where supported, suppresses the context menu, and overlays a periodically repositioned personalized watermark.

For PDF, the internal viewer uses the authorized short-lived source inside Strativate with the browser PDF toolbar suppressed when supported (`#toolbar=0`) and no application-level download/print controls. While the protected reader is active, common save/print shortcuts and context menu are best-effort blocked. A dynamic personalized overlay remains above the document. These are usability deterrents, not the security boundary.

## Storefront and feedback

Create a lightweight global toast provider rather than adding a new dependency. Toasts render top-center, are accessible through live regions, and support success/error/info variants. Add-to-cart and cart mutation feedback use the global toast; temporary inline cart status/link copy is removed.

Make duplicate Digital Product add-to-cart attempts an explicit server/domain error rather than a silent idempotent update. Already-owned protection remains server-side. The UI maps the two cases to distinct user-safe toasts.

The homepage Digital Product preview becomes an accessible client carousel using real published Digital Product cover data already provided to `HomePage`. It supports previous/next controls, dots, a reasonable autoplay interval, pause on hover/focus, reduced-motion handling, and aspect-ratio-safe media.

Public product cards retain the existing outline `Lihat detail` action and get consistent card/media/button layout.

## Mentee dashboard

The dashboard server page loads the same active cart used by `/cart`, real order history, and paid Digital Product library records. The client sidebar adds `Keranjang` without creating a second cart. The cart panel reuses shared cart presentation/mutation behavior.

`Pesanan & pembayaran` shows real Digital Product orders alongside the existing unrelated mentoring demo area, clearly distinguishing pending, paid, failed, expired, and cancelled states. Pending orders link to `/checkout?order=<id>` so the existing payment flow resumes; no fake payment action is introduced.

`Produk Digital Saya` shows only paid ownership and adds type plus `Buka materi` / `Tonton video` actions that route to the protected internal reader/player. Empty states lead back to `/produk-digital`.

## Admin management

Extend the current table/dialog rather than replacing it. The form adds `Jenis Produk` (PDF/Video), conditional protected-content file selection, stored-file metadata, and publish state. Cover handling remains unchanged.

Admin content validation is split from cover validation so PDF accepts only `application/pdf`, while video accepts the supported MP4/WebM MIME types and bounded sizes. Storage object names are sanitized and placed under `products/<product-id-or-random>/...`-style namespace paths. Existing draft rows may remain without protected content; publishing is blocked until required fields exist.

Admin table adds Type, Publication, and Protected Media badges. Delete/replacement cleans private content only after the authoritative database mutation succeeds, following the existing cover reconciliation pattern.

## Accessibility, responsive behavior, and performance

- carousel controls are semantic buttons with labels, dots expose selected state, autoplay pauses on interaction and respects reduced motion;
- toast status is not color-only;
- protected viewer controls remain keyboard reachable; DRM friction does not trap keyboard focus;
- product media uses stable aspect ratios/object-fit and landing previews load only covers/posters, never full paid assets;
- dashboard/admin layouts keep existing responsive patterns and avoid horizontal page overflow.

## Verification

Use TDD against the repository’s Node test harness and SQL regression suite. Cover:

- carousel composition/autoplay accessibility contracts;
- global toast usage and removal of inline Add-to-Cart state;
- duplicate cart server enforcement;
- admin content-type/file validation and payload behavior;
- migration RLS/private-bucket/access-session behavior;
- owner/non-owner/admin authorization;
- dashboard shared cart, real order states, pending payment resume, paid library reader links;
- PDF/video protected-viewer contracts;
- both Digital Product feature-flag builds.

Final automated verification follows the existing Phase 2 workflow: `pnpm test`, `pnpm typecheck`, `pnpm lint`, builds with Digital Products off/on, DB bootstrap/SQL tests, and Playwright. Live Midtrans payment verification is not claimed unless real sandbox credentials and webhook delivery are actually exercised.