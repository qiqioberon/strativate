# Mentoring Catalog Management Design

**Date:** 2026-09-16  
**Branch:** `feat/mentoring-catalog-management`  
**Status:** Approved design, pending implementation plan

## 1. Goal

Replace the current inline-edit Private Mentoring catalog administration with a clear CRUD-oriented admin experience, promote Competition Categories into a shared product master, and add a real database-backed Intensive Mentoring catalog that can be managed by admins and rendered on the public Strativate company-profile/program experience.

The feature covers:

- Private Mentoring Learning Path CRUD;
- Private Mentoring Session Topic CRUD;
- Private Mentoring package/pricing management UI cleanup;
- shared Competition Category CRUD in its own admin product tab;
- Intensive Mentoring packages, add-ons, bundles, bundle composition, and public catalog rendering;
- responsive public rendering for both Private and Intensive Mentoring;
- admin table sorting, filtering where useful, and pagination using existing shared admin components;
- tests and visual verification across admin and public pages.

The implementation must use one feature branch created from the latest `main`. The user requires at most three commits for the whole feature and prefers a single large implementation commit. This design document is the first commit required by the project design workflow; implementation should therefore target one additional bulk commit unless a separate corrective commit is genuinely necessary.

## 2. Source of truth and content ownership

### 2.1 Business sources

The business data is based on the uploaded 2026 Indonesian guidebooks:

- `Private Mentoring Guidebook (Indo).pdf`
- `Intensive Program Guidebook (Indonesia).pdf`

The repository remains the technical source of truth for existing runtime boundaries, database relationships, UI patterns, and current production behavior.

### 2.2 Ownership boundary

Keep the existing separation between editorial marketing copy and operational/catalog data.

**Source-code owned editorial content** continues to include:

- program hero title and supporting copy;
- audience copy;
- program highlights that are primarily marketing/editorial;
- learning journey / explanatory narrative;
- CTA copy and contact language;
- homepage and `/program` directory composition.

**Database-owned catalog/master content** includes:

- Private Mentoring learning paths;
- Private Mentoring session topics;
- Private Mentoring package pricing and package state;
- shared competition categories;
- Intensive Mentoring package catalog;
- Intensive Mentoring package features;
- Intensive Mentoring add-ons and add-on features;
- Intensive Mentoring bundles and bundle composition;
- sorting/order and active/inactive state for catalog records.

Do not recreate the retired generic product-catalog architecture. Private and Intensive Mentoring stay explicit domain models.

## 3. Existing architecture to preserve

The current application already has:

- `private_mentoring_learning_paths`;
- `private_mentoring_session_focuses`;
- `private_mentoring_packages`;
- shared `competition_categories`;
- a public Private Mentoring catalog loader;
- static `ProgramEditorial` content for Private and Intensive Mentoring;
- admin shared `SortableTableHeader` and `TablePagination` components;
- established admin table, toolbar, badge, responsive-scroll, and modal/dialog patterns;
- Private Mentoring Shared Commerce and enrollment/session history.

The new work must integrate with those boundaries rather than replace them.

## 4. Data model

### 4.1 Shared Competition Categories

Continue using `public.competition_categories` as the single shared taxonomy for Private and Intensive Mentoring.

No second category table or Private/Intensive-specific duplicate should be introduced.

The initial guidebook-backed category set remains:

1. Business Plan Competition
2. Business Case Competition
3. Scientific Paper Competition
4. Marketing Competition
5. Accounting and Finance Competition
6. Pitching Competition
7. Business Essay Competition
8. Equity Research Competition
9. Economic & Policy Case Competition

Active categories are shown on both public mentoring detail pages. Admin can create, edit, reorder, activate/deactivate, and delete when unreferenced.

### 4.2 Existing Private Mentoring masters

Keep the existing tables:

- `private_mentoring_learning_paths`
- `private_mentoring_session_focuses`
- `private_mentoring_packages`

Learning paths and session topics remain real catalog masters and continue to be consumed by the public Private Mentoring page and Private enrollment/session flows.

#### Stable identifiers

`code` and `slug` are generated on create and remain stable after normal name edits. The admin form should not force a non-technical user to maintain identifiers manually.

Creation rules:

- slug: lowercase ASCII-safe kebab form of the name;
- code: uppercase underscore form of the name;
- duplicate identifiers return an actionable validation error instead of silently overwriting another record.

#### Delete semantics

For Learning Paths and Session Topics:

- hard delete is allowed only when no operational row references the record;
- if a foreign-key reference exists, the admin is told that historical data depends on the record and is offered/expected to set it inactive instead;
- inactive records remain visible to admins but are excluded from public selectors/catalog output according to existing public policies.

Competition Categories use the same safe deletion principle.

