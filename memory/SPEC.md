# Strativate Living Specification

## Product surface

Strativate is a Next.js App Router application backed by Supabase Auth, PostgreSQL,
RLS, RPC functions, and Storage. Public marketing routes are `/`, `/program`,
`/program/[slug]`, `/mentor`, `/tentang-kami`, and `/tanya-jawab`. `/explore` and
`/produk-digital` permanently redirect to `/program` while the reversible
`featureFlags.digitalProducts` flag is `false`.

Public mentoring display names are **Private Mentoring** and **Intensive Mentoring**.
Marketing pages share the responsive header/footer, reveal motion, and contextual
WhatsApp consultation CTA. The mentor directory supports search, tier filters,
equal-height cards, and a native dialog profile view. The Q&A directory supports
search and category filters.

## Product/domain ownership

The former generic Product Catalog Master is migration history and is not the current runtime architecture. Its original migration remains versioned because deployments may already have applied it; `202609140002_remove_legacy_product_catalog.sql` removes the obsolete catalog schema forward-only.

Each business/product type owns its own domain model. Shared commerce will later unify cart, checkout, order, and payment. This cleanup does not implement those future domains and must not introduce a temporary generic catalog replacement.

Until domain-specific business data exists, public program/product pages use approved editorial content or explicit unavailable/placeholder states. Retired Product Catalog prices, packages, add-ons, bundles, and entitlements are not static runtime truth.

The old generic `Katalog Produk` admin entry is unmounted. Reusable catalog-named presentation components may remain only when they compile without Product Catalog tables/views/RPCs/types and perform no legacy database IO.

## Hero poster data

`public.marketing_hero_posters` stores `id`, `image_path`, `alt_text`, optional
`title`, optional internal `url`, `sort_order`, `is_active`, and timestamps. Images
live in the public `marketing-hero-posters` Storage bucket under `posters/`.
Anonymous/authenticated public reads expose active rows; admins can read and mutate
all rows and Storage objects. `reorder_marketing_hero_posters(uuid[])` performs the
admin-only order update. The homepage uses a branded fallback when the table,
bucket, or active records are unavailable.

## Admin flow

The admin dashboard is protected by the existing account destination/role guard.
Hero Poster management supports upload, accessible alternative text, optional title/internal link, ordering, active status, replacement, reorder, and deletion. Browser mutations use the normal authenticated Supabase client and remain subject to RLS; no service secret is exposed to the browser.

## Authentication and roles

Supabase Auth sessions use SSR cookies. `public.profiles.role` is authoritative.
Unauthenticated protected routes redirect to `/auth`; account destinations route
admins to `/admin`, mentors to their setup/workspace, incomplete mentees to
`/onboarding`, and completed mentees to `/dashboard`. Existing auth, onboarding,
role, invitation, and RLS behavior must remain unchanged.

`public.mentor_tiers` is the canonical operational mentor-tier master. The retired
`catalog_mentor_tiers` table is not a Mentor Domain dependency.

## Verification boundary

The migration and SQL policy tests are versioned locally. They are not considered
deployed or verified on hosted Supabase until the target project's migration,
bucket, and policies are inspected or exercised with authorized credentials.

The Product Catalog cleanup must prove the legacy catalog relations/functions/types
are absent while Auth/onboarding, institutions, Mentor Domain, and Hero Posters remain intact.
