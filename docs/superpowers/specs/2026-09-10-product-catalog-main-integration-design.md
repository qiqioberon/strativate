# Product / Catalog Master Main-First Integration Design

## Objective

Integrate the completed Product / Catalog Master implementation from commit
`68e485b` onto the latest `main` at `2ab6b2c` while treating `main` as the
authoritative frontend, routing, content, and first-parent baseline. Update the
existing PR #6 branch without force-pushing, without merging the PR into
`main`, and without applying migrations to the remote Supabase project.

## Source baselines and Git topology

- The authoritative baseline is `origin/main` at `2ab6b2c`.
- The Product Master source is `68e485b`, the current head of
  `feat/indonesian-copy-polish` and PR #6.
- Integration starts on a branch created directly from `origin/main`.
- The old feature head is merged as the second parent. Conflict resolution and
  follow-up adaptation preserve `main` behavior and selectively bring Product
  Master functionality forward.
- The resulting history has `main` as first parent and `68e485b` as an
  ancestor. The result can therefore be pushed as a fast-forward update to the
  existing PR branch without force-pushing.
- The unrelated `.playwright-cli/` directory in the original checkout is not
  read, changed, staged, or committed.

## Preserved `main` behavior

The following `main` work remains authoritative:

- the redesigned homepage and marketing composition;
- `MarketingShell`, `SiteHeader`, `SiteFooter`, `PageIntro`, `ProgramCard`, and
  the marketing stylesheet;
- the typed asset registry and placeholder asset policy;
- the dedicated public routes `/program`, `/mentor`, `/produk-digital`,
  `/tentang-kami`, and `/tanya-jawab`;
- `/mentor` as the public mentor directory;
- `/mentor/dashboard` as the protected mentor workspace;
- the current auth, onboarding, admin, mentee, and mentor dashboard structures;
- all current marketing tests, responsive behavior, and public navigation.

Product Master supplies data to these surfaces. It does not replace their
layout with the older feature-branch homepage or navigation.

## Product Master functionality to carry forward

The integration preserves the completed implementation described by
`docs/superpowers/specs/2026-09-09-product-catalog-master-design.md`:

- normalized PostgreSQL tables for products, commercial items, offerings,
  add-ons, bundles, product-specific configuration, delivery options, and
  benefits;
- stable UUID identities and immutable commercial meaning rules;
- draft, published, and archived lifecycle validation;
- RLS, explicit grants, admin-only lifecycle functions, and
  `security_invoker` public views;
- authoritative Private Mentoring and Intensive Mentoring bootstrap data;
- structural support, but no production seed data, for Big Class and Digital
  Product;
- typed public catalog assembly and a test-only PostgreSQL view adapter;
- Product Master management inside the existing admin dashboard;
- checkout compatibility based on product and commercial-item UUIDs;
- database, domain, public-read, lifecycle, and authorization tests.

The migration file and its authoritative prices are retained exactly unless a
verified integration defect requires a non-commercial structural correction.
In particular, the Top Student three-session offering remains Rp285.000 per
session, Rp885.000 package price, and Rp950.000 reference price. No remote
database migration is run.

## Commercial-data ownership

Product Master is the only runtime source for product identity, product type,
slug, publication state, ordering, featured state, purchase flow, offerings,
add-ons, bundles, and prices.

`lib/program-information.ts` retains only editorial material keyed by stable
Product Master codes. It may not define parallel product lists, operational
labels, package structures, or prices.

The old `lib/catalog.ts`, admin demo service arrays, and mentee-dashboard
`programOptions` are removed. Existing simulated orders and fulfillment state
remain demo-only historical/operational fixtures, but they are not used to
construct a current catalog or a new purchase price. Dashboard discovery links
to the public Product Master catalog.

## Public application architecture

### Shared presentation boundary

Pure presentation helpers transform `CatalogProductSummary` values into the
small view models needed by marketing cards and directories. They centralize:

- Indonesian product-type labels;
- fixed-price, quotation, and coming-soon labels;
- product-type filtering;
- deterministic marketing tone and placeholder asset selection.

These helpers never invent a numeric price and are covered by unit tests.

### Homepage

`app/page.tsx` reads published Product Master summaries on the server and passes
them into the existing `HomePage` marketing component.

The existing homepage structure, copy hierarchy, assets, and responsive layout
remain intact. Published mentoring and Big Class records populate the program
cards. If no published Big Class exists, the current clearly identified Big
Class placeholder remains. Published Digital Product records populate the
digital section; when none exist, the current non-commercial placeholder cards
remain.

