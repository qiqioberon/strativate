# Branch Integration Design

## Objective

Integrate `origin/main` at `ce29bc1983871a0f7ab3ba9c70b7dde93122bb4c`
into `origin/emergent-qq` at `d940d8f6a869c393418adb6645187b9ffe082caf`
without rewriting history. The result must be a semantic union of the Mentor
Domain and Marketing Revision, validated locally, pushed to `emergent-qq`, and
opened as a pull request to `main` without merging the pull request.

## Audited branch state

The merge base is `3e98d257471b66f1bd83c617e570d47c8fb2804c`.
The recursive blob audit classified 224 tracked paths:

- 112 identical;
- 15 main-only;
- 9 modified only by main;
- 37 emergent-only;
- 47 modified only by emergent;
- 4 modified by both.

Binary browser screenshots and text platform outputs were inspected by type and
provenance rather than treated as product assets.

## Integration matrix

| Area | Authoritative behavior | Integration decision |
| --- | --- | --- |
| Mentor accounts, tiers, invitations, availability, admin management | `main` | Preserve all schema, RPC, type, UI, and test behavior. |
| Protected-route classification | `main` | Preserve `lib/auth/routes.ts` and its use from `proxy.ts`; `/mentor` remains public. |
| Public marketing, naming, feature flag, motion, FAQ, mentor modal/marquee, WhatsApp | `emergent-qq` | Preserve the complete Marketing Revision and tests. |
| Hero posters | `emergent-qq` | Preserve the table, bucket, RLS, Storage policies, RPC, graceful fallback, carousel, and authenticated admin CRUD. |
| Admin dashboard | Both | Use `MentorManagement` and `MenteeManagement` from main while retaining the digital-product feature flag and approved public naming. |
| Mentor dashboard | Both | Keep main's persistent availability editor while retaining approved Marketing Revision labels and brand presentation. |
| Global CSS | Both | Keep Poppins and all marketing/Hero Poster styles from emergent plus all Mentor Domain management/availability styles from main. |
| Supabase types | Both | Build an explicit union containing Product Catalog/Auth, Marketing Hero Poster, and Mentor Domain definitions and RPCs. |
| SQL bootstrap and tests | Both | Preserve both domain suites and merge prerequisites/fixtures without weakening assertions. |
| Migrations | Both | Preserve `202609120001_marketing_hero_posters.sql` followed by `202609130001_mentor_domain.sql`; do not edit published history. |
| Next.js configuration | `emergent-qq`, checked against local Next 16.3 docs | Keep required Supabase image patterns and one coherent redirect strategy; retain preview origins only when valid for development configuration. |
| Content and assets | Repository handoff documents | Preserve Poppins, approved palette/logos, 26-person roster, approved claims, Product Master data, and honest missing-content fallbacks. |
| Emergent environment artifacts | Neither product branch | Remove `.emergent/**`, `.gitconfig`, `output/**`, `test_reports/**`, `design_guidelines.json`, and the invalid/unneeded `pnpm-workspace.yaml`. |
| Authenticated prototype data | Existing product boundary | Keep unrelated `lib/demo-store.ts` operational prototypes, ensure they are not public facts, and disclose them in the PR. |

## Conflict resolution

The four both-modified files are resolved behavior-by-behavior:

1. `app/admin/page.tsx`: main owns Mentor/Mentee management; emergent owns feature-flag visibility and approved naming.
2. `app/globals.css`: concatenate and reconcile scoped style additions while retaining the approved Poppins token; do not select one complete side.
3. `app/mentor/dashboard/page.tsx`: main owns real availability persistence; emergent owns approved display naming and non-conflicting brand copy.
4. `lib/supabase/database.types.ts`: retain every table, row type, and RPC from both migrations.

Cleanly merged files still receive semantic regression review against both branch
trees. Duplicate `/explore` redirects are reduced to one canonical mechanism
after consulting the repository's Next.js 16.3 documentation.

## Database and remote safety

The local migration chain is applied only to a disposable local test database.
The SQL runner must include `marketing_hero_posters.sql` and `mentor_domain.sql`.
Hosted Supabase is inspected only when CLI authentication and an unambiguous link
identify the target. Remote resets, migration-history rewriting, database drops,
and destructive repair are prohibited. Unexpected drift stops remote mutation
and is reported accurately.

## Validation

Existing tests from both branches form the initial regression contract. New or
updated tests are added before any new behavioral fix where the combined tests
do not already demonstrate the semantic requirement. Validation covers unit,
typecheck, lint, disposable database bootstrap/tests, production build, and
browser flows. Final audits include conflict-marker search, `git diff --check`,
complete comparison to `origin/main`, artifact review, and staged secret checks.

## Completion boundary

The work is complete only after the integrated commit is pushed normally to
`origin/emergent-qq` and a PR to `main` is created. The PR is not merged. Missing
stakeholder portraits, product masters/media, testimonials, institution logos,
and legal documents remain explicitly blocked rather than fabricated.
