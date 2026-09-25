# Stakeholder Website Revision Design

**Date:** 2026-09-25  
**Status:** Approved for implementation  
**Scope:** Public marketing revision, Publications and Competitions CMS, Digital Product catalogue/commerce enhancements

## Outcome

Strativate will ship the stakeholder revision as a cohesive English public marketing experience while preserving the existing authenticated product and feature-flag boundaries. The homepage will use a compact orange/red visual system, a proof-led flow, no typing animation, and neutral data-ready fallbacks wherever approved partner, institution, competition, testimonial, or product assets are unavailable.

The new `/publications` and `/competitions` routes will be backed by admin-managed Supabase content rather than hardcoded records. Digital Products will gain catalogue discovery controls, guarded real paid-sales social proof, and authoritative discount codes without trusting client totals or changing the existing Midtrans payment lifecycle.

## Constraints and source decisions

- Public marketing copy covered by the revision is English; authenticated dashboards retain their existing language unless directly touched.
- Poppins and the existing approved palette remain the shared typography and color system. Marketing uses white, orange, orange-to-red gradients, and green only for WhatsApp consultation actions.
- The approved public proof copy may use `2,500+ students`, `15+ universities`, and `20+ high schools` in the context supplied by the repository source-conflict register. No partnership, award, sales, rating, or institution claims are invented.
- The eight homepage expertise cards are an editorial presentation list from the stakeholder reference, separate from the shared `competition_categories` taxonomy and mentor expertise master.
- Missing partner, mentee-institution, competition-logo, publication, competition, testimonial, and product records render empty or branded fallback states.
- Existing Digital Product feature-flag behavior, detail routes, add-to-cart flow, paid-content delivery, and payment amount source remain intact.
- Work stays on `main`, uses at most three substantive commits, and pushes directly to `origin/main` only after fresh verification.

## Public marketing architecture

The existing `MarketingShell` remains the route boundary. `marketing-content.ts` becomes the English editorial source for navigation, FAQ, expertise, Why Choose, and shared copy. The header adds Publications and Competitions to desktop and mobile navigation while retaining conditional Digital Products visibility.

The homepage server entry point continues to load hero posters, public mentors, testimonials, and published Digital Products. `HomePage` is reorganized as:

1. compact approved hero copy and consultation actions;
2. immediate success-proof/testimonial strip with an empty-safe fallback;
3. Who We Are;
4. Programs;
5. Digital Products;
6. Our Expertise;
7. Our Mentors;
8. Why Choose Strativate;
9. testimonial stories and approved winning-mentee media when present;
10. Trusted Partners with an admin/data-ready empty state.

`TextType` is removed from the homepage. Existing mentor cards and dialogs remain route-compatible but use a consistent portrait frame, intentional object fitting, and a more prominent role/headline. Programs, About, FAQ, and Digital Product public pages use the same English editorial boundary.

Digital Product discovery is a client-side presentation layer over server-loaded published records. Search uses name/description/slug, filtering uses the fields that exist (`content_type`), and sorting uses created date, name, and price. No popularity claim is introduced.

## Content domains

### Publications

`marketing_publications` stores `id`, `slug`, `title`, `excerpt`, `body`, `category`, `cover_image_path`, `destination_url`, `is_featured`, `is_published`, `sort_order`, `published_at`, `created_at`, and `updated_at`. Body content is rendered as plain text with safe line breaks; optional destination URLs are validated and rendered as external links. Public reads are limited to published rows, ordered featured-first then explicit order/date. Admin CRUD uses a modal editor with validation and optional cover upload to a dedicated `publication-covers` bucket.

### Competitions

`marketing_competitions` stores `id`, `slug`, `title`, `organizer`, `competition_category_id`, `eligibility`, `deadline`, `prize_text`, `short_description`, `detail`, `cover_image_path`, `registration_url`, `is_featured`, `is_published`, `sort_order`, `created_at`, and `updated_at`. The category reference points to the existing `competition_categories` table with `on delete set null`; no duplicate taxonomy is created. Public cards expose only stored fields and a safe external registration CTA. Admin CRUD provides search/status filters, deadline validation, optional cover upload, draft/publish, and deletion.

Both domains use UUID keys, constraints, indexes, the shared `touch_updated_at` trigger, explicit grants, RLS, admin-only writes through `public.is_admin()`, and storage path/MIME/size validation. Public routes render a clean empty state until content exists.

## Commerce architecture

The additive commerce migration introduces:

- `commerce_discount_codes` for normalized codes, active state, percentage/fixed type, value, validity window, optional redemption limit, and timestamps;
- `commerce_discount_code_products` for optional Digital Product scope;
- `commerce_discount_redemptions` with unique order/code protection and paid-order redemption accounting;
- cart-level applied discount identity;
- order-level subtotal, discount code snapshot, and discount amount snapshots;
- order-item discounted unit snapshots where needed for historical clarity.

`apply_discount_code` validates the current authenticated mentee cart against authoritative Digital Product rows, status, validity, scope, and prior application. `create_order_from_cart` locks the relevant code/cart rows, recalculates subtotal and discount from database prices, prevents negative totals, records immutable snapshots, and reserves redemption atomically. Existing payment creation already consumes `orders.total_amount`, so the authoritative discounted value flows into Midtrans without client trust.

Sales social proof is derived from paid orders/order items only. A product-level `show_sales_count` flag defaults false; when true, the public server query returns the real count for that product and never purchaser identity. Low-volume hiding is therefore an explicit admin choice rather than an invented threshold.

## Admin architecture

The existing `app/admin/page.tsx` section architecture remains the shell. `Publications` and `Competitions` are added under `Konten`; discount-code management is added beside commerce/product administration. New managers follow the Digital Product dialog/table pattern and shared admin CSS primitives, with centered responsive dialogs, internal scrolling, focusable close controls, validation feedback, and empty states.

## Testing and verification

Pure helpers are tested before implementation for publication and competition validation, Digital Product filtering/sorting, sales-count visibility, discount calculations, and code validation. Source-contract tests cover English navigation/copy, homepage order, removed typing animation, public routes, admin sections, and modal accessibility hooks. Supabase SQL tests cover RLS, published-only reads, storage restrictions, competition-category reuse, discount validity/scope/repeated application, paid sales privacy, and checkout totals. Browser tests cover the public routes, responsive navigation/catalogue, admin sections, and modal viewport behavior. Final verification runs lint, typecheck, unit tests, database tests where available, build, and targeted browser suites at 360/390/768/1024/1440 widths.