### Program directory

`/program` remains a `MarketingShell` page. It reads Product Master summaries,
shows published non-digital programs using the existing marketing cards, and
uses the honest Big Class placeholder only when no published Big Class record
exists. Product names, descriptions, links, ordering, featured state, and prices
come from Product Master.

### Explore catalog

`/explore` remains the all-product searchable/filterable catalog and uses the
typed Product Master boundary. It is wrapped in the current marketing shell so
public navigation and footer remain consistent. Empty and draft-only catalogs
render an honest empty state. Quotation offerings display “Sesuai konsultasi”
and are never sorted as zero-priced products.

### Digital Product directory

`/produk-digital` keeps the new marketing layout and asset slots. Published
Digital Product summaries replace placeholder content when present. A product
card links to its Product Master detail. If none are published, the existing
explicitly pending placeholder presentation remains and contains no commercial
claim.

### Product detail

`/program/[slug]` reads a published Product Master detail and renders inside
`MarketingShell`.

- Private Mentoring uses Product Master tiers, session packages, prices,
  delivery options, and benefits plus code-keyed editorial copy.
- Intensive Mentoring uses Product Master base offerings, quotation state,
  add-ons, bundles, explicit bundle composition, conditions, and benefits plus
  code-keyed editorial copy.
- Big Class uses a neutral Product Master detail layout containing only fields
  and published offerings that exist in the master.
- Digital Product uses a neutral Product Master detail layout, its PDF/video
  type, and published offerings. A direct-checkout action is rendered only for
  a fixed, sellable offering on a product whose purchase flow is
  `direct_checkout`.
- Quotation-only or consultation-led products do not expose a payment action.

Legacy mentoring slugs continue to redirect to canonical public program pages.

## Admin and checkout integration

The existing admin visual shell gains one “Katalog Produk” entry. It replaces
the fake Services, Big Class, and Digital Products editors with persistent
Product Master management. The editor retains lifecycle controls and
type-specific structures while relying on database validation and RLS as the
authority.

The legacy simulated checkout is retained only as a compatibility consumer. It
receives a Product Master product UUID, offering UUID, and fixed price.
Mentoring/consultation routes redirect to public information. Unknown,
quotation, non-sellable, add-on, and bundle selections do not enter checkout.

## Error and empty-state behavior

- Public query failures propagate to the existing application error boundary;
  they do not fall back to demo commercial data.
- Missing or unpublished slugs resolve to the normal not-found behavior.
- An empty catalog is different from a failed query and renders honest
  Indonesian empty-state copy.
- Admin mutation errors preserve the existing form state and display a readable
  error.
- Missing Big Class or Digital Product masters use explicit placeholders rather
  than invented production records.

## Test-first integration strategy

Before adapting production UI code, tests are added or updated to fail against
the main-first merge result for:

- summary-to-marketing presentation mapping and price labels;
- homepage and `/program` consumption of Product Master while preserving
  `MarketingShell`;
- honest Big Class and Digital Product empty states;
- type-specific detail and direct-checkout eligibility;
- `/mentor` public access and `/mentor/dashboard` protection;
- removal of conflicting hardcoded catalog sources.

Existing Product Master unit and SQL tests are carried over without weakening
their assertions. Existing marketing and public-route browser tests are kept and
updated only where Product Master legitimately changes displayed commercial
content or selectors.

## Verification and delivery

The completed integration must pass:

```bash
pnpm test
pnpm test:db -- --bootstrap
pnpm typecheck
pnpm lint
pnpm build
pnpm exec playwright test --workers 3
```

Any additional tests present on `main` are included through the repository test
commands. Database verification uses only a disposable local database named
`strativate_test_*`. The remote Supabase project is never modified.

After verification, the integration branch is pushed to
`feat/indonesian-copy-polish`, updating PR #6. The GitHub PR state is checked to
confirm that its base remains `main`, its head contains the verified commit, and
it is no longer conflicting. PR #6 is left open and unmerged.

## Success criteria

The integration is complete when Product Master is the sole current commercial
source, all database and admin capabilities remain intact, every affected public
surface follows the latest marketing architecture, `/mentor` routing remains
correct, no unapproved Big Class or Digital Product data is published, the full
verification suite passes, and PR #6 is updated without force-pushing or remote
database changes.
