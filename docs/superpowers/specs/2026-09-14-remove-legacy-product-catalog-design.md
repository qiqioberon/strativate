# Legacy Product Catalog Removal Design

Date: 2026-09-14  
Status: Approved design, implementation revalidated  
Original design base: `bb7a1ca10a53f970e9fcbc96269a7e4e4501d7e5`

## Revalidation

Before implementation, `main` was rechecked after teammate pushes. The Product Catalog dependency shape and cleanup decision remained unchanged. Hero Poster natural-order work and later error-page/mentor-marquee polish are unrelated and must be preserved when the cleanup is based on the latest `main`. The forward cleanup migration therefore uses `202609140002_remove_legacy_product_catalog.sql`, after `202609140001_marketing_hero_poster_natural_order.sql`.

## Goal

Remove the old generic Product Catalog Master runtime and database architecture while preserving reusable frontend presentation work for later domain-specific implementations.

The cleanup removes the old generic catalog as an active business/data model. It does not build the replacement Digital Product, Private Mentoring, shared commerce, cart, checkout, order, or payment domains.

The intended end state is:

```text
REMOVE
old Product Catalog database/domain coupling

PRESERVE
reusable frontend presentation
```

## Scope and constraints

This cleanup must:

- keep `supabase/migrations/202609090001_product_catalog_master.sql` unchanged as migration history;
- add one new forward migration that explicitly removes obsolete Product Catalog database objects;
- remove active runtime reads/writes to `catalog_*` and `public_catalog_*`;
- remove Product Catalog-specific generated TypeScript types and runtime domain helpers;
- unmount the generic admin Product Catalog screen;
- preserve reusable admin and public frontend structure, styling, cards, forms, filters, responsive behavior, and visual states where practical;
- keep public routes from crashing after catalog removal;
- use only approved static/editorial repository content for interim public pages;
- remove the legacy checkout path if it has no legitimate non-catalog consumer;
- keep operational Mentor Domain, Auth, onboarding, institutions, referral sources, interests, hero posters, hero-poster storage, and public mentor marketing content intact;
- update current source-of-truth documentation;
- leave historical Product Catalog design/plan documents intact where clearly historical;
- verify cleanup repo-wide before completion.

This cleanup must not implement:

- `digital_products`;
- a Private Mentoring domain;
- `commerce_items`;
- cart or cart items;
- checkout replacement;
- orders or order items;
- payment;
- Digital Product file delivery;
- any temporary replacement catalog abstraction.

## Current dependency shape

Product Catalog is not isolated to one backend module. Runtime dependencies include `lib/catalog/*`, generated Supabase types, generic admin catalog components/navigation, homepage/program/product public pages, legacy checkout compatibility, catalog-specific tests, and current documentation that called Product Catalog Master authoritative.

`components/catalog/catalog-browser.tsx` also contains reusable list/filter presentation code even though it is currently unmounted. Its presentation value is evaluated separately from its abandoned catalog types/helpers.

## Architecture decision

Use a **detach-and-preserve** cleanup.

Do not delete frontend code merely because its data source disappears. Instead:

1. identify presentation logic that has value independent of Product Catalog;
2. separate it from Supabase/catalog types and business rules;
3. retain it as ordinary prop-driven presentation code or leave it temporarily unmounted;
4. remove the old Product Catalog data/domain layer;
5. remove UI fragments whose meaning depends entirely on the abandoned business model and whose presentation value is negligible.

Do not create a replacement generic data contract that reproduces Product Catalog under a new name. Prop types retained solely for presentation describe UI needs, not a hidden generic commerce/domain model.

## Database cleanup

### Applied migration history

`202609090001_product_catalog_master.sql` remains untouched.

`202609140002_remove_legacy_product_catalog.sql` removes Product Catalog objects. It must not use blind `DROP ... CASCADE`.

### External dependency check

Before destructive statements, PostgreSQL/repository dependencies must be checked for references from non-catalog production domains. Known survivors include `profiles`, Mentor Domain tables/functions, Auth/onboarding, institutions, marketing hero posters, and unrelated shared helpers such as `public.touch_updated_at()` and `public.is_admin()`.

`public.mentor_tiers` is the canonical operational mentor-tier model and must remain. `public.catalog_mentor_tiers` is legacy Product Catalog state and is removable once tests/documentation stop asserting that compatibility.

### Removal order

The forward migration removes objects in explicit dependency order: public catalog views; catalog RPCs/functions with catalog signatures; triggers; policies/indexes; relationship/composition tables; typed detail/configuration/subtype tables; definition tables; core commercial/product tables; helper functions; catalog-only enum types.

Exact object names come from the historical migration and repo audit. The migration must fail clearly rather than silently remove unrelated dependencies.

Do not apply the migration to remote Supabase automatically. Completion reports the exact filename for controlled deployment.

## Admin frontend preservation

The generic `Katalog Produk` navigation entry disappears because its backend no longer exists. No fake functioning replacement screen is allowed.

