# Product / Catalog Master Design

**Date:** 2026-09-09
**Status:** Approved architecture and authoritative bootstrap specification
**Scope:** Product and Catalog Master only

## 1. Purpose

Product / Catalog Master becomes the authoritative source for every commercial identity and current catalog price in Strativate. It replaces the commercial responsibility currently split between `lib/catalog.ts`, pricing arrays in `lib/program-information.ts`, demo product arrays in `app/admin/page.tsx`, and the product options embedded in `lib/demo-store.ts`.

The subsystem deliberately does not implement cart, checkout, payment, orders, enrollments, scheduling, negotiated offers, digital ownership, or digital-content delivery. Existing simulated checkout behavior may consume the new public catalog through a small compatibility boundary, but it must not retain its own product identity or price definitions.

## 2. Design principles

1. Every selectable commercial unit has a stable UUID and a stable product-scoped code. Labels and descriptions are mutable presentation data and are never identifiers.
2. Products, offerings, add-ons, bundles, delivery configuration, benefits, and digital content metadata remain distinct concepts.
3. Important relationships and pricing rules are relational. JSON is not used for product structure, prices, add-on applicability, or bundle composition.
4. Incomplete business data is valid only as a draft. Publication validates the complete commercial shape.
5. Archiving preserves identity and references. Catalog administration does not provide destructive deletion for published or archived commercial records.
6. PostgreSQL roles, `public.is_admin()`, RLS, privileges, constraints, and validation triggers are the security boundary. React route guards and forms are defense in depth only.
7. Public UI receives only published, deliberately public records. Public projections are convenient query interfaces, not substitutes for RLS.
8. User-facing additions remain natural Bahasa Indonesia and retain established application terminology.

## 3. Considered approaches

### 3.1 Selected: normalized commercial core with typed substructures

A shared product table and a shared commercial-item table establish consistent lifecycle, identity, pricing, and purchase-flow semantics. Typed relational tables represent offering-specific, Private Mentoring, Intensive, add-on, bundle, benefit, delivery-option, and Digital Product data.

This design gives future cart/order work one stable commercial reference while preserving subtype distinctions and database-enforced relationships.

### 3.2 Rejected: independent table families for each product type

Separate Private, Intensive, Big Class, and Digital Product roots simplify individual screens but duplicate lifecycle, pricing, authorization, and public query behavior. Future commerce would need product-type-specific identity resolution.

### 3.3 Rejected: generic product table with JSON configuration

JSON configuration would make the initial schema smaller, but important pricing matrices, applicability rules, and bundle components could not be protected by ordinary foreign keys and constraints. Future commerce would be forced to interpret mutable opaque structures.

## 4. Domain model

### 4.1 Enumerations

- `catalog_product_type`: `private_mentoring`, `intensive_mentoring`, `big_class`, `digital_product`
- `catalog_lifecycle_status`: `draft`, `published`, `archived`
- `catalog_purchase_flow`: `consultation_offer`, `direct_checkout`
- `catalog_pricing_mode`: `fixed`, `quotation_required`
- `catalog_commercial_item_kind`: `offering`, `add_on`, `bundle`
- `catalog_digital_content_type`: `pdf`, `video`
- `catalog_delivery_option_kind`: `learning_path`, `focus_topic`
- `catalog_intensive_scope`: `national_fixed`, `international_custom`

### 4.2 Products

`catalog_products` owns broad commercial identity:

- `id uuid` primary key
- `code text` globally unique, immutable after creation
- `slug text` globally unique, lowercase URL-safe value
- `product_type catalog_product_type`
- `status catalog_lifecycle_status`
- `default_purchase_flow catalog_purchase_flow`
- `title`, `short_description`, and optional `description`
- `is_public`, `is_featured`, `sort_order`
- `published_at`, `archived_at`
- `created_by`, `updated_by`, `created_at`, `updated_at`

A product can be prepared as a draft without complete subtype or commercial data. A published product must have subtype data appropriate to its type and at least one published offering. Publication does not require `is_public = true`; this permits deliberately internal but commercially valid records. A product only appears in the public catalog when both `status = 'published'` and `is_public = true`.

