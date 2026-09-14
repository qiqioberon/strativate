# Program and product information

## Current ownership direction

The former generic Product Catalog Master is no longer Strativate's runtime architecture. Migration `202609090001_product_catalog_master.sql` is retained only as applied migration history, and `202609140002_remove_legacy_product_catalog.sql` removes its database objects forward-only.

The current long-term ownership rule is deliberately simple:

- each business/product type owns its own domain model;
- Digital Product is now the first standalone product domain;
- shared commerce will later unify cart, checkout, order, and payment.

There must not be a second temporary generic catalog abstraction between the retired Product Catalog and the domain-owned implementations.

## Public program information during the transition

`/program` continues to use the approved eight-service overview in `lib/content/services.ts`. Private Mentoring and Intensive Mentoring have dedicated information pages backed by editorial content in `lib/program-information.ts`.

Those pages intentionally preserve the existing marketing composition—breadcrumb, hero, audience, journey, category list, comparison, contact CTA, typography, responsive layout, and styling—without treating retired Product Catalog records as current commercial truth.

Package prices, per-session prices, commercial offerings, add-ons, bundles, benefits, delivery options, purchase flows, and other retired Product Catalog business structures are not copied into a new static master. Until their future domain-specific implementations exist, the UI shows an honest unavailable/update state and directs users to the approved contact path.

Legacy mentoring slugs remain compatibility redirects to the canonical Private/Intensive information routes. Legacy checkout URLs for those mentoring slugs redirect to the public information pages; there is no replacement checkout in this phase.

## Digital Product domain

Digital Product now owns a dedicated runtime model created by `202609140003_digital_product_domain.sql`:

- `public.digital_products` is the source of truth for `name`, `slug`, `description`, `image_path`, and integer-Rupiah `price_amount`;
- `digital-product-images` is a private Supabase Storage bucket containing only cover/marketing images under the `products/` namespace;
- direct table and cover management is admin-only through `public.is_admin()` RLS and Storage policies;
- the admin UI supports list/search/create/edit/delete plus safe cover upload, replacement, and deletion cleanup;
- `components/admin/catalog-management.tsx` remains presentation-only and is reused by `components/admin/digital-product-management.tsx`.

This domain deliberately does **not** contain the actual downloadable/viewable Digital Product file, content delivery, entitlement, ownership, cart, checkout, order, payment, or purchase state.

`featureFlags.digitalProducts` remains `false`. The public `/produk-digital` storefront is not connected to `public.digital_products`, and Digital Product records/covers are not exposed publicly in this phase. Public product presentation stays in its existing disabled/placeholder behavior until a later phase explicitly wires the storefront.

## Admin/frontend preservation

The old generic `Katalog Produk` admin backend remains retired. Reusable frontend work is retained where practical:

- `components/admin/catalog-management.tsx` is presentation-only and now supplies the Digital Product list/search/editor shell;
- `components/admin/catalog-structures.tsx` is presentation-only historical reusable UI;
- `components/catalog/catalog-browser.tsx` is presentation-only;
- catalog/program/product CSS remains unless independently proven obsolete.

Retained presentation components must compile without Product Catalog tables, views, RPCs, generated types, or `lib/catalog/*`. Digital Product business logic belongs only to its domain-specific controller/helpers and `public.digital_products` schema.

## Historical commercial sources

The Private Mentoring and Intensive Mentoring guidebooks and migration history remain useful provenance, including unresolved pricing/naming conflicts documented in `docs/strativate/source-conflicts.md`. They are not copied into current runtime commercial data.

Historical design/plan documents under `docs/superpowers/` may describe the Product Catalog architecture that existed at the time. Treat those documents as history, not current source of truth.

## Verification boundary

Phase 2A is structurally complete only when runtime searches show no active dependency on the removed Product Catalog backend, the fresh migration chain succeeds through Product Catalog creation → removal → Digital Product creation, Digital Product SQL/application/browser tests pass, and the public Digital Product feature flag remains disabled.

Hosted Supabase is not considered updated until the target environment has deliberately applied all pending migrations through `supabase/migrations/202609140003_digital_product_domain.sql`. The repository must not apply destructive or schema-changing migrations to hosted Supabase automatically.