#### Private package management

Private package rows remain keyed by mentor tier and session count, because those fields are part of the established product definition and current commerce mapping.

The primary requirement is management, not redesign of the commercial model. Admin can edit:

- total package price;
- reference/original price;
- duration;
- maximum participants;
- sort order;
- active state.

Mentor tier and session count remain immutable in the edit modal to avoid changing the semantic identity of an existing package already referenced by commerce/history. New package creation or hard deletion is not added in this feature unless the existing runtime already provides a safe identity-preserving path; activation/deactivation covers lifecycle needs.

### 4.3 Intensive Mentoring packages

Create `public.intensive_mentoring_packages` with domain-specific fields:

- `id uuid primary key`;
- `code text unique`;
- `slug text unique`;
- `name text`;
- `description text`;
- `competition_scope text` constrained to `national` or `international`;
- `sessions_per_month integer null`;
- `pricing_mode text` constrained to `fixed` or `consultation`;
- `price_amount bigint null`;
- `reference_price_amount bigint null`;
- `sort_order integer`;
- `is_active boolean`;
- timestamps with the standard `touch_updated_at` trigger.

Validation:

- fixed pricing requires `price_amount > 0`;
- consultation pricing requires `price_amount is null` and `reference_price_amount is null`;
- reference price, when present, must be greater than or equal to the active price;
- national package rows may have a positive sessions-per-month value;
- international/custom rows may leave sessions-per-month null.

Initial rows from the guidebook:

- **Intensive** — 4 sessions/month — Rp1,150,000 — reference Rp1,400,000;
- **Super Intensive** — 8 sessions/month — Rp2,200,000 — reference Rp2,800,000;
- **International Competition** — consultation/custom pricing, no fabricated price.

### 4.4 Intensive package features

Create `public.intensive_mentoring_package_features`:

- `id uuid primary key`;
- `package_id uuid not null references intensive_mentoring_packages(id) on delete cascade`;
- `text text`;
- `sort_order integer`;
- `is_active boolean`;
- timestamps.

This stores package-specific bullet points from the guidebook so that package cards can remain database-backed without turning all program editorial content into CMS data.

Examples include weekly progress, regular review, faster review cycles, competition-specific preparation, and custom international support language.

### 4.5 Intensive add-ons

Create `public.intensive_mentoring_add_ons`:

- `id uuid primary key`;
- `code text unique`;
- `slug text unique`;
- `name text`;
- `description text`;
- `price_amount bigint not null`;
- `terms_note text null`;
- `sort_order integer`;
- `is_active boolean`;
- timestamps.

Initial guidebook-backed rows:

- **Detailed Performance Report** — +Rp150,000;
- **Judging Simulation** — +Rp300,000;
- **Win Guarantee Protection** — +Rp500,000.

The Win Guarantee record stores its eligibility/terms note instead of hiding the qualification requirement in static UI.

### 4.6 Intensive add-on features

Create `public.intensive_mentoring_add_on_features` with the same child-feature shape as package features:

- `id`;
- `add_on_id` with cascade delete;
- `text`;
- `sort_order`;
- `is_active`;
- timestamps.

Admin edits these as a repeatable ordered list inside the add-on modal.

### 4.7 Intensive bundles

Create `public.intensive_mentoring_bundles`:

- `id uuid primary key`;
- `code text unique`;
- `slug text unique`;
- `name text`;
- `description text`;
- `price_amount bigint not null`;
- `badge_text text null`;
- `sort_order integer`;
- `is_active boolean`;
- timestamps.

Initial guidebook-backed rows:

- **Skill Builder Bundle** — Rp1,250,000;
- **Competition Ready Bundle** — Rp2,500,000;
- **Competition Assurance Bundle** — Rp3,000,000.

Badges such as “Mulai di sini”, “Kuota terbatas”, or “Paling direkomendasikan” are database fields so admins can manage them without a deploy.

### 4.8 Intensive bundle items

Create `public.intensive_mentoring_bundle_items` to model ordered bundle composition without creating fake products for text-only benefits.

Fields:

- `id uuid primary key`;
- `bundle_id uuid not null references intensive_mentoring_bundles(id) on delete cascade`;
- `item_type text` constrained to `package`, `add_on`, or `feature`;
- `package_id uuid null references intensive_mentoring_packages(id)`;
- `add_on_id uuid null references intensive_mentoring_add_ons(id)`;
- `feature_text text null`;
- `sort_order integer`;
- `is_active boolean`;
- timestamps.

A check constraint guarantees exactly one payload matches `item_type`:

- package item -> package id only;
- add-on item -> add-on id only;
- feature item -> feature text only.

This is required because guidebook bundles mix commercial entities with benefits such as personal roadmap, competition preparation guidance, and final-stage support.