Purchase-flow constraints are type-aware:

- program types use `consultation_offer`;
- Digital Products normally use `direct_checkout`;
- Big Class remains structurally supported without inventing a commercial flow beyond the selected catalog value.

### 4.3 Unified commercial identities

`catalog_commercial_items` is the shared identity and pricing root for every purchasable/selectable unit:

- `id uuid` primary key
- `product_id uuid` foreign key to `catalog_products`
- `code text`, unique per product and immutable after creation
- `kind catalog_commercial_item_kind`
- `status catalog_lifecycle_status`
- `title`, optional `description`
- nullable `pricing_mode` while draft
- integer `price_amount` and optional integer `reference_price_amount`
- fixed currency `IDR`
- `is_sellable`, `sort_order`
- lifecycle and audit timestamps/users matching products

The UUID is the identity future commerce snapshots or references. The pair `(product_id, code)` is a human-operable stable key for imports and administration. A future selection is represented as `commercialItemId`, not as a display label. The `kind` discriminator tells commerce whether the identity is an offering, add-on, or bundle.

Pricing invariants:

- monetary amounts are nonnegative integers;
- a published fixed-price item requires `price_amount`;
- `reference_price_amount`, when present, must be greater than or equal to `price_amount`;
- quotation-required items have neither catalog nor reference price;
- quotation-required is never represented by zero;
- an incomplete draft may have no pricing mode and no amounts;
- published or archived identities cannot be deleted through the application.

Private Mentoring additionally records the explicitly published per-session amount on `catalog_private_offering_configs.per_session_price_amount`. This value is presentation-relevant commercial master data and is not derived from the total package price. The guidebook's three-session Top Student offering therefore retains `Rp285.000` per session and `Rp885.000` total exactly as published, even though multiplying the displayed unit amount would produce a different number.

Typed tables use the same `id` as their `catalog_commercial_items` row:

- `catalog_offerings(id, product_id)` for base packages/variants;
- `catalog_add_ons(id, product_id, is_conditional, public_condition_summary)`;
- `catalog_bundles(id, product_id, is_conditional, public_condition_summary)`.

This shared-primary-key pattern gives add-ons and bundles first-class identities without flattening their meanings into offerings.

### 4.4 Private Mentoring

`catalog_private_mentoring_details` is keyed by product and stores the established service invariants:

- session duration in minutes;
- minimum and maximum participants per purchased package.

`catalog_mentor_tiers` defines stable mentor-tier identities and ordering. `catalog_session_packages` defines stable session-package identities and a positive session count.

`catalog_private_offering_configs` links exactly one offering to exactly one mentor tier and one session package. A unique constraint on `(product_id, mentor_tier_id, session_package_id)` prevents duplicate matrix cells. Composite foreign keys and validation triggers require every row to belong to the same Private Mentoring product.

The offering—and therefore its UUID—is the purchasable tier × session-package combination. Future commerce never reconstructs it from text such as “Mentor Mahasiswa Berprestasi · 5 sesi.”

`catalog_delivery_options` stores non-commercial configuration definitions:

- learning paths;
- focus topics;
- whether an option permits a customer-provided custom value.

Product Master owns each delivery option's stable ID/code, canonical operational/display label, lifecycle/availability, ordering, and whether a custom customer value is allowed. Delivery options have their own stable IDs for future fulfillment forms, but they are not rows in `catalog_commercial_items`, have no price, and cannot be selected as SKUs.

The editorial layer may hold richer explanatory or marketing copy keyed by the Product Master delivery-option code. It must not define a second list of option identities or labels. Public pages iterate Product Master options and optionally enrich each one from editorial copy by code, so adding, retiring, or renaming an option remains a catalog operation.

### 4.5 Intensive Mentoring

`catalog_intensive_offering_configs` extends an offering with:

- scope `national_fixed` or `international_custom`;
- nullable positive `sessions_per_month`.

Published national offerings require a positive session frequency and fixed pricing. Published international-custom offerings require quotation pricing and do not pretend to have a public price.

