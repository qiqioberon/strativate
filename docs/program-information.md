# Program and product information

## Current ownership direction

The former generic Product Catalog Master is no longer Strativate's runtime architecture. Migration `202609090001_product_catalog_master.sql` is retained only as applied migration history, and `202609140002_remove_legacy_product_catalog.sql` removes its database objects forward-only.

The current long-term ownership rule is deliberately simple:

- each business/product type owns its own domain model;
- shared commerce will later unify cart, checkout, order, and payment;
- this cleanup does not implement those later domains.

There must not be a second temporary generic catalog abstraction between the retired Product Catalog and those future domains.

## Public program information during the transition

`/program` continues to use the approved eight-service overview in `lib/content/services.ts`. Private Mentoring and Intensive Mentoring have dedicated information pages backed by editorial content in `lib/program-information.ts`.

Those pages intentionally preserve the existing marketing composition—breadcrumb, hero, audience, journey, category list, comparison, contact CTA, typography, responsive layout, and styling—without treating retired Product Catalog records as current commercial truth.

Package prices, per-session prices, commercial offerings, add-ons, bundles, benefits, delivery options, purchase flows, and other Product Catalog business structures are not copied into a new static master. While the domain-specific implementations are absent, the UI shows an honest unavailable/update state and directs users to the approved contact path.

Legacy mentoring slugs remain compatibility redirects to the canonical Private/Intensive information routes. Legacy checkout URLs for those mentoring slugs redirect to the public information pages; there is no replacement checkout in this cleanup.

## Digital Product presentation

Digital Product is not implemented as a new domain here. When its reversible feature flag is enabled, `/produk-digital` and the homepage preserve the existing product-card/image/layout foundation while using only the repository's explicit placeholder records. They do not invent product names, prices, files, entitlements, or delivery rules.

## Admin/frontend preservation

The old generic `Katalog Produk` admin entry is unmounted because its backend no longer exists. Reusable frontend work is retained where practical:

- `components/admin/catalog-management.tsx` is presentation-only;
- `components/admin/catalog-structures.tsx` is presentation-only;
- `components/catalog/catalog-browser.tsx` is presentation-only;
- catalog/program/product CSS remains unless independently proven obsolete.

Retained components must compile without Product Catalog tables, views, RPCs, generated types, or `lib/catalog/*`.

## Historical commercial sources

The Private Mentoring and Intensive Mentoring guidebooks and migration history remain useful provenance, including unresolved pricing/naming conflicts documented in `docs/strativate/source-conflicts.md`. They are not copied into current runtime commercial data by this cleanup.

Historical design/plan documents under `docs/superpowers/` may describe the Product Catalog architecture that existed at the time. Treat those documents as history, not current source of truth.

## Verification boundary

The cleanup is considered structurally complete only when runtime searches show no active dependency on the removed Product Catalog backend and the forward migration/test suite proves the catalog objects are absent while Mentor Domain, Auth/onboarding, institutions, and Hero Posters survive.

The destructive forward migration is not considered deployed to hosted Supabase until `supabase/migrations/202609140002_remove_legacy_product_catalog.sql` has been deliberately applied and verified on the target project.