A bundle item referencing an inactive package/add-on is not rendered publicly. Admin surfaces the relationship clearly so the manager can repair the bundle rather than silently exposing inconsistent content.

## 5. Security and RLS

All new Intensive Mentoring catalog tables use RLS.

Public behavior:

- anon/authenticated users may select active public catalog rows;
- inactive records are not public;
- child feature/item rows are public only when active and their parent is active.

Admin behavior:

- authenticated admin users can read active and inactive records;
- only admins can insert, update, or delete catalog rows;
- existing `public.is_admin()` conventions are reused.

Do not add client-side-only authorization as a substitute for database policy.

## 6. Admin navigation

Update the Admin `Produk` group to:

1. Private Mentoring
2. Intensive Mentoring
3. Competition Categories
4. Produk Digital

Competition Categories are removed from the Private Mentoring management page.

## 7. Shared admin interaction model

Use existing admin components and visual language instead of inventing another data-management system.

Reusable behavior:

- `SortableTableHeader` for columns where ordering is meaningful;
- `TablePagination` for all catalog tables;
- existing table scroll wrapper for narrower viewports;
- shared toolbar/search/filter patterns where useful;
- badges for active/inactive/pricing mode states;
- native `<dialog>`-based modal management consistent with current Mentor Management;
- clear loading, empty, error, and success states.

Tables are for scanning/comparing records. Editing happens in a modal rather than permanent inline inputs.

## 8. Private Mentoring admin UI

The page has three internal tabs:

- Learning Paths
- Session Topics
- Paket & Harga

### 8.1 Learning Paths table

Columns:

- Name;
- Description summary;
- Sort order;
- Status;
- Action.

Actions:

- Add Learning Path;
- Manage/Edit;
- Delete when safe;
- Activate/Deactivate.

Create/Edit modal contains:

- name;
- description;
- sort order;
- active state.

### 8.2 Session Topics table

Same interaction model as Learning Paths.

### 8.3 Private package table

Columns:

- Mentor Tier;
- Sessions;
- Price;
- Reference Price;
- Duration;
- Maximum Participants;
- Status;
- Action.

Edit modal contains mutable commercial fields only. Tier and session count are displayed as read-only identity information.

## 9. Intensive Mentoring admin UI

The page has three internal tabs:

- Paket Utama
- Add-On
- Bundles

### 9.1 Package table

Columns:

- Program;
- Sessions/month;
- Price;
- Reference Price;
- Pricing Mode;
- Status;
- Action.

Create/Edit modal manages identity/display data, pricing mode, prices, session count, status, order, description, and ordered package features.

For consultation mode, fixed-price fields are disabled/cleared and UI copy explains that public users will see a consultation CTA rather than `Rp0`.

### 9.2 Add-on table

Columns:

- Name;
- Additional Price;
- Feature count;
- Status;
- Action.

Modal manages description, price, terms note, ordered feature list, status, and order.

### 9.3 Bundle table

Columns:

- Bundle;
- Price;
- Badge;
- Item count;
- Status;
- Action.

Modal manages name, description, price, badge, status/order, and ordered bundle items. Package/add-on items use selectors; text-only benefits use a text field.

## 10. Competition Categories admin UI

A dedicated product-master page manages the shared category table.

Columns:

- Category;
- Sort order;
- Status;
- Action.

Capabilities:

- search;
- sorting;
- pagination;
- create;
- edit;
- activate/deactivate;
- safe delete.

The UI copy explicitly states that these categories are shared by Private and Intensive Mentoring.

## 11. Public catalog loaders

### 11.1 Private

Retain and extend `getPublicPrivateMentoringCatalog()` only as needed for stable sorting/error handling. It continues to return:

- active learning paths;
- active session focuses;
- active competition categories;
- active package rows.

### 11.2 Intensive

Add an explicit Intensive Mentoring public catalog boundary, e.g. `lib/intensive-mentoring/server.ts` plus typed views.

It returns:

- active packages with active ordered package features;
- active add-ons with active ordered add-on features;
- active bundles with valid active ordered bundle items resolved to display data;
- active shared competition categories.

No generic catalog abstraction is introduced.

## 12. Public program pages

### 12.1 Homepage and `/program`

Keep homepage and program-directory composition editorial/high-level.

Do not dump package/add-on/bundle tables into the homepage. These pages remain discovery surfaces that direct users to dedicated program detail pages. This also avoids unnecessary catalog reads on the homepage and preserves the existing company-profile hierarchy.

### 12.2 `/program/private-mentoring`

Continue combining source-backed editorial with DB-backed catalog.

Public sections include:

- hero/editorial summary;
- audience;
- Learning Paths from DB;
- Session Topics from DB;
- journey from source editorial;
- package/pricing section from DB;
- shared Competition Categories from DB;
- existing comparison/contact areas.

Private pricing keeps a comparison-oriented desktop layout but must remain readable on mobile without forcing an unusable wide table.

### 12.3 `/program/intensive-mentoring`

Replace the current “commercial information unavailable” state with real DB-backed sections while preserving the existing editorial hero, audience, highlights, and journey.

Public sections after editorial content:

1. Packages & Pricing
2. Optional Add-Ons
3. Best-Value Bundles
4. Shared Competition Categories
5. existing comparison/contact areas

Package presentation:

- fixed national packages show current price and optional struck-through reference price;
- consultation-only international package shows consultation language and CTA, never `Rp0`;
- package feature bullets come from DB.

Add-on presentation:

- shows additional price;
- description and features;
- terms note when present.

Bundle presentation:

- price;
- optional badge;
- resolved ordered composition;
- inactive or broken referenced items are not rendered as if valid.

### 12.4 Responsive behavior

- Intensive pricing cards stack on mobile;
- add-ons and bundles stack cleanly;
- Private package comparison remains readable at narrow widths;
- long admin-managed descriptions do not overflow cards;
- optional badges do not leave layout holes;
- CTA placement remains clear;
- no fake zero prices are rendered.

## 13. Failure behavior

### Admin

- query/mutation failures display explicit error feedback;
- UI must never claim a successful save/delete if Supabase returned an error;
- destructive actions require confirmation;
- FK-protected delete errors are translated into a useful “deactivate instead” message;
- save/delete refreshes the affected table and preserves valid pagination state.

### Public

A catalog loading problem must not make the entire editorial program page unusable.

If Private or Intensive catalog data cannot be loaded:

- editorial hero/audience/journey remain available;
- the affected commercial/catalog area shows a concise fallback;
- WhatsApp/contact CTA remains available;
- no fabricated price or stale hardcoded commercial value is substituted.

## 14. Out of scope

This feature does **not** add:

- Intensive Mentoring checkout;
- Intensive Mentoring Shared Commerce items;
- Intensive Mentoring payment/order lifecycle;
- Intensive Mentoring enrollment/session scheduling;
- mentor assignment for Intensive Mentoring;
- a generic CMS for all marketing text;
- a revived generic Product Catalog Master.

Those require separate operational requirements and should not be partially invented here.

## 15. Testing strategy

### 15.1 Migration/schema tests

Verify:

- all new tables, constraints, indexes, triggers, and RLS policies;
- guidebook-backed seed rows and prices;
- consultation-mode constraints;
- bundle item exactly-one-target constraint;
- admin CRUD grants/policies;
- public active-only visibility;
- safe FK behavior for existing Private references.

### 15.2 Server/runtime tests

Verify:

- Private catalog still loads existing domain data;
- Intensive catalog resolves package/add-on/bundle trees in sort order;
- inactive records are omitted publicly;
- bundle items resolve correctly;
- inactive referenced items are not presented as valid public content;
- consultation packages never format as zero-price products.

### 15.3 Admin component/layout tests

Verify:

- navigation includes Private, Intensive, Competition Categories, Digital Products;
- Private no longer renders Competition Categories inline;
- CRUD tables use sortable headers and pagination;
- create/edit uses modal dialogs;
- package identity fields that must remain stable are read-only;
- destructive actions require confirmation;
- empty/loading/error states remain usable.

### 15.4 Public-page tests

Verify:

- Private detail still uses DB catalog plus static editorial;
- Intensive detail now loads the Intensive catalog;
- Intensive package/add-on/bundle values are rendered from DB structures, not duplicated hardcoded pricing;
- homepage and `/program` stay high-level rather than becoming catalog pages;
- public fallback behavior works when catalog loading fails.

### 15.5 Full verification

Run the repository’s relevant:

- typecheck;
- lint;
- unit/integration tests;
- build;
- existing Private Mentoring tests;
- new Intensive Mentoring tests.

Then visually verify at minimum:

- Admin → Private Mentoring, desktop and narrow viewport;
- Admin → Intensive Mentoring, desktop and narrow viewport;
- Admin → Competition Categories;
- `/program/private-mentoring`;
- `/program/intensive-mentoring`;
- `/program`;
- homepage program section.

## 16. Git and integration workflow

1. Work only on `feat/mentoring-catalog-management`, created from the latest `main`.
2. Keep total commits at three or fewer; target one implementation bulk commit after this design commit.
3. Before finalizing implementation, re-check latest `main` for conflicting changes.
4. Do not push unrelated refactors.
5. Do not modify `main` directly.
6. Final handoff must report verification results, commit(s), and any migration/deployment prerequisite clearly.