Add-ons are first-class `catalog_commercial_items` with `kind = 'add_on'` and matching `catalog_add_ons` rows. `catalog_add_on_applicability` explicitly links an add-on to the Intensive offerings for which it may be selected. Same-product and Intensive-type constraints prevent cross-product applicability.

Conditional add-ons may carry a short approved public condition summary. The field describes that conditions exist; it does not implement legal, guarantee, refund, or eligibility behavior.

Bundles are first-class `catalog_commercial_items` with `kind = 'bundle'` and matching `catalog_bundles` rows. Their price belongs to the bundle identity and is not calculated from component prices.

Composition is explicit:

- `catalog_bundle_offerings` links a bundle to included base offerings with a positive quantity;
- `catalog_bundle_add_ons` links a bundle to included add-ons with a positive quantity;
- `catalog_bundle_benefits` links bundle-specific included benefits.

Foreign keys and triggers require bundle and component records to belong to the same Intensive product. A bundle description is presentation copy and is never the composition source of truth.

### 4.6 Benefits

`catalog_benefits` defines product-scoped non-sellable benefits with stable IDs/codes and lifecycle/order metadata.

`catalog_offering_benefits` and `catalog_bundle_benefits` attach benefits to a commercial identity. A benefit is never a `catalog_commercial_item`, has no price, and cannot be confused with an add-on. Package thresholds are represented by linking the benefit to the offerings that actually include it; future commerce does not infer thresholds from prose.

### 4.7 Digital Products

`catalog_digital_product_details` is keyed by the Digital Product and records only `content_type = 'pdf' | 'video'`.

The Digital Product receives one or more ordinary offering identities, normally a fixed-price direct-purchase offering. The schema stores no upload, bucket, path, media URL, entitlement, DRM, reader, player, or delivery-provider data.

### 4.8 Big Class

Big Class can use `catalog_products` and ordinary `catalog_offerings`. No cohort, schedule, capacity, or attendance schema is introduced. No current demo Big Class value is migrated or published.

## 5. Lifecycle and validation

Products and commercial items use draft, published, and archived states.

- Drafts are visible and editable by administrators only.
- Publication executes database validation for product type, pricing, subtype presence, and relationship integrity.
- Archived rows remain referentially stable and hidden from public reads.
- Archived rows may not return directly to published state; an administrator may duplicate them into a new draft when a materially new commercial identity is needed.
- Stable IDs, product codes, item codes, product type, item kind, and owning product are immutable once created.

Published records are the current authoritative catalog, not immutable snapshots. Administrators may change mutable attributes such as price, reference price, descriptions, visibility, featured state, and ordering while preserving the identity when the commercial meaning is unchanged. A material change to session count, tier/package meaning, bundle composition, or what an offering represents requires a new draft commercial identity followed by archival of the previous identity. Historical prices are intentionally not stored in Product Master; future order records will snapshot the selected identity and agreed price.

Lifecycle transitions use `set_catalog_product_status(product_id, status)` and `set_catalog_commercial_item_status(item_id, status)` security-definer functions. Both require `public.is_admin()`, lock the target row, validate transitions, and set publication/archive timestamps. Direct column privileges do not permit browser clients to update lifecycle fields, so bypassing the UI cannot skip validation.

Ordinary editable fields use RLS-protected table writes. Validation triggers reject wrong parent types, cross-product relationships, wrong commercial-item kinds, invalid fixed/quotation pricing, and invalid session counts.

## 6. Authorization and public projection

### 6.1 Base-table RLS

Every catalog table has RLS enabled.

- Admin policies use `public.is_admin()` for full draft/published/archive business-data reads and permitted writes.
- Public and authenticated non-admin select policies require the complete published path: the product is published and public, the commercial item is published, and each referenced definition is published where applicable.
- Anonymous and non-admin roles have no insert, update, or delete policies.
- Explicit column grants expose only operations needed by each PostgreSQL role. Browser roles can select public-safe business columns but cannot select `created_by` or `updated_by`; those actor IDs remain available to trusted database/service access.
- Service-role access follows the existing migration convention.

Public eligibility is repeated at the base-table policy level. A view, query helper, or accidentally broadened frontend select cannot bypass the product and child lifecycle checks.

