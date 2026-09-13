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

## Hero poster data

`public.marketing_hero_posters` stores `id`, `image_path`, `alt_text`, optional
`title`, optional internal `url`, `sort_order`, `is_active`, and timestamps. Images
live in the public `marketing-hero-posters` Storage bucket under `posters/`.
Anonymous/authenticated public reads expose active rows; admins can read and mutate
all rows and Storage objects. `reorder_marketing_hero_posters(uuid[])` performs the
admin-only order update. The homepage uses a branded fallback when the table,
bucket, or active records are unavailable.

## Admin flow

`/admin/marketing` is protected by the existing account destination/role guard.
An admin can upload JPG/PNG/WebP images up to 5 MB, set accessible alternative text,
an optional title/internal link, order, and active status, replace an image, reorder
rows, or delete a poster. Browser mutations use the normal authenticated Supabase
client and remain subject to RLS; no service secret is exposed to the browser.

## Authentication and roles

Supabase Auth sessions use SSR cookies. `public.profiles.role` is authoritative.
Unauthenticated protected routes redirect to `/auth`; account destinations route
admins to `/admin`, mentors to their setup/workspace, incomplete mentees to
`/onboarding`, and completed mentees to `/dashboard`. Existing auth, onboarding,
role, invitation, and RLS behavior must remain unchanged.

## Verification boundary

The migration and SQL policy tests are versioned locally. They are not considered
deployed or verified on hosted Supabase until the target project's migration,
bucket, and policies are inspected or exercised with authorized credentials.