`CatalogManagement` and `CatalogStructures` preserve reusable layout only after all catalog Supabase reads/writes, RPC calls, and Product Catalog-specific types/business assumptions are removed. Useful list/editor/filter/form/empty-state/responsive presentation and CSS may remain unmounted for future domains.

The cleanup avoids broad renames unless clarity materially improves. Retained components named `CatalogManagement` or `CatalogStructures` are acceptable only when they contain no removed backend dependency and do not imply live functionality.

## Public frontend preservation

### `/program`

Keep page composition, service hierarchy, cards, typography, WhatsApp CTA, responsive behavior, and marketing styling. `lib/content/services.ts` already contains approved static/editorial descriptions for the eight services and becomes independent from catalog types/query assembly.

Private and Intensive cards link directly to their established editorial routes. Do not infer availability, prices, packages, or commercial state from removed catalog data.

### `/program/[slug]`

Keep established mentoring routes and legacy-slug redirects. Use approved editorial content in `lib/program-information.ts` for hero copy, audience, highlights, journey/process, competition categories, and contact/consultation CTA.

Preserve the useful detail-page structure/CSS while removing catalog-driven pricing matrices, catalog delivery options/benefits, add-ons, bundles, direct checkout buttons, commercial-item identifiers, and Product Master ownership copy. A visual section may remain only if it can honestly represent unavailable/updating details without inventing business rules.

Unknown/unsupported product slugs must not resolve through a hidden generic catalog fallback.

### `/produk-digital`

Preserve page composition, imagery, product-card layout, typography, buttons, responsive styling, and honest placeholder behavior. Do not query Product Catalog. Use only approved repository placeholders/editorial content and not-yet-available language. Feature-flag behavior may remain independently.

### Homepage

Remove Product Catalog queries/presentation mapping while preserving Hero Posters, hero layout, mentor sections, FAQ, about/marketing content, program-card visuals, and digital-product visual slots. Program previews use approved editorial data; digital products use existing honest placeholders. Old catalog seed data is not converted into a new static commercial source of truth.

### Reusable components

Program cards, comparison/list layouts, catalog browser/filter layouts, and similar components are retained when they can accept neutral ordinary props and stay truthful. Delete only code whose useful behavior is inseparable from abandoned Product Catalog semantics.

## Legacy checkout

The old checkout route existed to adapt Product Catalog detail data into `LegacyCheckout`. Remove catalog compatibility adapters and the legacy checkout runtime where no non-catalog consumer exists. Do not implement a future shared checkout or fake purchase flow. Existing mentoring checkout URLs may redirect to information pages; unsupported checkout slugs are unavailable.

## Runtime modules and TypeScript types

Remove obsolete `lib/catalog/*` runtime modules after reference checking. Remove Product Catalog tables/views/RPC signatures/enums/exported row/admin types from `lib/supabase/database.types.ts`, without modifying valid Mentor Domain/Auth/Hero Poster/institution/onboarding/profile definitions.

## Tests

Retire catalog-only domain/SQL tests and adapters. Update Mentor Domain regression so it proves canonical `mentor_tiers` remains while legacy `catalog_mentor_tiers` is absent after cleanup. Add coverage that the forward migration removes catalog objects without harming Auth/onboarding, Mentor Domain, institutions, or Hero Posters; admin no longer mounts the catalog; public routes do not depend on removed catalog runtime; and no fake checkout remains.

## Documentation

Update current authoritative docs (`README.md`, `docs/program-information.md`, `docs/supabase-setup.md`, asset/source status, living spec). Current docs state only the needed direction: each business/product type owns its own domain model; shared commerce will later unify cart, checkout, order, and payment.

Historical files under `docs/superpowers/` may retain Product Catalog details when clearly historical. Do not rewrite history merely to make grep output empty.

## CSS preservation

Catalog/program/product styling is not removed merely because the data source is removed. Remove CSS only when the owning UI is deleted, no retained component references it, and it has no reasonable reuse value. When uncertain, keep it.

## Verification

Before completion, search at least `catalog_`, `public_catalog_`, `CatalogManagement`, `CatalogStructures`, `CatalogProduct`, `CatalogCommercial`, `@/lib/catalog`, and `lib/catalog/`. Every remaining match must be historical migration/design documentation, cleanup regression coverage, or explicitly justified presentation-only naming. There must be no active runtime query/import/type/test adapter/current source-of-truth dependency on the removed backend.

Run the relevant verification suite when the execution environment permits: typecheck, lint, build, unit/application tests, database bootstrap/SQL tests, and relevant browser tests. Environment-specific inability to execute must be reported honestly rather than presented as a pass.

## Completion report

Report the latest base used, runtime files removed, admin/public/checkout changes, database objects removed, types/tests/docs updates, verification evidence and limitations, intentionally retained history, exact forward migration filename, and presentation/CSS deliberately preserved.

## Stop condition

Stop once the old Product Catalog Master is cleanly removed and preserved frontend no longer depends on it. Do not proceed into Digital Product, Private Mentoring, shared commerce, cart, checkout, orders, payment, or delivery implementation.