### 6.2 Public views

Public query helpers use `security_invoker = true` views with explicit public-safe columns:

- `public_catalog_products`;
- `public_catalog_commercial_items`;
- public subtype/configuration views needed to assemble details.

The views repeat the published/public predicates for clarity and query planning, but execute with the caller's privileges and therefore remain subject to base-table RLS. They do not contain audit identities or administrator-only metadata. Grants are applied to the views and to only the underlying public-safe columns required for invoker execution.

Database tests call the views as `anon` and `authenticated` roles and prove that a maliciously crafted query cannot read draft, internal, or archived rows. Tests also verify that direct base-table reads cannot reveal those rows. No security-definer public-read function returns unfiltered catalog data.

## 7. Application domain interface

`lib/catalog/types.ts` defines discriminated TypeScript types aligned with the schema:

- `CatalogProductSummary`;
- `CatalogProductDetail`;
- `CatalogCommercialItem` with `kind` and pricing-mode discriminators;
- `CatalogOffering`, `CatalogAddOn`, and `CatalogBundle`;
- Private and Intensive configuration types;
- Digital Product detail types;
- delivery-option and benefit types.

Fixed-price items expose an integer `priceAmount`. Quotation items expose no numeric price. Rendering uses a centralized Indonesian Rupiah formatter.

`lib/catalog/public.ts` is the server-side read boundary. It queries only public views and assembles typed summaries/details. Consumers do not know the admin component structure or parse display strings.

`lib/catalog/admin.ts` contains shared payload validation and mutation helpers used by the admin UI. PostgreSQL remains authoritative if a browser bypasses these helpers.

## 8. Admin experience

The current “Services”, “Big Class”, and “Digital Products” demo sections are replaced by one “Katalog Produk” entry in the existing admin navigation and visual shell.

The management experience includes:

- searchable/filterable product list with lifecycle/type/public status;
- creation and editing of shared product fields;
- explicit publish and archive actions;
- product ordering and featured/public controls;
- type-specific configuration panels shown only after the product exists.

Private Mentoring panels manage details, mentor tiers, session packages, the explicit offering matrix, delivery options, and included benefits.

Intensive panels manage base offerings, fixed/quotation settings, add-ons, add-on applicability, bundles, bundle components, conditional summaries, and benefits.

Digital Product panels manage PDF/video type and fixed-price offerings. Big Class receives shared metadata and offering support only; the UI does not ask for invented cohort or schedule fields.

Forms expose structured inputs and selectors. Administrators never edit relationship JSON. Error, loading, empty, and confirmation text remains in Bahasa Indonesia.

## 9. Public integration

The public `/explore` catalog becomes a server-backed Product Master consumer. Client-side filtering and sorting operate on typed published summaries passed from the server. Quotation items sort without inventing a zero price and render “Sesuai konsultasi.”

`/program/[slug]` loads the published Product Master product by slug. It combines commercial data from Product Master with mentoring editorial copy keyed by a non-commercial editorial key. Product identity, offering identity, pricing, add-ons, bundles, and benefits never come from the editorial module.

The homepage consumes published catalog summaries for product names, public starting prices, featured/order state, and links. Existing long-form mentoring copy may remain editorial where it does not compete with catalog identity or pricing.

When no products are published, public catalog/product areas render an honest Indonesian empty or coming-soon state. Draft-only products do not appear by name, slug, count, or pricing.

Digital Product cards and pages render only real published Product Master records. No current hardcoded digital example is shown after migration. Big Class demo records likewise disappear.

## 10. Checkout compatibility boundary

Checkout/payment implementation remains unchanged in purpose and is not expanded. The compatibility work is limited to replacing its legacy catalog lookup input.

The existing simulated checkout route receives a minimal typed compatibility model derived from a published Product Master product and its selected fixed-price offering. It cannot import a hardcoded catalog array or invent a price. Mentoring routes that currently redirect to public program information retain that behavior.

Quotation-required offerings never enter the simulated payment path. If no published fixed-price offering exists, the route preserves an honest unavailable/not-found outcome. No cart behavior, order lifecycle, payment behavior, negotiated pricing, or checkout redesign is added. This isolates legacy simulation while keeping Product Master authoritative and avoids a second commercial source of truth.

## 11. Authoritative business-data bootstrap

The supplied Private Mentoring and Intensive Mentoring guidebooks are the authoritative current business master for those two programs. Their Product Master records are seeded as published and public. When a guidebook value conflicts with an older hardcoded/demo value, the guidebook wins without arithmetic correction or reinterpretation.

Authoritative source pages are Private Mentoring pp. 5–12 and Intensive Mentoring pp. 5–13. The original PDFs remain outside the application bundle; the migration contains the normalized operational data extracted from those pages.

### 11.1 Private Mentoring

The migration seeds the published `private-mentoring` product with consultation-led purchase flow, a 75-minute session duration, and equal package pricing for individuals or teams of 1–4 participants.

Mentor tiers:

- `top_student`: Mentor Mahasiswa Berprestasi;
- `young_professional`: Mentor Profesional Muda.

Session-package identities are `sessions_1`, `sessions_3`, `sessions_5`, `sessions_7`, and `sessions_10`. Each tier/package combination receives its own published offering UUID.

| Tier | Sessions | Per session | Package price | Reference price |
| --- | ---: | ---: | ---: | ---: |
| Top Student | 1 | Rp300.000 | Rp300.000 | — |
| Top Student | 3 | Rp285.000 | Rp885.000 | Rp950.000 |
| Top Student | 5 | Rp279.000 | Rp1.395.000 | Rp1.500.000 |
| Top Student | 7 | Rp270.000 | Rp1.890.000 | Rp2.100.000 |
| Top Student | 10 | Rp250.000 | Rp2.500.000 | Rp3.000.000 |
| Young Professional | 1 | Rp350.000 | Rp350.000 | — |
| Young Professional | 3 | Rp335.000 | Rp1.005.000 | Rp1.050.000 |
| Young Professional | 5 | Rp329.000 | Rp1.645.000 | Rp1.750.000 |
| Young Professional | 7 | Rp320.000 | Rp2.240.000 | Rp2.450.000 |
| Young Professional | 10 | Rp300.000 | Rp3.000.000 | Rp3.500.000 |

The `Rp885.000` Top Student three-session total is persisted exactly as printed; it is not replaced with `3 × Rp285.000`.

Delivery-option identities are seeded for End-to-End Learning, Competition-Focused Mentoring, Idea & Problem Framing, Business Analysis & Case Structuring, Proposal Writing & Storyline, Financial Analysis & Valuation, Slide Deck & Visual Design, Pitching & Presentation Skills, and a custom-topic option that permits a customer-provided value. Canonical labels are natural Indonesian; richer explanatory copy remains editorial and is keyed by these stable codes.

Included benefit identities cover Direct Mentor Networking, Judge-Level Insight, Competition Strategy Discussion, Sample Deck Exposure, 5+ Sessions Group Discussion, and Dummy Case or Mini Practice. The 5+ group-discussion benefit links only to the 5-, 7-, and 10-session offerings in both tiers. Benefits remain non-commercial.

### 11.2 Intensive Mentoring

The migration seeds the published `intensive-mentoring` product with consultation-led purchase flow.

Published base offerings:

- `intensive_national`: 4 sessions per month, fixed price Rp1.150.000, reference/normal price Rp1.400.000;
- `super_intensive_national`: 8 sessions per month, fixed price Rp2.200.000, reference/normal price Rp2.800.000;
- `international_custom`: quotation required, customized scope/frequency, and no fake zero price.

Published add-ons:

- `detailed_performance_report`: Rp150.000;
- `mock_judging_simulation`: Rp300.000;
- `win_guarantee_protection`: Rp500.000 and explicitly conditional.

The guidebook presents these add-ons as optional extensions to the main Intensive program. Applicability links are seeded to the national fixed packages. Guarantee eligibility remains a descriptive condition only; no refund or eligibility engine is introduced.

Published bundles and explicit composition:

- `team_starter_bundle`, Rp1.250.000: Intensive offering + Detailed Performance Report + Personalized Mentoring Roadmap benefit + Competition Preparation Support benefit;
- `competition_ready_bundle`, Rp2.500.000: Super Intensive offering + Detailed Performance Report + Mock Judging Simulation + Final-Stage Preparation Support benefit;
- `competition_assurance_bundle`, Rp3.000.000: Super Intensive offering + Detailed Performance Report + Mock Judging Simulation + Win Guarantee Protection.

The bundle price is persisted exactly and is not computed from its components. The Competition Assurance bundle is marked conditional consistently with its included guarantee add-on.

Intensive included benefits are seeded from the guidebook's program/package descriptions, including Dedicated Mentor, Personalized Learning Roadmap, Core Concepts and Practical Frameworks, Hands-On Assignments, Templates and Winning References, Competition Timeline, Competition Recommendation, Continuous Feedback and Refinement, Progress Monitoring, and Final Evaluation.

### 11.3 Data not bootstrapped

No Big Class or Digital Product rows are seeded. Existing names, prices, cohorts, formats, and download claims for those domains are unapproved demo material. Their public sections render honest empty/coming-soon states until an approved master is entered and published.

## 12. Retired and narrowed sources

- `lib/catalog.ts` stops owning product records and prices; its consumers move to the typed catalog query boundary.
- Commercial arrays in `lib/program-information.ts` are removed. The file retains only editorial storytelling, journey copy, and explanatory copy maps keyed by Product Master delivery-option/benefit codes; it does not retain independent learning-path, topic, benefit, offering, or price lists.
- The admin `services`, Digital Product, and Big Class management arrays are removed and replaced by persistent catalog management.
- `lib/demo-store.ts` no longer owns `programOptions`/`services` as a catalog. Other simulated order, enrollment, scheduling, and dashboard fixtures remain explicitly outside Product Master and outside this task.
- The simulated checkout compatibility input is generated from Product Master rather than a hardcoded product array.

## 13. Error handling

- Domain validation errors are raised by PostgreSQL with actionable constraint/function messages.
- Admin forms retain user input on errors and show natural Indonesian messages.
- Public query failure renders the existing application error boundary rather than falling back to demo data.
- Empty results are distinct from query failures and render an honest empty state.
- Publication functions lock rows and validate atomically, preventing partially published structures.

## 14. Testing strategy

### 14.1 Database and security

A catalog SQL test suite verifies:

- admin creation and mutation;
- lifecycle functions reject non-admin callers;
- authenticated non-admin and anonymous mutation denial;
- public views and direct reads reveal only published/public records;
- draft and archived products/items remain hidden;
- fixed and quotation pricing constraints;
- immutable stable identity fields;
- Private tier × package uniqueness and type correctness;
- delivery options remain non-commercial;
- Intensive fixed and quotation offerings;
- add-on applicability and same-product enforcement;
- explicit bundle composition and same-product enforcement;
- benefit versus add-on separation;
- PDF/video validation;
- invalid cross-type configurations and relationships.

### 14.2 Domain and application

TypeScript tests cover price formatting, public-view row assembly, discriminated pricing behavior, sorting with quotation items, and checkout compatibility mapping.

Browser tests cover:

- honest no-product and draft-only states;
- published public catalog rendering;
- quotation labels without fake prices;
- admin catalog persistence and lifecycle behavior;
- type-specific admin fields;
- Digital PDF/video rendering;
- no checkout control for quotation offerings;
- existing auth/onboarding route behavior;
- mobile public/admin layout and absence of horizontal overflow.

### 14.3 Verification commands

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:db -- --bootstrap` against the disposable configured test database
- `pnpm exec playwright test --workers 3`
- `pnpm build`

## 15. Success criteria

The implementation is complete when Product Master is the only source of product/commercial identity and current catalog pricing; all commercial units are directly referenceable by stable UUID; public reads cannot expose drafts indirectly; admins can manage each supported structure through the existing dashboard; relevant public pages consume the master; unapproved demo data is absent; checkout remains isolated and out of scope; and affected automated verification passes without weakening existing authorization assertions.
